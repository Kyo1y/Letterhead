// ── Storage wrapper for chrome.storage.local + session ──
// Schema v3 — multi-provider API keys, per-task config (provider/model/tone),
// editable prompts. Includes one-time migration from v1 / v2.

const SCHEMA_VERSION = 3;

const STORAGE_KEYS = {
    SCHEMA_VERSION: 'schemaVersion',
    API_KEYS: 'apiKeys',          // { claude: 'sk-ant-...', openai: 'sk-...', ... }
    TASK_CONFIG: 'taskConfig',    // { coverLetter: { provider, model, tone }, outreach: {...} }
    PROMPTS: 'prompts',           // { coverLetter: { system, user }, outreach: {...} }
    RESUME_TEXT: 'resumeText',
    CONTEXT_TEXT: 'contextText',
    ENABLED: 'enabled',
};

// Legacy v2 keys (only referenced by the migration function below).
const LEGACY_TONE_PRESET = 'tonePreset';
const LEGACY_CUSTOM_TONE = 'customTone';

const SESSION_KEYS = {
    ACTIVE: 'sessionActive',
    DISMISSED: 'sessionDismissed',
};

// Single source of truth for provider metadata.
// Order here determines the order in UI dropdowns / key lists.
const PROVIDERS = {
    claude:     { label: 'Claude (Anthropic)', placeholder: 'sk-ant-…' },
    openai:     { label: 'OpenAI',             placeholder: 'sk-…' },
    google:     { label: 'Gemini (Google)',    placeholder: 'AIza…' },
    xai:        { label: 'Grok (xAI)',         placeholder: 'xai-…' },
    deepseek:   { label: 'DeepSeek',           placeholder: 'sk-…' },
    openrouter: { label: 'OpenRouter',         placeholder: 'sk-or-…' },
};

const SUPPORTED_PROVIDERS = Object.keys(PROVIDERS);
const PROVIDER_LABELS = Object.fromEntries(
    Object.entries(PROVIDERS).map(([k, v]) => [k, v.label])
);

const DEFAULT_MODELS = {
    claude:     'claude-sonnet-4-20250514',
    openai:     'gpt-4o',
    google:     'gemini-2.5-pro',
    xai:        'grok-3',
    deepseek:   'deepseek-chat',
    openrouter: 'anthropic/claude-sonnet-4',
};

// Curated dropdown options per provider. Users can still get other models by
// editing chrome.storage directly; UI exposes these common ones for now.
const MODEL_OPTIONS = {
    claude: [
        'claude-opus-4-20250514',
        'claude-sonnet-4-20250514',
        'claude-3-5-haiku-latest',
    ],
    openai: [
        'gpt-4o',
        'gpt-4o-mini',
        'o1-mini',
    ],
    google: [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
    ],
    xai: [
        'grok-3',
        'grok-2',
    ],
    deepseek: [
        'deepseek-chat',
        'deepseek-reasoner',
    ],
    openrouter: [
        'anthropic/claude-opus-4',
        'anthropic/claude-sonnet-4',
        'openai/gpt-4o',
        'google/gemini-2.5-pro',
        'deepseek/deepseek-chat',
        'meta-llama/llama-3.3-70b-instruct',
    ],
};

const TASK_LABELS = {
    coverLetter: 'Cover Letter',
    outreach:    'Outreach (LinkedIn)',
};

const TONE_PRESETS = {
    casual:     'Conversational and warm — write like a real email from a friendly professional, not a corporate brochure.',
    formal:     'Professional and measured — use precise language and a respectful, business-appropriate register.',
    contextual: 'Match the tone of the job posting itself — if the posting or the company is casual, be casual; if it is formal, be formal.',
};

const DEFAULT_TONE_PRESET = 'contextual';

const DEFAULT_TASK_CONFIG = {
    coverLetter: { provider: 'claude', model: DEFAULT_MODELS.claude, tone: DEFAULT_TONE_PRESET },
    outreach:    { provider: 'claude', model: DEFAULT_MODELS.claude, tone: DEFAULT_TONE_PRESET },
};

// Template versions of the prompts in lib/prompts.js — used as defaults when
// the editable-prompts feature lands. Placeholders: {resumeText},
// {contextText}, {tone}, {jobDescription}, {profileData}.
const DEFAULT_PROMPTS = {
    coverLetter: {
        system: `You are a professional cover letter writer. You write tailored, authentic cover letters that sound like the applicant — not a template.

Here is the applicant's résumé:
---
{resumeText}
---

Here is the applicant's personal context:
---
{contextText}
---

Tone: {tone}

Rules:
- Focus on experiences and skills from the résumé that are most relevant to the job.
- Do NOT invent achievements or experiences not present in the résumé.
- Keep it under 400 words.
- Do not use cliché openers like "I am excited to apply for…".
- Before writing, generate a random string and then start writing.
- Output only the cover letter text — no random string, subject lines, headers, or metadata.`,
        user: `Here is the job posting:\n---\n{jobDescription}\n---\n\nWrite a cover letter for this position.`,
    },
    outreach: {
        system: `You are a networking message writer. You write short, genuine outreach messages for LinkedIn.

Here is the sender's résumé:
---
{resumeText}
---

Here is the sender's personal context:
---
{contextText}
---

Tone: {tone}

Rules:
- Keep it under 300 characters — this rule is a MUST.
- Find genuine common ground between the sender and the recipient.
- Be warm but not sycophantic.
- If the sender's context mentions target roles, tie the outreach to those interests.
- Output only the message text.`,
        user: `Here is the LinkedIn profile of the person I'd like to reach out to:\n---\n{profileData}\n---\n\nWrite a short outreach message.`,
    },
};


