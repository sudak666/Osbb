import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbLightboxController } from '../src/osbb-lightbox-controller.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}
class FakeElement {
  constructor(id) { this.id = id; this.src = ''; this.classList = new FakeClassList(); this.listeners = {}; this.focused = false; this.offsetParent = {}; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  querySelectorAll() { return []; }
  focus() { this.focused = true; }
}
class FakeDocument {
  constructor() { this.elements = new Map(); this.listeners = {}; this.activeElement = null; }
  add(id) { const element = new FakeElement(id); this.elements.set(id, element); return element; }
  getElementById(id) { return this.elements.get(id) ?? null; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  contains(element) { return [...this.elements.values()].includes(element); }
}

function makeController() {
  const document = new FakeDocument();
  const lightbox = document.add('lightbox');
  const image = document.add('lightbox-img');
  const opener = document.add('opener');
  document.activeElement = opener;
  const controller = createOsbbLightboxController({
    document,
    getPhotoCache: () => ({ '1-dispatcher': [{ id: 1, url: 'https://example.com/1.jpg' }, { id: 2, url: 'https://example.com/2.jpg' }] }),
    requestAnimationFrame: callback => { callback(0); return 1; },
  });
  controller.bind();
  return { controller, document, lightbox, image, opener };
}

test('lightbox opens safe cached photo and restores focus', () => {
  const { controller, lightbox, image, opener } = makeController();
  controller.open('https://example.com/1.jpg');
  assert.equal(lightbox.classList.contains('open'), true);
  assert.equal(image.src, 'https://example.com/1.jpg');
  controller.close();
  assert.equal(lightbox.classList.contains('open'), false);
  assert.equal(opener.focused, true);
});

test('lightbox navigation wraps in both directions', () => {
  const { controller, image } = makeController();
  controller.open('https://example.com/1.jpg');
  controller.previous();
  assert.equal(image.src, 'https://example.com/2.jpg');
  controller.next();
  assert.equal(image.src, 'https://example.com/1.jpg');
});

test('lightbox keyboard and swipe gestures control active view', () => {
  const { controller, document, lightbox, image } = makeController();
  controller.open('https://example.com/1.jpg');
  document.listeners.keydown({ key: 'ArrowRight' });
  assert.equal(image.src, 'https://example.com/2.jpg');
  lightbox.listeners.touchstart({ touches: [{ clientX: 100, clientY: 10 }] });
  lightbox.listeners.touchend({ changedTouches: [{ clientX: 20, clientY: 15 }] });
  assert.equal(image.src, 'https://example.com/1.jpg');
  document.listeners.keydown({ key: 'Escape' });
  assert.equal(lightbox.classList.contains('open'), false);
});

test('lightbox rejects URLs absent from normalized cache', () => {
  const { controller, lightbox, image } = makeController();
  controller.open('javascript:alert(1)');
  assert.equal(lightbox.classList.contains('open'), false);
  assert.equal(image.src, '');
});
