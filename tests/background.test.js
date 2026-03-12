import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Chrome APIs before importing
const mockCreate = vi.fn();
const mockStorageGet = vi.fn();
const mockSendMessage = vi.fn();
const mockTabsCreate = vi.fn();
const mockTabsUpdate = vi.fn();
const mockWindowsCreate = vi.fn();
const mockWindowsGet = vi.fn();
const mockWindowsGetCurrent = vi.fn();
const mockWindowsUpdate = vi.fn();

global.chrome = {
  runtime: {
    onInstalled: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
    lastError: null,
  },
  contextMenus: {
    create: mockCreate,
    onClicked: { addListener: vi.fn() },
  },
  tabs: {
    sendMessage: mockSendMessage,
    create: mockTabsCreate,
    update: mockTabsUpdate,
  },
  storage: {
    local: { get: mockStorageGet },
  },
  windows: {
    create: mockWindowsCreate,
    get: mockWindowsGet,
    getCurrent: mockWindowsGetCurrent,
    update: mockWindowsUpdate,
    onRemoved: { addListener: vi.fn() },
  },
};

// Import after mocks are set up
const mod = await import('../background.js');
const resetPopupWindowId = mod._resetPopupWindowIdForTesting;

// Capture handlers immediately after import, before any clearAllMocks
const clickHandler = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];
const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
const windowRemovedHandler = chrome.windows.onRemoved.addListener.mock.calls[0][0];

describe('context menu registration', () => {
  it('registers onInstalled listener', () => {
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledOnce();
  });

  it('registers windows.onRemoved listener', () => {
    expect(chrome.windows.onRemoved.addListener).toHaveBeenCalledOnce();
  });

  it('creates context menu with correct config on install', () => {
    const installCallback = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
    installCallback();
    expect(mockCreate).toHaveBeenCalledWith({
      id: 'ask-ai',
      title: 'Ask AI',
      contexts: ['selection']
    });
  });
});

