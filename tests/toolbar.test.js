// tests/toolbar.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupChromeMocks } from './helpers.js';

// Mock bubble/core.js
vi.mock('../src/content/bubble/core.js', () => ({
  showBubbleWithPresets: vi.fn(),
  showBubble: vi.fn(),
  hideBubble: vi.fn(),
  getBubbleContainer: vi.fn(() => null),
  detectTheme: vi.fn(() => 'light'),
}));

// Mock image-capture
vi.mock('../src/content/image-capture.js', () => ({
  captureImage: vi.fn(),
  captureScreenshot: vi.fn(),
}));

// Mock api.js
vi.mock('../src/content/api.js', () => ({
  requestChat: vi.fn(() => ({ cancel: vi.fn() })),
}));

// Mock detection.js
vi.mock('../src/content/detection.js', () => ({
  detectContentType: vi.fn(() => ({ type: 'default', subType: null, confidence: 1.0, wordCount: 5, charCount: 25 })),
}));

// Mock presets.js
vi.mock('../src/content/presets.js', () => ({
  getSuggestedPresetsForType: vi.fn(() => [
    { label: 'Summarize', instruction: 'Summarize the following' },
    { label: 'Explain simply', instruction: 'Explain the following in simple terms' },
  ]),
  getAllPresetsForType: vi.fn(() => [
    { label: 'Translate', instruction: 'Translate the following to English' },
    { label: 'Rewrite', instruction: 'Rewrite the following more clearly' },
  ]),
}));

// Mock prompt.js
vi.mock('../src/content/prompt.js', () => ({
  buildChatMessages: vi.fn((text, instruction) => [
    { role: 'system', content: 'You are Dobby AI' },
    { role: 'user', content: `${instruction}:\n\n${text}` },
  ]),
}));

setupChromeMocks();

const { showTrigger, hideTrigger, extractImagesFromSelection } = await import('../src/content/trigger/button.js');
const { showBubbleWithPresets } = await import('../src/content/bubble/core.js');
const { requestChat } = await import('../src/content/api.js');
const { detectContentType } = await import('../src/content/detection.js');
const { getSuggestedPresetsForType } = await import('../src/content/presets.js');
const { buildChatMessages } = await import('../src/content/prompt.js');
const { setToolbarHost, setToolbarState, setPopoverOpen } = await import('../src/content/shared/state.js');

function getToolbarHost() {
  return document.getElementById('dobby-ai-toolbar-host');
}

function getShadow() {
  const host = getToolbarHost();
  return host ? host.shadowRoot : null;
}

beforeEach(() => {
  document.body.innerHTML = '';
  setToolbarHost(null);
  setToolbarState('collapsed');
  setPopoverOpen(false);
  vi.clearAllMocks();
});

afterEach(() => {
  hideTrigger();
  vi.useRealTimers();
});

