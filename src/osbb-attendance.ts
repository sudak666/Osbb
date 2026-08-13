export interface AttendanceCell {
    checkIn?: string;
    breakStart?: string;
    breakEnd?: string;
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

const ATTENDANCE_ROLES = new Set(['plumber', 'janitor', 'electrician']);
const ATTENDANCE_FIELDS = ['checkIn', 'breakStart', 'breakEnd', 'checkOut'] as const;

function elapsedMinutes(start: number, end: number): number {
    let minutes = end - start;
    if (minutes < 0) minutes += 24 * 60;
    return minutes;
}

export function normalizeAttendanceMonth(value: unknown): AttendanceMonth {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const month: AttendanceMonth = {};
    for (const [day, roles] of Object.entries(value)) {
        const numericDay = Number(day);
        if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31 || typeof roles !== 'object' || roles === null || Array.isArray(roles)) continue;
        const normalizedRoles: Record<string, AttendanceCell> = {};
        for (const [role, cell] of Object.entries(roles)) {
            if (!ATTENDANCE_ROLES.has(role)) continue;
            if (typeof cell !== 'object' || cell === null || Array.isArray(cell)) continue;
            const raw = cell as Record<string, unknown>;
            const normalizedCell: AttendanceCell = Object.fromEntries(ATTENDANCE_FIELDS.map(field => [
                field,
                parseTime(raw[field]) === null ? undefined : raw[field] as string,
            ]));
            if (ATTENDANCE_FIELDS.some(field => normalizedCell[field])) normalizedRoles[role] = normalizedCell;
        }
        if (Object.keys(normalizedRoles).length) month[day] = normalizedRoles;
    }
    return month;
}

export function attendanceHours(cell: AttendanceCell): number {
    const checkIn = parseTime(cell.checkIn);
    const checkOut = parseTime(cell.checkOut);
    if (checkIn === null || checkOut === null) return 0;
    const shiftMinutes = elapsedMinutes(checkIn, checkOut);
    const breakStart = parseTime(cell.breakStart);
    const breakEnd = parseTime(cell.breakEnd);
    if ((breakStart === null) !== (breakEnd === null)) return 0;
    if (breakStart === null || breakEnd === null) return shiftMinutes / 60;
    const breakStartOffset = elapsedMinutes(checkIn, breakStart);
    const breakEndOffset = elapsedMinutes(checkIn, breakEnd);
    if (breakStartOffset >= breakEndOffset || breakEndOffset > shiftMinutes) return 0;
    return (shiftMinutes - (breakEndOffset - breakStartOffset)) / 60;
}

export function attendanceCellError(cell: AttendanceCell): string {
    const values = Object.fromEntries(ATTENDANCE_FIELDS.map(field => [field, parseTime(cell[field])])) as Record<typeof ATTENDANCE_FIELDS[number], number | null>;
    const invalidField = ATTENDANCE_FIELDS.find(field => cell[field] && values[field] === null);
    if (invalidField) return 'Введіть час у форматі ГГ:ХХ';
    if ((values.breakStart === null) !== (values.breakEnd === null)) return 'Заповніть обидва поля обіду';
    if (values.checkIn === null || values.checkOut === null) return '';
    const shiftMinutes = elapsedMinutes(values.checkIn, values.checkOut);
    if (values.breakStart !== null && values.breakEnd !== null) {
        const breakStartOffset = elapsedMinutes(values.checkIn, values.breakStart);
        const breakEndOffset = elapsedMinutes(values.checkIn, values.breakEnd);
        if (breakStartOffset >= breakEndOffset || breakEndOffset > shiftMinutes) return 'Обід має бути між приходом і відходом';
    }
    return '';
}

export function formatAttendanceDuration(hours: number): string {
    const totalMinutes = Math.max(0, Math.round((Number(hours) || 0) * 60));
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${wholeHours} год ${String(minutes).padStart(2, '0')} хв`;
}

export function attendanceCellState(cell: AttendanceCell): AttendanceCellState {
    const populated = ATTENDANCE_FIELDS.filter(field => cell[field]).length;
    const hasCompleteBreak = Boolean(cell.breakStart) === Boolean(cell.breakEnd);
    if (cell.checkIn && cell.checkOut && hasCompleteBreak && !attendanceCellError(cell)) return 'is-complete-cell';
    if (populated) return 'is-partial-cell';
    return 'is-empty-cell';
}

export function attendanceDayState(cells: readonly AttendanceCell[]): AttendanceDayState {
    const populated = cells.filter((cell) => ATTENDANCE_FIELDS.some(field => cell[field])).length;
    const completed = cells.filter((cell) => attendanceCellState(cell) === 'is-complete-cell').length;
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
