const STAFF_ROLES = ['dispatcher', 'admin', 'board', 'plumber', 'janitor', 'electrician'];
export const WORKER_ROLES = ['plumber', 'janitor', 'electrician'];
export const WORKER_ALLOWED_TABS = ['tabel', 'my-tickets'];
export const STAFF_SESSION_KEY = 'osbb_staff_session';

export const STAFF_ROLE_ICONS = {
    dispatcher: 'support_agent',
    admin: 'admin_panel_settings',
    board: 'badge',
    plumber: 'plumbing',
    janitor: 'cleaning_services',
    electrician: 'bolt',
};

export const STAFF_ROLE_LABELS = {
    dispatcher: 'Диспетчер',
    admin: 'Адмін',
    board: 'Правління',
    plumber: 'Сантехнік',
    janitor: 'Двірник',
    electrician: 'Електрик',
};

export function parseStaffSession(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const validId = typeof value.id === 'string' && value.id.trim() !== ''
        || typeof value.id === 'number' && Number.isFinite(value.id);
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const id = typeof value.id === 'string' ? value.id.trim() : value.id;
    if (!validId || String(id).length > 100 || !name || name.length > 100) return null;
    if (typeof value.role !== 'string' || !STAFF_ROLES.includes(value.role)) return null;
    return {
        id,
        name,
        role: value.role,
    };
}

export function loadStoredStaffSession(storage) {
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

export function saveStoredStaffSession(storage, value) {
    const session = parseStaffSession(value);
    if (!session) return false;
    try {
        storage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
        return true;
    } catch {
        return false;
    }
}

export function clearStoredStaffSession(storage) {
    try { storage.removeItem(STAFF_SESSION_KEY); } catch {}
}

export function parseStaffSettingsList(value) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const session = parseStaffSession({ id: entry.id, name: entry.full_name, role: entry.role });
        return session && typeof entry.active === 'boolean'
            ? [{ id: session.id, full_name: session.name, role: session.role, active: entry.active }]
            : [];
    });
}

export function parseStaffList(value) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const session = parseStaffSession({ id: entry.id, name: entry.full_name, role: entry.role });
        return session ? [{ id: session.id, full_name: session.name, role: session.role }] : [];
    });
}

export function isDispatcherSession(session) {
    return Boolean(session) && ['dispatcher', 'admin', 'board'].includes(session?.role ?? '');
}

export function isWorkerSession(session) {
    return Boolean(session) && WORKER_ROLES.includes(session?.role);
}

export function normalizeWorkerRole(value, fallback = 'plumber') {
    return typeof value === 'string' && WORKER_ROLES.includes(value) ? value : fallback;
}

export function canManageStaffAccess(session) {
    return session?.role === 'board' || session?.role === 'admin';
}

export function isTabAllowedForSession(tab, session) {
    if (isWorkerSession(session)) return WORKER_ALLOWED_TABS.includes(tab);
    if (tab === 'completed-work') return isDispatcherSession(session);
    if (tab === 'my-tickets') return isDispatcherSession(session);
    if (tab === 'dispatcher') return isDispatcherSession(session) || !session;
    return true;
}
