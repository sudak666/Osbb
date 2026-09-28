import { shiftErrorMessage, workShiftNamesFromResponse } from './osbb-shifts.ts';
import type { WorkShiftNames } from './osbb-shifts.ts';
import type { WarnFn } from './controller-types.ts';

export type ShiftNames = WorkShiftNames;

export interface OsbbShiftSettingsControllerOptions {
    document: Document;
    loadSettings(): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
    saveNames(first: string, second: string, third: string, attempt: string): Promise<unknown>;
    getPin(): string | null | undefined;
    showToast(message: string, type?: string): void;
    onNamesChanged(names: ShiftNames): void;
    requestFrame?: (callback: () => void) => unknown;
    warn?: WarnFn;
}

export function createOsbbShiftSettingsController(options: OsbbShiftSettingsControllerOptions) {
    const { document, loadSettings, saveNames, getPin, showToast, onNamesChanged,
        requestFrame = callback => requestAnimationFrame(callback), warn = console.warn } = options;
    let names: ShiftNames = { sergiy: 'Сергій', oleksandr: 'Напарник', third:'Третій співробітник' };

    function apply() {
        const pairs = [
            ['shift-legend-third', names.third], ['shift-stat-name-third', names.third], ['shift-editor-name-third', names.third],
            ['shift-legend-sergiy', names.sergiy], ['shift-stat-name-sergiy', names.sergiy], ['shift-editor-name-sergiy', names.sergiy],
            ['shift-legend-oleksandr', names.oleksandr], ['shift-stat-name-oleksandr', names.oleksandr], ['shift-editor-name-oleksandr', names.oleksandr],
        ];
        pairs.forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
        const heading = document.getElementById('shift-heading');
        if (heading) heading.textContent = `${names.sergiy}, ${names.oleksandr} та ${names.third}`;
        onNamesChanged({ ...names });
    }

    async function load() {
        try {
            const { data, error } = await loadSettings();
            if (error) throw new Error(error.message || 'Не вдалося завантажити імена');
            names = workShiftNamesFromResponse(data, names);
            if (['Олександр', 'Олександр Б.'].includes(names.oleksandr)) names.oleksandr = 'Напарник';
            apply();
        } catch (error) {
            warn('shiftLoadSettings failed:', error);
        }
    }

    function open() {
        (document.getElementById('shift-name-sergiy') as HTMLInputElement).value = names.sergiy;
        (document.getElementById('shift-name-oleksandr') as HTMLInputElement).value = names.oleksandr;
        (document.getElementById('shift-name-third') as HTMLInputElement).value = names.third;
        const editor = document.getElementById('shift-name-editor')!;
        editor.classList.add('is-open');
        editor.setAttribute('aria-hidden', 'false');
        requestFrame(() => document.getElementById('shift-name-sergiy')!.focus({ preventScroll: true }));
    }

    function close() {
        const editor = document.getElementById('shift-name-editor')!;
        editor.classList.remove('is-open');
        editor.setAttribute('aria-hidden', 'true');
    }

    function trapFocus(event: KeyboardEvent) {
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key !== 'Tab') return;
        const focusable = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
    }

    async function save() {
        const first = (document.getElementById('shift-name-sergiy') as HTMLInputElement).value.trim();
        const second = (document.getElementById('shift-name-oleksandr') as HTMLInputElement).value.trim();
        const third = (document.getElementById('shift-name-third') as HTMLInputElement).value.trim();
        if (!first || !second || !third) { showToast('Вкажіть усі три імені', 'error'); return; }
        const attempt = getPin();
        if (!attempt) { showToast('Відкрийте розділ «Зміни» повторно', 'error'); return; }
        try {
            const ok = await saveNames(first, second, third, attempt);
            if (!ok) throw new Error('Сервер відхилив операцію');
            names = { sergiy: first, oleksandr: second, third };
            apply();
            close();
            showToast('Імена працівників оновлено', 'check');
        } catch (error) {
            warn('shiftSaveNames failed:', error);
            showToast(shiftErrorMessage(error, 'Не вдалося змінити імена'), 'error');
        }
    }

    return { apply, close, getNames: () => ({ ...names }), load, open, save, trapFocus };
}
