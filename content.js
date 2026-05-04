// ── Letterhead Content Script ──
// Runs on all HTTPS pages. Detects job postings, extracts JD text,
// and injects banners for activation + results.

(function () {
  'use strict';

  // ─── Platform Detection ───────────────────────────────────────

  const PLATFORM_PATTERNS = [
    {
      name: 'greenhouse',
      test: (url) =>
        /boards\.greenhouse\.io\/.+\/jobs\//.test(url) ||
        /job-boards\.greenhouse\.io\//.test(url) ||
        // Embedded Greenhouse boards on company domains
        /\/gh_jid=/.test(url),
    },
    {
      name: 'ashby',
      test: (url) =>
        /jobs\.ashbyhq\.com\//.test(url),
    },
    {
      name: 'linkedin-job',
      test: (url) =>
        /linkedin\.com\/jobs\/view\//.test(url) ||
        (/linkedin\.com\/jobs\//.test(url) && /currentJobId=/.test(url)),
    },
    {
      name: 'linkedin-profile',
      test: (url) =>
        /linkedin\.com\/in\/[^/]+/.test(url) &&
        !/\/jobs\//.test(url),
    },
  ];

  /**
   * Detect which platform (if any) the current page belongs to.
   * @returns {{ name: string, test: Function }|null}
   */
  function detectPlatform() {
    const url = window.location.href;
    return PLATFORM_PATTERNS.find(p => p.test(url)) || null;
  }

  // ─── Job Description Extractors ───────────────────────────────

  const JD_EXTRACTORS = {
    'greenhouse': () => {
      const el =
        document.querySelector('.job__description.body') ||
        document.querySelector('#content .body') ||
        document.querySelector('.job-post-content') ||
        document.querySelector('#content');
      return el ? el.innerText.trim() : null;
    },

    'ashby': () => {
      // Ashby wraps JD in a div with class ashby-job-posting-brief-description
      // or the main content area
      const el =
        document.querySelector('[data-testid="job-posting-description"]') ||
        document.querySelector('.ashby-job-posting-brief-description') ||
        document.querySelector('main');
      return el ? el.innerText.trim() : null;
    },

    'linkedin-job': () => {
      const el =
        document.querySelector('#job-details') ||
        document.querySelector('.jobs-description-content__text') ||
        document.querySelector('.description__text') ||
        document.querySelector('.jobs-box__html-content');
      return el ? el.innerText.trim() : null;
    },
  };

  // ─── LinkedIn Profile Extractor ───────────────────────────────

  function extractLinkedInProfile() {
    const parts = [];

    // Name
    const name = document.querySelector('h1');
    if (name) parts.push(`Name: ${name.innerText.trim()}`);

    // Headline (element right below h1)
    const headline =
      document.querySelector('.text-body-medium.break-words') ||
      document.querySelector('.text-body-medium');
    if (headline) parts.push(`Headline: ${headline.innerText.trim()}`);

    // Sections — LinkedIn's new design uses data-testid="profile_{Section}TopLevelSection_{username}"
    // We match by partial data-testid since the username suffix varies.
    const sectionMap = [
      { label: 'About', selector: '[data-testid*="AboutTopLevelSection"]' },
      { label: 'Experience', selector: '[data-testid*="ExperienceTopLevelSection"]' },
      { label: 'Education', selector: '[data-testid*="EducationTopLevelSection"]' },
      { label: 'Skills', selector: '[data-testid*="SkillsTopLevelSection"]' },
    ];

    for (const { label, selector } of sectionMap) {
      const el = document.querySelector(selector);
      if (el) parts.push(`${label}:\n${el.innerText.trim()}`);
    }

    // Projects — uses componentkey ending in "Projects" on a <section>
    const projects = document.querySelector('section[componentkey$="Projects"]');
    if (projects) parts.push(`Projects:\n${projects.innerText.trim()}`);

    // Fallback: grab the main content area if we found almost nothing
    if (parts.length <= 1) {
      const main =
        document.querySelector('.scaffold-layout__main') ||
        document.querySelector('main');
      if (main) parts.push(`Profile:\n${main.innerText.trim().slice(0, 4000)}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  // ─── Banner UI ────────────────────────────────────────────────

  const BANNER_STYLES = `
    .lh-banner {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      pointer-events: auto !important;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
      animation: lh-slide-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .lh-banner * {
      pointer-events: auto !important;
    }

    @keyframes lh-slide-in {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes lh-slide-out {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to   { opacity: 0; transform: translateY(20px) scale(0.97); }
    }

    .lh-banner-card {
      background: #fbf9f4;
      border: 2px solid #F26419;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
      max-width: 420px;
      min-width: 320px;
    }

    .lh-banner-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .lh-banner-title {
      font-weight: 600;
      font-size: 15px;
      color: #1a1a1a;
    }

    .lh-banner-pixel-art {
      width: 32px;
      height: 32px;
      image-rendering: pixelated;
    }

    .lh-banner-body {
      margin-bottom: 16px;
    }

    .lh-banner-body p {
      margin: 0 0 8px 0;
    }

    .lh-banner-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .lh-btn {
      padding: 6px 16px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .lh-btn-primary {
      background: #F26419;
      color: #fff;
    }
    .lh-btn-primary:hover { background: #d4541a; }

    .lh-btn-secondary {
      background: transparent;
      color: #666;
      border: 1px solid #ddd;
    }
    .lh-btn-secondary:hover { background: #f0f0f0; }

    /* ── Result banner ── */

    .lh-result-content {
      max-height: 300px;
      overflow-y: auto;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 12px;
      font-size: 13px;
      white-space: pre-wrap;
      line-height: 1.6;
    }

    .lh-result-toolbar {
      display: flex;
      gap: 6px;
    }

    .lh-toolbar-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px 12px;
      border-radius: 8px;
      border: 1px solid #ddd;
      background: #fff;
      cursor: pointer;
      font-size: 12px;
      color: #555;
      transition: all 0.15s ease;
    }
    .lh-toolbar-btn:hover {
      background: #F26419;
      color: #fff;
      border-color: #F26419;
    }

    .lh-toolbar-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .lh-loading-dots {
      display: flex;
      gap: 4px;
      justify-content: center;
      padding: 20px;
    }
    .lh-loading-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #F26419;
      animation: lh-bounce 1.2s infinite ease-in-out;
    }
    .lh-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
    .lh-loading-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes lh-bounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    .lh-pixel-envelope {
      display: inline-block;
      width: 32px;
      height: 32px;
      background: #F26419;
      clip-path: polygon(0% 20%, 50% 55%, 100% 20%, 100% 100%, 0% 100%);
      position: relative;
    }

    .lh-pixel-envelope::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #d4541a;
      clip-path: polygon(0% 20%, 50% 50%, 100% 20%, 100% 20%, 50% 55%, 0% 20%);
    }
  `;

  function injectStyles() {
    if (document.getElementById('lh-styles')) return;
    const style = document.createElement('style');
    style.id = 'lh-styles';
    style.textContent = BANNER_STYLES;
    document.head.appendChild(style);
  }

  /**
   * Create the pixel-art envelope icon.
   */
  function createPixelEnvelope() {
    const el = document.createElement('div');
    el.className = 'lh-pixel-envelope';
    return el;
  }

  /**
   * Remove any existing Letterhead banner.
   */
  function removeBanner() {
    const existing = document.getElementById('lh-banner');
    if (existing) {
      existing.style.animation = 'lh-slide-out 0.25s ease forwards';
      setTimeout(() => existing.remove(), 250);
    }
  }

  /**
   * Show the activation prompt banner.
   */
  function showActivationBanner(platform) {
    injectStyles();
    removeBanner();

    const banner = document.createElement('div');
    banner.id = 'lh-banner';
    banner.className = 'lh-banner';
    const outreachMessage = "Looks like this is a linkedin profile. Are you trying to reach out?"
    const jobPostingMessage = "Looks like this is a job posting. Are you applying for this job?"
    banner.innerHTML = `
      <div class="lh-banner-card">
        <div class="lh-banner-header">
          <div class="lh-pixel-envelope"></div>
          <span class="lh-banner-title">Letterhead</span>
        </div>
        <div class="lh-banner-body">
          <p>${platform.name === 'linkedin-profile' ? outreachMessage : jobPostingMessage}</p>
        </div>
        <div class="lh-banner-actions">
          <button class="lh-btn lh-btn-secondary" id="lh-btn-no">Not now</button>
          <button class="lh-btn lh-btn-primary" id="lh-btn-yes">Yes, let's go</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    banner.querySelector('#lh-btn-yes').addEventListener('click', (e) => {
      e.stopPropagation();
      sessionActive = true;
      removeBanner();
      triggerGeneration();
    });

    banner.querySelector('#lh-btn-no').addEventListener('click', (e) => {
      e.stopPropagation();
      sessionDismissed = true;
      removeBanner();
    });
  }

  /**
   * Show a loading banner.
   */
  function showLoadingBanner() {
    injectStyles();
    removeBanner();

    const banner = document.createElement('div');
    banner.id = 'lh-banner';
    banner.className = 'lh-banner';

    banner.innerHTML = `
      <div class="lh-banner-card">
        <div class="lh-banner-header">
          <div class="lh-pixel-envelope"></div>
          <span class="lh-banner-title">Letterhead</span>
        </div>
        <div class="lh-banner-body">
          <p>Writing your cover letter…</p>
          <div class="lh-loading-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
  }

  /**
   * Show the result banner with the generated text.
   * @param {string} text - The generated cover letter or outreach message.
   * @param {string} label - "Cover Letter" or "Outreach Message"
   */
  function showResultBanner(text, label = 'Cover Letter') {
    injectStyles();
    removeBanner();

    const banner = document.createElement('div');
    banner.id = 'lh-banner';
    banner.className = 'lh-banner';

    banner.innerHTML = `
      <div class="lh-banner-card">
        <div class="lh-banner-header">
          <div class="lh-pixel-envelope"></div>
          <span class="lh-banner-title">Letterhead — ${label}</span>
        </div>
        <div class="lh-result-content" id="lh-result-text">${escapeHtml(text)}</div>
        <div class="lh-result-toolbar">
          <button class="lh-toolbar-btn" id="lh-btn-copy" title="Copy to clipboard">
            <svg viewBox="0 -960 960 960"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>
            Copy
          </button>
          <button class="lh-toolbar-btn" id="lh-btn-regenerate" title="Generate again">
            <svg viewBox="0 -960 960 960"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>
            Redo
          </button>
          <button class="lh-toolbar-btn" id="lh-btn-close" title="Close">
            <svg viewBox="0 -960 960 960"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
            Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    banner.querySelector('#lh-btn-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        const btn = banner.querySelector('#lh-btn-copy');
        btn.innerHTML = `
          <svg viewBox="0 -960 960 960"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>
          Copied!
        `;
        setTimeout(() => {
          btn.innerHTML = `
            <svg viewBox="0 -960 960 960"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>
            Copy
          `;
        }, 2000);
      });
    });

    banner.querySelector('#lh-btn-regenerate').addEventListener('click', () => {
      triggerGeneration();
    });

    banner.querySelector('#lh-btn-close').addEventListener('click', () => {
      removeBanner();
    });
  }

  /**
   * Show an error banner.
   */
  function showErrorBanner(message) {
    injectStyles();
    removeBanner();

    const banner = document.createElement('div');
    banner.id = 'lh-banner';
    banner.className = 'lh-banner';

    banner.innerHTML = `
      <div class="lh-banner-card" style="border-color: #dc3545;">
        <div class="lh-banner-header">
          <div class="lh-pixel-envelope"></div>
          <span class="lh-banner-title">Letterhead — Error</span>
        </div>
        <div class="lh-banner-body">
          <p style="color: #dc3545;">${escapeHtml(message)}</p>
        </div>
        <div class="lh-banner-actions">
          <button class="lh-btn lh-btn-secondary" id="lh-btn-dismiss">Dismiss</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
    banner.querySelector('#lh-btn-dismiss').addEventListener('click', removeBanner);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Generation Trigger ───────────────────────────────────────

  async function triggerGeneration() {
    const platform = detectPlatform();
    if (!platform) return;

    if (platform.name === 'linkedin-profile') {
      return triggerOutreach();
    }

    const extractor = JD_EXTRACTORS[platform.name];
    if (!extractor) return;

    const jobDescription = extractor();
    if (!jobDescription) {
      showErrorBanner('Could not extract job description from this page. The layout may have changed.');
      return;
    }

    showLoadingBanner();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_COVER_LETTER',
        jobDescription,
        pageUrl: window.location.href,
        pageTitle: document.title,
      });

      if (response.error) {
        showErrorBanner(response.error);
      } else {
        showResultBanner(response.coverLetter, 'Cover Letter');
      }
    } catch (err) {
      showErrorBanner(`Failed to generate: ${err.message}`);
    }
  }

  async function triggerOutreach() {
    const profileData = extractLinkedInProfile();
    if (!profileData) {
      showErrorBanner('Could not extract profile data from this page.');
      return;
    }

    showLoadingBanner();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_OUTREACH',
        profileData,
        pageUrl: window.location.href,
      });

      if (response.error) {
        showErrorBanner(response.error);
      } else {
        showResultBanner(response.outreachMessage, 'Outreach Message');
      }
    } catch (err) {
      showErrorBanner(`Failed to generate: ${err.message}`);
    }
  }

  // ─── In-memory session state (per content script instance / per tab) ────
  let sessionActive = false;
  let sessionDismissed = false;

  // ─── Main Entry Point ────────────────────────────────────────

  async function main() {
    const platform = detectPlatform();
    if (!platform) return;

    let setupResponse;
    try {
      setupResponse = await chrome.runtime.sendMessage({ type: 'CHECK_SETUP' });
    } catch (err) {
      console.warn('[Letterhead] CHECK_SETUP failed:', err.message);
      return;
    }
    if (!setupResponse || !setupResponse.ready) return;

    const { enabled } = await chrome.storage.local.get('enabled');
    if (enabled === false) return;

    if (sessionDismissed) return;

    if (sessionActive) {
      triggerGeneration();
      return;
    }

    showActivationBanner(platform);
  }

  // ─── SPA Navigation Watcher ──────────────────────────────────
  // LinkedIn is a SPA — URL changes via history.pushState without a real
  // page reload, so we need to re-run main() when the URL changes.

  let lastUrl = location.href;

  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(main, 1500); // let the new page content settle
    }
  });

  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Also catch popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(main, 1500);
    }
  });

  // Initial run
  setTimeout(main, 1500);
})();
