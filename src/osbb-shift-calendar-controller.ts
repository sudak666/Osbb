import { calculateShiftMoney, shiftDateKey, shiftErrorMessage, shiftTypeDescription, workShiftRowsFromResponse } from './osbb-shifts.ts';
import type { ShiftCounts, WorkShiftNames, WorkShiftRow, WorkShiftRows, WorkShiftType } from './osbb-shifts.ts';
import type { WarnFn } from './controller-types.ts';

export type ShiftPerson = 'sergiy' | 'oleksandr' | 'third';

export interface OsbbShiftCalendarControllerOptions {
    document: Document;
    loadRows(monthKey: string): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
    getNames(): WorkShiftNames;
    getPin(): string | null | undefined;
    showToast(message: string, type?: string): void;
    saveDay(date: string, first: string[], second: string[], third: string[], attempt: string): Promise<unknown>;
    resetMonth(monthKey: string, attempt: string): Promise<unknown>;
    confirmReset?: () => boolean;
    requestFrame?: (callback: () => void) => unknown;
    now?: () => Date;
    warn?: WarnFn;
}

const MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const TYPES = [{ key:'day', label:'Денна' }, { key:'night', label:'Нічна' }, { key:'night_half2', label:'Пів ночі' }, { key:'rest', label:'Вихідний' }];

