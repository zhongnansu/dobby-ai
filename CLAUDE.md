# Ask AI Chrome Extension

## Quick Reference

- Test: `npx vitest run`
- Test single file: `npx vitest run tests/<file>.test.js`
- CI coverage threshold: 80% (hard requirement)

## Architecture

Chrome extension (Manifest V3) using vanilla JS, no frameworks.
- `trigger.js` — text selection trigger, long-press screenshot mode, progress ring
- `bubble.js` — chat window UI (Shadow DOM), resize, theming
- `content.js` — content script entry point
- `background.js` — service worker, API routing, tab capture
- `image-capture.js` — screenshot capture logic
- `prompt.js` — system prompt construction
- `detection.js` — content type detection
- `presets.js` — preset prompt chips
- `api.js` — LLM API client
- `proxy/` — rate-limiting proxy server

## Conventions

- All UI in Shadow DOM for style isolation
- Styles defined in JS via `getStyles()` functions, not external CSS
- Theme: purple (#7c3aed), supports light/dark via OS preference
- Tests use vitest + jsdom — guard `el.closest()` calls for non-element targets
- Fake timers (`vi.useFakeTimers()`) required for testing long-press/timer logic

## Workflow

- Everything through PRs — never push directly to main
- Squash merge via `gh pr merge <n> --squash`
- Always use git worktrees for feature/fix branches — never work directly in the main checkout
- Commit messages: `type: description` (feat/fix/test/ci/docs)
- For UI/UX changes, Playwright visual verification is required BEFORE creating the PR:
  1. Build the extension (`npm run build`)
  2. Load in Playwright persistent context with the extension
  3. Screenshot each visual state and verify correctness
  4. Fix any visual issues before committing
- UI/UX PRs must include a demo GIF in the description
  - Record via Playwright: `node scripts/record-demo.js demos/<scenario>.js /tmp/output.gif --framerate 5`
  - Push to `docs/pr-demo-gifs` branch (non-LFS, <800KB), reference via `raw.githubusercontent.com` URL
  - Do NOT use Git LFS — raw URLs serve pointer files instead of actual content
