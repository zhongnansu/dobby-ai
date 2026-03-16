/**
 * Demo: Screenshot Mode
 *
 * Demonstrates the long-press screenshot capture flow:
 *   1. Navigate to a content-rich page
 *   2. Hold mouse for ~1s to trigger progress ring and enter screenshot mode
 *   3. Drag to select a region
 *   4. Confirmation toolbar appears
 *   5. Click "Capture"
 */

module.exports = async (page, capture, captureFor) => {
  // 1. Go to a content-rich page
  await page.goto('https://en.wikipedia.org/wiki/Machine_learning', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(2000); // let extension content scripts load
  await capture('Page loaded');

  // 2. Long-press to trigger progress ring and screenshot mode
  //    The extension enters screenshot mode after holding mouse for 1000ms.
  //    A progress ring appears after 500ms of holding.
  const holdX = 640;
  const holdY = 400;

  await page.mouse.move(holdX, holdY);
  await page.mouse.down();
  await capture('Mouse down — hold starting');

  // Capture frames during the 1s hold to show the progress ring animation
  await page.waitForTimeout(500);
  await capture('~500ms — progress ring should appear');

  await page.waitForTimeout(300);
  await capture('~800ms — progress ring animating');

  await page.waitForTimeout(300);
  // By now (1100ms total) screenshot mode should have activated
  await capture('~1100ms — screenshot mode activated');

  await page.mouse.up();
  await page.waitForTimeout(400);
  await capture('Mouse released — screenshot overlay visible');

  // Verify screenshot overlay appeared
  const overlayVisible = await page.evaluate(() => {
    const overlays = document.querySelectorAll('div');
    for (const el of overlays) {
      const z = el.style.zIndex;
      if (parseInt(z) > 999999) return true;
    }
    return false;
  });
  console.log(`  Screenshot overlay detected: ${overlayVisible}`);

  // 3. Drag to select a region on the overlay
  const dragStartX = 300;
  const dragStartY = 200;
  const dragEndX = 900;
  const dragEndY = 550;

  await page.mouse.move(dragStartX, dragStartY);
  await page.waitForTimeout(200);
  await page.mouse.down();
  await capture('Drag start — selecting region');

  // Animate the drag for a smooth GIF
  const steps = 12;
  const dx = dragEndX - dragStartX;
  const dy = dragEndY - dragStartY;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      dragStartX + (dx * i) / steps,
      dragStartY + (dy * i) / steps
    );
    if (i % 3 === 0) await capture('Dragging selection...');
    await page.waitForTimeout(100);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);
  await capture('Selection complete — toolbar should appear');

  // 4. Verify the confirmation toolbar is visible
  const toolbarVisible = await page.evaluate(() => {
    const toolbar = document.querySelector('[data-screenshot-toolbar]');
    return toolbar !== null;
  });
  console.log(`  Confirmation toolbar visible: ${toolbarVisible}`);
  await page.waitForTimeout(400);
  await capture('Confirmation toolbar visible');

  // 5. Click the "Capture" button
  const captureClicked = await page.evaluate(() => {
    const toolbar = document.querySelector('[data-screenshot-toolbar]');
    if (!toolbar) return false;
    // The Capture button is the first button in the toolbar
    const buttons = toolbar.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.trim() === 'Capture') {
        btn.click();
        return true;
      }
    }
    return false;
  });
  console.log(`  Capture button clicked: ${captureClicked}`);

  await page.waitForTimeout(1500);
  await capture('After capture — bubble should appear with screenshot');

  // Final frame: show the result
  await page.waitForTimeout(1000);
  await capture('Demo complete');
};
