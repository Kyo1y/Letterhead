// ── Prompt builders ──
// Reads templates from storage (defaults from DEFAULT_PROMPTS, or per-task
// user overrides when tonePreset === 'custom') and substitutes {placeholders}
// at call time.

/**
 * Replace {placeholder} tokens in a template with values from vars.
 * Missing keys resolve to empty string.
 */
function substitute(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? ''));
}

/**
 * Resolve which template to use for a task.
 * Tone is now per-task (taskConfig[task].tone).
 * - tone is one of 'casual' / 'formal' / 'contextual' → default template, {tone} filled with preset string
 * - tone === 'custom' → the user's edited prompt for that task, {tone} empty
 */
async function resolveTemplate(taskName) {
    const preset = await LetterheadStorage.getTaskTone(taskName);
    if (preset === 'custom') return LetterheadStorage.getPrompt(taskName);
    return LetterheadStorage.DEFAULT_PROMPTS[taskName];
}

/**
 * Build the cover letter system + user prompts.
 * @param {string} jobDescription
 * @returns {Promise<{ system: string, user: string }>}
 */
async function buildCoverLetterPrompt(jobDescription) {
    const template = await resolveTemplate('coverLetter');
    const tone = await LetterheadStorage.getToneText('coverLetter');
    const { resumeText, contextText } = await chrome.storage.local.get(['resumeText', 'contextText']);

    const vars = {
        resumeText: resumeText || '',
        contextText: contextText || '',
        tone,
        jobDescription: jobDescription || '',
    };

    return {
        system: substitute(template.system, vars),
        user:   substitute(template.user,   vars),
    };
}

/**
 * Build the LinkedIn outreach system + user prompts.
 * @param {string} profileData
 * @returns {Promise<{ system: string, user: string }>}
 */
async function buildOutreachPrompt(profileData) {
    const template = await resolveTemplate('outreach');
    const tone = await LetterheadStorage.getToneText('outreach');
    const { resumeText, contextText } = await chrome.storage.local.get(['resumeText', 'contextText']);

    const vars = {
        resumeText: resumeText || '',
        contextText: contextText || '',
        tone,
        profileData: profileData || '',
    };

    return {
        system: substitute(template.system, vars),
        user:   substitute(template.user,   vars),
    };
}

if (typeof globalThis !== 'undefined') {
    globalThis.LetterheadPrompts = {
        buildCoverLetterPrompt,
        buildOutreachPrompt,
        substitute,        // exported for testing / future placeholder validation UI
        resolveTemplate,
    };
}
