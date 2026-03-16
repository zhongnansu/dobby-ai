#!/usr/bin/env node
/**
 * record-demo.js — Record a demo GIF of the Dobby AI Chrome extension.
 *
 * Usage:
 *   node scripts/record-demo.js <demo-module> <output.gif> [--framerate N]
 *
 * Examples:
 *   node scripts/record-demo.js demos/pin-and-drag.js output.gif
 *   node scripts/record-demo.js demos/screenshot-mode.js screenshot-demo.gif --framerate 15
 *
 * Requirements:
 *   - Playwright (`npm i -D playwright` or `npx playwright install chromium`)
 *   - ffmpeg on PATH
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function usage() {
  console.error(
    'Usage: node scripts/record-demo.js <demo-module> <output.gif> [--framerate N]'
  );
  process.exit(1);
}

if (args.length < 2) usage();

const demoArg = args[0];
const outputGif = path.resolve(args[1]);

let framerate = 10;
const frIdx = args.indexOf('--framerate');
if (frIdx !== -1 && args[frIdx + 1]) {
  framerate = parseInt(args[frIdx + 1], 10) || 10;
}

// Resolve the demo module relative to the scripts/ directory
const scriptsDir = path.resolve(__dirname);
const demoPath = path.resolve(scriptsDir, demoArg);

if (!fs.existsSync(demoPath)) {
  console.error(`Demo module not found: ${demoPath}`);
  process.exit(1);
}

// The extension lives at the repository root (unpacked extension)
const extensionPath = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  // Create temp directory for screenshot frames
  const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dobby-demo-'));
  let frameIndex = 0;

  console.log(`Frames directory: ${framesDir}`);
  console.log(`Extension path:   ${extensionPath}`);
  console.log(`Demo module:      ${demoPath}`);
  console.log(`Output:           ${outputGif}`);
  console.log(`Framerate:        ${framerate} fps`);
  console.log('');

  // Verify ffmpeg is available
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
  } catch {
    console.error(
      'Error: ffmpeg not found on PATH. Install it first:\n' +
        '  macOS:  brew install ffmpeg\n' +
        '  Linux:  sudo apt install ffmpeg'
    );
    process.exit(1);
  }

  // Launch Chromium with the extension loaded
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dobby-profile-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
    ],
    viewport: { width: 1280, height: 720 },
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = context.pages()[0] || (await context.newPage());

  /**
   * capture() — take a screenshot and save it as the next frame.
   * Call this at key moments in your demo script.
   *
   * @param {string} [label] Optional label logged to the console
   */
  async function capture(label) {
    const frameName = `frame_${String(frameIndex).padStart(4, '0')}.png`;
    const framePath = path.join(framesDir, frameName);
    await page.screenshot({ path: framePath });
    console.log(`  [frame ${frameIndex}] ${label || ''}`);
    frameIndex++;
  }

  /**
   * captureFor() — continuously capture frames for a given duration.
   * Useful for recording animations or transitions.
   *
   * @param {number} durationMs  Total duration in milliseconds
   * @param {number} [intervalMs=200] Interval between frames
   * @param {string} [label]     Optional label prefix
   */
  async function captureFor(durationMs, intervalMs = 200, label = '') {
    const start = Date.now();
    while (Date.now() - start < durationMs) {
      await capture(label || 'continuous');
      await page.waitForTimeout(intervalMs);
    }
  }

  try {
    // Load the demo module
    const demoFn = require(demoPath);
    if (typeof demoFn !== 'function') {
      console.error('Demo module must export an async function: module.exports = async (page, capture, captureFor) => { ... }');
      process.exit(1);
    }

    console.log('Running demo scenario...\n');
    await demoFn(page, capture, captureFor);
    console.log(`\nDemo complete. ${frameIndex} frames captured.`);

    if (frameIndex === 0) {
      console.error('No frames were captured. Nothing to stitch.');
      process.exit(1);
    }

    // Stitch frames into a GIF using ffmpeg
    console.log('\nStitching GIF with ffmpeg...');
    const ffmpegCmd = [
      'ffmpeg', '-y',
      `-framerate ${framerate}`,
      `-i "${path.join(framesDir, 'frame_%04d.png')}"`,
      '-vf "scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"',
      `"${outputGif}"`,
    ].join(' ');

    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log(`\nGIF saved to: ${outputGif}`);
  } catch (err) {
    console.error('Demo failed:', err);
    process.exitCode = 1;
  } finally {
    // Clean up
    await context.close();

    // Remove frames directory
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.rmSync(userDataDir, { recursive: true, force: true });
    console.log('Cleaned up temp files.');
  }
})();
