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
    offsetX: 0,
    fillText(text, x, y) { drawn.push({ text, x: x + this.offsetX, y, width: this.measureText(text).width, align: this.textAlign }); },
  };
  for (const method of ['beginPath', 'moveTo', 'arcTo', 'closePath', 'fill', 'save', 'restore', 'clip', 'fillRect', 'stroke', 'arc', 'lineTo', 'translate', 'scale', 'ellipse']) ctx[method] = vi.fn();
  const stack = [];
  ctx.save = vi.fn(() => stack.push({ offsetX: ctx.offsetX, font: ctx.font, textAlign: ctx.textAlign }));
  ctx.restore = vi.fn(() => Object.assign(ctx, stack.pop()));
  ctx.translate = vi.fn((x) => { ctx.offsetX += x; });
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

  it.each([2, 4])('includes wrapped weather without overlapping dates or itinerary in a %i-day image', async (count) => {
    const itinerary = Object.fromEntries(Array.from({ length: count }, (_, i) => [`Day ${i + 1}`, i === 1 ? [] : [stop()]]));
    const weather = Object.fromEntries(Object.keys(itinerary).map((day) => [day, '晴转多云 15-22°C，东南风3级，午后可能出现阵雨，请带雨具。']));
    await buildPlanImageBlob({ ...plan(itinerary), weather, weather_context: { destination: '洛阳', start_date: '2026-10-30' } });
    expect(texts().filter((text) => text.startsWith('天气：'))).toHaveLength(count);
    expect(texts().join('')).toContain('请带雨具。');
    for (const heading of drawn.filter(({ text }) => /^DAY /.test(text))) {
      const weather = drawn.find((text) => text.text.startsWith('天气：') && text.x >= heading.x - 40 && text.x < heading.x + 100 && text.y > heading.y);
      expect(weather.y).toBeGreaterThan(heading.y + 20);
      const itinerary = drawn.find((text) => text.text === '龙门石窟' && text.y > weather.y && text.x >= heading.x && text.x < heading.x + 400);
      if (itinerary) expect(itinerary.y).toBeGreaterThan(weather.y + 28);
    }
    for (const text of drawn) {
      const right = text.align === 'center' ? text.x + text.width / 2 : text.x + text.width;
      expect(right).toBeLessThanOrEqual(860);
      expect(text.y).toBeLessThan(canvas.height / (canvas.width / 900));
    }
  });

  it('does not export weather that belongs to a different date', async () => {
    await buildPlanImageBlob({ ...plan({ 'Day 1': [] }), weather: { 'Day 1': '旧预报' }, weather_context: { destination: '洛阳', start_date: '2026-10-29' } });
    expect(texts().join('')).not.toContain('旧预报');
    expect(texts().join('')).not.toContain('天气：');
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

  it.each([1, 2])('uses one column for a %i-day trip', async (count) => {
    const itinerary = Object.fromEntries(Array.from({ length: count }, (_, i) => [`Day ${i + 1}`, [stop()]]));
    await buildPlanImageBlob(plan(itinerary));
    const headings = drawn.filter(({ text }) => /^DAY \d+$/.test(text));
    expect(headings).toHaveLength(count);
    expect(new Set(headings.map(({ x }) => x)).size).toBe(1);
    expect(headings.every((heading, index) => index === 0 || heading.y > headings[index - 1].y)).toBe(true);
  });

  it.each([3, 4, 5, 6])('uses two columns in day order for a %i-day trip', async (count) => {
    const itinerary = Object.fromEntries(Array.from({ length: count }, (_, i) => [`Day ${i + 1}`, [stop({ title: `第${i + 1}天游览老城东西大街和鼓楼`, advice: '需提前预约，午后安排休息，然后步行游览街区。' })]]));
    await buildPlanImageBlob(plan(itinerary));
    const headings = drawn.filter(({ text }) => /^DAY \d+$/.test(text));
    const split = Math.ceil(count / 2);
    expect(headings.map(({ text }) => text)).toEqual(Array.from({ length: count }, (_, i) => `DAY ${i + 1}`));
    expect(new Set(headings.map(({ x }) => x)).size).toBe(2);
    expect(headings[split].x).toBeGreaterThan(headings[0].x);
    expect(headings[split].y).toBe(headings[0].y);
    for (const text of drawn) {
      const right = text.align === 'center' ? text.x + text.width / 2 : text.x + text.width;
      expect(right).toBeLessThanOrEqual(860);
      expect(text.y).toBeLessThan(canvas.height / (canvas.width / 900));
    }
    expect(texts().join('')).toContain('需提前预约，午后安排休息，然后步行游览街区。');
  });

  it('keeps times together and avoids punctuation at the start of a wrapped line', async () => {
    const advice = '小吃分量不小，适合多人分食，避开最拥挤的19:00。';
    const itinerary = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`Day ${i + 1}`, [stop({ advice })]]));
    await buildPlanImageBlob(plan(itinerary));
    expect(texts().filter((text) => text.includes('19:00'))).toHaveLength(4);
    expect(texts().some((text) => /^[，。！？；：、）]/.test(text))).toBe(false);
  });

  it('keeps long headings and transport text clear of the QR code and illustration', async () => {
    await buildPlanImageBlob({
      ...plan({ 'Day 1': [] }),
      destination: '洛阳、开封、郑州和安阳古城深度旅行',
      recommended_transport: '高铁、城际铁路、市内公共交通和步行，结合沿途休息与行李寄存安排',
    });
    const firstDayIndex = drawn.findIndex(({ text }) => text === 'DAY 1');
    const header = drawn.slice(1, firstDayIndex); // The first label is under the QR code.
    expect(drawn[0].text).toBe('扫码规划行程');
    for (const text of header) {
      expect(text.x - text.width / 2).toBeGreaterThanOrEqual(214);
      expect(text.x + text.width / 2).toBeLessThanOrEqual(714);
    }
    expect(drawn[firstDayIndex].y).toBeGreaterThanOrEqual(264);
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
