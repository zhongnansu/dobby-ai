// ============================================================
// Content Detection
// ============================================================

function detectContentType(text, anchorNode) {
  // Check if selection is inside <pre> or <code>
  if (anchorNode) {
    let node = anchorNode;
    while (node) {
      const tag = node.nodeName?.toLowerCase();
      if (tag === 'pre' || tag === 'code') return 'code';
      node = node.parentElement;
    }
  }

  // Heuristic: code patterns — require co-occurrence of structural signals
  const hasBraces = /[{}]/.test(text);
  const hasSemicolons = /;/.test(text);
  const hasIndentation = /^\s{2,}/m.test(text);
  const codeKeywords = (text.match(/\b(function|const|let|var|def|class|import|return|if|else|for|while)\b/g) || []).length;

  if ((hasBraces && hasSemicolons) ||
      (hasBraces && codeKeywords >= 2) ||
      (hasIndentation && hasSemicolons && codeKeywords >= 1)) {
    return 'code';
  }

  // Heuristic: foreign language — Unicode script block analysis
  const nonLatinChars = (text.match(/[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || []).length;
  if (text.length > 0 && nonLatinChars / text.length > 0.3) {
    return 'foreign';
  }

  // Heuristic: long text
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > 200) {
    return 'long';
  }

  return 'default';
}

// ============================================================
// Presets
// ============================================================

const PRESETS = {
  code: {
    suggested: [
      { label: 'Explain code', instruction: 'Explain the following code' },
      { label: 'Debug this', instruction: 'Debug the following code and identify any issues' },
      { label: 'Optimize', instruction: 'Optimize the following code' },
    ],
    all: [
      { label: 'Add types', instruction: 'Add type annotations to the following code' },
      { label: 'Write tests', instruction: 'Write unit tests for the following code' },
      { label: 'Convert to...', instruction: 'Convert the following code to' },
    ]
  },
  foreign: {
    suggested: [
      { label: 'Translate', instruction: 'Translate the following to English' },
      { label: 'Explain', instruction: 'Explain the following text' },
    ],
    all: []
  },
  long: {
    suggested: [
      { label: 'Summarize', instruction: 'Summarize the following' },
      { label: 'Key points', instruction: 'Extract the key points from the following' },
    ],
    all: []
  },
  default: {
    suggested: [
      { label: 'Summarize', instruction: 'Summarize the following' },
      { label: 'Explain simply', instruction: 'Explain the following in simple terms' },
    ],
    all: []
  }
};

const COMMON_PRESETS = [
  { label: 'Summarize', instruction: 'Summarize the following' },
  { label: 'Explain', instruction: 'Explain the following' },
  { label: 'Translate', instruction: 'Translate the following to English' },
  { label: 'Rewrite', instruction: 'Rewrite the following more clearly' },
  { label: 'Expand', instruction: 'Expand on the following' },
  { label: 'Key points', instruction: 'Extract the key points from the following' },
];

function getAllPresetsForType(contentType) {
  const typeAll = PRESETS[contentType].all || [];
  const labels = new Set([
    ...PRESETS[contentType].suggested.map(p => p.label),
    ...typeAll.map(p => p.label),
  ]);
  const common = COMMON_PRESETS.filter(p => !labels.has(p.label));
  return [...typeAll, ...common];
}

// ============================================================
// Prompt Construction
// ============================================================

const MAX_TEXT_LENGTH = 2000;
const MAX_URL_LENGTH = 8000;

function buildPrompt(selectedText, instruction, includePageContext) {
  let text = selectedText;
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.substring(0, MAX_TEXT_LENGTH) + '...[truncated]';
  }

  let prompt = '';
  if (instruction) {
    prompt = `${instruction}:\n\n${text}`;
  } else {
    prompt = text;
  }

  if (includePageContext) {
    prompt += `\n\nFrom: "${document.title}" (${window.location.href})`;
  }

  return prompt;
}

function getAIUrl(ai, prompt) {
  const encoded = encodeURIComponent(prompt);
  const baseUrls = {
    chatgpt: 'https://chatgpt.com/',
    claude: 'https://claude.ai/new'
  };

  const fullUrl = `${baseUrls[ai]}?q=${encoded}`;

  if (fullUrl.length > MAX_URL_LENGTH) {
    return { url: baseUrls[ai], fallback: true, prompt };
  }

  return { url: fullUrl, fallback: false };
}

// ============================================================
// Message listener (context menu integration)
// ============================================================

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_POPUP') {
    console.log('[Ask AI] Context menu triggered, content type:', detectContentType(msg.text, null));
    // Popup UI will be added in next PR
  }
});
