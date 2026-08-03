export interface AttendanceCell {
    checkIn?: string;
    checkOut?: string;
}

export type AttendanceCellState = 'is-complete-cell' | 'is-partial-cell' | 'is-empty-cell';
export type AttendanceDayState = 'is-empty-day' | 'is-filled-day' | 'is-partial-day';

export interface AttendanceTotal {
    days: number;
    hours: number;
}

export type AttendanceMonth = Record<string, Record<string, AttendanceCell> | undefined>;

function parseTime(value: unknown): number | null {
    if (typeof value !== 'string' || !/^\d{1,2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
}

export function attendanceHours(cell: AttendanceCell): number {
    const checkIn = parseTime(cell.checkIn);
    const checkOut = parseTime(cell.checkOut);
    if (checkIn === null || checkOut === null) return 0;
    let minutes = checkOut - checkIn;
    if (minutes < 0) minutes += 24 * 60;
    return minutes / 60;
}

export function attendanceCellState(cell: AttendanceCell): AttendanceCellState {
    if (cell.checkIn && cell.checkOut) return 'is-complete-cell';
    if (cell.checkIn || cell.checkOut) return 'is-partial-cell';
    return 'is-empty-cell';
}

export function attendanceDayState(cells: readonly AttendanceCell[]): AttendanceDayState {
    const populated = cells.filter((cell) => cell.checkIn || cell.checkOut).length;
    const completed = cells.filter((cell) => cell.checkIn && cell.checkOut).length;
    if (populated === 0) return 'is-empty-day';
    return cells.length > 0 && completed === cells.length ? 'is-filled-day' : 'is-partial-day';
}

export function calculateAttendanceTotals(
    data: AttendanceMonth,
    roles: readonly string[],
    daysInMonth: number,
): Record<string, AttendanceTotal> {
    const totals = Object.fromEntries(roles.map((role) => [role, { days: 0, hours: 0 }])) as Record<string, AttendanceTotal>;
    for (let day = 1; day <= daysInMonth; day += 1) {
        for (const role of roles) {
            const hours = attendanceHours(data[String(day)]?.[role] ?? {});
            if (hours > 0) {
                totals[role].days += 1;
                totals[role].hours += hours;
            }
        }
    }
    return totals;
}
