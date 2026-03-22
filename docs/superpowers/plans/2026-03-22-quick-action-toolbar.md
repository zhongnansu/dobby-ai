# Quick-Action Floating Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the trigger button with a hover-to-expand toolbar that shows 2 context-aware presets and morphs into an inline chat bubble on click.

**Architecture:** Evolve `button.js` to support 3 states (collapsed/expanded/morphed) in its own Shadow DOM host. New `trigger/styles.js` for CSS-in-JS. Streaming via `requestChat` directly from `api.js`. All other modules (detection, presets, prompt) reused as-is.

**Tech Stack:** Vanilla JS, Shadow DOM, CSS transitions, vitest + jsdom

**Spec:** `docs/superpowers/specs/2026-03-22-quick-action-toolbar-design.md`

---

### Task 1: Add constants and state

**Files:**
- Modify: `src/content/shared/constants.js:22-31`
- Modify: `src/content/shared/state.js:17-22`
- Test: `tests/constants.test.js`

- [ ] **Step 1: Add toolbar timing constants**

In `src/content/shared/constants.js`, add to the TIMING object:

```javascript
TOOLBAR_AUTO_HIDE: 3000,
TOOLBAR_EXPAND_DURATION: 220,
```

- [ ] **Step 2: Add toolbar state to state.js**

In `src/content/shared/state.js`, add after the trigger state section:

```javascript
// Toolbar state
export let toolbarHost = null;
export let toolbarState = 'collapsed'; // 'collapsed' | 'expanded' | 'morphed'
export let popoverOpen = false;

export function setToolbarHost(host) { toolbarHost = host; }
export function setToolbarState(state) { toolbarState = state; }
export function setPopoverOpen(val) { popoverOpen = val; }
```

- [ ] **Step 3: Run existing tests to verify no breakage**

Run: `npx vitest run tests/constants.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/content/shared/constants.js src/content/shared/state.js
git commit -m "feat: add toolbar state and timing constants"
```

---

### Task 2: Create toolbar styles

**Files:**
- Create: `src/content/trigger/styles.js`

- [ ] **Step 1: Create `trigger/styles.js` with `getToolbarStyles(theme)`**

Follow the same pattern as `bubble/styles.js`. Export a single function that returns a CSS string. Cover all toolbar states:
- `:host` reset
- `.toolbar` — base styles, collapsed (32px circle), transitions for width/height/border-radius
- `.toolbar.expanded` — expanded width via CSS variable
- `.toolbar.morphed` — 360px wide, 210px tall, 14px border-radius
- `.toolbar-row` — flex row for icon + actions
- `.toolbar-icon` — 32px purple circle with Dobby SVG
- `.toolbar-expand` — actions container, opacity transition
- `.toolbar-action` — compact preset buttons (12px font)
- `.toolbar-sep` — 1px divider
- `.toolbar-more` — three-dots button
- `.toolbar-popover` — positioned above toolbar, frosted glass
- `.toolbar-popover-item` — popover menu items
- `.morph-header` — chat header row in morphed state
- `.morph-body` — scrollable response area
- `.morph-close` — close button
- `.typing-cursor` — blinking cursor during streaming
- Light/dark theme support using `isDark` boolean

Use constants from `constants.js`: `THEME.ACCENT`, `THEME.FONT_STACK`, `THEME.BACKDROP_BLUR`, etc.

- [ ] **Step 2: Commit**

```bash
git add src/content/trigger/styles.js
git commit -m "feat: add toolbar CSS-in-JS styles"
```

---

### Task 3: Update dom-utils

**Files:**
- Modify: `src/content/shared/dom-utils.js:7-15`
- Test: `tests/dom-utils.test.js`

- [ ] **Step 1: Write failing test for toolbar host check**

In `tests/dom-utils.test.js`, add test:

