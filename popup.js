const dotApi = document.getElementById('dot-api');
const dotResume = document.getElementById('dot-resume');
const dotContext = document.getElementById('dot-context');
const labelApi = document.getElementById('label-api');
const labelResume = document.getElementById('label-resume');
const labelContext = document.getElementById('label-context');
const toggleEnabled = document.getElementById('toggle-enabled');

const TASKS = ['coverLetter', 'outreach'];

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
    // Preserve any custom (non-curated) model the user has set
    if (selectedModel && !models.includes(selectedModel)) {
        const opt = document.createElement('option');
        opt.value = selectedModel;
        opt.textContent = `${selectedModel} (custom)`;
        opt.selected = true;
        selectEl.appendChild(opt);
    }
}

async function setupQuickSwitch(task) {
    // Read raw stored task config so we show what's literally saved, not the fallback.
    const data = await chrome.storage.local.get([
        LetterheadStorage.STORAGE_KEYS.TASK_CONFIG,
        LetterheadStorage.STORAGE_KEYS.API_KEYS,
    ]);
    const stored = data[LetterheadStorage.STORAGE_KEYS.TASK_CONFIG]?.[task]
        || LetterheadStorage.DEFAULT_TASK_CONFIG[task];
    const apiKeys = data[LetterheadStorage.STORAGE_KEYS.API_KEYS] || {};

    const providerSelect = document.getElementById(`provider-${task}`);
    const modelSelect = document.getElementById(`model-${task}`);

    buildProviderOptions(providerSelect, stored.provider, apiKeys);
    buildModelOptions(modelSelect, stored.provider, stored.model);

    providerSelect.addEventListener('change', async () => {
        const provider = providerSelect.value;
        const model = LetterheadStorage.DEFAULT_MODELS[provider];
        await LetterheadStorage.setTaskConfig(task, { provider, model });
        buildModelOptions(modelSelect, provider, model);
    });

    modelSelect.addEventListener('change', async () => {
        await LetterheadStorage.setTaskConfig(task, { model: modelSelect.value });
    });
}

async function refresh() {
    await LetterheadStorage.migrateIfNeeded();

    for (const task of TASKS) {
        await setupQuickSwitch(task);
    }

    // Status indicators — use fallback-aware getTaskConfig so the API-key
    // check reflects what will actually be used at generation time.
    const task = await LetterheadStorage.getTaskConfig('coverLetter');
    const apiKey = await LetterheadStorage.getApiKey(task.provider);
    const { resumeText, contextText, enabled } = await chrome.storage.local.get([
        'resumeText', 'contextText', 'enabled',
    ]);

    if (apiKey) {
        dotApi.className = 'status-dot ok';
        labelApi.textContent = 'API key set';
    } else {
        dotApi.className = 'status-dot missing';
        labelApi.textContent = 'API key not set';
    }

    if (resumeText) {
        dotResume.className = 'status-dot ok';
        labelResume.textContent = `Résumé uploaded (${resumeText.length} chars)`;
    } else {
        dotResume.className = 'status-dot missing';
        labelResume.textContent = 'Résumé not uploaded';
    }

    if (contextText) {
        dotContext.className = 'status-dot ok';
        labelContext.textContent = `Context uploaded (${contextText.length} chars)`;
    } else {
        dotContext.className = 'status-dot missing';
        labelContext.textContent = 'Context not uploaded';
    }

    toggleEnabled.checked = enabled !== false;
}

refresh();

toggleEnabled.addEventListener('change', () => {
    const on = toggleEnabled.checked;
    chrome.storage.local.set({ enabled: on });
    chrome.runtime.sendMessage({ type: 'SET_ICON', enabled: on });
});
