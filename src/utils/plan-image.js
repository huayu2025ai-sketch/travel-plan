import { getDayDateInfo } from './date.js';

const WIDTH = 900;
const SANS = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", serif';
const INK = '#202d34';
const RED = '#bf4b3e';
const GREEN = '#315f4d';
const TEXT_X = 246;
const TEXT_WIDTH = 570;

// Local vector artwork keeps exports sharp and independent of external image services.
const ICONS = {
  交通: 'M5 15h14l-2-8H7z M8 7V5h8v2 M7 18l-2 3 M17 18l2 3 M7 18h10 M8 11h8 M8 15h.01 M16 15h.01',
  景点: 'M3 19h18L15 7l-4 6-3-4z M12 3v2 M3 5l1 1 M20 4l-1 1',
  citywalk: 'M3 20h18 M5 20V10h14v10 M9 20v-6h6v6 M3 10l9-6 9 6 M6 5l6-3 6 3',
  美食: 'M3 12h18c-1 6-4 8-9 8s-8-2-9-8z M8 22h8 M14 10l7-7 M10 4c-3 2 3 3 0 5 M6 5c-2 2 2 2 0 4',
  酒店: 'M3 20V5 M21 20v-9H3 M3 17h18 M7 8h3 M13 11V6h6v5',
  娱乐: 'M12 3l2.5 5.5L21 9l-5 4.5 1.5 6.5-5.5-3.5L6.5 20 8 13.5 3 9l6.5-.5z',
  工作: 'M3 8h18v12H3z M8 8V4h8v4 M3 12l9 3 9-3 M12 13v4',
};
const PAVILION = 'M2 21h20 M5 21v-6h14v6 M10 21v-4h4v4 M3 15c4 0 7-2 9-4 2 2 5 4 9 4z M6 12V8h12v4 M3 8c4 0 7-2 9-5 2 3 5 5 9 5z M12 1v2';

