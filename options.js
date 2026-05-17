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
const statusBar = document.getElementById('status-bar');

const TASKS = ['coverLetter', 'outreach'];

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

// ── API Keys: render one row per provider, auto-save on change ──
function renderApiKeyRows() {
    const container = document.getElementById('api-keys-container');
    container.innerHTML = '';
    for (const [provider, meta] of Object.entries(LetterheadStorage.PROVIDERS)) {
        const row = document.createElement('div');
        row.className = 'flex md:flex-row flex-col gap-10 md:items-center';

        const label = document.createElement('label');
        label.htmlFor = `key-${provider}`;
        label.className = 'text-xl text-black/70 md:w-44';
        label.textContent = meta.label;

        const input = document.createElement('input');
        input.id = `key-${provider}`;
        input.dataset.provider = provider;
        input.type = 'password';
        input.placeholder = meta.placeholder;
        input.className = 'flex-1 bg-white/70 border border-black/20 rounded-xl px-4 py-2 text-base focus:outline-none focus:border-[#F26419] transition-colors font-mono';

        row.append(label, input);
        container.appendChild(row);
    }
}

function wireApiKeyInputs() {
    document.querySelectorAll('[data-provider]').forEach(input => {
        const provider = input.dataset.provider;
        input.addEventListener('change', async () => {
            await LetterheadStorage.setApiKey(provider, input.value.trim());
            // A key just became set/unset — refresh both task provider dropdowns
            // so the disabled state on unconfigured providers stays accurate.
            for (const task of TASKS) {
                await loadTaskConfig(task);
            }
        });
    });
}

async function loadApiKeys() {
    const keys = await LetterheadStorage.getAllApiKeys();
    document.querySelectorAll('[data-provider]').forEach(input => {
        const provider = input.dataset.provider;
        input.value = keys[provider] || '';
    });
}

// ── Per-task config: build provider + model dropdowns, auto-save on change ──
function buildProviderOptions(selectEl, selectedProvider, apiKeys) {
    selectEl.innerHTML = '';
    for (const provider of LetterheadStorage.SUPPORTED_PROVIDERS) {
        const opt = document.createElement('option');
        opt.value = provider;
        const label = LetterheadStorage.PROVIDER_LABELS[provider] || provider;
        const hasKey = !!apiKeys[provider];
        opt.textContent = hasKey ? label : `${label} — no API key`;
        opt.disabled = !hasKey;
        if (provider === selectedProvider) opt.selected = true;
        selectEl.appendChild(opt);
    }
}

function buildModelOptions(selectEl, provider, selectedModel) {
    selectEl.innerHTML = '';
    const models = LetterheadStorage.MODEL_OPTIONS[provider] || [];
    for (const model of models) {
        const opt = document.createElement('option');
        opt.value = model;
        opt.textContent = model;
        if (model === selectedModel) opt.selected = true;
        selectEl.appendChild(opt);
    }
    // If the stored model isn't in the curated list, add it as a one-off option
    // so we don't silently overwrite the user's choice on first render.
    if (selectedModel && !models.includes(selectedModel)) {
        const opt = document.createElement('option');
        opt.value = selectedModel;
        opt.textContent = `${selectedModel} (custom)`;
        opt.selected = true;
        selectEl.appendChild(opt);
    }
}

async function loadTaskConfig(task) {
    const providerEl = document.getElementById(`provider-${task}`);
    const modelEl = document.getElementById(`model-${task}`);

    // Read the raw stored task config (not the fallback-resolved version),
    // since the user is editing the literal setting here.
    const data = await chrome.storage.local.get([
        LetterheadStorage.STORAGE_KEYS.TASK_CONFIG,
        LetterheadStorage.STORAGE_KEYS.API_KEYS,
    ]);
    const stored = data[LetterheadStorage.STORAGE_KEYS.TASK_CONFIG]?.[task]
        || LetterheadStorage.DEFAULT_TASK_CONFIG[task];
    const apiKeys = data[LetterheadStorage.STORAGE_KEYS.API_KEYS] || {};

    buildProviderOptions(providerEl, stored.provider, apiKeys);
    buildModelOptions(modelEl, stored.provider, stored.model);
}

function wireTaskConfig(task) {
    const providerEl = document.getElementById(`provider-${task}`);
    const modelEl = document.getElementById(`model-${task}`);

    providerEl.addEventListener('change', async () => {
        const provider = providerEl.value;
        const model = LetterheadStorage.DEFAULT_MODELS[provider];
        await LetterheadStorage.setTaskConfig(task, { provider, model });
        buildModelOptions(modelEl, provider, model);
    });

    modelEl.addEventListener('change', async () => {
        await LetterheadStorage.setTaskConfig(task, { model: modelEl.value });
    });
}