describe('context menu click handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.runtime.lastError = null;
    resetPopupWindowId();
  });

  it('sends SHOW_POPUP message to content script', () => {
    mockSendMessage.mockResolvedValue(undefined);
    clickHandler(
      { menuItemId: 'ask-ai', selectionText: 'hello world' },
      { id: 1 }
    );
    expect(mockSendMessage).toHaveBeenCalledWith(1, {
      type: 'SHOW_POPUP',
      text: 'hello world'
    });
  });

  it('falls back to popup window when content script unavailable', async () => {
    mockSendMessage.mockRejectedValue(new Error('no content script'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'chatgpt', pageContext: true, openMode: 'popup' });
    });
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 100, top: 50, width: 1000 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 42 });
    });

    clickHandler(
      { menuItemId: 'ask-ai', selectionText: 'test text' },
      { id: 1, title: 'Test Page', url: 'https://example.com' }
    );

    await vi.waitFor(() => {
      expect(mockWindowsCreate).toHaveBeenCalled();
    });

    const opts = mockWindowsCreate.mock.calls[0][0];
    expect(opts.type).toBe('popup');
    expect(opts.width).toBe(420);
    expect(opts.height).toBe(650);
    expect(opts.url).toContain('chatgpt.com');
    expect(opts.url).toContain(encodeURIComponent('test text'));
  });

  it('falls back to tab when openMode is tab', async () => {
    mockSendMessage.mockRejectedValue(new Error('no content script'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'chatgpt', pageContext: false, openMode: 'tab' });
    });

    clickHandler(
      { menuItemId: 'ask-ai', selectionText: 'test text' },
      { id: 1, title: 'Test Page', url: 'https://example.com' }
    );

    await vi.waitFor(() => {
      expect(mockTabsCreate).toHaveBeenCalled();
    });

    const url = mockTabsCreate.mock.calls[0][0].url;
    expect(url).toContain('chatgpt.com');
    expect(mockWindowsCreate).not.toHaveBeenCalled();
  });

  it('uses claude URL when lastAI is claude', async () => {
    mockSendMessage.mockRejectedValue(new Error('no content script'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'claude', pageContext: false, openMode: 'tab' });
    });

    clickHandler(
      { menuItemId: 'ask-ai', selectionText: 'test' },
      { id: 1, title: 'Page', url: 'https://x.com' }
    );

    await vi.waitFor(() => {
      expect(mockTabsCreate).toHaveBeenCalled();
    });

    const url = mockTabsCreate.mock.calls[0][0].url;
    expect(url).toContain('claude.ai');
  });

  it('ignores non-ask-ai menu items', () => {
    clickHandler(
      { menuItemId: 'other-item', selectionText: 'text' },
      { id: 1 }
    );
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('ignores empty selectionText', () => {
    mockSendMessage.mockResolvedValue(undefined);
    clickHandler(
      { menuItemId: 'ask-ai', selectionText: '' },
      { id: 1 }
    );
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('ignores whitespace-only selectionText', () => {
    mockSendMessage.mockResolvedValue(undefined);
    clickHandler(
      { menuItemId: 'ask-ai', selectionText: '   ' },
      { id: 1 }
    );
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('handles missing selectionText gracefully', () => {
    mockSendMessage.mockResolvedValue(undefined);
    clickHandler(
      { menuItemId: 'ask-ai' },
      { id: 1 }
    );
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('truncates long text in fallback path at 6000 chars', async () => {
    mockSendMessage.mockRejectedValue(new Error('no content script'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'chatgpt', pageContext: false, openMode: 'tab' });
    });

    const longText = 'x'.repeat(8000);
    clickHandler(
      { menuItemId: 'ask-ai', selectionText: longText },
      { id: 1, title: 'Page', url: 'https://example.com' }
    );

    await vi.waitFor(() => {
      expect(mockTabsCreate).toHaveBeenCalled();
    });

    const url = mockTabsCreate.mock.calls[0][0].url;
    expect(url).toContain(encodeURIComponent('...[truncated]'));
  });

  it('uses stored AI preference in fallback path', async () => {
    mockSendMessage.mockRejectedValue(new Error('CSP blocked'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'claude', pageContext: true, openMode: 'tab' });
    });

    clickHandler(
      { menuItemId: 'ask-ai', selectionText: 'some text' },
      { id: 1, title: 'My Page', url: 'https://secure.bank.com' }
    );

    await vi.waitFor(() => {
      expect(mockTabsCreate).toHaveBeenCalled();
    });

    const url = mockTabsCreate.mock.calls[0][0].url;
    expect(url).toContain('claude.ai');
    expect(url).toContain(encodeURIComponent('My Page'));
  });

  it('includes page context in fallback when pageContext is true', async () => {
    mockSendMessage.mockRejectedValue(new Error('CSP blocked'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'chatgpt', pageContext: true, openMode: 'tab' });
    });

    clickHandler(
      { menuItemId: 'ask-ai', selectionText: 'hello' },
      { id: 1, title: 'Test Page', url: 'https://example.com' }
    );

    await vi.waitFor(() => {
      expect(mockTabsCreate).toHaveBeenCalled();
    });

    const url = mockTabsCreate.mock.calls[0][0].url;
    expect(url).toContain(encodeURIComponent('From:'));
    expect(url).toContain(encodeURIComponent('Test Page'));
  });

  it('excludes page context in fallback when pageContext is false', async () => {
    mockSendMessage.mockRejectedValue(new Error('CSP blocked'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'chatgpt', pageContext: false, openMode: 'tab' });
    });

    clickHandler(
      { menuItemId: 'ask-ai', selectionText: 'hello' },
      { id: 1, title: 'Test Page', url: 'https://example.com' }
    );

    await vi.waitFor(() => {
      expect(mockTabsCreate).toHaveBeenCalled();
    });

    const url = mockTabsCreate.mock.calls[0][0].url;
    expect(url).not.toContain(encodeURIComponent('From:'));
  });

  it('opens base URL for very long prompts exceeding 12000 char URL limit', async () => {
    mockSendMessage.mockRejectedValue(new Error('CSP blocked'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'chatgpt', pageContext: false, openMode: 'tab' });
    });

    const text = 'a'.repeat(6000);
    clickHandler(
      { menuItemId: 'ask-ai', selectionText: text },
      { id: 1, title: 'Page', url: 'https://example.com' }
    );

    await vi.waitFor(() => {
      expect(mockTabsCreate).toHaveBeenCalled();
    });

    const createdUrl = mockTabsCreate.mock.calls[0][0].url;
    expect(createdUrl.startsWith('https://chatgpt.com/')).toBe(true);
  });

  it('defaults openMode to popup when not stored', async () => {
    mockSendMessage.mockRejectedValue(new Error('no content script'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'chatgpt', pageContext: false });
    });
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 0, top: 0, width: 800 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 99 });
    });

    clickHandler(
      { menuItemId: 'ask-ai', selectionText: 'test' },
      { id: 1, title: 'P', url: 'https://x.com' }
    );

    await vi.waitFor(() => {
      expect(mockWindowsCreate).toHaveBeenCalled();
    });

    expect(mockTabsCreate).not.toHaveBeenCalled();
  });
});

