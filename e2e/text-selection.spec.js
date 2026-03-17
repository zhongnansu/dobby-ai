// e2e/text-selection.spec.js — Text selection → trigger → bubble → response flow
const { test, expect } = require('@playwright/test');
const { launchExtension, selectText, waitForBubble, waitForStreamingStarted, clickInShadow, fillInShadow, pressKeyInShadow, getTextInShadow, countInShadow } = require('./helpers');

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

test('select text shows trigger, click opens bubble with presets', async () => {
  await selectText(page, 'h1');

  const trigger = page.locator('#dobby-ai-trigger');
  await expect(trigger).toBeVisible({ timeout: 3000 });

  await trigger.click();
  await waitForBubble(page);

  const logo = await getTextInShadow(page, '.bubble-logo');
  expect(logo).toContain('Dobby AI');

  const chipCount = await countInShadow(page, '.preset-chip');
  expect(chipCount).toBeGreaterThan(0);
});

test('clicking preset chip activates response section', async () => {
  await selectText(page, 'h1');

  const trigger = page.locator('#dobby-ai-trigger');
  await expect(trigger).toBeVisible({ timeout: 3000 });
  await trigger.click();
  await waitForBubble(page);

  await clickInShadow(page, '.preset-chip');

  // Response section should be active (presets hidden, response visible)
  await waitForStreamingStarted(page);
  const isActive = await page.evaluate(() => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) return false;
    const rs = host.shadowRoot.querySelector('.response-section');
    return rs && rs.classList.contains('active');
  });
  expect(isActive).toBe(true);
});

test('close button dismisses bubble', async () => {
  await selectText(page, 'h1');

  const trigger = page.locator('#dobby-ai-trigger');
  await expect(trigger).toBeVisible({ timeout: 3000 });
  await trigger.click();
  await waitForBubble(page);

  await clickInShadow(page, '.close-btn');
  await expect(page.locator('#dobby-ai-bubble')).not.toBeVisible();
});

test('Escape key dismisses bubble', async () => {
  await selectText(page, 'h1');

  const trigger = page.locator('#dobby-ai-trigger');
  await expect(trigger).toBeVisible({ timeout: 3000 });
  await trigger.click();
  await waitForBubble(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('#dobby-ai-bubble')).not.toBeVisible();
});

test('custom instruction input activates response', async () => {
  await selectText(page, 'h1');

  const trigger = page.locator('#dobby-ai-trigger');
  await expect(trigger).toBeVisible({ timeout: 3000 });
  await trigger.click();
  await waitForBubble(page);

  await fillInShadow(page, '.preset-input', 'Translate to Spanish');
  await pressKeyInShadow(page, '.preset-input', 'Enter');

  await waitForStreamingStarted(page);
});

test('pin button keeps bubble on click away', async () => {
  await selectText(page, 'h1');

  const trigger = page.locator('#dobby-ai-trigger');
  await expect(trigger).toBeVisible({ timeout: 3000 });
  await trigger.click();
  await waitForBubble(page);

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
