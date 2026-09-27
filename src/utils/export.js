import { getDayDateInfo } from './date.js';

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
    `- 预算预估：${plan.total_budget_estimate}`,
    `- 推荐交通：${plan.recommended_transport}`,
    '',
  ];

  Object.entries(plan.itinerary).forEach(([day, items]) => {
    const dateInfo = getDayDateInfo(plan.start_date, day);
    const dayHeading = dateInfo.displayText ? `${day}（${dateInfo.displayText}）` : day;
    lines.push(`## ${dayHeading}`, '');

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

  lines.push('## 携带物品', '');

  const packingItems = plan.packing_items || [];
  if (packingItems.length === 0) {
    lines.push('- 暂无携带物品记录', '');
  } else {
    packingItems.forEach((item) => {
      const status = item.packed ? '已携带' : '待准备';
      const detail = [item.category, item.quantity, item.note].filter(Boolean).join(' · ');
      lines.push(`- [${item.packed ? 'x' : ' '}] ${item.name}（${status}${detail ? ` · ${detail}` : ''}）`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
