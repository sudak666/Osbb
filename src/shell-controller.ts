import { clearAuthSession, isAuthSessionValid, setAuthSession } from './auth-session.ts';
import { IDLE_LOCK_MS, isShellTabName, ShellStore, type ShellTabName, TAB_SRC } from './shell-state.ts';
import type { PublicFunctionReturns } from './database.types.ts';

type VerifyLockPinResult = PublicFunctionReturns<'verify_lock_pin'> | null;

export interface ShellControllerDeps {
    document: Document;
    window: Window;
    navigator: Navigator;
    rpc: (fn: 'verify_lock_pin', params: { attempt: string }) => Promise<VerifyLockPinResult>;
    store?: ShellStore;
    setTimeout?: Window['setTimeout'];
    clearTimeout?: Window['clearTimeout'];
}

export interface ShellController {
    bind(): void;
    unlockShell(mainPin?: string): void;
    lockShellNow(): void;
    resetIdleLockTimer(): void;
    lockPress(digit: string | undefined): Promise<void>;
    lockDel(): void;
    switchTab(name: ShellTabName): void;
}

export function createShellController(deps: ShellControllerDeps): ShellController {
    const doc = deps.document;
    const win = deps.window;
    const store = deps.store ?? new ShellStore();
    const setTimer = deps.setTimeout ?? win.setTimeout.bind(win);
    const clearTimer = deps.clearTimeout ?? win.clearTimeout.bind(win);
    let idleLockTimer: ReturnType<Window['setTimeout']> | undefined;
    let mainPinCache: string | null = null;

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
        switchTab('journal');
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

    function loadTab(name: ShellTabName): void {
        const frame = doc.getElementById('frame-' + name) as HTMLIFrameElement | null;
        if (frame && !store.isTabLoaded(name)) {
            frame.src = TAB_SRC[name];
            store.markTabLoaded(name);
        }
    }

    function lockShellNow(): void {
        if (win.localStorage.getItem('osbb_pin_enabled') === '0') return;
        mainPinCache = null;
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
        if (isAuthSessionValid() && win.localStorage.getItem('osbb_pin_enabled') !== '0' && win.localStorage.getItem('osbb_auto_lock_enabled') !== '0') idleLockTimer = setTimer(lockShellNow, IDLE_LOCK_MS);
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
            if (event.data?.type === 'osbb:security-settings-changed') {
                if (win.localStorage.getItem('osbb_pin_enabled') === '0') unlockShell();
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
        doc.querySelectorAll<HTMLButtonElement>('[data-shell-lock]').forEach((lockButton) => {
            lockButton.addEventListener('click', lockShellNow);
        });

        doc.addEventListener('click', (event) => {
            const details = doc.querySelector<HTMLDetailsElement>('.shell-more');
            if (!details?.open || details.contains(event.target as Node)) return;
            details.open = false;
        });
    }

    function switchTab(name: ShellTabName): void {
        if (!isShellTabName(name)) return;
        loadTab(name);
        doc.querySelectorAll('.shell-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.removeAttribute('aria-current');
            if (b.hasAttribute('role')) b.setAttribute('aria-selected', 'false');
        });
        const targetTab = doc.getElementById('shell-tab-' + name);
        if (targetTab) {
            targetTab.classList.add('active');
            targetTab.setAttribute('aria-current', 'page');
            if (targetTab.hasAttribute('role')) targetTab.setAttribute('aria-selected', 'true');
        }

        doc.querySelectorAll('#shell-frames iframe').forEach(f => f.classList.remove('active'));
        const targetFrame = doc.getElementById('frame-' + name);
        if (targetFrame) targetFrame.classList.add('active');
    }

    return {
        bind: bindShellControls,
        unlockShell,
        lockShellNow,
        resetIdleLockTimer,
        lockPress,
        lockDel,
        switchTab,
    };
}
