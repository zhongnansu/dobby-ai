/**
 * Demo: Pin and Drag
 *
 * Demonstrates the pin-toggle and drag-to-reposition features of the
 * Dobby AI bubble.
 *
 * Steps:
 *   1. Navigate to a content-rich page
 *   2. Select text to trigger the bubble
 *   3. Click the pin button
 *   4. Drag the header to reposition
 *   5. Click outside — bubble stays (pinned)
 *   6. Unpin and click outside — bubble closes
 */

module.exports = async (page, capture, captureFor) => {
  // 1. Go to a content-rich page
  await page.goto('https://en.wikipedia.org/wiki/Artificial_intelligence', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(2000); // let extension content scripts load
  await capture('Page loaded');

  // 2. Select some text to trigger the Dobby bubble
  //    We triple-click on a paragraph to select a full line.
  const paragraph = page.locator('#mw-content-text p').nth(1);
  await paragraph.waitFor({ state: 'visible', timeout: 10000 });
  const box = await paragraph.boundingBox();

  // Triple-click to select the paragraph text
  await page.mouse.click(box.x + 100, box.y + box.height / 2, { clickCount: 3 });
  await page.waitForTimeout(800);
  await capture('Text selected — trigger should appear');

  // Click the trigger button (Dobby AI small floating button near selection)
  // The trigger is a plain DOM element with id="dobby-ai-trigger"
  await page.waitForTimeout(500);
  const trigger = page.locator('#dobby-ai-trigger');
  const triggerVisible = await trigger.isVisible().catch(() => false);

  if (triggerVisible) {
    await capture('Trigger button visible');
    await trigger.click();
    await page.waitForTimeout(1000);
  } else {
    // Fallback: the extension may show the bubble directly via preset chips.
    // Select text manually via evaluate and dispatch event.
    await page.evaluate(() => {
      const p = document.querySelector('#mw-content-text p:nth-of-type(2)');
      if (!p) return;
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new Event('mouseup', { bubbles: true }));
    });
    await page.waitForTimeout(1500);
  }
  await capture('Bubble should be visible');

  // 3. Click the pin button inside the shadow DOM
  await page.evaluate(() => {
    const host = document.querySelector('#dobby-ai-bubble');
    if (!host || !host.shadowRoot) return;
    const pinBtn = host.shadowRoot.querySelector('.pin-btn');
    if (pinBtn) pinBtn.click();
  });
  await page.waitForTimeout(600);
  await capture('Pin button clicked — bubble is pinned');

  // 4. Drag the header to reposition the bubble
  const bubbleBox = await page.evaluate(() => {
    const host = document.querySelector('#dobby-ai-bubble');
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });

  if (bubbleBox) {
    const headerCenterX = bubbleBox.x + bubbleBox.width / 2;
    const headerTopY = bubbleBox.y + 15; // header is ~30px tall, aim for center

    await capture('Before drag');

    // Drag the bubble ~150px to the right and ~80px down
    await page.mouse.move(headerCenterX, headerTopY);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Animate the drag for a smooth GIF
    const steps = 10;
    const dx = 150;
    const dy = 80;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(
        headerCenterX + (dx * i) / steps,
        headerTopY + (dy * i) / steps
      );
      if (i % 3 === 0) await capture('Dragging...');
      await page.waitForTimeout(100);
    }
    await page.mouse.up();
    await page.waitForTimeout(400);
    await capture('Drag complete — bubble repositioned');
  }

  // 5. Click outside — bubble should stay because it's pinned
  await page.mouse.click(50, 600);
  await page.waitForTimeout(800);
  await capture('Clicked outside — bubble stays (pinned)');

  // Verify the bubble is still there
  const stillVisible = await page.evaluate(() => {
    const host = document.querySelector('#dobby-ai-bubble');
    return host !== null;
  });
  console.log(`  Bubble still visible after outside click: ${stillVisible}`);

  // 6. Unpin the bubble
  await page.evaluate(() => {
    const host = document.querySelector('#dobby-ai-bubble');
    if (!host || !host.shadowRoot) return;
    const pinBtn = host.shadowRoot.querySelector('.pin-btn');
    if (pinBtn) pinBtn.click();
  });
  await page.waitForTimeout(600);
  await capture('Unpinned');

  // Click outside — bubble should close
  await page.mouse.click(50, 600);
  await page.waitForTimeout(800);
  await capture('Clicked outside — bubble closed');

  const gone = await page.evaluate(() => {
    const host = document.querySelector('#dobby-ai-bubble');
    return host === null;
  });
  console.log(`  Bubble removed after unpin + outside click: ${gone}`);
};
