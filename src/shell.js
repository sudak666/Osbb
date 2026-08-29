import { isAuthSessionValid } from './auth-session.js';
import { createShellController } from './shell-controller.js';
import { rpc } from './supabase-api.js';

// Захисне очищення для клієнтів, які встигли закешувати тимчасову вкладку.
document.getElementById('shell-tab-promin')?.remove();
document.getElementById('frame-promin')?.remove();

const shellController = createShellController({ document, window, navigator, rpc });

const applyShellTheme = value => {
    const theme = value === 'theme-dark' ? 'theme-dark' : 'theme-light';
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'theme-dark' ? '#121214' : '#f4f7fb');
};
window.addEventListener('storage', event => {
    if (event.key === 'selected_theme') applyShellTheme(event.newValue);
});

shellController.bind();

if (isAuthSessionValid()) {
    shellController.unlockShell();
} else if (localStorage.getItem('osbb_pin_enabled') === '0') {
    shellController.unlockShell();
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=10', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => {});
}

if ('caches' in window) {
    void Promise.all(['osbb-shell-v3', 'osbb-shell-v4', 'osbb-shell-v5', 'osbb-shell-v9'].map((name) => window.caches.delete(name)));
}
