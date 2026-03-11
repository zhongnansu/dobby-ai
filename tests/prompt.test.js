import { buildPrompt, getAIUrl, MAX_TEXT_LENGTH, MAX_URL_LENGTH } from '../prompt.js';

describe('buildPrompt', () => {
  it('prepends instruction when provided', () => {
    const result = buildPrompt('hello world', 'Summarize the following', false);
    expect(result).toBe('Summarize the following:\n\nhello world');
  });

  it('returns raw text when no instruction is provided', () => {
    const result = buildPrompt('hello world', '', false);
    expect(result).toBe('hello world');
  });

  it('returns raw text when instruction is null/undefined', () => {
    const result = buildPrompt('hello world', null, false);
    expect(result).toBe('hello world');
  });

  it('truncates text longer than MAX_TEXT_LENGTH', () => {
    const longText = 'a'.repeat(MAX_TEXT_LENGTH + 500);
    const result = buildPrompt(longText, '', false);
    expect(result.length).toBe(MAX_TEXT_LENGTH + '...[truncated]'.length);
    expect(result).toContain('...[truncated]');
    expect(result.startsWith('a'.repeat(MAX_TEXT_LENGTH))).toBe(true);
  });

  it('truncates text before applying instruction', () => {
    const longText = 'x'.repeat(MAX_TEXT_LENGTH + 100);
    const result = buildPrompt(longText, 'Explain', false);
    expect(result).toContain('Explain:\n\n');
    expect(result).toContain('...[truncated]');
  });

  it('does NOT append page context when includePageContext is false', () => {
    const result = buildPrompt('hello', 'Explain', false);
    expect(result).toBe('Explain:\n\nhello');
    expect(result).not.toContain('From:');
  });

  it('appends page context when includePageContext is true (no document/window in Node)', () => {
    // In Node.js test environment, document and window are undefined
    // so title and url will be empty strings
    const result = buildPrompt('hello', 'Explain', true);
    expect(result).toContain('From:');
    expect(result).toBe('Explain:\n\nhello\n\nFrom: "" ()');
  });

  it('handles empty selectedText', () => {
    const result = buildPrompt('', 'Summarize', false);
    expect(result).toBe('Summarize:\n\n');
  });

  it('preserves whitespace and newlines in selected text', () => {
    const text = '  line one\n  line two\n  line three';
    const result = buildPrompt(text, '', false);
    expect(result).toBe(text);
  });
});

describe('getAIUrl', () => {
  it('returns a chatgpt URL with encoded prompt', () => {
    const result = getAIUrl('chatgpt', 'hello world');
    expect(result.url).toBe('https://chatgpt.com/?q=hello%20world');
    expect(result.fallback).toBe(false);
  });

  it('returns a claude URL with encoded prompt', () => {
    const result = getAIUrl('claude', 'hello world');
    expect(result.url).toBe('https://claude.ai/new?q=hello%20world');
    expect(result.fallback).toBe(false);
  });

  it('properly encodes special characters in the prompt', () => {
    const result = getAIUrl('chatgpt', 'what is 1+1?');
    expect(result.url).toContain('https://chatgpt.com/?q=');
    expect(result.fallback).toBe(false);
    expect(result.url).not.toContain(' ');
  });

  it('returns fallback when URL exceeds MAX_URL_LENGTH', () => {
    const longPrompt = 'a'.repeat(MAX_URL_LENGTH);
    const result = getAIUrl('chatgpt', longPrompt);
    expect(result.fallback).toBe(true);
    expect(result.url).toBe('https://chatgpt.com/');
    expect(result.prompt).toBe(longPrompt);
  });

  it('returns fallback for claude when URL exceeds MAX_URL_LENGTH', () => {
    const longPrompt = 'b'.repeat(MAX_URL_LENGTH);
    const result = getAIUrl('claude', longPrompt);
    expect(result.fallback).toBe(true);
    expect(result.url).toBe('https://claude.ai/new');
    expect(result.prompt).toBe(longPrompt);
  });

  it('does NOT return fallback when URL is just under the limit', () => {
    const baseLen = 'https://chatgpt.com/?q='.length;
    const promptLen = MAX_URL_LENGTH - baseLen;
    const prompt = 'a'.repeat(promptLen);
    const result = getAIUrl('chatgpt', prompt);
    expect(result.fallback).toBe(false);
    expect(result.url.length).toBe(MAX_URL_LENGTH);
  });

  it('does not include prompt property when fallback is false', () => {
    const result = getAIUrl('chatgpt', 'test');
    expect(result.prompt).toBeUndefined();
  });
});
