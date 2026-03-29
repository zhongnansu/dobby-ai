// src/content/autosuggest/context.js — Builds OpenAI chat-format messages for completion
import { AUTOSUGGEST } from '../shared/constants.js';

/**
 * Gather rich context from the textarea and surrounding page.
 * @param {HTMLTextAreaElement} textarea
 * @returns {object} pageContext for buildCompletionMessages
 */
export function gatherPageContext(textarea) {
  const ctx = {
    pageTitle: document.title || '',
    pageUrl: window.location.href || '',
  };

  // Textarea placeholder / label
  if (textarea.placeholder) {
    ctx.fieldHint = textarea.placeholder;
  }
  const labelEl = textarea.labels?.[0] || (textarea.id && document.querySelector(`label[for="${textarea.id}"]`));
  if (labelEl) {
    ctx.fieldLabel = labelEl.textContent.trim();
  }

  // Nearby form fields (sibling inputs with values)
  const form = textarea.closest('form');
  if (form) {
    const fields = [];
    for (const el of form.elements) {
      if (el === textarea) continue;
      if ((el.tagName === 'INPUT' || el.tagName === 'SELECT') && el.value && el.type !== 'hidden' && el.type !== 'password') {
        const name = el.labels?.[0]?.textContent?.trim() || el.placeholder || el.name || '';
        if (name && el.value.length < 200) {
          fields.push(`${name}: ${el.value}`);
        }
      }
    }
    if (fields.length > 0) {
      ctx.formFields = fields.slice(0, 5); // max 5 fields
    }
  }

  // Surrounding page text (nearest parent section or article, trimmed)
  const container = textarea.closest('article, section, [role="main"], main, .comment-body, .issue-body') || textarea.parentElement;
  if (container) {
    const text = container.innerText || container.textContent || '';
    // Take first 500 chars of surrounding text, excluding the textarea's own content
    const surrounding = text.replaceAll(textarea.value, '').trim().substring(0, 500);
    if (surrounding.length > 20) {
      ctx.surroundingText = surrounding;
    }
  }

  return ctx;
}

export function buildCompletionMessages(text, pageContext = {}) {
  const truncated = text.length > AUTOSUGGEST.MAX_CONTEXT_CHARS
    ? text.slice(-AUTOSUGGEST.MAX_CONTEXT_CHARS)
    : text;

  let systemPrompt = `You are an inline autocomplete engine. Given the text the user has typed so far, predict what they will type next. Rules:
- Output ONLY the predicted continuation text, nothing else
- No quotes, no explanations, no markdown
- Keep suggestions short (1-15 words)
- Match the user's tone, style, and language
- If at a sentence boundary, suggest the start of the next sentence
- If mid-sentence, complete the current thought`;

  // Add context lines
  const contextLines = [];
  if (pageContext.pageTitle) contextLines.push(`Page: "${pageContext.pageTitle}"`);
  if (pageContext.pageUrl) contextLines.push(`URL: ${pageContext.pageUrl}`);
  if (pageContext.fieldLabel) contextLines.push(`Field: "${pageContext.fieldLabel}"`);
  if (pageContext.fieldHint) contextLines.push(`Placeholder: "${pageContext.fieldHint}"`);
  if (pageContext.formFields) contextLines.push(`Other fields: ${pageContext.formFields.join('; ')}`);
  if (pageContext.surroundingText) contextLines.push(`Surrounding text: "${pageContext.surroundingText}"`);

  if (contextLines.length > 0) {
    systemPrompt += '\n\nContext:\n' + contextLines.map(l => '- ' + l).join('\n');
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: truncated },
  ];
}
