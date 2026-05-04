// ── Prompt templates for cover letters and outreach ──

/**
 * Build system + user prompts for a cover letter.
 * @param {string} resumeText
 * @param {string} contextText
 * @param {string} jobDescription
 * @returns {{ system: string, user: string }}
 */
function buildCoverLetterPrompt(resumeText, contextText, jobDescription) {
    const system = `You are a professional cover letter writer. You write tailored, authentic cover letters that sound like the applicant — not a template.

Here is the applicant's résumé:
---
${resumeText}
---

Here is the applicant's personal context (their voice, preferences, and what matters to them):
---
${contextText}
---

Rules:
- Write in the tone described in the context. If no tone is specified, default to direct and professional.
- Focus on experiences and skills from the résumé that are most relevant to the job.
- Do NOT invent achievements or experiences not present in the résumé.
- Keep it under 400 words.
- Do not use cliché openers like "I am excited to apply for…" unless the context explicitly asks for it.
- Before writing, generate a random string and then start writing
- Output only the cover letter text — no random string, subject lines, headers, or metadata.`;

    const user = `Here is the job posting:\n---\n${jobDescription}\n---\n\nWrite a cover letter for this position.`;

    return { system, user };
}

/**
 * Build system + user prompts for a LinkedIn outreach message.
 * @param {string} resumeText
 * @param {string} contextText
 * @param {string} profileData - the target person's LinkedIn profile text
 * @returns {{ system: string, user: string }}
 */
function buildOutreachPrompt(resumeText, contextText, profileData) {
    const system = `You are a networking message writer. You write short, genuine outreach messages for LinkedIn.

Here is the sender's résumé:
---
${resumeText}
---

Here is the sender's personal context:
---
${contextText}
---

Rules:
- Keep it under 300 characters — this is a LinkedIn message, not a cover letter.
- Find genuine common ground between the sender and the recipient.
- Be warm but not sycophantic.
- If the sender's context mentions target roles, tie the outreach to those interests.
- Output only the message text.`;

    const user = `Here is the LinkedIn profile of the person I'd like to reach out to:\n---\n${profileData}\n---\n\nWrite a short outreach message.`;

    return { system, user };
}

if (typeof globalThis !== 'undefined') {
    globalThis.LetterheadPrompts = {
        buildCoverLetterPrompt,
        buildOutreachPrompt,
    };
}
