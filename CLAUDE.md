# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome extension that intercepts API responses on `jobcrawl.org` and renders them as a slide-in side panel. There is no build step — the extension is loaded directly from this directory via Chrome's "Load unpacked" developer mode.

## Loading / testing

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this directory
4. Navigate to `jobcrawl.org` — the panel appears automatically when a jobs API response is detected

After editing any JS or CSS file, click the **↺ reload** button on the extension card in `chrome://extensions`, then refresh the page.

## Architecture

The extension uses a two-script pattern required by MV3 to intercept network traffic:

- **`injected.js`** — runs in the **page context** (injected via `<script>` tag). This is the only place `fetch` and `XMLHttpRequest` can be monkey-patched. It detects responses matching the JobCrawl payload shape (`{ jobs[], totalCount, ... }`) regardless of URL, then forwards them via `window.postMessage`.

- **`content.js`** — runs in the **extension context** (isolated world). It injects `injected.js` at `document_start`, listens for `JOBCRAWL_DATA` messages from the page, and calls `renderPanel()` to build the DOM side panel.

- **`panel.css`** — injected alongside `content.js`. All panel styles use the `jcv-` prefix to avoid collisions with host-page styles.

The `web_accessible_resources` entry in `manifest.json` is required to allow `content.js` to load `injected.js` via `chrome.runtime.getURL()`.

## Key data contract

`injected.js` forwards a payload only when it matches:

```js
{ jobs: [...], totalCount: number, currentPage: number, totalPages: number }
```

Each job object is expected to have: `title`, `company`, `apply_url`, `is_remote`, `salary_min`, `salary_max`, `salary_currency`, `countries`, `posted_at`.
