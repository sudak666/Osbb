export interface CalendarMonth {
    year: number;
    month: number;
}

export interface AdjacentCalendarDay extends CalendarMonth {
    day: number;
}

export interface AdjacentCalendarDays {
    leading: AdjacentCalendarDay[];
    trailing: AdjacentCalendarDay[];
}

function assertCalendarMonth(year: number, month: number): void {
    if (!Number.isSafeInteger(year) || year < 2000 || year > 2100) throw new TypeError('Invalid calendar year');
    if (!Number.isSafeInteger(month) || month < 0 || month > 11) throw new TypeError('Invalid calendar month');
}

export function shiftCalendarMonth(
    year: number,
    month: number,
    delta: number,
    minYear = 2000,
    maxYear = 2100,
): CalendarMonth | null {
    assertCalendarMonth(year, month);
    if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(minYear) || !Number.isSafeInteger(maxYear) || minYear > maxYear) {
        throw new TypeError('Invalid calendar range');
    }
    const absoluteMonth = year * 12 + month + delta;
    const nextYear = Math.floor(absoluteMonth / 12);
    const nextMonth = ((absoluteMonth % 12) + 12) % 12;
    return nextYear < minYear || nextYear > maxYear ? null : { year: nextYear, month: nextMonth };
}

export function calendarMonthDays(year: number, month: number): number {
    assertCalendarMonth(year, month);
    return new Date(year, month + 1, 0).getDate();
}

export function mondayFirstDayOffset(year: number, month: number): number {
    assertCalendarMonth(year, month);
    return (new Date(year, month, 1).getDay() + 6) % 7;
}

export function adjacentCalendarDays(year: number, month: number): AdjacentCalendarDays {
    assertCalendarMonth(year, month);
    const leadingCount = mondayFirstDayOffset(year, month);
    const daysInMonth = calendarMonthDays(year, month);
    const previous = shiftCalendarMonth(year, month, -1);
    const next = shiftCalendarMonth(year, month, 1);
    const previousDays = previous ? calendarMonthDays(previous.year, previous.month) : 0;
    const trailingCount = (7 - ((leadingCount + daysInMonth) % 7)) % 7;
    return {
        leading: previous
            ? Array.from({ length: leadingCount }, (_, index) => ({
                ...previous,
                day: previousDays - leadingCount + index + 1,
            }))
            : [],
        trailing: next
            ? Array.from({ length: trailingCount }, (_, index) => ({ ...next, day: index + 1 }))
            : [],
    };
}

export function sundayFirstDayOffset(year: number, month: number): number {
    assertCalendarMonth(year, month);
    return new Date(year, month, 1).getDay();
}

export function isCalendarMonth(year: number, month: number, date: Date): boolean {
    assertCalendarMonth(year, month);
    return date.getFullYear() === year && date.getMonth() === month;
}

export function zeroBasedMonthKey(year: number, month: number): string {
    assertCalendarMonth(year, month);
    return `${year}-${month}`;
}

export function oneBasedMonthKey(year: number, month: number): string {
    assertCalendarMonth(year, month);
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}
