export type StaffRole = 'dispatcher' | 'admin' | 'board' | 'plumber' | 'janitor' | 'electrician';

export interface StaffSession {
    id: string | number;
    name: string;
    role: StaffRole;
}

const STAFF_ROLES: readonly StaffRole[] = ['dispatcher', 'admin', 'board', 'plumber', 'janitor', 'electrician'];
export const WORKER_ROLES: readonly StaffRole[] = ['plumber', 'janitor', 'electrician'];
export const WORKER_ALLOWED_TABS: readonly string[] = ['tabel', 'my-tickets'];

export const STAFF_ROLE_ICONS: Readonly<Record<StaffRole, string>> = {
    dispatcher: 'support_agent',
    admin: 'admin_panel_settings',
    board: 'badge',
    plumber: 'plumbing',
    janitor: 'cleaning_services',
    electrician: 'bolt',
};

export const STAFF_ROLE_LABELS: Readonly<Record<StaffRole, string>> = {
    dispatcher: 'Диспетчер',
    admin: 'Адмін',
    board: 'Правління',
    plumber: 'Сантехнік',
    janitor: 'Двірник',
    electrician: 'Електрик',
};

export function parseStaffSession(value: unknown): StaffSession | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const session = value as Record<string, unknown>;
    const validId = typeof session.id === 'string' && session.id.trim() !== ''
        || typeof session.id === 'number' && Number.isFinite(session.id);
    if (!validId || typeof session.name !== 'string' || session.name.trim() === '') return null;
    if (typeof session.role !== 'string' || !STAFF_ROLES.includes(session.role as StaffRole)) return null;
    return {
        id: typeof session.id === 'string' ? session.id.trim() : session.id as number,
        name: session.name.trim(),
        role: session.role as StaffRole,
    };
}

export function isDispatcherSession(session: StaffSession | null | undefined): boolean {
    return Boolean(session) && ['dispatcher', 'admin', 'board'].includes(session?.role ?? '');
}

export function isWorkerSession(session: StaffSession | null | undefined): boolean {
    return Boolean(session) && WORKER_ROLES.includes(session?.role as StaffRole);
}

export function normalizeWorkerRole(value: unknown, fallback: StaffRole = 'plumber'): StaffRole {
    return typeof value === 'string' && WORKER_ROLES.includes(value as StaffRole) ? value as StaffRole : fallback;
}

export function canManageStaffAccess(session: StaffSession | null | undefined): boolean {
    return session?.role === 'board' || session?.role === 'admin';
}

export function isTabAllowedForSession(tab: string, session: StaffSession | null | undefined): boolean {
    if (isWorkerSession(session)) return WORKER_ALLOWED_TABS.includes(tab);
    if (tab === 'my-tickets') return isDispatcherSession(session);
    if (tab === 'dispatcher') return isDispatcherSession(session) || !session;
    return true;
}
