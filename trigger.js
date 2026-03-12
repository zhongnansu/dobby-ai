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

  triggerButton.addEventListener('mousedown', (e) => {
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
      showBubbleWithPresets(rect, text, anchorNode);
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

function _resetTriggerForTesting() {
  if (triggerButton && triggerButton.parentNode) {
    triggerButton.parentNode.removeChild(triggerButton);
  }
  triggerButton = null;
  dobbyEnabled = true;
}

function _setDobbyEnabled(val) { dobbyEnabled = val; }

if (typeof module !== 'undefined') module.exports = { createTriggerButton, showTrigger, hideTrigger, _resetTriggerForTesting, _setDobbyEnabled };
