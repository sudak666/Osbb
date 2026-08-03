import type { TicketPriority } from './osbb-tickets.ts';

export type DispatcherTicketStatus = 'open' | 'done';

export interface DispatcherTicket {
    id: string;
    text?: string;
    role?: string;
    priority?: TicketPriority | string;
    status?: DispatcherTicketStatus | string;
    comment?: string;
    photos?: string[];
    createdAt?: string;
    closedAt?: string;
    closedBy?: string;
    [key: string]: unknown;
}

export interface DispatcherDay {
    ticketsList: DispatcherTicket[];
}

export type DispatcherFilter = 'all' | 'today' | 'current_week' | 'has_event' | 'urgent' | 'unresolved' | 'done';

export function normalizeDispatcherDay(row: unknown): DispatcherDay {
    if (typeof row !== 'object' || row === null) return { ticketsList: [] };
    const ticketsList = 'ticketsList' in row && Array.isArray(row.ticketsList) ? row.ticketsList : [];
    return { ticketsList };
}

export function closeDispatcherTicket(
    ticket: DispatcherTicket,
    comment: unknown,
    closedBy: unknown,
    now: Date = new Date(),
): void {
    ticket.status = 'done';
    ticket.comment = String(comment ?? '').trim();
    ticket.closedAt = now.toISOString();
    ticket.closedBy = String(closedBy ?? '');
}

export function reopenDispatcherTicket(ticket: DispatcherTicket): boolean {
    if (ticket.status !== 'done') return false;
    ticket.status = 'open';
    ticket.comment = '';
    delete ticket.closedAt;
    delete ticket.closedBy;
    return true;
}

export function matchesDispatcherFilter(
    row: DispatcherDay,
    hasEvent: boolean,
    filter: DispatcherFilter | string,
    dateMatches: boolean,
): boolean {
    if (filter === 'today' || filter === 'current_week') return dateMatches;
    if (filter === 'has_event') return hasEvent;
    if (filter === 'urgent') return row.ticketsList.some((ticket) => ticket.priority === 'HIGH' && ticket.status !== 'done');
    if (filter === 'unresolved') return row.ticketsList.some((ticket) => ticket.status !== 'done');
    if (filter === 'done') return row.ticketsList.length > 0 && row.ticketsList.every((ticket) => ticket.status === 'done');
    return true;
}