export function createOsbbShiftCalendarController(options: OsbbShiftCalendarControllerOptions) {
    const { document, loadRows, getNames, getPin, showToast, saveDay, resetMonth, confirmReset = () => true,
        requestFrame = callback => requestAnimationFrame(callback), now = () => new Date(), warn = console.warn } = options;
    let currentDate = new Date(now().getFullYear(), now().getMonth(), 1);
    let rows: WorkShiftRows = {};
    let initialized = false;
    let loading = false;
    let selectedDate = '';
    let editorSelection: Record<ShiftPerson, Set<string>> = { sergiy:new Set(), oleksandr:new Set(), third:new Set() };
    let editorFocusReturn: Element | null = null;

    function monthKey() { return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`; }
    function todayKey() { const value = now(); return shiftDateKey(value.getFullYear(), value.getMonth(), value.getDate()); }
    function dayData(dateKey: string): Pick<WorkShiftRow, ShiftPerson> { return rows[dateKey] || { sergiy:[], oleksandr:[], third:[] }; }
    function setStatus(text: string, state = 'ready') {
        const status = document.getElementById('shift-sync-status');
        if (!status) return;
        status.textContent = text;
        status.classList.toggle('is-syncing', state === 'loading');
    }
    function appendIndicators(container: HTMLElement, person: ShiftPerson, values: unknown) {
        const kinds: Array<[boolean, string]> = [
            [Array.isArray(values) && ((values as string[]).includes('day') || (values as string[]).includes('night')), 'is-full'],
            [Array.isArray(values) && (values as string[]).includes('night_half2'), 'is-half'],
        ];
        kinds.forEach(([visible, kind]) => {
            if (!visible) return;
            const marker = document.createElement('i');
            marker.className = `shift-dot is-${person} ${kind}`;
            marker.setAttribute('aria-hidden', 'true');
            container.appendChild(marker);
        });
    }
    function count(person: ShiftPerson): ShiftCounts {
        const result: ShiftCounts = { day:0, night:0, night_half2:0 };
        const days = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        for (let day = 1; day <= days; day += 1) {
            const values = dayData(shiftDateKey(currentDate.getFullYear(), currentDate.getMonth(), day))[person];
            if (Array.isArray(values)) values.forEach((value: WorkShiftType) => { if (Object.hasOwn(result, value)) result[value as keyof ShiftCounts] += 1; });
        }
        return result;
    }
    function renderStats() {
        const third = count('third');
        const thirdMoney = calculateShiftMoney(third);
        document.getElementById('shift-stats-third')!.textContent = `${third.day} / ${third.night} / ${third.night_half2}`;
        document.getElementById('shift-money-third')!.textContent = `${thirdMoney.toLocaleString('uk-UA')} грн`;
        const first = count('sergiy'); const second = count('oleksandr');
        const firstMoney = calculateShiftMoney(first); const secondMoney = calculateShiftMoney(second);
        document.getElementById('shift-stats-sergiy')!.textContent = `${first.day} / ${first.night} / ${first.night_half2}`;
        document.getElementById('shift-stats-oleksandr')!.textContent = `${second.day} / ${second.night} / ${second.night_half2}`;
        document.getElementById('shift-money-sergiy')!.textContent = `${firstMoney.toLocaleString('uk-UA')} грн`;
        document.getElementById('shift-money-oleksandr')!.textContent = `${secondMoney.toLocaleString('uk-UA')} грн`;
        document.getElementById('shift-money-total')!.textContent = `${(firstMoney + secondMoney + thirdMoney).toLocaleString('uk-UA')} грн`;
    }
    function render() {
        const calendar = document.getElementById('shift-calendar'); const title = document.getElementById('shift-month-title');
        if (!calendar || !title) return;
        const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const names = getNames();
        title.textContent = `${MONTHS[month]} ${year}`; calendar.replaceChildren();
        const firstDay = new Date(year, month, 1).getDay(); const offset = firstDay === 0 ? 6 : firstDay - 1;
        for (let index = 0; index < offset; index += 1) {
            const placeholder = document.createElement('span'); placeholder.className = 'shift-day-placeholder';
            placeholder.setAttribute('aria-hidden', 'true'); calendar.appendChild(placeholder);
        }
        const days = new Date(year, month + 1, 0).getDate(); const today = todayKey();
        for (let day = 1; day <= days; day += 1) {
            const key = shiftDateKey(year, month, day); const data = dayData(key); const button = document.createElement('button');
            button.type = 'button'; button.className = 'shift-day md-state-layer';
            if (key === today) button.classList.add('is-today');
            button.dataset.shiftDate = key;
            button.setAttribute('aria-label', `${day} ${MONTHS[month]}: ${names.sergiy} — ${shiftTypeDescription(data.sergiy)}, ${names.oleksandr} — ${shiftTypeDescription(data.oleksandr)}, ${names.third} - ${shiftTypeDescription(data.third)}`);
            const number = document.createElement('span'); number.className = 'shift-day-number'; number.textContent = String(day);
            const indicators = document.createElement('span'); indicators.className = 'shift-day-indicators';
            appendIndicators(indicators, 'sergiy', data.sergiy); appendIndicators(indicators, 'oleksandr', data.oleksandr); appendIndicators(indicators, 'third', data.third);
            button.append(number, indicators); calendar.appendChild(button);
        }
        renderStats();
    }
    async function load() {
        if (loading) return;
        loading = true; setStatus('Оновлення…', 'loading');
        try {
            const { data, error } = await loadRows(monthKey());
            if (error) throw new Error(error.message || 'Не вдалося завантажити графік');
            rows = workShiftRowsFromResponse(data); render(); setStatus('Синхронізовано');
        } catch (error) {
            warn('shiftLoadMonth failed:', error); rows = {}; render(); setStatus('Помилка синхронізації');
            showToast(shiftErrorMessage(error, 'Графік змін не завантажився'), 'error');
        } finally { loading = false; }
    }
    function init(onFirstInit: () => void) { if (!initialized) { initialized = true; onFirstInit(); render(); } return load(); }
    function changeMonth(direction: number) { currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1); rows = {}; render(); return load(); }

    function renderChips(person: ShiftPerson) {
        const container = document.getElementById(`shift-chips-${person}`); if (!container) return;
        container.replaceChildren();
        TYPES.forEach(type => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'shift-chip md-state-layer';
            button.dataset.shiftPerson = person; button.dataset.shiftType = type.key;
            const active = editorSelection[person].has(type.key); button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active)); button.textContent = type.label; container.appendChild(button);
        });
    }
    function openEditor(dateKey: string) {
        const data = dayData(dateKey); selectedDate = dateKey;
        editorSelection = { sergiy:new Set(Array.isArray(data.sergiy) ? data.sergiy : []), oleksandr:new Set(Array.isArray(data.oleksandr) ? data.oleksandr : []), third:new Set(data.third || []) };
        const [year, month, day] = dateKey.split('-'); document.getElementById('shift-editor-title')!.textContent = `Редагування: ${day}.${month}.${year}`;
        renderChips('sergiy'); renderChips('oleksandr'); renderChips('third');
        const editor = document.getElementById('shift-editor')!; editorFocusReturn = document.activeElement;
        editor.classList.add('is-open'); editor.setAttribute('aria-hidden', 'false');
        requestFrame(() => editor.querySelector<HTMLElement>('.shift-editor-sheet')?.focus({ preventScroll:true }));
    }
    function closeEditor() {
        const editor = document.getElementById('shift-editor')!; editor.classList.remove('is-open'); editor.setAttribute('aria-hidden', 'true'); selectedDate = '';
        const returnTarget = editorFocusReturn; editorFocusReturn = null;
        if (returnTarget && document.contains(returnTarget)) (returnTarget as HTMLElement).focus({ preventScroll:true });
    }
    function trapEditorFocus(event: KeyboardEvent) {
        if (event.key !== 'Tab') return;
        const sheet = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('.shift-editor-sheet')!;
        const focusable = [...sheet.querySelectorAll<HTMLElement>('button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => element.offsetParent !== null);
        if (!focusable.length) { event.preventDefault(); sheet.focus({ preventScroll:true }); return; }
        const first = focusable[0]; const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll:true }); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll:true }); }
    }
    function toggleChip(person: ShiftPerson, type: string) {
        if (!editorSelection[person]) return;
        const selection = editorSelection[person];
        if (type === 'rest') { selection.clear(); selection.add('rest'); }
        else { selection.delete('rest'); if (selection.has(type)) selection.delete(type); else selection.add(type); }
        renderChips(person);
    }
    async function submitDay() {
        if (!selectedDate) return;
        const button = document.querySelector<HTMLButtonElement>('[data-shift-action="save-day"]'); if (!button) return;
        const date = selectedDate; const first = [...editorSelection.sergiy]; const second = [...editorSelection.oleksandr]; const third = [...editorSelection.third];
        const attempt = getPin();
        if (!attempt) { showToast('Відкрийте розділ «Зміни» повторно', 'error'); return; }
        button.disabled = true;
        try {
            const ok = await saveDay(date, first, second, third, attempt); if (!ok) throw new Error('Сервер відхилив операцію');
            closeEditor(); await load(); showToast('Графік зміни збережено', 'check');
        } catch (error) { warn('shiftSaveDay failed:', error); showToast(shiftErrorMessage(error, 'Не вдалося зберегти зміну'), 'error'); }
        finally { button.disabled = false; }
    }
    async function reset() {
        if (!confirmReset()) return;
        const attempt = getPin();
        if (!attempt) { showToast('Відкрийте розділ «Зміни» повторно', 'error'); return; }
        try {
            const ok = await resetMonth(monthKey(), attempt); if (!ok) throw new Error('Сервер відхилив операцію');
            await load(); showToast('Зміни місяця очищено', 'trash');
        } catch (error) { warn('shiftResetMonth failed:', error); showToast(shiftErrorMessage(error, 'Не вдалося очистити зміни'), 'error'); }
    }

    return { changeMonth, closeEditor, count, dayData, init, load, monthKey, openEditor, render, renderChips, renderStats, reset, submitDay, toggleChip, trapEditorFocus };
}
