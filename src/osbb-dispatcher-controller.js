import { calculateDispatcherMonthStats, closeDispatcherTicket, matchesDispatcherFilter, normalizeDispatcherDay, normalizeDispatcherMonth, reopenDispatcherTicket } from './osbb-dispatcher.js';
import { jiraIssuesFromResponse } from './osbb-state.js';
import { matchesDispatcherDateFilter, normalizeTicketPriority, ticketSortComparator } from './osbb-tickets.js';

export function createOsbbDispatcherController(options) {
    const { document, storage, isPreview, getMonth, getStaffSession, getStaffPin, isDispatcher, normalizeWorkerRole,
        readOffline, writeOffline, fetchMonth, upsertMonth, resetMonth, requestResetPin, requestStaffReauth,
        requestJira, renderDispatcher, renderMyTickets, showToast, now = () => new Date(), random = Math.random,
        setTimer = setTimeout, clearTimer = clearTimeout, warn = console.error } = options;
    let data = {}, saveTimer = null, editingTicketId = null, jiraIssues = [];
    const monthKey = () => `${getMonth().year}-${getMonth().month}`;
    const offlineKey = () => `dispatcher_${getMonth().year}_${getMonth().month}`;
    function publish() { options.onDataChanged?.(data); }
    function setStatus(type, text) {
        const element = document.getElementById('disp-sync-status'); if (!element) return;
        const classes = { loading:'is-loading', ok:'is-ok', error:'is-error' };
        element.className = `journal-status-chip ${classes[type] || classes.ok}`; element.innerHTML = text;
    }
    function saveOffline() { writeOffline(storage, offlineKey(), data); }
    function loadOffline() { return normalizeDispatcherMonth(readOffline(storage, offlineKey())); }
    async function init() {
        setStatus('loading', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon is-spinning" aria-hidden="true">progress_activity</span> Завантаження...</span>');
        const offline = loadOffline(); if (offline) { data = offline; publish(); renderDispatcher(); }
        if (isPreview) { data = offline || {}; publish(); setStatus('ok', '<span class="status-label">Превʼю</span>'); renderDispatcher(); return; }
        try {
            const response = await fetchMonth(monthKey());
            if (response.error && response.error.code !== 'PGRST116') throw response.error;
            data = response.data?.data && typeof response.data.data === 'object' && !Array.isArray(response.data.data)
                ? normalizeDispatcherMonth(response.data.data) : offline || {};
            saveOffline(); setStatus('ok', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">check_circle</span>Синхронізовано</span>');
        } catch (error) {
            warn('dispatcher load error:', error); data = offline || {};
            setStatus('error', `<span class="status-label">${offline ? 'Офлайн' : 'Немає даних'}</span>`);
        }
        publish(); renderDispatcher();
    }
    async function saveCloud() {
        if (isPreview) { setStatus('ok', '<span class="status-label">Превʼю</span>'); return; }
        try { const { error } = await upsertMonth({ month_key:monthKey(), data }); if (error) throw error; setStatus('ok', '<span class="status-label">Збережено</span>'); }
        catch (error) { warn('dispatcher save error:', error); setStatus('error', '<span class="status-label">Помилка</span>'); }
    }
    function scheduleSave() {
        setStatus('loading', '<span class="status-label">Зберігаю...</span>'); saveOffline(); publish(); clearTimer(saveTimer); saveTimer = setTimer(saveCloud, 1200);
    }
    function getDay(day) { data[day] = normalizeDispatcherDay(data[day]); return data[day]; }
    async function addTicket(day, text, role, priority) {
        if (!isDispatcher()) { showToast('Створювати заявки може лише Диспетчер/Адмін'); return null; }
        const summary = String(text || '').trim(); if (!summary) { showToast('Опишіть заявку'); return null; }
        const session = getStaffSession();
        const ticket = { id:`t${now().getTime()}${random().toString(36).slice(2,6)}`, text:summary,
            role:normalizeWorkerRole(role), priority:normalizeTicketPriority(priority), status:'open', comment:'', photos:[],
            createdAt:now().toISOString(), createdBy:session?.name || 'Диспетчер' };
        getDay(day).ticketsList.push(ticket); scheduleSave(); return ticket;
    }
    function deleteTicket(day, ticketId) { if (!isDispatcher()) return false; const row=getDay(day); const length=row.ticketsList.length; row.ticketsList=row.ticketsList.filter(ticket => ticket.id !== ticketId); if (length === row.ticketsList.length) return false; scheduleSave(); return true; }
    function toggleTicketEdit(ticketId) { if (!isDispatcher()) return editingTicketId; editingTicketId = editingTicketId === ticketId ? null : ticketId; return editingTicketId; }
    function cancelTicketEdit() { editingTicketId = null; }
    function saveTicketEdit(day, ticketId, text, role, priority) {
        if (!isDispatcher()) return false; const summary=String(text || '').trim(); if (!summary) { showToast('Опишіть заявку'); return false; }
        const ticket=getDay(day).ticketsList.find(item => item.id === ticketId); if (!ticket) return false;
        ticket.text=summary; ticket.role=normalizeWorkerRole(role, ticket.role); ticket.priority=normalizeTicketPriority(priority, normalizeTicketPriority(ticket.priority)); editingTicketId=null; scheduleSave(); return true;
    }
    function closeTicket(day, ticketId, comment) { const ticket=getDay(day).ticketsList.find(item => item.id === ticketId); if (!ticket) return false; closeDispatcherTicket(ticket, comment, getStaffSession()?.name); scheduleSave(); return true; }
    function reopenTicket(day, ticketId) { if (!isDispatcher()) { showToast('Відкрити заявку повторно може лише Диспетчер/Адмін'); return false; } const ticket=getDay(day).ticketsList.find(item => item.id === ticketId); if (!ticket || !reopenDispatcherTicket(ticket)) return false; scheduleSave(); return true; }
    function addTicketPhoto(day, ticketId, url) { const ticket=getDay(day).ticketsList.find(item => item.id === ticketId); if (!ticket || !url) return false; ticket.photos ||= []; ticket.photos.push(url); scheduleSave(); return true; }
    function collectTicketsForRole(role) { const result=[]; const { year, month }=getMonth(); const days=new Date(year,month+1,0).getDate(); for(let day=1;day<=days;day++){ const row=data[day] ? normalizeDispatcherDay(data[day]) : null; row?.ticketsList.filter(ticket => ticket.role === role).forEach(ticket => result.push({...ticket,day})); } return result.sort((a,b) => a.status !== b.status ? (a.status === 'open' ? -1 : 1) : ticketSortComparator(a,b)); }
    function matchesFilter(row, hasEvent, day, filter) { const { year, month }=getMonth(); return matchesDispatcherFilter(row, hasEvent, filter, matchesDispatcherDateFilter(year,month,day,filter)); }
    function stats(entries) { return calculateDispatcherMonthStats(entries); }
    async function clearMonth() { requestResetPin(async pin => { data={}; saveOffline(); if (!isPreview) { try { await resetMonth({ table_name:'dispatcher', p_month_key:monthKey(), attempt:pin }); } catch {} } publish(); setStatus('ok','<span class="status-label">Скинуто</span>'); renderDispatcher(); }); }
    async function loadJira() {
        if (!getStaffSession()) return false; const status=document.getElementById('my-tickets-sync-status'); if (status) status.innerHTML='<span class="material-symbols-rounded journal-inline-icon is-spinning">progress_activity</span>';
        if (!getStaffPin() && !await requestStaffReauth()) { if(status) status.textContent='lock'; return false; }
        try { jiraIssues=jiraIssuesFromResponse((await requestJira('list')).issues); if(status) status.textContent='check_circle'; renderMyTickets(); return true; }
        catch(error) { warn('jira issues load error:',error); jiraIssues=[]; if(status) status.textContent='error'; showToast('Не вдалося завантажити Jira-заявки'); renderMyTickets(); return false; }
    }
    return { addTicket, addTicketPhoto, cancelTicketEdit, clearMonth, closeTicket, collectTicketsForRole, deleteTicket, getData:()=>data,
        getDay, getEditingTicketId:()=>editingTicketId, getJiraIssues:()=>jiraIssues, init, loadJira, matchesFilter, reopenTicket,
        saveCloud, saveTicketEdit, scheduleSave, setStatus, stats, toggleTicketEdit };
}
