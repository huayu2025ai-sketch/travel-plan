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
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(screen.getByText('测试景点')).toBeTruthy();
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
