import { appendPinDigit, deletePinDigit, isPinComplete, pinLockoutDelay } from './pin-entry.ts';

export interface OsbbLockControllerDeps {
    document: Document;
    verifyPin: (pin: string) => Promise<unknown>;
    onUnlocked: () => void | Promise<void>;
    setTimeout?: Window['setTimeout'];
}

export interface OsbbLockController {
    press(digit: unknown): Promise<void>;
    deleteDigit(): void;
    show(): void;
    hide(): void;
}

export function createOsbbLockController(deps: OsbbLockControllerDeps): OsbbLockController {
    const doc = deps.document;
    const setTimer = deps.setTimeout ?? window.setTimeout.bind(window);
    let buffer = '';
    let busy = false;
    let failures = 0;

    const element = (id: string): HTMLElement | null => doc.getElementById(id);
    const updateDots = (): void => {
        for (let i = 0; i < 4; i++) {
            const dot = element('lock-d' + i);
            if (!dot) continue;
            dot.style.background = i < buffer.length ? '#22c55e' : 'rgba(255,255,255,0.2)';
            dot.style.transform = i < buffer.length ? 'scale(1.2)' : 'scale(1)';
        }
    };
    const clearError = (): void => {
        const error = element('lock-err');
        if (error) error.textContent = '';
    };

    function hide(): void {
        const screen = element('app-lock-screen');
        if (screen) screen.style.display = 'none';
    }

    function show(): void {
        buffer = '';
        busy = false;
        updateDots();
        clearError();
        const screen = element('app-lock-screen');
        if (!screen) return;
        screen.style.transition = 'none';
        screen.style.opacity = '1';
        screen.style.display = 'flex';
    }

    function deleteDigit(): void {
        if (busy) return;
        buffer = deletePinDigit(buffer);
        clearError();
        updateDots();
    }

    async function press(digit: unknown): Promise<void> {
        if (busy) return;
        const nextBuffer = appendPinDigit(buffer, digit);
        if (nextBuffer === buffer) return;
        buffer = nextBuffer;
        updateDots();
        if (!isPinComplete(buffer)) return;
        const attempt = buffer;
        busy = true;
        let verified = false;
        try { verified = await deps.verifyPin(attempt) === true; }
        catch { verified = false; }
        buffer = '';
        updateDots();
        if (verified) {
            failures = 0;
            busy = false;
            const screen = element('app-lock-screen');
            if (screen) {
                screen.style.transition = 'opacity 0.35s ease';
                screen.style.opacity = '0';
                setTimer(() => { screen.style.display = 'none'; }, 350);
            }
            await deps.onUnlocked();
            return;
        }
        failures++;
        const error = element('lock-err');
        if (error) error.textContent = 'Невірний PIN, спробуйте ще';
        const box = element('app-lock-screen')?.querySelector<HTMLElement>(':scope > div');
        if (box) {
            box.style.animation = 'none';
            box.style.transform = 'translateX(-8px)';
            setTimer(() => { box.style.transform = 'translateX(8px)'; }, 80);
            setTimer(() => { box.style.transform = 'translateX(-5px)'; }, 160);
            setTimer(() => { box.style.transform = 'translateX(0)'; }, 240);
        }
        setTimer(() => { busy = false; clearError(); }, pinLockoutDelay(failures));
    }

    return { press, deleteDigit, show, hide };
}
