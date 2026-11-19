import type { ShellTabName } from './shell-state.ts';

/**
 * Екран завантаження модуля в shell: ізометрична вежа, яку промальовує світна
 * точка, грані наливаються кольором, вікна загоряються знизу вгору, по склу
 * пробігає відблиск. Показується лише якщо iframe вантажиться довше за
 * SHOW_DELAY_MS; коли модуль готовий — усі вікна загоряються й екран згасає.
 *
 * Анімація — Web Animations API (без покадрового JS і без SVG-фільтрів), тож
 * не навантажує слабкі телефони. Базові атрибути елементів = фінальний кадр:
 * після cancel() вежа стоїть повністю освітлена; так само при reduced motion.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
export const LOADER_CYCLE_MS = 4800;
export const LOADER_SHOW_DELAY_MS = 180;
export const LOADER_FINALE_MS = 380;
export const LOADER_FADE_MS = 260;
export const LOADER_SAFETY_MS = 20000;

const CAPTIONS: Record<ShellTabName, string> = { journal: 'Відкриваю журнал', sklad: 'Відкриваю склад' };

export interface ModuleLoader {
    /** Активний модуль вантажиться — показати (із затримкою) вежу. */
    show(module: ShellTabName): void;
    /** Сховати. `finished` — модуль готовий: коротка фінальна «всі вікна світяться» і згасання; інакше — одразу. */
    hide(finished: boolean): void;
}

export interface ModuleLoaderDeps {
    document: Document;
    host: HTMLElement;
    window: Window;
    setTimeout?: Window['setTimeout'];
    clearTimeout?: Window['clearTimeout'];
}

type Point = [number, number];
export type Track = { node: Element; keyframes: Keyframe[] };

/* ---------- Геометрія вежі ---------- */

const SCALE = 15;
const W = 4;
const D = 3;
const H = 9;
const iso = (x: number, y: number, z: number): Point => [(x - y) * 0.866 * SCALE, (x + y) * 0.5 * SCALE - z * SCALE];
const fmt = (p: Point): string => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
const points = (...pts: Array<[number, number, number]>): string => pts.map(p => fmt(iso(...p))).join(' ');

/** Довжина ламаної — рахуємо самі, щоб не залежати від getTotalLength() прихованого SVG. */
export function polylineLength(pts: Point[]): number {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return total;
}

/** Точка на ламаній на частці `fraction` її довжини (0…1). */
export function pointAlong(pts: Point[], fraction: number): Point {
    let remaining = Math.max(0, Math.min(1, fraction)) * polylineLength(pts);
    for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const segment = Math.hypot(bx - ax, by - ay);
        if (remaining <= segment || i === pts.length - 1) {
            const k = segment ? Math.min(1, remaining / segment) : 0;
            return [ax + (bx - ax) * k, ay + (by - ay) * k];
        }
        remaining -= segment;
    }
    return pts[pts.length - 1];
}

/** Секунди циклу → offset ключового кадру (0…1). */
const at = (seconds: number): number => Math.min(1, Math.max(0, (seconds * 1000) / LOADER_CYCLE_MS));
const fadeIn = (from: number, to: number): Keyframe[] => [
    { offset: 0, opacity: 0 }, { offset: at(from), opacity: 0 }, { offset: at(to), opacity: 1 }, { offset: 1, opacity: 1 },
];
const drawStroke = (length: number, from: number, to: number): Keyframe[] => [
    { offset: 0, strokeDashoffset: String(length) },
    { offset: at(from), strokeDashoffset: String(length), easing: 'cubic-bezier(.65,0,.35,1)' },
    { offset: at(to), strokeDashoffset: '0' },
    { offset: 1, strokeDashoffset: '0' },
];

