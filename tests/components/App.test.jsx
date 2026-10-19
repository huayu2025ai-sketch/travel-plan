// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
});

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}
