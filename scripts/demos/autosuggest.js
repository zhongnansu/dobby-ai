/**
 * Demo: Auto-suggest ghost text — shows the inline autocomplete feature.
 *
 * Scenario:
 *   1. Navigate to example.com with injected textarea
 *   2. Enable autosuggest via chrome.storage
 *   3. Type text and wait for ghost suggestion
 *   4. Press Tab to accept suggestion
 *   5. Type more, then Escape to dismiss
 *
 * NOT intended for commit — keep untracked.
 */

const PAUSE = 600;

module.exports = async (page, cdp, capture, captureFor, helpers) => {
  const { evalInExtension } = helpers;

  // 1. Navigate to a test page
  console.log('Step 1: Navigating to example.com...');
  await page.goto('https://example.com', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);

  // Inject a textarea
  await page.evaluate(() => {
    const ta = document.createElement('textarea');
    ta.style.cssText = 'width:500px;height:200px;font-size:16px;padding:12px;margin:40px;border:2px solid #ccc;border-radius:8px;';
    ta.placeholder = 'Type here to see auto-suggest...';
    document.body.prepend(ta);
  });
  await page.waitForTimeout(500);
  await capture('textarea injected');

  // 2. Enable autosuggest via chrome.storage (bypasses popup click issues)
  console.log('Step 2: Enabling autosuggest...');
  try {
    await evalInExtension(cdp, `
      chrome.storage.local.set({ autosuggestEnabled: true });
    `);
  } catch (e) {
    // Fallback: set via page evaluate in content script context
    console.log('  evalInExtension failed, trying page evaluate...');
    await page.evaluate(() => {
      chrome.storage.local.set({ autosuggestEnabled: true });
    });
  }
  await page.waitForTimeout(500);
  await capture('autosuggest enabled');

  // 3. Type in the textarea
  console.log('Step 3: Typing in textarea...');
  const textarea = page.locator('textarea');
  await textarea.focus();
  await captureFor(300);
  await textarea.type('The quick brown fox jumps over the ', { delay: 80 });
  await captureFor(500);

  // Wait for ghost text (debounce 500ms + API roundtrip)
  console.log('Step 4: Waiting for ghost text...');
  await captureFor(2500, 200);
  await capture('after typing pause');

  // 5. Press Tab to accept
  console.log('Step 5: Pressing Tab to accept...');
  await textarea.press('Tab');
  await page.waitForTimeout(PAUSE);
  await captureFor(800);
  await capture('after Tab accept');

  // 6. Type more, then Escape
  console.log('Step 6: Typing more, then Escape...');
  await textarea.type(' and then it ', { delay: 80 });
  await captureFor(2000, 200);
  await textarea.press('Escape');
  await page.waitForTimeout(300);
  await captureFor(500);
  await capture('after Escape dismiss');

  console.log('Demo complete!');
};