describe('createToolbar / showTrigger', () => {
  it('creates a Shadow DOM host element with id dobby-ai-toolbar-host', () => {
    showTrigger(200, 100, { text: 'hello', anchorNode: null });
    const host = getToolbarHost();
    expect(host).not.toBeNull();
    expect(host.id).toBe('dobby-ai-toolbar-host');
    expect(host.shadowRoot).not.toBeNull();
  });

  it('positions and shows the toolbar at given coordinates', () => {
    showTrigger(200, 100, { text: 'hello', anchorNode: null });
    const host = getToolbarHost();
    expect(host.style.display).not.toBe('none');
    expect(parseInt(host.style.left)).toBeGreaterThanOrEqual(8);
    expect(parseInt(host.style.top)).toBeGreaterThanOrEqual(4);
  });

  it('stores selection data on the host element', () => {
    const anchorNode = document.createElement('p');
    showTrigger(200, 100, { text: 'test text', anchorNode });
    const host = getToolbarHost();
    expect(host._selectedText).toBe('test text');
    expect(host._anchorNode).toBe(anchorNode);
  });

  it('is idempotent - calling showTrigger twice does not duplicate', () => {
    showTrigger(200, 100, { text: 'hello', anchorNode: null });
    showTrigger(300, 200, { text: 'world', anchorNode: null });
    const hosts = document.querySelectorAll('#dobby-ai-toolbar-host');
    expect(hosts.length).toBe(1);
  });

  it('has a toolbar element inside shadow DOM', () => {
    showTrigger(200, 100, { text: 'hello', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');
    expect(toolbar).not.toBeNull();
  });

  it('contains the Dobby icon in collapsed state', () => {
    showTrigger(200, 100, { text: 'hello', anchorNode: null });
    const shadow = getShadow();
    const icon = shadow.querySelector('.toolbar-icon img');
    expect(icon).not.toBeNull();
    expect(icon.alt).toBe('Dobby AI');
  });

  it('works with default selectionData parameter', () => {
    showTrigger(200, 100);
    const host = getToolbarHost();
    expect(host).not.toBeNull();
    expect(host._selectedText).toBe('');
    expect(host._anchorNode).toBeNull();
  });
});

describe('hideTrigger', () => {
  it('removes the toolbar host from DOM', () => {
    showTrigger(200, 100, { text: 'hello', anchorNode: null });
    expect(getToolbarHost()).not.toBeNull();
    hideTrigger();
    expect(getToolbarHost()).toBeNull();
  });

  it('is safe to call when no toolbar exists', () => {
    expect(() => hideTrigger()).not.toThrow();
  });

  it('resets toolbar state', async () => {
    showTrigger(200, 100, { text: 'hello', anchorNode: null });
    hideTrigger();
    // Verify the host is gone from state module too
    const { toolbarHost } = await import('../src/content/shared/state.js');
    expect(toolbarHost).toBeNull();
  });
});

describe('hover expand/collapse', () => {
  it('expands toolbar on mouseenter, showing preset buttons', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(toolbar.classList.contains('expanded')).toBe(true);
    const actions = shadow.querySelectorAll('.toolbar-action');
    expect(actions.length).toBe(2);
  });

  it('calls detectContentType and getSuggestedPresetsForType on hover', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: document.body });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(detectContentType).toHaveBeenCalledWith('test text', document.body);
    expect(getSuggestedPresetsForType).toHaveBeenCalled();
  });

  it('collapses toolbar on mouseleave', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(toolbar.classList.contains('expanded')).toBe(true);

    toolbar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(toolbar.classList.contains('expanded')).toBe(false);
  });

  it('does not collapse when popover is open', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    // Open popover
    const moreBtn = shadow.querySelector('.toolbar-more');
    moreBtn.click();

    toolbar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(toolbar.classList.contains('expanded')).toBe(true);
  });

  it('does not collapse when in morphed state', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    // Click a preset to morph
    const action = shadow.querySelector('.toolbar-action');
    action.click();

    toolbar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(toolbar.classList.contains('morphed')).toBe(true);
  });

  it('shows more button alongside preset buttons', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const moreBtn = shadow.querySelector('.toolbar-more');
    expect(moreBtn).not.toBeNull();
  });
});

describe('auto-hide timer', () => {
  it('auto-hides after 3 seconds when collapsed', () => {
    vi.useFakeTimers();
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    expect(getToolbarHost()).not.toBeNull();

    vi.advanceTimersByTime(3100);
    expect(getToolbarHost()).toBeNull();
  });

  it('hover pauses auto-hide timer', () => {
    vi.useFakeTimers();
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    // Hover after 1 second
    vi.advanceTimersByTime(1000);
    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    // Wait past the original 3s timeout
    vi.advanceTimersByTime(3000);
    expect(getToolbarHost()).not.toBeNull();
  });

  it('resumes auto-hide after mouseleave from expanded state', () => {
    vi.useFakeTimers();
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    toolbar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    // Now the auto-hide should restart
    vi.advanceTimersByTime(3100);
    expect(getToolbarHost()).toBeNull();
  });

  it('auto-hide is cancelled when morphed', () => {
    vi.useFakeTimers();
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    // Expand and click preset
    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const action = shadow.querySelector('.toolbar-action');
    action.click();

    // Auto-hide should not fire
    vi.advanceTimersByTime(5000);
    expect(getToolbarHost()).not.toBeNull();
    expect(toolbar.classList.contains('morphed')).toBe(true);
  });
});

describe('morph into bubble on preset click', () => {
  it('morphs on preset button click', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const action = shadow.querySelector('.toolbar-action');
    action.click();

    expect(toolbar.classList.contains('morphed')).toBe(true);
  });

  it('shows morph header with label and close button', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    const title = shadow.querySelector('.morph-title');
    expect(title.textContent).toBe('Dobby AI');

    const label = shadow.querySelector('.morph-label');
    expect(label.textContent).toBe('Summarize');

    const closeBtn = shadow.querySelector('.morph-close');
    expect(closeBtn).not.toBeNull();
  });

  it('calls buildChatMessages and requestChat on morph', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    expect(buildChatMessages).toHaveBeenCalledWith('test text', 'Summarize the following', true);
    expect(requestChat).toHaveBeenCalled();
  });

  it('hides toolbar-expand when morphed', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    expect(toolbar.classList.contains('expanded')).toBe(false);
  });
});

