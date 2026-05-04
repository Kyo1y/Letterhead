// ── API client for OpenAI and Claude ──

const API_ENDPOINTS = {
    openai: 'https://api.openai.com/v1/chat/completions',
    claude: 'https://api.anthropic.com/v1/messages',
};

const DEFAULT_MODELS = {
    openai: 'gpt-4o',
    claude: 'claude-sonnet-4-20250514',
};

/**
 * Call the OpenAI Chat Completions API.
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>} The assistant's reply text.
 */
async function callOpenAI(apiKey, systemPrompt, userPrompt) {
    const res = await fetch(API_ENDPOINTS.openai, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: DEFAULT_MODELS.openai,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 2048,
            temperature: 0.7,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`OpenAI API error ${res.status}: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
}

/**
 * Call the Anthropic Messages API.
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>} The assistant's reply text.
 */
async function callClaude(apiKey, systemPrompt, userPrompt) {
    const res = await fetch(API_ENDPOINTS.claude, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: DEFAULT_MODELS.claude,
            max_tokens: 2048,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userPrompt },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Claude API error ${res.status}: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.content[0].text.trim();
}

/**
 * Unified generate function — routes to the correct provider.
 * @param {string} provider  'openai' | 'claude'
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>}
 */
async function generateText(provider, apiKey, systemPrompt, userPrompt) {
    if (provider === 'openai') {
        return callOpenAI(apiKey, systemPrompt, userPrompt);
    } else if (provider === 'claude') {
        return callClaude(apiKey, systemPrompt, userPrompt);
    }
    throw new Error(`Unknown API provider: ${provider}`);
}

if (typeof globalThis !== 'undefined') {
    globalThis.LetterheadAPI = {
        generateText,
        callOpenAI,
        callClaude,
        DEFAULT_MODELS,
    };
}
