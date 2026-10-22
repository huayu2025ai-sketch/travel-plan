import { getDayDateInfo } from './date.js';
import { getPlanWeather } from './plan-weather.js';
import { PLAN_SITE_QR_ROWS } from '../content/site-qr.js';

const WIDTH = 900;
const SANS = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", serif';
const INK = '#202d34';
const RED = '#bf4b3e';
const GREEN = '#315f4d';
const TEXT_X = 246;
const TEXT_WIDTH = 570;
const HEADER_WIDTH = 500;
const HEADER_CENTER_X = 464;
const LONG_LAYOUT = {
  cardWidth: 820, headerHeight: 60, contentTop: 76, tagWidth: 218,
  daySize: 44, dateSize: 32, dateX: 286, textX: TEXT_X, textWidth: TEXT_WIDTH,
  iconX: 157, titleSize: 32, titleLine: 40, detailSize: 23, detailLine: 30, rowMin: 86,
};
const DUAL_LAYOUT = {
  cardWidth: 398, headerHeight: 52, contentTop: 68, tagWidth: 120,
  daySize: 30, dateSize: 22, dateX: 180, textX: 124, textWidth: 294,
  iconX: 82, titleSize: 28, titleLine: 36, detailSize: 22, detailLine: 28, rowMin: 78,
};

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
    // Keep times and numbers together, and punctuation with its preceding text.
    const tokens = paragraph.match(/[（《「『【“‘(]*(?:[A-Za-z0-9]+(?:[.:/–—-][A-Za-z0-9]+)*|.)[，。！？；：、）》」』】”’…,.!?;:%)]*/gu) || [];
    for (const token of tokens) {
      const parts = ctx.measureText(token).width > maxWidth ? [...token] : [token];
      for (const part of parts) {
        if (line && ctx.measureText(line + part).width > maxWidth) {
          lines.push(line.trimEnd());
          line = '';
        }
        line += part;
      }
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
  const columns = entries.length >= 3 ? 2 : 1;
  const layout = columns === 2 ? DUAL_LAYOUT : LONG_LAYOUT;

  const title = tripTitle(plan, entries.length);
  let titleSize = 66;
  font(ctx, titleSize, 900, SERIF);
  while (ctx.measureText(title).width > HEADER_WIDTH && titleSize > 46) {
    titleSize -= 2;
    font(ctx, titleSize, 900, SERIF);
  }
  const titleLines = wrapText(ctx, title, HEADER_WIDTH);
  const titleHeight = titleLines.length * (titleSize + 10);
  const dateY = 34 + titleHeight + 26;
  font(ctx, 23, 600);
  const summary = String(plan.recommended_transport || '').trim();
  const summaryLines = summary ? wrapText(ctx, summary, HEADER_WIDTH - 48) : [];
  const summaryY = dateY + 18;
  const summaryHeight = summaryLines.length ? summaryLines.length * 30 + 14 : 0;
  let y = Math.max(220, summaryY + summaryHeight + 22);

  const days = entries.map(([day, items], dayIndex) => {
    const top = y;
    const weather = getPlanWeather(plan, day);
    font(ctx, layout.cardWidth < 820 ? 20 : 23);
    const weatherLines = weather ? wrapText(ctx, `天气：${weather}`, layout.cardWidth - 32) : [];
    const weatherHeight = weatherLines.length ? weatherLines.length * 28 + 8 : 0;
    y += layout.contentTop + weatherHeight;
    const rows = (items || []).map((item) => {
      const reservation = needsReservation(item);
      font(ctx, layout.titleSize, 800);
      const titleLines = wrapText(ctx, item.title || '未命名行程', layout.textWidth);
      const lastTitleWidth = ctx.measureText(titleLines.at(-1)).width;
      const badgeOwnLine = reservation && lastTitleWidth + 114 > layout.textWidth;
      const titleHeight = titleLines.length * layout.titleLine;
      const detail = [item.duration, item.advice].filter(Boolean).join(' · ');
      font(ctx, layout.detailSize);
      const detailLines = detail ? wrapText(ctx, detail, layout.textWidth) : [];
      const detailOffset = titleHeight + (badgeOwnLine ? 40 : 0) + 2;
      const height = Math.max(layout.rowMin, detailOffset + detailLines.length * layout.detailLine + 24);
      const row = { item, y, titleLines, titleHeight, detailLines, detailOffset, reservation, badgeOwnLine, lastTitleWidth, height };
      y += height;
      return row;
    });
    if (!rows.length) y += 80;
    y += 4;
    const height = y - top;
    y += 16;
    return { label: `DAY ${dayIndex + 1}`, date: dayDate(plan, day), top, height, rows, layout, weatherLines, weatherHeight, color: dayIndex % 2 ? GREEN : RED };
  });

  // Read down the left column first, then the right; keep the day counts balanced.
  const columnStart = days[0].top;
  const columnY = [columnStart, columnStart];
  const daysPerColumn = Math.ceil(days.length / columns);
  const positionedDays = days.map((day, index) => {
    const column = Math.floor(index / daysPerColumn);
    const top = columnY[column];
    const offsetY = top - day.top;
    columnY[column] += day.height + 16;
    return { ...day, top, x: column * (layout.cardWidth + 24), rows: day.rows.map((row) => ({ ...row, y: row.y + offsetY })) };
  });
  return { titleLines, titleSize, dateY, date: dateRange(plan, entries.length), summaryLines, summaryY, summaryHeight, days: positionedDays, height: Math.max(...columnY.slice(0, columns)) + 20 };
}

