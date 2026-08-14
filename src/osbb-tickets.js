export const TICKET_PRIORITIES = {
    HIGH: { label: 'Терміново', order: 0 },
    MEDIUM: { label: 'Звичайний', order: 1 },
    LOW: { label: 'Нетерміново', order: 2 },
};

export function isTicketPriority(value) {
    return typeof value === 'string' && value in TICKET_PRIORITIES;
}

export function normalizeTicketPriority(value, fallback = 'MEDIUM') {
    return isTicketPriority(value) ? value : fallback;
}

export function ticketSortComparator(a, b) {
    const firstPriority = TICKET_PRIORITIES[normalizeTicketPriority(a.priority)].order;
    const secondPriority = TICKET_PRIORITIES[normalizeTicketPriority(b.priority)].order;
    if (firstPriority !== secondPriority) return firstPriority - secondPriority;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
}

export function jiraPriorityClass(priority) {
    const value = String(priority ?? '').toLowerCase();
    if (value.includes('highest') || value.includes('high')) return 'HIGH';
    if (value.includes('lowest') || value.includes('low')) return 'LOW';
    return 'MEDIUM';
}

export function formatJiraShareText(issue) {
    const summary = String(issue?.summary ?? '').trim() || 'Без назви';
    const key = String(issue?.key ?? '').trim();
    const category = String(issue?.category ?? '').trim();
    const url = String(issue?.url ?? '').trim();
    return [
        `Завдання: ${summary}`,
        category ? `Категорія: ${category}` : '',
        key ? `Jira: ${key}${url ? ` — ${url}` : ''}` : url,
    ].filter(Boolean).join('\n');
}

export function matchesDispatcherDateFilter(year, month, day, filter, now = new Date()) {
    if (filter !== 'today' && filter !== 'current_week') return true;
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || Number.isNaN(now.getTime())) return false;
    const dayDate = new Date(year, month, day);
    const today = new Date(now);
    dayDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (filter === 'today') return dayDate.getTime() === today.getTime();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return dayDate >= weekStart && dayDate <= weekEnd;
}
