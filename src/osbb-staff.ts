export type StaffRole = 'dispatcher' | 'admin' | 'board' | 'plumber' | 'janitor' | 'electrician';

export interface StaffSession {
    id: string | number;
    name: string;
    role: StaffRole;
}

export interface StaffListEntry {
    id: string | number;
    full_name: string;
    role: StaffRole;
}

export interface StaffSettingsEntry extends StaffListEntry {
    active: boolean;
}

export interface StaffSessionStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export const STAFF_SESSION_KEY = 'osbb_staff_session';

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
    const name = typeof session.name === 'string' ? session.name.trim() : '';
    const id = typeof session.id === 'string' ? session.id.trim() : session.id;
    if (!validId || String(id).length > 100 || !name || name.length > 100) return null;
    if (typeof session.role !== 'string' || !STAFF_ROLES.includes(session.role as StaffRole)) return null;
    return {
        id: id as string | number,
        name,
        role: session.role as StaffRole,
    };
}

export function loadStoredStaffSession(storage: StaffSessionStorage): StaffSession | null {
    try {
        const raw = storage.getItem(STAFF_SESSION_KEY);
        if (!raw) return null;
        const session = parseStaffSession(JSON.parse(raw));
        if (!session) storage.removeItem(STAFF_SESSION_KEY);
        return session;
    } catch {
        try { storage.removeItem(STAFF_SESSION_KEY); } catch {}
        return null;
    }
}

export function saveStoredStaffSession(storage: StaffSessionStorage, value: StaffSession): boolean {
    const session = parseStaffSession(value);
    if (!session) return false;
    try {
        storage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
        return true;
    } catch {
        return false;
    }
}

export function clearStoredStaffSession(storage: StaffSessionStorage): void {
    try { storage.removeItem(STAFF_SESSION_KEY); } catch {}
}

export function parseStaffSettingsList(value: unknown): StaffSettingsEntry[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        const session = parseStaffSession({ id: row.id, name: row.full_name, role: row.role });
        return session && typeof row.active === 'boolean'
            ? [{ id: session.id, full_name: session.name, role: session.role, active: row.active }]
            : [];
    });
}

export function parseStaffList(value: unknown): StaffListEntry[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        const session = parseStaffSession({ id: row.id, name: row.full_name, role: row.role });
        return session ? [{ id: session.id, full_name: session.name, role: session.role }] : [];
    });
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
    if (tab === 'completed-work') return isDispatcherSession(session);
    if (tab === 'my-tickets') return isDispatcherSession(session);
    if (tab === 'dispatcher') return isDispatcherSession(session) || !session;
    return true;
}
