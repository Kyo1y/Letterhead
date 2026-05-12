# Letterhead

A Chromium browser extension that detects job postings and LinkedIn profiles as you browse, and generates tailored cover letters and outreach messages on the spot — using your own resume and a personal context file you write once.

![main_page](https://github.com/Kyo1y/Letterhead/blob/main/Main_Page_Letterhead.png?raw=true)
![first_guide_page](https://github.com/Kyo1y/Letterhead/blob/main/First_Step_Guide_Letterhead.png?raw=true)
![second_third_guide_page](https://github.com/Kyo1y/Letterhead/blob/main/Second_Third_Step_Guide_Letterhead.png?raw=true)
![popup](https://github.com/Kyo1y/Letterhead/blob/main/Popup_Letterhead.png?raw=true)
![job_popup](https://github.com/Kyo1y/Letterhead/blob/main/Job_Popup_Letterhead.png?raw=true)
![linkedin_popup](https://github.com/Kyo1y/Letterhead/blob/main/LinkedIn_Popup_Letterhead.png?raw=true)


## How it works

When you land on a supported job posting, a small banner slides in asking if you're applying. Say yes, and Letterhead extracts the job description, sends it to an AI model alongside your resume and context, and returns a cover letter in a few seconds. Same flow on LinkedIn profiles, but for outreach messages.

Everything runs locally in your browser. Your resume text and API key never leave your device except as part of the AI request you explicitly trigger.

## Supported platforms

| Platform | What it does |
|---|---|
| Greenhouse | Extracts job description, generates cover letter |
| Ashby | Extracts job description, generates cover letter |
| LinkedIn Jobs | Extracts job description, generates cover letter |
| LinkedIn Profiles | Extracts experience and skills, generates outreach message |

## Setup

**1. Load the extension**

- Go to `chrome://extensions`
- Enable Developer Mode (toggle, top right)
- Click "Load unpacked" and select this folder

**2. Open the settings page**

Click the Letterhead icon in your toolbar → Options, or go to `chrome://extensions` → Details → Extension options.

**3. Upload your resume**

A `.pdf` file. Letterhead extracts the text automatically — a clean single-column PDF works best.

**4. Write a context file**

A `.md` file where you brief the AI on who you are beyond the resume: your tone, what roles you're targeting, what you're proud of that doesn't show on paper, why you're looking. The richer this is, the more the output sounds like you.

The Setup Guide page (linked from the options nav) has a full example.

**5. Add your API key**

Letterhead supports Claude (Anthropic) and OpenAI. Get a key from your provider's console and paste it in. Keys are stored in your browser's local extension storage — sandboxed, never accessible by any webpage.

## Cost

Each cover letter is a single API call. At typical resume and job description lengths, a Claude generation costs under $0.01. OpenAI is comparable.

## Project structure

```
manifest.json              Extension config (MV3)
content.js                 Page detection, text extraction, banner UI
options.html / options.js  Setup page
guide.html                 Setup guide
background/
  service-worker.js        Message routing, API calls
lib/
  api-client.js            Claude + OpenAI API wrapper
  prompts.js               Cover letter and outreach prompt templates
  storage.js               chrome.storage wrapper
  pdf-extract.js           PDF text extraction via pdf.js
  vendor/                  Vendored pdf.js (offline, no CDN)
```

## Privacy

- Your API key is stored in `chrome.storage.local` — sandboxed to this extension, inaccessible to any website.
- Your resume text and context are stored the same way.
- The only outbound requests are: AI API calls (triggered by you), and Google Fonts on the options page.
- No analytics, no external servers, no telemetry.