function drawSiteQr(ctx) {
  const x = 40;
  const y = 26;
  const cell = 4;
  const size = PLAN_SITE_QR_ROWS.length * cell;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = INK;
  PLAN_SITE_QR_ROWS.forEach((row, rowIndex) => {
    [...row].forEach((module, columnIndex) => {
      if (module === '1') ctx.fillRect(x + columnIndex * cell, y + rowIndex * cell, cell, cell);
    });
  });
  ctx.textAlign = 'center';
  font(ctx, 16, 600);
  ctx.fillText('扫码规划行程', x + size / 2, y + size + 18);
  ctx.restore();
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

function drawIcon(ctx, type, y, index, layout) {
  const x = layout.iconX;
  const compact = layout.cardWidth < 820;
  const scale = compact ? 1.45 : 2.15;
  const centerY = y + (compact ? 24 : 30);
  const isRed = index % 2 === 1;
  ctx.fillStyle = isRed ? RED : '#dce4d7';
  ctx.beginPath();
  ctx.ellipse(x, centerY, compact ? 26 : 38, compact ? 22 : 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x - 12 * scale, centerY - 12 * scale);
  ctx.scale(scale, scale);
  ctx.strokeStyle = isRed ? '#fffaf1' : GREEN;
  ctx.lineWidth = 1.65;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(ICONS[type] || ICONS.景点));
  ctx.restore();
}

