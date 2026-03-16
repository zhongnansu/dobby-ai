#!/usr/bin/env node
/**
 * Reusable Playwright-based GIF recording harness for Dobby AI Chrome extension.
 *
 * Usage:
 *   node scripts/record-demo.js <demo-module> <output.gif> [--framerate N]
 *
 * Example:
 *   node scripts/record-demo.js demos/pin-and-drag.js /tmp/test-demo.gif --framerate 4
 *
 * NOT intended for commit — keep untracked.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function usage() {
  console.error(
    'Usage: node scripts/record-demo.js <demo-module> <output.gif> [--framerate N]'
  );
  throw new Error('Invalid arguments');
}

if (args.length < 2) usage();

const demoModulePath = args[0];
const outputGif = args[1];
let framerate = 2; // default — slow enough for a readable demo

for (let i = 2; i < args.length; i++) {
  if (args[i] === '--framerate' && args[i + 1]) {
    framerate = parseInt(args[i + 1], 10);
    if (Number.isNaN(framerate) || framerate < 1) {
      throw new Error('--framerate must be a positive integer');
    }
    i++; // skip value
  }
}

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------
try {
  execSync('which ffmpeg', { stdio: 'ignore' });
} catch {
  throw new Error(
    'ffmpeg is not on PATH. Install it (brew install ffmpeg) and try again.'
  );
}

// Extension root is the repo root (parent of scripts/)
const EXTENSION_PATH = path.resolve(__dirname, '..');
const MANIFEST = path.join(EXTENSION_PATH, 'manifest.json');
if (!fs.existsSync(MANIFEST)) {
  throw new Error(`manifest.json not found at ${MANIFEST}`);
}

// Resolve demo module relative to scripts/ dir
const resolvedDemo = path.resolve(__dirname, demoModulePath);
if (!fs.existsSync(resolvedDemo)) {
  throw new Error(`Demo module not found: ${resolvedDemo}`);
}

// ---------------------------------------------------------------------------
// Temp directory for frames
// ---------------------------------------------------------------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dobby-gif-'));
let frameIndex = 0;

// ---------------------------------------------------------------------------
// Helper: CDP screenshot → numbered PNG frame
// ---------------------------------------------------------------------------
function makeCapture(cdp) {
  return async function capture(label) {
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
    });
    const idx = String(frameIndex).padStart(4, '0');
    const framePath = path.join(tmpDir, `frame_${idx}.png`);
    fs.writeFileSync(framePath, Buffer.from(data, 'base64'));
    console.log(`  [frame ${idx}] ${label || ''}`);
    frameIndex++;
  };
}

// ---------------------------------------------------------------------------
// Helper: continuous capture for animations
// ---------------------------------------------------------------------------
function makeCaptureFor(capture) {
  return async function captureFor(durationMs, intervalMs = 250) {
    const end = Date.now() + durationMs;
    let tick = 0;
    while (Date.now() < end) {
      await capture(`captureFor tick ${tick++}`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };
}

// ---------------------------------------------------------------------------
// Helper: find the content-script isolated world contextId
// ---------------------------------------------------------------------------
async function findContentScriptContext(cdp) {
  await cdp.send('Runtime.enable');

  // Collect existing execution contexts
  const contexts = [];

  // Use a fresh listener approach: ask the browser for all contexts
  // by disabling and re-enabling Runtime.
  await cdp.send('Runtime.disable');

  const contextPromise = new Promise((resolve) => {
    const collected = [];
    const handler = (params) => {
      collected.push(params.context);
    };
    cdp.on('Runtime.executionContextCreated', handler);

    // Re-enable — the browser will fire executionContextCreated for each context
    cdp.send('Runtime.enable').then(() => {
      // Give a moment for all events to arrive
      setTimeout(() => {
        cdp.off('Runtime.executionContextCreated', handler);
        resolve(collected);
      }, 500);
    });
  });

  const allContexts = await contextPromise;

  // Try each context to find the one with showBubble defined
  for (const ctx of allContexts) {
    try {
      const result = await cdp.send('Runtime.evaluate', {
        expression: 'typeof showBubble',
        contextId: ctx.id,
        returnByValue: true,
      });
      if (
        result &&
        result.result &&
        result.result.value === 'function'
      ) {
        console.log(
          `  Found content-script context: id=${ctx.id}, origin=${ctx.origin || 'N/A'}`
        );
        return ctx.id;
      }
    } catch {
      // context may have been destroyed — skip
    }
  }
  throw new Error(
    'Could not find content-script isolated world context (showBubble not found in any context)'
  );
}

// ---------------------------------------------------------------------------
// Helper: evaluate in extension content-script isolated world
// ---------------------------------------------------------------------------
async function evalInExtension(cdp, contextId, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    contextId,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    const msg =
      result.exceptionDetails.text ||
      result.exceptionDetails.exception?.description ||
      JSON.stringify(result.exceptionDetails);
    throw new Error(`evalInExtension error: ${msg}`);
  }
  return result.result?.value;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  let context;
  try {
    console.log('Launching Chromium with extension...');
    console.log(`  Extension path: ${EXTENSION_PATH}`);

    // Create a temporary user-data-dir so the persistent context is clean
    const userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dobby-profile-')
    );

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--disable-gpu',
      ],
      viewport: { width: 1280, height: 720 },
      ignoreDefaultArgs: ['--disable-extensions'],
    });

    // Wait for the service worker to register
    console.log('Waiting for service worker...');
    let sw;
    try {
      sw = await context.waitForEvent('serviceworker', { timeout: 10000 });
      console.log(`  Service worker registered: ${sw.url()}`);
    } catch {
      // Some Playwright versions surface extension SW differently
      const workers = context.serviceWorkers();
      if (workers.length > 0) {
        sw = workers[0];
        console.log(`  Service worker already running: ${sw.url()}`);
      } else {
        console.warn(
          '  Warning: no service worker detected — continuing anyway'
        );
      }
    }

    // Get the first page (Chromium opens a blank tab)
    const page =
      context.pages().length > 0
        ? context.pages()[0]
        : await context.newPage();

    // Create a CDP session for the page
    const cdp = await context.newCDPSession(page);

    // Build helpers
    const capture = makeCapture(cdp);
    const captureFor = makeCaptureFor(capture);
    const helpers = { findContentScriptContext, evalInExtension };

    // Load and run the demo module
    console.log(`Running demo: ${resolvedDemo}`);
    const demo = require(resolvedDemo);
    await demo(page, cdp, capture, captureFor, helpers);

    console.log(`\nCapture complete — ${frameIndex} frames in ${tmpDir}`);

    // ------------------------------------------------------------------
    // Stitch frames into GIF via ffmpeg
    // ------------------------------------------------------------------
    if (frameIndex === 0) {
      throw new Error('No frames were captured — nothing to stitch');
    }

    const absOutput = path.resolve(outputGif);
    console.log(`Stitching GIF at framerate=${framerate}...`);

    const ffmpegCmd = [
      'ffmpeg', '-y',
      '-framerate', String(framerate),
      '-i', path.join(tmpDir, 'frame_%04d.png'),
      '-vf',
      '"scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"',
      absOutput,
    ].join(' ');

    console.log(`  $ ${ffmpegCmd}`);
    execSync(ffmpegCmd, { stdio: 'inherit' });

    const stat = fs.statSync(absOutput);
    console.log(
      `\nDone! GIF saved to ${absOutput} (${(stat.size / 1024).toFixed(1)} KB)`
    );
  } catch (err) {
    console.error('\nFATAL:', err.message || err);
    process.exitCode = 1;
  } finally {
    // Cleanup
    if (context) {
      try {
        await context.close();
      } catch {
        // ignore
      }
    }
    // Remove temp frames
    if (fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log(`Cleaned up temp dir: ${tmpDir}`);
      } catch {
        console.warn(`Could not remove temp dir: ${tmpDir}`);
      }
    }
  }
})();
