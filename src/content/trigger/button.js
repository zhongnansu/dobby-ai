// src/content/trigger/button.js — Toolbar creation, expand/collapse, morph-to-chat
// Evolves the original trigger button into a three-state toolbar:
//   collapsed (icon only) → expanded (hover, preset buttons) → morphed (inline chat)

import { getToolbarStyles } from './styles.js';
import { detectTheme } from '../bubble/core.js';
import { requestChat } from '../api.js';
import { buildChatMessages } from '../prompt.js';
import { Z_INDEX, TIMING } from '../shared/constants.js';
import {
  setToolbarHost, setToolbarState, toolbarState,
  popoverOpen, setPopoverOpen,
  triggerButton, setTriggerButton,
} from '../shared/state.js';
import { detectContentType } from '../detection.js';
import { getSuggestedPresetsForType, getAllPresetsForType } from '../presets.js';
import { showBubbleWithPresets } from '../bubble/core.js';
import { captureImage } from '../image-capture.js';

// --- Cockapoo icon SVG ---
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

// --- Auto-hide timer ---
let autoHideTimer = null;

function startAutoHide(host) {
  clearAutoHide();
  autoHideTimer = setTimeout(() => {
    hideTrigger();
  }, TIMING.TOOLBAR_AUTO_HIDE);
}

function clearAutoHide() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

// --- Active stream handle (isolated from shared state) ---
let activeStreamHandle = null;

// --- Toolbar creation ---

function createToolbar() {
  const host = document.createElement('div');
  host.id = 'dobby-ai-toolbar-host';
  Object.assign(host.style, {
    position: 'fixed',
    zIndex: String(Z_INDEX.TRIGGER),
    display: 'none',
    lineHeight: '0',
  });

  const shadow = host.attachShadow({ mode: 'open' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = getToolbarStyles(detectTheme());
  shadow.appendChild(style);

  // Build toolbar DOM
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  // --- Row: icon + expandable actions + morph header ---
  const row = document.createElement('div');
  row.className = 'toolbar-row';

  // Icon
  const iconDiv = document.createElement('div');
  iconDiv.className = 'toolbar-icon';
  const img = document.createElement('img');
  img.src = iconDataUri;
  img.alt = 'Dobby AI';
  iconDiv.appendChild(img);
  row.appendChild(iconDiv);

  // Expandable section (preset actions)
  const expandSection = document.createElement('div');
  expandSection.className = 'toolbar-expand';

  const sep1 = document.createElement('div');
  sep1.className = 'toolbar-sep';
  expandSection.appendChild(sep1);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'toolbar-actions';
  expandSection.appendChild(actionsDiv);

  const sep2 = document.createElement('div');
  sep2.className = 'toolbar-sep';
  expandSection.appendChild(sep2);

  const moreBtn = document.createElement('button');
  moreBtn.className = 'toolbar-more';
  moreBtn.textContent = '\u2026'; // ellipsis
  moreBtn.title = 'More actions';
  expandSection.appendChild(moreBtn);

  row.appendChild(expandSection);

  // Morph header (visible in morphed state, hidden otherwise)
  const morphHeader = document.createElement('div');
  morphHeader.className = 'morph-header';

  const morphTitle = document.createElement('span');
  morphTitle.className = 'morph-title';
  morphTitle.textContent = 'Dobby AI';
  morphHeader.appendChild(morphTitle);

  const morphLabel = document.createElement('span');
  morphLabel.className = 'morph-label';
  morphHeader.appendChild(morphLabel);

  const morphClose = document.createElement('button');
  morphClose.className = 'morph-close';
  morphClose.textContent = '\u2715';
  morphClose.title = 'Close';
  morphHeader.appendChild(morphClose);

  row.appendChild(morphHeader);

  toolbar.appendChild(row);

  // Morph body (visible in morphed state)
  const morphBody = document.createElement('div');
  morphBody.className = 'morph-body';

  const streamText = document.createElement('div');
  streamText.className = 'stream-text';
  morphBody.appendChild(streamText);

  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  morphBody.appendChild(cursor);

  toolbar.appendChild(morphBody);

  shadow.appendChild(toolbar);

  // Popover (rendered outside toolbar for positioning)
  const popover = document.createElement('div');
  popover.className = 'toolbar-popover';
  toolbar.appendChild(popover);

  // --- Event handlers ---
  toolbar.addEventListener('mouseenter', () => {
    clearAutoHide();
    if (toolbarState === 'collapsed') {
      expandToolbar(host, shadow);
    }
  });

  toolbar.addEventListener('mouseleave', () => {
    if (toolbarState === 'expanded' && !popoverOpen) {
      collapseToolbar(shadow);
      startAutoHide(host);
    }
    // If morphed, do not collapse
  });

  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover(host, shadow);
  });

  morphClose.addEventListener('click', (e) => {
    e.stopPropagation();
    unmorphToolbar(host, shadow);
  });

  document.body.appendChild(host);
  setToolbarHost(host);
  // Also set triggerButton for backwards compat with selection.js hide logic
  setTriggerButton(host);

  return host;
}

