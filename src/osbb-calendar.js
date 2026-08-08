function assertCalendarMonth(year, month) {
    if (!Number.isSafeInteger(year) || year < 2000 || year > 2100) throw new TypeError('Invalid calendar year');
    if (!Number.isSafeInteger(month) || month < 0 || month > 11) throw new TypeError('Invalid calendar month');
}

export function shiftCalendarMonth(year, month, delta, minYear = 2000, maxYear = 2100) {
    assertCalendarMonth(year, month);
    if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(minYear) || !Number.isSafeInteger(maxYear) || minYear > maxYear) {
        throw new TypeError('Invalid calendar range');
    }
    const absoluteMonth = year * 12 + month + delta;
    const nextYear = Math.floor(absoluteMonth / 12);
    const nextMonth = ((absoluteMonth % 12) + 12) % 12;
    return nextYear < minYear || nextYear > maxYear ? null : { year: nextYear, month: nextMonth };
}

export function calendarMonthDays(year, month) {
    assertCalendarMonth(year, month);
    return new Date(year, month + 1, 0).getDate();
}

export function mondayFirstDayOffset(year, month) {
    assertCalendarMonth(year, month);
    return (new Date(year, month, 1).getDay() + 6) % 7;
}

export function sundayFirstDayOffset(year, month) {
    assertCalendarMonth(year, month);
    return new Date(year, month, 1).getDay();
}

export function isCalendarMonth(year, month, date) {
    assertCalendarMonth(year, month);
    return date.getFullYear() === year && date.getMonth() === month;
}

export function zeroBasedMonthKey(year, month) {
    assertCalendarMonth(year, month);
    return `${year}-${month}`;
}

export function oneBasedMonthKey(year, month) {
    assertCalendarMonth(year, month);
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}