describe('message handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.runtime.lastError = null;
    resetPopupWindowId();
  });

  it('opens popup window for OPEN_AI_TAB with default openMode', () => {
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 0, top: 0, width: 1000 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 10 });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=test' });

    expect(mockWindowsGetCurrent).toHaveBeenCalled();
    expect(mockWindowsCreate).toHaveBeenCalled();
    const opts = mockWindowsCreate.mock.calls[0][0];
    expect(opts.url).toBe('https://chatgpt.com/?q=test');
    expect(opts.type).toBe('popup');
    expect(opts.width).toBe(420);
    expect(opts.height).toBe(650);
  });

  it('opens tab for OPEN_AI_TAB when openMode is tab', () => {
    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=test', openMode: 'tab' });
    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://chatgpt.com/?q=test' });
    expect(mockWindowsCreate).not.toHaveBeenCalled();
  });

  it('opens popup window for COPY_AND_OPEN with default openMode', () => {
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 0, top: 0, width: 800 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 20 });
    });

    messageHandler({ type: 'COPY_AND_OPEN', url: 'https://claude.ai/new' });

    expect(mockWindowsCreate).toHaveBeenCalled();
    expect(mockWindowsCreate.mock.calls[0][0].url).toBe('https://claude.ai/new');
  });

  it('opens tab for COPY_AND_OPEN when openMode is tab', () => {
    messageHandler({ type: 'COPY_AND_OPEN', url: 'https://claude.ai/new', openMode: 'tab' });
    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://claude.ai/new' });
  });

  it('ignores unknown message types', () => {
    messageHandler({ type: 'UNKNOWN' });
    expect(mockTabsCreate).not.toHaveBeenCalled();
    expect(mockWindowsCreate).not.toHaveBeenCalled();
  });

  it('rejects OPEN_AI_TAB with non-allowed URL', () => {
    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://evil.com/phishing' });
    expect(mockTabsCreate).not.toHaveBeenCalled();
    expect(mockWindowsCreate).not.toHaveBeenCalled();
  });

  it('rejects COPY_AND_OPEN with non-allowed URL', () => {
    messageHandler({ type: 'COPY_AND_OPEN', url: 'https://malicious.site/' });
    expect(mockTabsCreate).not.toHaveBeenCalled();
    expect(mockWindowsCreate).not.toHaveBeenCalled();
  });

  it('rejects OPEN_AI_TAB with missing URL', () => {
    messageHandler({ type: 'OPEN_AI_TAB' });
    expect(mockTabsCreate).not.toHaveBeenCalled();
    expect(mockWindowsCreate).not.toHaveBeenCalled();
  });
});

