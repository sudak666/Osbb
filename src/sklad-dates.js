export function dateInputToTimestamp(dateValue, now = new Date()) {
    if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
    const [year, month, day] = dateValue.split('-').map(Number);
    if (!year || !month || !day || Number.isNaN(now.getTime())) return null;
    const timestamp = new Date(
        year,
        month - 1,
        day,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
    );
    if (Number.isNaN(timestamp.getTime()) || timestamp.getFullYear() !== year || timestamp.getMonth() !== month - 1 || timestamp.getDate() !== day) return null;
    return timestamp.toISOString();
}

export function dateToInputValue(value, fallback = new Date()) {
    const parsed = value ? new Date(String(value)) : fallback;
    const date = Number.isNaN(parsed.getTime()) ? fallback : parsed;
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