// --- Expand / Collapse ---

function expandToolbar(host, shadow) {
  const toolbar = shadow.querySelector('.toolbar');
  const actionsDiv = shadow.querySelector('.toolbar-actions');

  // Lazily detect content type
  const text = host._selectedText || '';
  const anchorNode = host._anchorNode || null;
  const detected = detectContentType(text, anchorNode);
  let presets = getSuggestedPresetsForType(detected.type, detected.subType);

  // Store detected info for popover
  host._detectedType = detected.type;
  host._detectedSubType = detected.subType;

  // Fallback if 0 presets
  if (!presets || presets.length === 0) {
    presets = [
      { label: 'Summarize', instruction: 'Summarize the following' },
      { label: 'Explain', instruction: 'Explain the following in simple terms' },
    ];
  }

  // Clear old actions
  actionsDiv.innerHTML = '';

  // Show first 2 presets
  const shownPresets = presets.slice(0, 2);
  shownPresets.forEach((preset) => {
    const btn = document.createElement('button');
    btn.className = 'toolbar-action';
    btn.textContent = preset.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      morphIntoBubble(host, shadow, preset.label, preset.instruction);
    });
    actionsDiv.appendChild(btn);
  });

  toolbar.classList.add('expanded');
  setToolbarState('expanded');
}

function collapseToolbar(shadow) {
  const toolbar = shadow.querySelector('.toolbar');
  toolbar.classList.remove('expanded');
  closePopover(shadow);
  setToolbarState('collapsed');
}

// --- Morph into chat ---

function morphIntoBubble(host, shadow, label, instruction) {
  const toolbar = shadow.querySelector('.toolbar');

  // Close popover if open
  closePopover(shadow);

  // Transition from expanded to morphed
  toolbar.classList.remove('expanded');
  toolbar.classList.add('morphed');
  setToolbarState('morphed');
  clearAutoHide();

  // Set label
  const morphLabel = shadow.querySelector('.morph-label');
  morphLabel.textContent = label;

  // Clear stream text
  const streamText = shadow.querySelector('.stream-text');
  streamText.innerHTML = '';
  const cursor = shadow.querySelector('.typing-cursor');
  cursor.classList.remove('hidden');

  // Build messages and start streaming
  const text = host._selectedText || '';
  const messages = buildChatMessages(text, instruction, true);

  let responseBuffer = '';

  const handle = requestChat(
    messages,
    // onToken
    (token) => {
      responseBuffer += token;
      streamText.textContent = responseBuffer;
    },
    // onDone
    (info) => {
      cursor.classList.add('hidden');
      activeStreamHandle = null;
    },
    // onError
    (code, msg) => {
      cursor.classList.add('hidden');
      if (code === 'RATE_LIMITED') {
        streamText.innerHTML = '<div class="morph-error">Rate limit reached</div>';
      } else {
        streamText.innerHTML = `<div class="morph-error">${escapeText(msg)}</div>`;
      }
      activeStreamHandle = null;
    }
  );

  activeStreamHandle = handle;
}

