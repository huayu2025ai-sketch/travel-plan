import React from 'react';
import { Coins, Route, TrainFront } from 'lucide-react';

export function PlanSummary({ budget, transport, dayCount, itemCount }) {
  const stats = [
    { label: '预算预估', value: budget, detail: '按行程卡片上的费用合计', icon: Coins },
    { label: '推荐交通', value: transport, detail: '可在生成后继续调整', icon: TrainFront },
    { label: '规划范围', value: `${dayCount} 天 · ${itemCount} 项`, detail: '可以拖拽更改每日安排', icon: Route },
  ];

  return (
    <section className="travel-summary" aria-label="行程概览">
      {stats.map(({ label, value, detail, icon: Icon }) => (
        <article className="travel-summary-card" key={label}>
          <p className="travel-summary-label">{label}</p>
          <div className="travel-summary-value"><span className="travel-summary-icon"><Icon aria-hidden="true" /></span><strong>{value}</strong></div>
          <p className="travel-summary-detail">{detail}</p>
        </article>
      ))}
    </section>
  );
}
