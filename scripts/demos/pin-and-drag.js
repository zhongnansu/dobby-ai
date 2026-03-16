/**
 * Demo: Pin and Drag — shows the pin/unpin and drag behaviour of the Dobby AI bubble.
 *
 * Scenario:
 *   1. Open Wikipedia AI article
 *   2. Select text in the "Goals" section
 *   3. Click the trigger button to open the bubble
 *   4. Pin the bubble and simulate dragging it around
 *   5. Verify pinned bubble stays visible when clicking outside
 *   6. Unpin and verify bubble dismisses on outside click
 *
 * NOT intended for commit — keep untracked.
 */

const PAUSE = 500; // ms between steps for smooth GIF pacing

module.exports = async (page, cdp, capture, captureFor, helpers) => {
  const { findContentScriptContext, evalInExtension } = helpers;

  // ------------------------------------------------------------------
  // 1. Navigate to the target page
  // ------------------------------------------------------------------
  console.log('Step 1: Navigating to Wikipedia AI article...');
  await page.goto('https://en.wikipedia.org/wiki/Artificial_intelligence', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  // Give content scripts time to inject
  await page.waitForTimeout(2000);

  // ------------------------------------------------------------------
  // 2. Scroll down to the "Goals" section (5 scroll ticks)
  // ------------------------------------------------------------------
  console.log('Step 2: Scrolling to Goals section...');
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(PAUSE);

  // ------------------------------------------------------------------
  // 3. Capture initial page state
  // ------------------------------------------------------------------
  console.log('Step 3: Capturing initial page...');
  await capture('initial page — Goals section visible');
  await page.waitForTimeout(PAUSE);

  // ------------------------------------------------------------------
  // 4. Select text via physical mouse drag
  // ------------------------------------------------------------------
  console.log('Step 4: Selecting text via mouse drag...');
  await page.mouse.move(226, 587);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(100);
  // Drag slowly for a visible selection effect
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const x = 226 + ((700 - 226) * i) / steps;
    const y = 587 + ((607 - 587) * i) / steps;
    await page.mouse.move(x, y);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(1000);

  // ------------------------------------------------------------------
  // 5-6. Wait for trigger button, capture
  // ------------------------------------------------------------------
  console.log('Step 5-6: Waiting for trigger button...');
  await page.waitForTimeout(PAUSE);
  await capture('text selected — trigger button visible');
  await page.waitForTimeout(PAUSE);

  // ------------------------------------------------------------------
  // 7. Click the trigger button
  // ------------------------------------------------------------------
  console.log('Step 7: Clicking trigger button...');
  const triggerRect = await page.evaluate(() => {
    const el = document.getElementById('dobby-ai-trigger');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  if (!triggerRect) {
    throw new Error('Trigger button (#dobby-ai-trigger) not found on page');
  }

  const triggerX = triggerRect.x + triggerRect.width / 2;
  const triggerY = triggerRect.y + triggerRect.height / 2;
  console.log(`  Trigger at (${triggerX.toFixed(0)}, ${triggerY.toFixed(0)})`);
  await page.mouse.click(triggerX, triggerY);
  await page.waitForTimeout(PAUSE);

  // ------------------------------------------------------------------
  // 8-9. Wait for bubble, capture
  // ------------------------------------------------------------------
  console.log('Step 8-9: Waiting for bubble to appear...');
  await page.waitForTimeout(2000);
  await capture('bubble visible');
  await page.waitForTimeout(PAUSE);

  // ------------------------------------------------------------------
  // Find the content-script isolated world
  // ------------------------------------------------------------------
  console.log('Finding content-script execution context...');
  const contextId = await findContentScriptContext(cdp);

  // ------------------------------------------------------------------
  // 10-11. Pin the bubble
  // ------------------------------------------------------------------
  console.log('Step 10: Pinning the bubble...');
  await evalInExtension(
    cdp,
    contextId,
    `document.getElementById('dobby-ai-bubble').shadowRoot.querySelector('.pin-btn').click()`
  );
  await page.waitForTimeout(PAUSE);
  await capture('bubble pinned');
  await page.waitForTimeout(PAUSE);

  // ------------------------------------------------------------------
  // 12. Simulate drag by moving the host element in 3 animated steps
  // ------------------------------------------------------------------
  console.log('Step 12: Simulating drag...');

  const dragPositions = [
    { left: '500px', top: '150px' },
    { left: '350px', top: '100px' },
    { left: '200px', top: '80px' },
  ];

  for (const pos of dragPositions) {
    await evalInExtension(
      cdp,
      contextId,
      `(() => {
        const el = document.getElementById('dobby-ai-bubble');
        el.style.left = '${pos.left}';
        el.style.top = '${pos.top}';
      })()`
    );
    await page.waitForTimeout(PAUSE);
    await capture(`dragged to left=${pos.left}, top=${pos.top}`);
    await page.waitForTimeout(PAUSE);
  }

  // ------------------------------------------------------------------
  // 13-14. Click outside — bubble should stay (pinned)
  // ------------------------------------------------------------------
  console.log('Step 13-14: Clicking outside — bubble should stay...');
  await page.mouse.click(100, 700);
  await page.waitForTimeout(1000);
  await capture('clicked outside — bubble still visible (pinned)');
  await page.waitForTimeout(PAUSE);

  // ------------------------------------------------------------------
  // 15. Unpin the bubble
  // ------------------------------------------------------------------
  console.log('Step 15: Unpinning the bubble...');
  await evalInExtension(
    cdp,
    contextId,
    `document.getElementById('dobby-ai-bubble').shadowRoot.querySelector('.pin-btn').click()`
  );
  await page.waitForTimeout(PAUSE);

  // ------------------------------------------------------------------
  // 16. Click outside again
  // ------------------------------------------------------------------
  console.log('Step 16: Clicking outside again...');
  await page.mouse.click(100, 700);
  await page.waitForTimeout(1000);

  // ------------------------------------------------------------------
  // 17. Capture — bubble should be gone
  // ------------------------------------------------------------------
  console.log('Step 17: Final capture — bubble should be gone...');
  await capture('clicked outside — bubble dismissed (unpinned)');

  console.log('\nDemo complete!');
};
