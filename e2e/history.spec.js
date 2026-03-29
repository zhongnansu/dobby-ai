// e2e/history.spec.js — Chat history panel UI
const { test, expect } = require('@playwright/test');
const { launchExtension, selectText, waitForToolbar, openBubbleViaToolbar, waitForBubble, clickInShadow, getTextInShadow, countInShadow, isVisibleInShadow } = require('./helpers');

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

test('history button opens history panel', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  // Click history button
  await clickInShadow(page, '.history-btn');
  await page.waitForTimeout(500);

  // History panel should show (either entries or "No history yet")
  const bodyText = await getTextInShadow(page, '.bubble-body');
  expect(bodyText).toBeTruthy();
});

test('clear history shows empty state', async () => {
  await selectText(page, 'h1');
  await waitForToolbar(page);
  await openBubbleViaToolbar(page);

  await clickInShadow(page, '.history-btn');
  await page.waitForTimeout(500);

  const clearVisible = await isVisibleInShadow(page, '.clear-link');
  if (clearVisible) {
    await clickInShadow(page, '.clear-link');
    await page.waitForTimeout(500);

    const bodyText = await getTextInShadow(page, '.bubble-body');
    expect(bodyText).toMatch(/cleared|No history/i);
  }
});
