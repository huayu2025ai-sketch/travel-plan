import html2pdf from 'html2pdf.js';

const typeAccentColors = {
  交通: '#0284c7',
  景点: '#059669',
  citywalk: '#65a30d',
  美食: '#d97706',
  酒店: '#7c3aed',
};

const typeBadgeBg = {
  交通: '#f0f9ff',
  景点: '#ecfdf5',
  citywalk: '#f7fee7',
  美食: '#fffbeb',
  酒店: '#f5f3ff',
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function buildPdfHtml(plan) {
  const days = Object.entries(plan.itinerary);
  const totalItems = days.reduce((sum, [, items]) => sum + items.length, 0);
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const overviewHtml = `
    <div style="display:flex;gap:14px;margin-bottom:32px;">
      <div style="flex:1;text-align:center;background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;padding:18px 12px;">
        <p style="font-size:10px;color:#a8a29e;text-transform:uppercase;margin:0 0 6px;letter-spacing:0.12em;font-weight:600;">预算预估</p>
        <p style="font-size:17px;font-weight:800;color:#1c1917;margin:0;">${escapeHtml(plan.total_budget_estimate)}</p>
      </div>
      <div style="flex:1;text-align:center;background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;padding:18px 12px;">
        <p style="font-size:10px;color:#a8a29e;text-transform:uppercase;margin:0 0 6px;letter-spacing:0.12em;font-weight:600;">推荐交通</p>
        <p style="font-size:17px;font-weight:800;color:#1c1917;margin:0;">${escapeHtml(plan.recommended_transport)}</p>
      </div>
      <div style="flex:1;text-align:center;background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;padding:18px 12px;">
        <p style="font-size:10px;color:#a8a29e;text-transform:uppercase;margin:0 0 6px;letter-spacing:0.12em;font-weight:600;">行程规模</p>
        <p style="font-size:17px;font-weight:800;color:#1c1917;margin:0;">${days.length} 天 · ${totalItems} 项</p>
      </div>
    </div>
  `;

  const daysHtml = days
    .map(([day, items]) => {
      const itemsHtml =
        items.length === 0
          ? `<p style="color:#a8a29e;font-size:13px;margin:0;font-style:italic;">暂无安排</p>`
          : `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
          ${items
            .map((item) => {
              const accent = typeAccentColors[item.type] || '#94a3b8';
              const badgeBg = typeBadgeBg[item.type] || '#f8fafc';
              return `
              <div style="border:1px solid #e7e5e4;border-radius:10px;padding:14px 14px 14px 18px;position:relative;overflow:hidden;background:#fff;page-break-inside:avoid;">
                <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${accent};"></div>
                <div style="margin-bottom:6px;">
                  <span style="display:inline-block;font-size:10px;font-weight:700;padding:3px 10px;border-radius:999px;border:1px solid ${accent}30;background:${badgeBg};color:${accent};letter-spacing:0.02em;">${escapeHtml(item.type)}</span>
                </div>
                <h3 style="font-size:14px;font-weight:800;color:#1c1917;margin:0 0 8px;line-height:1.4;">${escapeHtml(item.title)}</h3>
                <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                  <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#57534e;background:#f5f5f4;padding:3px 8px;border-radius:5px;font-weight:500;">
                    <span style="opacity:0.7;">💰</span><span>${escapeHtml(item.cost)}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#57534e;background:#f5f5f4;padding:3px 8px;border-radius:5px;font-weight:500;">
                    <span style="opacity:0.7;">⏱</span><span>${escapeHtml(item.duration)}</span>
                  </div>
                </div>
                <p style="font-size:11px;color:#78716c;margin:0;line-height:1.6;"><span style="opacity:0.6;">💡</span> ${escapeHtml(item.advice)}</p>
              </div>
            `;
            })
            .join('')}
        </div>`;

      return `
        <div style="margin-bottom:26px;page-break-inside:avoid;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <div style="width:28px;height:28px;border-radius:8px;background:#1c1917;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;">${day.replace('Day ', '')}</div>
            <h2 style="font-size:18px;font-weight:800;color:#1c1917;margin:0;">${escapeHtml(day)}</h2>
            <div style="flex:1;height:1px;background:#e7e5e4;"></div>
            <span style="font-size:11px;color:#a8a29e;font-weight:500;">${items.length} 项行程</span>
          </div>
          ${itemsHtml}
        </div>
      `;
    })
    .join('');

  return `
    <div style="font-family:'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif;color:#333;background:#fff;padding:44px 38px;width:794px;box-sizing:border-box;line-height:1.5;">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="display:inline-block;width:48px;height:4px;border-radius:2px;background:#1c1917;margin-bottom:16px;"></div>
        <h1 style="font-size:30px;font-weight:900;color:#1c1917;margin:0;letter-spacing:-0.3px;">旅行行程单</h1>
        <p style="color:#a8a29e;margin-top:8px;font-size:12px;font-weight:500;">AI 智能规划 · ${today}</p>
      </div>
      ${overviewHtml}
      ${daysHtml}
      <div style="margin-top:36px;padding-top:14px;border-top:1px solid #e7e5e4;text-align:center;">
        <p style="font-size:10px;color:#d6d3d1;margin:0;font-weight:500;">由 AI 旅游规划看板生成 · 祝您旅途愉快</p>
      </div>
    </div>
  `;
}

export async function exportTripToPdf(plan) {
  const container = document.createElement('div');
  container.innerHTML = buildPdfHtml(plan);
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 100));

  const opt = {
    margin: [8, 8],
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
  } finally {
    document.body.removeChild(container);
  }
}