// ── Per-task tone + prompt editors ──
// Required placeholders per task — used to warn if user edits them out.
const REQUIRED_PLACEHOLDERS = {
    coverLetter: ['{resumeText}', '{jobDescription}'],
    outreach:    ['{resumeText}', '{profileData}'],
};

function setTaskToneSelection(task, preset) {
    const radios = document.querySelectorAll(`input[name="tone-${task}"]`);
    radios.forEach(r => { r.checked = (r.value === preset); });
    // Show this task's prompt editor only when its tone is 'custom'
    const editor = document.getElementById(`editor-${task}`);
    editor.classList.toggle('hidden', preset !== 'custom');
    editor.classList.toggle('flex', preset === 'custom');
}

function validatePrompt(task) {
    const systemEl = document.getElementById(`system-${task}`);
    const userEl = document.getElementById(`user-${task}`);
    const warnEl = document.getElementById(`warn-${task}`);
    const combined = `${systemEl.value}\n${userEl.value}`;
    const missing = REQUIRED_PLACEHOLDERS[task].filter(p => !combined.includes(p));
    if (missing.length === 0) {
        warnEl.classList.add('hidden');
        warnEl.textContent = '';
    } else {
        warnEl.classList.remove('hidden');
        warnEl.textContent = `⚠ Missing placeholder(s): ${missing.join(', ')}. The model won't see this data.`;
    }
}

async function loadPrompt(task) {
    const prompt = await LetterheadStorage.getPrompt(task);
    document.getElementById(`system-${task}`).value = prompt.system;
    document.getElementById(`user-${task}`).value = prompt.user;
    validatePrompt(task);
}

function wirePromptEditors() {
    document.querySelectorAll('[data-task][data-field]').forEach(el => {
        const task = el.dataset.task;
        const field = el.dataset.field;
        el.addEventListener('input', async () => {
            await LetterheadStorage.setPrompt(task, { [field]: el.value });
            validatePrompt(task);
        });
    });

    for (const task of TASKS) {
        const btn = document.getElementById(`reset-${task}`);
        btn.addEventListener('click', async () => {
            await LetterheadStorage.resetPrompt(task);
            await loadPrompt(task);
        });
    }
}

async function seedCustomPromptIfNeeded(task) {
    // Bake the currently active preset tone string into the default prompt
    // and save as the starting custom prompt. Only runs the first time the
    // user enters custom mode for this task — preserves edits on later toggles.
    if (await LetterheadStorage.hasCustomPrompt(task)) return;

    const prevTone = await LetterheadStorage.getTaskTone(task);
    const toneText = LetterheadStorage.TONE_PRESETS[prevTone] || '';
    const defaultPrompt = LetterheadStorage.DEFAULT_PROMPTS[task];

    await LetterheadStorage.setPrompt(task, {
        system: defaultPrompt.system.replace(/\{tone\}/g, toneText),
        user:   defaultPrompt.user.replace(/\{tone\}/g, toneText),
    });
    await loadPrompt(task);
}

function wireTaskTone(task) {
    document.querySelectorAll(`input[name="tone-${task}"]`).forEach(input => {
        input.addEventListener('change', async () => {
            const newTone = input.value;
            if (newTone === 'custom') {
                await seedCustomPromptIfNeeded(task);
            }
            await LetterheadStorage.setTaskTone(task, newTone);
            setTaskToneSelection(task, newTone);
        });
    });
}

// ── Load saved settings on page open ──
async function loadSettings() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    await LetterheadStorage.migrateIfNeeded();

    renderApiKeyRows();
    await loadApiKeys();
    for (const task of TASKS) {
        await loadTaskConfig(task);
        wireTaskConfig(task);
        await loadPrompt(task);
        wireTaskTone(task);
        const taskTone = await LetterheadStorage.getTaskTone(task);
        setTaskToneSelection(task, taskTone);
    }
    wireApiKeyInputs();
    wirePromptEditors();

    const { resumeText, contextText } = await chrome.storage.local.get(['resumeText', 'contextText']);
    if (resumeText) {
        resumeFile = USE_STORED;
        iconResume.src = 'public/pdf_added.svg';
        iconResume.alt = 'PDF added';
        labelResume.textContent = `Résumé (${Math.round(resumeText.length / 1000)}k chars)`;
    }
    if (contextText) {
        contextFile = USE_STORED;
        iconContext.src = 'public/markdown_added.svg';
        iconContext.alt = 'MD added';
        labelContext.textContent = `Context (${Math.round(contextText.length / 1000)}k chars)`;
    }
    checkBothUploaded();
}
loadSettings();


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

// ── Upload handler — processes files only. API keys + task config auto-save. ──
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

        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({ resumeText, contextText });
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
