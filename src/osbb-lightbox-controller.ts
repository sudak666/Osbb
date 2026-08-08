import { createLightboxState, moveLightbox, type PhotoCache, type LightboxState } from './osbb-photos.ts';

export interface OsbbLightboxControllerDeps {
    document: Document;
    getPhotoCache: () => PhotoCache;
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
}

export interface OsbbLightboxController {
    open(url: string): void;
    close(): void;
    previous(): void;
    next(): void;
    bind(): void;
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function createOsbbLightboxController(deps: OsbbLightboxControllerDeps): OsbbLightboxController {
    const doc = deps.document;
    const requestFrame = deps.requestAnimationFrame ?? window.requestAnimationFrame.bind(window);
    let state: LightboxState | null = null;
    let focusReturn: Element | null = null;
    let startX = 0;
    let startY = 0;
    let bound = false;

    const lightbox = (): HTMLElement | null => doc.getElementById('lightbox');
    const image = (): HTMLImageElement | null => doc.getElementById('lightbox-img') as HTMLImageElement | null;
    const render = (): void => {
        const target = image();
        if (target && state) target.src = state.photos[state.index];
    };

    function open(url: string): void {
        const nextState = createLightboxState(deps.getPhotoCache(), url);
        if (!nextState) return;
        state = nextState;
        render();
        const modal = lightbox();
        if (!modal) return;
        focusReturn = doc.activeElement;
        modal.classList.add('open');
        requestFrame(() => modal.focus({ preventScroll: true }));
    }

    function close(): void {
        lightbox()?.classList.remove('open');
        state = null;
        const opener = focusReturn;
        focusReturn = null;
        if (opener && doc.contains(opener) && 'focus' in opener) (opener as HTMLElement).focus({ preventScroll: true });
    }

    function move(delta: -1 | 1): void {
        if (!state?.photos.length) return;
        state = moveLightbox(state, delta);
        render();
    }
    const previous = (): void => move(-1);
    const next = (): void => move(1);

    function handleKeydown(event: KeyboardEvent): void {
        const modal = lightbox();
        if (!modal?.classList.contains('open')) return;
        if (event.key === 'Escape') { close(); return; }
        if (event.key === 'ArrowRight') { next(); return; }
        if (event.key === 'ArrowLeft') { previous(); return; }
        if (event.key !== 'Tab') return;
        const focusables = [...modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(control => control.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
    }

    function bind(): void {
        if (bound) return;
        const modal = lightbox();
        if (!modal) return;
        bound = true;
        modal.addEventListener('touchstart', event => {
            const touch = event.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        }, { passive: true });
        modal.addEventListener('touchend', event => {
            const touch = event.changedTouches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            if (Math.abs(dy) > Math.abs(dx) && dy > 60) { close(); return; }
            if (Math.abs(dx) > 50 && Math.abs(dy) < 80) dx < 0 ? next() : previous();
        }, { passive: true });
        doc.addEventListener('keydown', handleKeydown);
    }

    return { open, close, previous, next, bind };
}
