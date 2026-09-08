// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  checkGenerateRateLimit,
  maxIdeaCharacters,
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

  it('rejects a non-string or oversized idea', () => {
    expect(() => validateGenerateRequest({ idea: 123 })).toThrow('旅行想法格式不正确');
    expectRequestError(() => validateGenerateRequest({ idea: 'a'.repeat(maxIdeaCharacters + 1) }), 413);
  });

  it('rejects oversized history and itinerary context', () => {
    expectRequestError(() =>
      validateGenerateRequest({
        idea: '优化行程',
        history: Array.from({ length: 9 }, () => ({ role: 'user', content: '继续' })),
      }),
    413);

    expectRequestError(() =>
      validateGenerateRequest({
        idea: '优化行程',
        currentPlan: {
          itinerary: Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`Day ${index + 1}`, []])),
        },
      }),
    413);
  });
});

describe('checkGenerateRateLimit', () => {
  it('allows five requests and rejects the sixth request from one client', () => {
    const request = { headers: { 'x-forwarded-for': '198.51.100.42' } };

    for (let index = 0; index < 5; index += 1) {
      expect(checkGenerateRateLimit(request).allowed).toBe(true);
    }

    expect(checkGenerateRateLimit(request)).toMatchObject({
      allowed: false,
    });
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
