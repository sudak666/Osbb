import { isAuthSessionValid } from './auth-session.ts';
import { createShellController } from './shell-controller.ts';
import { rpc } from './supabase-api.ts';

// Захисне очищення для клієнтів, які встигли закешувати тимчасову вкладку.
document.getElementById('shell-tab-promin')?.remove();
document.getElementById('frame-promin')?.remove();

const shellController = createShellController({ document, window, navigator, rpc });

shellController.bind();

if (isAuthSessionValid()) {
    shellController.unlockShell();
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=6', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => {});
}

if ('caches' in window) {
    void Promise.all(['osbb-shell-v3', 'osbb-shell-v4', 'osbb-shell-v5'].map((name) => window.caches.delete(name)));
}
