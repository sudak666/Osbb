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
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=5', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => {});
}

if ('caches' in window) {
    void Promise.all(['osbb-shell-v3', 'osbb-shell-v4'].map((name) => window.caches.delete(name)));
}
