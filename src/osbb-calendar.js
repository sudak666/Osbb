// Згенеровано з src/osbb-calendar.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
function assertCalendarMonth(year, month) {
  if (!Number.isSafeInteger(year) || year < 2e3 || year > 2100) throw new TypeError("Invalid calendar year");
  if (!Number.isSafeInteger(month) || month < 0 || month > 11) throw new TypeError("Invalid calendar month");
}
function shiftCalendarMonth(year, month, delta, minYear = 2e3, maxYear = 2100) {
  assertCalendarMonth(year, month);
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(minYear) || !Number.isSafeInteger(maxYear) || minYear > maxYear) {
    throw new TypeError("Invalid calendar range");
  }
  const absoluteMonth = year * 12 + month + delta;
  const nextYear = Math.floor(absoluteMonth / 12);
  const nextMonth = (absoluteMonth % 12 + 12) % 12;
  return nextYear < minYear || nextYear > maxYear ? null : { year: nextYear, month: nextMonth };
}
function calendarMonthDays(year, month) {
  assertCalendarMonth(year, month);
  return new Date(year, month + 1, 0).getDate();
}
function mondayFirstDayOffset(year, month) {
  assertCalendarMonth(year, month);
  return (new Date(year, month, 1).getDay() + 6) % 7;
}
function adjacentCalendarDays(year, month) {
  assertCalendarMonth(year, month);
  const leadingCount = mondayFirstDayOffset(year, month);
  const daysInMonth = calendarMonthDays(year, month);
  const previous = shiftCalendarMonth(year, month, -1);
  const next = shiftCalendarMonth(year, month, 1);
  const previousDays = previous ? calendarMonthDays(previous.year, previous.month) : 0;
  const trailingCount = (7 - (leadingCount + daysInMonth) % 7) % 7;
  return {
    leading: previous ? Array.from({ length: leadingCount }, (_, index) => ({
      ...previous,
      day: previousDays - leadingCount + index + 1
    })) : [],
    trailing: next ? Array.from({ length: trailingCount }, (_, index) => ({ ...next, day: index + 1 })) : []
  };
}
function sundayFirstDayOffset(year, month) {
  assertCalendarMonth(year, month);
  return new Date(year, month, 1).getDay();
}
function isCalendarMonth(year, month, date) {
  assertCalendarMonth(year, month);
  return date.getFullYear() === year && date.getMonth() === month;
}
function zeroBasedMonthKey(year, month) {
  assertCalendarMonth(year, month);
  return `${year}-${month}`;
}
export {
  adjacentCalendarDays,
  calendarMonthDays,
  isCalendarMonth,
  mondayFirstDayOffset,
  shiftCalendarMonth,
  sundayFirstDayOffset,
  zeroBasedMonthKey
};
