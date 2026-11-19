import { clearAuthSession, isAuthSessionValid, setAuthSession } from './auth-session.ts';
import { IDLE_LOCK_MS, isShellTabName, ShellStore, type ShellTabName, TAB_SRC } from './shell-state.ts';
import type { PublicFunctionReturns } from './database.types.ts';
import {
    DEFAULT_SECTION, defaultSectionFor, isMobilePrimarySection, isSectionFocus, isShellSection, sectionForModulePage,
    sectionModule, type ShellSection,
} from './shell-nav.ts';

const SECTION_STORAGE_KEY = 'shell_section';

type VerifyLockPinResult = PublicFunctionReturns<'verify_lock_pin'> | null;

export interface ShellControllerDeps {
    document: Document;
    window: Window;
    navigator: Navigator;
    rpc: (fn: 'verify_lock_pin', params: { attempt: string }) => Promise<VerifyLockPinResult>;
    store?: ShellStore;
    setTimeout?: Window['setTimeout'];
    clearTimeout?: Window['clearTimeout'];
    /** Викликається щоразу, коли shell показує розділ (напр., оновити «Головну»). */
    onSectionShown?: (section: ShellSection) => void;
    /** Викликається при блокуванні — закрити все, що показує дані поверх shell. */
    onLock?: () => void;
    /** Екран завантаження модуля (вежа) — поки iframe активного модуля ще не готовий. */
    moduleLoader?: { show(module: ShellTabName): void; hide(finished: boolean): void };
}

export interface ShellController {
    bind(): void;
    unlockShell(mainPin?: string): void;
    lockShellNow(): void;
    resetIdleLockTimer(): void;
    lockPress(digit: string | undefined): Promise<void>;
    lockDel(): void;
    switchTab(name: ShellTabName): void;
    showSection(section: ShellSection, focus?: string): void;
    getSection(): ShellSection;
}

