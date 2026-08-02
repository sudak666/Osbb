export const WORKER_ROLES = ['plumber', 'janitor', 'electrician'];
export const WORKER_ALLOWED_TABS = ['tabel', 'my-tickets'];

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
    if (tab === 'my-tickets') return isDispatcherSession(session);
    if (tab === 'dispatcher') return isDispatcherSession(session) || !session;
    return true;
}
