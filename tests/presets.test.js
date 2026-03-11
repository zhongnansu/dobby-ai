import { PRESETS, COMMON_PRESETS, getAllPresetsForType } from '../presets.js';

describe('PRESETS structure', () => {
  const expectedTypes = ['code', 'foreign', 'long', 'default'];

  it('has all four content types', () => {
    for (const type of expectedTypes) {
      expect(PRESETS[type]).toBeDefined();
    }
  });

  it('each type has a suggested array with at least one preset', () => {
    for (const type of expectedTypes) {
      expect(Array.isArray(PRESETS[type].suggested)).toBe(true);
      expect(PRESETS[type].suggested.length).toBeGreaterThan(0);
    }
  });

  it('each type has an all array', () => {
    for (const type of expectedTypes) {
      expect(Array.isArray(PRESETS[type].all)).toBe(true);
    }
  });

  it('every preset has label and instruction strings', () => {
    for (const type of expectedTypes) {
      for (const preset of [...PRESETS[type].suggested, ...PRESETS[type].all]) {
        expect(typeof preset.label).toBe('string');
        expect(preset.label.length).toBeGreaterThan(0);
        expect(typeof preset.instruction).toBe('string');
        expect(preset.instruction.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('COMMON_PRESETS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(COMMON_PRESETS)).toBe(true);
    expect(COMMON_PRESETS.length).toBeGreaterThan(0);
  });

  it('every entry has label and instruction strings', () => {
    for (const preset of COMMON_PRESETS) {
      expect(typeof preset.label).toBe('string');
      expect(preset.label.length).toBeGreaterThan(0);
      expect(typeof preset.instruction).toBe('string');
      expect(preset.instruction.length).toBeGreaterThan(0);
    }
  });
});

describe('getAllPresetsForType', () => {
  it('returns type-specific all presets plus deduplicated common presets for code', () => {
    const result = getAllPresetsForType('code');
    const labels = result.map(p => p.label);
    expect(labels).toContain('Add types');
    expect(labels).toContain('Write tests');
    expect(labels).toContain('Rewrite');
    expect(labels).toContain('Expand');
    expect(labels).not.toContain('Explain code');
    expect(labels).not.toContain('Debug this');
    expect(labels).not.toContain('Optimize');
  });

  it('deduplicates common presets against suggested for foreign type', () => {
    const result = getAllPresetsForType('foreign');
    const labels = result.map(p => p.label);
    expect(labels).not.toContain('Translate');
    expect(labels).toContain('Summarize');
    expect(labels).toContain('Rewrite');
    expect(labels).toContain('Expand');
    expect(labels).toContain('Key points');
  });

  it('deduplicates common presets against suggested for long type', () => {
    const result = getAllPresetsForType('long');
    const labels = result.map(p => p.label);
    expect(labels).not.toContain('Summarize');
    expect(labels).not.toContain('Key points');
    expect(labels).toContain('Explain');
    expect(labels).toContain('Translate');
    expect(labels).toContain('Rewrite');
    expect(labels).toContain('Expand');
  });

  it('deduplicates common presets against suggested for default type', () => {
    const result = getAllPresetsForType('default');
    const labels = result.map(p => p.label);
    expect(labels).not.toContain('Summarize');
    expect(labels).toContain('Explain');
    expect(labels).toContain('Translate');
    expect(labels).toContain('Rewrite');
  });

  it('has no duplicate labels in the returned array', () => {
    for (const type of ['code', 'foreign', 'long', 'default']) {
      const result = getAllPresetsForType(type);
      const labels = result.map(p => p.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('throws when given an invalid content type', () => {
    expect(() => getAllPresetsForType('invalid')).toThrow();
  });
});
