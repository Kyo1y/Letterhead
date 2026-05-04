// options.js — external script for options.html

// pdf.js worker path — set after module loads
window.addEventListener('load', () => {
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/vendor/pdf.worker.min.mjs';
    }
});


const inputResume = document.getElementById('resume-input');
const iconResume = document.getElementById('upload-icon-resume');
const labelResume = document.getElementById('upload-label-resume');

const inputContext = document.getElementById('context-input');
const iconContext = document.getElementById('upload-icon-context');
const labelContext = document.getElementById('upload-label-context');

const submitBtn = document.getElementById('context-submit-btn');
const apiKeyInput = document.getElementById('api-key-input');
const apiProviderSelect = document.getElementById('api-provider');
const statusBar = document.getElementById('status-bar');


let resumeFile = null;
let contextFile = null;

const USE_STORED = Symbol('use_stored');

function checkBothUploaded() {
    const resumeReady = resumeFile !== null;
    const contextReady = contextFile !== null;
    const hasNewFile = (resumeFile instanceof File) || (contextFile instanceof File);
    submitBtn.disabled = !(resumeReady && contextReady && hasNewFile);
}

function showStatus(message, isError = false) {
    statusBar.textContent = message;
    statusBar.className = `fade-in visible rounded-xl px-6 py-3 text-lg text-center ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'
        }`;
    if (!isError) {
        setTimeout(() => { statusBar.className = 'hidden'; }, 4000);
    }
}

// ── Load saved settings on page open ──
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['apiKey', 'apiProvider', 'resumeText', 'contextText'], (data) => {
        if (data.apiKey) apiKeyInput.value = data.apiKey;
        if (data.apiProvider) apiProviderSelect.value = data.apiProvider;
        if (data.resumeText) {
            resumeFile = USE_STORED;
            iconResume.src = 'public/pdf_added.svg';
            iconResume.alt = 'PDF added';
            labelResume.textContent = `Résumé (${Math.round(data.resumeText.length / 1000)}k chars)`;
        }
        if (data.contextText) {
            contextFile = USE_STORED;
            iconContext.src = 'public/markdown_added.svg';
            iconContext.alt = 'MD added';
            labelContext.textContent = `Context (${Math.round(data.contextText.length / 1000)}k chars)`;
        }
        checkBothUploaded();
    });
}

// ── Auto-save API key + provider on change ──
apiKeyInput.addEventListener('change', () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ apiKey: apiKeyInput.value.trim() });
    }
});
apiProviderSelect.addEventListener('change', () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ apiProvider: apiProviderSelect.value });
    }
});


document.getElementById('resume-drop-zone').addEventListener('click', () => inputResume.click());

inputResume.addEventListener('change', () => {
    const file = inputResume.files[0];
    if (!file) return;

    resumeFile = file;
    inputResume.value = '';

    const truncated = file.name.length > 14
        ? file.name.slice(0, 12) + '…'
        : file.name;

    iconResume.src = 'public/pdf_added.svg';
    iconResume.alt = 'PDF added';
    labelResume.textContent = truncated;
    checkBothUploaded();
});

document.getElementById('context-drop-zone').addEventListener('click', () => inputContext.click());

inputContext.addEventListener('change', () => {
    const file = inputContext.files[0];
    if (!file) return;

    contextFile = file;
    inputContext.value = '';

    const truncated = file.name.length > 14
        ? file.name.slice(0, 12) + '…'
        : file.name;

    iconContext.src = 'public/markdown_added.svg';
    iconContext.alt = 'MD added';
    labelContext.textContent = truncated;
    checkBothUploaded();
});

// ── Upload handler ──
submitBtn.addEventListener('click', async () => {
    const pdfFile = resumeFile;
    const mdFile = contextFile;
    if (!pdfFile || !mdFile) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing…';

    try {
        let resumeText, contextText;

        if (pdfFile === USE_STORED) {
            const stored = await new Promise(r => chrome.storage.local.get(['resumeText'], r));
            resumeText = stored.resumeText ?? '';
        } else {
            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pages = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                pages.push(content.items.map(item => item.str).join(' '));
            }
            resumeText = pages.join('\n\n');
        }

        if (mdFile === USE_STORED) {
            const stored = await new Promise(r => chrome.storage.local.get(['contextText'], r));
            contextText = stored.contextText ?? '';
        } else {
            contextText = await mdFile.text();
        }

        // Save to chrome.storage.local
        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({
                resumeText,
                contextText,
                apiKey: apiKeyInput.value.trim(),
                apiProvider: apiProviderSelect.value,
            });
            showStatus('✓ Saved! Your résumé and context are ready.');
        } else {
            showStatus('✓ Files processed (storage unavailable outside extension).', false);
        }
    } catch (err) {
        showStatus(`Error: ${err.message}`, true);
        console.error(err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload';
        checkBothUploaded();
    }
});

// ── Fade-in observer ──
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