function unmorphToolbar(host, shadow) {
  const toolbar = shadow.querySelector('.toolbar');

  // Cancel active stream
  if (activeStreamHandle) {
    activeStreamHandle.cancel();
    activeStreamHandle = null;
  }

  toolbar.classList.remove('morphed');
  setToolbarState('collapsed');

  // Clear stream content
  const streamText = shadow.querySelector('.stream-text');
  streamText.innerHTML = '';
  const cursor = shadow.querySelector('.typing-cursor');
  cursor.classList.remove('hidden');

  // Reset label
  const morphLabel = shadow.querySelector('.morph-label');
  morphLabel.textContent = '';

  // Restart auto-hide
  startAutoHide(host);
}

// --- Popover ---

function togglePopover(host, shadow) {
  const popover = shadow.querySelector('.toolbar-popover');
  if (popoverOpen) {
    closePopover(shadow);
  } else {
    openPopover(host, shadow);
  }
}

function openPopover(host, shadow) {
  const popover = shadow.querySelector('.toolbar-popover');

  const detectedType = host._detectedType || 'default';
  const detectedSubType = host._detectedSubType || null;

  // Get all extra presets (those not shown in toolbar)
  const extraPresets = getAllPresetsForType(detectedType, detectedSubType);

  popover.innerHTML = '';

  extraPresets.forEach((preset) => {
    const item = document.createElement('button');
    item.className = 'toolbar-popover-item';
    item.textContent = preset.label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closePopover(shadow);
      morphIntoBubble(host, shadow, preset.label, preset.instruction);
    });
    popover.appendChild(item);
  });

  // "Custom prompt..." item
  const customItem = document.createElement('button');
  customItem.className = 'toolbar-popover-item custom-prompt';
  customItem.textContent = 'Custom prompt\u2026';
  customItem.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover(shadow);
    const text = host._selectedText || '';
    const anchorNode = host._anchorNode || null;
    // Compute rect from host position
    const hostRect = host.getBoundingClientRect
      ? host.getBoundingClientRect()
      : { top: 200, bottom: 220, left: 100, right: 300 };
    hideTrigger();
    showBubbleWithPresets(hostRect, text, anchorNode);
  });
  popover.appendChild(customItem);

  popover.classList.add('open');
  setPopoverOpen(true);
}

function closePopover(shadow) {
  const popover = shadow.querySelector('.toolbar-popover');
  if (popover) {
    popover.classList.remove('open');
  }
  setPopoverOpen(false);
}

// --- Utility ---

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Public API ---

export function showTrigger(x, y, selectionData = {}) {
  let host = document.getElementById('dobby-ai-toolbar-host');
  if (!host) {
    host = createToolbar();
  }

  // Store selection data on host
  host._selectedText = selectionData.text || '';
  host._anchorNode = selectionData.anchorNode || null;

  // Position
  host.style.display = 'block';
  const hostWidth = 36;
  const hostHeight = 36;
  const maxLeft = window.innerWidth - hostWidth - 8;
  const maxTop = window.innerHeight - hostHeight - 8;
  host.style.left = `${Math.min(Math.max(8, x + 12), maxLeft)}px`;
  host.style.top = `${Math.min(Math.max(4, y + 10), maxTop)}px`;

  // Start auto-hide
  startAutoHide(host);
}

export function hideTrigger() {
  clearAutoHide();

  // Cancel active stream
  if (activeStreamHandle) {
    activeStreamHandle.cancel();
    activeStreamHandle = null;
  }

  const host = document.getElementById('dobby-ai-toolbar-host');
  if (host) {
    host.remove();
  }
  setToolbarHost(null);
  setTriggerButton(null);
  setToolbarState('collapsed');
  setPopoverOpen(false);
}

// --- Legacy compatibility: createTriggerButton maps to showTrigger ---
export function createTriggerButton() {
  // For backwards compat: create toolbar in hidden state
  let host = document.getElementById('dobby-ai-toolbar-host');
  if (!host) {
    host = createToolbar();
  }
}

// --- Image extraction from text selection (preserved from original) ---

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
