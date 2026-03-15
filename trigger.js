// trigger.js — Floating "Dobby AI" trigger button
//
// Dependencies (shared global scope via manifest.json content_scripts):
// - showBubbleWithPresets(rect, text, anchorNode) from bubble.js
// - hideBubble() from bubble.js
// - _getBubbleContainer() from bubble.js

let triggerButton = null;
let dobbyEnabled = true;

// Load initial enabled state and listen for toggle from toolbar popup
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.get('dobbyEnabled', (data) => {
    dobbyEnabled = data.dobbyEnabled !== false;
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'DOBBY_TOGGLE') {
      dobbyEnabled = msg.enabled;
      if (!dobbyEnabled) { hideTrigger(); }
    }
  });
}

function createTriggerButton() {
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

  triggerButton = document.createElement('div');
  triggerButton.id = 'dobby-ai-trigger';
  const img = document.createElement('img');
  img.src = iconDataUri;
  img.alt = 'Dobby AI';
  Object.assign(img.style, { width: '28px', height: '28px', display: 'block' });
  triggerButton.appendChild(img);

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
  triggerButton.appendChild(tooltip);

  let tooltipTimer = null;
  triggerButton.addEventListener('mouseenter', () => {
    tooltip.style.opacity = '1';
    tooltip.style.visibility = 'visible';
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
    }, 2000);
  });
  triggerButton.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
    clearTimeout(tooltipTimer);
  });

  Object.assign(triggerButton.style, {
    position: 'fixed',
    zIndex: '2147483647',
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

  triggerButton.addEventListener('mousedown', async (e) => {
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

  document.body.appendChild(triggerButton);
}

function showTrigger(x, y) {
  createTriggerButton();
  triggerButton.style.display = 'block';
  const buttonWidth = triggerButton.offsetWidth || 36;
  const buttonHeight = triggerButton.offsetHeight || 36;
  const maxLeft = window.innerWidth - buttonWidth - 8;
  const maxTop = window.innerHeight - buttonHeight - 8;
  triggerButton.style.left = `${Math.min(Math.max(8, x + 12), maxLeft)}px`;
  triggerButton.style.top = `${Math.min(Math.max(4, y + 10), maxTop)}px`;
}

function hideTrigger() {
  if (triggerButton) {
    triggerButton.style.display = 'none';
  }
}

// Listen for text selection
document.addEventListener('mouseup', (e) => {
  if (triggerButton?.contains(e.target)) return;
  if (typeof _getBubbleContainer === 'function') {
    const bc = _getBubbleContainer();
    if (bc?.contains(e.target)) return;
  }

  const cursorX = e.clientX;
  const cursorY = e.clientY;
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length >= 3 && dobbyEnabled) {
      showTrigger(cursorX, cursorY);
    } else {
      hideTrigger();
    }
  }, 10);
});

// Fallback: selectionchange fires even when sites (Gmail, etc.) capture mouseup
let selectionChangeTimer = null;
document.addEventListener('selectionchange', () => {
  clearTimeout(selectionChangeTimer);
  selectionChangeTimer = setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length >= 3 && dobbyEnabled && selection.rangeCount > 0) {
      // Only show if trigger isn't already visible
      if (!triggerButton || triggerButton.style.display === 'none') {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showTrigger(rect.right, rect.bottom);
      }
    }
  }, 300);
});

// Hide trigger on scroll, re-show after scroll stops
let scrollTimer = null;
window.addEventListener('scroll', () => {
  hideTrigger();
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length >= 3 && dobbyEnabled && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showTrigger(rect.right, rect.top);
    }
  }, 150);
}, true);

// Hide on click away
document.addEventListener('mousedown', (e) => {
  if (triggerButton?.contains(e.target)) return;
  if (typeof _getBubbleContainer === 'function') {
    const bc = _getBubbleContainer();
    if (bc?.contains(e.target)) return;
  }
  hideTrigger();
});

// --- Image extraction from text selection ---

