// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const { generateTravelPlan } = vi.hoisted(() => ({
  generateTravelPlan: vi.fn(),
}));

vi.mock('../../server/deepseek.js', () => ({ generateTravelPlan }));
vi.mock('../../server/request-guard.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, recordGenerateHit: vi.fn() };
});

import handler from '../../api/generate.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      this.body = payload == null ? null : JSON.parse(payload);
    },
  };
}

function createRequest(body, ip = '203.0.113.10') {
  return {
    method: 'POST',
    body,
    headers: { 'x-real-ip': ip },
    socket: { remoteAddress: ip },
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

  it('truncates oversized input before calling the generation service', async () => {
    generateTravelPlan.mockResolvedValue({ itinerary: {} });
    const response = createResponse();

    await handler(createRequest({ idea: 'a'.repeat(2001) }, '203.0.113.11'), response);

    expect(response.statusCode).toBe(200);
    const [, contextArg] = generateTravelPlan.mock.calls[0];
    expect(generateTravelPlan.mock.calls[0][0]).toHaveLength(2000);
    expect(contextArg).toEqual({ currentPlan: null, history: [] });
  });

  it('returns the generated plan for a valid request', async () => {
    const plan = { itinerary: { 'Day 1': [] } };
    generateTravelPlan.mockResolvedValue(plan);
    const response = createResponse();

    await handler(createRequest({ idea: '去杭州两日游', history: [] }, '203.0.113.12'), response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(plan);
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
