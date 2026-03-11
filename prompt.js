// Prompt construction and AI URL generation
// Implemented by Engineer A

const MAX_TEXT_LENGTH = 6000;
const MAX_URL_LENGTH = 12000;

/**
 * Build the final prompt string.
 * @param {string} selectedText
 * @param {string} instruction - Preset or custom instruction (can be empty)
 * @param {boolean} includePageContext
 * @returns {string}
 */
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
    const title = typeof document !== 'undefined' ? document.title : '';
    const url = typeof window !== 'undefined' ? window.location.href : '';
    prompt += `\n\nFrom: "${title}" (${url})`;
  }

  return prompt;
}

/**
 * Generate the AI URL with the prompt.
 * @param {'chatgpt'|'claude'} ai
 * @param {string} prompt
 * @returns {{ url: string, fallback: boolean, prompt?: string }}
 */
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

// Export for testing (no-op in browser)
if (typeof module !== 'undefined') module.exports = { buildPrompt, getAIUrl, MAX_TEXT_LENGTH, MAX_URL_LENGTH };
