import { getDayDateInfo } from './date.js';
import { getPlanWeather, getWeatherCoverage } from './plan-weather.js';

export function downloadBlobFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function saveBlobFile(blob, filename, description, accept) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description, accept }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
      throw error;
    }
  }

  downloadBlobFile(blob, filename);
  return true;
}

export async function saveTextFile(content, filename, type, description, accept) {
  return saveBlobFile(new Blob([content], { type }), filename, description, accept);
}

export function buildMarkdown(plan) {
  const lines = [
    '# AI 旅行规划',
    '',
    `- 目的地：${plan.destination || '待定'}`,
    `- 预算预估：${plan.total_budget_estimate}`,
    `- 推荐交通：${plan.recommended_transport}`,
    '',
  ];

  const coverage = getWeatherCoverage(plan);
  if (coverage) {
    lines.push(`- 天气获取范围：${coverage.start_date}～${coverage.end_date} · ${coverage.location_label}`);
    if (coverage.updated_at) lines.push(`- 天气更新时间：${coverage.updated_at}`);
    lines.push('');
  }

  Object.entries(plan.itinerary).forEach(([day, items]) => {
    const dateInfo = getDayDateInfo(plan.start_date, day);
    const dayHeading = dateInfo.displayText ? `${day}（${dateInfo.displayText}）` : day;
    lines.push(`## ${dayHeading}`, '');
    const weather = getPlanWeather(plan, day);
    if (weather) lines.push(`- 天气：${weather}`, '');

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
