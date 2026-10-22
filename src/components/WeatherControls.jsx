import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { getWeatherCoverage } from '../utils/plan-weather.js';

export function WeatherControls({ plan, isRefreshing, isGenerating, notice, onDestinationChange, onDateChange, onRefresh }) {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const dayCount = Object.keys(plan.itinerary).length;
  const missingContext = !plan.destination.trim() || !plan.start_date;
  const coverage = getWeatherCoverage(plan);
  const updatedAt = coverage?.updated_at ? new Date(coverage.updated_at) : null;
  const updateLabel = updatedAt && Number.isFinite(updatedAt.getTime())
    ? `上次更新：${updatedAt.toLocaleString('zh-CN', { hour12: false })}` : '';
  const coverageLabel = coverage ? `${coverage.start_date}～${coverage.end_date} · ${coverage.location_label}` : '';
  const hint = dayCount > 16 ? '天气同步最多支持16天行程。' : '更新天气（支持未来约16天内的日期）';

  return (
    <div className="travel-weather-control">
      <div className="relative inline-flex shrink-0">
        <button
          type="button"
          aria-label={isRefreshing ? '正在更新天气' : '更新天气'}
          title={hint}
          disabled={isRefreshing || isGenerating || dayCount > 16}
          aria-haspopup={missingContext || isSetupOpen ? 'dialog' : undefined}
          aria-expanded={missingContext || isSetupOpen ? isSetupOpen : undefined}
          onClick={(event) => {
            if (missingContext || isSetupOpen) setIsSetupOpen((open) => !open);
            else onRefresh(event);
          }}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
        {isSetupOpen ? (
          <div role="dialog" aria-label="设置天气查询" onKeyDown={(event) => { if (event.key === 'Escape') setIsSetupOpen(false); }} className="travel-weather-setup fixed inset-x-4 top-1/3 z-30 rounded-lg border p-4 shadow-lg sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-72">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-bold">设置天气查询</span>
              <button type="button" aria-label="关闭天气设置" onClick={() => setIsSetupOpen(false)} className="rounded p-1 text-stone-500"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={(event) => { setIsSetupOpen(false); onRefresh(event); }} className="grid gap-3">
              <label className="text-xs font-medium" htmlFor="weather-destination">目的地
                <input id="weather-destination" disabled={isGenerating} required type="text" placeholder="城市，如杭州" value={plan.destination} maxLength={100} onChange={(event) => onDestinationChange(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border bg-white px-3 text-sm" />
              </label>
              <label className="text-xs font-medium" htmlFor="weather-start-date">出发日期
                <input id="weather-start-date" disabled={isGenerating} required type="date" value={plan.start_date} onChange={(event) => onDateChange(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border bg-white px-3 text-sm" />
              </label>
              <button type="submit" disabled={missingContext || isRefreshing || isGenerating} className="travel-primary-action min-h-9 rounded-md px-3 text-sm font-semibold disabled:opacity-50">获取天气</button>
            </form>
          </div>
        ) : null}
      </div>
      {coverage ? <span className="travel-weather-coverage text-xs text-stone-500" title={[coverageLabel, updateLabel].filter(Boolean).join('\n')}>{coverageLabel}</span> : null}
      {notice ? <span role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-xs text-red-700' : 'sr-only'}>{notice.message}</span> : null}
    </div>
  );
}
