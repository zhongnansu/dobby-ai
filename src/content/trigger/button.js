// src/content/trigger/button.js — Trigger button creation and visibility

import { triggerButton, setTriggerButton } from '../shared/state.js';
import { Z_INDEX, THEME, TIMING } from '../shared/constants.js';
import { showBubbleWithPresets } from '../bubble/core.js';
import { captureImage } from '../image-capture.js';

export function createTriggerButton() {
  if (triggerButton) return;

  // Cockapoo icon as inline SVG data URI
  const cockapooSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="30" r="22" fill="#C4956A"/>
    <circle cx="14" cy="22" r="8" fill="#B8845A"/>
    <circle cx="50" cy="22" r="8" fill="#B8845A"/>
    <circle cx="20" cy="12" r="7" fill="#D4A574"/>
    <circle cx="44" cy="12" r="7" fill="#D4A574"/>
    <circle cx="32" cy="10" r="7" fill="#C4956A"/>
    <circle cx="26" cy="8" r="5" fill="#BF8F60"/>
    <circle cx="38" cy="8" r="5" fill="#BF8F60"/>
    <ellipse cx="10" cy="34" rx="7" ry="12" fill="#A07048" transform="rotate(-10 10 34)"/>
    <ellipse cx="54" cy="34" rx="7" ry="12" fill="#A07048" transform="rotate(10 54 34)"/>
    <ellipse cx="32" cy="34" rx="14" ry="11" fill="#E8C9A0"/>
    <circle cx="24" cy="28" r="3.5" fill="#2D1B0E"/>
    <circle cx="40" cy="28" r="3.5" fill="#2D1B0E"/>
    <circle cx="25.2" cy="27" r="1.2" fill="white"/>
    <circle cx="41.2" cy="27" r="1.2" fill="white"/>
    <ellipse cx="32" cy="35" rx="4" ry="3" fill="#2D1B0E"/>
    <ellipse cx="32" cy="34.5" rx="1.5" ry="0.8" fill="#5A3A1E" opacity="0.4"/>
    <path d="M28 38 Q32 42 36 38" fill="none" stroke="#2D1B0E" stroke-width="1.2" stroke-linecap="round"/>
    <ellipse cx="32" cy="41" rx="2.5" ry="3" fill="#E87B7B"/>
  </svg>`;

  const iconDataUri = 'data:image/svg+xml,' + encodeURIComponent(cockapooSvg);

  const btn = document.createElement('div');
  btn.id = 'dobby-ai-trigger';
  const img = document.createElement('img');
  img.src = iconDataUri;
  img.alt = 'Dobby AI';
  Object.assign(img.style, { width: '28px', height: '28px', display: 'block' });
  btn.appendChild(img);

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.setAttribute('data-dobby-tooltip', '');
  tooltip.textContent = 'Hold anywhere for 1s to screenshot';
  Object.assign(tooltip.style, {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '8px',
    background: 'rgba(30,30,30,0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: 'white',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    borderRadius: '6px',
    padding: '6px 12px',
    pointerEvents: 'none',
    opacity: '0',
    visibility: 'hidden',
    transition: 'opacity 0.15s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  });

  // Downward caret
  const caret = document.createElement('div');
  caret.setAttribute('data-dobby-tooltip-caret', '');
  Object.assign(caret.style, {
    position: 'absolute',
    bottom: '-6px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '0',
    height: '0',
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '6px solid rgba(30,30,30,0.85)',
  });
  tooltip.appendChild(caret);
  btn.appendChild(tooltip);

  let tooltipTimer = null;
  btn.addEventListener('mouseenter', () => {
    tooltip.style.opacity = '1';
    tooltip.style.visibility = 'visible';
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
    }, TIMING.TOOLTIP_AUTO_HIDE);
  });
  btn.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
    clearTimeout(tooltipTimer);
  });

  Object.assign(btn.style, {
    position: 'fixed',
    zIndex: String(Z_INDEX.TRIGGER),
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    padding: '4px',
    borderRadius: '50%',
    cursor: 'pointer',
    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    border: '1px solid rgba(0,0,0,0.08)',
    display: 'none',
    userSelect: 'none',
    lineHeight: '0',
  });

  btn.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text) {
      const anchorNode = selection.anchorNode || null;
      const rect = selection.rangeCount > 0
        ? selection.getRangeAt(0).getBoundingClientRect()
        : { bottom: 200, left: 100, right: 300, top: 180 };
      hideTrigger();

      // Extract images from selection range
      let images = [];
      if (selection.rangeCount > 0 && typeof captureImage === 'function') {
        images = await extractImagesFromSelection(selection);
      }

      showBubbleWithPresets(rect, text, anchorNode, images.length > 0 ? images : undefined);
    }
  });

  setTriggerButton(btn);
  document.body.appendChild(btn);
}

export function showTrigger(x, y) {
  createTriggerButton();
  triggerButton.style.display = 'block';
  const buttonWidth = triggerButton.offsetWidth || 36;
  const buttonHeight = triggerButton.offsetHeight || 36;
  const maxLeft = window.innerWidth - buttonWidth - 8;
  const maxTop = window.innerHeight - buttonHeight - 8;
  triggerButton.style.left = `${Math.min(Math.max(8, x + 12), maxLeft)}px`;
  triggerButton.style.top = `${Math.min(Math.max(4, y + 10), maxTop)}px`;
}

export function hideTrigger() {
  if (triggerButton) {
    triggerButton.style.display = 'none';
  }
}

// --- Image extraction from text selection ---

export async function extractImagesFromSelection(selection, maxImages = 2) {
  const images = [];
  if (!selection.rangeCount) return images;

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const imgElements = container.nodeType === Node.ELEMENT_NODE
    ? container.querySelectorAll('img')
    : (container.parentElement ? container.parentElement.querySelectorAll('img') : []);

  for (const imgEl of imgElements) {
    if (images.length >= maxImages) break;
    if (!range.intersectsNode(imgEl)) continue;
    if (!imgEl.src) continue;

    if (typeof captureImage === 'function') {
      const captured = await captureImage(imgEl);
      if (captured) images.push(captured);
    }
  }
  return images;
}
