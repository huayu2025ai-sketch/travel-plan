// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleGenerateRequest } from '../../server/generate-handler.js';
import { resetGenerateLimitsForTests } from '../../server/request-guard.js';

vi.mock('../../server/deepseek.js', () => ({
  generateTravelPlan: vi.fn(),
}));

const { generateTravelPlan } = await import('../../server/deepseek.js');

describe('generate request reservations', () => {
  afterEach(() => {
    resetGenerateLimitsForTests();
    vi.resetAllMocks();
  });

  it('caps concurrent requests from one client at five', async () => {
    generateTravelPlan.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { itinerary: { 'Day 1': [] } };
    });

    const responses = await Promise.all(Array.from({ length: 8 }, () => invoke({ idea: '去杭州' }, 'same-client')));
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 200, 200, 200, 200, 429, 429, 429]);
    expect(generateTravelPlan).toHaveBeenCalledTimes(5);
  });

  it('releases a reserved slot after upstream failure', async () => {
    generateTravelPlan.mockRejectedValueOnce(new Error('upstream failed')).mockResolvedValue({ itinerary: { 'Day 1': [] } });
    expect((await invoke({ idea: '去杭州' }, 'retry-client')).statusCode).toBe(500);
    expect((await invoke({ idea: '去杭州' }, 'retry-client')).statusCode).toBe(200);
  });

  it('rejects already parsed bodies larger than the request limit', async () => {
    const response = await invoke({ idea: '去杭州', ignored: 'x'.repeat(1024 * 1024 + 10) }, 'large-body-client');
    expect(response.statusCode).toBe(413);
    expect(generateTravelPlan).not.toHaveBeenCalled();
  });
});

async function invoke(body, ip) {
  const response = {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(payload) { this.body = payload; },
  };
  await handleGenerateRequest({ body, socket: { remoteAddress: ip }, headers: {} }, response);
  return response;
}