/** Детермінований «випадковий» розкид, щоб вікна загорялись щоразу однаково. */
function seededRandom(seed: number): () => number {
    let state = seed;
    return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

export function buildTower(doc: Document, svg: SVGSVGElement, idPrefix = 'shell-loader'): Track[] {
    const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] => {
        const node = doc.createElementNS(SVG_NS, tag);
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
        parent.append(node);
        return node;
    };
    const rnd = seededRandom(7);
    const tracks: Track[] = [];
    const track = (node: Element, keyframes: Keyframe[]): void => { tracks.push({ node, keyframes }); };

    const defs = el('defs', {}, svg);
    const shineGradient = el('linearGradient', { id: `${idPrefix}-shine`, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    for (const [offset, opacity] of [[0, 0], [0.5, 0.55], [1, 0]]) el('stop', { offset, class: 'shell-loader-shine-stop', 'stop-opacity': opacity }, shineGradient);
    const bodyClip = el('clipPath', { id: `${idPrefix}-body` }, defs);

    const root = el('g', {}, svg);
    track(root, [{ offset: 0, opacity: 1 }, { offset: at(4.25), opacity: 1 }, { offset: at(4.75), opacity: 0 }, { offset: 1, opacity: 0 }]);

    const body = el('g', {}, root);
    track(body, fadeIn(0.8, 1.6));
    const ground = iso(W / 2, D / 2, 0);
    el('ellipse', { cx: ground[0], cy: ground[1] + 6, rx: 70, ry: 16, class: 'shell-loader-shadow' }, body);
    const front: Array<[number, number, number]> = [[0, D, 0], [W, D, 0], [W, D, H], [0, D, H]];
    const side: Array<[number, number, number]> = [[W, 0, 0], [W, D, 0], [W, D, H], [W, 0, H]];
    const top: Array<[number, number, number]> = [[0, 0, H], [W, 0, H], [W, D, H], [0, D, H]];
    el('polygon', { points: points(...front), class: 'shell-loader-front' }, body);
    el('polygon', { points: points(...side), class: 'shell-loader-side' }, body);
    el('polygon', { points: points(...top), class: 'shell-loader-top' }, body);
    for (const face of [front, side, top]) el('polygon', { points: points(...face) }, bodyClip);
    // Машинне відділення ліфта на даху.
    el('polygon', { points: points([1.4, 1.8, H], [2.4, 1.8, H], [2.4, 1.8, H + 0.9], [1.4, 1.8, H + 0.9]), class: 'shell-loader-front' }, body);
    el('polygon', { points: points([2.4, 0.8, H], [2.4, 1.8, H], [2.4, 1.8, H + 0.9], [2.4, 0.8, H + 0.9]), class: 'shell-loader-side' }, body);
    el('polygon', { points: points([1.4, 0.8, H + 0.9], [2.4, 0.8, H + 0.9], [2.4, 1.8, H + 0.9], [1.4, 1.8, H + 0.9]), class: 'shell-loader-top' }, body);
    for (let z = 1; z < H; z++) el('polyline', { points: points([0, D, z], [W, D, z], [W, 0, z]), class: 'shell-loader-floor' }, body);

    const lit = el('g', {}, root);
    const addWindow = (quad: Array<[number, number, number]>, floor: number): void => {
        el('polygon', { points: points(...quad), class: 'shell-loader-window' }, body);
        const on = el('polygon', { points: points(...quad), class: 'shell-loader-lit' }, lit);
        const start = 1.5 + floor * 0.085 + rnd() * 0.45;
        track(on, fadeIn(start, start + 0.25));
    };
    for (let z = 1; z < H; z++) {
        for (let i = 0; i < W; i++) { const x = i + 0.25; addWindow([[x, D, z + 0.28], [x + 0.5, D, z + 0.28], [x + 0.5, D, z + 0.78], [x, D, z + 0.78]], z); }
        for (let j = 0; j < D; j++) { const y = j + 0.25; addWindow([[W, y, z + 0.28], [W, y + 0.5, z + 0.28], [W, y + 0.5, z + 0.78], [W, y, z + 0.78]], z); }
    }
    track(el('polygon', { points: points([1.6, D, 0], [2.4, D, 0], [2.4, D, 0.75], [1.6, D, 0.75]), class: 'shell-loader-lit' }, lit), fadeIn(1.3, 1.6));

    const shineGroup = el('g', { 'clip-path': `url(#${idPrefix}-body)` }, root);
    const shine = el('rect', { x: -160, y: -200, width: 60, height: 320, fill: `url(#${idPrefix}-shine)`, opacity: 0 }, shineGroup);
    const sweep = (x: number, opacity: number, offset: number): Keyframe => ({ offset, opacity, transform: `translateX(${x}px) skewX(-20deg)` });
    track(shine, [sweep(0, 1, 0), sweep(0, 1, at(2.95)), sweep(300, 1, at(3.65)), sweep(300, 0, at(3.7)), sweep(300, 0, 1)]);

    const outline: Point[] = [[0, D, 0], [W, D, 0], [W, 0, 0], [W, 0, H], [0, 0, H], [0, D, H], [0, D, 0]].map(p => iso(p[0], p[1], p[2]));
    const innerEdges: Point[][] = [
        [[W, D, 0], [W, D, H], [0, D, H]].map(p => iso(p[0], p[1], p[2])),
        [[W, D, H], [W, 0, H]].map(p => iso(p[0], p[1], p[2])),
    ];
    const stroke = (pts: Point[], from: number, to: number): void => {
        const length = polylineLength(pts);
        const path = el('polyline', { points: pts.map(fmt).join(' '), class: 'shell-loader-edge', 'stroke-dasharray': length.toFixed(2) }, root);
        track(path, drawStroke(length, from, to));
    };
    stroke(outline, 0, 1.1);
    for (const edge of innerEdges) stroke(edge, 0.7, 1.4);

    // Світна «ручка», що веде контур.
    const pen = el('g', { opacity: 0 }, root);
    el('circle', { r: 7, class: 'shell-loader-pen-halo' }, pen);
    el('circle', { r: 3, class: 'shell-loader-pen' }, pen);
    const penFrames: Keyframe[] = [];
    const samples = 24;
    for (let i = 0; i <= samples; i++) {
        const [x, y] = pointAlong(outline, i / samples);
        penFrames.push({ offset: at((1.1 * i) / samples), opacity: 1, transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)` });
    }
    const end = penFrames[penFrames.length - 1].transform;
    penFrames.push({ offset: at(1.35), opacity: 0, transform: end }, { offset: 1, opacity: 0, transform: end });
    track(pen, penFrames);

    // Іскри від землі.
    for (let i = 0; i < 14; i++) {
        const spark = el('circle', { cx: ((rnd() - 0.5) * 130).toFixed(2), cy: (ground[1] + 6).toFixed(2), r: 1.4, class: 'shell-loader-spark', opacity: 0 }, root);
        const start = 1.2 + rnd();
        const rise = 70 + rnd() * 90;
        const drift = (rnd() - 0.5) * 16;
        track(spark, [
            { offset: 0, opacity: 0, transform: 'translate(0px, 0px)' },
            { offset: at(start), opacity: 0, transform: 'translate(0px, 0px)' },
            { offset: at(start + 1.2), opacity: 0.9, transform: `translate(${(drift / 2).toFixed(2)}px, ${(-rise / 2).toFixed(2)}px)` },
            { offset: at(start + 2.4), opacity: 0, transform: `translate(${drift.toFixed(2)}px, ${(-rise).toFixed(2)}px)` },
            { offset: 1, opacity: 0, transform: `translate(${drift.toFixed(2)}px, ${(-rise).toFixed(2)}px)` },
        ]);
    }
    return tracks;
}

export function createModuleLoader(deps: ModuleLoaderDeps): ModuleLoader {
    const doc = deps.document;
    const win = deps.window;
    const setTimer = deps.setTimeout ?? win.setTimeout.bind(win);
    const clearTimer = deps.clearTimeout ?? win.clearTimeout.bind(win);
    const reducedMotion = (): boolean => Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    let overlay: HTMLElement | null = null;
    let caption: HTMLElement | null = null;
    let tracks: Track[] = [];
    let running: Animation[] = [];
    let visible = false;
    let showTimer: ReturnType<Window['setTimeout']> | undefined;
    let hideTimer: ReturnType<Window['setTimeout']> | undefined;
    let safetyTimer: ReturnType<Window['setTimeout']> | undefined;

    function ensureOverlay(): HTMLElement {
        if (overlay) return overlay;
        overlay = doc.createElement('div');
        overlay.className = 'shell-loader';
        overlay.hidden = true;
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        const svg = doc.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
        svg.setAttribute('class', 'shell-loader-art');
        svg.setAttribute('viewBox', '-80 -175 170 255');
        svg.setAttribute('aria-hidden', 'true');
        caption = doc.createElement('p');
        caption.className = 'shell-loader-caption';
        overlay.append(svg, caption);
        deps.host.append(overlay);
        tracks = buildTower(doc, svg);
        return overlay;
    }

    function stopAnimations(): void {
        for (const animation of running) animation.cancel();
        running = [];
    }

    function startAnimations(): void {
        stopAnimations();
        if (reducedMotion()) return;
        for (const { node, keyframes } of tracks) {
            if (typeof (node as Element & { animate?: unknown }).animate !== 'function') continue;
            running.push(node.animate(keyframes, { duration: LOADER_CYCLE_MS, iterations: Infinity }));
        }
    }

    function clear(timer: ReturnType<Window['setTimeout']> | undefined): undefined {
        if (timer !== undefined) clearTimer(timer);
        return undefined;
    }

    function reveal(): void {
        const node = ensureOverlay();
        node.classList.remove('is-done', 'is-leaving');
        node.hidden = false;
        visible = true;
        startAnimations();
    }

    function conceal(): void {
        hideTimer = clear(hideTimer);
        stopAnimations();
        if (overlay) {
            overlay.hidden = true;
            overlay.classList.remove('is-done', 'is-leaving');
        }
        visible = false;
    }

    function show(module: ShellTabName): void {
        const node = ensureOverlay();
        if (caption) caption.textContent = CAPTIONS[module];
        safetyTimer = clear(safetyTimer);
        safetyTimer = setTimer(() => { safetyTimer = undefined; hide(false); }, LOADER_SAFETY_MS);
        if (hideTimer !== undefined) {
            // Ховались, але модуль знову вантажиться — повертаємо анімацію.
            hideTimer = clear(hideTimer);
            reveal();
            return;
        }
        if (visible) {
            if (node.classList.contains('is-done')) reveal();
            return;
        }
        if (showTimer === undefined) showTimer = setTimer(() => { showTimer = undefined; reveal(); }, LOADER_SHOW_DELAY_MS);
    }

    function hide(finished: boolean): void {
        showTimer = clear(showTimer);
        safetyTimer = clear(safetyTimer);
        if (!visible || !overlay) return;
        if (!finished) { conceal(); return; }
        if (hideTimer !== undefined) return;
        const node = overlay;
        stopAnimations(); // фінальний кадр: усі вікна світяться
        node.classList.add('is-done');
        hideTimer = setTimer(() => {
            node.classList.add('is-leaving');
            hideTimer = setTimer(conceal, LOADER_FADE_MS);
        }, reducedMotion() ? 0 : LOADER_FINALE_MS);
    }

    return { show, hide };
}

/* ---------- Заставка при запуску застосунку ---------- */

export const SPLASH_STORAGE_KEY = 'osbb_splash_shown';
/** Скільки грає заставка: вежа намальована, вікна світяться, відблиск пробіг. */
export const SPLASH_PLAY_MS = 3800;
export const SPLASH_REDUCED_MS = 1200;
export const SPLASH_FADE_MS = 400;

export interface LaunchSplashDeps {
    document: Document;
    window: Window;
    /** `#app-splash` з index.html — фон і назва є з першого кадру, щоб до старту JS не блимав екран PIN; вежу малює JS. */
    root: HTMLElement;
    storage?: Pick<Storage, 'setItem'>;
    setTimeout?: Window['setTimeout'];
    clearTimeout?: Window['clearTimeout'];
}

/**
 * Один раз за запуск (sessionStorage) програє вежу поверх усього застосунку,
 * потім згасає. Дотик пропускає заставку. Якщо inline-скрипт у index.html уже
 * сховав `#app-splash` (цей запуск її бачив) — нічого не робить.
 */
export function playLaunchSplash(deps: LaunchSplashDeps): void {
    const { document: doc, window: win, root } = deps;
    if (root.hidden) return;
    const setTimer = deps.setTimeout ?? win.setTimeout.bind(win);
    const clearTimer = deps.clearTimeout ?? win.clearTimeout.bind(win);
    try { (deps.storage ?? win.sessionStorage)?.setItem(SPLASH_STORAGE_KEY, '1'); } catch { /* приватний режим — покажемо ще раз, не страшно */ }

    const reduced = Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const svg = doc.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('class', 'app-splash-art');
    svg.setAttribute('viewBox', '-80 -175 170 255');
    svg.setAttribute('aria-hidden', 'true');
    root.prepend(svg);
    const running: Animation[] = [];
    for (const { node, keyframes } of buildTower(doc, svg, 'app-splash')) {
        if (reduced || typeof (node as Element & { animate?: unknown }).animate !== 'function') continue;
        running.push(node.animate(keyframes, { duration: LOADER_CYCLE_MS, iterations: 1 }));
    }

    let finished = false;
    let playTimer: ReturnType<Window['setTimeout']> | undefined;
    const finish = (): void => {
        if (finished) return;
        finished = true;
        if (playTimer !== undefined) clearTimer(playTimer);
        for (const animation of running) animation.cancel(); // фінальний кадр — усі вікна світяться
        root.classList.add('is-leaving');
        setTimer(() => { root.hidden = true; root.classList.remove('is-leaving'); svg.remove(); }, SPLASH_FADE_MS);
    };
    root.addEventListener('click', finish, { once: true });
    playTimer = setTimer(finish, reduced ? SPLASH_REDUCED_MS : SPLASH_PLAY_MS);
}
