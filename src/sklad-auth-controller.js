import { setAuthSession } from './auth-session.js';
import { applyPinKey, isPinComplete, pinLockoutDelay } from './pin-entry.js';

export function createSkladAuthController(deps) {
    const doc = deps.document;
    const setTimer = deps.setTimeout ?? window.setTimeout.bind(window);
    let buffer = '';
    let busy = false;
    let failures = 0;

    const updateDots = () => {
        for (let i = 0; i < 4; i++) doc.getElementById('d' + i)?.classList.toggle('filled', i < buffer.length);
    };
    const clearError = () => {
        const error = doc.getElementById('authErr');
        if (error) error.textContent = '';
    };
    async function verify(attempt) {
        busy = true;
        clearError();
        let ok = false;
        try { ok = await deps.rpc(attempt); } catch { ok = false; }
        if (ok) {
            failures = 0;
            setAuthSession(deps.storage);
            const screen = doc.getElementById('authScreen');
            if (screen) {
                screen.style.transition = 'opacity .3s';
                screen.style.opacity = '0';
                setTimer(() => { screen.style.display = 'none'; screen.style.opacity = ''; }, 320);
            }
            buffer = '';
            busy = false;
            updateDots();
            return;
        }
        failures++;
        const error = doc.getElementById('authErr');
        if (error) error.textContent = 'Невірний PIN-код';
        const box = doc.querySelector('.auth-box');
        if (box) {
            box.style.animation = 'shake .4s';
            setTimer(() => { box.style.animation = ''; }, 400);
        }
        buffer = '';
        updateDots();
        setTimer(() => { clearError(); busy = false; }, 400 + pinLockoutDelay(failures));
    }
    async function press(key) {
        if (busy) return;
        const next = applyPinKey(buffer, key);
        if (next === buffer && key !== 'C') return;
        buffer = next;
        updateDots();
        clearError();
        if (isPinComplete(buffer)) await verify(buffer);
    }
    function bind() {
        doc.querySelectorAll('[data-auth-pin-key]').forEach((button) => {
            button.addEventListener('click', () => void press(button.dataset.authPinKey));
        });
    }
    return { bind, press };
}
