// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App.jsx';
import { createTemplatePlan, templates } from '../../src/content/templates.js';
import { saveTextFile } from '../../src/utils/export.js';

vi.mock('../../src/utils/export.js', async (importOriginal) => ({ ...(await importOriginal()), saveTextFile: vi.fn() }));
const storageKey = 'travel-plan-board-v1';
const conversationKey = 'travel-plan-conversation-v1';

beforeEach(() => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  window.umami = { track: vi.fn() };
  window.history.replaceState(null, '', '/app/?template=hangzhou-2-days&utm_source=test');
  vi.mocked(saveTextFile).mockReset();
});
afterEach(() => { cleanup(); delete window.umami; window.history.replaceState(null, '', '/'); vi.restoreAllMocks(); });

describe('template to board flow', () => {
  it('loads a new visitor template once in StrictMode and clears stale conversation context', () => {
    localStorage.setItem(conversationKey, JSON.stringify([{ role: 'user', content: '旧需求' }]));
    render(<StrictMode><App /></StrictMode>);
    expect(screen.getByText('西湖湖滨至断桥一带')).toBeTruthy();
    expect(screen.getByRole('button', { name: '优化当前行程' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(storageKey)).destination).toBe('杭州');
    expect(JSON.parse(localStorage.getItem(conversationKey))).toEqual([]);
    expect(window.umami.track).toHaveBeenCalledExactlyOnceWith('template_use', { template: 'hangzhou-2-days' });
    expect(window.location.search).toBe('?utm_source=test');
  });

  it('preserves current work when template replacement is dismissed', () => {
    localStorage.setItem(storageKey, JSON.stringify(createTemplatePlan(templates[0])));
    localStorage.setItem(conversationKey, JSON.stringify([{ role: 'user', content: '保留需求' }]));
    render(<App />);
    expect(screen.getByRole('region', { name: '载入模板' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保留当前行程' }));
    expect(JSON.parse(localStorage.getItem(storageKey)).destination).toBe('洛阳、开封');
    expect(JSON.parse(localStorage.getItem(conversationKey))[0].content).toBe('保留需求');
    expect(window.umami.track).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?utm_source=test');
  });

  it('replaces only after the explicit action and records edits without private data', () => {
    localStorage.setItem(storageKey, JSON.stringify(createTemplatePlan(templates[0])));
    localStorage.setItem(conversationKey, JSON.stringify([{ role: 'user', content: '旧需求' }]));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '替换为这份模板' }));
    expect(JSON.parse(localStorage.getItem(storageKey)).destination).toBe('杭州');
    expect(JSON.parse(localStorage.getItem(conversationKey))).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: '添加行程' }));
    fireEvent.change(screen.getByPlaceholderText('卡片标题'), { target: { value: '私人地址，不得上报' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(window.umami.track).toHaveBeenCalledWith('plan_edit', {});
    expect(JSON.stringify(window.umami.track.mock.calls)).not.toContain('私人地址');
  });

  it('does not count canceled exports, but counts a saved export', async () => {
    render(<App />);
    window.umami.track.mockClear();
    vi.mocked(saveTextFile).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: '导出', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'JSON', exact: true }));
    await waitFor(() => expect(saveTextFile).toHaveBeenCalledTimes(1));
    expect(window.umami.track).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '导出', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Markdown', exact: true }));
    await waitFor(() => expect(window.umami.track).toHaveBeenCalledExactlyOnceWith('export_success', { format: 'markdown' }));
  });
});
