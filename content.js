// Placeholder — will be built out in subsequent PRs
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_POPUP') {
    console.log('[Ask AI] Context menu triggered with text:', msg.text.substring(0, 50));
  }
});
