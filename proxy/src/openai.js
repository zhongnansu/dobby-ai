// proxy/src/openai.js
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4.1-mini';
const DEFAULT_MAX_TOKENS = 1000;

export async function createChatStream(messages, apiKey, signal, maxTokens) {
  return fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
    }),
    signal,
  });
}
