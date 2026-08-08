import { calculateShiftMoney, shiftDateKey, shiftErrorMessage, shiftTypeDescription, workShiftRowsFromResponse } from './osbb-shifts.js';

const MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

export function createOsbbShiftCalendarController(options) {
    const { document, loadRows, getNames, showToast, now = () => new Date(), warn = console.warn } = options;
    let currentDate = new Date(now().getFullYear(), now().getMonth(), 1);
    let rows = {};
    let initialized = false;
    let loading = false;

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

    return { changeMonth, count, dayData, init, load, monthKey, render, renderStats };
}
