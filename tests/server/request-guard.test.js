// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import {
  checkGenerateRateLimit,
  createPublicError,
  maxHistoryContentCharacters,
  maxHistoryItems,
  maxIdeaCharacters,
  maxItineraryDays,
  maxItineraryItems,
  recordGenerateHit,
  toPublicApiError,
  validateGenerateRequest,
} from '../../server/request-guard.js';

describe('validateGenerateRequest', () => {
  it('normalizes a valid request and applies the default context values', () => {
    expect(validateGenerateRequest({ idea: '  去杭州  ' })).toEqual({
      idea: '去杭州',
      currentPlan: null,
      history: [],
    });
  });

  it('rejects structural mistakes', () => {
    expect(() => validateGenerateRequest({ idea: 123 })).toThrow('旅行想法格式不正确');
    expectRequestError(() => validateGenerateRequest({ idea: '   ' }), 400);
    expectRequestError(() => validateGenerateRequest({ idea: '优化行程', history: 'not-an-array' }), 400);
    expectRequestError(() =>
      validateGenerateRequest({
        idea: '优化行程',
        history: [{ role: 'user', content: 42 }],
      }),
      400);
  });

  it('truncates an oversized idea instead of rejecting it', () => {
    const result = validateGenerateRequest({ idea: `a`.repeat(maxIdeaCharacters + 500) });

    expect(result.idea).toHaveLength(maxIdeaCharacters);
  });

  it('keeps only the latest history items and truncates each content', () => {
    const history = Array.from({ length: maxHistoryItems + 3 }, (_, index) => ({
      role: 'user',
      content: `第${index}条${'x'.repeat(maxHistoryContentCharacters)}`,
    }));

    const result = validateGenerateRequest({ idea: '优化行程', history });

    expect(result.history).toHaveLength(maxHistoryItems);
    result.history.forEach((item) => {
      expect(item.content).toHaveLength(maxHistoryContentCharacters);
    });
    expect(result.history.at(-1).content).toContain('第10条');
  });

  it('clamps an oversized itinerary to the supported day and item limits', () => {
    const cardsPerDay = 20;
    const itinerary = Object.fromEntries(
      Array.from({ length: maxItineraryDays + 5 }, (_, index) => [
        `Day ${index + 1}`,
        Array.from({ length: cardsPerDay }, (_, cardIndex) => ({ id: `card-${index}-${cardIndex}` })),
      ]),
    );

    const result = validateGenerateRequest({ idea: '优化行程', currentPlan: { itinerary } });

    const days = Object.keys(result.currentPlan.itinerary);
    expect(days).toHaveLength(maxItineraryDays);
    expect(Object.values(result.currentPlan.itinerary).flat()).toHaveLength(maxItineraryItems);
    expect(days.at(-1)).toBe(`Day ${maxItineraryDays}`);
  });
});

describe('generate rate limit', () => {
  afterEach(() => {
    delete process.env.TRUST_PROXY;
    delete process.env.VERCEL;
  });

  it('rejects the sixth successful request from one client', () => {
    const request = { socket: { remoteAddress: '198.51.100.42' } };

    for (let index = 0; index < 5; index += 1) {
      expect(checkGenerateRateLimit(request).allowed).toBe(true);
      recordGenerateHit(request);
    }

    expect(checkGenerateRateLimit(request)).toMatchObject({ allowed: false });
    expect(checkGenerateRateLimit(request).retryAfterSeconds).toBeGreaterThan(0);
  });

  it('does not consume quota until a hit is recorded', () => {
    const request = { socket: { remoteAddress: '198.51.100.7' } };

    for (let index = 0; index < 20; index += 1) {
      expect(checkGenerateRateLimit(request).allowed).toBe(true);
    }

    recordGenerateHit(request);
    expect(checkGenerateRateLimit(request).allowed).toBe(true);
  });

  it('keeps quotas separate for different client IPs', () => {
    const firstClient = { socket: { remoteAddress: '198.51.100.20' } };
    const secondClient = { socket: { remoteAddress: '198.51.100.21' } };

    for (let index = 0; index < 5; index += 1) {
      recordGenerateHit(firstClient);
    }

    expect(checkGenerateRateLimit(firstClient).allowed).toBe(false);
    expect(checkGenerateRateLimit(secondClient).allowed).toBe(true);
  });

  it('ignores spoofed forwarded headers when the proxy is not trusted', () => {
    const first = { socket: { remoteAddress: '203.0.113.9' }, headers: { 'x-real-ip': '1.2.3.4' } };
    const second = { socket: { remoteAddress: '203.0.113.9' }, headers: { 'x-real-ip': '5.6.7.8' } };

    for (let index = 0; index < 5; index += 1) {
      recordGenerateHit(first);
    }

    expect(checkGenerateRateLimit(first).allowed).toBe(false);
    // 伪造头换不出新配额：键只来自 socket 地址
    expect(checkGenerateRateLimit(second).allowed).toBe(false);
  });

  it('trusts proxy headers only when TRUST_PROXY is enabled', () => {
    process.env.TRUST_PROXY = '1';

    const behindProxy = { socket: { remoteAddress: '10.0.0.2' }, headers: { 'x-real-ip': '198.51.100.10' } };

    for (let index = 0; index < 5; index += 1) {
      recordGenerateHit(behindProxy);
    }

    expect(checkGenerateRateLimit(behindProxy).allowed).toBe(false);
    expect(checkGenerateRateLimit({ socket: { remoteAddress: '10.0.0.2' } }).allowed).toBe(true);
  });

  it('uses Vercel’s platform-overwritten client IP header automatically', () => {
    process.env.VERCEL = '1';
    const client = {
      socket: { remoteAddress: '10.0.0.2' },
      headers: { 'x-forwarded-for': '198.51.100.30' },
    };

    for (let index = 0; index < 5; index += 1) {
      recordGenerateHit(client);
    }

    expect(checkGenerateRateLimit(client).allowed).toBe(false);
    expect(checkGenerateRateLimit({
      socket: { remoteAddress: '10.0.0.2' },
      headers: { 'x-forwarded-for': '198.51.100.31' },
    }).allowed).toBe(true);
  });
});

describe('toPublicApiError', () => {
  it('hides details from unexpected errors', () => {
    const result = toPublicApiError(new Error('internal database details'));

    expect(result).toEqual({
      status: 500,
      body: { error: '生成行程失败，请稍后重试。' },
    });
  });

  it('keeps known client-facing errors', () => {
    expect(toPublicApiError(Object.assign(new Error('请求过于频繁，请稍后再试。'), { status: 429, expose: true }))).toEqual({
      status: 429,
      body: { error: '请求过于频繁，请稍后再试。' },
    });
  });

  it('marks intentionally public errors via createPublicError', () => {
    const error = createPublicError('缺少 DEEPSEEK_API_KEY。', 500);

    expect(error.expose).toBe(true);
    expect(toPublicApiError(error)).toEqual({
      status: 500,
      body: { error: '缺少 DEEPSEEK_API_KEY。' },
    });
  });
});

function expectRequestError(action, status) {
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ status });
    return;
  }

  throw new Error(`Expected request error with status ${status}`);
}
