import { shiftErrorMessage, workShiftNamesFromResponse } from './osbb-shifts.js';

export function createOsbbShiftSettingsController(options) {
    const { document, loadSettings, saveNames, requestPin, showToast, onNamesChanged,
        requestFrame = callback => requestAnimationFrame(callback), warn = console.warn } = options;
    let names = { sergiy: 'Сергій', oleksandr: 'Олександр' };

    function apply() {
        const pairs = [
            ['shift-legend-sergiy', names.sergiy], ['shift-stat-name-sergiy', names.sergiy], ['shift-editor-name-sergiy', names.sergiy],
            ['shift-legend-oleksandr', names.oleksandr], ['shift-stat-name-oleksandr', names.oleksandr], ['shift-editor-name-oleksandr', names.oleksandr],
        ];
        pairs.forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
        const heading = document.getElementById('shift-heading');
        if (heading) heading.textContent = `${names.sergiy} та ${names.oleksandr}`;
        onNamesChanged({ ...names });
    }

    async function load() {
        try {
            const { data, error } = await loadSettings();
            if (error) throw new Error(error.message || 'Не вдалося завантажити імена');
            names = workShiftNamesFromResponse(data, names);
            apply();
        } catch (error) {
            warn('shiftLoadSettings failed:', error);
        }
    }

    function open() {
        document.getElementById('shift-name-sergiy').value = names.sergiy;
        document.getElementById('shift-name-oleksandr').value = names.oleksandr;
        const editor = document.getElementById('shift-name-editor');
        editor.classList.add('is-open');
        editor.setAttribute('aria-hidden', 'false');
        requestFrame(() => document.getElementById('shift-name-sergiy').focus({ preventScroll: true }));
    }

    function close() {
        const editor = document.getElementById('shift-name-editor');
        editor.classList.remove('is-open');
        editor.setAttribute('aria-hidden', 'true');
    }

    function trapFocus(event) {
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key !== 'Tab') return;
        const focusable = [...event.currentTarget.querySelectorAll('button:not([disabled]),input:not([disabled])')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
    }

    function save() {
        const first = document.getElementById('shift-name-sergiy').value.trim();
        const second = document.getElementById('shift-name-oleksandr').value.trim();
        if (!first || !second) { showToast('Вкажіть обидва імені', 'error'); return; }
        requestPin('PIN розділу «Зміни»', 'Підтвердьте зміну імен окремим PIN', async attempt => {
            try {
                const ok = await saveNames(first, second, attempt);
                if (!ok) throw new Error('Сервер відхилив операцію');
                names = { sergiy: first, oleksandr: second };
                apply();
                close();
                showToast('Імена працівників оновлено', 'check');
            } catch (error) {
                warn('shiftSaveNames failed:', error);
                showToast(shiftErrorMessage(error, 'Не вдалося змінити імена'), 'error');
            }
        }, false, 'verify_work_shifts_pin');
    }

    return { apply, close, getNames: () => ({ ...names }), load, open, save, trapFocus };
}
