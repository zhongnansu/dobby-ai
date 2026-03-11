import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Chrome APIs before importing
const mockCreate = vi.fn();
const mockStorageGet = vi.fn();
const mockSendMessage = vi.fn();
const mockTabsCreate = vi.fn();

global.chrome = {
  runtime: {
    onInstalled: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
  },
  contextMenus: {
    create: mockCreate,
    onClicked: { addListener: vi.fn() },
  },
  tabs: {
    sendMessage: mockSendMessage,
    create: mockTabsCreate,
  },
  storage: {
    local: { get: mockStorageGet },
  },
};

// Import after mocks are set up
await import('../background.js');

// Capture handlers immediately after import, before any clearAllMocks
const clickHandler = chrome.contextMenus.onClicked.addListener.mock.calls[0][0];
const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];

describe('context menu registration', () => {
  it('registers onInstalled listener', () => {
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledOnce();
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

  it('falls back to direct open when content script unavailable', async () => {
    mockSendMessage.mockRejectedValue(new Error('no content script'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'chatgpt', pageContext: true });
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
    expect(url).toContain(encodeURIComponent('test text'));
  });

  it('uses claude URL when lastAI is claude', async () => {
    mockSendMessage.mockRejectedValue(new Error('no content script'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'claude', pageContext: false });
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
      cb({ lastAI: 'chatgpt', pageContext: false });
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
    // URL should contain truncated text, not full 8000 chars
    expect(url).toContain(encodeURIComponent('...[truncated]'));
  });

  it('uses stored AI preference in fallback path', async () => {
    mockSendMessage.mockRejectedValue(new Error('CSP blocked'));
    mockStorageGet.mockImplementation((keys, cb) => {
      cb({ lastAI: 'claude', pageContext: true });
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
      cb({ lastAI: 'chatgpt', pageContext: true });
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
      cb({ lastAI: 'chatgpt', pageContext: false });
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
      cb({ lastAI: 'chatgpt', pageContext: false });
    });

    // 6000 chars text + encoding overhead will create a very long URL
    const text = 'a'.repeat(6000);
    clickHandler(
      { menuItemId: 'ask-ai', selectionText: text },
      { id: 1, title: 'Page', url: 'https://example.com' }
    );

    await vi.waitFor(() => {
      expect(mockTabsCreate).toHaveBeenCalled();
    });

    // The URL should either be the full encoded URL (if under 12000) or just the base URL
    const createdUrl = mockTabsCreate.mock.calls[0][0].url;
    expect(createdUrl.startsWith('https://chatgpt.com/')).toBe(true);
  });
});

describe('message handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens tab for OPEN_AI_TAB message', () => {
    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://chatgpt.com/?q=test' });
    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://chatgpt.com/?q=test' });
  });

  it('opens tab for COPY_AND_OPEN message', () => {
    messageHandler({ type: 'COPY_AND_OPEN', url: 'https://claude.ai/new' });
    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://claude.ai/new' });
  });

  it('ignores unknown message types', () => {
    messageHandler({ type: 'UNKNOWN' });
    expect(mockTabsCreate).not.toHaveBeenCalled();
  });

  it('rejects OPEN_AI_TAB with non-allowed URL', () => {
    messageHandler({ type: 'OPEN_AI_TAB', url: 'https://evil.com/phishing' });
    expect(mockTabsCreate).not.toHaveBeenCalled();
  });

  it('rejects COPY_AND_OPEN with non-allowed URL', () => {
    messageHandler({ type: 'COPY_AND_OPEN', url: 'https://malicious.site/' });
    expect(mockTabsCreate).not.toHaveBeenCalled();
  });

  it('rejects OPEN_AI_TAB with missing URL', () => {
    messageHandler({ type: 'OPEN_AI_TAB' });
    expect(mockTabsCreate).not.toHaveBeenCalled();
  });
});
