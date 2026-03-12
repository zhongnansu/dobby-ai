// Register context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ask-ai',
    title: 'Ask AI',
    contexts: ['selection']
  });
});

// Constants mirroring prompt.js (background.js can't import content scripts)
const BG_MAX_TEXT_LENGTH = 6000;
const BG_MAX_URL_LENGTH = 12000;

// Popup window tracking
let popupWindowId = null;

// Clear tracked popup when user closes it
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
  }
});

/**
 * Open a URL in the preferred mode: 'popup' window or 'tab'.
 * Falls back to chrome.tabs.create if chrome.windows.create fails.
 */
function openInPreferredMode(url, openMode) {
  if (openMode === 'tab') {
    chrome.tabs.create({ url });
    return;
  }

  // Popup mode: reuse existing popup window if still open
  if (popupWindowId !== null) {
    chrome.windows.get(popupWindowId, { populate: true }, (win) => {
      if (chrome.runtime.lastError || !win) {
        // Window was closed or invalid — create new one
        popupWindowId = null;
        createPopupWindow(url);
      } else {
        // Navigate existing popup's tab
        const tabId = win.tabs && win.tabs[0] && win.tabs[0].id;
        if (tabId) {
          chrome.tabs.update(tabId, { url });
          chrome.windows.update(popupWindowId, { focused: true });
        } else {
          createPopupWindow(url);
        }
      }
    });
    return;
  }

  createPopupWindow(url);
}

function createPopupWindow(url) {
  chrome.windows.getCurrent({}, (currentWindow) => {
    const left = (currentWindow.left || 0) + (currentWindow.width || 800) - 440;
    const top = (currentWindow.top || 0) + 80;

    chrome.windows.create({
      url,
      type: 'popup',
      width: 420,
      height: 650,
      left,
      top,
    }, (win) => {
      if (chrome.runtime.lastError || !win) {
        // Fallback to tab if popup creation fails
        popupWindowId = null;
        chrome.tabs.create({ url });
      } else {
        popupWindowId = win.id;
      }
    });
  });
}

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ask-ai') {
    // Capture selectionText from context menu API — works even when
    // content script is unavailable (CSP-blocked pages, chrome:// pages)
    const selectionText = (info.selectionText || '').trim();
    if (!selectionText) return;

    // Try sending to content script first
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_POPUP',
      text: selectionText
    }).catch(() => {
      // Content script not available (CSP-blocked page) — open directly
      // Uses stored AI preference, page context toggle, and open mode
      chrome.storage.local.get(['lastAI', 'pageContext', 'openMode'], (stored) => {
        const ai = stored.lastAI || 'chatgpt';
        const openMode = stored.openMode || 'popup';
        const baseUrls = {
          chatgpt: 'https://chatgpt.com/',
          claude: 'https://claude.ai/new'
        };

        // Truncate text to MAX_TEXT_LENGTH to match content script behavior
        let text = selectionText;
        if (text.length > BG_MAX_TEXT_LENGTH) {
          text = text.substring(0, BG_MAX_TEXT_LENGTH) + '...[truncated]';
        }

        let prompt = text;
        if (stored.pageContext !== false && tab.title && tab.url) {
          prompt += `\n\nFrom: "${tab.title}" (${tab.url})`;
        }

        const encoded = encodeURIComponent(prompt);
        const fullUrl = `${baseUrls[ai]}?q=${encoded}`;

        if (fullUrl.length > BG_MAX_URL_LENGTH) {
          openInPreferredMode(baseUrls[ai], openMode);
        } else {
          openInPreferredMode(fullUrl, openMode);
        }
      });
    });
  }
});

// Allowed URL prefixes for AI tab requests
const ALLOWED_URL_PREFIXES = ['https://chatgpt.com/', 'https://claude.ai/'];

function isAllowedUrl(url) {
  return typeof url === 'string' && ALLOWED_URL_PREFIXES.some(prefix => url.startsWith(prefix));
}

// Handle open-tab requests from content script
chrome.runtime.onMessage.addListener((msg, sender) => {
  const openMode = msg.openMode || 'popup';
  if (msg.type === 'OPEN_AI_TAB' && isAllowedUrl(msg.url)) {
    openInPreferredMode(msg.url, openMode);
  }
  if (msg.type === 'COPY_AND_OPEN' && isAllowedUrl(msg.url)) {
    openInPreferredMode(msg.url, openMode);
  }
});

// Reset popup window tracking (test helper, no-op in production)
function _resetPopupWindowIdForTesting() {
  popupWindowId = null;
}

// Export for testing (no-op in browser)
if (typeof module !== 'undefined') module.exports = { _resetPopupWindowIdForTesting };
