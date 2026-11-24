import { isAuthSessionValid } from './auth-session.ts';
import { createShellController } from './shell-controller.ts';
import { createShellDashboard } from './shell-dashboard.ts';
import { createModuleLoader, playLaunchSplash } from './shell-loader.ts';
import { createShellReport } from './shell-report.ts';
import { createShellSettings } from './shell-settings.ts';
import { createSupabaseRestClient, rpc } from './supabase-api.ts';

let dashboard: ReturnType<typeof createShellDashboard> | null = null;
const restClient = createSupabaseRestClient();
const reportRoot = document.getElementById('shell-report');
const report = reportRoot ? createShellReport({ root: reportRoot, client: restClient, window }) : null;
const splashRoot = document.getElementById('app-splash');
if (splashRoot) playLaunchSplash({ document, window, root: splashRoot });
const framesHost = document.getElementById('shell-frames');
const moduleLoader = framesHost ? createModuleLoader({ document, host: framesHost, window }) : undefined;
const shellController = createShellController({
    document, window, navigator, rpc, moduleLoader,
    onSectionShown: (section) => { if (section === 'home') void dashboard?.refresh(); },
    onLock: () => { report?.close(); settings.setPopoverOpen(false); },
});
const homeContainer = document.getElementById('shell-home');
if (homeContainer) {
    dashboard = createShellDashboard({
        container: homeContainer,
        client: restClient,
        onNavigate: (section, focus) => shellController.showSection(section, focus),
        onOpenReport: () => report?.open(),
    });
}

// Тема, PIN і автоблокування — у бічній панелі («Налаштування») і в листі «Ще».
const settings = createShellSettings({ document, window, onSecurityChanged: () => shellController.resetIdleLockTimer() });
settings.bind();

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
