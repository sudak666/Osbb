import { isAuthSessionValid } from './auth-session.js';
import { createShellController } from './shell-controller.js';
import { rpc } from './supabase-api.js';

const shellController = createShellController({ document, window, navigator, rpc });

shellController.bind();

if (isAuthSessionValid()) {
    shellController.unlockShell();
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
