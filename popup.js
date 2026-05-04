const dotApi = document.getElementById('dot-api');
const dotResume = document.getElementById('dot-resume');
const dotContext = document.getElementById('dot-context');
const labelApi = document.getElementById('label-api');
const labelResume = document.getElementById('label-resume');
const labelContext = document.getElementById('label-context');
const toggleEnabled = document.getElementById('toggle-enabled');

chrome.storage.local.get(['apiKey', 'apiProvider', 'resumeText', 'contextText', 'enabled'], (data) => {
    if (data.apiKey) {
        dotApi.className = 'status-dot ok';
        const provider = data.apiProvider === 'openai' ? 'OpenAI' : 'Claude';
        labelApi.textContent = `API key set (${provider})`;
    } else {
        dotApi.className = 'status-dot missing';
        labelApi.textContent = 'API key not set';
    }

    if (data.resumeText) {
        dotResume.className = 'status-dot ok';
        labelResume.textContent = `Résumé uploaded (${data.resumeText.length} chars)`;
    } else {
        dotResume.className = 'status-dot missing';
        labelResume.textContent = 'Résumé not uploaded';
    }

    if (data.contextText) {
        dotContext.className = 'status-dot ok';
        labelContext.textContent = `Context uploaded (${data.contextText.length} chars)`;
    } else {
        dotContext.className = 'status-dot missing';
        labelContext.textContent = 'Context not uploaded';
    }

    // Default to enabled if not explicitly set
    toggleEnabled.checked = data.enabled !== false;
});

toggleEnabled.addEventListener('change', () => {
    const on = toggleEnabled.checked;
    chrome.storage.local.set({ enabled: on });
    chrome.runtime.sendMessage({ type: 'SET_ICON', enabled: on });
});

