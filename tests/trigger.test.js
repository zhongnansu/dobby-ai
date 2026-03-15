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
});
