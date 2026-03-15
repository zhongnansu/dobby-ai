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
- Use git worktrees when other agents may be working in the repo
- Commit messages: `type: description` (feat/fix/test/ci/docs)
