function isDispatcherTicket(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value.id === 'string';
}

export function normalizeDispatcherDay(row) {
    if (typeof row !== 'object' || row === null) return { ticketsList: [] };
    const source = 'ticketsList' in row && Array.isArray(row.ticketsList) ? row.ticketsList : [];
    const ticketsList = source.every(isDispatcherTicket) ? source : source.filter(isDispatcherTicket);
    return { ticketsList };
}

export function normalizeDispatcherMonth(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([day, row]) => {
        if (!/^\d{1,2}$/.test(day)) return [];
        return [[day, normalizeDispatcherDay(row)]];
    }));
}

export function closeDispatcherTicket(ticket, comment, closedBy, now = new Date()) {
    ticket.status = 'done';
    ticket.comment = String(comment ?? '').trim();
    ticket.closedAt = now.toISOString();
    ticket.closedBy = String(closedBy ?? '');
}

export function reopenDispatcherTicket(ticket) {
    if (ticket.status !== 'done') return false;
    ticket.status = 'open';
    ticket.comment = '';
    delete ticket.closedAt;
    delete ticket.closedBy;
    return true;
}

export function matchesDispatcherFilter(row, hasEvent, filter, dateMatches) {
    if (filter === 'today' || filter === 'current_week') return dateMatches;
    if (filter === 'has_event') return hasEvent;
    if (filter === 'urgent') return row.ticketsList.some((ticket) => ticket.priority === 'HIGH' && ticket.status !== 'done');
    if (filter === 'unresolved') return row.ticketsList.some((ticket) => ticket.status !== 'done');
    if (filter === 'done') return row.ticketsList.length > 0 && row.ticketsList.every((ticket) => ticket.status === 'done');
    return true;
}

export function dispatcherDayStatus(row) {
    if (!row.ticketsList.length) return null;
    if (row.ticketsList.some((ticket) => ticket.priority === 'HIGH' && ticket.status !== 'done')) return 'urgent';
    if (row.ticketsList.every((ticket) => ticket.status === 'done')) return 'done';
    return 'open';
}

export function dispatcherDayStatusLabel(status) {
    if (status === 'urgent') return 'є термінові заявки';
    if (status === 'done') return 'усі заявки виконано';
    if (status === 'open') return 'є відкриті заявки';
    return 'подій немає';
}

export function matchesDispatcherSearchAndWorker(row, query, workerRole) {
    const normalizedQuery = String(query ?? '').trim().toLocaleLowerCase('uk-UA');
    const searchableText = row.ticketsList.map((ticket) => String(ticket.text ?? '')).join(' ').toLocaleLowerCase('uk-UA');
    const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
    const role = String(workerRole ?? 'all');
    const matchesWorker = role === 'all' || row.ticketsList.some((ticket) => ticket.role === role);
    return matchesSearch && matchesWorker;
}

export function calculateDispatcherMonthStats(entries) {
    return entries.reduce((totals, entry) => {
        const tickets = entry.row.ticketsList;
        if (tickets.length > 0 || Number(entry.photosCount || 0) > 0) totals.events += 1;
        totals.tickets += tickets.length;
        totals.urgent += tickets.filter((ticket) => ticket.priority === 'HIGH' && ticket.status !== 'done').length;
        totals.done += tickets.filter((ticket) => ticket.status === 'done').length;
        return totals;
    }, { events: 0, tickets: 0, urgent: 0, done: 0 });
}
