// Згенеровано з src/osbb-staff.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const STAFF_SESSION_KEY = "osbb_staff_session";
const STAFF_ROLES = ["dispatcher", "admin", "board", "plumber", "janitor", "electrician"];
const WORKER_ROLES = ["plumber", "janitor", "electrician"];
const OPERATOR_ROLES = ["dispatcher", "admin", "board"];
const WORKER_ALLOWED_TABS = ["tabel", "my-tickets"];
const STAFF_ROLE_ICONS = {
  dispatcher: "support_agent",
  admin: "admin_panel_settings",
  board: "badge",
  plumber: "plumbing",
  janitor: "cleaning_services",
  electrician: "bolt"
};
const STAFF_ROLE_LABELS = {
  dispatcher: "Керування",
  admin: "Адмін",
  board: "Правління",
  plumber: "Сантехнік",
  janitor: "Двірник",
  electrician: "Електрик"
};
function parseStaffSession(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const session = value;
  const validId = typeof session.id === "string" && session.id.trim() !== "" || typeof session.id === "number" && Number.isFinite(session.id);
  const name = typeof session.name === "string" ? session.name.trim() : "";
  const id = typeof session.id === "string" ? session.id.trim() : session.id;
  if (!validId || String(id).length > 100 || !name || name.length > 100) return null;
  if (typeof session.role !== "string" || !STAFF_ROLES.includes(session.role)) return null;
  return {
    id,
    name,
    role: session.role
  };
}
function loadStoredStaffSession(storage) {
  try {
    const raw = storage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    const session = parseStaffSession(JSON.parse(raw));
    if (!session) storage.removeItem(STAFF_SESSION_KEY);
    return session;
  } catch {
    try {
      storage.removeItem(STAFF_SESSION_KEY);
    } catch {
    }
    return null;
  }
}
function saveStoredStaffSession(storage, value) {
  const session = parseStaffSession(value);
  if (!session) return false;
  try {
    storage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}
function clearStoredStaffSession(storage) {
  try {
    storage.removeItem(STAFF_SESSION_KEY);
  } catch {
  }
}
function parseStaffSettingsList(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const row = entry;
    const session = parseStaffSession({ id: row.id, name: row.full_name, role: row.role });
    return session && typeof row.active === "boolean" ? [{ id: session.id, full_name: session.name, role: session.role, active: row.active }] : [];
  });
}
function parseStaffList(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const row = entry;
    const session = parseStaffSession({ id: row.id, name: row.full_name, role: row.role });
    return session ? [{ id: session.id, full_name: session.name, role: session.role }] : [];
  });
}
function isDispatcherSession(session) {
  return Boolean(session) && OPERATOR_ROLES.includes(session?.role);
}
function isWorkerSession(session) {
  return Boolean(session) && WORKER_ROLES.includes(session?.role);
}
function normalizeWorkerRole(value, fallback = "plumber") {
  return typeof value === "string" && WORKER_ROLES.includes(value) ? value : fallback;
}
function canManageStaffAccess(session) {
  return session?.role === "board" || session?.role === "admin";
}
function isTabAllowedForSession(tab, session) {
  if (isWorkerSession(session)) return WORKER_ALLOWED_TABS.includes(tab);
  if (tab === "completed-work") return isDispatcherSession(session);
  if (tab === "my-tickets") return isDispatcherSession(session);
  return true;
}
export {
  OPERATOR_ROLES,
  STAFF_ROLE_ICONS,
  STAFF_ROLE_LABELS,
  STAFF_SESSION_KEY,
  WORKER_ALLOWED_TABS,
  WORKER_ROLES,
  canManageStaffAccess,
  clearStoredStaffSession,
  isDispatcherSession,
  isTabAllowedForSession,
  isWorkerSession,
  loadStoredStaffSession,
  normalizeWorkerRole,
  parseStaffList,
  parseStaffSession,
  parseStaffSettingsList,
  saveStoredStaffSession
};
