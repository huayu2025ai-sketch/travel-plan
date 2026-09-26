// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { formatCostAmount, getBudgetRange, parseCostEstimate } from '../../src/utils/plan.js';

describe('budget estimates', () => {
  it('parses ranges without discarding the upper bound', () => {
    expect(parseCostEstimate('200-300元')).toMatchObject({ min: 200, max: 300 });
    expect(formatCostAmount('200-300')).toBe('200-300元');
  });

  it('multiplies an explicit per-night rate by its quantity', () => {
    expect(parseCostEstimate('260元/晚 × 3晚')).toMatchObject({ min: 780, max: 780 });
  });

  it('reports exact known totals and counts unknown items separately', () => {
    expect(getBudgetRange({ Day1: [{ cost: '200-300元' }, { cost: '待估算' }] })).toBe('200-300元（另有1项待估）');
    expect(getBudgetRange({ Day1: [{ cost: '免费' }, { cost: '260元/晚 x 3晚' }] })).toBe('780元');
    expect(getBudgetRange({ Day1: [{ cost: '待估算' }] })).toBe('待估算（1项）');
  });
});