function font(ctx, size, weight = 500, family = SANS) {
  ctx.font = `${weight} ${size}px ${family}`;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

// Measure the entire content before drawing; long titles and notes are never truncated.
function wrapText(ctx, value, maxWidth) {
  const lines = [];
  for (const paragraph of String(value || '').split(/\r?\n/)) {
    let line = '';
    for (const character of paragraph) {
      if (line && ctx.measureText(line + character).width > maxWidth) {
        lines.push(line.trimEnd());
        line = '';
      }
      line += character;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function drawLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

function tripTitle(plan, days) {
  const numbers = ['', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];
  const count = (value) => numbers[value] || String(value);
  const length = days === 1 ? '一日游' : `${count(days)}天${count(days - 1)}晚`;
  return `${String(plan.destination || '').trim() || '旅行'}${length}`;
}

function dateRange(plan, days) {
  const first = getDayDateInfo(plan.start_date, 'Day 1').inputValue;
  const last = getDayDateInfo(plan.start_date, `Day ${days}`).inputValue;
  if (!first || !last) return `${days} 天行程 · 出发日期待定`;
  if (days === 1) return first.replaceAll('-', '.');
  return `${first.replaceAll('-', '.')} — ${(first.slice(0, 4) === last.slice(0, 4) ? last.slice(5) : last).replaceAll('-', '.')}`;
}

function dayDate(plan, day) {
  const info = getDayDateInfo(plan.start_date, day);
  if (!info.inputValue) return '日期待定';
  const [, month, date] = info.inputValue.split('-');
  return `${Number(month)}月${Number(date)}日 ${info.displayText.split(' ')[1].replace('星期', '周')}`;
}

function needsReservation(item) {
  // Do not infer booking requirements from a generic mention of tickets or reservations.
  return String(item.advice || '').split(/[。；;！!？?\n]/).some((sentence) => (
    !/(?:无需|无须|不需(?:要)?|不用|不必|免|取消)(?:提前)?预约|(?:是否(?:需(?:要)?|须)?|如需|若需|可能需要|建议|推荐|可(?:以)?)(?:提前)?预约/.test(sentence)
    && /(?:需(?:要)?(?:提前)?预约|须(?:提前)?预约|务必(?:提前)?预约|提前预约)/.test(sentence)
  ));
}

function measurePoster(ctx, plan) {
  const entries = Object.entries(plan.itinerary || {});
  if (!entries.length) throw new Error('还没有可导出的行程，请先添加一天行程。');

  const title = tripTitle(plan, entries.length);
  let titleSize = 66;
  font(ctx, titleSize, 900, SERIF);
  while (ctx.measureText(title).width > 664 && titleSize > 46) {
    titleSize -= 2;
    font(ctx, titleSize, 900, SERIF);
  }
  const titleLines = wrapText(ctx, title, 664);
  const titleHeight = titleLines.length * (titleSize + 10);
  const dateY = 34 + titleHeight + 26;
  font(ctx, 23, 600);
  const summary = String(plan.recommended_transport || '').trim();
  const summaryLines = summary ? wrapText(ctx, summary, 748) : [];
  const summaryY = dateY + 18;
  const summaryHeight = summaryLines.length ? summaryLines.length * 30 + 14 : 0;
  let y = summaryY + summaryHeight + 22;

  const days = entries.map(([day, items], dayIndex) => {
    const top = y;
    y += 76;
    const rows = (items || []).map((item) => {
      const reservation = needsReservation(item);
      font(ctx, 32, 800);
      const titleLines = wrapText(ctx, item.title || '未命名行程', TEXT_WIDTH);
      const lastTitleWidth = ctx.measureText(titleLines.at(-1)).width;
      const badgeOwnLine = reservation && lastTitleWidth + 114 > TEXT_WIDTH;
      const titleHeight = titleLines.length * 40;
      const detail = [item.duration, item.advice].filter(Boolean).join(' · ');
      font(ctx, 23);
      const detailLines = detail ? wrapText(ctx, detail, TEXT_WIDTH) : [];
      const detailOffset = titleHeight + (badgeOwnLine ? 40 : 0) + 2;
      const height = Math.max(86, detailOffset + detailLines.length * 30 + 24);
      const row = { item, y, titleLines, titleHeight, detailLines, detailOffset, reservation, badgeOwnLine, lastTitleWidth, height };
      y += height;
      return row;
    });
    if (!rows.length) y += 80;
    y += 4;
    const height = y - top;
    y += 16;
    return { label: `DAY ${dayIndex + 1}`, date: dayDate(plan, day), top, height, rows, color: dayIndex % 2 ? GREEN : RED };
  });

  return { titleLines, titleSize, dateY, date: dateRange(plan, entries.length), summaryLines, summaryY, summaryHeight, days, height: y + 20 };
}

function drawPavilion(ctx) {
  ctx.save();
  ctx.fillStyle = '#f3d7cd';
  ctx.beginPath();
  ctx.arc(754, 52, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b6c7b7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(731, 146);
  ctx.lineTo(864, 146);
  ctx.stroke();
  ctx.translate(746, 44);
  ctx.scale(4.6, 4.6);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 0.55;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(new Path2D(PAVILION));
  ctx.restore();
}

function drawIcon(ctx, type, y, index) {
  const isRed = index % 2 === 1;
  ctx.fillStyle = isRed ? RED : '#dce4d7';
  ctx.beginPath();
  ctx.ellipse(157, y + 30, 38, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(131, y + 4);
  ctx.scale(2.15, 2.15);
  ctx.strokeStyle = isRed ? '#fffaf1' : GREEN;
  ctx.lineWidth = 1.65;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(ICONS[type] || ICONS.景点));
  ctx.restore();
}

function drawDay(ctx, day) {
  const { top, height, color } = day;
  roundRect(ctx, 40, top, 820, height, 20);
  ctx.fillStyle = '#fffdf7';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = color === RED ? '#f4e1d9' : '#e5e9dd';
  ctx.fillRect(40, top, 820, 60);
  ctx.restore();
  ctx.strokeStyle = color === RED ? '#e7bdb0' : '#c8d4c1';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 40, top, 820, height, 20);
  ctx.stroke();

  roundRect(ctx, 45, top + 1, 218, 58, 14);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#fffcf4';
  font(ctx, 44, 800, SERIF);
  ctx.fillText(day.label, 76, top + 44);
  ctx.fillStyle = INK;
  font(ctx, 32, 800, SERIF);
  ctx.fillText(day.date, 286, top + 43);

  if (!day.rows.length) {
    ctx.fillStyle = '#8b9187';
    font(ctx, 25);
    ctx.fillText('自由安排 · 暂无行程', TEXT_X, top + 120);
  }
  day.rows.forEach((row, index) => {
    const { item, y } = row;
    drawIcon(ctx, item.type, y, index);
    if (index < day.rows.length - 1) {
      const arrowTop = y + 65;
      const arrowBottom = y + row.height - 8;
      ctx.strokeStyle = '#556058';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(157, arrowTop);
      ctx.lineTo(157, arrowBottom);
      ctx.moveTo(152, arrowBottom - 6);
      ctx.lineTo(157, arrowBottom);
      ctx.lineTo(162, arrowBottom - 6);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    font(ctx, 32, 800);
    drawLines(ctx, row.titleLines, TEXT_X, y + 29, 40);
    if (row.reservation) {
      const badgeX = row.badgeOwnLine ? TEXT_X : TEXT_X + row.lastTitleWidth + 14;
      const badgeY = y + row.titleHeight - 40 + (row.badgeOwnLine ? 40 : 0);
      roundRect(ctx, badgeX, badgeY, 96, 34, 8);
      ctx.fillStyle = '#c53e43';
      ctx.fill();
      ctx.fillStyle = '#fffaf5';
      font(ctx, 23, 700);
      ctx.fillText('需预约', badgeX + 13, badgeY + 25);
    }
    ctx.fillStyle = '#505a60';
    font(ctx, 23);
    drawLines(ctx, row.detailLines, TEXT_X, y + row.detailOffset + 20, 30);
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('图片生成失败，行程可能过长，请减少内容后重试。'));
    }, 'image/png');
  });
}

export async function buildPlanImageBlob(plan) {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持图片导出，请换一个浏览器重试。');
  const poster = measurePoster(ctx, plan);
  // Typical exports are 1800px wide. Cap the bitmap for mobile canvas limits.
  const scale = Math.min(2, 16384 / poster.height, Math.sqrt(16_000_000 / (WIDTH * poster.height)));
  if (scale < 1) throw new Error('行程内容太长，无法导出为清晰长图，请减少内容后重试。');
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.ceil(poster.height * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fcfaf3';
  ctx.fillRect(0, 0, WIDTH, poster.height);
  ctx.textBaseline = 'alphabetic';
  drawPavilion(ctx);
  ctx.fillStyle = INK;
  font(ctx, poster.titleSize, 900, SERIF);
  ctx.textAlign = 'center';
  drawLines(ctx, poster.titleLines, 390, 34 + poster.titleSize, poster.titleSize + 10);
  font(ctx, 30, 700, SERIF);
  ctx.fillText(poster.date, WIDTH / 2, poster.dateY);
  if (poster.summaryLines.length) {
    font(ctx, 23, 600);
    const chipWidth = Math.max(...poster.summaryLines.map((line) => ctx.measureText(line).width)) + 48;
    roundRect(ctx, (WIDTH - chipWidth) / 2, poster.summaryY, chipWidth, poster.summaryHeight, 20);
    ctx.fillStyle = '#edebdc';
    ctx.fill();
    ctx.fillStyle = INK;
    drawLines(ctx, poster.summaryLines, WIDTH / 2, poster.summaryY + 29, 30);
  }
  ctx.textAlign = 'left';
  poster.days.forEach((day) => drawDay(ctx, day));
  return canvasToBlob(canvas);
}
