import { appendPinDigit, deletePinDigit, isPinComplete } from './pin-entry.ts';

export type OsbbPinModalCallback = (pin: string) => void | Promise<void>;

export interface OsbbPinModalOptions {
    title?: string;
    subtitle?: string;
    danger?: boolean;
    verifyRpc?: string;
}

export interface OsbbPinModalControllerDeps {
    document: Document;
    verifyPin: (rpc: string, pin: string) => Promise<unknown>;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    setTimeout?: Window['setTimeout'];
}

export interface OsbbPinModalController {
    show(callback: OsbbPinModalCallback, options?: OsbbPinModalOptions): void;
    cancel(): void;
    deleteDigit(): void;
    press(digit: unknown): Promise<void>;
    handleKeydown(event: KeyboardEvent): void;
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]),[tabindex]:not([tabindex="-1"])';
const ICONS = {
    lock: '<span class="pin-modal-icon-wrap is-indigo"><span class="material-symbols-rounded" aria-hidden="true">lock</span></span>',
    danger: '<span class="pin-modal-icon-wrap is-red"><span class="material-symbols-rounded" aria-hidden="true">delete</span></span>',
    success: '<span class="pin-modal-icon-wrap is-green"><span class="material-symbols-rounded" aria-hidden="true">check_circle</span></span>',
    error: '<span class="pin-modal-icon-wrap is-red"><span class="material-symbols-rounded" aria-hidden="true">lock</span></span>',
} as const;

export function createOsbbPinModalController(deps: OsbbPinModalControllerDeps): OsbbPinModalController {
    const doc = deps.document;
    const requestFrame = deps.requestAnimationFrame ?? window.requestAnimationFrame.bind(window);
    const setTimer = deps.setTimeout ?? window.setTimeout.bind(window);
    let buffer = '';
    let callback: OsbbPinModalCallback | null = null;
    let verifyRpc = 'verify_reset_pin';
    let focusReturn: Element | null = null;
    let busy = false;

    const element = (id: string): HTMLElement | null => doc.getElementById(id);
    const modal = (): HTMLElement | null => element('pin-modal');
    const updateDots = (): void => {
        for (let i = 0; i < 4; i++) element('pin-d' + i)?.classList.toggle('is-entered', i < buffer.length);
    };
    const focusDialog = (): void => {
        const dialog = modal()?.querySelector<HTMLElement>('[role="dialog"]');
        const firstButton = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        (firstButton ?? dialog)?.focus({ preventScroll: true });
    };
    const restoreFocus = (): void => {
        const opener = focusReturn;
        focusReturn = null;
        if (opener && doc.contains(opener) && 'focus' in opener) (opener as HTMLElement).focus({ preventScroll: true });
    };
    const hide = (): void => {
        const overlay = modal();
        if (overlay) overlay.style.display = 'none';
        restoreFocus();
    };
    const setText = (id: string, value: string): void => {
        const target = element(id);
        if (target) target.textContent = value;
    };

    function show(nextCallback: OsbbPinModalCallback, options: OsbbPinModalOptions = {}): void {
        buffer = '';
        busy = false;
        callback = nextCallback;
        verifyRpc = options.verifyRpc || 'verify_reset_pin';
        setText('pin-modal-title', options.title || 'Пароль для скидання');
        setText('pin-modal-sub', options.subtitle || 'Введіть 4-значний PIN');
        const icon = element('pin-modal-icon');
        if (icon) icon.innerHTML = options.danger ? ICONS.danger : ICONS.lock;
        setText('pin-err', '');
        updateDots();
        focusReturn = doc.activeElement;
        const overlay = modal();
        if (overlay) overlay.style.display = 'flex';
        requestFrame(() => focusDialog());
    }

    function cancel(): void {
        callback = null;
        buffer = '';
        busy = false;
        hide();
        updateDots();
    }

    function deleteDigit(): void {
        if (busy) return;
        buffer = deletePinDigit(buffer);
        setText('pin-err', '');
        updateDots();
    }

    async function press(digit: unknown): Promise<void> {
        if (busy || !callback) return;
        const nextBuffer = appendPinDigit(buffer, digit);
        if (nextBuffer === buffer) return;
        buffer = nextBuffer;
        updateDots();
        if (!isPinComplete(buffer)) return;
        const attempt = buffer;
        const pendingCallback = callback;
        const pendingRpc = verifyRpc;
        busy = true;
        let verified = false;
        try { verified = await deps.verifyPin(pendingRpc, attempt) === true; }
        catch { verified = false; }
        if (callback !== pendingCallback) return;
        buffer = '';
        busy = false;
        updateDots();
        if (verified) {
            const icon = element('pin-modal-icon');
            if (icon) icon.innerHTML = ICONS.success;
            callback = null;
            hide();
            await pendingCallback(attempt);
            return;
        }
        setText('pin-err', 'Невірний PIN, спробуйте ще');
        const icon = element('pin-modal-icon');
        if (icon) icon.innerHTML = ICONS.error;
        const box = modal()?.querySelector<HTMLElement>(':scope > div');
        if (box) {
            box.style.animation = 'none';
            box.style.transform = 'translateX(-8px)';
            setTimer(() => { box.style.transform = 'translateX(8px)'; }, 80);
            setTimer(() => { box.style.transform = 'translateX(-5px)'; }, 160);
            setTimer(() => { box.style.transform = 'translateX(0)'; }, 240);
        }
    }

    function handleKeydown(event: KeyboardEvent): void {
        if (modal()?.style.display !== 'flex') return;
        if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
        if (event.key !== 'Tab') return;
        const dialog = modal()?.querySelector<HTMLElement>('[role="dialog"]');
        if (!dialog) return;
        const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
            .filter(control => control.offsetParent !== null || control === doc.activeElement);
        if (!focusables.length) { event.preventDefault(); dialog.focus({ preventScroll: true }); return; }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
    }

    return { show, cancel, deleteDigit, press, handleKeydown };
}
