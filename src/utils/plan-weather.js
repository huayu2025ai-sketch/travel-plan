import { getDayDateInfo, getStartDateFromDayDate } from './date.js';

export function updatePlanDayDate(plan, day, dayDateValue) {
  const startDate = getStartDateFromDayDate(day, dayDateValue);
  if (startDate === plan.start_date) return plan;
  return { ...plan, start_date: startDate, weather: {}, weather_context: null };
}

export function getPlanWeather(plan, day) {
  const context = plan.weather_context;
  if (context && (context.start_date !== plan.start_date || String(context.destination).trim() !== String(plan.destination).trim())) return '';
  return typeof plan.weather?.[day] === 'string' ? plan.weather[day].trim() : '';
}

export function getWeatherTripKey(plan) {
  return JSON.stringify([String(plan.destination || '').trim(), plan.start_date, Object.keys(plan.itinerary || {})]);
}

export function getWeatherCoverage(plan) {
  const dates = Object.keys(plan.itinerary || {})
    .filter((day) => getPlanWeather(plan, day))
    .map((day) => getDayDateInfo(plan.start_date, day).inputValue)
    .filter(Boolean).sort();
  if (!dates.length) return null;
  return {
    start_date: dates[0],
    end_date: dates.at(-1),
    location_label: plan.weather_context?.location_label || plan.destination,
    updated_at: plan.weather_context?.updated_at || '',
  };
}
