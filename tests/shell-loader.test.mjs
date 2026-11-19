import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createModuleLoader, LOADER_FADE_MS, LOADER_FINALE_MS, LOADER_SAFETY_MS, LOADER_SHOW_DELAY_MS, playLaunchSplash, pointAlong, polylineLength,
  SPLASH_FADE_MS, SPLASH_PLAY_MS, SPLASH_REDUCED_MS, SPLASH_STORAGE_KEY,
} from '../src/shell-loader.js';

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
  const doc = { createElementNS: (_ns, tag) => { const node = new FakeNode(tag); all.push(node); return node; } };
  const root = new FakeNode('div');
  root.hidden = hidden;
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
  return { root, fire, timers, stored, animations };
}

test('launch splash plays the tower once, then fades out and remembers this launch', () => {
  const { root, fire, stored, animations } = makeSplash();
  assert.equal(stored.get(SPLASH_STORAGE_KEY), '1');
  assert.equal(root.classList.contains('is-playing'), true, 'title appears only once the tower exists');
  assert.equal(root.children[0].tag, 'svg');
  assert.ok(animations().length > 50);
  assert.ok(animations().every((animation) => animation.options.iterations === 1));
  fire(SPLASH_PLAY_MS);
  assert.ok(animations().every((animation) => animation.cancelled), 'final frame: fully lit tower');
  assert.equal(root.classList.contains('is-leaving'), true);
  fire(SPLASH_FADE_MS);
  assert.equal(root.hidden, true);
  assert.equal(root.children.length, 0, 'tower SVG is removed after the splash');
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
  const { root, fire, animations } = makeSplash({ reduced: true });
  assert.equal(animations().length, 0);
  fire(SPLASH_REDUCED_MS);
  fire(SPLASH_FADE_MS);
  assert.equal(root.hidden, true);
});
