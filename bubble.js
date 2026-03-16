// bubble.js — Inline frosted-glass response bubble (Shadow DOM)
//
// Dependencies (shared global scope via manifest.json content_scripts):
// - requestChat(messages, onToken, onDone, onError) from api.js
// - saveConversation(entry) from history.js
// - getHistory(), clearHistory() from history.js
// - buildFollowUp(existingMessages, newQuestion) from prompt.js

let bubbleHost = null;
let currentMessages = [];
let responseText = '';
let currentRequest = null;
let renderTimer = null;

function detectTheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isValidImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderMarkdown(text) {
  // Extract code blocks first so their contents are not processed
  const codeBlocks = [];
  let processed = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(code);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  // Extract images before escaping (they need real <img> tags)
  const images = [];
  processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    if (isValidImageUrl(url)) {
      images.push({ alt: escapeHtml(alt), url: escapeHtml(url) });
      return `%%IMAGE_${images.length - 1}%%`;
    }
    return `![${alt}](${url})`;
  });

  // Escape HTML to prevent XSS
  let escaped = escapeHtml(processed);
  // Inline transforms
  escaped = escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
  // Re-insert code blocks with preserved formatting
  escaped = escaped.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => {
    const block = codeBlocks[parseInt(i)];
    return block != null ? '<pre><code>' + escapeHtml(block) + '</code></pre>' : '';
  });
  // Re-insert images
  escaped = escaped.replace(/%%IMAGE_(\d+)%%/g, (_, i) => {
    const img = images[parseInt(i)];
    if (!img) return '';
    return `<img class="response-img" src="${img.url}" alt="${img.alt}" loading="lazy" onerror="this.style.display='none'">`;
  });
  return escaped;
}

function createBubbleHost(selectionRect) {
  bubbleHost = document.createElement('div');
  bubbleHost.id = 'dobby-ai-bubble';
  const bubbleHeight = 420;
  const gap = 8;
  const preferredTop = selectionRect.bottom + gap;
  const wouldOverflow = preferredTop + bubbleHeight > window.innerHeight;
  const top = wouldOverflow
    ? Math.max(gap, (selectionRect.top || selectionRect.bottom) - bubbleHeight - gap)
    : preferredTop;
  Object.assign(bubbleHost.style, {
    position: 'fixed',
    zIndex: String(Z_INDEX.BUBBLE),
    left: `${Math.max(8, (selectionRect.left + selectionRect.right) / 2 - 190)}px`,
    top: `${top}px`,
  });
  bubbleHost._escHandler = (e) => { if (e.key === 'Escape') hideBubble(); };
  document.addEventListener('keydown', bubbleHost._escHandler);
  return bubbleHost;
}

function buildBubbleHTML(previewText, previewLabel, showPresets, images) {
  const hasPreview = previewText || (images && images.length > 0);
  let previewHtml = '';
  if (hasPreview) {
    let imgHtml = '';
    if (images && images.length > 0) {
      imgHtml = '<div class="image-preview">' +
        images.map(img => {
          const url = img.image_url ? img.image_url.url : '';
          return `<img src="${escapeHtml(url)}" alt="Preview" onerror="this.style.display='none'">`;
        }).join('') + '</div>';
    }
    previewHtml = `<div class="selected-text-preview">
      <div class="label">${escapeHtml(previewLabel || (images && images.length > 0 ? 'Image' : 'Selected text'))}</div>
      ${imgHtml}
      ${previewText ? `<div class="text">${escapeHtml(previewText)}</div>` : ''}
    </div>`;
  }
  return `
    <div class="bubble-header">
      <span class="bubble-logo">\u2726 Dobby AI</span>
      <span class="bubble-status"></span>
      <button class="pin-btn" title="Pin">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 17v5"/><path d="M9 11V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7"/><path d="M5 15h14l-1.5-4H6.5L5 15z"/>
        </svg>
      </button>
      <button class="close-btn" title="Close">\u2715</button>
    </div>
    ${previewHtml}
    ${showPresets ? '<div class="presets-section"></div>' : ''}
    <div class="response-section">
      <div class="bubble-body">
        <div class="response-text"></div>
        <span class="cursor blink"></span>
      </div>
      <div class="bubble-footer">
        <input class="follow-up-input" placeholder="Ask a follow-up..." disabled />
        <button class="action-btn history-btn" title="History">\ud83d\udd50</button>
      </div>
    </div>
    <div class="resize-handle" title="Drag to resize">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="8" y1="4" x2="4" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="10" y1="8" x2="8" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </div>
  `;
}

