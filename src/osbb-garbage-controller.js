import { garbageMonthBinsTotal, garbageMonthKey, garbageMonthKeyCandidates, garbageYearRowsFromResponse, migrateGarbageData, normalizeGarbageMonth } from './osbb-garbage.js';

export function createOsbbGarbageController(options) {
    const { document, storage, isPreview, getMonth, getCurrentTab, readOffline, writeOffline, removeOffline,
        fetchMonth, upsertMonth, fetchYear, resetMonth, requestResetPin, render, now = () => new Date(), setTimer = setTimeout,
        clearTimer = clearTimeout, warn = console.error } = options;
    let data = {}, loaded = false, saveTimer = null;
    const monthKey = (year = getMonth().year, month = getMonth().month) => garbageMonthKey(year, month);
    const offlineKey = (year = getMonth().year, month = getMonth().month) => `garbage_${year}_${month}`;
    const migrate = value => migrateGarbageData(normalizeGarbageMonth(value));
    function setStatus(type, text) {
        const element = document.getElementById('g-sync-status'); if (!element) return;
        const classes = { loading:'is-loading', ok:'is-ok', error:'is-error' };
        element.className = `journal-status-chip ${classes[type] || classes.ok}`; element.innerHTML = text;
    }
    function saveOffline() { writeOffline(storage, offlineKey(), data); }
    function loadOffline() { return readOffline(storage, offlineKey()); }
    async function findMonth(year = getMonth().year, month = getMonth().month) {
        for (const key of garbageMonthKeyCandidates(year, month)) {
            const response = await fetchMonth(key);
            if (!response.error && response.data) return { data:response.data, monthKey:key };
            if (response.error && response.error.code !== 'PGRST116') throw response.error;
        }
        return { data:null, monthKey:monthKey(year, month) };
    }
    async function saveCloud() {
        if (isPreview) { setStatus('ok', '<span class="status-label">Превʼю</span>'); return; }
        try { const { error } = await upsertMonth({ month_key:monthKey(), data }); if (error) throw error; setStatus('ok', '<span class="status-label">Збережено</span>'); }
        catch (error) { warn('garbage save error:', error); setStatus('error', '<span class="status-label">Помилка</span>'); }
    }
    function scheduleSave() {
        setStatus('loading', '<span class="status-label">Зберігаю...</span>'); saveOffline(); clearTimer(saveTimer); saveTimer = setTimer(saveCloud, 1200);
    }
    async function init() {
        setStatus('loading', '<span class="status-label">Завантаження...</span>');
        const offlineMigration = migrate(loadOffline()); const offline = offlineMigration.data;
        if (offline) { data = offline; render(); }
        if (isPreview) { data = offline || {}; loaded = true; setStatus('ok', '<span class="status-label">Превʼю</span>'); render(); return; }
        try {
            const response = await findMonth(); const cloudMigration = migrate(response.data?.data);
            data = cloudMigration.data || offline || {}; saveOffline();
            if (cloudMigration.migrated || offlineMigration.migrated) await saveCloud();
            setStatus('ok', '<span class="status-label">Синхронізовано</span>');
        } catch (error) { warn('garbage load error:', error); data = offline || {}; setStatus('error', `<span class="status-label">${offline ? 'Офлайн' : 'Немає даних'}</span>`); }
        loaded = true; render();
    }
    function updateRow(day, field, value) {
        data[day] ||= { time:'', worker:'', types:{} }; data[day].types ||= {}; data[day][field] = value; scheduleSave(); render();
    }
    function updateType(day, type, value) {
        data[day] ||= { time:'', worker:'', types:{} }; data[day].types ||= {}; const count = Number.parseInt(value, 10) || 0;
        if (count > 0) data[day].types[type] = count; else delete data[day].types[type];
        if (count > 0 && !data[day].time) { const date = now(); data[day].time = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`; }
        scheduleSave(); render();
    }
    async function loadYear(year) {
        if (isPreview) return;
        try {
            const { data:rowsValue, error } = await fetchYear(); if (error) throw error; const rows = garbageYearRowsFromResponse(rowsValue);
            for (let month = 0; month < 12; month++) {
                const row = garbageMonthKeyCandidates(year, month).map(key => rows.find(item => item.month_key === key)).find(Boolean);
                const key = offlineKey(year, month);
                if (!row?.data) { removeOffline(storage, key); continue; }
                writeOffline(storage, key, migrate(row.data).data || {});
            }
        } catch (error) { warn('garbage yearly chart load error:', error); }
    }
    async function initDashboard() {
        const offlineMigration = migrate(loadOffline()); const offline = offlineMigration.data;
        if (offline && !loaded) data = offline; if (getCurrentTab() === 'garbage') return;
        if (isPreview) { if (!loaded) data = offline || {}; return; }
        try { const response = await findMonth(); const cloud = migrate(response.data?.data); data = cloud.data || offline || {}; saveOffline(); if (cloud.migrated || offlineMigration.migrated) await saveCloud(); }
        catch (error) { warn('garbage dashboard load error:', error); data = offline || {}; }
        await loadYear(getMonth().year);
    }
    function monthlyTotals(year = getMonth().year) {
        const current = getMonth(); return Array.from({ length:12 }, (_, month) => month === current.month ? garbageMonthBinsTotal(data) : garbageMonthBinsTotal(readOffline(storage, offlineKey(year, month))));
    }
    function clearMonth() {
        requestResetPin(async pin => { data = {}; saveOffline(); if (!isPreview) { try { await resetMonth({ table_name:'garbage', p_month_key:monthKey(), attempt:pin }); } catch {} } setStatus('ok', '<span class="status-label">Скинуто</span>'); render(); });
    }
    return { clearMonth, findMonth, getData:() => data, init, initDashboard, isLoaded:() => loaded, loadYear, monthlyTotals, resetLoaded:() => { loaded = false; }, saveCloud, setStatus, updateRow, updateType };
}
