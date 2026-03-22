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
- Appears on text selection (same `mouseup`/`selectionchange` listeners)
- Auto-hides after 3 seconds if not interacted with
- Does NOT appear inside input/textarea elements

### State 2: Expanded (hover)
- On `mouseenter`, toolbar width animates from 32px to fit content (~200px)
- Shows: `[icon] | [Preset 1] [Preset 2] | [...]`
- Presets determined by `detectContentType()` → `getSuggestedPresetsForType()`, taking the first 2
- Action buttons are compact: 12px font, 4px padding, icon + label
- "More" button (three dots) opens a popover above the toolbar
- On `mouseleave`, collapses back to icon-only (unless popover is open)
- Hover pauses the auto-hide timer

### State 3: Morphed (chat bubble)
- On preset click, the toolbar element expands: width → 360px, height → ~210px, border-radius → 14px
- The action buttons fade out; a chat header ("Dobby AI" + preset label + close button) and streaming response body fade in
- Response streams via the existing `startStreaming()` → `requestChat()` pipeline
- Close button (X) collapses back to icon state and restarts auto-hide

### "More" Popover
- Opens above the toolbar on three-dots click
- Lists remaining presets from `getSuggestedPresetsForType()` (those not shown in the toolbar)
- Final item: "Custom prompt..." which triggers `showBubbleWithPresets()` (existing full bubble UI)
- Clicking a popover preset triggers the same morph-to-chat flow

## Implementation Approach

The toolbar is an **evolution of the existing trigger button**, not a rewrite. The current `createTriggerButton()` in `button.js` already creates a positioned, styled element with click handling — the toolbar extends this with two additional states (expanded, morphed). All styling goes through the existing `getStyles()` pattern, all UI lives in the existing Shadow DOM, and streaming reuses the existing `startStreaming()` → `requestChat()` pipeline in `bubble/core.js`.

The mockup (`mockups/toolbar-proposal.html`) is a standalone design reference only — implementation must use the real codebase patterns (Shadow DOM, `getStyles()`, `chrome.runtime.connect`, etc.), not copy mockup HTML/CSS.

## Architecture

### Files to Change

| File | Changes |
|------|---------|
| `src/content/trigger/button.js` | Evolve existing `createTriggerButton()` into `createToolbar()`. The current button becomes the collapsed state; add expand/collapse/morph logic on top. Reuse existing positioning, z-index, and tooltip patterns. New functions: `expandToolbar()`, `collapseToolbar()`, `morphIntoBubble()`, `unmorphToolbar()`. |
| `src/content/trigger/selection.js` | Update `showTrigger()` to call `createToolbar()` instead of `createTriggerButton()`. Pass `detectContentType()` result to determine presets. |
| `src/content/bubble/core.js` | Extract `activateResponseSection()` and streaming setup into a reusable function that the toolbar's morphed state can call. Add `showBubbleWithPresets()` export for "Custom prompt..." flow. |
| `src/content/bubble/styles.js` | Add toolbar styles to `getStyles()`: collapsed, expanded, morphed states, popover, action buttons. |
| `src/content/shared/constants.js` | Add `TIMING.TOOLBAR_AUTO_HIDE = 3000`, `TIMING.TOOLBAR_EXPAND_DURATION = 220`. |
| `src/content/shared/state.js` | Add `toolbarState` ('collapsed' | 'expanded' | 'morphed'), `popoverOpen` flag. |

### Files NOT Changed

- `background.js`, `api.js`, `prompt.js`, `detection.js`, `presets.js` — no changes needed. The toolbar reuses existing content detection, preset selection, prompt building, and streaming pipeline.

### Key Constraints

- All UI in Shadow DOM (existing pattern)
- Styles via `getStyles()` in JS (existing pattern)
- Toolbar element is absolutely positioned, z-index 2147483647 (existing constant)
- Must not conflict with long-press screenshot mode (guard via `isInteractiveElement()`)
- `overflow: hidden` on the toolbar during collapsed/expanded states; switched to `visible` when morphed (to allow popover to render above)

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
  - Hover expand/collapse state transitions
  - Morph into bubble on preset click
  - Unmorph on close click
  - Auto-hide timer (3s) with fake timers
  - Hover pauses auto-hide
  - Popover open/close
  - "Custom prompt..." triggers `showBubbleWithPresets()`
  - Does not appear inside input/textarea
  - Correct presets shown per content type (delegates to existing detection)

### Existing Tests
- `tests/trigger.test.js` — update: trigger now creates toolbar instead of button
- `tests/bubble.test.js` — update if `activateResponseSection` is extracted

### Coverage
- Target: 80%+ on new code (CI threshold)

## Design Decisions

1. **Single morphing element vs. separate bubble** — Morphing provides a smoother UX and avoids the "close-and-reopen" feel. The toolbar and chat are the same DOM element in different states.

2. **Hover to expand vs. click to expand** — Hover is faster (zero clicks to see options) and matches the "don't interrupt the user's flow" principle. The icon footprint when not hovered is identical to today.

3. **2 presets in toolbar, rest in popover** — Keeps the toolbar compact (~200px) so it doesn't obscure content. The 2 shown are the highest-confidence suggestions from `detectContentType()`.

4. **"Custom prompt..." opens existing bubble** — Reuses the full `showBubbleWithPresets()` UI for custom text input, avoiding reimplementation of the text input + all-presets-chips view inside the toolbar.

## Mockup

Interactive mockup at `mockups/toolbar-proposal.html` — open in browser to see all three states and content-type scenarios.
