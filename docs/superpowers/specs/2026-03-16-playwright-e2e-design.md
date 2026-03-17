# Playwright E2E Test Design

## Goal

Add end-to-end tests using Playwright to test the full Dobby AI extension in a real Chrome browser, catching integration issues that unit tests with mocked Chrome APIs cannot.

## Architecture

- **Directory:** `e2e/` at project root
- **Config:** `playwright.config.js` at project root
- **Test command:** `npm run test:e2e` — runs `npm run build && npx playwright test`
- **CI:** new `.github/workflows/e2e.yml` workflow, headed Chrome via `xvfb-run` on Linux
- **API mocking:** Playwright `route()` intercepts OpenAI API and proxy calls by default, returns canned SSE responses. Optional `LIVE_API=1` env var skips mocking for real API testing locally.
- **Extension loading:** Playwright `chromium.launchPersistentContext` with `--load-extension=dist` and `--disable-extensions-except=dist` flags. Headed mode required (extensions don't load headless).

## Test Cases

### 1. Extension loads (`e2e/extension.spec.js`)
- Content script injects on a test page (dobby-ai-trigger element appears on text selection)
- Context menu "Dobby AI" is registered
- Popup toggle works (enable/disable extension)

### 2. Text selection flow (`e2e/text-selection.spec.js`)
- Select text (≥3 chars) → cockapoo trigger button appears near selection
- Click trigger → bubble opens with preset chips matching content type
- Click preset → streaming response renders in frosted glass bubble
- Type follow-up in input → second AI response appears below
- Close button dismisses bubble
- Escape key dismisses bubble
- Pin button keeps bubble open on click-away

### 3. Context menu flow (`e2e/context-menu.spec.js`)
- Select text → right-click → click "Dobby AI" → bubble opens with streaming response
- Right-click an image → click "Dobby AI" → bubble opens with image preview
- Context menu on a page with no selection → no action

### 5. Screenshot flow (`e2e/screenshot.spec.js`)
- Long-press 1s on empty area → progress ring appears after 500ms
- Hold completes (1s total) → screenshot overlay appears with "Drag to select" banner
- Drag region → selection rectangle visible with dashed purple border
- Click Capture → overlay dismissed, bubble opens with image preview
- Click Reselect → rectangle clears, can drag again
- Click Cancel → overlay dismissed entirely
- ESC key → overlay dismissed
- Moving mouse > 5px during long-press cancels it

### 5. Settings page (`e2e/settings.spec.js`)
- Options page loads at `chrome-extension://<id>/options.html`
- Enter and save valid API key → shows masked key display
- Remove API key → returns to input form
- Invalid key (no `sk-` prefix) shows inline error
- Enter key submits the form

### 6. History (`e2e/history.spec.js`)
- Complete a response → click history button → history entry appears with text preview
- Click history entry → previous response restored in bubble
- Type follow-up on restored entry → new streaming response works
- Clear history → shows empty state message

## API Mocking

Default behavior: intercept all OpenAI API and proxy calls with Playwright `route()`.

```js
async function mockAPI(context) {
  await context.route('**/api.openai.com/**', route => {
    route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'X-RateLimit-Remaining': '25',
      },
      body: [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"content":" from"}}]}',
        'data: {"choices":[{"delta":{"content":" mock"}}]}',
        'data: [DONE]',
      ].join('\n\n') + '\n\n',
    });
  });

  await context.route('**/dobby-ai-proxy.zhongnansu.workers.dev/**', route => {
    route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'X-RateLimit-Remaining': '25',
      },
      body: [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"content":" from"}}]}',
        'data: {"choices":[{"delta":{"content":" proxy"}}]}',
        'data: [DONE]',
      ].join('\n\n') + '\n\n',
    });
  });
}
```

When `LIVE_API=1` environment variable is set, skip route interception entirely. Requires API key saved in extension settings beforehand.

## Extension Setup Helper

Shared helper for all E2E tests:

```js
// e2e/helpers.js
const { chromium } = require('@playwright/test');
const path = require('path');

async function launchExtension() {
  const extensionPath = path.resolve(__dirname, '..', 'dist');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  // Get the extension ID from the service worker
  let extensionId;
  const serviceWorker = context.serviceWorkers()[0] ||
    await context.waitForEvent('serviceworker');
  extensionId = serviceWorker.url().split('/')[2];

  return { context, extensionId };
}
```

## Shadow DOM Access

The bubble UI renders inside Shadow DOM. Playwright can access shadow DOM elements via `page.locator()` with piercing:

```js
// Access elements inside the shadow root
const bubble = page.locator('#dobby-ai-bubble');
const shadowHost = bubble;
const closeBtn = shadowHost.locator('>> .close-btn');
const responseText = shadowHost.locator('>> .response-text');
```

## CI Workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npx playwright install chromium
      - name: Run E2E tests
        run: xvfb-run npx playwright test
```

## Package.json Script

```json
"test:e2e": "npm run build && npx playwright test"
```

## File Structure

```
e2e/
├── helpers.js              # launchExtension(), mockAPI(), shadow DOM helpers
├── extension.spec.js       # Extension loads, context menu, popup toggle
├── text-selection.spec.js  # Select text → trigger → bubble → response → follow-up
├── context-menu.spec.js    # Right-click text/image → context menu → bubble
├── screenshot.spec.js      # Long-press → overlay → drag → capture → bubble
├── settings.spec.js        # Options page: save/remove API key
└── history.spec.js         # History panel: browse, restore, follow-up, clear
playwright.config.js        # Playwright config (chromium only, headed)
```

## Acceptance Criteria

- [ ] Playwright config and helpers set up
- [ ] At least 5 core E2E test files covering all user flows
- [ ] All tests pass with mocked API (no API key required)
- [ ] CI workflow runs E2E tests on push/PR via xvfb
- [ ] Tests are not flaky (no arbitrary timeouts, use Playwright auto-waiting)
