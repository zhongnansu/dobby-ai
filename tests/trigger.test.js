// tests/trigger.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
global.detectContentType = vi.fn(() => ({ type: 'general', subType: null, confidence: 'high' }));
global.detectContent = vi.fn(() => ({ type: 'general', subType: null, confidence: 'high' }));
global.getSuggestedPresetsForType = vi.fn(() => [
  { id: 'explain', label: 'Explain this', instruction: 'Explain the following' },
  { id: 'summarize', label: 'Summarize', instruction: 'Summarize the following' },
]);
global.buildChatMessages = vi.fn((text, instruction) => [
  { role: 'system', content: instruction },
  { role: 'user', content: text },
]);
global.showBubble = vi.fn();
global.showBubbleWithPresets = vi.fn();
global.hideBubble = vi.fn();
global._getBubbleContainer = vi.fn(() => null);

const {
  createTriggerButton,
  showTrigger,
  hideTrigger,
  _resetTriggerForTesting,
  _setDobbyEnabled,
  startScreenshotMode,
  cancelScreenshotMode,
} = await import('../trigger.js');

beforeEach(() => {
  _resetTriggerForTesting();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('createTriggerButton', () => {
  it('creates button with cockapoo icon', () => {
    createTriggerButton();
    const el = document.getElementById('dobby-ai-trigger');
    expect(el).not.toBeNull();
    const img = el.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.alt).toBe('Dobby AI');
  });

  it('is idempotent', () => {
    createTriggerButton();
    createTriggerButton();
    expect(document.querySelectorAll('#dobby-ai-trigger').length).toBe(1);
  });

  it('has circular frosted glass styling', () => {
    createTriggerButton();
    const el = document.getElementById('dobby-ai-trigger');
    expect(el.style.position).toBe('fixed');
    expect(el.style.zIndex).toBe('2147483647');
    expect(el.style.backdropFilter).toBe('blur(12px)');
    expect(el.style.cursor).toBe('pointer');
    expect(el.style.borderRadius).toBe('50%');
    expect(el.style.display).toBe('none');
  });
});

describe('showTrigger', () => {
  it('makes button visible and positions it near cursor', () => {
    showTrigger(200, 100);
    const el = document.getElementById('dobby-ai-trigger');
    expect(el.style.display).toBe('block');
  });

  it('positions below-right of cursor', () => {
    showTrigger(200, 100);
    const el = document.getElementById('dobby-ai-trigger');
    expect(el.style.left).toBe('212px'); // x + 12
    expect(el.style.top).toBe('110px'); // y + 10
  });

  it('clamps left position to prevent off-screen rendering', () => {
    showTrigger(1020, 100);
    const el = document.getElementById('dobby-ai-trigger');
    expect(parseInt(el.style.left)).toBeLessThanOrEqual(980);
  });

  it('clamps top position to viewport bottom', () => {
    showTrigger(100, 800);
    const el = document.getElementById('dobby-ai-trigger');
    expect(parseInt(el.style.top)).toBeLessThanOrEqual(732);
  });
});

describe('hideTrigger', () => {
  it('sets display to none', () => {
    showTrigger(100, 100);
    hideTrigger();
    const el = document.getElementById('dobby-ai-trigger');
    expect(el.style.display).toBe('none');
  });

  it('is safe to call when no button exists', () => {
    expect(() => hideTrigger()).not.toThrow();
  });
});

describe('event-driven behavior', () => {
  function mockSelection(text) {
    const range = { getBoundingClientRect: () => ({ top: 100, right: 200, bottom: 120, left: 100 }) };
    window.getSelection = vi.fn(() => ({
      toString: () => text,
      anchorNode: document.body,
      rangeCount: 1,
      getRangeAt: () => range,
    }));
  }

  it('mouseup with selection >= 3 chars shows trigger', () => {
    vi.useFakeTimers();
    createTriggerButton();
    mockSelection('hello world');

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    vi.advanceTimersByTime(20);

    const btn = document.getElementById('dobby-ai-trigger');
    expect(btn.style.display).toBe('block');
    vi.useRealTimers();
  });

  it('mouseup with selection < 3 chars hides trigger', () => {
    vi.useFakeTimers();
    createTriggerButton();
    mockSelection('ab');

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    vi.advanceTimersByTime(20);

    const btn = document.getElementById('dobby-ai-trigger');
    expect(btn.style.display).toBe('none');
    vi.useRealTimers();
  });

  it('mouseup does not show trigger when dobbyEnabled is false', () => {
    vi.useFakeTimers();
    createTriggerButton();
    _setDobbyEnabled(false);
    mockSelection('hello world');

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    vi.advanceTimersByTime(20);

    const btn = document.getElementById('dobby-ai-trigger');
    expect(btn.style.display).toBe('none');
    vi.useRealTimers();
  });

  it('click-away hides trigger', () => {
    createTriggerButton();
    showTrigger(200, 100);

    const btn = document.getElementById('dobby-ai-trigger');
    expect(btn.style.display).toBe('block');

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(btn.style.display).toBe('none');
  });

  it('uses img element with data URI (no innerHTML)', () => {
    createTriggerButton();
    const btn = document.getElementById('dobby-ai-trigger');
    const img = btn.querySelector('img');
    expect(img.src).toContain('data:image/svg+xml');
  });

  it('clicking trigger calls showBubbleWithPresets', () => {
    createTriggerButton();
    mockSelection('test text');
    showTrigger(200, 100);
    const btn = document.getElementById('dobby-ai-trigger');
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(showBubbleWithPresets).toHaveBeenCalledWith(
      expect.objectContaining({ top: 100, bottom: 120 }),
      'test text',
      document.body,
      undefined
    );
  });
});

describe('screenshot mode', () => {
  beforeEach(() => {
    cancelScreenshotMode();
  });

  it('startScreenshotMode creates overlay with banner', () => {
    startScreenshotMode();
    const overlays = document.querySelectorAll('div[style*="crosshair"]');
    expect(overlays.length).toBe(1);
    expect(overlays[0].textContent).toContain('Drag to select a region');
    cancelScreenshotMode();
  });

  it('cancelScreenshotMode removes the overlay', () => {
    startScreenshotMode();
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    cancelScreenshotMode();
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
  });

  it('ESC key cancels screenshot mode', () => {
    startScreenshotMode();
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
  });

  it('mouseup without prior mousedown on overlay does not dismiss it', () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    // Simulate the mouseup from long-press release (no mousedown on overlay)
    overlay.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100, bubbles: true }));
    // Overlay should still be present
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    cancelScreenshotMode();
  });

  it('click-without-drag resets selection instead of dismissing overlay', () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    // mousedown then mouseup at same position (no drag)
    overlay.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
    overlay.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100, bubbles: true }));
    // Overlay should still be present (not dismissed)
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    cancelScreenshotMode();
  });

  it('cancelScreenshotMode is safe to call when not in screenshot mode', () => {
    expect(() => cancelScreenshotMode()).not.toThrow();
  });

  function simulateDrag(overlay, startX, startY, endX, endY) {
    overlay.dispatchEvent(new MouseEvent('mousedown', { clientX: startX, clientY: startY, bubbles: true }));
    overlay.dispatchEvent(new MouseEvent('mouseup', { clientX: endX, clientY: endY, bubbles: true }));
  }

  it('shows confirmation toolbar after valid drag selection', () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    const toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    expect(toolbar).not.toBeNull();
    expect(toolbar.textContent).toContain('Capture');
    expect(toolbar.textContent).toContain('Reselect');
    expect(toolbar.textContent).toContain('Cancel');
    cancelScreenshotMode();
  });

  it('updates banner text after selection', () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    expect(overlay.textContent).toContain('Confirm selection or reselect');
    cancelScreenshotMode();
  });

  it('reselect button resets selection and restores banner', () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    const toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    const reselectBtn = toolbar.querySelectorAll('button')[1]; // second button
    reselectBtn.click();
    // Toolbar should be removed
    expect(overlay.querySelector('[data-screenshot-toolbar]')).toBeNull();
    // Overlay should still be present
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    // Banner should reset
    expect(overlay.textContent).toContain('Drag to select a region');
    cancelScreenshotMode();
  });

  it('cancel button in toolbar removes overlay', () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    const toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    const cancelBtn = toolbar.querySelectorAll('button')[2]; // third button
    cancelBtn.click();
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
  });

  it('capture button calls captureScreenshot and dismisses overlay', async () => {
    global.captureScreenshot = vi.fn(() => Promise.resolve('data:image/png;base64,abc'));
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    const toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    const captureBtn = toolbar.querySelectorAll('button')[0]; // first button
    captureBtn.click();
    await vi.waitFor(() => {
      expect(global.captureScreenshot).toHaveBeenCalled();
    });
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    delete global.captureScreenshot;
  });

  it('does not show toolbar for too-small drag', () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 55, 55); // 5x5 < 10x10 threshold
    expect(overlay.querySelector('[data-screenshot-toolbar]')).toBeNull();
    cancelScreenshotMode();
  });

  it('re-drag on overlay clears existing toolbar', () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    expect(overlay.querySelector('[data-screenshot-toolbar]')).not.toBeNull();
    // Start a new drag (mousedown on overlay outside toolbar)
    overlay.dispatchEvent(new MouseEvent('mousedown', { clientX: 300, clientY: 300, bubbles: true }));
    expect(overlay.querySelector('[data-screenshot-toolbar]')).toBeNull();
    cancelScreenshotMode();
  });

  it('mousemove after selection does not resize rectangle', () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    // Toolbar is showing — selection is locked
    const rect = overlay.querySelector('div[style*="dashed"], div[style*="solid"]');
    const widthAfterSelection = rect.style.width;
    const heightAfterSelection = rect.style.height;
    // Move mouse — should NOT resize
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 400, bubbles: true }));
    expect(rect.style.width).toBe(widthAfterSelection);
    expect(rect.style.height).toBe(heightAfterSelection);
    cancelScreenshotMode();
  });


  it('re-drag after reselect shows new toolbar', () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    // First drag
    simulateDrag(overlay, 50, 50, 200, 200);
    let toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    toolbar.querySelectorAll('button')[1].click(); // reselect
    // Second drag
    simulateDrag(overlay, 100, 100, 300, 300);
    toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    expect(toolbar).not.toBeNull();
    cancelScreenshotMode();
  });

  it('does not start screenshot mode when clicking on scrollbar area', () => {
    vi.useFakeTimers();
    _setDobbyEnabled(true);
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 1024, configurable: true });
    document.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 1030, clientY: 100, bubbles: true,
    }));
    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    vi.useRealTimers();
  });

  it('does not start screenshot mode when clicking on element-level scrollbar', () => {
    vi.useFakeTimers();
    _setDobbyEnabled(true);
    const scrollable = document.createElement('div');
    // Make element scrollable: content taller than visible area
    Object.defineProperty(scrollable, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(scrollable, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(scrollable, 'clientWidth', { value: 280, configurable: true });
    scrollable.getBoundingClientRect = () => ({ left: 100, top: 50, right: 400, bottom: 250, width: 300, height: 200 });
    document.body.appendChild(scrollable);
    // Click on the scrollbar area (offsetX 290 > clientWidth 280)
    scrollable.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 390, clientY: 100, bubbles: true,
    }));
    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    scrollable.remove();
    vi.useRealTimers();
  });

  it('does not start screenshot mode when clicking on interactive elements', () => {
    vi.useFakeTimers();
    _setDobbyEnabled(true);
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true,
    }));
    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    button.remove();
    vi.useRealTimers();
  });

  it('does not start screenshot mode when clicking on a link', () => {
    vi.useFakeTimers();
    _setDobbyEnabled(true);
    const link = document.createElement('a');
    link.href = '#';
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true,
    }));
    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    link.remove();
    vi.useRealTimers();
  });

  it('does not start screenshot mode when clicking inside a role=button element', () => {
    vi.useFakeTimers();
    _setDobbyEnabled(true);
    const div = document.createElement('div');
    div.setAttribute('role', 'button');
    const span = document.createElement('span');
    div.appendChild(span);
    document.body.appendChild(div);
    span.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true,
    }));
    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    div.remove();
    vi.useRealTimers();
  });
});
