import { getStartDateFromDayDate } from './date.js';

export function updatePlanDayDate(plan, day, dayDateValue) {
  const startDate = getStartDateFromDayDate(day, dayDateValue);
  if (startDate === plan.start_date) return plan;
  return { ...plan, start_date: startDate, weather: {}, weather_context: null };
}

export function getPlanWeather(plan, day) {
  const context = plan.weather_context;
  if (context && (context.start_date !== plan.start_date || String(context.destination).trim() !== String(plan.destination).trim())) return '';
  return plan.weather?.[day] || '';
}

export function getWeatherTripKey(plan) {
  return JSON.stringify([String(plan.destination || '').trim(), plan.start_date, Object.keys(plan.itinerary || {})]);
}
