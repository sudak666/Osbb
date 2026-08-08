import { applyPinKey, isPinComplete } from './pin-entry.js';

export function createSkladDeletePinController(deps) {
    const doc = deps.document;
    const setTimer = deps.setTimeout ?? window.setTimeout.bind(window);
    const warn = deps.warn ?? console.warn.bind(console);
    let buffer = '';
    let action = null;
    let busy = false;

    const errorElement = () => doc.getElementById('delPinErr');
    const updateDots = () => {
        for (let i = 0; i < 4; i++) doc.getElementById('dp' + i)?.classList.toggle('filled', i < buffer.length);
    };
    const clear = () => {
        buffer = '';
        updateDots();
        const error = errorElement();
        if (error) error.textContent = '';
    };

    function show(title, nextAction) {
        action = nextAction;
        clear();
        const titleElement = doc.getElementById('delPinTitle');
        if (titleElement) titleElement.textContent = title;
        deps.openModal('delPinModal');
    }

    function cancel(event) {
        const modal = doc.getElementById('delPinModal');
        if (event && event.target !== modal) return;
        deps.closeModal('delPinModal');
        action = null;
        clear();
    }

    async function press(key) {
        if (busy) return;
        const nextBuffer = applyPinKey(buffer, key);
        if (nextBuffer === buffer && key !== 'C') return;
        buffer = nextBuffer;
        updateDots();
        const error = errorElement();
        if (error) error.textContent = '';
        if (!isPinComplete(buffer)) return;

        const pin = buffer;
        const pendingAction = action;
        buffer = '';
        updateDots();
        if (!pendingAction) return;

        busy = true;
        let result;
        try { result = await pendingAction(pin); }
        catch (caught) {
            warn('delete PIN action failed', caught);
            result = { ok: false, reason: 'network' };
        } finally { busy = false; }

        if (action !== pendingAction) return;
        if (result.ok) {
            deps.closeModal('delPinModal');
            action = null;
            return;
        }

        const messages = {
            bad_pin: 'Невірний PIN, спробуйте ще',
            negative_stock: 'Видалення призведе до від’ємного залишку',
            not_found: 'Запис не знайдено',
            network: 'Помилка мережі, спробуйте ще',
        };
        if (error) error.textContent = messages[result.reason ?? 'bad_pin'];
        if (result.reason && result.reason !== 'bad_pin') {
            setTimer(() => {
                if (action !== pendingAction) return;
                deps.closeModal('delPinModal');
                action = null;
            }, 1_600);
        }
    }

    return { show, cancel, press };
}