```javascript
it('detects click inside toolbar host', () => {
  const host = document.createElement('div');
  host.id = 'dobby-ai-toolbar-host';
  document.body.appendChild(host);
  const child = document.createElement('span');
  host.appendChild(child);
  expect(isClickInsideUI(child, () => null)).toBe(true);
  host.remove();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dom-utils.test.js`
Expected: FAIL

- [ ] **Step 3: Update `isClickInsideUI` in dom-utils.js**

```javascript
export function isClickInsideUI(target, getBubbleContainer) {
  if (!(target instanceof Element)) return false;
  const trigger = document.getElementById('dobby-ai-trigger');
  const toolbarHost = document.getElementById('dobby-ai-toolbar-host');
  const bubble = typeof getBubbleContainer === 'function' ? getBubbleContainer() : null;
  return (trigger && trigger.contains(target)) ||
         (toolbarHost && toolbarHost.contains(target)) ||
         (bubble && bubble.contains(target));
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/dom-utils.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/content/shared/dom-utils.js tests/dom-utils.test.js
git commit -m "feat: add toolbar host check to isClickInsideUI"
```

---

### Task 4: Implement toolbar (button.js rewrite)

**Files:**
- Modify: `src/content/trigger/button.js` (major rewrite)
- Test: `tests/toolbar.test.js` (new)

This is the core task. The existing `createTriggerButton` is replaced with `createToolbar` that supports three states.

- [ ] **Step 1: Write toolbar test file with core tests**

Create `tests/toolbar.test.js` with tests for:
- `createToolbar()` returns a Shadow DOM host element with id `dobby-ai-toolbar-host`
- `showTrigger(x, y, {text, anchorNode})` positions and shows the toolbar
- `hideTrigger()` hides and cleans up
- Hover (mouseenter) expands toolbar, shows preset buttons
- Mouseleave collapses toolbar back to icon
- Auto-hide fires after 3 seconds (use `vi.useFakeTimers()`)
- Hover pauses auto-hide timer
- Clicking preset button triggers morph state
- Morph state shows header with label and close button
- Close button unmorphs back to collapsed
- Auto-hide is cancelled when morphed
- Popover opens on "more" click, closes on outside click
- `extractImagesFromSelection` still works (existing function preserved)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/toolbar.test.js`
Expected: FAIL

- [ ] **Step 3: Rewrite button.js**

Replace `createTriggerButton()` with `createToolbar(presets, extraPresets)`. Key structure:

```javascript
import { getToolbarStyles } from './styles.js';
import { detectTheme } from '../bubble/core.js';
import { requestChat } from '../api.js';
import { buildChatMessages } from '../prompt.js';
import { THEME, Z_INDEX, TIMING } from '../shared/constants.js';
import { setToolbarHost, setToolbarState, setTriggerButton, toolbarState, popoverOpen, setPopoverOpen } from '../shared/state.js';
import { detectContentType } from '../detection.js';
import { getSuggestedPresetsForType } from '../presets.js';

// Preserve existing exports: showTrigger, hideTrigger, extractImagesFromSelection
// Change: createTriggerButton → createToolbar (internal)

export function showTrigger(x, y, selectionData = {}) {
  // selectionData: { text, anchorNode }
  // Create toolbar if not exists, position it, store selectionData on host
  // Start auto-hide timer
}

export function hideTrigger() {
  // Cancel timers, remove host element, reset state
}

// Internal functions:
// createToolbar() — creates Shadow DOM host, shadow root, injects styles + HTML
// expandToolbar(shadow) — detect content, render presets, animate width
// collapseToolbar(shadow) — animate back to icon, hide actions
// morphIntoBubble(shadow, label, messages) — expand to chat, start streaming
// unmorphToolbar(shadow) — cancel stream, collapse back
// openPopover(shadow) / closePopover(shadow)
// startAutoHide() / clearAutoHide()
```

The toolbar Shadow DOM structure:
```html
<div class="toolbar">
  <div class="toolbar-row">
    <div class="toolbar-icon">[SVG]</div>
    <div class="toolbar-expand">
      <div class="toolbar-sep"></div>
      <div class="toolbar-actions">[preset buttons]</div>
      <div class="toolbar-sep"></div>
      <button class="toolbar-more">[dots SVG]</button>
    </div>
    <div class="morph-header" style="display:none">
      <span class="morph-title">Dobby AI</span>
      <span class="morph-label"></span>
      <button class="morph-close">[X SVG]</button>
    </div>
  </div>
  <div class="morph-body" style="display:none">
    <div class="stream-text"></div>
  </div>
