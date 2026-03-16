// tests/constants.test.js
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';

const { Z_INDEX, THEME, TIMING } = await import('../constants.js');

describe('constants', () => {
  it('exports Z_INDEX with correct layer ordering', () => {
    expect(Z_INDEX.TRIGGER).toBe(2147483647);
    expect(Z_INDEX.SCREENSHOT_OVERLAY).toBe(2147483646);
    expect(Z_INDEX.BUBBLE).toBe(2147483647);
    expect(Z_INDEX.PROGRESS_RING).toBe(2147483645);
    expect(Z_INDEX.LIGHTBOX).toBe(2147483647);
  });

  it('exports THEME with accent colors', () => {
    expect(THEME.ACCENT).toBe('#7c3aed');
    expect(THEME.ACCENT_LIGHT).toBe('#a78bfa');
    expect(THEME.ACCENT_BG).toContain('124, 58, 237');
    expect(THEME.ACCENT_STRONG).toContain('124, 58, 237');
    expect(THEME.ACCENT_BORDER).toContain('124, 58, 237');
    expect(THEME.FONT_STACK).toContain('apple-system');
    expect(THEME.BACKDROP_BLUR).toBe('blur(12px)');
  });

  it('exports TIMING constants', () => {
    expect(TIMING.LONG_PRESS_DURATION).toBe(1000);
    expect(TIMING.PROGRESS_RING_DELAY).toBe(500);
    expect(TIMING.MOVEMENT_THRESHOLD).toBe(5);
    expect(TIMING.SELECTION_DEBOUNCE).toBe(300);
    expect(TIMING.SCROLL_DEBOUNCE).toBe(150);
    expect(TIMING.RENDER_DEBOUNCE).toBe(50);
    expect(TIMING.TOOLTIP_AUTO_HIDE).toBe(2000);
    expect(TIMING.MOUSEUP_DELAY).toBe(10);
  });
});