describe('popup window creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.runtime.lastError = null;
    resetPopupWindowId();
  });

  it('creates popup with correct dimensions', () => {
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 100, top: 50, width: 1200 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 1 });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=hi', openMode: 'popup' });

    const createOpts = mockWindowsCreate.mock.calls[0][0];
    expect(createOpts.width).toBe(420);
    expect(createOpts.height).toBe(650);
    expect(createOpts.type).toBe('popup');
  });

  it('positions popup on right side of current window', () => {
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 100, top: 50, width: 1200 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 1 });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=hi', openMode: 'popup' });

    const createOpts = mockWindowsCreate.mock.calls[0][0];
    expect(createOpts.left).toBe(100 + 1200 - 440);
    expect(createOpts.top).toBe(50 + 80);
  });

  it('falls back to chrome.tabs.create when windows.create fails', () => {
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 0, top: 0, width: 800 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      chrome.runtime.lastError = { message: 'popup creation failed' };
      cb(null);
      chrome.runtime.lastError = null;
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=test', openMode: 'popup' });

    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://chatgpt.com/?q=test' });
  });
});

describe('popup window reuse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.runtime.lastError = null;
    resetPopupWindowId();
  });

  it('reuses existing popup window on second send', () => {
    // First send — creates window
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 0, top: 0, width: 1000 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 42 });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=first', openMode: 'popup' });
    expect(mockWindowsCreate).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    // Second send — should reuse window
    mockWindowsGet.mockImplementation((id, opts, cb) => {
      cb({ id: 42, tabs: [{ id: 100 }] });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=second', openMode: 'popup' });

    expect(mockTabsUpdate).toHaveBeenCalledWith(100, { url: 'https://chatgpt.com/?q=second' });
    expect(mockWindowsUpdate).toHaveBeenCalledWith(42, { focused: true });
    expect(mockWindowsCreate).not.toHaveBeenCalled();
  });

  it('creates new window if tracked window was closed via onRemoved', () => {
    // First send — creates window
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 0, top: 0, width: 1000 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 42 });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=first', openMode: 'popup' });

    vi.clearAllMocks();

    // Simulate window closed
    windowRemovedHandler(42);

    // Next send — should create new window
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 0, top: 0, width: 1000 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 55 });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=third', openMode: 'popup' });

    expect(mockWindowsCreate).toHaveBeenCalled();
    expect(mockWindowsGet).not.toHaveBeenCalled();
  });

  it('creates new window when windows.get returns error for tracked window', () => {
    // First send — creates window
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 0, top: 0, width: 1000 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 42 });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=first', openMode: 'popup' });

    vi.clearAllMocks();

    // Second send — windows.get fails
    mockWindowsGet.mockImplementation((id, opts, cb) => {
      chrome.runtime.lastError = { message: 'window not found' };
      cb(null);
      chrome.runtime.lastError = null;
    });
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 0, top: 0, width: 1000 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 77 });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=second', openMode: 'popup' });

    expect(mockWindowsCreate).toHaveBeenCalled();
  });

  it('ignores removal of untracked windows', () => {
    // Create a popup window first
    mockWindowsGetCurrent.mockImplementation((opts, cb) => {
      cb({ left: 0, top: 0, width: 1000 });
    });
    mockWindowsCreate.mockImplementation((opts, cb) => {
      cb({ id: 42 });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=test', openMode: 'popup' });

    vi.clearAllMocks();

    // Remove a different window
    windowRemovedHandler(999);

    // Next send should still try to reuse window 42
    mockWindowsGet.mockImplementation((id, opts, cb) => {
      cb({ id: 42, tabs: [{ id: 100 }] });
    });

    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=reuse', openMode: 'popup' });
    expect(mockWindowsGet).toHaveBeenCalled();
    expect(mockWindowsCreate).not.toHaveBeenCalled();
  });
});
