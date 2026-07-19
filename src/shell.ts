type ShellTabName = 'journal' | 'sklad';
type RpcParams = Record<string, unknown>;

const SUPABASE_URL = 'https://vkwkyhjjjmcpmiakxohw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KV2ZYS0ELpHPO9cX10Z9Tw_veUObkM9';

async function rpc<T = unknown>(fn: string, params: RpcParams = {}): Promise<T | null> {
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt || r.statusText);
    return txt ? JSON.parse(txt) as T : null;
}

const AUTH_TTL_MS = 12 * 60 * 60 * 1000;
let lockBuf = '';
let lockBusy = false;
let lockFails = 0;

function requireElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing shell element: ${id}`);
    return element as T;
}

function setAuthSession(): void {
    sessionStorage.setItem('auth', 'ok');
    sessionStorage.setItem('auth_at', String(Date.now()));
}
function clearAuthSession(): void {
    sessionStorage.removeItem('auth');
    sessionStorage.removeItem('auth_at');
}
function isAuthSessionValid(): boolean {
    if (sessionStorage.getItem('auth') !== 'ok') return false;
    const authAt = Number(sessionStorage.getItem('auth_at') || 0);
    if (!authAt || Date.now() - authAt >= AUTH_TTL_MS) {
        clearAuthSession();
        return false;
    }
    return true;
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
        if (i < lockBuf.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    }
}

function lockDel(): void {
    if (lockBusy) return;
    if (lockBuf.length > 0) lockBuf = lockBuf.slice(0, -1);
    const err = document.getElementById('lock-err');
    if (err) err.textContent = '';
    lockUpdateDots();
}

async function lockPress(digit: string | undefined): Promise<void> {
    if (!digit || lockBusy || lockBuf.length >= 4) return;
    lockBuf += digit;
    lockUpdateDots();

    if (lockBuf.length === 4) {
        const attempt = lockBuf;
        lockBusy = true;
        let ok = false;
        try { ok = Boolean(await rpc<boolean>('verify_lock_pin', { attempt })); } catch { ok = false; }

        if (ok) {
            lockFails = 0;
            lockBusy = false;
            setAuthSession();
            resetIdleLockTimer();
            lockBuf = '';
            unlockShell();
        } else {
            const err = document.getElementById('lock-err');
            if (err) err.textContent = 'Невірний PIN, спробуйте ще';
            lockFails++;
            lockBuf = '';
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
                lockBusy = false;
                const currentErr = document.getElementById('lock-err');
                if (currentErr) currentErr.textContent = '';
            }, lockout);
        }
    }
}

const TAB_SRC: Record<ShellTabName, string> = {
    journal: 'osbb/index.html?embed=1',
    sklad: 'sklad/index.html?embed=1'
};
const loadedTabs: Partial<Record<ShellTabName, boolean>> = {};

function isShellTabName(name: string | undefined): name is ShellTabName {
    return name === 'journal' || name === 'sklad';
}

function loadTab(name: ShellTabName): void {
    const frame = document.getElementById('frame-' + name) as HTMLIFrameElement | null;
    if (frame && !loadedTabs[name]) {
        frame.src = TAB_SRC[name];
        loadedTabs[name] = true;
    }
}

function lockShellNow(): void {
    clearAuthSession();
    lockBuf = '';
    lockBusy = false;
    lockUpdateDots();
    const err = document.getElementById('lock-err');
    if (err) err.textContent = '';
    requireElement('shell-main').style.display = 'none';
    const lockScreen = document.getElementById('app-lock-screen');
    if (lockScreen) lockScreen.style.display = 'flex';
}

const IDLE_LOCK_MS = 15 * 60 * 1000;
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
