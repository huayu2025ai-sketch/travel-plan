import React from 'react';
import { Backpack, Coins, Route, TrainFront } from 'lucide-react';

export function PlanSummary({ budget, transport, dayCount, itemCount, packedCount, packingCount, onOpenPacking }) {
  return (
    <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-stone-200 bg-white/85 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">预算预估</p>
        <div className="mt-2 flex items-center gap-3"><Coins className="h-6 w-6 text-amber-600" /><p className="text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">{budget}</p></div>
        <p className="mt-2 text-[11px] font-medium text-stone-400 dark:text-[#6a645c]">按卡片费用估算；未填写费用的项目单独标记</p>
      </div>
      <div className="group rounded-xl border border-stone-200/80 bg-white/85 p-4 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400 dark:text-[#5e584f]">推荐交通</p>
        <div className="mt-2.5 flex items-center gap-3"><div className="stat-icon-ring bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400"><TrainFront className="h-5 w-5" /></div><p className="text-xl font-black tracking-tight text-stone-950 dark:text-[#e8e4df]">{transport}</p></div>
      </div>
      <div className="group rounded-xl border border-stone-200/80 bg-white/85 p-4 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400 dark:text-[#5e584f]">规划范围</p>
        <div className="mt-2.5 flex items-center gap-3"><div className="stat-icon-ring bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"><Route className="h-5 w-5" /></div><p className="text-xl font-black tracking-tight text-stone-950 dark:text-[#e8e4df]">{dayCount}天 · {itemCount}项</p></div>
      </div>
      <button type="button" onClick={onOpenPacking} className="group rounded-lg border border-stone-200 bg-white/85 p-4 text-left shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50/60 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-rose-200 dark:border-[#3a3630] dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark dark:hover:border-rose-900/60 dark:hover:bg-rose-950/20 dark:focus:ring-rose-900/60" aria-label="查看携带物品清单">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">携带物品</p>
        <div className="mt-2 flex items-center gap-3"><Backpack className="h-6 w-6 text-rose-600 transition group-hover:scale-105" /><p className="text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">{packedCount}/{packingCount}件</p></div>
        <p className="mt-2 text-xs font-semibold text-rose-700 opacity-85 dark:text-rose-300">查看清单</p>
      </button>
    </section>
  );
}
