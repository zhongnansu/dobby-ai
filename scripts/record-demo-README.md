# Demo GIF Recorder

Record demo GIFs of the Dobby AI Chrome extension using Playwright and ffmpeg.

## Prerequisites

- **Node.js** >= 18
- **Playwright** — install with `npm i -D playwright` then `npx playwright install chromium`
- **ffmpeg** — install with `brew install ffmpeg` (macOS) or `sudo apt install ffmpeg` (Linux)

## Usage

```bash
node scripts/record-demo.js <demo-module> <output.gif> [--framerate N]
```

### Examples

```bash
# Record the pin-and-drag demo
node scripts/record-demo.js demos/pin-and-drag.js pin-and-drag.gif

# Record screenshot mode at 15 fps
node scripts/record-demo.js demos/screenshot-mode.js screenshot-mode.gif --framerate 15
```

The script will:

1. Launch Chromium with the extension loaded (non-headless, required for extensions)
2. Run the demo scenario, capturing screenshots at key moments
3. Stitch the frames into a GIF using ffmpeg
4. Output the GIF path and clean up temp files

## Writing a demo scenario

Create a new file in `scripts/demos/`. Each demo module exports a single async function:

```js
module.exports = async (page, capture, captureFor) => {
  // page       — Playwright Page object
  // capture()  — takes a screenshot frame; call at key moments
  // captureFor(durationMs, intervalMs, label) — capture continuously for a duration

  await page.goto('https://example.com');
  await capture('Page loaded');

  // ... interact with the page and extension ...
};
```

### Tips

- The extension UI lives in Shadow DOM under `#dobby-ai-bubble`. Use `page.evaluate()` to reach into shadow roots.
- Call `capture()` frequently during animations for smooth GIFs.
- Use `page.waitForTimeout()` between steps so transitions are visible.
- The trigger button has id `#dobby-ai-trigger`.
- Screenshot mode activates after holding mouse down for 1 second.

## Available demos

| Demo | Description |
|------|-------------|
| `demos/pin-and-drag.js` | Pin toggle, drag-to-reposition, click-outside behavior |
| `demos/screenshot-mode.js` | Long-press screenshot capture with region selection |
