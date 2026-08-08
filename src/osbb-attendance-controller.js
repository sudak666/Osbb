import { attendanceCellState, attendanceDayState, calculateAttendanceTotals, normalizeAttendanceMonth } from './osbb-attendance.js';

export function createOsbbAttendanceController(options) {
    const { document, storage, isPreview, getMonth, getSession, getPin, clearPin, isDispatcher, isWorker,
        roles, roleNames, readOffline, writeOffline, loadCloud, saveCloud, requestReauth, showToast, render, warn = console.error } = options;
    let data = {};
    const key = () => { const { year, month } = getMonth(); return `${year}-${String(month + 1).padStart(2, '0')}`; };
    const offlineKey = () => { const { year, month } = getMonth(); return `att_${year}_${month}`; };
    function saveOffline() { writeOffline(storage, offlineKey(), data); }
    function loadOffline() { return normalizeAttendanceMonth(readOffline(storage, offlineKey())); }
    function setStatus(type, text) {
        const element = document.getElementById('att-sync-status'); if (!element) return;
        const classes = { loading:'is-loading', ok:'is-ok', error:'is-error' };
        element.className = `journal-status-chip ${classes[type] || classes.ok}`; element.innerHTML = text;
    }
    async function init() {
        setStatus('loading', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon is-spinning" aria-hidden="true">progress_activity</span> Завантаження...</span>');
        const offline = loadOffline(); if (offline) { data = offline; render(); }
        if (isPreview) { data = offline || {}; setStatus('ok', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">preview</span>Превью</span>'); render(); return; }
        try {
            const response = await loadCloud(key()); const { data: row, error } = response;
            if (error && error.code !== 'PGRST116') throw error;
            data = row?.data && typeof row.data === 'object' && !Array.isArray(row.data) ? normalizeAttendanceMonth(row.data) : offline || {};
            saveOffline(); setStatus('ok', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">check_circle</span>Синхронізовано</span>');
        } catch (error) {
            warn('attendance load error:', error); data = offline || {};
            setStatus('error', offline ? '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">wifi_off</span>Офлайн</span>' : '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">error</span>Немає даних</span>');
        }
        render();
    }
    function getCell(day, role) { return data[day]?.[role] || { checkIn:'', checkOut:'' }; }
    function visibleRoles() { const session = getSession(); return isWorker() && session ? [session.role] : roles; }
    function dayState(day, visible = visibleRoles()) { return attendanceDayState(visible.map(role => getCell(day, role))); }
    function updateDayVisuals(day) {
        const state = dayState(day);
        document.querySelectorAll(`[data-att-day-card="${day}"]`).forEach(card => { card.classList.remove('is-empty-day','is-partial-day','is-filled-day'); card.classList.add(state); });
        visibleRoles().forEach(role => {
            const state = attendanceCellState(getCell(day, role));
            document.querySelectorAll(`[data-att-cell="${day}-${role}"]`).forEach(cell => { cell.classList.remove('is-empty-cell','is-partial-cell','is-complete-cell'); cell.classList.add(state); });
        });
    }
    async function saveDay(day, role, checkIn, checkOut) {
        if (!isDispatcher()) { showToast('Редагувати табель може лише Диспетчер/Адмін'); return; }
        data[day] = data[day] || {}; data[day][role] = { checkIn, checkOut }; saveOffline(); renderStats(); updateDayVisuals(day);
        if (isPreview) return;
        if (!getPin()) {
            setStatus('loading', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">lock</span>Підтвердіть PIN</span>');
            if (!await requestReauth()) { setStatus('error', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">error</span>Помилка</span>'); showToast('Збереження скасовано: потрібне підтвердження PIN'); return; }
        }
        try {
            const session = getSession();
            const ok = await saveCloud({ p_month_key:key(), p_day:Number(day), p_role:role, p_check_in:checkIn, p_check_out:checkOut, p_staff_id:session.id, attempt:getPin() });
            if (!ok) throw new Error('Сервер відхилив запис (перевірте роль/PIN)');
            setStatus('ok', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">check_circle</span>Збережено</span>');
        } catch (error) { warn('attendance save error:', error); clearPin(); setStatus('error', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">error</span>Помилка</span>'); showToast('Не вдалося зберегти. Спробуйте увійти в сесію Диспетчера ще раз.'); }
    }
    function renderStats() {
        const grid = document.getElementById('att-stats-grid'); if (!grid) return;
        const visible = visibleRoles(); const { year, month, days } = getMonth(); void year; void month;
        const totals = calculateAttendanceTotals(data, visible, days);
        grid.innerHTML = visible.map(role => `<article class="att-stat-card role-${role}"><span class="att-stat-role">${roleNames[role]}</span><strong class="att-stat-value">${totals[role].days}</strong><span class="att-stat-label">змін відпрацьовано</span><small>${totals[role].hours.toFixed(1)} год. загалом</small></article>`).join('');
    }
    return { cellState: attendanceCellState, dayState, getCell, getData: () => data, init, renderStats, saveDay, setStatus, updateDayVisuals, visibleRoles };
}