function wireCommonEvents(shadow) {
  shadow.querySelector('.close-btn').addEventListener('click', hideBubble);
  const pinBtn = shadow.querySelector('.pin-btn');
  const header = shadow.querySelector('.bubble-header');

  const updateDraggable = () => {
    header.classList.toggle('draggable', bubbleHost._isPinned);
  };

  if (pinBtn) {
    pinBtn.addEventListener('click', () => {
      bubbleHost._isPinned = !bubbleHost._isPinned;
      pinBtn.classList.toggle('pinned', bubbleHost._isPinned);
      pinBtn.title = bubbleHost._isPinned ? 'Unpin' : 'Pin';
      updateDraggable();
    });
  }

  // Drag-by-header when pinned
  header.addEventListener('mousedown', (e) => {
    if (!bubbleHost._isPinned) return;
    // Don't drag when clicking buttons inside header
    if (e.target.closest && e.target.closest('.pin-btn, .close-btn')) return;

    e.preventDefault();
    header.classList.add('dragging');

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(bubbleHost.style.left) || 0;
    const startTop = parseInt(bubbleHost.style.top) || 0;

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const newLeft = startLeft + moveEvent.clientX - startX;
      const newTop = startTop + moveEvent.clientY - startY;
      bubbleHost.style.left = newLeft + 'px';
      bubbleHost.style.top = newTop + 'px';
    };

    const onMouseUp = () => {
      header.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Store cleanup for hideBubble
    bubbleHost._dragCleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  });
  shadow.querySelector('.history-btn').addEventListener('click', () => {
    showHistoryPanel(shadow);
  });
  shadow.querySelector('.follow-up-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const question = e.target.value.trim();
      e.target.value = '';
      handleFollowUp(shadow, question);
    }
  });
  // Image lightbox via event delegation
  shadow.querySelector('.bubble-body').addEventListener('click', (e) => {
    if (e.target.classList.contains('response-img')) {
      const overlay = document.createElement('div');
      overlay.className = 'img-lightbox';
      overlay.tabIndex = 0;
      const img = document.createElement('img');
      img.src = e.target.src;
      img.alt = e.target.alt;
      overlay.appendChild(img);
      const dismiss = () => overlay.remove();
      overlay.addEventListener('click', dismiss);
      overlay.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { ev.stopPropagation(); dismiss(); }
      });
      shadow.appendChild(overlay);
      overlay.focus();
    }
  });
  // Resize handle
  const resizeHandle = shadow.querySelector('.resize-handle');
  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const bubble = shadow.querySelector('.bubble');
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = bubble.getBoundingClientRect().width;
      const startHeight = bubble.getBoundingClientRect().height;

      const onMouseMove = (moveEvent) => {
        moveEvent.preventDefault();
        const newWidth = Math.min(
          Math.max(300, startWidth + moveEvent.clientX - startX),
          window.innerWidth * 0.8
        );
        const newHeight = Math.min(
          Math.max(200, startHeight + moveEvent.clientY - startY),
          window.innerHeight * 0.8
        );
        bubble.style.width = newWidth + 'px';
        bubble.style.height = newHeight + 'px';
        bubble.style.maxHeight = 'none';
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      // Store cleanup reference for hideBubble
      bubbleHost._resizeCleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    });
  }
}

