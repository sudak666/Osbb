const FOCUSABLE_SELECTOR = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function createSkladModalController(deps) {
    const doc = deps.document;
    const focusReturn = new Map();

    const focusableElements = (container) =>
        [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
            .filter((element) => element.offsetParent !== null || element === doc.activeElement);

    function clearTextSelection() {
        const selection = deps.window.getSelection();
        if (selection && !selection.isCollapsed) selection.removeAllRanges();
    }

    function focusDialog(modal) {
        const dialog = modal.querySelector('[role="dialog"]');
        if (!dialog) return;
        const preferred = dialog.querySelector('[data-modal-initial-focus]');
        const target = preferred ?? focusableElements(dialog)[0] ?? dialog;
        clearTextSelection();
        target.focus({ preventScroll: true });
    }

    function open(id) {
        const modal = doc.getElementById(id);
        if (!modal) return;
        if (!modal.classList.contains('open')) focusReturn.set(id, doc.activeElement);
        modal.classList.add('open');
        deps.window.requestAnimationFrame(() => focusDialog(modal));
    }

    function restoreFocus(id) {
        const opener = focusReturn.get(id);
        focusReturn.delete(id);
        if (opener && doc.contains(opener) && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    }

    function close(id, event) {
        const modal = doc.getElementById(id);
        if (!modal || (event && event.target !== modal)) return;
        if (!modal.classList.contains('open')) return;
        modal.classList.remove('open');
        restoreFocus(id);
    }

    function closeAll() {
        doc.querySelectorAll('.modal-bg.open').forEach((modal) => close(modal.id));
    }

    function trapFocus(event) {
        if (event.key !== 'Tab') return;
        const openModals = [...doc.querySelectorAll('.modal-bg.open')];
        const lightbox = doc.getElementById('lightbox');
        if (lightbox?.classList.contains('open')) openModals.push(lightbox);
        const modal = openModals.at(-1);
        if (!modal) return;
        const dialog = modal.matches('[role="dialog"]') ? modal : modal.querySelector('[role="dialog"]');
        if (!dialog) return;
        const focusables = focusableElements(dialog);
        if (!focusables.length) {
            event.preventDefault();
            dialog.focus({ preventScroll: true });
            return;
        }
        const first = focusables[0];
        const last = focusables.at(-1) ?? first;
        if (event.shiftKey && doc.activeElement === first) {
            event.preventDefault();
            last.focus({ preventScroll: true });
        } else if (!event.shiftKey && doc.activeElement === last) {
            event.preventDefault();
            first.focus({ preventScroll: true });
        }
    }

    return { clearTextSelection, open, close, closeAll, trapFocus };
}
