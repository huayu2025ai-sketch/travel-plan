export function renumberItineraryDays(itinerary) {
  return Object.fromEntries(Object.values(itinerary).map((items, index) => [`Day ${index + 1}`, items]));
}

export function parseDayNumber(day) {
  const match = String(day).match(/Day\s+(\d+)/i);
  return match ? Number(match[1]) : 1;
}

export function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekdayLabel(date) {
  return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
}

export function getDayType(date) {
  const weekday = date.getDay();
  return weekday === 0 || weekday === 6 ? 'weekend' : 'weekday';
}

export function getDateBadgeClass(dateInfo) {
  if (!dateInfo.displayText) return '';

  return dateInfo.dayType === 'weekend'
    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60'
    : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60';
}

export function getDayDateInfo(startDate, day) {
  if (!startDate) return { inputValue: '', displayText: '', dayType: '' };

  const baseDate = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return { inputValue: '', displayText: '', dayType: '' };

  const dayDate = addDays(baseDate, parseDayNumber(day) - 1);
  const inputValue = toDateInputValue(dayDate);

  return {
    inputValue,
    displayText: `${inputValue} ${getWeekdayLabel(dayDate)}`,
    dayType: getDayType(dayDate),
  };
}

export function getStartDateFromDayDate(day, dayDateValue) {
  if (!dayDateValue) return '';

  const selectedDate = new Date(`${dayDateValue}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime())) return '';

  return toDateInputValue(addDays(selectedDate, -(parseDayNumber(day) - 1)));
}

export function getDayHeading(plan, day) {
  const dateInfo = getDayDateInfo(plan.start_date, day);
  const datePart = dateInfo.displayText ? `${day}（${dateInfo.displayText}）` : day;
  return datePart;
}
