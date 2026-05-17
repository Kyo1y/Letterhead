// ── Background Service Worker ──
// Handles message routing and API calls for the Letterhead extension.

// Import lib modules (MV3 service workers support importScripts)
importScripts(
    '../lib/storage.js',
    '../lib/api-client.js',
    '../lib/prompts.js'
);

// ── Storage migration ──
// Runs on every service worker boot (idempotent — schemaVersion check).
// Also wired to onStartup + onInstalled below so it can't be missed.
LetterheadStorage.migrateIfNeeded().catch(err => {
    console.error('[Letterhead] Migration failed:', err);
});

chrome.runtime.onStartup.addListener(() => {
    LetterheadStorage.migrateIfNeeded().catch(err => {
        console.error('[Letterhead] Migration failed (onStartup):', err);
    });
});

// ── Message Listener ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GENERATE_COVER_LETTER') {
        handleCoverLetter(message).then(sendResponse).catch(err => {
            sendResponse({ error: err.message });
        });
        return true; // keep the message channel open for async response
    }

    if (message.type === 'GENERATE_OUTREACH') {
        handleOutreach(message).then(sendResponse).catch(err => {
            sendResponse({ error: err.message });
        });
        return true;
    }

    if (message.type === 'CHECK_SETUP') {
        LetterheadStorage.isSetupComplete().then(ready => {
            sendResponse({ ready });
        });
        return true;
    }
    if (message.type === 'SET_ICON') {
        const suffix = message.enabled ? 'on' : 'off';
        setIconFromFile(`public/letterhead-${suffix}-48.png`)
            .then(() => sendResponse({ ok: true }))
            .catch(err => {
                console.error('[Letterhead] setIcon failed:', err.message);
                sendResponse({ error: err.message });
            });
        return true;
    }

});

/**
 * Handle cover letter generation request.
 * @param {{ jobDescription: string, pageUrl: string, pageTitle: string }} msg
 * @returns {Promise<{ coverLetter: string }>}
 */
async function handleCoverLetter({ jobDescription, pageUrl, pageTitle }) {
    const task = await LetterheadStorage.getTaskConfig('coverLetter');
    const apiKey = await LetterheadStorage.getApiKey(task.provider);
    const { resumeText } = await chrome.storage.local.get(['resumeText']);

    if (!apiKey || !resumeText) {
        throw new Error('Setup incomplete. Please add your API key and résumé in the extension options.');
    }

    const { system, user } = await LetterheadPrompts.buildCoverLetterPrompt(jobDescription);
    const coverLetter = await LetterheadAPI.generateText(task.provider, apiKey, task.model, system, user);

    return { coverLetter };
}

/**
 * Handle LinkedIn outreach generation request.
 * @param {{ profileData: string, pageUrl: string }} msg
 * @returns {Promise<{ outreachMessage: string }>}
 */
async function handleOutreach({ profileData, pageUrl }) {
    const task = await LetterheadStorage.getTaskConfig('outreach');
    const apiKey = await LetterheadStorage.getApiKey(task.provider);
    const { resumeText } = await chrome.storage.local.get(['resumeText']);

    if (!apiKey || !resumeText) {
        throw new Error('Setup incomplete. Please add your API key and résumé in the extension options.');
    }

    const { system, user } = await LetterheadPrompts.buildOutreachPrompt(profileData);
    const outreachMessage = await LetterheadAPI.generateText(task.provider, apiKey, task.model, system, user);

    return { outreachMessage };
}

async function setIconFromFile(relativePath) {
    const url = chrome.runtime.getURL(relativePath);
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    await chrome.action.setIcon({ imageData });
}

// ── Install handler: run migration, open options page on first install ──
chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        await LetterheadStorage.migrateIfNeeded();
    } catch (err) {
        console.error('[Letterhead] Migration failed (onInstalled):', err);
    }
    if (details.reason === 'install') {
        chrome.tabs.create({ url: 'options.html' });
    }
});