function activateResponseSection(shadow, messages) {
  const presetsSection = shadow.querySelector('.presets-section');
  if (presetsSection) presetsSection.classList.add('collapsed');
  const responseSection = shadow.querySelector('.response-section');
  responseSection.classList.add('active');
  shadow.querySelector('.bubble-status').textContent = 'thinking...';
  startStreaming(shadow, messages);
}

function truncatePreview(text, maxLen = 120) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

function initBubble(selectionRect, selectedText, previewLabel, showPresets, images) {
  hideBubble();
  responseText = '';

  createBubbleHost(selectionRect);
  bubbleHost._isPinned = false;
  const shadow = bubbleHost.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = getStyles(detectTheme());
  shadow.appendChild(style);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = buildBubbleHTML(truncatePreview(selectedText), previewLabel, showPresets, images);
  shadow.appendChild(bubble);

  wireCommonEvents(shadow);
  document.body.appendChild(bubbleHost);
  return shadow;
}

// Show bubble with preset selection first, then expand to show response
function showBubbleWithPresets(selectionRect, selectedText, anchorNode, images) {
  const hasImages = images && images.length > 0;
  const isImageOnly = hasImages && !selectedText.trim();
  const previewLabel = isImageOnly ? 'Image' : 'Selected text';
  const shadow = initBubble(selectionRect, selectedText, previewLabel, true, images);

  // Detect content type and populate presets
  let detected;
  if (isImageOnly) {
    detected = { type: 'image', subType: null, confidence: 'high' };
  } else {
    detected = typeof detectContentType === 'function'
      ? detectContentType(selectedText, anchorNode)
      : (typeof detectContent === 'function'
        ? detectContent(selectedText)
        : { type: 'default', subType: null, confidence: 'medium' });
  }

  const presets = typeof getSuggestedPresetsForType === 'function'
    ? getSuggestedPresetsForType(detected.type, detected.subType)
    : [];

  const presetsSection = shadow.querySelector('.presets-section');

  // Detection badge
  if (detected.type !== 'default') {
    const badge = document.createElement('div');
    badge.className = 'detection-badge';
    badge.textContent = isImageOnly ? 'image' : `${detected.subType || detected.type} detected`;
    presetsSection.appendChild(badge);
  }

  // Preset chips
  const chipsRow = document.createElement('div');
  chipsRow.className = 'preset-chips';
  presets.slice(0, 4).forEach((preset) => {
    const chip = document.createElement('div');
    chip.className = 'preset-chip';
    chip.textContent = preset.label;
    chip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      launchFromPreset(shadow, selectedText, preset.instruction, images);
    });
    chipsRow.appendChild(chip);
  });
  presetsSection.appendChild(chipsRow);

  // Custom input
  const customInput = document.createElement('input');
  customInput.className = 'preset-input';
  customInput.placeholder = isImageOnly ? 'Or ask something about this image...' : 'Or type a custom prompt...';
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && customInput.value.trim()) {
      launchFromPreset(shadow, selectedText, customInput.value.trim(), images);
    }
    if (e.key === 'Escape') hideBubble();
  });
  presetsSection.appendChild(customInput);
}

function launchFromPreset(shadow, selectedText, instruction, images) {
  const messages = typeof buildChatMessages === 'function'
    ? buildChatMessages(selectedText, instruction, true, images)
    : [{ role: 'user', content: `${instruction}:\n\n${selectedText}` }];
  currentMessages = messages;

  // Update preview label to show chosen instruction
  const label = shadow.querySelector('.selected-text-preview .label');
  if (label) label.textContent = instruction;

  activateResponseSection(shadow, messages);
}

// Direct bubble (used by context menu — no preset selection needed)
function showBubble(selectionRect, messages, selectedText, instruction, images) {
  currentMessages = messages;
  const shadow = initBubble(selectionRect, selectedText, instruction || 'Selected text', false, images);
  activateResponseSection(shadow, messages);
}

