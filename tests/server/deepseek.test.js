// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { generateTravelPlan, normalizePlan } from '../../server/deepseek.js';

describe('generateTravelPlan', () => {
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
});

describe('normalizePlan', () => {
  it('normalizes a valid plan into the expected shape', () => {
    const plan = {
      start_date: '2026-10-21',
      total_budget_estimate: '2000元',
      recommended_transport: '高铁',
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

  it('throws when the plan is not an object', () => {
    expect(() => normalizePlan(null)).toThrow('AI 返回内容不是有效对象。');
    expect(() => normalizePlan('not an object')).toThrow('AI 返回内容不是有效对象。');
  });

  it('throws when the plan has no itinerary', () => {
    expect(() => normalizePlan({ start_date: '2026-10-21' })).toThrow('缺少 itinerary');
  });
});
