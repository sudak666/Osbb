import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendPhoto,
  buildPhotoCache,
  createLightboxState,
  moveLightbox,
  photoIdFromInsertResponse,
  photosFor,
  removePhoto,
} from '../src/osbb-photos.js';

test('photoIdFromInsertResponse приймає лише валідний ID вставленого фото', () => {
  assert.equal(photoIdFromInsertResponse([{ id: 42 }], 100), 42);
  assert.equal(photoIdFromInsertResponse([{ id: 'photo-id' }], 100), 'photo-id');
  assert.equal(photoIdFromInsertResponse([{ id: Number.NaN }], 100), 100);
  assert.equal(photoIdFromInsertResponse([{ id: '' }], 100), 100);
  assert.equal(photoIdFromInsertResponse(null, 100), 100);
});

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

test('photo boundary rejects prototype keys, unknown roles and attribute IDs', () => {
  assert.deepEqual(buildPhotoCache([
    { id: '\" onclick=alert(1)', url: 'https://example.com/bad.jpg', day: 1, role: 'dispatcher' },
    { id: 'prototype', url: 'https://example.com/bad.jpg', day: 1, role: '__proto__' },
    { id: 'day', url: 'https://example.com/bad.jpg', day: 32, role: 'dispatcher' },
    { id: 'safe_id', url: 'https://example.com/good.jpg', day: '2', role: 'dispatcher' },
  ]), { '2-dispatcher': [{ id: 'safe_id', url: 'https://example.com/good.jpg' }] });
  assert.equal(photoIdFromInsertResponse([{ id: '\" onfocus=alert(1)' }], 100), 100);
  assert.deepEqual(appendPhoto({}, 1, '__proto__', { id: 'safe', url: 'https://example.com/x.jpg' }), {});
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
