// e2e/context-menu.spec.js — Right-click context menu → bubble flow
const { test, expect } = require('@playwright/test');
const { launchExtension, selectText, waitForBubble, waitForStreamingStarted, getTextInShadow } = require('./helpers');

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

test('context menu sends SHOW_BUBBLE and opens bubble with response', async () => {
  // Send the message from the service worker (simulates context menu click)
  const sw = context.serviceWorkers()[0];
  await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_BUBBLE', text: 'Example Domain' });
    }
  });

  await waitForBubble(page);

  // Context menu skips presets, goes straight to streaming
  await waitForStreamingStarted(page);
});
