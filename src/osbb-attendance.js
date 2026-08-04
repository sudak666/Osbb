function parseTime(value) {
    if (typeof value !== 'string' || !/^\d{1,2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
}

export function normalizeAttendanceMonth(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const month = {};
    for (const [day, roles] of Object.entries(value)) {
        const numericDay = Number(day);
        if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31 || typeof roles !== 'object' || roles === null || Array.isArray(roles)) continue;
        const normalizedRoles = {};
        for (const [role, cell] of Object.entries(roles)) {
            if (typeof cell !== 'object' || cell === null || Array.isArray(cell)) continue;
            const checkIn = parseTime(cell.checkIn) === null ? undefined : cell.checkIn;
            const checkOut = parseTime(cell.checkOut) === null ? undefined : cell.checkOut;
            if (checkIn || checkOut) normalizedRoles[role] = { checkIn, checkOut };
        }
        if (Object.keys(normalizedRoles).length) month[day] = normalizedRoles;
    }
    return month;
}

export function attendanceHours(cell) {
    const checkIn = parseTime(cell.checkIn);
    const checkOut = parseTime(cell.checkOut);
    if (checkIn === null || checkOut === null) return 0;
    let minutes = checkOut - checkIn;
    if (minutes < 0) minutes += 24 * 60;
    return minutes / 60;
}

export function attendanceCellState(cell) {
    if (cell.checkIn && cell.checkOut) return 'is-complete-cell';
    if (cell.checkIn || cell.checkOut) return 'is-partial-cell';
    return 'is-empty-cell';
}

export function attendanceDayState(cells) {
    const populated = cells.filter((cell) => cell.checkIn || cell.checkOut).length;
    const completed = cells.filter((cell) => cell.checkIn && cell.checkOut).length;
    if (populated === 0) return 'is-empty-day';
    return cells.length > 0 && completed === cells.length ? 'is-filled-day' : 'is-partial-day';
}

export function calculateAttendanceTotals(data, roles, daysInMonth) {
    const totals = Object.fromEntries(roles.map((role) => [role, { days: 0, hours: 0 }]));
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
