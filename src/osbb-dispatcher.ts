import type { TicketPriority } from './osbb-tickets.ts';

export type DispatcherTicketStatus = 'open' | 'done';

export interface DispatcherTicket {
    id: string;
    text: string;
    role: string;
    priority: TicketPriority;
    status: DispatcherTicketStatus;
    comment?: string;
    photos?: string[];
    createdAt?: string;
    closedAt?: string;
    closedBy?: string;
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

const WORKER_ROLES = new Set(['plumber', 'janitor', 'electrician']);
const TICKET_PRIORITIES = new Set<TicketPriority>(['HIGH', 'MEDIUM', 'LOW']);

function boundedText(value: unknown, maxLength: number): string {
    if (typeof value !== 'string') return '';
    const normalized = value.trim();
    return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength);
}

export function normalizeDispatcherTicket(value: unknown): DispatcherTicket | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const id = boundedText(row.id, 128);
    if (!id) return null;
    const priority = TICKET_PRIORITIES.has(row.priority as TicketPriority) ? row.priority as TicketPriority : 'MEDIUM';
    const status: DispatcherTicketStatus = row.status === 'done' ? 'done' : 'open';
    const role = WORKER_ROLES.has(String(row.role)) ? String(row.role) : '';
    const photos = Array.isArray(row.photos)
        ? row.photos.filter((photo): photo is string => typeof photo === 'string' && photo.trim() !== '').map((photo) => photo.trim())
        : [];
    return {
        id,
        text: boundedText(row.text, 2_000),
        role,
        priority,
        status,
        comment: boundedText(row.comment, 4_000),
        photos,
        createdAt: boundedText(row.createdAt, 100),
        closedAt: boundedText(row.closedAt, 100),
        closedBy: boundedText(row.closedBy, 200),
    };
}

export function normalizeDispatcherDay(row: unknown): DispatcherDay {
    if (typeof row !== 'object' || row === null) return { ticketsList: [] };
    const source = 'ticketsList' in row && Array.isArray(row.ticketsList) ? row.ticketsList : [];
    const ticketsList = source.flatMap((ticket) => {
        const normalized = normalizeDispatcherTicket(ticket);
        return normalized ? [normalized] : [];
    });
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
