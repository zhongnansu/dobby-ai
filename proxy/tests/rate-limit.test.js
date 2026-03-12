// proxy/tests/rate-limit.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit, incrementCounters } from '../src/rate-limit.js';

function createMockKV(data = {}) {
  const store = { ...data };
  return {
    get: vi.fn((key) => Promise.resolve(store[key] || null)),
    put: vi.fn((key, value, opts) => {
      store[key] = String(value);
      return Promise.resolve();
    }),
    _store: store,
  };
}

describe('checkRateLimit', () => {
  it('allows first request from new IP', async () => {
    const kv = createMockKV();
    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });

  it('blocks after 5 requests per minute', async () => {
    const kv = createMockKV();
    // Simulate 5 requests already made this minute
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:min:')) return Promise.resolve('5');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('per-minute');
    expect(result.retryAfter).toBeDefined();
  });

  it('blocks after 30 requests per day', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:day:')) return Promise.resolve('30');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily');
    expect(result.remaining).toBe(0);
  });

  it('blocks when global daily cap reached', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:global:')) return Promise.resolve('5000');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('busy');
  });

  it('blocks IP on abuse list', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key === 'blocked:1.2.3.4') return Promise.resolve('1');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('returns remaining count', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:day:')) return Promise.resolve('10');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(19);
  });
});

describe('incrementCounters', () => {
  it('increments minute, day, and global counters', async () => {
    const kv = createMockKV();
    await incrementCounters('1.2.3.4', kv);

    expect(kv.put).toHaveBeenCalledTimes(4);
    // Verify minute counter
    const minuteCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:min:'));
    expect(minuteCall).toBeDefined();
    expect(minuteCall[1]).toBe('1');
    expect(minuteCall[2]).toEqual({ expirationTtl: 120 });

    // Verify day counter
    const dayCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:day:'));
    expect(dayCall).toBeDefined();
    expect(dayCall[2]).toEqual({ expirationTtl: 86400 });

    // Verify global counter
    const globalCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:global:'));
    expect(globalCall).toBeDefined();
  });

  it('increments existing counters', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:min:')) return Promise.resolve('3');
      if (key.startsWith('rl:day:')) return Promise.resolve('15');
      if (key.startsWith('rl:global:')) return Promise.resolve('100');
      return Promise.resolve(null);
    });

    await incrementCounters('1.2.3.4', kv);

    const minuteCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:min:'));
    expect(minuteCall[1]).toBe('4');
    const dayCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:day:'));
    expect(dayCall[1]).toBe('16');
  });

  it('blocks IP after 10+ requests in 10s window', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:10s:')) return Promise.resolve('9');
      return Promise.resolve(null);
    });
    await incrementCounters('1.2.3.4', kv);
    const blockCall = kv.put.mock.calls.find((c) => c[0] === 'blocked:1.2.3.4');
    expect(blockCall).toBeDefined();
    expect(blockCall[2]).toEqual({ expirationTtl: 3600 });
  });
});
