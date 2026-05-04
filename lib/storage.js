// ── Storage wrapper for chrome.storage.local + session ──

const STORAGE_KEYS = {
    API_KEY: 'apiKey',
    API_PROVIDER: 'apiProvider',   // 'openai' | 'claude'
    RESUME_TEXT: 'resumeText',
    CONTEXT_TEXT: 'contextText',
};

const SESSION_KEYS = {
    ACTIVE: 'sessionActive',       // user said "Yes" to the banner
    DISMISSED: 'sessionDismissed', // user said "No" to the banner
};

/**
 * Read user config from chrome.storage.local.
 * @returns {Promise<{apiKey:string, apiProvider:string, resumeText:string, contextText:string}>}
 */
async function getConfig() {
    return chrome.storage.local.get([
        STORAGE_KEYS.API_KEY,
        STORAGE_KEYS.API_PROVIDER,
        STORAGE_KEYS.RESUME_TEXT,
        STORAGE_KEYS.CONTEXT_TEXT,
    ]);
}

/**
 * Write partial config to chrome.storage.local.
 * @param {Object} partial
 */
async function setConfig(partial) {
    return chrome.storage.local.set(partial);
}

/**
 * Check if essential setup is done (API key + resume text).
 * @returns {Promise<boolean>}
 */
async function isSetupComplete() {
    const cfg = await getConfig();
    return !!(cfg.apiKey && cfg.resumeText);
}

/**
 * Read session state flags.
 * @returns {Promise<{sessionActive:boolean, sessionDismissed:boolean}>}
 */
async function getSessionState() {
    return chrome.storage.session.get([
        SESSION_KEYS.ACTIVE,
        SESSION_KEYS.DISMISSED,
    ]);
}

/**
 * Write partial session state.
 * @param {Object} partial
 */
async function setSessionState(partial) {
    return chrome.storage.session.set(partial);
}

// Make available in both content script and service-worker contexts
if (typeof globalThis !== 'undefined') {
    globalThis.LetterheadStorage = {
        STORAGE_KEYS,
        SESSION_KEYS,
        getConfig,
        setConfig,
        isSetupComplete,
        getSessionState,
        setSessionState,
    };
}