describe('close button / unmorphToolbar', () => {
  it('unmorphs back to collapsed on close button click', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();
    expect(toolbar.classList.contains('morphed')).toBe(true);

    shadow.querySelector('.morph-close').click();
    expect(toolbar.classList.contains('morphed')).toBe(false);
    expect(toolbar.classList.contains('expanded')).toBe(false);
  });

  it('restarts auto-hide after unmorph', () => {
    vi.useFakeTimers();
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    // Unmorph
    shadow.querySelector('.morph-close').click();

    // Auto-hide should now be active
    vi.advanceTimersByTime(3100);
    expect(getToolbarHost()).toBeNull();
  });
});

describe('popover', () => {
  it('opens popover on more button click', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const moreBtn = shadow.querySelector('.toolbar-more');
    moreBtn.click();

    const popover = shadow.querySelector('.toolbar-popover');
    expect(popover.classList.contains('open')).toBe(true);
  });

  it('closes popover on second click of more button', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const moreBtn = shadow.querySelector('.toolbar-more');

    moreBtn.click(); // open
    expect(shadow.querySelector('.toolbar-popover').classList.contains('open')).toBe(true);

    moreBtn.click(); // close
    expect(shadow.querySelector('.toolbar-popover').classList.contains('open')).toBe(false);
  });

  it('popover contains extra presets and custom prompt option', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-more').click();

    const items = shadow.querySelectorAll('.toolbar-popover-item');
    expect(items.length).toBeGreaterThanOrEqual(1);

    // Last item should be "Custom prompt..."
    const lastItem = items[items.length - 1];
    expect(lastItem.textContent).toContain('Custom prompt');
    expect(lastItem.classList.contains('custom-prompt')).toBe(true);
  });

  it('clicking custom prompt calls showBubbleWithPresets', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-more').click();

    const items = shadow.querySelectorAll('.toolbar-popover-item');
    const customItem = items[items.length - 1];
    customItem.click();

    expect(showBubbleWithPresets).toHaveBeenCalled();
  });

  it('clicking a popover preset triggers morph state', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-more').click();

    const items = shadow.querySelectorAll('.toolbar-popover-item');
    // Click the first non-custom item
    items[0].click();

    expect(toolbar.classList.contains('morphed')).toBe(true);
  });
});

describe('streaming in morphed state', () => {
  it('shows stream text area in morphed state', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    const streamText = shadow.querySelector('.stream-text');
    expect(streamText).not.toBeNull();
  });

  it('displays typing cursor while streaming', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    const cursor = shadow.querySelector('.typing-cursor');
    expect(cursor).not.toBeNull();
  });

  it('handles onToken callback by appending text', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    // requestChat was called with callbacks - invoke onToken
    const onToken = requestChat.mock.calls[0][1];
    onToken('Hello ');
    onToken('world');

    const streamText = shadow.querySelector('.stream-text');
    expect(streamText.textContent).toContain('Hello ');
    expect(streamText.textContent).toContain('world');
  });

  it('handles onDone callback by removing cursor', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    const onDone = requestChat.mock.calls[0][2];
    onDone({ remaining: 10 });

    const cursor = shadow.querySelector('.typing-cursor');
    expect(cursor.classList.contains('hidden')).toBe(true);
  });

  it('handles onError callback by showing error message', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    const onError = requestChat.mock.calls[0][3];
    onError('ERROR', 'Something went wrong');

    const streamText = shadow.querySelector('.stream-text');
    expect(streamText.textContent).toContain('Something went wrong');
  });

  it('handles RATE_LIMITED error with specific message', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    const onError = requestChat.mock.calls[0][3];
    onError('RATE_LIMITED', 'Daily limit reached');

    const streamText = shadow.querySelector('.stream-text');
    expect(streamText.textContent).toContain('Rate limit reached');
  });
});

describe('extractImagesFromSelection', () => {
  it('is still exported and works', async () => {
    const container = document.createElement('div');
    const range = {
      commonAncestorContainer: container,
      intersectsNode: () => false,
    };
    const selection = {
      rangeCount: 1,
      getRangeAt: () => range,
    };
    const result = await extractImagesFromSelection(selection);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('fallback presets', () => {
  it('falls back to Summarize/Explain when 0 suggested presets', () => {
    getSuggestedPresetsForType.mockReturnValueOnce([]);
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const actions = shadow.querySelectorAll('.toolbar-action');
    expect(actions.length).toBe(2);
    expect(actions[0].textContent).toBe('Summarize');
    expect(actions[1].textContent).toBe('Explain');
  });

  it('shows only 1 button + more when 1 suggested preset', () => {
    getSuggestedPresetsForType.mockReturnValueOnce([
      { label: 'Explain code', instruction: 'Explain the following code' },
    ]);
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const actions = shadow.querySelectorAll('.toolbar-action');
    expect(actions.length).toBe(1);
    expect(actions[0].textContent).toBe('Explain code');
  });
});
