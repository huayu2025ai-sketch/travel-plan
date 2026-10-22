import { describe, expect, it } from 'vitest';
import { buildMarkdown } from '../../src/utils/export.js';
import { normalizeImportedPlan } from '../../src/utils/plan-normalize.js';
import { withComputedBudget } from '../../src/utils/plan.js';
import { getDayDateInfo } from '../../src/utils/date.js';
import { getWeatherCoverage } from '../../src/utils/plan-weather.js';

const plan = () => ({
  destination: '杭州', start_date: '2026-12-31', recommended_transport: '步行',
  itinerary: { 'Day 1': [{ id: 'lake', title: '西湖', type: '景点', cost: '免费' }], 'Day 2': [] },
  weather: { 'Day 1': '晴 5-12°C', 'Day 2': '阴 6-13°C' },
  weather_context: { destination: '杭州', start_date: '2026-12-31', days: 2, location_label: '杭州市 浙江省 中国', updated_at: '2026-12-30T08:00:00.000Z' },
});

describe('dated weather import and export', () => {
  it('round trips JSON dates, daily weather and query metadata', () => {
    const serialized = JSON.stringify(withComputedBudget(plan()));
    expect(JSON.parse(serialized).start_date).toBe('2026-12-31');
    const imported = normalizeImportedPlan(JSON.parse(serialized));
    expect(imported.weather).toEqual(plan().weather);
    expect(imported.weather_context).toEqual(plan().weather_context);
    expect(getDayDateInfo(imported.start_date, 'Day 2').inputValue).toBe('2027-01-01');
    expect(getWeatherCoverage(imported)).toEqual({ start_date: '2026-12-31', end_date: '2027-01-01', location_label: '杭州市 浙江省 中国', updated_at: '2026-12-30T08:00:00.000Z' });
  });

  it('preserves weather correspondence when imported day keys are renumbered', () => {
    const imported = normalizeImportedPlan({ ...plan(), itinerary: { 'Day 3': [], 'Day 9': [] }, weather: { 'Day 3': '晴', 'Day 9': '阴' } });
    expect(imported.weather).toEqual({ 'Day 1': '晴', 'Day 2': '阴' });
  });

  it.each([{ destination: '北京' }, { start_date: '2027-01-02' }])('clears weather for a different trip on import: %j', (change) => {
    const imported = normalizeImportedPlan({ ...plan(), ...change });
    expect(Object.values(imported.weather).every((weather) => weather === '')).toBe(true);
    expect(imported.weather_context).toBeNull();
  });

  it('supports legacy weather without context and ignores malformed weather fields', () => {
    const imported = normalizeImportedPlan({ ...plan(), weather_context: null, weather: { 'Day 1': ' 晴 ', 'Day 2': { text: '阴' } } });
    expect(imported.weather).toEqual({ 'Day 1': '晴', 'Day 2': '' });
    expect(getWeatherCoverage(imported).end_date).toBe('2026-12-31');
    expect(getWeatherCoverage(imported).updated_at).toBe('');
    const malformedTime = normalizeImportedPlan({ ...plan(), weather_context: { ...plan().weather_context, updated_at: 'invalid' } });
    expect(malformedTime.weather_context.updated_at).toBeUndefined();
  });

  it('exports daily dates and weather even for an empty day in Markdown', () => {
    const markdown = buildMarkdown(withComputedBudget(plan()));
    expect(markdown).toContain('## Day 1（2026-12-31 星期四）');
    expect(markdown).toContain('## Day 2（2027-01-01 星期五）');
    expect(markdown).toContain('- 天气：晴 5-12°C');
    expect(markdown).toContain('- 天气：阴 6-13°C');
    expect(markdown).toContain('2026-12-31～2027-01-01 · 杭州市 浙江省 中国');
    expect(markdown).toContain('天气更新时间：2026-12-30T08:00:00.000Z');
  });

  it('omits stale weather and its coverage from Markdown', () => {
    const markdown = buildMarkdown({ ...plan(), start_date: '2027-01-02' });
    expect(markdown).not.toContain('天气');
    expect(markdown).toContain('2027-01-02');
  });
});
