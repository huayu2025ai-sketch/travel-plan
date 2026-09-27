// Only bounded product metadata is collected; never send prompts or personal itineraries.
const events = new Set(['template_use', 'generate_success', 'plan_edit', 'export_success']);
const properties = new Set(['template', 'format', 'mode']);
let queue = [];
let timer;
let attempts = 0;

function flush() {
  timer = undefined;
  if (typeof window.umami?.track === 'function') {
    const pending = queue;
    queue = [];
    attempts = 0;
    for (const event of pending) {
      try { Promise.resolve(window.umami.track(event.name, event.data)).catch(() => {}); }
      catch { /* Analytics must never interrupt editing or saving. */ }
    }
  } else if (queue.length && attempts++ < 20) timer = window.setTimeout(flush, 500);
  else { queue = []; attempts = 0; }
}

export function trackProductEvent(name, data = {}) {
  if (typeof window === 'undefined' || !events.has(name)) return;
  // Do not pollute production reports during local development or previews.
  if (window.location.hostname !== 'travel-plan.solalab.cn' && !window.umami) return;
  const safeData = Object.fromEntries(Object.entries(data).filter(([key, value]) => properties.has(key) && typeof value === 'string').map(([key, value]) => [key, value.slice(0, 80)]));
  queue.push({ name, data: safeData });
  queue = queue.slice(-50);
  if (!timer) flush();
}
