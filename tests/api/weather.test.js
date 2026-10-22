// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/weather.js';
import { recordGenerateHit, resetGenerateLimitsForTests } from '../../server/request-guard.js';

const trip = { destination: '杭州', start_date: '2026-10-23', days: 2 };

function jsonResponse(data, ok = true) {
  return { ok, json: async () => data };
}

async function invoke(body, method = 'POST') {
  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(payload) { this.body = JSON.parse(payload); },
  };
  await handler({ method, body, socket: { remoteAddress: 'weather-client' } }, res);
  return res;
}

describe('api/weather', () => {
  beforeEach(() => {
    vi.stubEnv('QWEATHER_API_KEY', '');
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      if (String(input).includes('geocoding-api.open-meteo.com')) {
        return jsonResponse({ results: [{ name: '杭州', latitude: 30.29, longitude: 120.16 }] });
      }
      if (String(input).includes('api.open-meteo.com/v1/forecast')) {
        return jsonResponse({ daily: { time: ['2026-10-23', '2026-10-24'], weather_code: [0, 3], temperature_2m_min: [15, 16], temperature_2m_max: [22, 23], precipitation_probability_max: [0, 80], precipitation_sum: [0, 5] } });
      }
      throw new Error('Unexpected upstream request');
    }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetGenerateLimitsForTests();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('refreshes weather without an AI key and disables response caching', async () => {
    const response = await invoke(trip);
    expect(response.statusCode).toBe(200);
    expect(response.headers['Cache-Control']).toBe('no-store');
    expect(response.body).toMatchObject({
      weather: { 'Day 1': '晴 15-22°C', 'Day 2': '多云 16-23°C 降水概率80%' },
      weather_context: { ...trip, updated_at: expect.any(String) },
      available_days: 2,
    });
    expect(Number.isFinite(Date.parse(response.body.weather_context.updated_at))).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported methods', async () => {
    const response = await invoke(null, 'GET');
    expect(response.statusCode).toBe(405);
    expect(response.headers.Allow).toBe('POST');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    {}, { ...trip, destination: '' }, { ...trip, start_date: '' },
    { ...trip, start_date: '2026-02-30' }, { ...trip, days: 17 }, { ...trip, days: 1.5 },
  ])('rejects invalid trip context before upstream calls: %j', async (body) => {
    const response = await invoke(body);
    expect(response.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports unavailable forecasts rather than returning an empty success', async () => {
    fetch.mockResolvedValue(jsonResponse({}, false));
    const response = await invoke(trip);
    expect(response.statusCode).toBe(422);
    expect(response.body.error).toContain('所选日期暂无可用天气');
    expect(response.body.weather).toBeUndefined();
  });

  it('resolves Chinese city names before similarly named towns and exposes the matched region', async () => {
    fetch.mockImplementation(async (input) => {
      const url = new URL(input);
      if (url.hostname === 'geocoding-api.open-meteo.com') {
        return jsonResponse({ results: url.searchParams.get('name') === '洛阳市'
          ? [{ name: '洛阳市', admin1: '河南', country: '中国', latitude: 34.67, longitude: 112.44 }]
          : [{ name: '洛阳', admin1: '福建', latitude: 24.96, longitude: 118.68 }] });
      }
      expect(url.searchParams.get('latitude')).toBe('34.67');
      expect(url.searchParams.get('longitude')).toBe('112.44');
      return jsonResponse({ daily: { time: ['2026-10-23'], weather_code: [0], temperature_2m_min: [10], temperature_2m_max: [20] } });
    });
    const response = await invoke({ ...trip, destination: '洛阳', days: 1 });
    expect(response.statusCode).toBe(200);
    expect(response.body.weather_context.location_label).toBe('洛阳市 · 河南 · 中国');
  });

  it('retries the original name when the Chinese city suffix has no matches', async () => {
    const defaultFetch = fetch.getMockImplementation();
    fetch.mockImplementation(async (input, options) => {
      const url = new URL(input);
      if (url.searchParams.get('name') === '杭州市') return jsonResponse({ results: [] });
      return defaultFetch(input, options);
    });
    expect((await invoke(trip)).statusCode).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('enforces a separate weather quota, including failed attempts', async () => {
    const req = { socket: { remoteAddress: 'weather-client' } };
    for (let index = 0; index < 5; index += 1) recordGenerateHit(req);
    fetch.mockResolvedValue(jsonResponse({}, false));
    for (let index = 0; index < 30; index += 1) {
      expect((await invoke(trip)).statusCode).toBe(422);
    }
    const response = await invoke(trip);
    expect(response.statusCode).toBe(429);
    expect(Number(response.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('rejects malformed JSON and oversized bodies', async () => {
    expect((await invoke('{')).statusCode).toBe(400);
    expect((await invoke({ ...trip, ignored: 'x'.repeat(1024 * 1024) })).statusCode).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
});