function startStreaming(shadow, messages) {
  const responseEl = shadow.querySelector('.response-text');
  const cursorEl = shadow.querySelector('.cursor');
  const statusEl = shadow.querySelector('.bubble-status');
  const followUpInput = shadow.querySelector('.follow-up-input');

  // Create a new AI message container for this response
  const aiMsg = document.createElement('div');
  aiMsg.className = 'message-ai';
  responseEl.appendChild(aiMsg);

  statusEl.textContent = 'thinking...';
  cursorEl.classList.remove('hidden');
  cursorEl.classList.add('blink');
  followUpInput.disabled = true;

  let firstToken = true;

  currentRequest = requestChat(
    messages,
    (token) => {
      if (firstToken) {
        statusEl.textContent = 'typing...';
        firstToken = false;
      }
      responseText += token;
      // Debounce rendering to ~50ms for performance
      if (!renderTimer) {
        renderTimer = setTimeout(() => {
          renderTimer = null;
          aiMsg.innerHTML = renderMarkdown(responseText);
          const body = shadow.querySelector('.bubble-body');
          body.scrollTop = body.scrollHeight;
        }, TIMING.RENDER_DEBOUNCE);
      }
    },
    (usageInfo) => {
      // Flush any pending render
      if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
      aiMsg.innerHTML = renderMarkdown(responseText);
      if (usageInfo && usageInfo.usingOwnKey) {
        statusEl.textContent = 'your API key';
      } else if (usageInfo && usageInfo.remaining != null) {
        statusEl.textContent = `${usageInfo.remaining}/30 free`;
      } else {
        statusEl.textContent = '';
      }
      cursorEl.classList.add('hidden');
      followUpInput.disabled = false;
      followUpInput.focus();
      currentMessages.push({ role: 'assistant', content: responseText });

      // Save to history — extract text from multimodal content arrays
      const firstUser = messages.find((m) => m.role === 'user');
      const instruction = messages.find((m) => m.role === 'system');
      let historyText = '';
      if (firstUser) {
        if (typeof firstUser.content === 'string') {
          historyText = firstUser.content;
        } else if (Array.isArray(firstUser.content)) {
          historyText = firstUser.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
        }
      }
      saveConversation({
        text: historyText,
        instruction: instruction?.content || '',
        response: responseText,
        pageUrl: window.location.href,
        pageTitle: document.title,
      });
    },
    (code, message, data) => {
      cursorEl.classList.add('hidden');

      if (code === 'RATE_LIMITED') {
        showRateLimitUI(shadow);
      } else {
        statusEl.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-msg';
        errorDiv.textContent = message || 'Something went wrong.';
        const retryBtn = document.createElement('button');
        retryBtn.className = 'retry-btn';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', () => {
          errorDiv.remove();
          aiMsg.remove();
          responseText = '';
          startStreaming(shadow, messages);
        });
        errorDiv.appendChild(retryBtn);
        aiMsg.appendChild(errorDiv);
      }
    }
  );
}

function handleFollowUp(shadow, question) {
  const responseEl = shadow.querySelector('.response-text');

  // Add user message bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'message-user';
  userMsg.textContent = question;
  responseEl.appendChild(userMsg);

  // Scroll to show the user message
  const body = shadow.querySelector('.bubble-body');
  body.scrollTop = body.scrollHeight;

  // Reset responseText for the new AI reply (previous messages stay in DOM)
  responseText = '';

  currentMessages = buildFollowUp(currentMessages, question);
  startStreaming(shadow, currentMessages);
}

function showRateLimitUI(shadow) {
  const body = shadow.querySelector('.bubble-body');
  body.innerHTML = `
    <div class="rate-limit-msg">
      <p>You've used your 30 free questions today.</p>
      <p style="margin-top:8px">Add your own API key in Settings for unlimited access.</p>
      <span class="cta">Open Settings \u2192</span>
    </div>
  `;

  shadow.querySelector('.cta').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  });
}