// One-shot migration to v3. Handles both v1 (flat apiKey/apiProvider) and v2
// (nested apiKeys + global tonePreset) source data. Idempotent — exits early
// once schemaVersion >= 3.
async function migrateIfNeeded() {
    const data = await chrome.storage.local.get(null);
    const currentVersion = data[STORAGE_KEYS.SCHEMA_VERSION] || 1;

    if (currentVersion >= SCHEMA_VERSION) return;

    console.log(`[Letterhead] Migrating storage v${currentVersion} → v${SCHEMA_VERSION}…`);

    // Resolve apiKeys map. v2 already has it; v1 had flat apiKey + apiProvider.
    const apiKeys = data[STORAGE_KEYS.API_KEYS] || {};
    if (data.apiKey) {
        const provider = data.apiProvider || 'claude';
        apiKeys[provider] = data.apiKey;
    }

    // Resolve which provider/model to seed new tasks with.
    const existingTaskConfig = data[STORAGE_KEYS.TASK_CONFIG] || {};
    const seedProvider = data.apiProvider
        || existingTaskConfig.coverLetter?.provider
        || 'claude';
    const seedModel = DEFAULT_MODELS[seedProvider] || DEFAULT_MODELS.claude;

    // v2 had a single global tonePreset — propagate it into both tasks for v3.
    const inheritedTone = data[LEGACY_TONE_PRESET] || DEFAULT_TONE_PRESET;

    const taskConfig = {
        coverLetter: {
            provider: existingTaskConfig.coverLetter?.provider || seedProvider,
            model:    existingTaskConfig.coverLetter?.model    || seedModel,
            tone:     existingTaskConfig.coverLetter?.tone     || inheritedTone,
        },
        outreach: {
            provider: existingTaskConfig.outreach?.provider || seedProvider,
            model:    existingTaskConfig.outreach?.model    || seedModel,
            tone:     existingTaskConfig.outreach?.tone     || inheritedTone,
        },
    };

    await chrome.storage.local.set({
        [STORAGE_KEYS.SCHEMA_VERSION]: SCHEMA_VERSION,
        [STORAGE_KEYS.API_KEYS]: apiKeys,
        [STORAGE_KEYS.TASK_CONFIG]: taskConfig,
        [STORAGE_KEYS.PROMPTS]: data[STORAGE_KEYS.PROMPTS] || DEFAULT_PROMPTS,
    });

    // Strip legacy keys: v1 flat fields + v2 global tone fields.
    await chrome.storage.local.remove(['apiKey', 'apiProvider', LEGACY_TONE_PRESET, LEGACY_CUSTOM_TONE]);

    console.log('[Letterhead] Migration complete.');
}


async function getApiKey(provider) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.API_KEYS);
    return data[STORAGE_KEYS.API_KEYS]?.[provider] || '';
}

async function setApiKey(provider, key) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.API_KEYS);
    const apiKeys = data[STORAGE_KEYS.API_KEYS] || {};
    if (key) {
        apiKeys[provider] = key;
    } else {
        delete apiKeys[provider];
    }
    return chrome.storage.local.set({ [STORAGE_KEYS.API_KEYS]: apiKeys });
}

async function getAllApiKeys() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.API_KEYS);
    return data[STORAGE_KEYS.API_KEYS] || {};
}

// Returns the *effective* task config — if the task's configured provider has
// no API key, falls back to any other task whose provider does. This means
// configuring one task implicitly covers both, which matches the UX intent of
// "never leave the user hanging on one task."
async function getTaskConfig(taskName) {
    const data = await chrome.storage.local.get([STORAGE_KEYS.TASK_CONFIG, STORAGE_KEYS.API_KEYS]);
    const taskConfig = data[STORAGE_KEYS.TASK_CONFIG] || DEFAULT_TASK_CONFIG;
    const apiKeys = data[STORAGE_KEYS.API_KEYS] || {};

    const primary = taskConfig[taskName] || DEFAULT_TASK_CONFIG[taskName];

    if (apiKeys[primary.provider]) return primary;

    // Primary provider has no key — find any sibling task whose provider does.
    for (const sibling of Object.values(taskConfig)) {
        if (apiKeys[sibling.provider]) return sibling;
    }

    return primary;
}

