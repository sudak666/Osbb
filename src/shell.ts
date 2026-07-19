import { clearAuthSession, isAuthSessionValid, setAuthSession } from './auth-session.ts';
import { rpc } from './supabase-api.ts';
import { IDLE_LOCK_MS, isShellTabName, ShellStore, type ShellTabName, TAB_SRC } from './shell-state.ts';

const store = new ShellStore();

function requireElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing shell element: ${id}`);
    return element as T;
}

function unlockShell(): void {
    const lockScreen = document.getElementById('app-lock-screen');
    if (lockScreen) lockScreen.style.display = 'none';
    requireElement('shell-main').style.display = 'flex';
    resetIdleLockTimer();
    switchTab('journal');
}

function lockUpdateDots(): void {
    for (let i = 0; i < 4; i++) {
        const dot = document.getElementById('lock-d' + i);
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
    const err = document.getElementById('lock-err');
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
        try { ok = Boolean(await rpc('verify_lock_pin', { attempt })); } catch { ok = false; }

        if (ok) {
            store.resetFailures();
            store.setBusy(false);
            setAuthSession();
            resetIdleLockTimer();
            store.clearPin();
            unlockShell();
        } else {
            const err = document.getElementById('lock-err');
            if (err) err.textContent = 'Невірний PIN, спробуйте ще';
            const lockFails = store.recordFailure();
            store.clearPin();
            lockUpdateDots();

            // Нативний ефект трясіння крапок пароля при помилці
            const dotsContainer = document.getElementById('lock-dots-container');
            if (dotsContainer) {
                dotsContainer.classList.remove('shake');
                void dotsContainer.offsetWidth; // Тригер перемальовування
                dotsContainer.classList.add('shake');
                setTimeout(() => dotsContainer.classList.remove('shake'), 350);
            }

            const lockout = Math.min(lockFails * 500, 5000);
            setTimeout(() => {
                store.setBusy(false);
                const currentErr = document.getElementById('lock-err');
                if (currentErr) currentErr.textContent = '';
            }, lockout);
        }
    }
}

function loadTab(name: ShellTabName): void {
    const frame = document.getElementById('frame-' + name) as HTMLIFrameElement | null;
    if (frame && !store.isTabLoaded(name)) {
        frame.src = TAB_SRC[name];
        store.markTabLoaded(name);
    }
}

function lockShellNow(): void {
    clearAuthSession();
    store.resetLock();
    lockUpdateDots();
    const err = document.getElementById('lock-err');
    if (err) err.textContent = '';
    requireElement('shell-main').style.display = 'none';
    const lockScreen = document.getElementById('app-lock-screen');
    if (lockScreen) lockScreen.style.display = 'flex';
}

let idleLockTimer: ReturnType<typeof setTimeout> | undefined;
function resetIdleLockTimer(): void {
    if (idleLockTimer) clearTimeout(idleLockTimer);
    if (isAuthSessionValid()) idleLockTimer = setTimeout(lockShellNow, IDLE_LOCK_MS);
}
function handleVisibilityLockTimer(): void {
    if (document.visibilityState === 'visible') resetIdleLockTimer();
}
['pointerdown','keydown','touchstart'].forEach(evt => document.addEventListener(evt, resetIdleLockTimer, { passive: true }));
document.addEventListener('visibilitychange', handleVisibilityLockTimer);
window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === 'osbb:user-activity') resetIdleLockTimer();
});

function bindShellControls(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-lock-digit]').forEach((button) => {
        button.addEventListener('click', () => void lockPress(button.dataset.lockDigit));
    });
    const deleteButton = document.querySelector<HTMLButtonElement>('[data-lock-delete]');
    if (deleteButton) deleteButton.addEventListener('click', lockDel);

    document.querySelectorAll<HTMLButtonElement>('[data-shell-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            if (isShellTabName(button.dataset.shellTab)) switchTab(button.dataset.shellTab);
        });
    });
    const lockButton = document.querySelector<HTMLButtonElement>('[data-shell-lock]');
    if (lockButton) lockButton.addEventListener('click', lockShellNow);
}

function switchTab(name: ShellTabName): void {
    loadTab(name);
    document.querySelectorAll('.shell-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.removeAttribute('aria-current');
        if (b.hasAttribute('role')) b.setAttribute('aria-selected', 'false');
    });
    const targetTab = document.getElementById('shell-tab-' + name);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.setAttribute('aria-current', 'page');
        if (targetTab.hasAttribute('role')) targetTab.setAttribute('aria-selected', 'true');
    }

    document.querySelectorAll('#shell-frames iframe').forEach(f => f.classList.remove('active'));
    const targetFrame = document.getElementById('frame-' + name);
    if (targetFrame) targetFrame.classList.add('active');
}

bindShellControls();

if (isAuthSessionValid()) {
    unlockShell();
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
