// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('scrolls to the packing list from the summary card and toggles an item', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '查看携带物品清单' }));
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    const idCardButton = screen.getByRole('button', { name: '标记已携带 身份证' });
    fireEvent.click(idCardButton);
    expect(screen.getByRole('button', { name: '取消携带 身份证' })).toBeTruthy();
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
