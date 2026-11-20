import { buildHouseScene, HOUSE_COMPLETE_MS, HOUSE_CYCLE_MS, type Track } from './house-scene.ts';
import type { ShellTabName } from './shell-state.ts';

/**
 * Заставка при запуску й екран завантаження модуля в shell — обидва показують
 * сцену нашого будинку (src/house-scene.ts): контур промальовує світна точка,
 * вікна загоряються поверх за поверхом, у дворі машини, на вулиці ліхтарі.
 * Лоадер з'являється лише якщо iframe вантажиться довше за SHOW_DELAY_MS;
 * коли модуль готовий — усі вікна загоряються й екран згасає.
 *
 * Анімація — Web Animations API (без покадрового JS і без SVG-фільтрів).
 * Базові атрибути = фінальний кадр: після cancel() будинок повністю освітлений;
 * так само при reduced motion.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
export const LOADER_CYCLE_MS = HOUSE_CYCLE_MS;
export const LOADER_SHOW_DELAY_MS = 180;
export const LOADER_FINALE_MS = 380;
export const LOADER_FADE_MS = 260;
export const LOADER_SAFETY_MS = 20000;

const CAPTIONS: Record<ShellTabName, string> = { journal: 'Відкриваю журнал', sklad: 'Відкриваю склад' };

export interface ModuleLoader {
    /** Активний модуль вантажиться — показати (із затримкою) будинок. */
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
        svg.setAttribute('class', 'shell-loader-art hs-scene');
        svg.setAttribute('aria-hidden', 'true');
        caption = doc.createElement('p');
        caption.className = 'shell-loader-caption';
        overlay.append(svg, caption);
        deps.host.append(overlay);
        const scene = buildHouseScene(doc, svg, 'shell-loader');
        svg.setAttribute('viewBox', scene.viewBox);
        tracks = scene.tracks;
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
/** Скільки грає заставка: будинок намальований, вікна світяться, відблиск пробіг. */
export const SPLASH_PLAY_MS = HOUSE_COMPLETE_MS;
export const SPLASH_REDUCED_MS = 1200;
export const SPLASH_FADE_MS = 400;

export interface LaunchSplashDeps {
    document: Document;
    window: Window;
    /** `#app-splash` з index.html — фон і назва є з першого кадру, щоб до старту JS не блимав екран PIN; будинок малює JS. */
    root: HTMLElement;
    storage?: Pick<Storage, 'setItem'>;
    setTimeout?: Window['setTimeout'];
    clearTimeout?: Window['clearTimeout'];
}

/* ---------- Назва заставки складається з «цеглинок» ---------- */

/** Скільки горизонтальних «цеглинок» у кожній літері (знизу вгору, як конструктор). */
export const BRICK_SLICES = 3;
export const BRICK_START_MS = 450;
export const BRICK_LETTER_STEP_MS = 65;
export const BRICK_SLICE_STEP_MS = 90;
/** Тривалість падіння однієї цеглинки — має збігатися з `.splash-brick` у styles.css. */
export const BRICK_DROP_MS = 460;
/** Крок хвилі, якою складені кольорові літери стають кольору тексту. */
export const BRICK_SET_STEP_MS = 22;

/**
 * Розбиває назву на слова → літери → цеглинки (та сама літера, обрізана clip-path
 * на смугу). Цеглинки падають згори в акцентному зеленому, клацають на місце, а коли
 * назва складена — хвилею набувають кольору тексту; коли остання встала — назва легенько «клацає» цілком (CSS).
 * Повертає момент, коли складено останню цеглинку (мс від старту).
 * Сама анімація — CSS (@keyframes у styles.css), тут лише затримки й зсуви.
 */
export function buildBrickTitle(doc: Document, title: HTMLElement): number {
    const words = (title.textContent ?? '').split(/\s+/).filter(Boolean);
    title.textContent = '';
    const letters = words.join('').length;
    // Остання цеглинка останньої літери встала → назва «клацає» й хвилею стає кольору тексту.
    const done = BRICK_START_MS + (letters - 1) * BRICK_LETTER_STEP_MS + (BRICK_SLICES - 1) * BRICK_SLICE_STEP_MS + BRICK_DROP_MS;
    let index = 0;
    words.forEach((word, w) => {
        if (w > 0) title.append(' ');
        const wordNode = doc.createElement('span');
        wordNode.className = 'splash-word';
        for (const char of word) {
            const letter = doc.createElement('span');
            letter.className = char === char.toLowerCase() && char !== char.toUpperCase() ? 'splash-letter is-lower' : 'splash-letter';
            for (let slice = 0; slice < BRICK_SLICES; slice += 1) {
                const brick = doc.createElement('span');
                brick.className = `splash-brick splash-brick-${slice}`;
                brick.textContent = char;
                const delay = BRICK_START_MS + index * BRICK_LETTER_STEP_MS + slice * BRICK_SLICE_STEP_MS;
                const side = (index + slice) % 2 ? 1 : -1;
                const shiftX = side * (6 + ((index * 7 + slice * 3) % 9));
                const tilt = side * (3 + ((index + slice) % 3) * 2);
                brick.setAttribute('style', `--d:${delay}ms;--s:${done + index * BRICK_SET_STEP_MS}ms;--bx:${shiftX}px;--br:${tilt}deg`);
                letter.append(brick);
            }
            wordNode.append(letter);
            index += 1;
        }
        title.append(wordNode);
    });
    title.setAttribute('style', `--done:${done}ms`);
    title.classList.add('is-bricks');
    return done;
}

/**
 * Один раз за запуск (sessionStorage) програє сцену будинку поверх усього застосунку,
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
    svg.setAttribute('class', 'app-splash-art hs-scene');
    svg.setAttribute('aria-hidden', 'true');
    root.prepend(svg);
    const scene = buildHouseScene(doc, svg, 'app-splash');
    svg.setAttribute('viewBox', scene.viewBox);
    const title = root.querySelector?.<HTMLElement>('.app-splash-title');
    if (title && !reduced) buildBrickTitle(doc, title);
    root.classList.add('is-playing'); // назва з'являється під уже наявним будинком (цеглинками або CSS-переходом)
    const running: Animation[] = [];
    for (const { node, keyframes } of scene.tracks) {
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
