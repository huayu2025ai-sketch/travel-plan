// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const { generateTravelPlan } = vi.hoisted(() => ({
  generateTravelPlan: vi.fn(),
}));

vi.mock('../../server/deepseek.js', () => ({ generateTravelPlan }));

import handler from '../../api/generate.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function createRequest(body, ip = '203.0.113.10') {
  return {
    method: 'POST',
    body,
    headers: { 'x-real-ip': ip },
  };
}

describe('api/generate handler', () => {
  afterEach(() => {
    generateTravelPlan.mockReset();
  });

  it('returns 405 for unsupported methods', async () => {
    const response = createResponse();

    await handler({ method: 'GET' }, response);

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({ error: 'Method Not Allowed' });
  });

  it('validates input before calling the generation service', async () => {
    const response = createResponse();

    await handler(createRequest({ idea: 'a'.repeat(2001) }, '203.0.113.11'), response);

    expect(response.statusCode).toBe(413);
    expect(response.body).toEqual({ error: '旅行想法不能超过 2000 个字符。' });
    expect(generateTravelPlan).not.toHaveBeenCalled();
  });

  it('returns the generated plan for a valid request', async () => {
    const plan = { itinerary: { 'Day 1': [] } };
    generateTravelPlan.mockResolvedValue(plan);
    const response = createResponse();

    await handler(createRequest({ idea: '去杭州两日游', history: [] }, '203.0.113.12'), response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(plan);
    expect(generateTravelPlan).toHaveBeenCalledWith('去杭州两日游', { currentPlan: null, history: [] });
  });

  it('consolidates unexpected service errors without exposing details', async () => {
    generateTravelPlan.mockRejectedValue(Object.assign(new Error('database password leaked'), { status: 500, detail: 'raw upstream payload' }));
    const response = createResponse();

    await handler(createRequest({ idea: '去杭州' }, '203.0.113.13'), response);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: '生成行程失败，请稍后重试。' });
    expect(response.body.detail).toBeUndefined();
  });
});
