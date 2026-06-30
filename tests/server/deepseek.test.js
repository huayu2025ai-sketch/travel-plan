// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateTravelPlan, normalizePlan } from '../../server/deepseek.js';

describe('generateTravelPlan', () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DEEPSEEK_API_KEY;
  });

  it('rejects with a 400 error when idea is empty', async () => {
    await expect(generateTravelPlan('', {})).rejects.toMatchObject({
      status: 400,
      message: '请输入旅行想法。',
    });
  });

  it('rejects with a 400 error when idea is whitespace only', async () => {
    await expect(generateTravelPlan('   ', {})).rejects.toMatchObject({
      status: 400,
      message: '请输入旅行想法。',
    });
  });

  it('rejects with a 500 error when DEEPSEEK_API_KEY is missing', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    await expect(generateTravelPlan('去北京', {})).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining('DEEPSEEK_API_KEY'),
    });
  });

  it('returns a normalized plan when the API responds with valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  start_date: '2026-10-21',
                  weather: {
                    'Day 1': '晴 18-26°C',
                  },
                  itinerary: {
                    'Day 1': [
                      {
                        id: 'day1-transport',
                        type: '交通',
                        title: '高铁',
                        cost: '360元',
                        duration: '2.5小时',
                        advice: '提前订票',
                      },
                    ],
                  },
                }),
              },
            },
          ],
        }),
      }),
    );

    const result = await generateTravelPlan('北京五日游', {});

    expect(result.start_date).toBe('2026-10-21');
    expect(result.weather['Day 1']).toBe('晴 18-26°C');
    expect(result.itinerary['Day 1'][0]).toMatchObject({
      id: 'day1-transport',
      type: '交通',
      title: '高铁',
    });
  });

  it('includes the current plan and recent history in the prompt', async () => {
    const bodyCapture = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, options) => {
        bodyCapture(JSON.parse(options.body));
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(''),
          json: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    itinerary: { 'Day 1': [{ type: '景点', title: '故宫' }] },
                  }),
                },
              },
            ],
          }),
        });
      }),
    );

    await generateTravelPlan('更省钱一点', {
      currentPlan: { start_date: '2026-10-21', itinerary: { 'Day 1': [] } },
      history: [{ role: 'user', content: '原计划是什么' }],
    });

    const requestBody = bodyCapture.mock.calls[0][0];
    expect(JSON.stringify(requestBody.messages)).toContain('当前行程草案');
    expect(JSON.stringify(requestBody.messages)).toContain('最近沟通记录');
    expect(JSON.stringify(requestBody.messages)).toContain('原计划是什么');
    expect(JSON.stringify(requestBody.messages)).toContain('weather');
  });

  it('retries once on a 5xx response and returns the normalized plan on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: vi.fn().mockResolvedValue('Internal Server Error'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(''),
          json: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    itinerary: {
                      'Day 1': [{ type: '景点', title: '故宫' }],
                    },
                  }),
                },
              },
            ],
          }),
        }),
    );

    const result = await generateTravelPlan('北京', {});
    expect(result.itinerary['Day 1'][0].title).toBe('故宫');
  });

  it('throws a 502 error when the API response is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'not valid json',
              },
            },
          ],
        }),
      }),
    );

    await expect(generateTravelPlan('北京', {})).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('JSON'),
    });
  });

  it('throws a friendly 502 error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net error')));

    await expect(generateTravelPlan('北京', {})).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('DeepSeek API'),
    });
  });
});

describe('normalizePlan', () => {
  it('normalizes a valid plan into the expected shape', () => {
    const plan = {
      start_date: '2026-10-21',
      total_budget_estimate: '2000元',
      recommended_transport: '高铁',
      weather: {
        'Day 1': '晴 18-26°C',
      },
      itinerary: {
        'Day 1': [
          {
            id: 'day1-slot-1',
            type: '景点',
            title: '故宫',
            cost: '60元',
            duration: '3小时',
            advice: '早去',
          },
        ],
      },
    };

    const result = normalizePlan(plan);
    expect(result).toMatchObject({
      start_date: '2026-10-21',
      total_budget_estimate: '2000元',
      recommended_transport: '高铁',
      weather: {
        'Day 1': '晴 18-26°C',
      },
      itinerary: {
        'Day 1': [
          {
            id: 'day1-slot-1',
            type: '景点',
            title: '故宫',
            cost: '60元',
            duration: '3小时',
            advice: '早去',
          },
        ],
      },
    });
  });

  it('falls back invalid item types to 景点', () => {
    const result = normalizePlan({
      itinerary: {
        'Day 1': [{ type: '无效类型', title: '未知' }],
      },
    });
    expect(result.itinerary['Day 1'][0].type).toBe('景点');
  });

  it('normalizes missing weather to empty strings per day', () => {
    const result = normalizePlan({
      itinerary: {
        'Day 1': [{ type: '景点', title: '故宫' }],
        'Day 2': [{ type: '美食', title: '烤鸭' }],
      },
    });
    expect(result.weather['Day 1']).toBe('');
    expect(result.weather['Day 2']).toBe('');
  });

  it('ignores weather keys that do not match itinerary days', () => {
    const result = normalizePlan({
      weather: {
        'Day 1': '晴 18-26°C',
        'Day 9': '雨 12-18°C',
      },
      itinerary: {
        'Day 1': [{ type: '景点', title: '故宫' }],
      },
    });
    expect(result.weather['Day 1']).toBe('晴 18-26°C');
    expect(result.weather['Day 9']).toBeUndefined();
  });

  it('deduplicates item ids', () => {
    const result = normalizePlan({
      itinerary: {
        'Day 1': [
          { id: 'dup', type: '景点', title: 'A' },
          { id: 'dup', type: '美食', title: 'B' },
        ],
      },
    });
    expect(result.itinerary['Day 1'][0].id).toBe('dup');
    expect(result.itinerary['Day 1'][1].id).toBe('dup-2');
  });

  it('throws when the plan is not an object', () => {
    expect(() => normalizePlan(null)).toThrow('AI 返回内容不是有效对象。');
    expect(() => normalizePlan('not an object')).toThrow('AI 返回内容不是有效对象。');
  });

  it('throws when the plan has no itinerary', () => {
    expect(() => normalizePlan({ start_date: '2026-10-21' })).toThrow('缺少 itinerary');
  });
});
