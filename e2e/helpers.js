// e2e/helpers.js — Shared E2E test utilities
const { chromium } = require('@playwright/test');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist');

/**
 * Launch Chrome with the extension loaded.
 * Returns { context, extensionId, page }.
 */
async function launchExtension() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  // Wait for service worker to register and extract extension ID
  const serviceWorker = context.serviceWorkers()[0] ||
    await context.waitForEvent('serviceworker');
  const extensionId = serviceWorker.url().split('/')[2];

  // Open a test page
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');

  return { context, extensionId, page };
}

/**
 * Select text on the page by triple-clicking a selector.
 */
async function selectText(page, selector) {
  await page.click(selector, { clickCount: 3 });
  // Wait for selection to register
  await page.waitForFunction(() => window.getSelection().toString().length > 0, { timeout: 3000 });
}

/**
 * Wait for the bubble to appear.
 */
async function waitForBubble(page) {
  await page.waitForSelector('#dobby-ai-bubble', { timeout: 5000 });
}

/**
 * Wait for the bubble to show "thinking..." status (streaming started).
 */
async function waitForStreamingStarted(page) {
  // Wait for the response section to become active (presets hidden)
  await page.waitForFunction(() => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) return false;
    const responseSection = host.shadowRoot.querySelector('.response-section');
    return responseSection && responseSection.classList.contains('active');
  }, { timeout: 10000 });
}

/**
 * Click an element inside the bubble's shadow DOM.
 */
async function clickInShadow(page, selector) {
  await page.evaluate((sel) => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) throw new Error('No bubble found');
    const el = host.shadowRoot.querySelector(sel);
    if (!el) throw new Error(`Element ${sel} not found in shadow DOM`);
    // Dispatch mousedown first (some elements like preset chips use mousedown, not click)
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.click();
  }, selector);
}

/**
 * Fill an input inside the bubble's shadow DOM.
 */
async function fillInShadow(page, selector, value) {
  await page.evaluate(({ sel, val }) => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) throw new Error('No bubble found');
    const el = host.shadowRoot.querySelector(sel);
    if (!el) throw new Error(`Element ${sel} not found in shadow DOM`);
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { sel: selector, val: value });
}

/**
 * Press a key on an input inside the bubble's shadow DOM.
 */
async function pressKeyInShadow(page, selector, key) {
  await page.evaluate(({ sel, k }) => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) throw new Error('No bubble found');
    const el = host.shadowRoot.querySelector(sel);
    if (!el) throw new Error(`Element ${sel} not found in shadow DOM`);
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  }, { sel: selector, k: key });
}

/**
 * Get text content of an element inside the bubble's shadow DOM.
 */
async function getTextInShadow(page, selector) {
  return page.evaluate((sel) => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) return null;
    const el = host.shadowRoot.querySelector(sel);
    return el ? el.textContent : null;
  }, selector);
}

/**
 * Check if an element exists and is visible inside the bubble's shadow DOM.
 */
async function isVisibleInShadow(page, selector) {
  return page.evaluate((sel) => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) return false;
    const el = host.shadowRoot.querySelector(sel);
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }, selector);
}

/**
 * Count elements matching selector inside the bubble's shadow DOM.
 */
async function countInShadow(page, selector) {
  return page.evaluate((sel) => {
    const host = document.getElementById('dobby-ai-bubble');
    if (!host || !host.shadowRoot) return 0;
    return host.shadowRoot.querySelectorAll(sel).length;
  }, selector);
}

module.exports = {
  launchExtension,
  selectText,
  waitForBubble,
  waitForStreamingStarted,
  clickInShadow,
  fillInShadow,
  pressKeyInShadow,
  getTextInShadow,
  isVisibleInShadow,
  countInShadow,
  EXTENSION_PATH,
};
