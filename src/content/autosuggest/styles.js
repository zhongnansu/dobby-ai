// src/content/autosuggest/styles.js — CSS-in-JS styles for autosuggest ghost text overlay
import { AUTOSUGGEST } from '../shared/constants.js';

export function getGhostTextStyles() {
  return `
    :host {
      position: absolute;
      pointer-events: none;
      z-index: 2147483640;
      overflow: hidden;
    }
    .ghost-container {
      position: relative;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .ghost-mirror {
      visibility: hidden;
    }
    .ghost-text {
      color: ${AUTOSUGGEST.GHOST_COLOR};
      opacity: ${AUTOSUGGEST.GHOST_OPACITY};
    }
  `;
}
