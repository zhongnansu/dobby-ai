// Register context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ask-ai',
    title: 'Ask AI',
    contexts: ['selection']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ask-ai') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_POPUP',
      text: info.selectionText
    });
  }
});

// Handle open-tab requests from content script
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'OPEN_AI_TAB') {
    chrome.tabs.create({ url: msg.url });
  }
  if (msg.type === 'COPY_AND_OPEN') {
    chrome.tabs.create({ url: msg.url });
  }
});