async function showHistoryPanel(shadow) {
  const body = shadow.querySelector('.bubble-body');
  const entries = await getHistory();

  if (entries.length === 0) {
    body.innerHTML = '<div class="history-panel"><p style="text-align:center;color:#71717a">No history yet</p></div>';
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'history-panel';

  entries.forEach((entry) => {
    const el = document.createElement('div');
    el.className = 'history-entry';
    const timeAgo = getTimeAgo(entry.timestamp);
    const instrDiv = document.createElement('div');
    instrDiv.className = 'history-instruction';
    instrDiv.textContent = entry.text ? entry.text.substring(0, 60) : (entry.instruction || '').substring(0, 60);
    const metaDiv = document.createElement('div');
    metaDiv.className = 'history-meta';
    metaDiv.textContent = `${entry.pageTitle || 'Unknown page'} \u00b7 ${timeAgo}`;
    el.appendChild(instrDiv);
    el.appendChild(metaDiv);
    el.addEventListener('click', () => {
      body.innerHTML = '';
      const responseEl = document.createElement('div');
      responseEl.className = 'response-text';
      responseEl.innerHTML = renderMarkdown(entry.response);
      body.appendChild(responseEl);
      const cursor = document.createElement('span');
      cursor.className = 'cursor hidden';
      body.appendChild(cursor);

      // Show response section and hide presets
      const presetsSection = shadow.querySelector('.presets-section');
      if (presetsSection) presetsSection.classList.add('collapsed');
      const responseSection = shadow.querySelector('.response-section');
      if (responseSection) responseSection.classList.add('active');

      // Restore conversation state so follow-up works
      currentMessages = [];
      if (entry.instruction) currentMessages.push({ role: 'system', content: entry.instruction });
      if (entry.text) currentMessages.push({ role: 'user', content: entry.text });
      if (entry.response) currentMessages.push({ role: 'assistant', content: entry.response });
      responseText = entry.response || '';

      const followUpInput = shadow.querySelector('.follow-up-input');
      if (followUpInput) {
        followUpInput.disabled = false;
        followUpInput.focus();
      }
    });
    panel.appendChild(el);
  });

  const clearLink = document.createElement('span');
  clearLink.className = 'clear-link';
  clearLink.textContent = 'Clear all history';
  clearLink.addEventListener('click', async () => {
    await clearHistory();
    body.innerHTML = '<div class="history-panel"><p style="text-align:center;color:#71717a">History cleared</p></div>';
  });
  panel.appendChild(clearLink);

  body.innerHTML = '';
  body.appendChild(panel);
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function appendToken(text) {
  if (!bubbleHost) return;
  const shadow = bubbleHost.shadowRoot;
  const responseEl = shadow.querySelector('.response-text');
  responseText += text;
  // Write into the latest .message-ai div to preserve previous messages
  let aiMsg = responseEl.querySelector('.message-ai:last-child');
  if (!aiMsg) {
    aiMsg = document.createElement('div');
    aiMsg.className = 'message-ai';
    responseEl.appendChild(aiMsg);
  }
  aiMsg.innerHTML = renderMarkdown(responseText);
}

function setBubbleStatus(status) {
  if (!bubbleHost) return;
  const el = bubbleHost.shadowRoot.querySelector('.bubble-status');
  if (el) el.textContent = status;
}

function hideBubble() {
  if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
  if (currentRequest) {
    currentRequest.cancel();
    currentRequest = null;
  }
  if (bubbleHost) {
    if (bubbleHost._dragCleanup) {
      bubbleHost._dragCleanup();
    }
    if (bubbleHost._resizeCleanup) {
      bubbleHost._resizeCleanup();
    }
    if (bubbleHost._escHandler) document.removeEventListener('keydown', bubbleHost._escHandler);
    removeElement(bubbleHost);
  }
  bubbleHost = null;
  currentMessages = [];
  responseText = '';
}

function _getBubbleContainer() {
  return bubbleHost;
}

if (typeof module !== 'undefined') {
  module.exports = {
    showBubble, showBubbleWithPresets, hideBubble, appendToken, setBubbleStatus,
    renderMarkdown, detectTheme, _getBubbleContainer,
  };
}
