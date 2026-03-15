// tests/popup.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

let storageGetCallback;

// Set up DOM elements before importing popup.js
document.body.innerHTML = `
  <input type="checkbox" id="enabled" />
  <span id="status"></span>
  <a id="settings" href="#">Settings</a>
`;

global.chrome = {
  storage: {
    local: {
      get: vi.fn((key, cb) => { storageGetCallback = cb; }),
      set: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn((q, cb) => cb([])),
    sendMessage: vi.fn(() => Promise.resolve()),
  },
  runtime: {
    openOptionsPage: vi.fn(),
  },
};

await import('../popup.js');

const toggle = document.getElementById('enabled');
const status = document.getElementById('status');
const settingsLink = document.getElementById('settings');

describe('popup.js', () => {
  describe('initial state', () => {
    it('loads enabled state from storage (default enabled)', () => {
      // Trigger the storage callback with empty data (default = enabled)
      storageGetCallback({});
      expect(toggle.checked).toBe(true);
      expect(status.textContent).toBe('Enabled');
    });

    it('loads disabled state from storage when explicitly disabled', () => {
      storageGetCallback({ dobbyEnabled: false });
      expect(toggle.checked).toBe(false);
      expect(status.textContent).toBe('Disabled');
    });

    it('loads enabled state from storage when explicitly enabled', () => {
      storageGetCallback({ dobbyEnabled: true });
      expect(toggle.checked).toBe(true);
      expect(status.textContent).toBe('Enabled');
    });
  });

  describe('toggle change', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Re-mock tabs.query so it provides tabs
      chrome.tabs.query.mockImplementation((q, cb) => cb([]));
      chrome.tabs.sendMessage.mockReturnValue(Promise.resolve());
    });

    it('updates status text to Disabled when unchecked', () => {
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      expect(status.textContent).toBe('Disabled');
    });

    it('updates status text to Enabled when checked', () => {
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      expect(status.textContent).toBe('Enabled');
    });

    it('calls chrome.storage.local.set with correct value', () => {
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ dobbyEnabled: true });

      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ dobbyEnabled: false });
    });

    it('broadcasts DOBBY_TOGGLE message to all http/https tabs', () => {
      const mockTabs = [{ id: 1 }, { id: 2 }];
      chrome.tabs.query.mockImplementation((q, cb) => cb(mockTabs));

      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));

      expect(chrome.tabs.query).toHaveBeenCalledWith(
        { url: ['http://*/*', 'https://*/*'] },
        expect.any(Function),
      );
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'DOBBY_TOGGLE', enabled: true });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { type: 'DOBBY_TOGGLE', enabled: true });
    });
  });

  describe('settings link', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('opens options page when clicked', () => {
      settingsLink.click();
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });
  });
});
