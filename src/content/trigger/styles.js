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

    .toolbar.morphed {
      width: 360px;
      height: 210px;
      border-radius: 14px;
      overflow: visible;
      cursor: default;
      background: ${isDark ? 'rgba(28, 25, 38, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
      box-shadow: 0 4px 24px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)'}, 0 0 0 1px ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'};
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

    .toolbar.morphed .toolbar-icon {
      width: 32px;
      min-width: 32px;
      height: 32px;
      margin-left: 6px;
    }

    .toolbar.morphed .toolbar-icon img {
      width: 26px;
      height: 26px;
    }

    .toolbar.morphed .toolbar-row {
      width: 100%;
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

    .toolbar.morphed .toolbar-expand {
      display: none;
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

    .morph-header {
      display: none;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
      padding-right: 8px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .toolbar.morphed .morph-header {
      display: flex;
      opacity: 1;
    }

    .toolbar.morphed .toolbar-row {
      border-bottom: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};
      padding: 0 4px;
    }

    .morph-title {
      font-weight: 700;
      font-size: 13px;
      color: ${isDark ? accentLight : accent};
      white-space: nowrap;
    }

    .morph-label {
      font-size: 11px;
      font-weight: 600;
      color: ${isDark ? accentLight : accent};
      background: ${isDark ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.1)'};
      padding: 2px 8px;
      border-radius: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }

    .morph-close {
      background: none;
      border: none;
      color: ${isDark ? '#a1a1aa' : '#71717a'};
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: auto;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    .morph-close:hover {
      background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
    }

    .morph-body {
      display: none;
      flex: 1;
      overflow-y: auto;
      padding: 10px 14px;
      font-size: 13px;
      line-height: 1.6;
      color: ${isDark ? '#e4e4e7' : '#333'};
    }

    .toolbar.morphed .morph-body {
      display: block;
    }

    .stream-text {
      word-break: break-word;
    }

    .stream-text code {
      background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
      padding: 1px 4px;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 12px;
    }

    .stream-text pre {
      background: ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)'};
      padding: 8px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 6px 0;
    }

    .stream-text pre code { background: none; padding: 0; }
    .stream-text strong { font-weight: 600; }

    .typing-cursor {
      display: inline-block;
      width: 2px;
      height: 13px;
      background: ${isDark ? accentLight : accent};
      margin-left: 2px;
      vertical-align: text-bottom;
      animation: blink 1s step-end infinite;
    }

    .typing-cursor.hidden { display: none; }

    @keyframes blink { 50% { opacity: 0; } }

    .morph-error {
      color: #ef4444;
      font-size: 12px;
      padding: 8px 0;
    }
  `;
}
