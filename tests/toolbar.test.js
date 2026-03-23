// tests/toolbar.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupChromeMocks } from './helpers.js';

// Mock bubble/core.js
vi.mock('../src/content/bubble/core.js', () => ({
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
const { showBubble } = await import('../src/content/bubble/core.js');
const { detectContentType } = await import('../src/content/detection.js');
const { getSuggestedPresetsForType } = await import('../src/content/presets.js');
const { buildChatMessages } = await import('../src/content/prompt.js');
const { setToolbarHost, setToolbarState } = await import('../src/content/shared/state.js');

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

  it('does not collapse when in input mode', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    // Enter input mode by clicking pencil
    const pencilBtn = shadow.querySelector('.toolbar-pencil');
    pencilBtn.click();

    toolbar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(toolbar.classList.contains('expanded')).toBe(true);
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

});

describe('input mode', () => {
  it('shows pencil button in expanded toolbar', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const pencilBtn = shadow.querySelector('.toolbar-pencil');
    expect(pencilBtn).not.toBeNull();
    expect(pencilBtn.title).toBe('Custom prompt');
  });

  it('enters input mode on pencil click — shows input, hides presets', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    const inputSection = shadow.querySelector('.toolbar-input-section');
    expect(inputSection.classList.contains('visible')).toBe(true);

    const actionsDiv = shadow.querySelector('.toolbar-actions');
    expect(actionsDiv.style.opacity).toBe('0');
  });

  it('pencil becomes close icon in input mode', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const pencilBtn = shadow.querySelector('.toolbar-pencil');
    pencilBtn.click();

    expect(pencilBtn.classList.contains('close-mode')).toBe(true);
    expect(pencilBtn.title).toBe('Cancel');
  });

  it('exits input mode on close button click — restores presets', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const pencilBtn = shadow.querySelector('.toolbar-pencil');
    pencilBtn.click(); // enter
    pencilBtn.click(); // exit (now it's close button)

    const inputSection = shadow.querySelector('.toolbar-input-section');
    expect(inputSection.classList.contains('visible')).toBe(false);

    const actionsDiv = shadow.querySelector('.toolbar-actions');
    expect(actionsDiv.style.opacity).not.toBe('0');
  });

  it('exits input mode on Escape key', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    const inputField = shadow.querySelector('.toolbar-input-field');
    inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    const inputSection = shadow.querySelector('.toolbar-input-section');
    expect(inputSection.classList.contains('visible')).toBe(false);
  });

  it('send button is disabled when input is empty', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    const sendBtn = shadow.querySelector('.toolbar-send');
    expect(sendBtn.classList.contains('disabled')).toBe(true);
  });

  it('send button enables when input has text', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    const inputField = shadow.querySelector('.toolbar-input-field');
    inputField.value = 'hello';
    inputField.dispatchEvent(new Event('input', { bubbles: true }));

    const sendBtn = shadow.querySelector('.toolbar-send');
    expect(sendBtn.classList.contains('disabled')).toBe(false);
  });

  it('Enter with empty input does not call showBubble', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    const inputField = shadow.querySelector('.toolbar-input-field');
    inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(showBubble).not.toHaveBeenCalled();
  });

  it('Enter with text calls showBubble via morphIntoBubble', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    const inputField = shadow.querySelector('.toolbar-input-field');
    inputField.value = 'What does this mean?';
    inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(showBubble).toHaveBeenCalledTimes(1);
    expect(buildChatMessages).toHaveBeenCalledWith('test text', 'What does this mean?', true, null);
  });

  it('send button click with text calls showBubble', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    const inputField = shadow.querySelector('.toolbar-input-field');
    inputField.value = 'Translate this';
    const sendBtn = shadow.querySelector('.toolbar-send');
    sendBtn.classList.remove('disabled');
    sendBtn.click();

    expect(showBubble).toHaveBeenCalledTimes(1);
  });

  it('auto-hide is suppressed during input mode', () => {
    vi.useFakeTimers();
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    vi.advanceTimersByTime(5000);
    expect(getToolbarHost()).not.toBeNull();
  });

  it('mouseleave does not collapse during input mode', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    toolbar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(toolbar.classList.contains('expanded')).toBe(true);
  });

  it('click outside toolbar exits input mode', () => {
    vi.useFakeTimers();
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    vi.advanceTimersByTime(1);

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const inputSection = shadow.querySelector('.toolbar-input-section');
    expect(inputSection.classList.contains('visible')).toBe(false);
  });

  it('send button click with empty input does not call showBubble', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-pencil').click();

    const sendBtn = shadow.querySelector('.toolbar-send');
    sendBtn.click();

    expect(showBubble).not.toHaveBeenCalled();
  });

  it('auto-hide resumes after exiting input mode', () => {
    vi.useFakeTimers();
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const pencilBtn = shadow.querySelector('.toolbar-pencil');
    pencilBtn.click();
    pencilBtn.click();

    vi.advanceTimersByTime(3100);
    expect(getToolbarHost()).toBeNull();
  });
});

describe('preset click opens bubble', () => {
  it('calls showBubble with correct arguments on preset button click', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    expect(showBubble).toHaveBeenCalledTimes(1);
    const args = showBubble.mock.calls[0];
    // arg 0: selectionRect (object with top/left/etc.)
    expect(args[0]).toHaveProperty('top');
    expect(args[0]).toHaveProperty('left');
    // arg 1: messages array from buildChatMessages
    expect(args[1]).toEqual([
      { role: 'system', content: 'You are Dobby AI' },
      { role: 'user', content: 'Summarize the following:\n\ntest text' },
    ]);
    // arg 2: selected text
    expect(args[2]).toBe('test text');
    // arg 3: instruction
    expect(args[3]).toBe('Summarize the following');
  });

  it('calls buildChatMessages with text, instruction, and true', () => {
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    expect(buildChatMessages).toHaveBeenCalledWith('test text', 'Summarize the following', true, null);
  });

  it('removes toolbar after preset click', () => {
    vi.useFakeTimers();
    showTrigger(200, 100, { text: 'test text', anchorNode: null });
    const shadow = getShadow();
    const toolbar = shadow.querySelector('.toolbar');

    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    shadow.querySelector('.toolbar-action').click();

    // Toolbar is removed after 220ms crossfade
    vi.advanceTimersByTime(250);
    expect(getToolbarHost()).toBeNull();
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
