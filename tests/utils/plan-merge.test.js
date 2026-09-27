// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { preserveConcurrentPlanEdits } from '../../src/utils/plan-merge.js';
import { getPlanWeather, updatePlanDayDate } from '../../src/utils/plan-weather.js';

describe('concurrent itinerary edits', () => {
  it('keeps manual itinerary changes while accepting generated untouched fields', () => {
    const base = { destination: '杭州', start_date: '2026-10-01', recommended_transport: '高铁', itinerary: { 'Day 1': [{ id: 'a' }] } };
    const current = { ...base, itinerary: { 'Day 1': [{ id: 'a', title: '手动修改' }] } };
    const generated = { ...base, destination: '杭州', recommended_transport: '地铁', itinerary: { 'Day 1': [{ id: 'new' }] }, weather: { 'Day 1': '晴' } };
    const merged = preserveConcurrentPlanEdits(base, current, generated);

    expect(merged.itinerary).toEqual(current.itinerary);
    expect(merged.recommended_transport).toBe('地铁');
  });
});

describe('weather date validity', () => {
  const plan = {
    destination: '杭州',
    start_date: '2026-10-01',
    weather: { 'Day 1': '晴 18-25°C' },
    weather_context: { destination: '杭州', start_date: '2026-10-01' },
  };

  it('invalidates weather when the trip date changes', () => {
    expect(updatePlanDayDate(plan, 'Day 1', '2026-10-02')).toMatchObject({ start_date: '2026-10-02', weather: {}, weather_context: null });
  });

  it('hides weather whose destination or date no longer matches its forecast context', () => {
    expect(getPlanWeather(plan, 'Day 1')).toBe('晴 18-25°C');
    expect(getPlanWeather({ ...plan, start_date: '2026-10-02' }, 'Day 1')).toBe('');
  });
});
