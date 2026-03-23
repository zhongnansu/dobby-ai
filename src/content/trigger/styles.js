// src/content/trigger/styles.js — CSS-in-JS styles for toolbar (Shadow DOM)
import { THEME } from '../shared/constants.js';

export function getToolbarStyles(theme) {
  const isDark = theme === 'dark';
  const accent = THEME.ACCENT;
  const accentLight = THEME.ACCENT_LIGHT;
  const fontStack = THEME.FONT_STACK;

  return `
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .toolbar {
      position: relative;
      font-family: ${fontStack};
      display: flex;
      flex-direction: column;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      overflow: hidden;
      background: ${isDark ? 'rgba(28, 25, 38, 0.82)' : 'rgba(255, 255, 255, 0.82)'};
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'};
      box-shadow: 0 2px 12px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)'};
      cursor: pointer;
      user-select: none;
      transition: width 0.22s cubic-bezier(0.4,0,0.2,1),
                  height 0.25s cubic-bezier(0.4,0,0.2,1),
                  border-radius 0.22s cubic-bezier(0.4,0,0.2,1);
    }

    .toolbar.expanded {
      width: var(--toolbar-expanded-width, 260px);
      height: 36px;
      border-radius: 18px;
      overflow: visible;
    }


    .toolbar-row {
      display: flex;
      align-items: center;
      height: 36px;
      min-height: 36px;
      flex-shrink: 0;
    }

    .toolbar-icon {
      width: 36px;
      height: 36px;
      min-width: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .toolbar-icon img {
      width: 28px;
      height: 28px;
      display: block;
    }


    .toolbar-expand {
      display: flex;
      align-items: center;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
      white-space: nowrap;
      padding-right: 4px;
    }

    .toolbar.expanded .toolbar-expand {
      opacity: 1;
      pointer-events: auto;
    }

    .toolbar-sep {
      width: 1px;
      height: 18px;
      background: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'};
      flex-shrink: 0;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .toolbar-action {
      background: none;
      border: none;
      color: ${isDark ? '#e4e4e7' : '#18181b'};
      font-size: 12px;
      font-family: ${fontStack};
      padding: 4px 8px;
      border-radius: 8px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }

    .toolbar-action:hover {
      background: ${isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.1)'};
    }

    .toolbar-more {
      background: none;
      border: none;
      color: ${isDark ? '#a1a1aa' : '#52525b'};
      font-size: 16px;
      line-height: 1;
      min-width: 28px;
      height: 28px;
      padding: 4px 6px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    .toolbar-more:hover {
      background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
    }

    .toolbar-popover {
      display: none;
      position: absolute;
      bottom: calc(100% + 6px);
      left: 0;
      min-width: 180px;
      max-height: 260px;
      overflow-y: auto;
      background: ${isDark ? 'rgba(30, 30, 40, 0.92)' : 'rgba(255, 255, 255, 0.92)'};
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'};
      border-radius: 10px;
      box-shadow: 0 4px 16px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)'};
      padding: 4px 0;
      z-index: 10;
    }

    .toolbar-popover.open {
      display: block;
    }

    .toolbar-popover.popover-below {
      bottom: auto;
      top: calc(100% + 6px);
    }

    .toolbar-popover-item {
      display: block;
      width: 100%;
      background: none;
      border: none;
      color: ${isDark ? '#e4e4e7' : '#18181b'};
      font-size: 12px;
      font-family: ${fontStack};
      padding: 7px 14px;
      cursor: pointer;
      text-align: left;
      transition: background 0.15s;
    }

    .toolbar-popover-item:hover {
      background: ${isDark ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.08)'};
    }

    .toolbar-popover-item.custom-prompt {
      border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
      color: ${isDark ? accentLight : accent};
      font-weight: 500;
    }

  `;
}
