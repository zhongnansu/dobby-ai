// prompt.js — OpenAI chat message format
const MAX_TEXT_LENGTH = 6000;

/**
 * Build OpenAI chat messages array from selected text and instruction.
 * @param {string} selectedText
 * @param {string} instruction - Preset or custom instruction (can be empty/null)
 * @param {boolean} includePageContext
 * @returns {Array<{role: string, content: string}>}
 */
function buildChatMessages(selectedText, instruction, includePageContext) {
  let text = selectedText;
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.substring(0, MAX_TEXT_LENGTH) + '...[truncated]';
  }

  const messages = [];

  if (instruction) {
    messages.push({ role: 'system', content: instruction });
  }

  let userContent = text;
  if (includePageContext) {
    const title = typeof document !== 'undefined' ? document.title : '';
    const url = typeof window !== 'undefined' ? window.location.href : '';
    userContent += `\n\nFrom: "${title}" (${url})`;
  }

  messages.push({ role: 'user', content: userContent });
  return messages;
}

/**
 * Append a follow-up question to an existing conversation.
 * @param {Array} existingMessages
 * @param {string} newQuestion
 * @returns {Array}
 */
function buildFollowUp(existingMessages, newQuestion) {
  return [...existingMessages, { role: 'user', content: newQuestion }];
}

if (typeof module !== 'undefined') module.exports = { buildChatMessages, buildFollowUp, MAX_TEXT_LENGTH };
