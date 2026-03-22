// e2e/text-selection.spec.js — Text selection → toolbar → bubble → response flow
const { test, expect } = require('@playwright/test');
const { launchExtension, selectText, waitForToolbar, hoverToolbar, openBubbleViaToolbar, clickToolbarPreset, waitForBubble, waitForStreamingStarted, clickInShadow, fillInShadow, pressKeyInShadow, getTextInShadow, countInShadow } = require('./helpers');

let context, extensionId, page;

test.beforeAll(async () => {
  ({ context, extensionId, page } = await launchExtension());
});

test.afterAll(async () => {
  await context?.close();
});

test.beforeEach(async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
});

test('select text shows toolbar', async () => {
  await selectText(page, 'h1');

  await waitForToolbar(page);
  const toolbar = page.locator('#dobby-ai-toolbar-host');
  await expect(toolbar).toBeVisible({ timeout: 3000 });
});

test('open bubble via toolbar shows bubble with presets', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  const logo = await getTextInShadow(page, '.bubble-logo');
  expect(logo).toContain('Dobby AI');

  const chipCount = await countInShadow(page, '.preset-chip');
  expect(chipCount).toBeGreaterThan(0);
});

test('clicking toolbar preset morphs toolbar into chat', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await hoverToolbar(page);
  await clickToolbarPreset(page, 0);

  // Toolbar should be in morphed state
  await page.waitForFunction(() => {
    const h = document.getElementById('dobby-ai-toolbar-host');
    if (!h || !h.shadowRoot) return false;
    const toolbar = h.shadowRoot.querySelector('.toolbar');
    return toolbar && toolbar.classList.contains('morphed');
  }, { timeout: 5000 });
});

test('close button dismisses bubble', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  await clickInShadow(page, '.close-btn');
  await expect(page.locator('#dobby-ai-bubble')).not.toBeVisible();
});

test('Escape key dismisses bubble', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('#dobby-ai-bubble')).not.toBeVisible();
});

test('custom instruction input activates response', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  await fillInShadow(page, '.preset-input', 'Translate to Spanish');
  await pressKeyInShadow(page, '.preset-input', 'Enter');

  await waitForStreamingStarted(page);
});

test('pin button keeps bubble on click away', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  // Pin the bubble
  await clickInShadow(page, '.pin-btn');
  await page.waitForTimeout(200);

  // Click away — bubble should stay
  await page.click('body', { position: { x: 10, y: 10 } });
  await page.waitForTimeout(300);
  await expect(page.locator('#dobby-ai-bubble')).toBeVisible();

  // Cleanup: close via button
  await clickInShadow(page, '.close-btn');
});
