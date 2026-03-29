// tests/autosuggest-index.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resetAutosuggestState,
  setAutosuggestEnabled,
  autosuggestCurrentSuggestion,
  setAutosuggestCurrentSuggestion,
} from '../src/content/shared/state.js';
import { showGhostText } from '../src/content/autosuggest/ghost-text.js';

// Mock the API module
vi.mock('../src/content/api.js', () => ({
  requestAutosuggest: vi.fn((messages, onToken, onDone) => {
    onToken('suggestion text');
    onDone();
    return { cancel: vi.fn() };
  }),
  requestChat: vi.fn(),
}));

describe('autosuggest lifecycle', () => {
  let initAutosuggest, destroyAutosuggest;
  let textarea;

  beforeEach(async () => {
    vi.useFakeTimers();
    resetAutosuggestState();
    setAutosuggestEnabled(true);

    textarea = document.createElement('textarea');
    textarea.style.cssText = 'font-size:16px;font-family:monospace;padding:8px;line-height:20px;';
    document.body.appendChild(textarea);

    textarea.getBoundingClientRect = vi.fn(() => ({
      top: 100, left: 50, width: 400, height: 200, bottom: 300, right: 450,
    }));
    window.getComputedStyle = vi.fn(() => ({
      fontSize: '16px', fontFamily: 'monospace', lineHeight: '20px',
      paddingTop: '8px', paddingLeft: '8px', paddingRight: '8px', paddingBottom: '8px',
      borderTopWidth: '1px', borderLeftWidth: '1px',
      letterSpacing: 'normal', wordSpacing: 'normal',
    }));

    const mod = await import('../src/content/autosuggest/index.js');
    initAutosuggest = mod.initAutosuggest;
    destroyAutosuggest = mod.destroyAutosuggest;
  });

  afterEach(() => {
    destroyAutosuggest();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('attaches focusin listener when initAutosuggest() called', () => {
    const spy = vi.spyOn(document, 'addEventListener');
    initAutosuggest();
    const focusinCall = spy.mock.calls.find((c) => c[0] === 'focusin');
    expect(focusinCall).toBeDefined();
  });

  it('starts monitoring textarea on focus', () => {
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    textarea.value = 'Hello world this is a test';
    textarea.selectionStart = textarea.value.length;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-dobby-autosuggest]')).toBeNull();
  });

  it('Tab key accepts suggestion when one is visible', () => {
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    setAutosuggestCurrentSuggestion('world');

    // Show ghost text overlay so acceptSuggestion has something to work with
    textarea.value = 'Hello ';
    textarea.selectionStart = 6;
    showGhostText(textarea, 'world');

    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    textarea.dispatchEvent(event);
    expect(textarea.value).toBe('Hello world');
  });

  it('Escape key dismisses suggestion', () => {
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    setAutosuggestCurrentSuggestion('world');

    textarea.value = 'Hello ';
    textarea.selectionStart = 6;
    showGhostText(textarea, 'world');

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-dobby-autosuggest]')).toBeNull();
  });

  it('destroyAutosuggest removes all listeners', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    initAutosuggest();
    destroyAutosuggest();
    const focusinRemove = removeSpy.mock.calls.find((c) => c[0] === 'focusin');
    expect(focusinRemove).toBeDefined();
  });

  it('cleans up on textarea blur', () => {
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(document.querySelector('[data-dobby-autosuggest]')).toBeNull();
  });
});
