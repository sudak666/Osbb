// Згенеровано з src/shell.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
import { isAuthSessionValid } from "./auth-session.js";
import { createShellController } from "./shell-controller.js";
import { createShellDashboard } from "./shell-dashboard.js";
import { createModuleLoader } from "./shell-loader.js";
import { createShellReport } from "./shell-report.js";
import { createSupabaseRestClient, rpc } from "./supabase-api.js";
let dashboard = null;
const restClient = createSupabaseRestClient();
const reportRoot = document.getElementById("shell-report");
const report = reportRoot ? createShellReport({ root: reportRoot, client: restClient, window }) : null;
const framesHost = document.getElementById("shell-frames");
const moduleLoader = framesHost ? createModuleLoader({ document, host: framesHost, window }) : void 0;
const shellController = createShellController({
  document,
  window,
  navigator,
  rpc,
  moduleLoader,
  onSectionShown: (section) => {
    if (section === "home") void dashboard?.refresh();
  },
  onLock: () => report?.close()
});
const homeContainer = document.getElementById("shell-home");
if (homeContainer) {
  dashboard = createShellDashboard({
    container: homeContainer,
    client: restClient,
    onNavigate: (section, focus) => shellController.showSection(section, focus),
    onOpenReport: () => report?.open()
  });
}
const applyShellTheme = (value) => {
  const theme = value === "theme-dark" ? "theme-dark" : "theme-light";
  document.body.classList.remove("theme-light", "theme-dark");
  document.body.classList.add(theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "theme-dark" ? "#121214" : "#f4f7fb");
};
window.addEventListener("storage", (event) => {
  if (event.key === "selected_theme") applyShellTheme(event.newValue);
});
shellController.bind();
if (isAuthSessionValid()) {
  shellController.unlockShell();
} else if (localStorage.getItem("osbb_pin_enabled") === "0") {
  shellController.unlockShell();
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js?v=10", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {
  });
}
