// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

describe('autosuggest context', () => {
  let buildCompletionMessages;

  beforeEach(async () => {
    const mod = await import('../src/content/autosuggest/context.js');
    buildCompletionMessages = mod.buildCompletionMessages;
  });

  it('builds messages with system prompt and user text', () => {
    const messages = buildCompletionMessages('The quick brown fox');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('autocomplete');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('The quick brown fox');
  });

  it('truncates long text to MAX_CONTEXT_CHARS from the end', () => {
    const longText = 'a'.repeat(3000) + 'IMPORTANT_END';
    const messages = buildCompletionMessages(longText);
    expect(messages[1].content).toContain('IMPORTANT_END');
    expect(messages[1].content.length).toBeLessThanOrEqual(2013); // 2000 + 'IMPORTANT_END'.length
  });

  it('includes page context when provided', () => {
    const messages = buildCompletionMessages('hello world text', {
      pageTitle: 'Gmail - Compose',
      pageUrl: 'https://mail.google.com',
    });
    expect(messages[0].content).toContain('Gmail - Compose');
  });

  it('works without page context', () => {
    const messages = buildCompletionMessages('hello world text');
    expect(messages[0].content).not.toContain('Context:');
  });
});
