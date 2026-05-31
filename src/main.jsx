import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2pdf from 'html2pdf.js';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CalendarDays,
  ChevronDown,
  Clock3,
  Coins,
  Copy,
  Download,
  FileText,
  FileUp,
  GripVertical,
  ImageDown,
  LoaderCircle,
  Moon,
  Pencil,
  Plane,
  Plus,
  Printer,
  Route,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TrainFront,
  Trash2,
  X,
} from 'lucide-react';
import './styles.css';
import { exportTripToPdf } from './exportPdf.js';

const initialTripPlan = {
  start_date: '',
  total_budget_estimate: '2500-3000元',
  recommended_transport: '高铁 + 市内网约车',
  itinerary: {
    'Day 1': [
      {
        id: 'day1-transport-1',
        type: '交通',
        title: '抵达洛阳龙门站',
        cost: '高铁约360元',
        duration: '2.5小时',
        advice: '建议选择上午抵达，留出下午游览龙门石窟的完整时间。',
      },
      {
        id: 'day1-sight-1',
        type: '景点',
        title: '龙门石窟',
        cost: '120元',
        duration: '3小时',
        advice: '傍晚入园更舒适，夜游灯光亮起后观感更震撼。',
      },
    ],
    'Day 2': [
      {
        id: 'day2-citywalk-1',
        type: 'citywalk',
        title: '老城十字街漫步',
        cost: '免费',
        duration: '2小时',
        advice: '从丽景门慢慢走到十字街，适合边逛边吃小吃。',
      },
      {
        id: 'day2-food-1',
        type: '美食',
        title: '洛阳水席',
        cost: '人均100元',
        duration: '1.5小时',
        advice: '牡丹燕菜是特色，套餐容易过量，建议按人数单点。',
      },
    ],
    'Day 3': [
      {
        id: 'day3-hotel-1',
        type: '酒店',
        title: '开封鼓楼附近入住',
        cost: '约260元/晚',
        duration: '1晚',
        advice: '住在鼓楼或书店街附近，晚上步行看夜市更方便。',
      },
      {
        id: 'day3-transport-1',
        type: '交通',
        title: '洛阳到开封',
        cost: '高铁约90元',
        duration: '1小时',
        advice: '中午出发最稳妥，避免压缩上午在洛阳的收尾时间。',
      },
    ],
    'Day 4': [
      {
        id: 'day4-sight-1',
        type: '景点',
        title: '清明上河园',
        cost: '120元',
        duration: '4小时',
        advice: '优先看演出时间表，再反向安排园区游线。',
      },
      {
        id: 'day4-food-1',
        type: '美食',
        title: '鼓楼夜市',
        cost: '人均80元',
        duration: '2小时',
        advice: '小吃分量不小，适合多人分食，避开最拥挤的19:00。',
      },
    ],
    'Day 5': [
      {
        id: 'day5-citywalk-1',
        type: 'citywalk',
        title: '书店街与山陕甘会馆',
        cost: '约30元',
        duration: '2.5小时',
        advice: '适合作为返程前的轻量行程，节奏不要排太满。',
      },
    ],
  },
};

const typeStyles = {
  交通: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-400',
  景点: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400',
  citywalk: 'border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-900 dark:bg-lime-950/40 dark:text-lime-400',
  美食: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
  酒店: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-400',
  娱乐: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400',
};

const typeAccent = {
  交通: 'bg-sky-500',
  景点: 'bg-emerald-500',
  citywalk: 'bg-lime-500',
  美食: 'bg-amber-500',
  酒店: 'bg-violet-500',
  娱乐: 'bg-rose-500',
};

const typeOptions = ['交通', '景点', 'citywalk', '美食', '酒店', '娱乐'];
const storageKey = 'travel-plan-board-v1';
const themeKey = 'travel-plan-theme';
const generationStages = [
  '解析目的地与出行天数',
  '匹配交通、酒店和每日节奏',
  '整理景点、美食与 citywalk',
  '校验 JSON 并生成看板',
];

function getTypeBadgeClass(type) {
  return typeStyles[type] || 'border-stone-200 bg-stone-50 text-stone-700 dark:border-[#3a3630] dark:bg-[#252320] dark:text-[#b5afa6]';
}

function createEmptyCardForm(day) {
  return {
    day,
    type: '景点',
    title: '',
    cost: '',
    duration: '',
    advice: '',
  };
}

function parseCostAmount(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.includes('免费')) return 0;

  const match = text.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function formatCostAmount(value) {
  const amount = parseCostAmount(value);
  if (amount === null) return '待估算';
  return `${Math.max(0, Math.round(amount))}元`;
}

function getCostInputValue(value) {
  const amount = parseCostAmount(value);
  return amount === null ? '' : String(Math.max(0, Math.round(amount)));
}

function getBudgetRange(itinerary) {
  const total = getAllItems(itinerary).reduce((sum, item) => {
    const amount = parseCostAmount(item.cost);
    return sum + (amount || 0);
  }, 0);
  const lower = Math.floor(total / 1000) * 1000;
  const upper = lower + 1000;

  return `${lower}-${upper}元`;
}

function withComputedBudget(plan) {
  return {
    ...plan,
    start_date: plan.start_date || '',
    total_budget_estimate: getBudgetRange(plan.itinerary),
  };
}

function createCardEditForm(item) {
  return {
    type: item.type,
    title: item.title,
    cost: getCostInputValue(item.cost),
    duration: item.duration,
    advice: item.advice,
  };
}

function getAllItems(itinerary) {
  return Object.values(itinerary).flat();
}

function downloadTextFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildMarkdown(plan) {
  const lines = [
    '# AI 旅行规划',
    '',
    `- 预算预估：${plan.total_budget_estimate}`,
    `- 推荐交通：${plan.recommended_transport}`,
    '',
  ];

  Object.entries(plan.itinerary).forEach(([day, items]) => {
    lines.push(`## ${getDayHeading(plan, day)}`, '');

    if (items.length === 0) {
      lines.push('- 暂无行程', '');
      return;
    }

    items.forEach((item, index) => {
      lines.push(
        `### ${index + 1}. ${item.title}`,
        '',
        `- 类型：${item.type}`,
        `- 费用：${item.cost}`,
        `- 耗时：${item.duration}`,
        `- 建议：${item.advice}`,
        '',
      );
    });
  });

  return lines.join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getPrintTypeMeta(type) {
  const meta = {
    交通: { icon: 'T', color: '#0284c7', bg: '#e0f2fe', label: '交通', imageTitle: '出发路上' },
    景点: { icon: 'S', color: '#059669', bg: '#d1fae5', label: '景点', imageTitle: '目的地风景' },
    citywalk: { icon: 'W', color: '#65a30d', bg: '#ecfccb', label: 'Citywalk', imageTitle: '街巷漫步' },
    美食: { icon: 'F', color: '#d97706', bg: '#fef3c7', label: '美食', imageTitle: '地方风味' },
    酒店: { icon: 'H', color: '#7c3aed', bg: '#ede9fe', label: '酒店', imageTitle: '舒适落脚' },
    娱乐: { icon: 'E', color: '#e11d48', bg: '#ffe4e6', label: '娱乐', imageTitle: '轻松玩乐' },
  };

  return meta[type] || { icon: 'P', color: '#57534e', bg: '#f5f5f4', label: type || '行程', imageTitle: '旅途片刻' };
}

function buildGuideImageDataUri(item, day, index) {
  const meta = getPrintTypeMeta(item.type);
  const title = escapeHtml(item.title).slice(0, 18);
  const dayLabel = escapeHtml(day);
  const imageLabel = escapeHtml(meta.imageTitle);
  const color = meta.color;
  const bg = meta.bg;
  const shapeMap = {
    交通: `
      <path d="M82 206 C165 172, 263 168, 418 195" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round" opacity=".35"/>
      <rect x="128" y="120" width="230" height="58" rx="29" fill="#ffffff" opacity=".88"/>
      <circle cx="176" cy="184" r="15" fill="${color}"/><circle cx="310" cy="184" r="15" fill="${color}"/>
      <path d="M171 120 L236 82 L326 120" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    景点: `
      <path d="M72 224 L172 94 L246 224 Z" fill="${color}" opacity=".18"/>
      <path d="M180 224 L306 62 L434 224 Z" fill="${color}" opacity=".28"/>
      <circle cx="376" cy="82" r="35" fill="#fbbf24" opacity=".9"/>
      <path d="M118 224 C178 188, 244 188, 304 224" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>
    `,
    citywalk: `
      <rect x="84" y="98" width="76" height="132" rx="10" fill="${color}" opacity=".18"/>
      <rect x="182" y="72" width="92" height="158" rx="12" fill="${color}" opacity=".28"/>
      <rect x="302" y="112" width="92" height="118" rx="12" fill="${color}" opacity=".2"/>
      <path d="M86 246 C148 214, 240 214, 416 244" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round"/>
    `,
    美食: `
      <circle cx="244" cy="158" r="76" fill="#ffffff" opacity=".86"/>
      <circle cx="244" cy="158" r="48" fill="${bg}" stroke="${color}" stroke-width="8"/>
      <path d="M122 86 L122 222" stroke="${color}" stroke-width="12" stroke-linecap="round"/>
      <path d="M356 84 C328 118, 328 162, 358 194 L358 222" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>
    `,
    酒店: `
      <rect x="96" y="118" width="300" height="92" rx="18" fill="#ffffff" opacity=".86"/>
      <rect x="120" y="92" width="134" height="78" rx="14" fill="${color}" opacity=".2"/>
      <rect x="266" y="92" width="104" height="78" rx="14" fill="${color}" opacity=".28"/>
      <path d="M96 210 L396 210 L396 238 L96 238 Z" fill="${color}" opacity=".55"/>
    `,
    娱乐: `
      <circle cx="154" cy="116" r="34" fill="${color}" opacity=".22"/>
      <circle cx="340" cy="98" r="28" fill="#fbbf24" opacity=".86"/>
      <path d="M142 194 C188 116, 300 116, 354 194" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>
      <path d="M176 196 L156 228 M320 196 L340 228" stroke="${color}" stroke-width="12" stroke-linecap="round"/>
      <path d="M214 166 L234 186 L274 144" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    `,
  };

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="520" height="300" viewBox="0 0 520 300">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${bg}"/>
          <stop offset="55%" stop-color="#fff7ed"/>
          <stop offset="100%" stop-color="#ffffff"/>
        </linearGradient>
        <pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M0 28 L28 0" stroke="${color}" stroke-width="1" opacity=".12"/>
        </pattern>
      </defs>
      <rect width="520" height="300" rx="34" fill="url(#g)"/>
      <rect width="520" height="300" rx="34" fill="url(#p)"/>
      <circle cx="430" cy="62" r="78" fill="${color}" opacity=".12"/>
      <circle cx="74" cy="246" r="56" fill="${color}" opacity=".10"/>
      ${shapeMap[item.type] || shapeMap.景点}
      <text x="34" y="48" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="18" font-weight="800" fill="${color}">${dayLabel} · ${imageLabel}</text>
      <text x="34" y="272" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="22" font-weight="900" fill="#1c1917">${title}</text>
      <text x="456" y="268" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="42" font-weight="900" fill="${color}" opacity=".55">${index + 1}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildPrintHtml(plan) {
  const entries = Object.entries(plan.itinerary);
  const allItems = getAllItems(plan.itinerary);
  const dayCount = entries.length;
  const itemCount = allItems.length;
  const typeCounts = typeOptions
    .map((type) => ({ type, count: allItems.filter((item) => item.type === type).length }))
    .filter(({ count }) => count > 0);

  const typeLegendHtml = typeCounts
    .map(({ type, count }) => {
      const meta = getPrintTypeMeta(type);
      return `
        <div class="legend-item" style="--type-color: ${meta.color}; --type-bg: ${meta.bg};">
          <span class="legend-icon">${meta.icon}</span>
          <span>${escapeHtml(meta.label)}</span>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join('');

  const routeHtml = entries
    .map(
      ([day, items], index) => `
        <div class="route-stop">
          <span>${index + 1}</span>
          <strong>${escapeHtml(day)}</strong>
          ${
            getDayDateInfo(plan.start_date, day).displayText
              ? `<small class="${getDayDateInfo(plan.start_date, day).dayType}">${escapeHtml(getDayDateInfo(plan.start_date, day).displayText)}</small>`
              : ''
          }
          <em>${items.length} 项</em>
        </div>
      `,
    )
    .join('');

  const heroImage = allItems[0] ? buildGuideImageDataUri(allItems[0], '攻略封面', 0) : '';
  const daysHtml = Object.entries(plan.itinerary)
    .map(([day, items]) => {
      const itemsHtml = items.length
        ? items
            .map(
              (item, index) => {
                const meta = getPrintTypeMeta(item.type);
                const imageSrc = buildGuideImageDataUri(item, day, index);
                return `
                  <article class="guide-story" style="--type-color: ${meta.color}; --type-bg: ${meta.bg};">
                    <figure>
                      <img src="${imageSrc}" alt="${escapeHtml(item.title)} 配图" />
                    </figure>
                    <div class="story-copy">
                      <div class="story-meta">
                        <span class="type-chip"><i>${meta.icon}</i>${escapeHtml(meta.label)}</span>
                        <em>${String(index + 1).padStart(2, '0')}</em>
                      </div>
                      <h3>${escapeHtml(item.title)}</h3>
                      <p class="story-intro">${escapeHtml(item.advice)}</p>
                      <dl>
                        <div><dt>预算</dt><dd>${escapeHtml(item.cost)}</dd></div>
                        <div><dt>建议时长</dt><dd>${escapeHtml(item.duration)}</dd></div>
                      </dl>
                    </div>
                  </article>
                `;
              },
            )
            .join('')
        : '<p class="empty">暂无行程</p>';

      return `
        <section class="day">
          <div class="day-title">
            <span>DAY GUIDE</span>
            <h2>${escapeHtml(day)}</h2>
            ${
              getDayDateInfo(plan.start_date, day).displayText
                ? `<strong class="${getDayDateInfo(plan.start_date, day).dayType}">${escapeHtml(getDayDateInfo(plan.start_date, day).displayText)}</strong>`
                : ''
            }
            <p>${items.length} 项安排 · 按攻略顺序阅读</p>
          </div>
          <div class="story-list">${itemsHtml}</div>
        </section>
      `;
    })
    .join('');

  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>AI 旅行规划</title>
        <style>
          * { box-sizing: border-box; }
          @page { margin: 14mm; size: A4; }
          body {
            margin: 0;
            padding: 0;
            color: #1c1917;
            font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif;
            background:
              radial-gradient(circle at 10% 6%, rgba(14, 165, 233, 0.10), transparent 30%),
              radial-gradient(circle at 92% 3%, rgba(245, 158, 11, 0.12), transparent 26%),
              radial-gradient(circle at 50% 95%, rgba(16, 185, 129, 0.06), transparent 35%),
              linear-gradient(180deg, #fffbf5 0%, #ffffff 40%);
          }
          h1 {
            margin: 0;
            max-width: 520px;
            font-size: 36px;
            letter-spacing: -0.01em;
            line-height: 1.12;
            font-family: "Noto Serif SC", "Songti SC", "Source Han Serif SC", serif;
            font-weight: 900;
          }
          .cover {
            position: relative;
            overflow: hidden;
            display: grid;
            grid-template-columns: 1.05fr 0.95fr;
            gap: 24px;
            min-height: 290px;
            border: 1px solid #e7e5e4;
            border-radius: 24px;
            padding: 28px;
            background:
              linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 250, 245, 0.92)),
              repeating-linear-gradient(45deg, rgba(12, 74, 110, 0.04) 0 1px, transparent 1px 22px);
            box-shadow: 0 16px 40px rgba(87, 83, 78, 0.08);
          }
          .cover::after {
            content: "";
            position: absolute;
            right: -42px;
            bottom: -60px;
            width: 260px;
            height: 180px;
            border-radius: 48% 52% 0 0;
            background: linear-gradient(135deg, #0ea5e9, #10b981 48%, #f59e0b);
            opacity: 0.17;
            transform: rotate(-12deg);
          }
          .hero-photo {
            position: relative;
            z-index: 1;
            align-self: stretch;
            min-height: 230px;
            margin: 0;
            overflow: hidden;
            border: 8px solid #ffffff;
            border-radius: 24px;
            box-shadow: 0 20px 45px rgba(87, 83, 78, 0.16);
            transform: rotate(1.2deg);
          }
          .hero-photo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .eyebrow {
            display: inline-block;
            margin-bottom: 14px;
            border: 1px solid #fed7aa;
            border-radius: 999px;
            padding: 6px 10px;
            color: #9a3412;
            background: #fff7ed;
            font-size: 12px;
            font-weight: 700;
          }
          .cover-copy {
            position: relative;
            z-index: 1;
          }
          .cover-copy > p {
            max-width: 560px;
            margin: 12px 0 0;
            color: #57534e;
            line-height: 1.8;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin: 18px 0 0;
          }
          .summary div {
            border: 1px solid #e7e5e4;
            border-radius: 16px;
            padding: 16px 14px;
            background: rgba(255, 255, 255, 0.88);
            box-shadow: 0 8px 24px rgba(120, 113, 108, 0.07);
            transition: transform 0.2s ease;
          }
          .label {
            margin: 0 0 6px;
            color: #78716c;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
          }
          .value { margin: 0; font-size: 18px; font-weight: 800; }
          .route-map {
            display: grid;
            grid-template-columns: repeat(${Math.max(dayCount, 1)}, minmax(72px, 1fr));
            gap: 0;
            margin: 22px 0 20px;
            border: 1px solid #e7e5e4;
            border-radius: 18px;
            padding: 18px;
            background: rgba(255, 255, 255, 0.76);
          }
          .route-stop {
            position: relative;
            min-height: 76px;
            padding-top: 38px;
            text-align: center;
          }
          .route-stop::before {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: 17px;
            height: 2px;
            background: #d6d3d1;
          }
          .route-stop:first-child::before { left: 50%; }
          .route-stop:last-child::before { right: 50%; }
          .route-stop span {
            position: absolute;
            left: 50%;
            top: 0;
            display: grid;
            width: 34px;
            height: 34px;
            place-items: center;
            border: 3px solid #ffffff;
            border-radius: 999px;
            color: #ffffff;
            background: #0f766e;
            box-shadow: 0 8px 18px rgba(15, 118, 110, 0.25);
            transform: translateX(-50%);
            font-weight: 800;
          }
          .route-stop strong,
          .route-stop small,
          .route-stop em {
            display: block;
            font-style: normal;
          }
          .route-stop strong { font-size: 13px; }
          .route-stop small { margin-top: 3px; font-size: 10px; font-weight: 800; }
          .route-stop small.weekday { color: #0f766e; }
          .route-stop small.weekend { color: #b45309; }
          .route-stop em { margin-top: 3px; color: #78716c; font-size: 11px; }
          .legend {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 0 0 20px;
          }
          .legend-item {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            border: 1px solid var(--type-color);
            border-radius: 999px;
            padding: 7px 10px;
            background: var(--type-bg);
            color: var(--type-color);
            font-size: 12px;
            font-weight: 800;
          }
          .legend-icon,
          .type-chip i {
            display: inline-grid;
            place-items: center;
            border-radius: 999px;
            color: #ffffff;
            background: var(--type-color);
            font-style: normal;
            font-weight: 900;
          }
          .legend-icon { width: 20px; height: 20px; font-size: 11px; }
          .legend-item strong { color: #1c1917; }
          .day {
            break-inside: avoid;
            margin-top: 26px;
          }
          .day-title {
            border-top: 3px solid #1c1917;
            padding-top: 14px;
            margin-bottom: 16px;
            position: relative;
          }
          .day-title::before {
            content: "";
            position: absolute;
            left: 0;
            top: -3px;
            width: 80px;
            height: 3px;
            background: linear-gradient(90deg, #0ea5e9, #10b981);
          }
          .day-title span {
            color: #a16207;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.16em;
          }
          .day h2 {
            margin: 4px 0 0;
            font-size: 28px;
            line-height: 1.1;
          }
          .day-title strong {
            display: block;
            margin-top: 4px;
            font-size: 13px;
          }
          .day-title strong.weekday { color: #0f766e; }
          .day-title strong.weekend { color: #b45309; }
          .day-title p {
            margin: 5px 0 0;
            color: #78716c;
            font-size: 12px;
            font-weight: 700;
          }
          .story-list {
            display: grid;
            gap: 14px;
          }
          .guide-story {
            display: grid;
            grid-template-columns: 228px minmax(0, 1fr);
            gap: 18px;
            align-items: stretch;
            break-inside: avoid;
            border-bottom: 1px solid #e7e5e4;
            padding: 0 0 16px;
            margin-bottom: 2px;
          }
          .guide-story:nth-child(even) {
            grid-template-columns: minmax(0, 1fr) 228px;
          }
          .guide-story:nth-child(even) figure {
            order: 2;
          }
          .guide-story figure {
            margin: 0;
            overflow: hidden;
            min-height: 142px;
            border-radius: 18px;
            background: var(--type-bg);
          }
          .guide-story img {
            width: 100%;
            height: 100%;
            min-height: 142px;
            object-fit: cover;
            display: block;
          }
          .story-copy {
            padding: 5px 0;
          }
          .story-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .story-meta em {
            color: var(--type-color);
            font-size: 30px;
            font-style: normal;
            font-weight: 900;
            line-height: 1;
            opacity: .32;
          }
          .guide-story h3 {
            margin: 10px 0 8px;
            font-size: 21px;
            line-height: 1.28;
            font-family: "Noto Serif SC", "Songti SC", serif;
            font-weight: 800;
          }
          .story-intro {
            margin: 0;
            color: #57534e;
            font-size: 13px;
            line-height: 1.8;
          }
          .guide-story dl {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin: 12px 0 0;
          }
          .guide-story dl div {
            border-left: 4px solid var(--type-color);
            border-radius: 0 10px 10px 0;
            padding: 8px 10px;
            background: var(--type-bg);
          }
          .guide-story dt {
            margin: 0 0 3px;
            color: #78716c;
            font-size: 11px;
            font-weight: 800;
          }
          .guide-story dd {
            margin: 0;
            color: #1c1917;
            font-size: 13px;
            font-weight: 800;
          }
          .type-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid var(--type-color);
            border-radius: 999px;
            padding: 4px 9px 4px 5px;
            color: var(--type-color);
            background: var(--type-bg);
            font-weight: 800;
          }
          .type-chip i { width: 18px; height: 18px; font-size: 10px; }
          .empty {
            border: 1px dashed #d6d3d1;
            border-radius: 14px;
            padding: 18px;
            color: #78716c;
            background: rgba(255, 255, 255, 0.72);
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .cover { page-break-after: avoid; }
            .summary { grid-template-columns: repeat(4, 1fr); }
            .guide-story { grid-template-columns: 228px minmax(0, 1fr); }
            .guide-story:nth-child(even) { grid-template-columns: minmax(0, 1fr) 228px; }
          }
        </style>
      </head>
      <body>
        <section class="cover">
          <div class="cover-copy">
            <span class="eyebrow">AI 旅行规划</span>
            <h1>一份可直接出发的旅行攻略</h1>
            <p>把每日路线、停留时长、预算提醒和旅行建议整理成攻略阅读版，适合打印携带或分享给同行人。</p>
            <div class="summary">
              <div>
                <p class="label">预算预估</p>
                <p class="value">${escapeHtml(plan.total_budget_estimate)}</p>
              </div>
              <div>
                <p class="label">推荐交通</p>
                <p class="value">${escapeHtml(plan.recommended_transport)}</p>
              </div>
              <div>
                <p class="label">规划天数</p>
                <p class="value">${dayCount} 天</p>
              </div>
              <div>
                <p class="label">行程项目</p>
                <p class="value">${itemCount} 项</p>
              </div>
            </div>
          </div>
          ${heroImage ? `<figure class="hero-photo"><img src="${heroImage}" alt="旅行攻略封面图" /></figure>` : ''}
        </section>
        <section class="route-map">${routeHtml}</section>
        <section class="legend">${typeLegendHtml}</section>
        ${daysHtml}
      </body>
    </html>
  `;
}

function roundRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || '').split('');
  const lines = [];
  let line = '';

  words.forEach((word) => {
    const nextLine = `${line}${word}`;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      return;
    }
    line = nextLine;
  });

  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((currentLine, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? '...' : '';
    ctx.fillText(`${currentLine}${suffix}`, x, y + index * lineHeight);
  });

  return Math.min(lines.length, maxLines) * lineHeight;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('图片生成失败，请稍后重试。'));
    }, 'image/png');
  });
}

async function buildPlanImageBlob(plan) {
  const entries = Object.entries(plan.itinerary);
  const width = 1440;
  const itemCount = getAllItems(plan.itinerary).length;
  const height = Math.max(900, 340 + entries.length * 88 + itemCount * 178);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(14, 116, 144, 0.08)';
  ctx.beginPath();
  ctx.arc(1220, 110, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(217, 119, 6, 0.10)';
  ctx.beginPath();
  ctx.arc(160, 760, 230, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1c1917';
  ctx.font = '900 58px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('AI 旅行规划', 80, 105);
  ctx.font = '600 24px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#78716c';
  ctx.fillText('每日行程看板导出图', 82, 148);

  const summary = [
    ['预算预估', plan.total_budget_estimate],
    ['推荐交通', plan.recommended_transport],
    ['规划范围', `${entries.length}天 · ${itemCount}项`],
  ];

  summary.forEach(([label, value], index) => {
    const x = 80 + index * 420;
    roundRect(ctx, x, 190, 360, 112, 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.fill();
    ctx.strokeStyle = '#e7e5e4';
    ctx.stroke();
    ctx.fillStyle = '#78716c';
    ctx.font = '700 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(label, x + 24, 230);
    ctx.fillStyle = '#1c1917';
    ctx.font = '900 30px "PingFang SC", "Microsoft YaHei", sans-serif';
    wrapCanvasText(ctx, value, x + 24, 270, 305, 34, 1);
  });

  let y = 360;
  entries.forEach(([day, items]) => {
    const dateInfo = getDayDateInfo(plan.start_date, day);
    ctx.fillStyle = '#1c1917';
    ctx.font = '900 34px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(day, 80, y);

    if (dateInfo.displayText) {
      const isWeekend = dateInfo.dayType === 'weekend';
      ctx.fillStyle = isWeekend ? '#fef3c7' : '#d1fae5';
      roundRect(ctx, 190, y - 32, 250, 42, 21);
      ctx.fill();
      ctx.fillStyle = isWeekend ? '#b45309' : '#0f766e';
      ctx.font = '800 18px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(dateInfo.displayText, 210, y - 5);
    }

    y += 38;

    if (items.length === 0) {
      ctx.fillStyle = '#a8a29e';
      ctx.font = '600 22px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('暂无行程', 82, y + 42);
      y += 100;
      return;
    }

    items.forEach((item) => {
      const meta = getPrintTypeMeta(item.type);
      roundRect(ctx, 80, y, 1280, 142, 20);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#e7e5e4';
      ctx.stroke();

      ctx.fillStyle = meta.color;
      roundRect(ctx, 80, y, 10, 142, 5);
      ctx.fill();

      ctx.fillStyle = meta.bg;
      roundRect(ctx, 112, y + 22, 104, 34, 17);
      ctx.fill();
      ctx.fillStyle = meta.color;
      ctx.font = '800 18px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(meta.label, 138, y + 46);

      ctx.fillStyle = '#1c1917';
      ctx.font = '900 30px "PingFang SC", "Microsoft YaHei", sans-serif';
      wrapCanvasText(ctx, item.title, 242, y + 42, 430, 34, 1);

      ctx.fillStyle = '#57534e';
      ctx.font = '700 20px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(`费用 ${item.cost}`, 242, y + 84);
      ctx.fillText(`耗时 ${item.duration}`, 430, y + 84);

      ctx.fillStyle = '#78716c';
      ctx.font = '500 20px "PingFang SC", "Microsoft YaHei", sans-serif';
      wrapCanvasText(ctx, item.advice, 720, y + 44, 580, 29, 3);

      y += 166;
    });

    y += 20;
  });

  return canvasToBlob(canvas);
}

function loadStoredPlan() {
  if (typeof window === 'undefined') return initialTripPlan;

  try {
    const storedPlan = window.localStorage.getItem(storageKey);
    return storedPlan ? normalizeImportedPlan(JSON.parse(storedPlan)) : initialTripPlan;
  } catch {
    return initialTripPlan;
  }
}

function renumberItineraryDays(itinerary) {
  return Object.fromEntries(Object.values(itinerary).map((items, index) => [`Day ${index + 1}`, items]));
}

function parseDayNumber(day) {
  const match = String(day).match(/Day\s+(\d+)/i);
  return match ? Number(match[1]) : 1;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekdayLabel(date) {
  return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
}

function getDayType(date) {
  const weekday = date.getDay();
  return weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
}

function getDateBadgeClass(dateInfo) {
  if (!dateInfo.displayText) return '';

  return dateInfo.dayType === 'weekend'
    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60'
    : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60';
}

function getDayDateInfo(startDate, day) {
  if (!startDate) return { inputValue: '', displayText: '', dayType: '' };

  const baseDate = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return { inputValue: '', displayText: '', dayType: '' };

  const dayDate = addDays(baseDate, parseDayNumber(day) - 1);
  const inputValue = toDateInputValue(dayDate);

  return {
    inputValue,
    displayText: `${inputValue} ${getWeekdayLabel(dayDate)}`,
    dayType: getDayType(dayDate),
  };
}

function getStartDateFromDayDate(day, dayDateValue) {
  if (!dayDateValue) return '';

  const selectedDate = new Date(`${dayDateValue}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime())) return '';

  return toDateInputValue(addDays(selectedDate, -(parseDayNumber(day) - 1)));
}

function getDayHeading(plan, day) {
  const dateInfo = getDayDateInfo(plan.start_date, day);
  return dateInfo.displayText ? `${day}（${dateInfo.displayText}）` : day;
}

function normalizeImportedPlan(value) {
  if (!value || typeof value !== 'object' || !value.itinerary || typeof value.itinerary !== 'object') {
    throw new Error('JSON 缺少 itinerary，无法导入。');
  }

  const normalizedItinerary = {};
  const seenIds = new Set();

  Object.entries(value.itinerary).forEach(([day, items], dayIndex) => {
    const normalizedDay = day || `Day ${dayIndex + 1}`;
    normalizedItinerary[normalizedDay] = Array.isArray(items)
      ? items.map((item, itemIndex) => {
          let id = String(item?.id || `${normalizedDay.toLowerCase().replace(/\s+/g, '-')}-slot-${itemIndex + 1}`).replace(
            /[^a-zA-Z0-9-_]/g,
            '-',
          );

          while (seenIds.has(id)) {
            id = `${id}-${itemIndex + 1}`;
          }

          seenIds.add(id);

          return {
            id,
            type: typeOptions.includes(item?.type) ? item.type : '景点',
            title: String(item?.title || '未命名行程'),
            cost: formatCostAmount(item?.cost),
            duration: String(item?.duration || '待安排'),
            advice: String(item?.advice || '暂无建议。'),
          };
        })
      : [];
  });

  if (Object.keys(normalizedItinerary).length === 0) {
    throw new Error('JSON 中没有可用的 Day 数据。');
  }

  return {
    start_date: String(value.start_date || ''),
    total_budget_estimate: getBudgetRange(normalizedItinerary),
    recommended_transport: String(value.recommended_transport || '待推荐'),
    itinerary: renumberItineraryDays(normalizedItinerary),
  };
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    return localStorage.getItem(themeKey) || 'system';
  });

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mql.matches);
      document.documentElement.classList.toggle('dark', isDark);
      if (theme !== 'system') {
        localStorage.setItem(themeKey, theme);
      } else {
        localStorage.removeItem(themeKey);
      }
    };
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [theme]);

  const resolved = theme === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  return { theme, resolved, setTheme };
}

function ThemeToggle({ theme, setTheme }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm transition hover:border-stone-300 hover:text-stone-700 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#7a746c] dark:hover:border-[#5a554e] dark:hover:text-[#b5afa6]"
      aria-label="切换主题"
      title="切换主题"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function LoadingProgress({ progress, stage }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="inline-flex items-center gap-2">
          <span className="travel-loader" aria-hidden="true">
            <Plane className="h-3.5 w-3.5" />
          </span>
          {stage}
        </span>
        <span>{progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/75 dark:bg-[#2a2724]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {generationStages.map((item) => (
          <span
            key={item}
            className={`h-1 rounded-full transition ${
              generationStages.indexOf(item) <= generationStages.indexOf(stage)
                ? 'bg-amber-500 dark:bg-amber-300'
                : 'bg-white/80 dark:bg-[#3a3630]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function TripCard({
  item,
  isDragging,
  pendingDeleteId,
  editingCardId,
  editForm,
  onStartEdit,
  onEditField,
  onSaveEdit,
  onCancelEdit,
  onDuplicate,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) {
  const isConfirmingDelete = pendingDeleteId === item.id;
  const isEditing = editingCardId === item.id;

  return (
    <article
      className={`group relative overflow-hidden rounded-lg border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-card dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:shadow-none dark:hover:shadow-card-dark ${
        isDragging ? 'border-stone-400 shadow-card ring-2 ring-stone-300 dark:border-[#5a554e] dark:ring-[#4a453e] dark:shadow-card-dark' : 'border-stone-200'
      }`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${typeAccent[item.type] || 'bg-slate-400'}`} />
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getTypeBadgeClass(item.type)}`}>
          {item.type}
        </span>
        <div className="flex items-center gap-1 text-stone-400 transition group-hover:text-stone-700 dark:text-[#5e584f] dark:group-hover:text-[#b5afa6]">
          <GripVertical className="h-4 w-4 shrink-0" />
          <button
            type="button"
            onClick={onStartEdit}
            aria-label={`编辑 ${item.title}`}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:text-[#5e584f] dark:hover:bg-[#2e2b26] dark:hover:text-[#b5afa6]"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            aria-label={`复制 ${item.title}`}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:text-[#5e584f] dark:hover:bg-[#2e2b26] dark:hover:text-[#b5afa6]"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`删除 ${item.title}`}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:text-[#5e584f] dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-3 space-y-2 rounded-md border border-stone-200 bg-stone-50 p-2 dark:border-[#3a3630] dark:bg-[#252320]">
          <select
            value={editForm.type}
            onChange={(event) => onEditField('type', event.target.value)}
            className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
            aria-label="编辑类型"
          >
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            value={editForm.title}
            onChange={(event) => onEditField('title', event.target.value)}
            className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
            placeholder="卡片标题"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={editForm.cost}
              onChange={(event) => onEditField('cost', event.target.value)}
              className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="金额（元）"
            />
            <input
              value={editForm.duration}
              onChange={(event) => onEditField('duration', event.target.value)}
              className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="耗时"
            />
          </div>
          <textarea
            value={editForm.advice}
            onChange={(event) => onEditField('advice', event.target.value)}
            className="h-20 w-full resize-none rounded-md border border-stone-200 bg-white px-2 py-2 text-sm leading-5 text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
            placeholder="建议"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-stone-950 px-2 text-xs font-semibold text-white transition hover:bg-stone-800 dark:bg-[#e8e4df] dark:text-[#141210] dark:hover:bg-[#d8d4cf]"
            >
              <Check className="h-3.5 w-3.5" />
              保存
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#b5afa6] dark:hover:bg-[#2e2b26]"
            >
              <X className="h-3.5 w-3.5" />
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="mt-3 text-base font-semibold leading-snug text-stone-950 dark:text-[#e8e4df]">{item.title}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-stone-600 dark:text-[#9a9389]">
            <div className="flex items-center gap-1.5 rounded-md bg-stone-50 px-2 py-2 dark:bg-[#252320]">
              <Coins className="h-3.5 w-3.5 text-stone-500 dark:text-[#7a746c]" />
              <span>{item.cost}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-stone-50 px-2 py-2 dark:bg-[#252320]">
              <Clock3 className="h-3.5 w-3.5 text-stone-500 dark:text-[#7a746c]" />
              <span>{item.duration}</span>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-[#9a9389]">{item.advice}</p>
        </>
      )}
      {isConfirmingDelete ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <p className="leading-5">确定删除这张卡片吗？</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onConfirmDelete}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-red-600 px-2 text-xs font-semibold text-white transition hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            >
              <Check className="h-3.5 w-3.5" />
              删除
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-[#1e1c1a] dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <X className="h-3.5 w-3.5" />
              取消
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}


function DayColumn({
  day,
  items,
  dateInfo,
  totalItems,
  isFilteredView,
  canDeleteDay,
  dayDragHandleProps,
  isDraggingDay,
  pendingDeleteId,
  editingCardId,
  editForm,
  onDeleteDay,
  onStartEdit,
  onEditField,
  onSaveEdit,
  onCancelEdit,
  onDuplicate,
  onSetDayDate,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) {
  const dateInputRef = useRef(null);
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <section
      className={`flex min-h-[520px] w-[292px] shrink-0 flex-col rounded-lg border bg-stone-50/80 p-3 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/80 dark:shadow-soft-dark ${
        isDraggingDay ? 'border-stone-400 ring-2 ring-stone-300 dark:border-[#5a554e] dark:ring-[#4a453e]' : 'border-stone-200/80'
      }`}
    >
      <div className="border-b border-stone-200 pb-3 dark:border-[#3a3630]">
        <div className="flex min-w-0 items-center gap-2">
          <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">行程日</p>
          {dateInfo.displayText ? (
            <span className={`min-w-0 truncate rounded-full px-2 py-0.5 text-xs font-semibold ${getDateBadgeClass(dateInfo)}`}>
              {dateInfo.displayText}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate font-display text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">{day}</h2>
          <div className="flex shrink-0 items-center gap-1">
          {canDeleteDay ? (
            <button
              type="button"
              onClick={() => onDeleteDay(day)}
              aria-label={`删除 ${day}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-400 shadow-sm transition hover:bg-red-50 hover:text-red-600 dark:bg-[#1e1c1a] dark:text-[#5e584f] dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={openDatePicker}
            aria-label={`选择 ${day} 日期`}
            title="选择日期"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm transition hover:bg-emerald-50 hover:text-emerald-700 dark:bg-[#1e1c1a] dark:text-[#7a746c] dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
          <div
            {...dayDragHandleProps}
            role="button"
            aria-label={`拖拽 ${day}`}
            className="flex h-10 w-10 cursor-grab items-center justify-center rounded-full bg-white text-stone-700 shadow-sm transition active:cursor-grabbing dark:bg-[#1e1c1a] dark:text-[#b5afa6]"
            title="拖拽调整天数顺序"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          </div>
        </div>
        <input
          ref={dateInputRef}
          type="date"
          value={dateInfo.inputValue}
          onChange={(event) => onSetDayDate(day, event.target.value)}
          onInput={(event) => onSetDayDate(day, event.currentTarget.value)}
          aria-label={`设置 ${day} 日期`}
          className="absolute h-px w-px opacity-0"
          tabIndex={-1}
        />
        {isFilteredView ? (
          <p className="mt-1 text-xs text-stone-500 dark:text-[#7a746c]">
            显示 {items.length}/{totalItems} 项
          </p>
        ) : null}
      </div>
      <Droppable droppableId={day} type="CARD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`mt-3 flex flex-1 flex-col gap-3 rounded-lg transition ${
              snapshot.isDraggingOver ? 'bg-white/90 ring-2 ring-stone-300 dark:bg-[#1e1c1a]/90 dark:ring-[#4a453e]' : ''
            }`}
          >
            {items.length > 0 ? (
              items.map((item, index) =>
                isFilteredView ? (
                  <TripCard
                    key={item.id}
                    item={item}
                    isDragging={false}
                    pendingDeleteId={pendingDeleteId}
                    editingCardId={editingCardId}
                    editForm={editForm}
                    onStartEdit={() => onStartEdit(item)}
                    onEditField={onEditField}
                    onSaveEdit={() => onSaveEdit(day, item.id)}
                    onCancelEdit={onCancelEdit}
                    onDuplicate={() => onDuplicate(day, item.id)}
                    onRequestDelete={() => onRequestDelete(item.id)}
                    onConfirmDelete={() => onConfirmDelete(day, item.id)}
                    onCancelDelete={onCancelDelete}
                  />
                ) : (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        style={dragProvided.draggableProps.style}
                      >
                        <TripCard
                          item={item}
                          isDragging={dragSnapshot.isDragging}
                          pendingDeleteId={pendingDeleteId}
                          editingCardId={editingCardId}
                          editForm={editForm}
                          onStartEdit={() => onStartEdit(item)}
                          onEditField={onEditField}
                          onSaveEdit={() => onSaveEdit(day, item.id)}
                          onCancelEdit={onCancelEdit}
                          onDuplicate={() => onDuplicate(day, item.id)}
                          onRequestDelete={() => onRequestDelete(item.id)}
                          onConfirmDelete={() => onConfirmDelete(day, item.id)}
                          onCancelDelete={onCancelDelete}
                        />
                      </div>
                    )}
                  </Draggable>
                ),
              )
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-stone-400 dark:border-[#4a453e] dark:bg-[#1e1c1a]/60 dark:text-[#5e584f]">
                {isFilteredView ? '没有匹配类型的卡片' : '拖入卡片'}
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </section>
  );
}

function App() {
  const [plan, setPlan] = useState(loadStoredPlan);
  const [idea, setIdea] = useState('我想去洛阳、开封旅游，在10月下旬，5天。预算大概多少，交通工具。');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [cardForm, setCardForm] = useState(createEmptyCardForm('Day 1'));
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [editingCardId, setEditingCardId] = useState('');
  const [editForm, setEditForm] = useState(createCardEditForm(initialTripPlan.itinerary['Day 1'][0]));
  const [importInputKey, setImportInputKey] = useState(0);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [activeTypes, setActiveTypes] = useState(typeOptions);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStageIndex, setGenerationStageIndex] = useState(0);
  const { theme, setTheme } = useTheme();
  const days = Object.entries(plan.itinerary);
  const dayNames = Object.keys(plan.itinerary);
  const plannedDayCount = dayNames.length;
  const itineraryItemCount = days.reduce((total, [, items]) => total + items.length, 0);
  const computedBudgetEstimate = getBudgetRange(plan.itinerary);
  const currentPlanForExport = withComputedBudget(plan);
  const isFilteredView = activeTypes.length !== typeOptions.length;
  const visibleTypeSet = new Set(activeTypes);
  const visibleDays = days.map(([day, items]) => [day, isFilteredView ? items.filter((item) => visibleTypeSet.has(item.type)) : items]);
  const visibleItemCount = visibleDays.reduce((total, [, items]) => total + items.length, 0);
  const typeCounts = typeOptions.reduce((counts, type) => {
    counts[type] = getAllItems(plan.itinerary).filter((item) => item.type === type).length;
    return counts;
  }, {});

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(plan));
    } catch {
      // Local storage can be unavailable in restricted browser modes; the board still works in memory.
    }
  }, [plan]);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationProgress(0);
      setGenerationStageIndex(0);
      return undefined;
    }

    setGenerationProgress(8);
    setGenerationStageIndex(0);
    const interval = window.setInterval(() => {
      setGenerationProgress((currentProgress) => {
        const nextProgress = Math.min(94, currentProgress + Math.ceil((95 - currentProgress) * 0.16));
        const nextStageIndex = Math.min(
          generationStages.length - 1,
          Math.floor((nextProgress / 100) * generationStages.length),
        );
        setGenerationStageIndex(nextStageIndex);
        return nextProgress;
      });
    }, 520);

    return () => window.clearInterval(interval);
  }, [isGenerating]);

  const setItinerary = (nextItinerary) => {
    setPlan((currentPlan) => ({ ...currentPlan, itinerary: nextItinerary }));
  };

  const setDayDate = (day, dayDateValue) => {
    setPlan((currentPlan) => ({
      ...currentPlan,
      start_date: getStartDateFromDayDate(day, dayDateValue),
    }));
  };

  const addDay = () => {
    const currentItinerary = renumberItineraryDays(plan.itinerary);
    const nextDay = `Day ${Object.keys(currentItinerary).length + 1}`;
    setError('');
    setItinerary({
      ...currentItinerary,
      [nextDay]: [],
    });
    setCardForm(createEmptyCardForm(nextDay));
  };

  const deleteDay = (day) => {
    if (dayNames.length <= 1) {
      setError('至少需要保留一天行程。');
      return;
    }

    const itemCount = plan.itinerary[day]?.length || 0;
    if (itemCount > 0 && !window.confirm(`删除 ${day} 会同时删除 ${itemCount} 项行程，确定继续吗？`)) {
      return;
    }

    const nextItinerary = renumberItineraryDays(Object.fromEntries(days.filter(([currentDay]) => currentDay !== day)));
    const nextFirstDay = Object.keys(nextItinerary)[0];

    setPlan((currentPlan) => ({
      ...currentPlan,
      itinerary: nextItinerary,
    }));
    setCardForm(createEmptyCardForm(nextFirstDay));
    setPendingDeleteId('');
    setEditingCardId('');
    setError('');
  };

  const onDragEnd = (result) => {
    const { source, destination, type } = result;
    if (!destination) return;

    if (type === 'DAY') {
      const orderedDays = Array.from(days);
      const [removedDay] = orderedDays.splice(source.index, 1);
      orderedDays.splice(destination.index, 0, removedDay);
      const nextItinerary = renumberItineraryDays(Object.fromEntries(orderedDays));

      setPlan((currentPlan) => ({
        ...currentPlan,
        itinerary: nextItinerary,
      }));
      setCardForm(createEmptyCardForm(Object.keys(nextItinerary)[0]));
      setPendingDeleteId('');
      setEditingCardId('');
      return;
    }

    if (isFilteredView) {
      setError('筛选视图仅用于查看，请先切回全部类型再拖拽卡片。');
      return;
    }

    const sourceColumn = source.droppableId;
    const destinationColumn = destination.droppableId;
    const sourceItems = Array.from(plan.itinerary[sourceColumn]);
    const destinationItems = Array.from(plan.itinerary[destinationColumn]);
    const [removed] = sourceItems.splice(source.index, 1);

    if (sourceColumn === destinationColumn) {
      sourceItems.splice(destination.index, 0, removed);
      setItinerary({ ...plan.itinerary, [sourceColumn]: sourceItems });
      return;
    }

    destinationItems.splice(destination.index, 0, removed);
    setItinerary({
      ...plan.itinerary,
      [sourceColumn]: sourceItems,
      [destinationColumn]: destinationItems,
    });
  };

  const generatePlan = async (event) => {
    event.preventDefault();
    const trimmedIdea = idea.trim();

    if (!trimmedIdea) {
      setError('请输入旅行想法后再生成。');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: trimmedIdea }),
      });
      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('接口返回的不是 JSON，请检查 Vercel API 路由或环境变量配置。');
      }

      if (!response.ok) {
        throw new Error(data.error || '生成失败，请稍后重试。');
      }

      const generatedPlan = normalizeImportedPlan(data);
      setPlan(generatedPlan);
      setCardForm(createEmptyCardForm(Object.keys(generatedPlan.itinerary)[0] || 'Day 1'));
      setEditingCardId('');
      setPendingDeleteId('');
      setGenerationProgress(100);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      window.setTimeout(() => setIsGenerating(false), 250);
    }
  };

  const updateCardForm = (field, value) => {
    setCardForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const clearPlan = () => {
    const emptyPlan = {
      start_date: '',
      total_budget_estimate: '0-1000元',
      recommended_transport: '待推荐',
      itinerary: { 'Day 1': [] },
    };

    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // The in-memory reset below still works if storage is unavailable.
    }

    setIdea('');
    setPlan(emptyPlan);
    setCardForm(createEmptyCardForm('Day 1'));
    setPendingDeleteId('');
    setEditingCardId('');
    setIsAddFormOpen(false);
    setActiveTypes(typeOptions);
    setError('');
  };

  const addCustomCard = (event) => {
    event.preventDefault();
    const title = cardForm.title.trim();

    if (!title) {
      setError('自定义卡片需要填写标题。');
      return;
    }

    const targetDay = plan.itinerary[cardForm.day] ? cardForm.day : dayNames[0];
    const newCard = {
      id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: cardForm.type,
      title,
      cost: formatCostAmount(cardForm.cost),
      duration: cardForm.duration.trim() || '待安排',
      advice: cardForm.advice.trim() || '暂无建议。',
    };

    setError('');
    setItinerary({
      ...plan.itinerary,
      [targetDay]: [...plan.itinerary[targetDay], newCard],
    });
    setCardForm(createEmptyCardForm(targetDay));
    setIsAddFormOpen(false);
  };

  const deleteCard = (day, cardId) => {
    setItinerary({
      ...plan.itinerary,
      [day]: plan.itinerary[day].filter((item) => item.id !== cardId),
    });
    setPendingDeleteId('');
    if (editingCardId === cardId) {
      setEditingCardId('');
    }
  };

  const duplicateCard = (day, cardId) => {
    const dayItems = plan.itinerary[day] || [];
    const sourceIndex = dayItems.findIndex((item) => item.id === cardId);

    if (sourceIndex === -1) {
      setError('未找到要复制的卡片。');
      return;
    }

    const sourceCard = dayItems[sourceIndex];
    const copiedCard = {
      ...sourceCard,
      id: `copy-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: `${sourceCard.title}（副本）`,
    };
    const nextItems = Array.from(dayItems);
    nextItems.splice(sourceIndex + 1, 0, copiedCard);

    setError('');
    setPendingDeleteId('');
    setEditingCardId('');
    setItinerary({
      ...plan.itinerary,
      [day]: nextItems,
    });
  };

  const startEditCard = (item) => {
    setPendingDeleteId('');
    setEditingCardId(item.id);
    setEditForm(createCardEditForm(item));
  };

  const updateEditForm = (field, value) => {
    setEditForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const saveCardEdit = (day, cardId) => {
    const title = editForm.title.trim();

    if (!title) {
      setError('编辑卡片需要填写标题。');
      return;
    }

    setError('');
    setItinerary({
      ...plan.itinerary,
      [day]: plan.itinerary[day].map((item) =>
        item.id === cardId
          ? {
              ...item,
              type: editForm.type,
              title,
              cost: formatCostAmount(editForm.cost),
              duration: editForm.duration.trim() || '待安排',
              advice: editForm.advice.trim() || '暂无建议。',
            }
          : item,
      ),
    });
    setEditingCardId('');
  };

  const exportPlan = () => {
    downloadTextFile(
      JSON.stringify(currentPlanForExport, null, 2),
      `travel-plan-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json;charset=utf-8',
    );
  };

  const exportMarkdown = () => {
    downloadTextFile(
      buildMarkdown(currentPlanForExport),
      `travel-plan-${new Date().toISOString().slice(0, 10)}.md`,
      'text/markdown;charset=utf-8',
    );
  };

  const exportPdf = async () => {
    setIsExportMenuOpen(false);
    const container = document.createElement('div');
    container.innerHTML = buildPrintHtml(currentPlanForExport);
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 120));

    const opt = {
      margin: [10, 10],
      filename: `travel-plan-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 794,
      },
      jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css'] },
    };

    try {
      await html2pdf().set(opt).from(container).save();
    } catch (e) {
      setError('PDF 导出失败，请重试。');
    } finally {
      document.body.removeChild(container);
    }
  };

  const exportImage = async () => {
    try {
      const blob = await buildPlanImageBlob(currentPlanForExport);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `travel-plan-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (imageError) {
      setError(imageError.message || '图片导出失败，请稍后重试。');
    }
  };

  const runExportAction = async (action) => {
    setIsExportMenuOpen(false);
    await action();
  };

  const toggleTypeFilter = (type) => {
    setPendingDeleteId('');
    setEditingCardId('');
    setActiveTypes((currentTypes) =>
      currentTypes.includes(type) ? currentTypes.filter((currentType) => currentType !== type) : [...currentTypes, type],
    );
  };

  const showAllTypes = () => {
    setActiveTypes(typeOptions);
  };

  const importPlan = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const importedPlan = normalizeImportedPlan(JSON.parse(content));
      setPlan(importedPlan);
      setCardForm(createEmptyCardForm(Object.keys(importedPlan.itinerary)[0]));
      setPendingDeleteId('');
      setEditingCardId('');
      setError('');
    } catch (importError) {
      setError(importError.message || '导入失败，请检查 JSON 文件。');
    } finally {
      setImportInputKey((currentKey) => currentKey + 1);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f1e8] text-stone-900 transition-colors duration-300 dark:bg-[#141210] dark:text-[#e8e4df]">
      <div className="map-grid fixed inset-0 opacity-55" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-5 rounded-lg border border-stone-200 bg-white/82 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/82 dark:shadow-soft-dark md:grid-cols-[1.25fr_0.75fr] md:p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600 dark:border-[#3a3630] dark:bg-[#252320] dark:text-[#9a9389]">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                AI 旅行草案
              </span>
              <span className="text-xs font-medium text-stone-500 dark:text-[#7a746c]">编辑看板 Step 5 版本</span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight text-stone-950 dark:text-[#e8e4df] md:text-5xl">
              把粗略想法整理成可调整的每日行程
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 dark:text-[#9a9389] md:text-base">
              输入旅行想法后生成结构化 JSON，也可以手动添加、删除并拖拽调整卡片。
            </p>
          </div>

          <form onSubmit={generatePlan} className="rounded-lg border border-stone-200 bg-[#fbfaf7] p-3 transition dark:border-[#3a3630] dark:bg-[#252320]">
            <div className="flex items-center justify-between">
              <label htmlFor="trip-idea" className="text-sm font-semibold text-stone-800 dark:text-[#c4bdb4]">
                旅行想法
              </label>
              <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
            <textarea
              id="trip-idea"
              className="mt-2 h-28 w-full resize-none rounded-md border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-700 outline-none ring-0 transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              disabled={isGenerating}
            />
            {error ? (
              <div className="mt-3 flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
            {isGenerating ? (
              <LoadingProgress progress={generationProgress} stage={generationStages[generationStageIndex]} />
            ) : null}
            <button
              type="submit"
              disabled={isGenerating}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-500 dark:bg-[#e8e4df] dark:text-[#141210] dark:hover:bg-[#d8d4cf] dark:disabled:bg-[#3a3630] dark:disabled:text-[#7a746c]"
            >
              {isGenerating ? '正在生成行程' : '生成行程草案'}
              {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={clearPlan}
              disabled={isGenerating}
              className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              清空行程
            </button>
          </form>
        </header>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white/85 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">预算预估</p>
            <div className="mt-2 flex items-center gap-3">
              <Coins className="h-6 w-6 text-amber-600" />
              <p className="text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">{computedBudgetEstimate}</p>
            </div>
            <p className="mt-2 text-xs font-medium text-stone-500 dark:text-[#7a746c]">按卡片金额自动汇总，千元区间显示</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white/85 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">推荐交通</p>
            <div className="mt-2 flex items-center gap-3">
              <TrainFront className="h-6 w-6 text-sky-600" />
              <p className="text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">{plan.recommended_transport}</p>
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white/85 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">规划范围</p>
            <div className="mt-2 flex items-center gap-3">
              <Route className="h-6 w-6 text-emerald-600" />
              <p className="text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">
                {plannedDayCount}天 · {itineraryItemCount}项
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 flex-1 overflow-hidden rounded-lg border border-stone-200 bg-white/70 p-3 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/70 dark:shadow-soft-dark">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">Kanban Board</p>
              <h2 className="mt-1 text-lg font-bold text-stone-950 dark:text-[#e8e4df]">每日行程看板</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addDay}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]"
              >
                <Plus className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                添加天数
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]">
                <FileUp className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                导入JSON
                <input key={importInputKey} type="file" accept="application/json,.json" onChange={importPlan} className="hidden" />
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsExportMenuOpen((isOpen) => !isOpen)}
                  aria-expanded={isExportMenuOpen}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]"
                >
                  <Download className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                  导出
                  <ChevronDown className="h-3.5 w-3.5 text-stone-400 dark:text-[#7a746c]" />
                </button>
                {isExportMenuOpen ? (
                  <div className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-lg border border-stone-200 bg-white p-1 shadow-card dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:shadow-card-dark">
                    <button
                      type="button"
                      onClick={() => runExportAction(exportPlan)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-50 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"
                    >
                      <Download className="h-4 w-4" />
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => runExportAction(exportMarkdown)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-50 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"
                    >
                      <FileText className="h-4 w-4" />
                      Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => runExportAction(exportPdf)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-50 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"
                    >
                      <Printer className="h-4 w-4" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => runExportAction(exportImage)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-50 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"
                    >
                      <ImageDown className="h-4 w-4" />
                      图片
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white/80 p-3 transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/80">
            <div className="mr-1 inline-flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-[#7a746c]">
              <SlidersHorizontal className="h-4 w-4" />
              类型筛选
            </div>
            <button
              type="button"
              onClick={showAllTypes}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                !isFilteredView
                  ? 'border-stone-950 bg-stone-950 text-white dark:border-[#e8e4df] dark:bg-[#e8e4df] dark:text-[#141210]'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:bg-[#2e2b26]'
              }`}
            >
              全部 {itineraryItemCount}
            </button>
            {typeOptions.map((type) => {
              const isActive = activeTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleTypeFilter(type)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? getTypeBadgeClass(type)
                      : 'border-stone-200 bg-white text-stone-400 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#5e584f] dark:hover:bg-[#2e2b26]'
                  }`}
                  aria-pressed={isActive}
                >
                  <span className={`h-2 w-2 rounded-full ${typeAccent[type]}`} />
                  {type} {typeCounts[type] || 0}
                </button>
              );
            })}
            {isFilteredView ? (
              <span className="text-xs font-medium text-stone-500 dark:text-[#7a746c]">
                当前显示 {visibleItemCount}/{itineraryItemCount} 项，筛选视图下卡片排序已暂停。
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setIsAddFormOpen((isOpen) => !isOpen)}
              aria-expanded={isAddFormOpen}
              aria-label={isAddFormOpen ? '收起添加行程' : '添加行程'}
              title={isAddFormOpen ? '收起添加行程' : '添加行程'}
              className={`ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                isAddFormOpen
                  ? 'border-stone-950 bg-stone-950 text-white dark:border-[#e8e4df] dark:bg-[#e8e4df] dark:text-[#141210]'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]'
              }`}
            >
              {isAddFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          {isAddFormOpen ? (
            <form
              onSubmit={addCustomCard}
              className="mb-4 grid gap-2 rounded-lg border border-stone-200 bg-white/80 p-3 transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/80 md:grid-cols-[120px_120px_minmax(160px,1.1fr)_120px_120px_minmax(180px,1.2fr)_auto]"
            >
              <select
                value={cardForm.day}
                onChange={(event) => updateCardForm('day', event.target.value)}
                className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
                aria-label="选择日期"
              >
                {dayNames.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <select
                value={cardForm.type}
                onChange={(event) => updateCardForm('type', event.target.value)}
                className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
                aria-label="选择类型"
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                value={cardForm.title}
                onChange={(event) => updateCardForm('title', event.target.value)}
                className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                placeholder="卡片标题"
              />
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={cardForm.cost}
                onChange={(event) => updateCardForm('cost', event.target.value)}
                className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                placeholder="金额（元）"
              />
              <input
                value={cardForm.duration}
                onChange={(event) => updateCardForm('duration', event.target.value)}
                className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                placeholder="耗时"
              />
              <input
                value={cardForm.advice}
                onChange={(event) => updateCardForm('advice', event.target.value)}
                className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                placeholder="建议"
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-[#e8e4df] dark:text-[#141210] dark:hover:bg-[#d8d4cf]"
              >
                <Check className="h-4 w-4" />
                保存
              </button>
            </form>
          ) : null}
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="day-board" direction="horizontal" type="DAY">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-4 overflow-x-auto pb-3">
                  {visibleDays.map(([day, items], index) => (
                    <Draggable key={day} draggableId={`column-${day}`} index={index}>
                      {(dayProvided, daySnapshot) => (
                        <div
                          ref={dayProvided.innerRef}
                          {...dayProvided.draggableProps}
                          style={dayProvided.draggableProps.style}
                        >
                          <DayColumn
                            day={day}
                            items={items}
                            dateInfo={getDayDateInfo(plan.start_date, day)}
                            totalItems={plan.itinerary[day]?.length || 0}
                            isFilteredView={isFilteredView}
                            canDeleteDay={dayNames.length > 1}
                            dayDragHandleProps={dayProvided.dragHandleProps}
                            isDraggingDay={daySnapshot.isDragging}
                            pendingDeleteId={pendingDeleteId}
                            editingCardId={editingCardId}
                            editForm={editForm}
                            onDeleteDay={deleteDay}
                            onStartEdit={startEditCard}
                            onEditField={updateEditForm}
                            onSaveEdit={saveCardEdit}
                            onCancelEdit={() => setEditingCardId('')}
                            onDuplicate={duplicateCard}
                            onSetDayDate={setDayDate}
                            onRequestDelete={setPendingDeleteId}
                            onConfirmDelete={deleteCard}
                            onCancelDelete={() => setPendingDeleteId('')}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
