import { getDayDateInfo } from './date.js';
import { getAllItems } from './plan.js';

function getPrintTypeMeta(type) {
  const meta = {
    交通: { icon: 'T', color: '#0284c7', bg: '#e0f2fe', label: '交通', imageTitle: '出发路上' },
    景点: { icon: 'S', color: '#059669', bg: '#d1fae5', label: '景点', imageTitle: '目的地风景' },
    citywalk: { icon: 'W', color: '#65a30d', bg: '#ecfccb', label: 'Citywalk', imageTitle: '街巷漫步' },
    美食: { icon: 'F', color: '#d97706', bg: '#fef3c7', label: '美食', imageTitle: '地方风味' },
    酒店: { icon: 'H', color: '#7c3aed', bg: '#ede9fe', label: '酒店', imageTitle: '舒适落脚' },
    娱乐: { icon: 'E', color: '#e11d48', bg: '#ffe4e6', label: '娱乐', imageTitle: '轻松玩乐' },
    工作: { icon: 'O', color: '#0891b2', bg: '#cffafe', label: '工作', imageTitle: '行程工作' },
  };

  return meta[type] || { icon: 'P', color: '#57534e', bg: '#f5f5f4', label: type || '行程', imageTitle: '旅途片刻' };
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

export async function buildPlanImageBlob(plan) {
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
      ctx.fillText(`耗时 ${item.duration}`, 242, y + 84);

      ctx.fillStyle = '#78716c';
      ctx.font = '500 20px "PingFang SC", "Microsoft YaHei", sans-serif';
      wrapCanvasText(ctx, item.advice, 720, y + 44, 580, 29, 3);

      y += 166;
    });

    y += 20;
  });

  return canvasToBlob(canvas);
}

