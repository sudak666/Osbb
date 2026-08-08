import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkladPhotoController } from '../src/sklad-photo-controller.js';

function element() {
  return { textContent: '', innerHTML: '', value: '', src: '', style: {}, classList: { values: new Set(), add(v) { this.values.add(v); }, remove(v) { this.values.delete(v); } }, focus() {} };
}
function setup(item) {
  const elements = new Map(['photoItemName','photoStatus','photoFileI','photoCurrent','delPhotoBtn','lbImg','lbDelBtn','lightbox'].map(id => [id, element()]));
  let modal = null;
  const document = { activeElement: null, getElementById: id => elements.get(id), contains: () => false };
  const controller = createSkladPhotoController({ db: {}, document, window: { requestAnimationFrame: fn => fn() }, getItem: () => item, loadItems: async () => {}, openModal: id => { modal = id; }, closeModal() {}, requestDeletePin() {}, toast() {} });
  return { controller, elements, modal: () => modal };
}

test('photo controller renders a safe item preview and opens its modal', () => {
  const { controller, elements, modal } = setup({ id: 4, name: '<Кабель>', photo_url: 'https://example.com/photo.jpg' });
  controller.open(4);
  assert.equal(modal(), 'photoModal');
  assert.match(elements.get('photoCurrent').innerHTML, /https:\/\/example\.com\/photo\.jpg/);
  assert.match(elements.get('photoCurrent').innerHTML, /&lt;Кабель&gt;/);
  assert.equal(elements.get('delPhotoBtn').style.display, 'inline-flex');
});

test('photo controller rejects unsafe lightbox URLs', () => {
  const { controller, elements } = setup({ id: 4, name: 'Кабель', photo_url: null });
  controller.openLightbox('javascript:alert(1)', 4);
  assert.equal(elements.get('lightbox').classList.values.has('open'), false);
  controller.openLightbox('https://example.com/photo.jpg', 4);
  assert.equal(elements.get('lightbox').classList.values.has('open'), true);
  assert.equal(elements.get('lbImg').src, 'https://example.com/photo.jpg');
});