async function setTaskConfig(taskName, partial) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.TASK_CONFIG);
    const taskConfig = data[STORAGE_KEYS.TASK_CONFIG] || { ...DEFAULT_TASK_CONFIG };
    taskConfig[taskName] = { ...taskConfig[taskName], ...partial };
    return chrome.storage.local.set({ [STORAGE_KEYS.TASK_CONFIG]: taskConfig });
}

async function getPrompt(taskName) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.PROMPTS);
    return data[STORAGE_KEYS.PROMPTS]?.[taskName] || DEFAULT_PROMPTS[taskName];
}

// Distinguishes "user has saved a custom prompt" from "we're falling back to default".
async function hasCustomPrompt(taskName) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.PROMPTS);
    return !!data[STORAGE_KEYS.PROMPTS]?.[taskName];
}

async function setPrompt(taskName, partial) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.PROMPTS);
    const prompts = data[STORAGE_KEYS.PROMPTS] || { ...DEFAULT_PROMPTS };
    prompts[taskName] = { ...prompts[taskName], ...partial };
    return chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: prompts });
}

// "Reset to default" in custom mode means "give me a fresh working starting
// point." Since the user is already in custom mode, the previous-tone trick
// from seedCustomPromptIfNeeded doesn't apply — we just bake in the
// contextual preset (system default) so the prompt is usable as-is.
async function resetPrompt(taskName) {
    const defaultPrompt = DEFAULT_PROMPTS[taskName];
    const toneText = TONE_PRESETS[DEFAULT_TONE_PRESET];
    return setPrompt(taskName, {
        system: defaultPrompt.system.replace(/\{tone\}/g, toneText),
        user:   defaultPrompt.user.replace(/\{tone\}/g, toneText),
    });
}

// Tone is now per-task — read from taskConfig[task].tone.
async function getTaskTone(taskName) {
    const task = await getTaskConfig(taskName);
    return task.tone || DEFAULT_TONE_PRESET;
}

// Returns the string that fills the {tone} placeholder in prompt templates
// for a given task. For 'custom', returns empty — the user authors the entire
// prompt themselves; {tone}, if present in their template, resolves to "".
async function getToneText(taskName) {
    const preset = await getTaskTone(taskName);
    if (preset === 'custom') return '';
    return TONE_PRESETS[preset] || TONE_PRESETS[DEFAULT_TONE_PRESET];
}

async function setTaskTone(taskName, preset) {
    return setTaskConfig(taskName, { tone: preset });
}

async function isTaskReady(taskName) {
    const data = await chrome.storage.local.get([STORAGE_KEYS.RESUME_TEXT]);
    if (!data[STORAGE_KEYS.RESUME_TEXT]) return false;
    // Uses getTaskConfig which already does fallback to any configured provider.
    const task = await getTaskConfig(taskName);
    return !!(await getApiKey(task.provider));
}

// ── Legacy compatibility shims ──
// These keep returning the v1 shape so existing callers (api-client, prompts,
// service-worker handlers) keep working until the rest of the refactor lands.

async function getConfig() {
    // Uses fallback-aware getTaskConfig so the legacy shim resolves to a
    // provider that actually has a key (when one is configured).
    const task = await getTaskConfig('coverLetter');
    const apiKey = await getApiKey(task.provider);
    const data = await chrome.storage.local.get([STORAGE_KEYS.RESUME_TEXT, STORAGE_KEYS.CONTEXT_TEXT]);
    return {
        apiKey,
        apiProvider: task.provider,
        resumeText: data[STORAGE_KEYS.RESUME_TEXT] || '',
        contextText: data[STORAGE_KEYS.CONTEXT_TEXT] || '',
    };
}

async function setConfig(partial) {
    return chrome.storage.local.set(partial);
}

async function isSetupComplete() {
    return isTaskReady('coverLetter');
}

// ── Session state (unchanged) ──

async function getSessionState() {
    return chrome.storage.session.get([SESSION_KEYS.ACTIVE, SESSION_KEYS.DISMISSED]);
}

async function setSessionState(partial) {
    return chrome.storage.session.set(partial);
}

// ── Export ──

if (typeof globalThis !== 'undefined') {
    globalThis.LetterheadStorage = {
        // constants
        SCHEMA_VERSION,
        STORAGE_KEYS,
        SESSION_KEYS,
        PROVIDERS,
        SUPPORTED_PROVIDERS,
        PROVIDER_LABELS,
        DEFAULT_MODELS,
        MODEL_OPTIONS,
        TASK_LABELS,
        TONE_PRESETS,
        DEFAULT_TONE_PRESET,
        DEFAULT_TASK_CONFIG,
        DEFAULT_PROMPTS,
        // migration
        migrateIfNeeded,
        // new helpers
        getApiKey,
        setApiKey,
        getAllApiKeys,
        getTaskConfig,
        setTaskConfig,
        getPrompt,
        hasCustomPrompt,
        setPrompt,
        resetPrompt,
        getTaskTone,
        getToneText,
        setTaskTone,
        isTaskReady,
        // legacy compat
        getConfig,
        setConfig,
        isSetupComplete,
        // session
        getSessionState,
        setSessionState,
    };
}
