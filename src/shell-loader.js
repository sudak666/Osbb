// Згенеровано з src/shell-loader.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
import { buildHouseScene, HOUSE_COMPLETE_MS, HOUSE_CYCLE_MS } from "./house-scene.js";
const SVG_NS = "http://www.w3.org/2000/svg";
const LOADER_CYCLE_MS = HOUSE_CYCLE_MS;
const LOADER_SHOW_DELAY_MS = 180;
const LOADER_FINALE_MS = 380;
const LOADER_FADE_MS = 260;
const LOADER_SAFETY_MS = 2e4;
const CAPTIONS = { journal: "Відкриваю журнал", sklad: "Відкриваю склад" };
function createModuleLoader(deps) {
  const doc = deps.document;
  const win = deps.window;
  const setTimer = deps.setTimeout ?? win.setTimeout.bind(win);
  const clearTimer = deps.clearTimeout ?? win.clearTimeout.bind(win);
  const reducedMotion = () => Boolean(win.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  let overlay = null;
  let caption = null;
  let tracks = [];
  let running = [];
  let visible = false;
  let showTimer;
  let hideTimer;
  let safetyTimer;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = doc.createElement("div");
    overlay.className = "shell-loader";
    overlay.hidden = true;
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "shell-loader-art hs-scene");
    svg.setAttribute("aria-hidden", "true");
    caption = doc.createElement("p");
    caption.className = "shell-loader-caption";
    overlay.append(svg, caption);
    deps.host.append(overlay);
    const scene = buildHouseScene(doc, svg, "shell-loader");
    svg.setAttribute("viewBox", scene.viewBox);
    tracks = scene.tracks;
    return overlay;
  }
  function stopAnimations() {
    for (const animation of running) animation.cancel();
    running = [];
  }
  function startAnimations() {
    stopAnimations();
    if (reducedMotion()) return;
    for (const { node, keyframes } of tracks) {
      if (typeof node.animate !== "function") continue;
      running.push(node.animate(keyframes, { duration: LOADER_CYCLE_MS, iterations: Infinity }));
    }
  }
  function clear(timer) {
    if (timer !== void 0) clearTimer(timer);
    return void 0;
  }
  function reveal() {
    const node = ensureOverlay();
    node.classList.remove("is-done", "is-leaving");
    node.hidden = false;
    visible = true;
    startAnimations();
  }
  function conceal() {
    hideTimer = clear(hideTimer);
    stopAnimations();
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove("is-done", "is-leaving");
    }
    visible = false;
  }
  function show(module) {
    const node = ensureOverlay();
    if (caption) caption.textContent = CAPTIONS[module];
    safetyTimer = clear(safetyTimer);
    safetyTimer = setTimer(() => {
      safetyTimer = void 0;
      hide(false);
    }, LOADER_SAFETY_MS);
    if (hideTimer !== void 0) {
      hideTimer = clear(hideTimer);
      reveal();
      return;
    }
    if (visible) {
      if (node.classList.contains("is-done")) reveal();
      return;
    }
    if (showTimer === void 0) showTimer = setTimer(() => {
      showTimer = void 0;
      reveal();
    }, LOADER_SHOW_DELAY_MS);
  }
  function hide(finished) {
    showTimer = clear(showTimer);
    safetyTimer = clear(safetyTimer);
    if (!visible || !overlay) return;
    if (!finished) {
      conceal();
      return;
    }
    if (hideTimer !== void 0) return;
    const node = overlay;
    stopAnimations();
    node.classList.add("is-done");
    hideTimer = setTimer(() => {
      node.classList.add("is-leaving");
      hideTimer = setTimer(conceal, LOADER_FADE_MS);
    }, reducedMotion() ? 0 : LOADER_FINALE_MS);
  }
  return { show, hide };
}
const SPLASH_STORAGE_KEY = "osbb_splash_shown";
const SPLASH_PLAY_MS = HOUSE_COMPLETE_MS;
const SPLASH_REDUCED_MS = 1200;
const SPLASH_FADE_MS = 400;
function playLaunchSplash(deps) {
  const { document: doc, window: win, root } = deps;
  if (root.hidden) return;
  const setTimer = deps.setTimeout ?? win.setTimeout.bind(win);
  const clearTimer = deps.clearTimeout ?? win.clearTimeout.bind(win);
  try {
    (deps.storage ?? win.sessionStorage)?.setItem(SPLASH_STORAGE_KEY, "1");
  } catch {
  }
  const reduced = Boolean(win.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "app-splash-art hs-scene");
  svg.setAttribute("aria-hidden", "true");
  root.prepend(svg);
  const scene = buildHouseScene(doc, svg, "app-splash");
  svg.setAttribute("viewBox", scene.viewBox);
  root.classList.add("is-playing");
  const running = [];
  for (const { node, keyframes } of scene.tracks) {
    if (reduced || typeof node.animate !== "function") continue;
    running.push(node.animate(keyframes, { duration: LOADER_CYCLE_MS, iterations: 1 }));
  }
  let finished = false;
  let playTimer;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (playTimer !== void 0) clearTimer(playTimer);
    for (const animation of running) animation.cancel();
    root.classList.add("is-leaving");
    setTimer(() => {
      root.hidden = true;
      root.classList.remove("is-leaving");
      svg.remove();
    }, SPLASH_FADE_MS);
  };
  root.addEventListener("click", finish, { once: true });
  playTimer = setTimer(finish, reduced ? SPLASH_REDUCED_MS : SPLASH_PLAY_MS);
}
export {
  LOADER_CYCLE_MS,
  LOADER_FADE_MS,
  LOADER_FINALE_MS,
  LOADER_SAFETY_MS,
  LOADER_SHOW_DELAY_MS,
  SPLASH_FADE_MS,
  SPLASH_PLAY_MS,
  SPLASH_REDUCED_MS,
  SPLASH_STORAGE_KEY,
  createModuleLoader,
  playLaunchSplash
};
