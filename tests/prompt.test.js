// tests/prompt.test.js
import { buildChatMessages, buildFollowUp, MAX_TEXT_LENGTH } from '../prompt.js';

describe('MAX_TEXT_LENGTH', () => {
  it('is 6000', () => {
    expect(MAX_TEXT_LENGTH).toBe(6000);
  });
});

describe('buildChatMessages', () => {
  it('returns messages array with user message', () => {
    const result = buildChatMessages('hello world', '', false);
    expect(result).toEqual([{ role: 'user', content: 'hello world' }]);
  });

  it('adds system message when instruction is provided', () => {
    const result = buildChatMessages('code here', 'Explain this code', false);
    expect(result).toEqual([
      { role: 'system', content: 'Explain this code' },
      { role: 'user', content: 'code here' },
    ]);
  });

  it('skips system message for empty instruction', () => {
    const result = buildChatMessages('text', '', false);
    expect(result.length).toBe(1);
    expect(result[0].role).toBe('user');
  });

  it('skips system message for null instruction', () => {
    const result = buildChatMessages('text', null, false);
    expect(result.length).toBe(1);
  });

  it('truncates text longer than MAX_TEXT_LENGTH', () => {
    const longText = 'a'.repeat(MAX_TEXT_LENGTH + 500);
    const result = buildChatMessages(longText, '', false);
    expect(result[0].content.length).toBe(MAX_TEXT_LENGTH + '...[truncated]'.length);
    expect(result[0].content).toContain('...[truncated]');
  });

  it('does not truncate text at MAX_TEXT_LENGTH exactly', () => {
    const text = 'a'.repeat(MAX_TEXT_LENGTH);
    const result = buildChatMessages(text, '', false);
    expect(result[0].content).toBe(text);
  });

  it('appends page context when includePageContext is true', () => {
    const result = buildChatMessages('hello', '', true);
    expect(result[0].content).toContain('From:');
  });

  it('does not append page context when false', () => {
    const result = buildChatMessages('hello', '', false);
    expect(result[0].content).not.toContain('From:');
  });

  it('preserves whitespace and newlines', () => {
    const text = '  line one\n  line two';
    const result = buildChatMessages(text, '', false);
    expect(result[0].content).toBe(text);
  });
});

describe('buildFollowUp', () => {
  it('appends user message to existing conversation', () => {
    const existing = [
      { role: 'system', content: 'Explain' },
      { role: 'user', content: 'code here' },
      { role: 'assistant', content: 'This code does...' },
    ];
    const result = buildFollowUp(existing, 'Can you simplify it?');
    expect(result.length).toBe(4);
    expect(result[3]).toEqual({ role: 'user', content: 'Can you simplify it?' });
  });

  it('does not mutate the original array', () => {
    const existing = [{ role: 'user', content: 'hi' }];
    const result = buildFollowUp(existing, 'follow up');
    expect(existing.length).toBe(1);
    expect(result.length).toBe(2);
  });

  it('works with empty conversation', () => {
    const result = buildFollowUp([], 'hello');
    expect(result).toEqual([{ role: 'user', content: 'hello' }]);
  });
});
