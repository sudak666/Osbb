import { isAuthSessionValid } from './auth-session.js';
import { createShellController } from './shell-controller.js';
import { rpc } from './supabase-api.js';

// Захисне очищення для клієнтів, які встигли закешувати тимчасову вкладку.
document.getElementById('shell-tab-promin')?.remove();
document.getElementById('frame-promin')?.remove();

const shellController = createShellController({ document, window, navigator, rpc });

shellController.bind();

if (isAuthSessionValid()) {
    shellController.unlockShell();
} else if (localStorage.getItem('osbb_pin_enabled') === '0') {
    shellController.unlockShell();
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=9', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => {});
}

if ('caches' in window) {
    void Promise.all(['osbb-shell-v3', 'osbb-shell-v4', 'osbb-shell-v5'].map((name) => window.caches.delete(name)));
}
