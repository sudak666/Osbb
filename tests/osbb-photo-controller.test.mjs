import test from 'node:test';
import assert from 'node:assert/strict';
import { createOsbbPhotoController } from '../src/osbb-photo-controller.js';

function makeController(overrides = {}) {
  const statuses = [], changes = [], uploads = [], inserts = [], removed = [];
  let deleteCallback;
  const controller = createOsbbPhotoController({
    isPreview: false, getMonthKey: () => '2026-7', now: () => 1234,
    loadRows: async () => [{ id: 1, url: 'https://example.com/1.jpg', day: 5, role: 'dispatcher' }],
    compress: async file => file, upload: async (...args) => uploads.push(args),
    publicUrl: path => `https://project.supabase.co/storage/v1/object/public/photos/${path}`,
    insertRow: async row => { inserts.push(row); return [{ id: 2 }]; },
    verifyDelete: async () => true, removeObject: async path => removed.push(path),
    requestDeletePin: callback => { deleteCallback = callback; },
    onCacheChanged: (...args) => changes.push(args), onStatus: (...args) => statuses.push(args),
    ...overrides,
  });
  return { controller, statuses, changes, uploads, inserts, removed, deletePin: pin => deleteCallback(pin) };
}

test('photo controller loads normalized cache', async () => {
  const { controller, changes } = makeController();
  await controller.load();
  assert.deepEqual(controller.get(5, 'dispatcher'), [{ id: 1, url: 'https://example.com/1.jpg' }]);
  assert.equal(changes.length, 1);
});

test('photo controller uploads compressed photo and publishes inserted id', async () => {
  const { controller, statuses, uploads, inserts } = makeController();
  await controller.upload(5, 'dispatcher', new Blob(['x']));
  assert.equal(uploads[0][0], 'osbb-duty/2026-7/5-dispatcher-1234.jpg');
  assert.equal(inserts[0].day, 5);
  assert.deepEqual(controller.get(5, 'dispatcher').map(photo => photo.id), [2]);
  assert.deepEqual(statuses.map(item => item[0]), ['uploading', 'uploaded']);
});

test('photo controller deletes database row before scoped storage object', async () => {
  const { controller, statuses, removed, deletePin } = makeController();
  await controller.load();
  controller.remove(1, 'https://project.supabase.co/storage/v1/object/public/photos/osbb-duty/2026-7/1.jpg', 5, 'dispatcher');
  await deletePin('1234');
  assert.deepEqual(removed, ['osbb-duty/2026-7/1.jpg']);
  assert.deepEqual(controller.get(5, 'dispatcher'), []);
  assert.equal(statuses.at(-1)[0], 'deleted');
});
