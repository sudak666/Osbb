import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BRICK_DROP_MS, BRICK_SLICES, BRICK_SLICE_STEP_MS, BRICK_START_MS, buildBrickTitle, createModuleLoader, LOADER_FADE_MS, LOADER_FINALE_MS, LOADER_SAFETY_MS, LOADER_SHOW_DELAY_MS, playLaunchSplash,
  SPLASH_FADE_MS, SPLASH_PLAY_MS, SPLASH_REDUCED_MS, SPLASH_STORAGE_KEY,
} from '../src/shell-loader.js';
import { buildHouseScene, HOUSE_COMPLETE_MS, HOUSE_CYCLE_MS, pointAlong, polylineLength, shadeHex } from '../src/house-scene.js';

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attributes = new Map();
    this.hidden = false;
    this.textContent = '';
    this.className = '';
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    };
    this.animations = [];
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  append(...nodes) { this.children.push(...nodes); }
  prepend(node) { this.children.unshift(node); node.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
  addEventListener(name, handler) { this.listeners = { ...(this.listeners ?? {}), [name]: handler }; }
  animate(keyframes, options) {
    const animation = { keyframes, options, cancelled: false, cancel() { this.cancelled = true; } };
    this.animations.push(animation);
    return animation;
  }
}

function makeLoader({ reduced = false } = {}) {
  const timers = new Map();
  let nextId = 1;
  const all = [];
  const doc = {
    createElement: (tag) => { const node = new FakeNode(tag); all.push(node); return node; },
    createElementNS: (_ns, tag) => { const node = new FakeNode(tag); all.push(node); return node; },
  };
  const host = new FakeNode('div');
  const win = { matchMedia: () => ({ matches: reduced }) };
  const loader = createModuleLoader({
    document: doc, host, window: win,
    setTimeout: (handler, timeout) => { const id = nextId++; timers.set(id, { handler, timeout }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
  });
  const fire = (timeout) => {
    const entry = [...timers.entries()].find(([, timer]) => timer.timeout === timeout);
    assert.ok(entry, `timer ${timeout} is scheduled`);
    timers.delete(entry[0]);
    entry[1].handler();
  };
  const overlay = () => host.children[0];
  const running = () => all.flatMap((node) => node.animations).filter((animation) => !animation.cancelled);
  return { loader, timers, fire, overlay, running };
}

test('polyline helpers measure length and walk along segments', () => {
  const pts = [[0, 0], [3, 0], [3, 4]];
  assert.equal(polylineLength(pts), 7);
  assert.deepEqual(pointAlong(pts, 0), [0, 0]);
  assert.deepEqual(pointAlong(pts, 3 / 7), [3, 0]);
  assert.deepEqual(pointAlong(pts, 1), [3, 4]);
  assert.deepEqual(pointAlong(pts, 5 / 7), [3, 2]);
});

test('house scene draws the five sections, lights every floor and frames the whole yard', () => {
  const nodes = [];
  const doc = { createElementNS: (_ns, tag) => { const node = new FakeNode(tag); nodes.push(node); return node; } };
  const svg = new FakeNode('svg');
  const { tracks, viewBox } = buildHouseScene(doc, svg, 'test');
  const [, , width, height] = viewBox.split(' ').map(Number);
  assert.ok(width > 200 && height > 180, `viewBox ${viewBox}`);
  const lit = nodes.filter((node) => node.attributes.get('class') === 'hs-lit');
  assert.ok(lit.length > 400, `lit windows: ${lit.length}`);
  // Кожен поверх кожної секції загоряється окремо: 23 + 22 + 21 + 22 + 23 груп.
  const floorGroups = tracks.filter(({ node }) => node.children.some((child) => child.attributes.get('class') === 'hs-lit'));
  assert.equal(floorGroups.length, 111);
  assert.ok(nodes.some((node) => node.attributes.get('class') === 'hs-spire'), 'turret spire');
  assert.ok(tracks.every(({ keyframes }) => keyframes[0].offset === 0 && keyframes.at(-1).offset === 1));
  assert.ok(HOUSE_COMPLETE_MS < HOUSE_CYCLE_MS);
  assert.ok(nodes.filter((node) => node.attributes.has('id')).every((node) => node.attributes.get('id').startsWith('test-')));
});

test('shadeHex lightens and darkens car colors without color-mix', () => {
  assert.equal(shadeHex('#808080', 0), '#808080');
  assert.equal(shadeHex('#808080', 100), '#ffffff');
  assert.equal(shadeHex('#808080', -100), '#000000');
  assert.equal(shadeHex('#e05a47', -50), '#702d24');
});

test('module loader appears only after a short delay and skips fast loads', () => {
  const { loader, timers, overlay, running } = makeLoader();
  loader.show('journal');
  assert.equal(overlay().hidden, true);
  loader.hide(true);
  assert.equal(overlay().hidden, true);
  assert.equal([...timers.values()].some((timer) => timer.timeout === LOADER_SHOW_DELAY_MS), false);
  assert.equal(running().length, 0);
});

test('module loader plays the tower, then lights every window and fades out when the module is ready', () => {
  const { loader, fire, overlay, running } = makeLoader();
  loader.show('sklad');
  fire(LOADER_SHOW_DELAY_MS);
  assert.equal(overlay().hidden, false);
  assert.equal(overlay().children[1].textContent, 'Відкриваю склад');
  assert.ok(running().length > 50, 'tower parts are animated');
  assert.ok(running().every((animation) => animation.options.iterations === Infinity));

  loader.hide(true);
  assert.equal(running().length, 0, 'final frame: animations cancelled, base state is fully lit');
  assert.equal(overlay().classList.contains('is-done'), true);
  fire(LOADER_FINALE_MS);
  assert.equal(overlay().classList.contains('is-leaving'), true);
  fire(LOADER_FADE_MS);
  assert.equal(overlay().hidden, true);
});

test('module loader hides at once when the user leaves for another section', () => {
  const { loader, fire, overlay, running } = makeLoader();
  loader.show('journal');
  fire(LOADER_SHOW_DELAY_MS);
  loader.hide(false);
  assert.equal(overlay().hidden, true);
  assert.equal(running().length, 0);
});

test('module loader gives up after the safety timeout', () => {
  const { loader, fire, overlay } = makeLoader();
  loader.show('journal');
  fire(LOADER_SHOW_DELAY_MS);
  fire(LOADER_SAFETY_MS);
  assert.equal(overlay().hidden, true);
});

test('module loader shows a static lit tower when reduced motion is requested', () => {
  const { loader, fire, overlay, running } = makeLoader({ reduced: true });
  loader.show('journal');
  fire(LOADER_SHOW_DELAY_MS);
  assert.equal(overlay().hidden, false);
  assert.equal(running().length, 0);
  loader.hide(true);
  fire(0);
  fire(LOADER_FADE_MS);
  assert.equal(overlay().hidden, true);
});

function makeSplash({ reduced = false, hidden = false } = {}) {
  const timers = new Map();
  let nextId = 1;
  const all = [];
  const make = (tag) => { const node = new FakeNode(tag); all.push(node); return node; };
  const doc = { createElement: make, createElementNS: (_ns, tag) => make(tag) };
  const root = new FakeNode('div');
  root.hidden = hidden;
  const title = new FakeNode('div');
  title.textContent = 'ОСББ "Сл"';
  root.append(title);
  root.querySelector = (selector) => (selector === '.app-splash-title' ? title : null);
  const stored = new Map();
  playLaunchSplash({
    document: doc, root,
    window: { matchMedia: () => ({ matches: reduced }) },
    storage: { setItem: (key, value) => stored.set(key, value) },
    setTimeout: (handler, timeout) => { const id = nextId++; timers.set(id, { handler, timeout }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
  });
  const fire = (timeout) => {
    const entry = [...timers.entries()].find(([, timer]) => timer.timeout === timeout);
    assert.ok(entry, `timer ${timeout} is scheduled`);
    timers.delete(entry[0]);
    entry[1].handler();
  };
  const animations = () => all.flatMap((node) => node.animations);
  return { root, title, fire, timers, stored, animations };
}

test('splash title is built from bricks: every letter in three slices, bottom first, word by word', () => {
  const doc = { createElement: (tag) => new FakeNode(tag) };
  const title = new FakeNode('div');
  title.textContent = 'ОСББ  "Ми"';
  const done = buildBrickTitle(doc, title);
  assert.equal(title.children.length, 3, 'two words with a space between');
  assert.equal(title.children[1], ' ');
  const [first, , second] = title.children;
  assert.equal(first.className, 'splash-word');
  assert.deepEqual(first.children.map((letter) => letter.children[0].textContent), ['О', 'С', 'Б', 'Б']);
  assert.equal(second.children[2].className, 'splash-letter is-lower');
  const bricks = [first, second].flatMap((word) => word.children).flatMap((letter) => letter.children);
  assert.equal(bricks.length, 8 * BRICK_SLICES);
  const delay = (brick) => Number(/--d:(\d+)ms/.exec(brick.attributes.get('style'))[1]);
  assert.equal(delay(bricks[0]), BRICK_START_MS);
  assert.equal(delay(bricks[1]) - delay(bricks[0]), BRICK_SLICE_STEP_MS, 'bottom slice lands before the one above it');
  assert.equal(done, Math.max(...bricks.map(delay)) + BRICK_DROP_MS);
  assert.equal(title.attributes.get('style'), `--done:${done}ms`);
  assert.ok(title.classList.contains('is-bricks'));
  assert.ok(done < SPLASH_PLAY_MS, 'the title is assembled before the splash fades');
});

test('launch splash plays the tower once, then fades out and remembers this launch', () => {
  const { root, title, fire, stored, animations } = makeSplash();
  assert.equal(stored.get(SPLASH_STORAGE_KEY), '1');
  assert.ok(title.classList.contains('is-bricks'), 'title assembles from bricks');
  assert.equal(root.classList.contains('is-playing'), true, 'title appears only once the tower exists');
  assert.equal(root.children[0].tag, 'svg');
  assert.ok(animations().length > 50);
  assert.ok(animations().every((animation) => animation.options.iterations === 1));
  fire(SPLASH_PLAY_MS);
  assert.ok(animations().every((animation) => animation.cancelled), 'final frame: fully lit tower');
  assert.equal(root.classList.contains('is-leaving'), true);
  fire(SPLASH_FADE_MS);
  assert.equal(root.hidden, true);
  assert.equal(root.children.some((child) => child.tag === 'svg'), false, 'house SVG is removed after the splash');
});

test('launch splash can be skipped with a tap', () => {
  const { root, fire, timers } = makeSplash();
  root.listeners.click();
  assert.equal([...timers.values()].some((timer) => timer.timeout === SPLASH_PLAY_MS), false);
  fire(SPLASH_FADE_MS);
  assert.equal(root.hidden, true);
});

test('launch splash does nothing when this launch already saw it', () => {
  const { stored, animations, timers } = makeSplash({ hidden: true });
  assert.equal(stored.size, 0);
  assert.equal(animations().length, 0);
  assert.equal(timers.size, 0);
});

test('launch splash shows a short static tower with reduced motion', () => {
  const { root, title, fire, animations } = makeSplash({ reduced: true });
  assert.equal(animations().length, 0);
  assert.equal(title.classList.contains('is-bricks'), false, 'reduced motion keeps the plain title');
  fire(SPLASH_REDUCED_MS);
  fire(SPLASH_FADE_MS);
  assert.equal(root.hidden, true);
});