async function extractImagesFromSelection(selection, maxImages = 2) {
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

// --- Long-press screenshot mode ---

let longPressTimer = null;
let longPressStartX = 0;
let longPressStartY = 0;
const LONG_PRESS_DURATION = 1000;
const MOVEMENT_THRESHOLD = 5;
let screenshotOverlay = null;
let screenshotStartX = 0;
let screenshotStartY = 0;
let screenshotRect = null;
let screenshotDragStarted = false;
let progressRing = null;

function _ensureProgressRingStyles() {
  if (document.getElementById('dobby-progress-ring-styles')) return;
  const style = document.createElement('style');
  style.id = 'dobby-progress-ring-styles';
  style.textContent = `
    @keyframes dobby-ring-fill {
      from { stroke-dashoffset: 62.8; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes dobby-icon-fade {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
      to { opacity: 0.9; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes dobby-ring-appear {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function _showProgressRing(x, y) {
  _removeProgressRing();
  _ensureProgressRingStyles();

  const SIZE = 28;
  const HALF = SIZE / 2;
  const RADIUS = 10;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~62.8

  const container = document.createElement('div');
  container.setAttribute('data-dobby-progress-ring', '');
  Object.assign(container.style, {
    position: 'fixed',
    left: (x - HALF) + 'px',
    top: (y - HALF) + 'px',
    width: SIZE + 'px',
    height: SIZE + 'px',
    pointerEvents: 'none',
    zIndex: '2147483645',
    animation: 'dobby-ring-appear 0.15s ease-out forwards',
  });

  // Frosted backdrop circle
  const backdrop = document.createElement('div');
  Object.assign(backdrop.style, {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: (SIZE - 6) + 'px',
    height: (SIZE - 6) + 'px',
    borderRadius: '50%',
    background: 'rgba(245,240,255,0.92)',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(124,58,237,0.4), 0 0 0 1px rgba(124,58,237,0.15)',
  });
  container.appendChild(backdrop);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', String(SIZE));
  svg.setAttribute('height', String(SIZE));
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.style.transform = 'rotate(-90deg)';
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';

  // Background track
  const track = document.createElementNS(svgNS, 'circle');
  track.setAttribute('cx', String(HALF));
  track.setAttribute('cy', String(HALF));
  track.setAttribute('r', String(RADIUS));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'rgba(124,58,237,0.3)');
  track.setAttribute('stroke-width', '3');
  svg.appendChild(track);

  // Animated fill circle
  const fill = document.createElementNS(svgNS, 'circle');
  fill.setAttribute('cx', String(HALF));
  fill.setAttribute('cy', String(HALF));
  fill.setAttribute('r', String(RADIUS));
  fill.setAttribute('fill', 'none');
  fill.setAttribute('stroke', '#7c3aed');
  fill.setAttribute('stroke-width', '3');
  fill.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
  fill.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE));
  fill.setAttribute('stroke-linecap', 'round');
  fill.style.animation = 'dobby-ring-fill 1s linear forwards';
  fill.style.filter = 'drop-shadow(0 0 4px rgba(124,58,237,0.6))';
  svg.appendChild(fill);

  container.appendChild(svg);

  // Camera icon (separate SVG, not rotated)
  const iconSvg = document.createElementNS(svgNS, 'svg');
  iconSvg.setAttribute('width', '10');
  iconSvg.setAttribute('height', '10');
  iconSvg.setAttribute('viewBox', '0 0 24 24');
  iconSvg.setAttribute('fill', 'none');
  iconSvg.setAttribute('stroke', '#7c3aed');
  iconSvg.setAttribute('stroke-width', '2');
  iconSvg.setAttribute('stroke-linecap', 'round');
  Object.assign(iconSvg.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    animation: 'dobby-icon-fade 0.3s ease forwards',
  });

  const camBody = document.createElementNS(svgNS, 'rect');
  camBody.setAttribute('x', '2');
  camBody.setAttribute('y', '5');
  camBody.setAttribute('width', '20');
  camBody.setAttribute('height', '15');
  camBody.setAttribute('rx', '2');
  iconSvg.appendChild(camBody);

  const camLens = document.createElementNS(svgNS, 'circle');
  camLens.setAttribute('cx', '12');
  camLens.setAttribute('cy', '13');
  camLens.setAttribute('r', '3');
  iconSvg.appendChild(camLens);

  const camTop = document.createElementNS(svgNS, 'path');
  camTop.setAttribute('d', 'M8 5l1-2h6l1 2');
  iconSvg.appendChild(camTop);

  container.appendChild(iconSvg);
  document.body.appendChild(container);
  progressRing = container;
}

function _removeProgressRing() {
  if (progressRing) {
    if (progressRing.parentNode) {
      progressRing.parentNode.removeChild(progressRing);
    }
    progressRing = null;
  }
}

const INTERACTIVE_TAGS = new Set([
  'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'VIDEO', 'AUDIO', 'LABEL', 'OPTION',
]);

function isInteractiveElement(el) {
  if (!el || !el.tagName) return false;
  if (INTERACTIVE_TAGS.has(el.tagName)) return true;
  if (el.isContentEditable) return true;
  if (el.closest && el.closest('button, a, select, label, [role="button"], [role="slider"], [role="scrollbar"]')) return true;
  return false;
}

function isScrollbarClick(e) {
  // Page-level scrollbars
  if (e.clientX >= document.documentElement.clientWidth ||
    e.clientY >= document.documentElement.clientHeight) return true;
  // Element-level scrollbars (e.g. scrollable divs)
  const el = e.target;
  if (el && el.getBoundingClientRect) {
    const rect = el.getBoundingClientRect();
    const clickOffsetX = e.clientX - rect.left;
    const clickOffsetY = e.clientY - rect.top;
    if (el.scrollHeight > el.clientHeight && clickOffsetX > el.clientWidth) return true;
    if (el.scrollWidth > el.clientWidth && clickOffsetY > el.clientHeight) return true;
  }
  return false;
}

document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // left click only
  if (isInteractiveElement(e.target)) return;
  if (isScrollbarClick(e)) return;
  if (triggerButton?.contains(e.target)) return;
  if (typeof _getBubbleContainer === 'function') {
    const bc = _getBubbleContainer();
    if (bc?.contains(e.target)) return;
  }
  if (screenshotOverlay) return;

  if (!dobbyEnabled) return;

  longPressStartX = e.clientX;
  longPressStartY = e.clientY;

  _showProgressRing(e.clientX, e.clientY);

  longPressTimer = setTimeout(() => {
    startScreenshotMode();
  }, LONG_PRESS_DURATION);
});

document.addEventListener('mousemove', (e) => {
  if (longPressTimer) {
    const dx = Math.abs(e.clientX - longPressStartX);
    const dy = Math.abs(e.clientY - longPressStartY);
    if (dx > MOVEMENT_THRESHOLD || dy > MOVEMENT_THRESHOLD) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      _removeProgressRing();
    }
  }

  // Screenshot region drag
  if (screenshotOverlay && screenshotRect && screenshotDragStarted) {
    const x = Math.min(screenshotStartX, e.clientX);
    const y = Math.min(screenshotStartY, e.clientY);
    const w = Math.abs(e.clientX - screenshotStartX);
    const h = Math.abs(e.clientY - screenshotStartY);
    Object.assign(screenshotRect.style, {
      left: x + 'px',
      top: y + 'px',
      width: w + 'px',
      height: h + 'px',
    });
  }
});

document.addEventListener('mouseup', (e) => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    _removeProgressRing();
  }
}, true);

function startScreenshotMode() {
  _removeProgressRing();
  longPressTimer = null;

  screenshotOverlay = document.createElement('div');
  Object.assign(screenshotOverlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483646',
    background: 'rgba(0, 0, 0, 0.4)',
    cursor: 'crosshair',
  });

  // Instruction banner at the top
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(124, 58, 237, 0.9)',
    color: 'white',
    padding: '10px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '500',
    zIndex: '2147483647',
    pointerEvents: 'none',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    letterSpacing: '0.3px',
  });
  banner.textContent = 'Drag to select a region \u2022 ESC to cancel';
  screenshotOverlay.appendChild(banner);

  // Visual border around the viewport
  const border = document.createElement('div');
  Object.assign(border.style, {
    position: 'fixed',
    inset: '0',
    border: '2px solid rgba(124, 58, 237, 0.6)',
    pointerEvents: 'none',
    zIndex: '2147483647',
  });
  screenshotOverlay.appendChild(border);

  screenshotRect = document.createElement('div');
  Object.assign(screenshotRect.style, {
    position: 'fixed',
    border: '2px dashed #7c3aed',
    background: 'rgba(124, 58, 237, 0.1)',
    display: 'none',
    zIndex: '2147483647',
  });
  screenshotOverlay.appendChild(screenshotRect);

  screenshotDragStarted = false;

  screenshotOverlay.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Clear existing toolbar if user re-drags on overlay
    const existingToolbar = screenshotOverlay.querySelector('[data-screenshot-toolbar]');
    if (existingToolbar) existingToolbar.remove();
    screenshotDragStarted = true;
    screenshotStartX = e.clientX;
    screenshotStartY = e.clientY;
    screenshotRect.style.display = 'block';
    Object.assign(screenshotRect.style, {
      left: e.clientX + 'px',
      top: e.clientY + 'px',
      width: '0px',
      height: '0px',
    });
  });

  screenshotOverlay.addEventListener('mouseup', (e) => {
    // Ignore the mouseup from the long-press release (no drag started yet)
    if (!screenshotDragStarted) return;

    const x = Math.min(screenshotStartX, e.clientX);
    const y = Math.min(screenshotStartY, e.clientY);
    const w = Math.abs(e.clientX - screenshotStartX);
    const h = Math.abs(e.clientY - screenshotStartY);

    // Too small — reset selection and let user try again
    if (w < 10 || h < 10) {
      screenshotRect.style.display = 'none';
      screenshotDragStarted = false;
      return;
    }

    // Stop tracking drag so mousemove no longer resizes the rectangle
    screenshotDragStarted = false;

    // Lock the selection rectangle with solid border
    Object.assign(screenshotRect.style, {
      border: '2px solid #7c3aed',
    });


    // Show confirmation toolbar below the selection
    _showConfirmToolbar(screenshotOverlay, banner, { x, y, width: w, height: h });
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      cancelScreenshotMode();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  screenshotOverlay._escHandler = escHandler;

  document.body.appendChild(screenshotOverlay);
}

function _showConfirmToolbar(overlay, banner, rect) {
  // Remove existing toolbar if any
  const existing = overlay.querySelector('[data-screenshot-toolbar]');
  if (existing) existing.remove();

  // Update banner text
  banner.textContent = 'Confirm selection or reselect';

  const toolbar = document.createElement('div');
  toolbar.setAttribute('data-screenshot-toolbar', '');

  // Position below the selection, centered horizontally
  const toolbarTop = Math.min(rect.y + rect.height + 12, window.innerHeight - 52);
  const toolbarLeft = rect.x + rect.width / 2;

  Object.assign(toolbar.style, {
    position: 'fixed',
    top: toolbarTop + 'px',
    left: toolbarLeft + 'px',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    zIndex: '2147483647',
  });

  const btnBase = {
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '500',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  };

  // Confirm button
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Capture';
  Object.assign(confirmBtn.style, {
    ...btnBase,
    background: '#7c3aed',
    color: 'white',
  });
  confirmBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    cancelScreenshotMode();
    try {
      if (typeof captureScreenshot === 'function') {
        const captured = await captureScreenshot(rect);
        if (captured) {
          const bubbleRect = {
            bottom: rect.y + rect.height + 8,
            left: rect.x,
            right: rect.x + rect.width,
            top: rect.y,
          };
          showBubbleWithPresets(bubbleRect, '', null, [captured]);
        }
      }
    } catch (err) {
      console.error('[Dobby AI] Screenshot capture failed:', err);
    }
  });

  // Reselect button
  const reselectBtn = document.createElement('button');
  reselectBtn.textContent = 'Reselect';
  Object.assign(reselectBtn.style, {
    ...btnBase,
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#374151',
  });
  reselectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toolbar.remove();
    Object.assign(screenshotRect.style, {
      display: 'none',
      border: '2px dashed #7c3aed',
      width: '0px',
      height: '0px',
    });
    screenshotDragStarted = false;
    banner.textContent = 'Drag to select a region \u2022 ESC to cancel';
  });

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  Object.assign(cancelBtn.style, {
    ...btnBase,
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#6b7280',
  });
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelScreenshotMode();
  });

  toolbar.appendChild(confirmBtn);
  toolbar.appendChild(reselectBtn);
  toolbar.appendChild(cancelBtn);
  overlay.appendChild(toolbar);

  // Prevent overlay mousedown from starting a new drag while toolbar is shown
  toolbar.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
}

function cancelScreenshotMode() {
  if (screenshotOverlay) {
    if (screenshotOverlay._escHandler) {
      document.removeEventListener('keydown', screenshotOverlay._escHandler);
    }
    if (screenshotOverlay.parentNode) {
      screenshotOverlay.parentNode.removeChild(screenshotOverlay);
    }
    screenshotOverlay = null;
    screenshotRect = null;
    screenshotDragStarted = false;
  }
}

function _resetTriggerForTesting() {
  if (triggerButton && triggerButton.parentNode) {
    triggerButton.parentNode.removeChild(triggerButton);
  }
  triggerButton = null;
  dobbyEnabled = true;
  _removeProgressRing();
}

function _setDobbyEnabled(val) { dobbyEnabled = val; }

if (typeof module !== 'undefined') module.exports = { createTriggerButton, showTrigger, hideTrigger, _resetTriggerForTesting, _setDobbyEnabled, extractImagesFromSelection, startScreenshotMode, cancelScreenshotMode, _showProgressRing, _removeProgressRing };
