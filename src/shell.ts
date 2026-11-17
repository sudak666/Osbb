import { isAuthSessionValid } from './auth-session.ts';
import { createShellController } from './shell-controller.ts';
import { createShellDashboard } from './shell-dashboard.ts';
import { createShellReport } from './shell-report.ts';
import { createSupabaseRestClient, rpc } from './supabase-api.ts';

let dashboard: ReturnType<typeof createShellDashboard> | null = null;
const restClient = createSupabaseRestClient();
const reportRoot = document.getElementById('shell-report');
const report = reportRoot ? createShellReport({ root: reportRoot, client: restClient, window }) : null;
const shellController = createShellController({
    document, window, navigator, rpc,
    onSectionShown: (section) => { if (section === 'home') void dashboard?.refresh(); },
    onLock: () => report?.close(),
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

const applyShellTheme = (value: string | null): void => {
    const theme = value === 'theme-dark' ? 'theme-dark' : 'theme-light';
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme);
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', theme === 'theme-dark' ? '#121214' : '#f4f7fb');
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
