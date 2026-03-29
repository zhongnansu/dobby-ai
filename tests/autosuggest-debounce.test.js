// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetAutosuggestState, setAutosuggestPendingRequest } from '../src/content/shared/state.js';

describe('autosuggest debounce', () => {
  let debouncedSuggest, cancelPending;

  beforeEach(async () => {
    vi.useFakeTimers();
    resetAutosuggestState();
    const mod = await import('../src/content/autosuggest/debounce.js');
    debouncedSuggest = mod.debouncedSuggest;
    cancelPending = mod.cancelPending;
  });

  afterEach(() => {
    cancelPending();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('calls callback after DEBOUNCE_MS pause', () => {
    const cb = vi.fn();
    debouncedSuggest('hello world typed text', cb);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledWith('hello world typed text');
  });

  it('resets timer on rapid calls', () => {
    const cb = vi.fn();
    debouncedSuggest('hello world', cb);
    vi.advanceTimersByTime(300);
    debouncedSuggest('hello world and more text', cb);
    vi.advanceTimersByTime(300);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('hello world and more text');
  });

  it('does not fire if cancelled', () => {
    const cb = vi.fn();
    debouncedSuggest('hello world text', cb);
    cancelPending();
    vi.advanceTimersByTime(600);
    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores text shorter than MIN_CHARS', () => {
    const cb = vi.fn();
    debouncedSuggest('hi', cb);
    vi.advanceTimersByTime(600);
    expect(cb).not.toHaveBeenCalled();
  });

  it('cancels pending request when cancelPending is called', () => {
    const mockCancel = vi.fn();
    setAutosuggestPendingRequest({ cancel: mockCancel });
    cancelPending();
    expect(mockCancel).toHaveBeenCalled();
  });
});
