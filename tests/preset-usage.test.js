// tests/preset-usage.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockStorage = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys, cb) => {
        const result = {};
        const keyList = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys : [keys]);
        keyList.forEach((k) => {
          if (mockStorage[k] !== undefined) result[k] = mockStorage[k];
        });
        cb(result);
      }),
      set: vi.fn((data) => {
        Object.assign(mockStorage, data);
      }),
    },
  },
};

// Dynamic import so the module picks up our chrome mock
let buildTypeKey, loadUsageData, recordPresetUsage, getReorderedPresets;

beforeEach(async () => {
  vi.clearAllMocks();
  mockStorage = {};
  // Re-import to reset module-level cache
  vi.resetModules();
  const mod = await import('../src/content/shared/preset-usage.js');
  buildTypeKey = mod.buildTypeKey;
  loadUsageData = mod.loadUsageData;
  recordPresetUsage = mod.recordPresetUsage;
  getReorderedPresets = mod.getReorderedPresets;
});

describe('buildTypeKey', () => {
  it('returns "type:subType" when subType is provided', () => {
    expect(buildTypeKey('code', 'javascript')).toBe('code:javascript');
  });

  it('returns just "type" when subType is null', () => {
    expect(buildTypeKey('default', null)).toBe('default');
  });

  it('returns just "type" when subType is undefined', () => {
    expect(buildTypeKey('error', undefined)).toBe('error');
  });

  it('returns just "type" when subType is empty string', () => {
    expect(buildTypeKey('code', '')).toBe('code');
  });

  it('handles various type/subType combinations', () => {
    expect(buildTypeKey('foreign', 'japanese')).toBe('foreign:japanese');
    expect(buildTypeKey('code', 'python')).toBe('code:python');
  });
});

describe('loadUsageData', () => {
  it('populates cache from chrome.storage', () => {
    mockStorage.presetUsage = {
      'code:javascript': { 'Debug this': 10 },
    };

    loadUsageData();

    // Verify cache is populated by checking getReorderedPresets behavior
    const presets = [
      { label: 'Debug this', instruction: 'Debug' },
      { label: 'Explain', instruction: 'Explain' },
    ];
    const result = getReorderedPresets(presets, 'code:javascript');
    // 10 >= 5, so reordering should happen
    expect(result[0].label).toBe('Debug this');
  });

  it('sets empty cache when storage has no presetUsage', () => {
    loadUsageData();

    const presets = [
      { label: 'Summarize', instruction: 'Summarize' },
      { label: 'Explain', instruction: 'Explain' },
    ];
    const result = getReorderedPresets(presets, 'default');
    // No usage data => returns original
    expect(result).toBe(presets);
  });

  it('handles storage returning empty object gracefully', () => {
    mockStorage = {};
    loadUsageData();

    const presets = [{ label: 'Test', instruction: 'Test' }];
    const result = getReorderedPresets(presets, 'default');
    expect(result).toBe(presets);
  });
});

