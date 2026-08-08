import { createLightboxState, moveLightbox } from './osbb-photos.js';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function createOsbbLightboxController(deps) {
    const doc = deps.document;
    const requestFrame = deps.requestAnimationFrame ?? window.requestAnimationFrame.bind(window);
    let state = null;
    let focusReturn = null;
    let startX = 0;
    let startY = 0;
    let bound = false;
    const lightbox = () => doc.getElementById('lightbox');
    const image = () => doc.getElementById('lightbox-img');
    const render = () => {
        const target = image();
        if (target && state) target.src = state.photos[state.index];
    };
    function open(url) {
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
    function close() {
        lightbox()?.classList.remove('open');
        state = null;
        const opener = focusReturn;
        focusReturn = null;
        if (opener && doc.contains(opener) && 'focus' in opener) opener.focus({ preventScroll: true });
    }
    function move(delta) {
        if (!state?.photos.length) return;
        state = moveLightbox(state, delta);
        render();
    }
    const previous = () => move(-1);
    const next = () => move(1);
    function handleKeydown(event) {
        const modal = lightbox();
        if (!modal?.classList.contains('open')) return;
        if (event.key === 'Escape') { close(); return; }
        if (event.key === 'ArrowRight') { next(); return; }
        if (event.key === 'ArrowLeft') { previous(); return; }
        if (event.key !== 'Tab') return;
        const focusables = [...modal.querySelectorAll(FOCUSABLE_SELECTOR)].filter(control => control.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
    }
    function bind() {
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
