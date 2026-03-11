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
      // Uses stored AI preference and page context toggle
      chrome.storage.local.get(['lastAI', 'pageContext'], (stored) => {
        const ai = stored.lastAI || 'chatgpt';
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
          chrome.tabs.create({ url: baseUrls[ai] });
        } else {
          chrome.tabs.create({ url: fullUrl });
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
  if (msg.type === 'OPEN_AI_TAB' && isAllowedUrl(msg.url)) {
    chrome.tabs.create({ url: msg.url });
  }
  if (msg.type === 'COPY_AND_OPEN' && isAllowedUrl(msg.url)) {
    chrome.tabs.create({ url: msg.url });
  }
});
