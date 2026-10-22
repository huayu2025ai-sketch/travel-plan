// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPlanImageBlob } from '../../src/utils/plan-image.js';

let ctx;
let canvas;
let drawn;
const stop = (overrides = {}) => ({ title: '龙门石窟', type: '景点', duration: '14:30—17:30', advice: '需提前预约，重点游览西山。', ...overrides });
const plan = (itinerary) => ({ destination: '洛阳', start_date: '2026-10-30', total_budget_estimate: '1591元', recommended_transport: '高铁 + 市内网约车', itinerary });

beforeEach(() => {
  drawn = [];
  ctx = {
    font: '',
    measureText(text) {
      const size = Number(this.font.match(/(\d+)px/)?.[1] || 23);
      return { width: [...text].reduce((width, char) => width + size * (/[^\x00-\xff]/.test(char) ? 1 : 0.55), 0) };
    },
    fillText(text, x, y) { drawn.push({ text, x, y, width: this.measureText(text).width, align: this.textAlign }); },
  };
  for (const method of ['beginPath', 'moveTo', 'arcTo', 'closePath', 'fill', 'save', 'restore', 'clip', 'fillRect', 'stroke', 'arc', 'lineTo', 'translate', 'scale', 'ellipse']) ctx[method] = vi.fn();
  canvas = { getContext: () => ctx, toBlob: vi.fn((callback) => callback(new Blob(['png'], { type: 'image/png' }))) };
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => tag === 'canvas' ? canvas : createElement(tag));
  vi.stubGlobal('Path2D', class {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const texts = () => drawn.map(({ text }) => text);

describe('itinerary poster export', () => {
  it('exports dated days and an empty day across a month boundary', async () => {
    const blob = await buildPlanImageBlob(plan({ 'Day 1': [stop()], 'Day 2': [], 'Day 3': [stop({ title: '返程' })] }));
    expect(blob.type).toBe('image/png');
    expect(canvas.width).toBe(1800);
    expect(texts()).toEqual(expect.arrayContaining(['洛阳三天两晚', '2026.10.30 — 11.01', '10月30日 周五', '11月1日 周日', '自由安排 · 暂无行程', 'DAY 3']));
    expect(texts()).toContain('高铁 + 市内网约车');
    expect(texts().join('')).not.toMatch(/预算|1591|待估算/);
    expect(texts()).toContain('需预约');
    expect(canvas.toBlob.mock.calls[0][1]).toBe('image/png');
  });

  it('wraps long titles and full notes inside the image and increases its height', async () => {
    await buildPlanImageBlob(plan({ 'Day 1': [stop()] }));
    const shortHeight = canvas.height;
    drawn = [];
    const title = '老城东西大街与鼓楼深度漫步，参观沿途历史建筑和展览';
    const advice = '上午先寄存行李，随后沿着街区慢慢散步，中途安排午餐和休息。'.repeat(14) + '最后一条备注也必须保留。';
    await buildPlanImageBlob(plan({ 'Day 1': [stop({ title, advice })] }));
    expect(canvas.height).toBeGreaterThan(shortHeight);
    expect(texts().join('')).toContain(title);
    expect(texts().join('')).toContain(advice);
    expect(texts().at(-1)).toContain('最后一条备注也必须保留。');
    for (const text of drawn) {
      expect(text.y * 2).toBeLessThan(canvas.height);
      const right = text.align === 'center' ? text.x + text.width / 2 : text.x + text.width;
      expect(right).toBeLessThanOrEqual(860);
    }
  });

  it.each(['无需预约。', '无需提前预约。', '不需要提前预约。', '不需要预约。', '先确认是否预约。', '请核实是否需要提前预约。', '建议提前预约。', '查询景区预约信息。'])('does not invent a booking requirement: %s', async (advice) => {
    await buildPlanImageBlob(plan({ 'Day 1': [stop({ advice })] }));
    expect(texts()).not.toContain('需预约');
    expect(texts().join('')).toContain(advice);
  });

  it('moves the booking badge below a title that fills the available line', async () => {
    await buildPlanImageBlob(plan({ 'Day 1': [stop({ title: '游'.repeat(17) })] }));
    const title = drawn.find(({ text }) => text === '游'.repeat(17));
    const badge = drawn.find(({ text }) => text === '需预约');
    const detail = drawn.find(({ text }) => text.startsWith('14:30'));
    expect(badge.y).toBeGreaterThan(title.y);
    expect(detail.y).toBeGreaterThan(badge.y);
  });

  it('handles missing destination and dates and a cross-year trip', async () => {
    await buildPlanImageBlob({ itinerary: { 'Day 1': [] } });
    expect(texts()).toEqual(expect.arrayContaining(['旅行一日游', '1 天行程 · 出发日期待定', '日期待定']));
    drawn = [];
    await buildPlanImageBlob({ ...plan({ 'Day 1': [], 'Day 2': [] }), start_date: '2026-12-31' });
    expect(texts()).toContain('2026.12.31 — 2027.01.01');
  });

  it('reports empty plans, unsupported canvas and encoding failures', async () => {
    await expect(buildPlanImageBlob({ itinerary: {} })).rejects.toThrow('先添加一天行程');
    canvas.toBlob.mockImplementation((callback) => callback(null));
    await expect(buildPlanImageBlob(plan({ 'Day 1': [] }))).rejects.toThrow('图片生成失败');
    canvas.getContext = () => null;
    await expect(buildPlanImageBlob(plan({ 'Day 1': [] }))).rejects.toThrow('不支持图片导出');
  });

  it('reduces resolution for long trips and rejects an unreadably tall image', async () => {
    const itinerary = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`Day ${i + 1}`, Array.from({ length: 3 }, () => stop())]));
    await buildPlanImageBlob(plan(itinerary));
    expect(canvas.height).toBeLessThanOrEqual(16384);
    expect(canvas.width).toBeLessThan(1800);
    const huge = plan({ 'Day 1': [stop({ advice: '很长的内容'.repeat(5000) })] });
    await expect(buildPlanImageBlob(huge)).rejects.toThrow('行程内容太长');
  });
});
