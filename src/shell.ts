import { isAuthSessionValid } from './auth-session.ts';
import { createShellController } from './shell-controller.ts';
import { rpc } from './supabase-api.ts';

const shellController = createShellController({ document, window, navigator, rpc });

shellController.bind();

if (isAuthSessionValid()) {
    shellController.unlockShell();
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
