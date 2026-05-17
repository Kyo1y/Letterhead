// ── API client — multi-provider dispatcher ──
// Supports Claude (Anthropic), OpenAI, Gemini (Google), Grok (xAI),
// DeepSeek, and OpenRouter. All callers expose the same signature:
//   call(apiKey, model, system, user) → Promise<string>
// generateText() dispatches based on provider name.

const OPENAI_COMPAT_ENDPOINTS = {
    openai:     'https://api.openai.com/v1/chat/completions',
    xai:        'https://api.x.ai/v1/chat/completions',
    deepseek:   'https://api.deepseek.com/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const GEMINI_BASE     = 'https://generativelanguage.googleapis.com/v1beta/models';

const MAX_TOKENS = 2048;

/**
 * Shared call for any OpenAI-compatible Chat Completions endpoint
 * (OpenAI, xAI, DeepSeek, OpenRouter).
 */
async function callOpenAICompat(endpoint, apiKey, model, system, user) {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: system },
                { role: 'user',   content: user },
            ],
            max_tokens: MAX_TOKENS,
            temperature: 0.7,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`API error ${res.status}: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Call the Anthropic Messages API.
 * `anthropic-dangerous-direct-browser-access` is required for direct browser
 * calls (CORS bypass). Standard for browser extensions.
 */
async function callClaude(apiKey, model, system, user) {
    const res = await fetch(CLAUDE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model,
            max_tokens: MAX_TOKENS,
            system,
            messages: [{ role: 'user', content: user }],
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Claude API error ${res.status}: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text?.trim() || '';
}

/**
 * Call the Google Gemini API.
 * Model name goes in the URL path; API key is a query param (Google's pattern).
 */
async function callGemini(apiKey, model, system, user) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: {
                maxOutputTokens: MAX_TOKENS,
                temperature: 0.7,
            },
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Gemini API error ${res.status}: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

/**
 * Unified dispatcher.
 * @param {string} provider  — 'claude' | 'openai' | 'google' | 'xai' | 'deepseek' | 'openrouter'
 * @param {string} apiKey
 * @param {string} model     — exact model ID for the provider (e.g. 'claude-sonnet-4', 'anthropic/claude-opus-4' for openrouter)
 * @param {string} system    — system prompt
 * @param {string} user      — user message
 * @returns {Promise<string>}
 */
async function generateText(provider, apiKey, model, system, user) {
    if (provider === 'claude')  return callClaude(apiKey, model, system, user);
    if (provider === 'google')  return callGemini(apiKey, model, system, user);

    const endpoint = OPENAI_COMPAT_ENDPOINTS[provider];
    if (endpoint) return callOpenAICompat(endpoint, apiKey, model, system, user);

    throw new Error(`Unknown API provider: ${provider}`);
}

if (typeof globalThis !== 'undefined') {
    globalThis.LetterheadAPI = {
        generateText,
        callClaude,
        callGemini,
        callOpenAICompat,
        OPENAI_COMPAT_ENDPOINTS,
        CLAUDE_ENDPOINT,
        GEMINI_BASE,
    };
}
