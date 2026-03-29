// e2e/text-selection.spec.js — Text selection → toolbar → bubble → response flow
const { test, expect } = require('@playwright/test');
const { launchExtension, selectText, waitForToolbar, hoverToolbar, openBubbleViaToolbar, clickToolbarPreset, waitForBubble, waitForStreamingStarted, clickInShadow, getTextInShadow } = require('./helpers');

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

test('open bubble via toolbar shows bubble in response mode', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  const logo = await getTextInShadow(page, '.bubble-logo');
  expect(logo).toContain('Dobby AI');

  await waitForStreamingStarted(page);
});

test('clicking toolbar preset opens full bubble', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await hoverToolbar(page);
  await clickToolbarPreset(page, 0);

  // Full bubble should open (toolbar hides, bubble appears)
  await waitForBubble(page);
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

test('custom instruction via toolbar activates response', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

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
