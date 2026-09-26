import { formatCostAmount, getBudgetRange, packingCategories, parseCostEstimate, typeOptions } from './plan.js';
import { renumberItineraryDays } from './date.js';

export function normalizeImportedPlan(value) {
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
            cost_estimate: item?.cost_estimate && Number.isFinite(item.cost_estimate.min) && Number.isFinite(item.cost_estimate.max)
              ? item.cost_estimate
              : parseCostEstimate(item?.cost),
            duration: String(item?.duration || '待安排'),
            advice: String(item?.advice || '暂无建议。'),
          };
        })
      : [];
  });

  if (Object.keys(normalizedItinerary).length === 0) {
    throw new Error('JSON 中没有可用的 Day 数据。');
  }

  const renumberedItinerary = renumberItineraryDays(normalizedItinerary);

  const normalizedPackingItems = Array.isArray(value.packing_items)
    ? value.packing_items.map((item, index) => ({
        id: String(item?.id || `packing-${Date.now()}-${index}`).replace(/[^a-zA-Z0-9-_]/g, '-'),
        name: String(item?.name || '未命名物品'),
        category: packingCategories.includes(item?.category) ? item.category : '其他',
        quantity: String(item?.quantity || '1'),
        packed: Boolean(item?.packed),
        note: String(item?.note || ''),
      }))
    : [];

  const normalizedWeather = {};
  const rawWeather = value.weather && typeof value.weather === 'object' ? value.weather : {};
  for (const day of Object.keys(renumberedItinerary)) {
    normalizedWeather[day] = String(rawWeather[day] || '').trim();
  }

  return {
    destination: String(value.destination || ''),
    start_date: String(value.start_date || ''),
    total_budget_estimate: getBudgetRange(normalizedItinerary),
    recommended_transport: String(value.recommended_transport || '待推荐'),
    weather: normalizedWeather,
    weather_context: value.weather_context && typeof value.weather_context === 'object'
      ? value.weather_context
      : null,
    packing_items: normalizedPackingItems,
    itinerary: renumberedItinerary,
  };
}

