export const COMPLETED_WORK_ROLES = ['electrician', 'janitor', 'plumber'];

export function completedWorkDefaultDate(year, month, today = new Date()) {
    const validToday = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
    const todayYear = validToday.getFullYear();
    const todayMonth = validToday.getMonth();
    const safeYear = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : todayYear;
    const safeMonth = Number.isInteger(month) && month >= 0 && month <= 11 ? month : todayMonth;
    const day = safeYear === todayYear && safeMonth === todayMonth ? validToday.getDate() : 1;
    return `${safeYear}-${String(safeMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeCompletedWorkEntry(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const id = typeof value.id === 'string' && /^[0-9a-f-]{36}$/i.test(value.id) ? value.id : null;
    const workDate = typeof value.work_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.work_date) ? value.work_date : '';
    const workerRole = COMPLETED_WORK_ROLES.includes(value.worker_role) ? value.worker_role : '';
    const description = typeof value.description === 'string' ? value.description.trim() : '';
    const note = typeof value.note === 'string' ? value.note.trim() : '';
    if (!id || !workDate || !workerRole || !description || description.length > 1000 || note.length > 500) return null;
    return { id, workDate, workerRole, description, note };
}

export function completedWorkEntriesFromResponse(value) {
    if (!Array.isArray(value)) return [];
    return value.flatMap(entry => normalizeCompletedWorkEntry(entry) || []);
}

export function validateCompletedWorkDraft(value) {
    const workDate = typeof value?.workDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.workDate) ? value.workDate : '';
    const workerRole = COMPLETED_WORK_ROLES.includes(value?.workerRole) ? value.workerRole : '';
    const description = String(value?.description ?? '').trim();
    const note = String(value?.note ?? '').trim();
    if (!workDate) return { error:'Оберіть дату роботи' };
    if (!workerRole) return { error:'Оберіть виконавця' };
    if (!description) return { error:'Опишіть виконану роботу' };
    if (description.length > 1000) return { error:'Опис має бути до 1000 символів' };
    if (note.length > 500) return { error:'Примітка має бути до 500 символів' };
    const id = value?.id == null || value.id === '' ? null : typeof value.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) ? value.id : undefined;
    if (id === undefined) return { error:'Некоректний ідентифікатор запису' };
    return { value:{ id, workDate, workerRole, description, note } };
}

export function filterCompletedWork(entries, query, role = 'all') {
    const needle = String(query ?? '').trim().toLocaleLowerCase('uk-UA');
    return entries.filter(entry => (role === 'all' || entry.workerRole === role)
        && (!needle || `${entry.description} ${entry.note}`.toLocaleLowerCase('uk-UA').includes(needle)));
}
