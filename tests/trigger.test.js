// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { createTriggerButton, showTrigger, hideTrigger, _resetTriggerForTesting } from '../trigger.js';

beforeEach(() => {
  _resetTriggerForTesting();
  document.body.innerHTML = '';
});

describe('createTriggerButton', () => {
  it('creates a div with id "ask-ai-trigger"', () => {
    createTriggerButton();
    const el = document.getElementById('ask-ai-trigger');
    expect(el).not.toBeNull();
    expect(el.tagName).toBe('DIV');
  });

  it('is idempotent — calling twice does not create two buttons', () => {
    createTriggerButton();
    createTriggerButton();
    const elements = document.querySelectorAll('#ask-ai-trigger');
    expect(elements.length).toBe(1);
  });

  it('button has correct styling (purple background, fixed position, high z-index)', () => {
    createTriggerButton();
    const el = document.getElementById('ask-ai-trigger');
    expect(el.style.position).toBe('fixed');
    expect(el.style.zIndex).toBe('2147483647');
    // jsdom normalizes hex to rgb
    expect(el.style.background).toBe('rgb(79, 70, 229)');
    expect(el.style.color).toBe('white');
    expect(el.style.cursor).toBe('pointer');
    expect(el.style.borderRadius).toBe('20px');
    expect(el.style.display).toBe('none');
  });
});

describe('showTrigger', () => {
  it('makes the button visible and positions it', () => {
    const rect = { right: 200, top: 100 };
    showTrigger(rect);
    const el = document.getElementById('ask-ai-trigger');
    expect(el).not.toBeNull();
    expect(el.style.display).toBe('block');
    expect(el.style.left).toBe('200px');
    expect(el.style.top).toBe('64px'); // Math.max(4, 100 - 36) = 64
  });

  it('clamps top position to minimum of 4px', () => {
    const rect = { right: 100, top: 20 };
    showTrigger(rect);
    const el = document.getElementById('ask-ai-trigger');
    // Math.max(4, 20 - 36) = Math.max(4, -16) = 4
    expect(el.style.top).toBe('4px');
  });
});

describe('hideTrigger', () => {
  it('sets display to none', () => {
    showTrigger({ right: 100, top: 100 });
    const el = document.getElementById('ask-ai-trigger');
    expect(el.style.display).toBe('block');
    hideTrigger();
    expect(el.style.display).toBe('none');
  });

  it('is safe to call when no button exists', () => {
    // No button has been created, should not throw
    expect(() => hideTrigger()).not.toThrow();
  });
});