</div>
<div class="toolbar-popover">[extra presets + custom prompt]</div>
```

Event handlers:
- `mouseenter` on toolbar → `expandToolbar()`
- `mouseleave` on toolbar → `collapseToolbar()` (unless popover open or morphed)
- Click on preset action → `morphIntoBubble()`
- Click on "more" → toggle popover
- Click on popover preset → `morphIntoBubble()`
- Click on "Custom prompt..." → `hideTrigger()` then `showBubbleWithPresets()`
- Click on close (X) → `unmorphToolbar()`

Streaming in morphed state:
```javascript
function morphIntoBubble(shadow, label, messages) {
  setToolbarState('morphed');
  clearAutoHide();
  // Show morph header/body, hide toolbar-expand
  // Set label text
  const streamTarget = shadow.querySelector('.stream-text');
  const handle = requestChat(messages,
    (token) => { /* append to streamTarget.innerHTML */ },
    (info) => { /* remove cursor, show status */ },
    (code, msg) => { /* show error in streamTarget */ }
  );
  // Store handle for cancel on close
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/toolbar.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/content/trigger/button.js tests/toolbar.test.js
git commit -m "feat: implement three-state toolbar with morph-to-chat"
```

---

### Task 5: Update selection.js

**Files:**
- Modify: `src/content/trigger/selection.js:52-66`
- Test: `tests/trigger.test.js`

- [ ] **Step 1: Update showTrigger calls to pass selection data**

In `selection.js`, update the mouseup handler (line 60) and selectionchange handler (line 78) to pass `{text, anchorNode}`:

```javascript
// In mouseup handler:
const text = selectedText;
const anchorNode = sel.anchorNode;
showTrigger(cursorX, cursorY, { text, anchorNode });

// In selectionchange handler:
const text = sel.toString().trim();
const anchorNode = sel.anchorNode;
showTrigger(rect.right, rect.bottom, { text, anchorNode });
```

- [ ] **Step 2: Update trigger tests**

Update `tests/trigger.test.js` to account for the new `showTrigger` signature. The existing tests that call `showTrigger(x, y)` should still work (default `selectionData = {}`).

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/trigger.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/content/trigger/selection.js tests/trigger.test.js
git commit -m "feat: pass selection data to toolbar via showTrigger"
```

---

### Task 6: Update index.js click-outside logic

**Files:**
- Modify: `src/content/index.js:54-64`

- [ ] **Step 1: Update click-outside handler**

The existing click-outside handler dismisses the bubble when clicking outside. It should also check the toolbar host:

```javascript
document.addEventListener('mousedown', (e) => {
  const container = getBubbleContainer();
  if (container && !container._isPinned) {
    if (!isClickInsideUI(e.target, getBubbleContainer)) {
      hideBubble();
    }
  }
});
```

This already works because `isClickInsideUI` was updated in Task 3 to check the toolbar host. No code change needed — just verify.

- [ ] **Step 2: Run content tests**

Run: `npx vitest run tests/content.test.js`
Expected: PASS

- [ ] **Step 3: Commit (if any changes)**

---

### Task 7: Run full test suite and verify coverage

**Files:** All test files

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run coverage check**

Run: `npx vitest run --coverage`
Expected: 80%+ on new files

- [ ] **Step 3: Fix any failing tests**

Address any regressions in existing test files caused by the button.js changes.

- [ ] **Step 4: Final commit if fixes needed**

```bash
git commit -m "fix: address test regressions from toolbar refactor"
```
