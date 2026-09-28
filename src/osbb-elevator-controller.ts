import { createElevatorEntry, elevatorEntriesFromResponse, removeElevatorEntry } from './osbb-elevator.ts';
import type { ElevatorEntry } from './osbb-elevator.ts';
import type { CalendarMonth, DbResult, KeyValueStorage, ReadOfflineFn, SyncStatusType, WarnFn, WriteOfflineFn } from './controller-types.ts';

export interface OsbbElevatorControllerOptions {
    document: Document;
    storage: KeyValueStorage;
    isPreview: boolean;
    getMonth(): CalendarMonth;
    getAuthor(): string;
    readOffline: ReadOfflineFn;
    writeOffline: WriteOfflineFn;
    fetchMonth(monthKey: string): PromiseLike<DbResult<{ data?: unknown }>>;
    upsertMonth(row: { month_key: string; data: ElevatorEntry[] }): PromiseLike<{ error: unknown }>;
    render(): void;
    showToast(message: string): void;
    warn?: WarnFn;
    onEntriesChanged?: (entries: ElevatorEntry[]) => void;
}

export function createOsbbElevatorController(options: OsbbElevatorControllerOptions) {
    const { document, storage, isPreview, getMonth, getAuthor, readOffline, writeOffline,
        fetchMonth, upsertMonth, render, showToast, warn = console.error } = options;
    let entries: ElevatorEntry[] = [];
    const monthKey = () => `${getMonth().year}-${getMonth().month}`;
    const offlineKey = () => `elevator_${getMonth().year}_${getMonth().month}`;
    function publish() { options.onEntriesChanged?.(entries); }
    function setStatus(type: SyncStatusType, text: string) {
        const element = document.getElementById('elevator-sync-status'); if (!element) return;
        const classes: Record<string, string> = { loading:'is-loading', ok:'is-ok', error:'is-error' };
        const icons = new Set(['progress_activity','preview','check_circle','error']);
        const icon = icons.has(text) ? text : type === 'loading' ? 'progress_activity' : type === 'error' ? 'error' : 'check_circle';
        const spinning = type === 'loading' ? ' is-spinning' : '';
        element.className = `journal-status-chip ${classes[type] || classes.ok}`;
        element.innerHTML = `<span class="material-symbols-rounded journal-inline-icon${spinning}" aria-hidden="true">${icon}</span>`;
    }
    function saveOffline() { writeOffline(storage, offlineKey(), entries); }
    function loadOffline() { return elevatorEntriesFromResponse(readOffline(storage, offlineKey())); }
    async function init() {
        setStatus('loading','<span class="material-symbols-rounded journal-inline-icon is-spinning">progress_activity</span>');
        const offline=loadOffline(); if (offline) { entries=offline; publish(); render(); }
        if (isPreview) { entries=offline || []; publish(); setStatus('ok','preview'); render(); return; }
        try { const response=await fetchMonth(monthKey()); if (response.error && response.error.code !== 'PGRST116') throw response.error;
            entries=Array.isArray(response.data?.data) ? elevatorEntriesFromResponse(response.data.data) : offline || [];
            saveOffline(); setStatus('ok','check_circle');
        } catch(error) { warn('elevator load error:',error); entries=offline || []; setStatus('error','error'); }
        publish(); render();
    }
    async function saveCloud() {
        if (isPreview) return;
        try { const { error }=await upsertMonth({month_key:monthKey(),data:entries}); if(error) throw error; setStatus('ok','check_circle'); }
        catch(error) { warn('elevator save error:',error); setStatus('error','error'); }
    }
    function add(day: unknown,text: unknown) {
        const entry=createElevatorEntry(day,text,getAuthor()); if(!entry) { showToast('Опишіть, що зробив ліфтер'); return false; }
        entries.push(entry); saveOffline(); publish(); void saveCloud(); render(); showToast('Запис додано'); return true;
    }
    function remove(id: unknown) { const next=removeElevatorEntry(entries,id); if(next.length===entries.length) return false; entries=next; saveOffline(); publish(); void saveCloud(); render(); return true; }
    return { add, getEntries:()=>entries, init, loadOffline, remove, saveCloud, setStatus };
}
