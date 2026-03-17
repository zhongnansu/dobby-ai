// e2e/settings.spec.js — Options page: API key management
const { test, expect } = require('@playwright/test');
const { launchExtension } = require('./helpers');

let context, extensionId, page;

test.beforeAll(async () => {
  ({ context, extensionId, page } = await launchExtension());
});

test.afterAll(async () => {
  await context?.close();
});

test('options page loads', async () => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForLoadState('domcontentloaded');

  // Should have API key input
  const input = page.locator('#api-key-input');
  await expect(input).toBeVisible();

  // Should have save button
  const saveBtn = page.locator('#save-btn');
  await expect(saveBtn).toBeVisible();
});

test('invalid key format shows error', async () => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForLoadState('domcontentloaded');

  const input = page.locator('#api-key-input');
  const saveBtn = page.locator('#save-btn');

  // Enter key without sk- prefix
  await input.fill('invalid-key-format');
  await saveBtn.click();

  const status = page.locator('#key-status');
  await expect(status).toContainText('sk-');
});

test('empty key shows error', async () => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForLoadState('domcontentloaded');

  const saveBtn = page.locator('#save-btn');
  await saveBtn.click();

  const status = page.locator('#key-status');
  await expect(status).toContainText('Please enter');
});

test('Enter key submits the form', async () => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForLoadState('domcontentloaded');

  const input = page.locator('#api-key-input');
  await input.fill('not-a-valid-key');
  await input.press('Enter');

  // Should trigger validation (shows error for invalid format)
  const status = page.locator('#key-status');
  await expect(status).toContainText('sk-');
});
