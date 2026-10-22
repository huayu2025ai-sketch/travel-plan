import { formatCostAmount, getBudgetRange, parseCostEstimate, typeOptions } from './plan.js';
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

  const normalizedWeather = {};
  const rawWeather = value.weather && typeof value.weather === 'object' && !Array.isArray(value.weather) ? value.weather : {};
  Object.keys(normalizedItinerary).forEach((originalDay, index) => {
    normalizedWeather[`Day ${index + 1}`] = typeof rawWeather[originalDay] === 'string' ? rawWeather[originalDay].trim() : '';
  });

  const destination = String(value.destination || '').trim();
  const startDate = String(value.start_date || '');
  const rawContext = value.weather_context;
  let weatherContext = null;
  if (rawContext && typeof rawContext === 'object' && !Array.isArray(rawContext)) {
    const matchesTrip = String(rawContext.destination || '').trim() === destination && rawContext.start_date === startDate;
    if (matchesTrip) {
      weatherContext = { destination, start_date: startDate };
      if (Number.isInteger(rawContext.days) && rawContext.days > 0) weatherContext.days = rawContext.days;
      if (typeof rawContext.location_label === 'string') weatherContext.location_label = rawContext.location_label.trim();
      if (typeof rawContext.updated_at === 'string' && Number.isFinite(Date.parse(rawContext.updated_at))) {
        weatherContext.updated_at = new Date(rawContext.updated_at).toISOString();
      }
    } else {
      for (const day of Object.keys(normalizedWeather)) normalizedWeather[day] = '';
    }
  }

  return {
    destination,
    start_date: startDate,
    total_budget_estimate: getBudgetRange(normalizedItinerary),
    recommended_transport: String(value.recommended_transport || '待推荐'),
    weather: normalizedWeather,
    weather_context: weatherContext,
    itinerary: renumberedItinerary,
  };
}
