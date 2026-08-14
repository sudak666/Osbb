import { calculateShiftMoney, shiftDateKey, shiftErrorMessage, shiftTypeDescription, workShiftRowsFromResponse } from './osbb-shifts.js';

const MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const TYPES = [{ key:'day', label:'Денна' }, { key:'night', label:'Нічна' }, { key:'night_half2', label:'Пів ночі' }, { key:'rest', label:'Вихідний' }];

export function createOsbbShiftCalendarController(options) {
    const { document, loadRows, getNames, showToast, requestPin, saveDay, resetMonth,
        requestFrame = callback => requestAnimationFrame(callback), now = () => new Date(), warn = console.warn } = options;
    let currentDate = new Date(now().getFullYear(), now().getMonth(), 1);
    let rows = {};
    let initialized = false;
    let loading = false;
    let selectedDate = '';
    let editorSelection = { sergiy:new Set(), oleksandr:new Set() };
    let editorFocusReturn = null;

    function monthKey() { return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`; }
    function todayKey() { const value = now(); return shiftDateKey(value.getFullYear(), value.getMonth(), value.getDate()); }
    function dayData(dateKey) { return rows[dateKey] || (dateKey <= todayKey() ? { sergiy:['day'], oleksandr:['night'] } : { sergiy:[], oleksandr:[] }); }
    function setStatus(text, state = 'ready') {
        const status = document.getElementById('shift-sync-status');
        if (!status) return;
        status.textContent = text;
        status.classList.toggle('is-syncing', state === 'loading');
    }
    function appendIndicators(container, person, values) {
        const kinds = [
            [Array.isArray(values) && (values.includes('day') || values.includes('night')), 'is-full'],
            [Array.isArray(values) && values.includes('night_half2'), 'is-half'],
        ];
        kinds.forEach(([visible, kind]) => {
            if (!visible) return;
            const marker = document.createElement('i');
            marker.className = `shift-dot is-${person} ${kind}`;
            marker.setAttribute('aria-hidden', 'true');
            container.appendChild(marker);
        });
    }
    function count(person) {
        const result = { day:0, night:0, night_half2:0 };
        const days = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        for (let day = 1; day <= days; day += 1) {
            const values = dayData(shiftDateKey(currentDate.getFullYear(), currentDate.getMonth(), day))[person];
            if (Array.isArray(values)) values.forEach(value => { if (Object.hasOwn(result, value)) result[value] += 1; });
        }
        return result;
    }
    function renderStats() {
        const first = count('sergiy'); const second = count('oleksandr');
        const firstMoney = calculateShiftMoney(first); const secondMoney = calculateShiftMoney(second);
        document.getElementById('shift-stats-sergiy').textContent = `${first.day} / ${first.night} / ${first.night_half2}`;
        document.getElementById('shift-stats-oleksandr').textContent = `${second.day} / ${second.night} / ${second.night_half2}`;
        document.getElementById('shift-money-sergiy').textContent = `${firstMoney.toLocaleString('uk-UA')} грн`;
        document.getElementById('shift-money-oleksandr').textContent = `${secondMoney.toLocaleString('uk-UA')} грн`;
        document.getElementById('shift-money-total').textContent = `${(firstMoney + secondMoney).toLocaleString('uk-UA')} грн`;
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
            if (key === today) button.classList.add('is-today'); if (!rows[key] && key <= today) button.classList.add('is-auto');
            button.dataset.shiftDate = key;
            button.setAttribute('aria-label', `${day} ${MONTHS[month]}: ${names.sergiy} — ${shiftTypeDescription(data.sergiy)}, ${names.oleksandr} — ${shiftTypeDescription(data.oleksandr)}`);
            const number = document.createElement('span'); number.className = 'shift-day-number'; number.textContent = String(day);
            const indicators = document.createElement('span'); indicators.className = 'shift-day-indicators';
            appendIndicators(indicators, 'sergiy', data.sergiy); appendIndicators(indicators, 'oleksandr', data.oleksandr);
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
    function init(onFirstInit) { if (!initialized) { initialized = true; onFirstInit(); render(); } return load(); }
    function changeMonth(direction) { currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1); rows = {}; render(); return load(); }

    function renderChips(person) {
        const container = document.getElementById(`shift-chips-${person}`); if (!container) return;
        container.replaceChildren();
        TYPES.forEach(type => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'shift-chip md-state-layer';
            button.dataset.shiftPerson = person; button.dataset.shiftType = type.key;
            const active = editorSelection[person].has(type.key); button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active)); button.textContent = type.label; container.appendChild(button);
        });
    }
    function openEditor(dateKey) {
        const data = dayData(dateKey); selectedDate = dateKey;
        editorSelection = { sergiy:new Set(Array.isArray(data.sergiy) ? data.sergiy : []), oleksandr:new Set(Array.isArray(data.oleksandr) ? data.oleksandr : []) };
        const [year, month, day] = dateKey.split('-'); document.getElementById('shift-editor-title').textContent = `Редагування: ${day}.${month}.${year}`;
        renderChips('sergiy'); renderChips('oleksandr');
        const editor = document.getElementById('shift-editor'); editorFocusReturn = document.activeElement;
        editor.classList.add('is-open'); editor.setAttribute('aria-hidden', 'false');
        requestFrame(() => editor.querySelector('.shift-editor-sheet')?.focus({ preventScroll:true }));
    }
    function closeEditor() {
        const editor = document.getElementById('shift-editor'); editor.classList.remove('is-open'); editor.setAttribute('aria-hidden', 'true'); selectedDate = '';
        const returnTarget = editorFocusReturn; editorFocusReturn = null;
        if (returnTarget && document.contains(returnTarget)) returnTarget.focus({ preventScroll:true });
    }
    function trapEditorFocus(event) {
        if (event.key !== 'Tab') return;
        const sheet = event.currentTarget.querySelector('.shift-editor-sheet');
        const focusable = [...sheet.querySelectorAll('button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => element.offsetParent !== null);
        if (!focusable.length) { event.preventDefault(); sheet.focus({ preventScroll:true }); return; }
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll:true }); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll:true }); }
    }
    function toggleChip(person, type) {
        if (!editorSelection[person]) return;
        const selection = editorSelection[person];
        if (type === 'rest') { selection.clear(); selection.add('rest'); }
        else { selection.delete('rest'); if (selection.has(type)) selection.delete(type); else selection.add(type); }
        renderChips(person);
    }
    function submitDay() {
        if (!selectedDate) return;
        const button = document.querySelector('[data-shift-action="save-day"]'); if (!button) return;
        const date = selectedDate; const first = [...editorSelection.sergiy]; const second = [...editorSelection.oleksandr];
        requestPin('PIN журналу', 'Підтвердьте збереження загальним PIN', async attempt => {
            button.disabled = true;
            try {
                const ok = await saveDay(date, first, second, attempt); if (!ok) throw new Error('Сервер відхилив операцію');
                closeEditor(); await load(); showToast('Графік зміни збережено', 'check');
            } catch (error) { warn('shiftSaveDay failed:', error); showToast(shiftErrorMessage(error, 'Не вдалося зберегти зміну'), 'error'); }
            finally { button.disabled = false; }
        }, false, 'verify_work_shifts_pin');
    }
    function reset() {
        requestPin('Скинути графік змін', 'Видалити ручні корекції за вибраний місяць?', async attempt => {
            try {
                const ok = await resetMonth(monthKey(), attempt); if (!ok) throw new Error('Сервер відхилив операцію');
                await load(); showToast('Корекції графіка скинуто', 'trash');
            } catch (error) { warn('shiftResetMonth failed:', error); showToast(shiftErrorMessage(error, 'Не вдалося скинути графік'), 'error'); }
        }, true, 'verify_work_shifts_pin');
    }

    return { changeMonth, closeEditor, count, dayData, init, load, monthKey, openEditor, render, renderChips, renderStats, reset, submitDay, toggleChip, trapEditorFocus };
}
