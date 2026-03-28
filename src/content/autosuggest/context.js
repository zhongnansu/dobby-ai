// src/content/autosuggest/context.js — Builds OpenAI chat-format messages for completion
import { AUTOSUGGEST } from '../shared/constants.js';

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

  if (pageContext.pageTitle) {
    systemPrompt += `\n- Context: user is on "${pageContext.pageTitle}"`;
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: truncated },
  ];
}
