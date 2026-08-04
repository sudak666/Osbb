import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendPhoto,
  buildPhotoCache,
  createLightboxState,
  moveLightbox,
  photosFor,
  removePhoto,
} from '../src/osbb-photos.js';

const records = [
  { id: 1, url: 'https://example.com/one.jpg', day: 3, role: 'dispatcher' },
  { id: 2, url: 'javascript:alert(1)', day: 3, role: 'dispatcher' },
  { id: 3, url: 'https://example.com/two.jpg', day: 4, role: 'dispatcher' },
  { id: 4, url: 'https://example.com/no-role.jpg', day: 4, role: null },
];

test('buildPhotoCache групує лише валідні фото', () => {
  const cache = buildPhotoCache(records);
  assert.deepEqual(photosFor(cache, 3, 'dispatcher'), [{ id: 1, url: 'https://example.com/one.jpg' }]);
  assert.deepEqual(photosFor(cache, 4, 'dispatcher'), [{ id: 3, url: 'https://example.com/two.jpg' }]);
});

test('buildPhotoCache безпечно обробляє malformed-відповідь transport', () => {
  assert.deepEqual(buildPhotoCache(null), {});
  assert.deepEqual(buildPhotoCache([
    null,
    { id: Number.NaN, url: 'https://example.com/bad.jpg', day: 1, role: 'dispatcher' },
    { id: 5, url: 'https://example.com/good.jpg', day: 1, role: 'dispatcher' },
  ]), { '1-dispatcher': [{ id: 5, url: 'https://example.com/good.jpg' }] });
});

test('appendPhoto та removePhoto оновлюють кеш без мутації', () => {
  const original = buildPhotoCache(records);
  const appended = appendPhoto(original, 3, 'dispatcher', { id: 5, url: 'https://example.com/three.jpg' });
  const removed = removePhoto(appended, 3, 'dispatcher', '1');
  assert.equal(photosFor(original, 3, 'dispatcher').length, 1);
  assert.deepEqual(photosFor(removed, 3, 'dispatcher'), [{ id: 5, url: 'https://example.com/three.jpg' }]);
});

test('lightbox state відхиляє небезпечні URL і циклічно перемикає фото', () => {
  const cache = buildPhotoCache(records);
  assert.equal(createLightboxState(cache, 'javascript:alert(1)'), null);
  const initial = createLightboxState(cache, 'https://example.com/one.jpg');
  assert.deepEqual(initial, {
    photos: ['https://example.com/one.jpg', 'https://example.com/two.jpg'],
    index: 0,
  });
  assert.equal(moveLightbox(initial, -1).index, 1);
  assert.equal(moveLightbox({ ...initial, index: 1 }, 1).index, 0);
});
