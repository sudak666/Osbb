export function normalizeDispatcherDay(row) {
    if (typeof row !== 'object' || row === null) return { ticketsList: [] };
    const ticketsList = 'ticketsList' in row && Array.isArray(row.ticketsList) ? row.ticketsList : [];
    return { ticketsList };
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
