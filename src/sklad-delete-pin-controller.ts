import { applyPinKey, isPinComplete } from './pin-entry.ts';

export type DeletePinFailureReason = 'bad_pin' | 'negative_stock' | 'not_found' | 'network';
export type DeletePinResult = { ok: true } | { ok: false; reason?: DeletePinFailureReason };
export type DeletePinAction = (pin: string) => Promise<DeletePinResult>;

export interface SkladDeletePinControllerDeps {
    document: Document;
    openModal: (id: string) => void;
    closeModal: (id: string) => void;
    setTimeout?: Window['setTimeout'];
    warn?: (message: string, error: unknown) => void;
}

export interface SkladDeletePinController {
    show(title: string, action: DeletePinAction): void;
    cancel(event?: Event): void;
    press(key: unknown): Promise<void>;
}

export function createSkladDeletePinController(deps: SkladDeletePinControllerDeps): SkladDeletePinController {
    const doc = deps.document;
    const setTimer = deps.setTimeout ?? window.setTimeout.bind(window);
    const warn = deps.warn ?? console.warn.bind(console);
    let buffer = '';
    let action: DeletePinAction | null = null;
    let busy = false;

    const errorElement = (): HTMLElement | null => doc.getElementById('delPinErr');
    const updateDots = (): void => {
        for (let i = 0; i < 4; i++) doc.getElementById('dp' + i)?.classList.toggle('filled', i < buffer.length);
    };
    const clear = (): void => {
        buffer = '';
        updateDots();
        const error = errorElement();
        if (error) error.textContent = '';
    };

    function show(title: string, nextAction: DeletePinAction): void {
        action = nextAction;
        clear();
        const titleElement = doc.getElementById('delPinTitle');
        if (titleElement) titleElement.textContent = title;
        deps.openModal('delPinModal');
    }

    function cancel(event?: Event): void {
        const modal = doc.getElementById('delPinModal');
        if (event && event.target !== modal) return;
        deps.closeModal('delPinModal');
        action = null;
        clear();
    }

    async function press(key: unknown): Promise<void> {
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
        let result: DeletePinResult;
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

        const messages: Record<DeletePinFailureReason, string> = {
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
