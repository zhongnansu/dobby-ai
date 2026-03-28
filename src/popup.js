const toggle = document.getElementById('enabled');
const status = document.getElementById('status');
const settingsLink = document.getElementById('settings');

chrome.storage.local.get('dobbyEnabled', (data) => {
  const enabled = data.dobbyEnabled !== false; // default: enabled
  toggle.checked = enabled;
  status.textContent = enabled ? 'Enabled' : 'Disabled';
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ dobbyEnabled: enabled });
  status.textContent = enabled ? 'Enabled' : 'Disabled';
  // Notify content-script tabs (filter to http/https to avoid chrome:// errors)
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'DOBBY_TOGGLE', enabled }).catch(() => {});
    });
  });
});

settingsLink.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Autosuggest toggle
const autosuggestToggle = document.getElementById('autosuggest-enabled');
const autosuggestStatus = document.getElementById('autosuggest-status');

chrome.storage.local.get('autosuggestEnabled', (data) => {
  const enabled = data.autosuggestEnabled === true; // default: disabled
  autosuggestToggle.checked = enabled;
});

autosuggestToggle.addEventListener('change', () => {
  const enabled = autosuggestToggle.checked;
  chrome.storage.local.set({ autosuggestEnabled: enabled });
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'AUTOSUGGEST_TOGGLE', enabled }).catch(() => {});
    });
  });
});
