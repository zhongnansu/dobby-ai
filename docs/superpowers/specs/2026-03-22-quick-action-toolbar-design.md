# Quick-Action Floating Toolbar

**Issue:** [#36](https://github.com/zhongnansu/dobby-ai/issues/36)
**Date:** 2026-03-22
**Status:** Approved

## Goal

Reduce clicks from 3+ to 1 for common actions. Replace the current two-step flow (trigger button click → full popup with preset selection) with a hover-to-expand toolbar that shows the 2 most relevant preset actions inline, plus a "more" menu for the rest.

## Interaction Flow

The toolbar has three states, all rendered as **one continuous DOM element** that morphs between them:

### State 1: Collapsed (icon only)
- Identical to today's trigger button: 32px purple circle with Dobby icon
- Appears on text selection (same `mouseup`/`selectionchange` listeners in `selection.js`)
- Auto-hides after 3 seconds if not interacted with
- Does NOT appear inside input/textarea elements

### State 2: Expanded (hover)
- On `mouseenter`, toolbar width animates from 32px to fit content (~200px)
- Shows: `[icon] | [Preset 1] [Preset 2] | [...]`
- Presets determined lazily on hover: calls `detectContentType(selectedText, anchorNode)` → `getSuggestedPresetsForType(type, subType)`, taking the first 2. The `anchorNode` and `selectedText` are captured at trigger-show time (in `showTrigger`) and stored as properties on the toolbar host element (e.g., `host._selectedText`, `host._anchorNode`) — not data attributes, since `anchorNode` is a DOM Node.
- If only 1 suggested preset exists, show 1 button + "more" menu. If 0 suggested (shouldn't happen — `default` always returns 2), fall back to Summarize/Explain.
- Action buttons are compact: 12px font, 4px padding, icon + label
- "More" button (three dots) opens a popover above the toolbar
- On `mouseleave`, collapses back to icon-only (unless popover is open)
- Hover pauses the auto-hide timer
- **Overflow:** set to `visible` when popover is open (popover renders above the toolbar in expanded state)

### State 3: Morphed (chat bubble)
- On preset click, the toolbar element expands: width → 360px, height → ~210px, border-radius → 14px
- The action buttons fade out; a chat header and streaming response body fade in
- **Morphed DOM structure:** `[icon (shrunk to 22px)] [title: "Dobby AI"] [label badge] [close X]` as the header row, then a scrollable body div for the streamed response
- Response streams via `requestChat()` from `api.js` directly, using its `onToken`/`onDone`/`onError` callbacks. The toolbar does NOT import `startStreaming` from `bubble/stream.js` (which is tightly coupled to bubble DOM class names). The toolbar manages its own lightweight streaming renderer.
- **Auto-hide is cancelled** on morph. It is not restarted until `unmorphToolbar()` collapses back to icon state.
- Close button (X) cancels any active stream, collapses back to icon state, and restarts auto-hide
- **Error handling:** On stream error or rate limit, display a compact error message in the morph body (no retry button — user can close and retry). The `RATE_LIMITED` error code from `requestChat`'s `onError` callback is handled directly with a "Rate limit reached" message.
- **State isolation:** The toolbar maintains its own request handle (for cancel) as a local variable, not via the shared `currentRequest` in `state.js`. This avoids conflicts if the user opens the full bubble via "Custom prompt..." while a toolbar stream is active.

### "More" Popover
- Opens above the toolbar on three-dots click (in expanded state)
- Lists remaining presets from `getSuggestedPresetsForType()` (those not shown in the toolbar)
- Final item: "Custom prompt..." which calls the existing `showBubbleWithPresets()` from `bubble/core.js` (already exported, not new)
- Clicking a popover preset triggers the same morph-to-chat flow

## Implementation Approach

The toolbar is an **evolution of the existing trigger button**, not a rewrite. The current `createTriggerButton()` in `button.js` already creates a positioned, styled element with click handling — the toolbar extends this with two additional states (expanded, morphed).

The toolbar gets its **own Shadow DOM host** (like the bubble has its own). This provides style isolation and follows the existing pattern where `bubble/core.js` creates a Shadow DOM host for the bubble. The toolbar's styles are defined in a new `trigger/styles.js` file following the same `getStyles(theme)` pattern.

Streaming in the morphed state uses `requestChat` from `api.js` directly (with `onToken`/`onDone`/`onError` callbacks) — it does NOT import `startStreaming` from `bubble/stream.js`, which is tightly coupled to bubble DOM class names. The morphed state manages its own lightweight streaming renderer.

The mockup (`mockups/toolbar-proposal.html`) is a standalone design reference only — implementation must use the real codebase patterns (Shadow DOM, `getStyles()`, `chrome.runtime.connect`, etc.), not copy mockup HTML/CSS.

## Architecture

### Files to Change

| File | Changes |
|------|---------|
| `src/content/trigger/button.js` | Evolve `createTriggerButton()` into `createToolbar()`. The current button becomes the collapsed state. `showTrigger(x, y)` gains a third parameter: `{text, anchorNode}` captured from the selection. New functions: `expandToolbar()`, `collapseToolbar()`, `morphIntoBubble(presetLabel, messages)`, `unmorphToolbar()`. Toolbar is wrapped in its own Shadow DOM host. |
| `src/content/trigger/styles.js` | **New file.** `getToolbarStyles(theme)` returns CSS string for all toolbar states (collapsed, expanded, morphed), popover, action buttons. Follows the same pattern as `bubble/styles.js`. |
| `src/content/trigger/selection.js` | Update calls to `showTrigger()` to pass `{text, anchorNode}` from the current selection. Content detection happens lazily on hover, not at trigger-show time. |
| `src/content/bubble/core.js` | No extraction needed. The toolbar imports `startStreaming`/`requestChat` directly from `stream.js`/`api.js`. The existing `showBubbleWithPresets()` (already exported) is called for "Custom prompt..." flow. |
| `src/content/index.js` | Update click-outside dismiss logic to also check if click is inside the toolbar's Shadow DOM host (via `host.contains(target)` on the host element). |
| `src/content/shared/constants.js` | Add `TIMING.TOOLBAR_AUTO_HIDE = 3000`, `TIMING.TOOLBAR_EXPAND_DURATION = 220`. |
| `src/content/shared/state.js` | Add `toolbarState` ('collapsed' \| 'expanded' \| 'morphed'), `popoverOpen` flag, `toolbarHost` (reference to the Shadow DOM host element, ID: `dobby-ai-toolbar-host`). |
| `src/content/shared/dom-utils.js` | Update `isClickInsideUI()` to also check for the toolbar's Shadow DOM host element (found by ID `dobby-ai-toolbar-host` or via `toolbarHost` from state). |

### Files NOT Changed

- `background.js`, `api.js`, `prompt.js`, `detection.js`, `presets.js`, `bubble/styles.js`, `bubble/stream.js` — no changes needed. The toolbar reuses these modules as-is.

### Data Flow

```
Selection → showTrigger(x, y, {text, anchorNode})
  → createToolbar() [collapsed, stores text + anchorNode]

Hover (mouseenter):
  → expandToolbar()
  → detectContentType(text, anchorNode) → getSuggestedPresetsForType(type)
  → render 2 preset buttons + "more"

Click preset:
  → buildChatMessages(text, presetInstruction, true) [via prompt.js]
  → morphIntoBubble(label, messages)
  → requestChat(messages) → onToken/onDone/onError → render into morph body

Close (X):
  → cancel stream → unmorphToolbar() → collapsed state → restart auto-hide
```

### Key Constraints

- Toolbar in its own Shadow DOM host (style isolation, same pattern as bubble)
- Styles via `getToolbarStyles(theme)` in `trigger/styles.js`
- Toolbar host is absolutely positioned, z-index 2147483647 (existing `Z_INDEX.TRIGGER` constant)
- Must not conflict with long-press screenshot mode (existing `isInteractiveElement()` guard)
- `overflow: visible` when popover is open or in morphed state; `hidden` otherwise

## CSS Transitions

```
collapsed → expanded:  width 0.22s cubic-bezier(0.4,0,0.2,1)
expanded → morphed:    width 0.22s, height 0.25s, border-radius 0.22s
morphed → collapsed:   reverse of above
```

Action buttons and chat content use `opacity` transitions (0.15s) for crossfade.

## Testing Strategy

### Unit Tests (vitest + jsdom)
- `tests/toolbar.test.js` — new file:
  - Toolbar creation and positioning
  - Hover expand/collapse state transitions (use fake timers)
  - Correct presets shown per content type
  - Morph into bubble on preset click
  - Unmorph on close click, stream cancellation
  - Auto-hide timer (3s): fires when collapsed, pauses on hover, cancelled when morphed
  - Popover open/close
  - "Custom prompt..." triggers `showBubbleWithPresets()`
  - Does not appear inside input/textarea
  - Error display in morphed state on stream failure

### Existing Tests
- `tests/trigger.test.js` — update: trigger now creates toolbar instead of button, `showTrigger` signature changes
- `tests/dom-utils.test.js` — update: `isClickInsideUI` now checks toolbar host element

### Coverage
- Target: 80%+ on new code (CI threshold)

## Design Decisions

1. **Single morphing element vs. separate bubble** — Morphing provides a smoother UX and avoids the "close-and-reopen" feel. The toolbar and chat are the same DOM element in different states.

2. **Hover to expand vs. click to expand** — Hover is faster (zero clicks to see options) and matches the "don't interrupt the user's flow" principle. The icon footprint when not hovered is identical to today.

3. **Own Shadow DOM host** — The toolbar needs style isolation just like the bubble. Creating its own Shadow DOM host follows the existing pattern and avoids inline-style sprawl.

4. **Lazy content detection on hover** — Detecting content type on hover (not on trigger show) avoids unnecessary computation when the user ignores the trigger. The `anchorNode` is captured at show time and stored for later use.

5. **2 presets in toolbar, rest in popover** — Keeps the toolbar compact (~200px) so it doesn't obscure content. The 2 shown are the highest-confidence suggestions from `getSuggestedPresetsForType()`.

6. **"Custom prompt..." opens existing bubble** — Reuses the full `showBubbleWithPresets()` UI for custom text input, avoiding reimplementation.

7. **Direct `requestChat`, no `startStreaming`** — The morphed state uses `requestChat` from `api.js` with its own lightweight renderer. `startStreaming` from `stream.js` is tightly coupled to bubble DOM class names and shared state — importing it would create fragile coupling. The toolbar maintains its own request handle as a local variable to avoid state conflicts with the bubble.

## Mockup

Interactive mockup at `mockups/toolbar-proposal.html` — open in browser to see all three states and content-type scenarios.
