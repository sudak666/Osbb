// Налаштування в самому shell: тема, вхід за PIN, автоблокування.
// Раніше ці перемикачі жили лише в шапці «Журналу», тож на «Головній» і в «Складі»
// їх не було видно. Ключі localStorage ті самі, що в журналі: зміна в одному місці
// доходить до iframe через подію `storage`, а зміна в журналі — сюди так само.

export const THEME_KEY = 'selected_theme';
export const PIN_KEY = 'osbb_pin_enabled';
export const AUTO_LOCK_KEY = 'osbb_auto_lock_enabled';

export type ShellTheme = 'theme-light' | 'theme-dark';

export interface ShellSettingsDeps {
    document: Document;
    window: Window;
    /** Після зміни PIN/автоблокування — перезапустити таймер блокування тощо. */
    onSecurityChanged?: () => void;
}

export interface ShellSettings {
    bind(): void;
    sync(): void;
    applyTheme(value: string | null): ShellTheme;
    setPopoverOpen(open: boolean): void;
}

export const normalizeShellTheme = (value: unknown): ShellTheme => value === 'theme-dark' ? 'theme-dark' : 'theme-light';

export function createShellSettings(deps: ShellSettingsDeps): ShellSettings {
    const doc = deps.document;
    const win = deps.window;

    const read = (key: string): string | null => { try { return win.localStorage?.getItem(key) ?? null; } catch { return null; } };
    const write = (key: string, value: string): void => { try { win.localStorage?.setItem(key, value); } catch { /* best-effort */ } };
    const flag = (key: string): boolean => read(key) !== '0';

    function applyTheme(value: string | null): ShellTheme {
        const theme = normalizeShellTheme(value);
        doc.body.classList.remove('theme-light', 'theme-dark');
        doc.body.classList.add(theme);
        doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', theme === 'theme-dark' ? '#121214' : '#f4f7fb');
        return theme;
    }

    function setChecked(selector: string, checked: boolean, disabled = false): void {
        doc.querySelectorAll<HTMLInputElement>(selector).forEach((input) => {
            input.checked = checked;
            input.disabled = disabled;
            input.closest('.shell-switch-row')?.classList.toggle('is-disabled', disabled);
        });
    }

    /** Привести всі перемикачі (бічна панель і лист «Ще») до того, що в localStorage. */
    function sync(): void {
        const pinOn = flag(PIN_KEY);
        setChecked('[data-shell-theme]', normalizeShellTheme(read(THEME_KEY)) === 'theme-dark');
        setChecked('[data-shell-pin]', pinOn);
        setChecked('[data-shell-auto-lock]', pinOn && flag(AUTO_LOCK_KEY), !pinOn);
        // Без PIN блокувати нема чим — кнопка «Заблокувати» нічого б не робила.
        doc.querySelectorAll<HTMLElement>('[data-shell-lock]').forEach((button) => { button.hidden = !pinOn; });
    }

    function popover(): HTMLElement | null {
        return doc.getElementById('shell-settings');
    }

    function isPopoverOpen(): boolean {
        const el = popover();
        return Boolean(el && !el.hidden);
    }

    function setPopoverOpen(open: boolean): void {
        const el = popover();
        if (!el) return;
        el.hidden = !open;
        doc.querySelectorAll<HTMLElement>('[data-shell-settings]').forEach((button) => {
            button.setAttribute('aria-expanded', String(open));
            button.classList.toggle('active', open);
        });
        if (open) el.querySelector<HTMLInputElement>('input')?.focus();
    }

    function bind(): void {
        doc.querySelectorAll<HTMLInputElement>('[data-shell-theme]').forEach((input) => {
            input.addEventListener('change', () => {
                const theme = applyTheme(input.checked ? 'theme-dark' : 'theme-light');
                write(THEME_KEY, theme);
                sync();
            });
        });
        doc.querySelectorAll<HTMLInputElement>('[data-shell-pin]').forEach((input) => {
            input.addEventListener('change', () => {
                write(PIN_KEY, input.checked ? '1' : '0');
                if (!input.checked) write(AUTO_LOCK_KEY, '0');
                sync();
                deps.onSecurityChanged?.();
            });
        });
        doc.querySelectorAll<HTMLInputElement>('[data-shell-auto-lock]').forEach((input) => {
            input.addEventListener('change', () => {
                write(AUTO_LOCK_KEY, input.checked ? '1' : '0');
                sync();
                deps.onSecurityChanged?.();
            });
        });
        doc.querySelectorAll<HTMLElement>('[data-shell-settings]').forEach((button) => {
            button.addEventListener('click', () => setPopoverOpen(!isPopoverOpen()));
        });
        doc.querySelectorAll<HTMLElement>('[data-shell-settings-close]').forEach((button) => {
            button.addEventListener('click', () => setPopoverOpen(false));
        });
        doc.addEventListener('keydown', (event) => {
            if ((event as KeyboardEvent).key !== 'Escape' || !isPopoverOpen()) return;
            setPopoverOpen(false);
            doc.querySelector<HTMLElement>('[data-shell-settings]')?.focus();
        });
        doc.addEventListener('pointerdown', (event) => {
            if (!isPopoverOpen()) return;
            const target = event.target as Element | null;
            if (target?.closest('#shell-settings, [data-shell-settings]')) return;
            setPopoverOpen(false);
        });
        // Зміни з журналу (його шапка) чи з іншої вкладки.
        win.addEventListener('storage', (event: StorageEvent) => {
            if (event.key === THEME_KEY) applyTheme(event.newValue);
            if (event.key === THEME_KEY || event.key === PIN_KEY || event.key === AUTO_LOCK_KEY || event.key === null) sync();
            if (event.key === PIN_KEY || event.key === AUTO_LOCK_KEY) deps.onSecurityChanged?.();
        });
        sync();
    }

    return { bind, sync, applyTheme, setPopoverOpen };
}