export function createShellController(deps: ShellControllerDeps): ShellController {
    const doc = deps.document;
    const win = deps.window;
    const store = deps.store ?? new ShellStore();
    const setTimer = deps.setTimeout ?? win.setTimeout.bind(win);
    const clearTimer = deps.clearTimeout ?? win.clearTimeout.bind(win);
    let idleLockTimer: ReturnType<Window['setTimeout']> | undefined;
    let mainPinCache: string | null = null;
    let currentSection: ShellSection = DEFAULT_SECTION;
    const lastModuleSection: Record<ShellTabName, ShellSection> = { journal: defaultSectionFor('journal'), sklad: defaultSectionFor('sklad') };
    const frameReady: Partial<Record<ShellTabName, boolean>> = {};
    const pendingSection: Partial<Record<ShellTabName, { section: ShellSection; focus?: string }>> = {};
    const securityEnabled = (key: string): boolean => win.localStorage?.getItem(key) !== '0';

    function requireElement<T extends HTMLElement>(id: string): T {
        const element = doc.getElementById(id);
        if (!element) throw new Error(`Missing shell element: ${id}`);
        return element as T;
    }

    function notifyFrameUnlocked(frame: HTMLIFrameElement): void {
        const message = frame.id === 'frame-journal'
            ? { type: 'osbb:shell-unlocked', mainPin: mainPinCache }
            : { type: 'osbb:shell-unlocked' };
        frame.contentWindow?.postMessage(message, win.location.origin);
    }

    function unlockShell(mainPin?: string): void {
        if (mainPin) mainPinCache = mainPin;
        const lockScreen = doc.getElementById('app-lock-screen');
        if (lockScreen) lockScreen.style.display = 'none';
        requireElement('shell-main').style.display = 'flex';
        resetIdleLockTimer();
        showSection(restoreSection());
        doc.querySelectorAll<HTMLIFrameElement>('#shell-frames iframe').forEach(frame => {
            const embeddedLock = frame.contentDocument?.getElementById('app-lock-screen')
                ?? frame.contentDocument?.getElementById('authScreen');
            if (embeddedLock) embeddedLock.style.display = 'none';
            notifyFrameUnlocked(frame);
        });
    }

    function lockUpdateDots(): void {
        for (let i = 0; i < 4; i++) {
            const dot = doc.getElementById('lock-d' + i);
            if (!dot) continue;
            if (i < store.lockBuf.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        }
    }

    function lockDel(): void {
        store.deleteDigit();
        const err = doc.getElementById('lock-err');
        if (err) err.textContent = '';
        lockUpdateDots();
    }

    async function lockPress(digit: string | undefined): Promise<void> {
        if (!digit || store.lockBusy || store.lockBuf.length >= 4) return;
        store.pushDigit(digit);
        lockUpdateDots();

        if (store.lockBuf.length === 4) {
            const attempt = store.lockBuf;
            store.setBusy(true);
            let ok = false;
            try { ok = Boolean(await deps.rpc('verify_lock_pin', { attempt })); } catch { ok = false; }

            if (ok) {
                store.resetFailures();
                store.setBusy(false);
                setAuthSession();
                resetIdleLockTimer();
                store.clearPin();
                unlockShell(attempt);
            } else {
                const err = doc.getElementById('lock-err');
                if (err) err.textContent = 'Невірний PIN, спробуйте ще';
                try { deps.navigator?.vibrate?.(80); } catch { /* вібрація — лише best-effort */ }
                const lockFails = store.recordFailure();
                store.clearPin();
                lockUpdateDots();

                const dotsContainer = doc.getElementById('lock-dots-container');
                if (dotsContainer) {
                    dotsContainer.classList.remove('shake');
                    void dotsContainer.offsetWidth;
                    dotsContainer.classList.add('shake');
                    setTimer(() => dotsContainer.classList.remove('shake'), 350);
                }

                const lockout = Math.min(lockFails * 500, 5000);
                setTimer(() => {
                    store.setBusy(false);
                    const currentErr = doc.getElementById('lock-err');
                    if (currentErr) currentErr.textContent = '';
                }, lockout);
            }
        }
    }

    function frameFor(name: ShellTabName): HTMLIFrameElement | null {
        return doc.getElementById('frame-' + name) as HTMLIFrameElement | null;
    }

    function restoreSection(): ShellSection {
        try {
            const saved = win.sessionStorage?.getItem(SECTION_STORAGE_KEY);
            if (isShellSection(saved)) return saved;
        } catch { /* sessionStorage може бути недоступний */ }
        return currentSection;
    }

    function rememberSection(section: ShellSection): void {
        try { win.sessionStorage?.setItem(SECTION_STORAGE_KEY, section); } catch { /* best-effort */ }
    }

    /** Вежа видна, лише поки вантажиться iframe саме того модуля, що зараз на екрані. */
    function syncModuleLoader(finished: boolean): void {
        const module = sectionModule(currentSection);
        if (module && store.isTabLoaded(module) && !frameReady[module]) deps.moduleLoader?.show(module);
        else deps.moduleLoader?.hide(finished);
    }

    /** Перше відкриття вантажить iframe одразу з потрібним розділом; далі — postMessage. */
    function loadTab(name: ShellTabName, section: ShellSection = lastModuleSection[name], focus?: string): void {
        const frame = frameFor(name);
        if (!frame) return;
        if (!store.isTabLoaded(name)) {
            const params = [
                section === defaultSectionFor(name) && !focus ? '' : `&section=${encodeURIComponent(section)}`,
                focus ? `&focus=${encodeURIComponent(focus)}` : '',
            ].join('');
            frame.src = `${TAB_SRC[name]}${params}`;
            store.markTabLoaded(name);
            return;
        }
        if (!frameReady[name]) { pendingSection[name] = { section, focus }; return; }
        frame.contentWindow?.postMessage(focus ? { type: 'osbb:navigate', section, focus } : { type: 'osbb:navigate', section }, win.location.origin);
    }

    function lockShellNow(): void {
        if (!securityEnabled('osbb_pin_enabled')) return;
        mainPinCache = null;
        deps.onLock?.();
        clearAuthSession();
        store.resetLock();
        lockUpdateDots();
        const err = doc.getElementById('lock-err');
        if (err) err.textContent = '';
        requireElement('shell-main').style.display = 'none';
        const lockScreen = doc.getElementById('app-lock-screen');
        if (lockScreen) lockScreen.style.display = 'flex';
        doc.querySelectorAll<HTMLIFrameElement>('#shell-frames iframe').forEach(frame => {
            frame.contentWindow?.postMessage({ type: 'osbb:shell-locked' }, win.location.origin);
        });
    }

    function resetIdleLockTimer(): void {
        if (idleLockTimer) clearTimer(idleLockTimer);
        if (isAuthSessionValid() && securityEnabled('osbb_pin_enabled') && securityEnabled('osbb_auto_lock_enabled')) idleLockTimer = setTimer(lockShellNow, IDLE_LOCK_MS);
    }

    function handleVisibilityLockTimer(): void {
        if (doc.visibilityState === 'visible') resetIdleLockTimer();
    }

    function bindShellControls(): void {
        ['pointerdown','keydown','touchstart'].forEach(evt => doc.addEventListener(evt, resetIdleLockTimer, { passive: true }));
        doc.addEventListener('visibilitychange', handleVisibilityLockTimer);
        win.addEventListener('message', (event: MessageEvent) => {
            if (event.origin !== win.location.origin) return;
            const fromShellFrame = [...doc.querySelectorAll<HTMLIFrameElement>('#shell-frames iframe')]
                .some((frame) => frame.contentWindow === event.source);
            if (!fromShellFrame) return;
            if (event.data?.type === 'osbb:user-activity') resetIdleLockTimer();
            if (event.data?.type === 'osbb:section-changed') {
                const sourceFrame = [...doc.querySelectorAll<HTMLIFrameElement>('#shell-frames iframe')]
                    .find((frame) => frame.contentWindow === event.source);
                const module = sourceFrame?.id === 'frame-journal' ? 'journal' : sourceFrame?.id === 'frame-sklad' ? 'sklad' : null;
                const section = module ? sectionForModulePage(module, event.data.section) : null;
                if (module && section) {
                    lastModuleSection[module] = section;
                    if (sectionModule(currentSection) === module && section !== currentSection) {
                        currentSection = section;
                        rememberSection(section);
                        renderNavState();
                    }
                }
            }
            if (event.data?.type === 'osbb:security-settings-changed') {
                if (!securityEnabled('osbb_pin_enabled')) unlockShell();
                resetIdleLockTimer();
            }
            if (event.data?.type === 'osbb:request-shell-pin') {
                const sourceFrame = [...doc.querySelectorAll<HTMLIFrameElement>('#shell-frames iframe')]
                    .find((frame) => frame.contentWindow === event.source);
                if (mainPinCache && sourceFrame) notifyFrameUnlocked(sourceFrame);
                else lockShellNow();
            }
        });

        doc.querySelectorAll<HTMLIFrameElement>('#shell-frames iframe').forEach(frame => {
            frame.addEventListener('load', () => {
                const module: ShellTabName | null = frame.id === 'frame-journal' ? 'journal' : frame.id === 'frame-sklad' ? 'sklad' : null;
                if (module && frame.src) {
                    frameReady[module] = true;
                    const pending = pendingSection[module];
                    delete pendingSection[module];
                    if (pending) frame.contentWindow?.postMessage({ type: 'osbb:navigate', ...pending }, win.location.origin);
                    syncModuleLoader(true);
                }
                if (isAuthSessionValid()) notifyFrameUnlocked(frame);
            });
        });

        doc.querySelectorAll<HTMLButtonElement>('[data-lock-digit]').forEach((button) => {
            button.addEventListener('click', () => void lockPress(button.dataset.lockDigit));
        });
        const deleteButton = doc.querySelector<HTMLButtonElement>('[data-lock-delete]');
        if (deleteButton) deleteButton.addEventListener('click', lockDel);

        doc.querySelectorAll<HTMLButtonElement>('[data-shell-tab]').forEach((button) => {
            button.addEventListener('click', () => {
                if (isShellTabName(button.dataset.shellTab)) switchTab(button.dataset.shellTab);
            });
        });
        doc.querySelectorAll<HTMLElement>('[data-shell-section]').forEach((button) => {
            button.addEventListener('click', () => {
                const section = button.dataset.shellSection;
                if (isShellSection(section)) showSection(section);
            });
        });
        doc.querySelectorAll<HTMLElement>('[data-shell-more]').forEach((button) => {
            button.addEventListener('click', () => setMoreSheetOpen(!isMoreSheetOpen()));
        });
        doc.querySelectorAll<HTMLElement>('[data-shell-more-close]').forEach((button) => {
            button.addEventListener('click', () => setMoreSheetOpen(false));
        });
        doc.addEventListener('keydown', (event) => {
            if ((event as KeyboardEvent).key === 'Escape' && isMoreSheetOpen()) setMoreSheetOpen(false);
        });
        doc.querySelectorAll<HTMLButtonElement>('[data-shell-lock]').forEach((lockButton) => {
            lockButton.addEventListener('click', () => { setMoreSheetOpen(false); lockShellNow(); });
        });
    }

    function isMoreSheetOpen(): boolean {
        const sheet = doc.getElementById('shell-more-sheet');
        return Boolean(sheet && !sheet.hidden);
    }

    function setMoreSheetOpen(open: boolean): void {
        const sheet = doc.getElementById('shell-more-sheet');
        if (!sheet) return;
        sheet.hidden = !open;
        doc.querySelectorAll<HTMLElement>('[data-shell-more]').forEach((button) => button.setAttribute('aria-expanded', String(open)));
        if (open) sheet.querySelector<HTMLElement>('[data-shell-section], [data-shell-lock], a')?.focus();
    }

    function renderNavState(): void {
        doc.querySelectorAll<HTMLElement>('[data-shell-section]').forEach((button) => {
            const active = button.dataset.shellSection === currentSection;
            button.classList.toggle('active', active);
            if (active) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        const inMore = !isMobilePrimarySection(currentSection);
        doc.querySelectorAll<HTMLElement>('[data-shell-more]').forEach((button) => button.classList.toggle('active', inMore));
    }

    function showSection(section: ShellSection, focus?: string): void {
        if (!isShellSection(section)) return;
        const target = isSectionFocus(section, focus) ? focus : undefined;
        const module = sectionModule(section);
        currentSection = section;
        rememberSection(section);
        setMoreSheetOpen(false);
        const home = doc.getElementById('shell-home');
        if (home) home.hidden = module !== null;
        doc.querySelectorAll('#shell-frames iframe').forEach(f => f.classList.remove('active'));
        if (module) {
            lastModuleSection[module] = section;
            loadTab(module, section, target);
            frameFor(module)?.classList.add('active');
        }
        syncModuleLoader(false);
        renderNavState();
        deps.onSectionShown?.(section);
    }

    /** Відкрити модуль на розділі, де користувач був востаннє. */
    function switchTab(name: ShellTabName): void {
        if (!isShellTabName(name)) return;
        showSection(lastModuleSection[name]);
    }

    return {
        bind: bindShellControls,
        unlockShell,
        lockShellNow,
        resetIdleLockTimer,
        lockPress,
        lockDel,
        switchTab,
        showSection,
        getSection: () => currentSection,
    };
}