function drawDay(ctx, day) {
  const { top, height, color, layout } = day;
  roundRect(ctx, 40, top, layout.cardWidth, height, 20);
  ctx.fillStyle = '#fffdf7';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = color === RED ? '#f4e1d9' : '#e5e9dd';
  ctx.fillRect(40, top, layout.cardWidth, layout.headerHeight);
  ctx.restore();
  ctx.strokeStyle = color === RED ? '#e7bdb0' : '#c8d4c1';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 40, top, layout.cardWidth, height, 20);
  ctx.stroke();

  roundRect(ctx, 45, top + 1, layout.tagWidth, layout.headerHeight - 2, 14);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#fffcf4';
  font(ctx, layout.daySize, 800, SERIF);
  ctx.fillText(day.label, layout.cardWidth < 820 ? 54 : 76, top + layout.headerHeight - 16);
  ctx.fillStyle = INK;
  font(ctx, layout.dateSize, 800, SERIF);
  ctx.fillText(day.date, layout.dateX, top + layout.headerHeight - 17);

  ctx.fillStyle = GREEN;
  font(ctx, layout.cardWidth < 820 ? 20 : 23);
  drawLines(ctx, day.weatherLines, 56, top + layout.headerHeight + 26, 28);

  if (!day.rows.length) {
    ctx.fillStyle = '#8b9187';
    font(ctx, layout.cardWidth < 820 ? 22 : 25);
    ctx.fillText('自由安排 · 暂无行程', layout.textX, top + 120 + day.weatherHeight);
  }
  day.rows.forEach((row, index) => {
    const { item, y } = row;
    drawIcon(ctx, item.type, y, index, layout);
    if (index < day.rows.length - 1) {
      const arrowTop = y + (layout.cardWidth < 820 ? 49 : 65);
      const arrowBottom = y + row.height - 8;
      ctx.strokeStyle = '#556058';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(layout.iconX, arrowTop);
      ctx.lineTo(layout.iconX, arrowBottom);
      ctx.moveTo(layout.iconX - 5, arrowBottom - 6);
      ctx.lineTo(layout.iconX, arrowBottom);
      ctx.lineTo(layout.iconX + 5, arrowBottom - 6);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    font(ctx, layout.titleSize, 800);
    drawLines(ctx, row.titleLines, layout.textX, y + 29, layout.titleLine);
    if (row.reservation) {
      const badgeX = row.badgeOwnLine ? layout.textX : layout.textX + row.lastTitleWidth + 14;
      const badgeY = y + row.titleHeight - layout.titleLine + (row.badgeOwnLine ? 40 : 0);
      roundRect(ctx, badgeX, badgeY, 96, 34, 8);
      ctx.fillStyle = '#c53e43';
      ctx.fill();
      ctx.fillStyle = '#fffaf5';
      font(ctx, 23, 700);
      ctx.fillText('需预约', badgeX + 13, badgeY + 25);
    }
    ctx.fillStyle = '#505a60';
    font(ctx, layout.detailSize);
    drawLines(ctx, row.detailLines, layout.textX, y + row.detailOffset + 20, layout.detailLine);
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

function renderPoster(canvas, ctx, poster, scale) {
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.ceil(poster.height * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fcfaf3';
  ctx.fillRect(0, 0, WIDTH, poster.height);
  ctx.textBaseline = 'alphabetic';
  drawSiteQr(ctx);
  drawPavilion(ctx);
  ctx.fillStyle = INK;
  font(ctx, poster.titleSize, 900, SERIF);
  ctx.textAlign = 'center';
  drawLines(ctx, poster.titleLines, HEADER_CENTER_X, 34 + poster.titleSize, poster.titleSize + 10);
  font(ctx, 30, 700, SERIF);
  ctx.fillText(poster.date, HEADER_CENTER_X, poster.dateY);
  if (poster.summaryLines.length) {
    font(ctx, 23, 600);
    const chipWidth = Math.max(...poster.summaryLines.map((line) => ctx.measureText(line).width)) + 48;
    roundRect(ctx, HEADER_CENTER_X - chipWidth / 2, poster.summaryY, chipWidth, poster.summaryHeight, 20);
    ctx.fillStyle = '#edebdc';
    ctx.fill();
    ctx.fillStyle = INK;
    drawLines(ctx, poster.summaryLines, HEADER_CENTER_X, poster.summaryY + 29, 30);
  }
  ctx.textAlign = 'left';
  poster.days.forEach((day) => {
    ctx.save();
    ctx.translate(day.x, 0);
    drawDay(ctx, day);
    ctx.restore();
  });
  return canvasToBlob(canvas);
}

function createCanvas() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持图片导出，请换一个浏览器重试。');
  return { canvas, ctx };
}

export async function buildPlanImageBlob(plan) {
  if (document.fonts?.ready) await document.fonts.ready;
  const { canvas, ctx } = createCanvas();
  const poster = measurePoster(ctx, plan);
  const scale = Math.min(2, 16384 / poster.height, Math.sqrt(16_000_000 / (WIDTH * poster.height)));
  if (scale < 1) throw new Error('行程内容太长，无法导出为清晰长图，请减少内容后重试。');
  return renderPoster(canvas, ctx, poster, scale);
}
