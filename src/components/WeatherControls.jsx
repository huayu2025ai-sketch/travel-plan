import React from 'react';
import { CloudSun, RefreshCw } from 'lucide-react';

export function WeatherControls({ plan, isRefreshing, isGenerating, notice, onDestinationChange, onDateChange, onRefresh }) {
  const dayCount = Object.keys(plan.itinerary).length;
  const missingContext = !plan.destination.trim() || !plan.start_date;
  const context = plan.weather_context;
  const updatedAt = context?.start_date === plan.start_date && String(context?.destination).trim() === plan.destination.trim()
    ? new Date(context.updated_at)
    : null;
  const hasUpdateTime = updatedAt && Number.isFinite(updatedAt.getTime());
  const hint = missingContext
    ? '填写目的地和出发日期，即可同步每日天气。'
    : dayCount > 16
      ? '天气同步最多支持16天行程。'
      : `按当前目的地同步 ${dayCount} 天预报，支持未来约16天内的日期。天气有变化时可再次更新。`;

  return (
    <section className="travel-weather-panel" aria-labelledby="weather-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="weather-heading" className="inline-flex items-center gap-2 text-sm font-bold">
          <CloudSun className="h-4 w-4" aria-hidden="true" />行程天气
        </h2>
        {hasUpdateTime ? <p className="text-xs text-stone-500">上次更新：<time dateTime={context.updated_at}>{updatedAt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</time></p> : null}
      </div>
      <form onSubmit={onRefresh} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-xs font-medium" htmlFor="weather-destination">
          目的地
          <input id="weather-destination" type="text" placeholder="城市，如杭州" value={plan.destination} maxLength={100} onChange={(event) => onDestinationChange(event.target.value)} disabled={isGenerating} className="mt-1 block min-h-10 w-full rounded-md border bg-white px-3 text-sm" />
        </label>
        <label className="min-w-0 flex-1 text-xs font-medium" htmlFor="weather-start-date">
          出发日期
          <input id="weather-start-date" type="date" value={plan.start_date} onChange={(event) => onDateChange(event.target.value)} disabled={isGenerating} className="mt-1 block min-h-10 w-full rounded-md border bg-white px-3 text-sm" />
        </label>
        <button type="submit" disabled={isRefreshing || isGenerating || missingContext || dayCount > 16} aria-describedby="weather-hint" className="travel-primary-action inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {isRefreshing ? '正在更新天气' : '更新天气'}
        </button>
      </form>
      <p id="weather-hint" className="mt-3 text-xs leading-5 text-stone-500">{hint}</p>
      {hasUpdateTime && context.location_label ? <p className="mt-1 text-xs text-stone-500">匹配地区：{context.location_label}</p> : null}
      {notice ? <p role={notice.error ? 'alert' : 'status'} className={`mt-2 text-xs leading-5 ${notice.error ? 'text-red-700' : 'text-emerald-800'}`}>{notice.message}</p> : null}
    </section>
  );
}
