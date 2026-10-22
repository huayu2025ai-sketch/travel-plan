// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App.jsx';

describe('App key interactions', () => {
  beforeEach(() => {
    const storage = createStorage();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    window.requestAnimationFrame = (callback) => callback(0);
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('adds a custom itinerary card to the selected day', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '添加行程' }));
    fireEvent.change(screen.getByPlaceholderText('卡片标题'), { target: { value: '测试景点' } });
    fireEvent.change(screen.getByPlaceholderText('费用：200-300元 / 260元/晚×3晚'), { target: { value: '200-300' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(screen.getByText('测试景点')).toBeTruthy();
    expect(screen.getByText('1360-1460元')).toBeTruthy();
  });

  it('uses a dedicated keyboard-accessible handle and pauses dragging during card actions', () => {
    render(<App />);

    const handle = screen.getByRole('button', { name: '拖动 龙门石窟', exact: true });
    expect(handle.tabIndex).toBe(0);
    const card = screen.getByRole('heading', { name: '龙门石窟' }).closest('article');
    expect(card.parentElement.getAttribute('role')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '编辑 龙门石窟' }));
    expect(screen.queryByRole('button', { name: '拖动 龙门石窟', exact: true })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }));
    expect(screen.getByRole('button', { name: '拖动 龙门石窟', exact: true }).tabIndex).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: '删除 龙门石窟' }));
    expect(screen.queryByRole('button', { name: '拖动 龙门石窟', exact: true })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }));
    expect(screen.getByRole('button', { name: '拖动 龙门石窟', exact: true }).tabIndex).toBe(0);
  });

  it('keeps filtered cards readable without offering an unavailable drag action', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '交通 2', exact: true }));
    expect(screen.getByRole('heading', { name: '龙门石窟' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '拖动 龙门石窟', exact: true })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '全部 9', exact: true }));
    expect(screen.getByRole('button', { name: '拖动 龙门石窟', exact: true }).tabIndex).toBe(0);
  });

  it.each([false, true])('discards card edits on cancel (filtered: %s)', (filtered) => {
    render(<App />);

    if (filtered) {
      fireEvent.click(screen.getByRole('button', { name: '交通 2', exact: true }));
    }

    fireEvent.click(screen.getByRole('button', { name: '编辑 龙门石窟' }));
    fireEvent.change(screen.getByPlaceholderText('卡片标题'), { target: { value: '未保存的标题' } });
    fireEvent.change(screen.getByPlaceholderText('费用：200-300元 / 260元/晚×3晚'), { target: { value: '999' } });
    fireEvent.change(screen.getByPlaceholderText('建议'), { target: { value: '未保存的建议' } });
    fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }));

    expect(screen.queryByPlaceholderText('卡片标题')).toBeNull();
    const card = screen.getByRole('heading', { name: '龙门石窟' }).closest('article');
    expect(within(card).getByText('120元')).toBeTruthy();
    expect(screen.queryByText('未保存的建议')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '编辑 龙门石窟' }));
    expect(screen.getByPlaceholderText('卡片标题').value).toBe('龙门石窟');
    expect(screen.getByPlaceholderText('费用：200-300元 / 260元/晚×3晚').value).toBe('120元');
    expect(screen.getByPlaceholderText('建议').value).toBe('傍晚入园更舒适，夜游灯光亮起后观感更震撼。');
  });

  it('keeps committed board edits made while generation is pending', async () => {
    let resolveFetch;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '生成行程草案' }));
    fireEvent.click(screen.getByRole('button', { name: '添加行程' }));
    fireEvent.change(screen.getByPlaceholderText('卡片标题'), { target: { value: '等待期间新增' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    resolveFetch({
      ok: true,
      text: async () => JSON.stringify({
        destination: '杭州',
        recommended_transport: '步行',
        itinerary: { 'Day 1': [{ id: 'generated', type: '景点', title: 'AI 景点', cost: '免费' }] },
      }),
    });

    expect(await screen.findByText('生成已完成；期间的手动修改已保留。若要把新行程与这些修改合并，请基于当前看板再次优化。')).toBeTruthy();
    expect(screen.getByText('等待期间新增')).toBeTruthy();
    expect(screen.queryByText('AI 景点')).toBeNull();
  });

  it('requires a destination and date before updating weather', () => {
    render(<App />);
    const refresh = screen.getByRole('button', { name: '更新天气' });
    expect(screen.getByRole('button', { name: '收起每日行程看板' }).nextElementSibling.contains(refresh)).toBe(true);
    expect(screen.queryByLabelText('目的地')).toBeNull();
    fireEvent.click(refresh);
    expect(screen.getByRole('dialog', { name: '设置天气查询' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '获取天气' }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('目的地'), { target: { value: '杭州' } });
    fireEvent.change(screen.getByLabelText('出发日期'), { target: { value: '2026-10-23' } });
    expect(screen.getByRole('button', { name: '获取天气' }).disabled).toBe(false);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refreshes only weather, preserves edits made during the query and persists its timestamp', async () => {
    seedWeatherPlan();
    let resolveFetch;
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '更新天气' }));
    expect(screen.getByRole('button', { name: '正在更新天气' }).disabled).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ destination: '杭州', start_date: '2026-10-23', days: 2 });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/weather');

    fireEvent.click(screen.getByRole('button', { name: '添加行程' }));
    fireEvent.change(screen.getByPlaceholderText('卡片标题'), { target: { value: '查询时新增的景点' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await act(async () => resolveFetch(weatherResponse()));

    expect(screen.getByText('已更新 2 天天气。')).toBeTruthy();
    expect(screen.getByText('2026-10-23～2026-10-24 · 杭州')).toBeTruthy();
    expect(screen.getByText('晴 15-22°C')).toBeTruthy();
    expect(screen.getByText('查询时新增的景点')).toBeTruthy();
    expect(screen.getByTitle(/上次更新/)).toBeTruthy();
    view.unmount();
    render(<App />);
    expect(screen.getByText('晴 15-22°C')).toBeTruthy();
    expect(screen.getByTitle(/上次更新/)).toBeTruthy();
    expect(screen.getByText('查询时新增的景点')).toBeTruthy();
  });

  it('queries weather from the compact setup when the trip has no date or destination', async () => {
    const fetchMock = vi.fn(async () => weatherResponse());
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '更新天气' }));
    fireEvent.change(screen.getByLabelText('目的地'), { target: { value: '杭州' } });
    fireEvent.change(screen.getByLabelText('出发日期'), { target: { value: '2026-10-23' } });
    fireEvent.click(screen.getByRole('button', { name: '获取天气' }));
    expect(await screen.findByText('已更新 2/5 天天气，其余日期暂无预报。')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ destination: '杭州', start_date: '2026-10-23', days: 5 });
    expect(screen.getByText('2026-10-23～2026-10-24 · 杭州')).toBeTruthy();
  });

  it('keeps the previous forecast and timestamp when a refresh fails', async () => {
    seedWeatherPlan(true);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: '所选日期暂无可用天气，请稍后重试。' }) })));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '更新天气' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '所选日期暂无可用天气，请稍后重试。');
    expect(screen.getByText('旧天气')).toBeTruthy();
    expect(screen.getByTitle(/上次更新/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '更新天气' }).disabled).toBe(false);
  });

  it('restores weather, coverage and dates when importing a JSON backup', async () => {
    render(<App />);
    const data = weatherResponseData();
    const imported = {
      destination: '杭州', start_date: '2026-10-23',
      itinerary: { 'Day 3': [], 'Day 9': [] },
      weather: { 'Day 3': data.weather['Day 1'], 'Day 9': data.weather['Day 2'] },
      weather_context: { ...data.weather_context, location_label: '杭州市 浙江省 中国' },
    };
    await act(async () => fireEvent.change(screen.getByLabelText('导入JSON'), { target: { files: [{ text: async () => JSON.stringify(imported) }] } }));
    expect(screen.getByText('晴 15-22°C')).toBeTruthy();
    expect(screen.getByText('阴 16-23°C')).toBeTruthy();
    expect(screen.getByText('2026-10-23～2026-10-24 · 杭州市 浙江省 中国')).toBeTruthy();
    expect(screen.getByLabelText('设置 Day 2 日期').value).toBe('2026-10-24');
    expect(screen.getByTitle(/上次更新/)).toBeTruthy();
  });

  it.each(['date', 'destination', 'days'])('discards weather if the trip %s changes during the request', async (field) => {
    seedWeatherPlan();
    let resolveFetch;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '更新天气' }));
    if (field === 'date') fireEvent.change(screen.getByLabelText('设置 Day 1 日期'), { target: { value: '2026-10-24' } });
    else if (field === 'destination') {
      const imported = JSON.parse(localStorage.getItem('travel-plan-board-v1'));
      imported.destination = '北京';
      await act(async () => fireEvent.change(screen.getByLabelText('导入JSON'), { target: { files: [{ text: async () => JSON.stringify(imported) }] } }));
    }
    else fireEvent.click(screen.getByRole('button', { name: '添加天数' }));
    await act(async () => resolveFetch(weatherResponse()));
    expect(screen.getByRole('alert').textContent).toContain('已变化');
    expect(screen.queryByText('晴 15-22°C')).toBeNull();
    expect(screen.queryByTitle(/上次更新/)).toBeNull();
  });
});

function seedWeatherPlan(withWeather = false) {
  const data = weatherResponseData();
  localStorage.setItem('travel-plan-board-v1', JSON.stringify({
    destination: '杭州', start_date: '2026-10-23', recommended_transport: '步行',
    itinerary: { 'Day 1': [{ id: 'weather-card', type: '景点', title: '西湖散步', cost: '免费' }], 'Day 2': [] },
    weather: withWeather ? { 'Day 1': '旧天气' } : {},
    weather_context: withWeather ? data.weather_context : null,
  }));
}

function weatherResponseData() {
  return {
    weather: { 'Day 1': '晴 15-22°C', 'Day 2': '阴 16-23°C' },
    weather_context: { destination: '杭州', start_date: '2026-10-23', days: 2, updated_at: '2026-10-22T08:00:00.000Z' },
    available_days: 2,
  };
}

function weatherResponse() {
  return { ok: true, json: async () => weatherResponseData() };
}

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}