describe('recordPresetUsage', () => {
  it('increments count and persists to chrome.storage', () => {
    recordPresetUsage('code:javascript', 'Debug this');

    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    const saved = chrome.storage.local.set.mock.calls[0][0];
    expect(saved.presetUsage['code:javascript']['Debug this']).toBe(1);
  });

  it('increments existing count', () => {
    recordPresetUsage('default', 'Summarize');
    recordPresetUsage('default', 'Summarize');
    recordPresetUsage('default', 'Summarize');

    const saved = chrome.storage.local.set.mock.calls[2][0];
    expect(saved.presetUsage['default']['Summarize']).toBe(3);
  });

  it('tracks separate counts per typeKey', () => {
    recordPresetUsage('code:javascript', 'Debug this');
    recordPresetUsage('code:python', 'Debug this');

    const saved = chrome.storage.local.set.mock.calls[1][0];
    expect(saved.presetUsage['code:javascript']['Debug this']).toBe(1);
    expect(saved.presetUsage['code:python']['Debug this']).toBe(1);
  });

  it('tracks separate counts per label within same typeKey', () => {
    recordPresetUsage('default', 'Summarize');
    recordPresetUsage('default', 'Explain');

    const saved = chrome.storage.local.set.mock.calls[1][0];
    expect(saved.presetUsage['default']['Summarize']).toBe(1);
    expect(saved.presetUsage['default']['Explain']).toBe(1);
  });

  it('does nothing when typeKey is empty', () => {
    recordPresetUsage('', 'Summarize');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('does nothing when label is empty', () => {
    recordPresetUsage('default', '');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('does nothing when typeKey is null', () => {
    recordPresetUsage(null, 'Summarize');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('does nothing when label is null', () => {
    recordPresetUsage('default', null);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});

describe('getReorderedPresets', () => {
  it('returns original array when no usage data exists for typeKey', () => {
    const presets = [
      { label: 'Summarize', instruction: 'Summarize' },
      { label: 'Explain', instruction: 'Explain' },
    ];
    const result = getReorderedPresets(presets, 'default');
    expect(result).toBe(presets);
  });

  it('returns original array when usage exists but below threshold (< 5)', () => {
    // Record 4 clicks — below threshold
    recordPresetUsage('default', 'Explain');
    recordPresetUsage('default', 'Explain');
    recordPresetUsage('default', 'Explain');
    recordPresetUsage('default', 'Explain');

    const presets = [
      { label: 'Summarize', instruction: 'Summarize' },
      { label: 'Explain', instruction: 'Explain' },
    ];
    const result = getReorderedPresets(presets, 'default');
    // 4 < 5, so no reordering
    expect(result).toBe(presets);
  });

  it('reorders by frequency at threshold (exactly 5 clicks)', () => {
    for (let i = 0; i < 5; i++) {
      recordPresetUsage('default', 'Explain');
    }

    const presets = [
      { label: 'Summarize', instruction: 'Summarize' },
      { label: 'Explain', instruction: 'Explain' },
    ];
    const result = getReorderedPresets(presets, 'default');
    expect(result[0].label).toBe('Explain');
    expect(result[1].label).toBe('Summarize');
  });

  it('reorders by frequency above threshold', () => {
    for (let i = 0; i < 12; i++) {
      recordPresetUsage('code:javascript', 'Debug this');
    }
    for (let i = 0; i < 3; i++) {
      recordPresetUsage('code:javascript', 'Explain this JavaScript');
    }

    const presets = [
      { label: 'Explain this JavaScript', instruction: 'Explain' },
      { label: 'Debug this', instruction: 'Debug' },
      { label: 'Convert to TypeScript', instruction: 'Convert' },
    ];
    const result = getReorderedPresets(presets, 'code:javascript');
    expect(result[0].label).toBe('Debug this');
    expect(result[1].label).toBe('Explain this JavaScript');
    expect(result[2].label).toBe('Convert to TypeScript');
  });

  it('maintains original order on ties (stable sort)', () => {
    // Give both presets the same count (>= 5)
    for (let i = 0; i < 5; i++) {
      recordPresetUsage('default', 'Summarize');
      recordPresetUsage('default', 'Explain');
    }

    const presets = [
      { label: 'Summarize', instruction: 'Summarize' },
      { label: 'Explain', instruction: 'Explain' },
    ];
    const result = getReorderedPresets(presets, 'default');
    // Both have count 5 — stable sort preserves original order
    expect(result[0].label).toBe('Summarize');
    expect(result[1].label).toBe('Explain');
  });

  it('never mutates the input array', () => {
    for (let i = 0; i < 10; i++) {
      recordPresetUsage('default', 'Explain');
    }

    const presets = [
      { label: 'Summarize', instruction: 'Summarize' },
      { label: 'Explain', instruction: 'Explain' },
    ];
    const originalOrder = [...presets];
    const result = getReorderedPresets(presets, 'default');

    // Result is a different array
    expect(result).not.toBe(presets);
    // Original was not mutated
    expect(presets[0].label).toBe(originalOrder[0].label);
    expect(presets[1].label).toBe(originalOrder[1].label);
  });

  it('returns original array reference when below threshold (not a copy)', () => {
    const presets = [
      { label: 'Summarize', instruction: 'Summarize' },
      { label: 'Explain', instruction: 'Explain' },
    ];
    const result = getReorderedPresets(presets, 'nonexistent');
    // Same reference — no copy needed when no reordering
    expect(result).toBe(presets);
  });

  it('handles presets with labels not in usage data', () => {
    for (let i = 0; i < 7; i++) {
      recordPresetUsage('default', 'Summarize');
    }

    const presets = [
      { label: 'Brand new preset', instruction: 'New' },
      { label: 'Summarize', instruction: 'Summarize' },
      { label: 'Also new', instruction: 'Also new' },
    ];
    const result = getReorderedPresets(presets, 'default');
    // Summarize (7) should be first, others (0) maintain relative order
    expect(result[0].label).toBe('Summarize');
  });
});
