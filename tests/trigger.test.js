// tests/trigger.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
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
global.hideBubble = vi.fn();
global.bubbleHost = null;

const {
  createTriggerButton,
  showTrigger,
  hideTrigger,
  _resetTriggerForTesting,
} = await import('../trigger.js');

beforeEach(() => {
  _resetTriggerForTesting();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('createTriggerButton', () => {
  it('creates button with Dobby AI branding', () => {
    createTriggerButton();
    const el = document.getElementById('dobby-ai-trigger');
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('\u2726 Dobby AI');
  });

  it('is idempotent', () => {
    createTriggerButton();
    createTriggerButton();
    expect(document.querySelectorAll('#dobby-ai-trigger').length).toBe(1);
  });

  it('has frosted glass styling', () => {
    createTriggerButton();
    const el = document.getElementById('dobby-ai-trigger');
    expect(el.style.position).toBe('fixed');
    expect(el.style.backdropFilter).toBe('blur(12px)');
  });

  // Preserved from existing tests
  it('has correct styling (frosted glass indigo, fixed position, high z-index)', () => {
    createTriggerButton();
    const el = document.getElementById('dobby-ai-trigger');
    expect(el.style.position).toBe('fixed');
    expect(el.style.zIndex).toBe('2147483647');
    expect(el.style.background).toBe('rgba(79, 70, 229, 0.7)');
    expect(el.style.backdropFilter).toBe('blur(12px)');
    expect(el.style.color).toBe('white');
    expect(el.style.cursor).toBe('pointer');
    expect(el.style.borderRadius).toBe('20px');
    expect(el.style.display).toBe('none');
  });
});

describe('showTrigger', () => {
  it('makes button visible and positions it', () => {
    const rect = { right: 200, top: 100 };
    showTrigger(rect);
    const el = document.getElementById('dobby-ai-trigger');
    expect(el.style.display).toBe('block');
  });

  // Preserved from existing tests
  it('positions correctly', () => {
    const rect = { right: 200, top: 100 };
    showTrigger(rect);
    const el = document.getElementById('dobby-ai-trigger');
    expect(el.style.left).toBe('200px');
    expect(el.style.top).toBe('64px'); // Math.max(4, 100 - 36)
  });

  it('clamps left position to prevent off-screen rendering', () => {
    const rect = { right: 1020, top: 100 };
    showTrigger(rect);
    const el = document.getElementById('dobby-ai-trigger');
    // maxLeft = 1024 - 80 - 8 = 936 (jsdom defaults innerWidth=1024, offsetWidth fallback=80)
    expect(parseInt(el.style.left)).toBeLessThanOrEqual(936);
  });

  it('clamps top position to minimum of 4px', () => {
    const rect = { right: 100, top: 20 };
    showTrigger(rect);
    const el = document.getElementById('dobby-ai-trigger');
    expect(el.style.top).toBe('4px');
  });
});

describe('hideTrigger', () => {
  it('sets display to none', () => {
    showTrigger({ right: 100, top: 100 });
    hideTrigger();
    const el = document.getElementById('dobby-ai-trigger');
    expect(el.style.display).toBe('none');
  });

  it('is safe to call when no button exists', () => {
    expect(() => hideTrigger()).not.toThrow();
  });
});

// Preserved from existing tests
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

  it('click-away hides trigger', () => {
    createTriggerButton();
    showTrigger({ right: 200, top: 100 });

    const btn = document.getElementById('dobby-ai-trigger');
    expect(btn.style.display).toBe('block');

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(btn.style.display).toBe('none');
  });

  it('uses textContent instead of innerHTML for security', () => {
    createTriggerButton();
    const btn = document.getElementById('dobby-ai-trigger');
    expect(btn.textContent).toContain('Dobby AI');
    expect(btn.textContent).toBe('\u2726 Dobby AI');
  });
});

// Errata item 9: preset selector tests
describe('preset selector', () => {
  it('shows preset buttons from getSuggestedPresetsForType', () => {
    createTriggerButton();
    window.getSelection = vi.fn(() => ({
      toString: () => 'test text',
      anchorNode: document.body,
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 100, right: 200, bottom: 120, left: 100 }) }),
    }));
    showTrigger({ right: 200, top: 100 });
    const btn = document.getElementById('dobby-ai-trigger');
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const presets = document.getElementById('dobby-ai-presets');
    expect(presets).not.toBeNull();
  });
});
