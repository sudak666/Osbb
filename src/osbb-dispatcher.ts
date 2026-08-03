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
export type DispatcherDayStatus = 'urgent' | 'done' | 'open' | null;

export interface DispatcherMonthEntry {
    row: DispatcherDay;
    photosCount?: number;
}

export interface DispatcherMonthStats {
    events: number;
    tickets: number;
    urgent: number;
    done: number;
}

export type DispatcherMonth = Record<string, DispatcherDay>;

function isDispatcherTicket(value: unknown): value is DispatcherTicket {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as Record<string, unknown>).id === 'string';
}

export function normalizeDispatcherDay(row: unknown): DispatcherDay {
    if (typeof row !== 'object' || row === null) return { ticketsList: [] };
    const source = 'ticketsList' in row && Array.isArray(row.ticketsList) ? row.ticketsList : [];
    const ticketsList = source.every(isDispatcherTicket) ? source : source.filter(isDispatcherTicket);
    return { ticketsList };
}

export function normalizeDispatcherMonth(value: unknown): DispatcherMonth {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([day, row]) => {
        const numericDay = Number(day);
        if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) return [];
        return [[day, normalizeDispatcherDay(row)]];
    }));
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

export function dispatcherDayStatus(row: DispatcherDay): DispatcherDayStatus {
    if (!row.ticketsList.length) return null;
    if (row.ticketsList.some((ticket) => ticket.priority === 'HIGH' && ticket.status !== 'done')) return 'urgent';
    if (row.ticketsList.every((ticket) => ticket.status === 'done')) return 'done';
    return 'open';
}

export function dispatcherDayStatusLabel(status: DispatcherDayStatus): string {
    if (status === 'urgent') return 'є термінові заявки';
    if (status === 'done') return 'усі заявки виконано';
    if (status === 'open') return 'є відкриті заявки';
    return 'подій немає';
}

export function matchesDispatcherSearchAndWorker(row: DispatcherDay, query: unknown, workerRole: unknown): boolean {
    const normalizedQuery = String(query ?? '').trim().toLocaleLowerCase('uk-UA');
    const searchableText = row.ticketsList.map((ticket) => String(ticket.text ?? '')).join(' ').toLocaleLowerCase('uk-UA');
    const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
    const role = String(workerRole ?? 'all');
    const matchesWorker = role === 'all' || row.ticketsList.some((ticket) => ticket.role === role);
    return matchesSearch && matchesWorker;
}

export function calculateDispatcherMonthStats(entries: readonly DispatcherMonthEntry[]): DispatcherMonthStats {
    return entries.reduce<DispatcherMonthStats>((totals, entry) => {
        const tickets = entry.row.ticketsList;
        if (tickets.length > 0 || Number(entry.photosCount || 0) > 0) totals.events += 1;
        totals.tickets += tickets.length;
        totals.urgent += tickets.filter((ticket) => ticket.priority === 'HIGH' && ticket.status !== 'done').length;
        totals.done += tickets.filter((ticket) => ticket.status === 'done').length;
        return totals;
    }, { events: 0, tickets: 0, urgent: 0, done: 0 });
}
