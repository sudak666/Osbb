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

test('photo removal clears the row and asks the server to clean up orphaned files', async () => {
  const elements = new Map(['photoItemName','photoStatus','photoFileI','photoCurrent','delPhotoBtn','lbImg','lbDelBtn','lightbox'].map(id => [id, element()]));
  let pinAction = null;
  let cleanups = 0;
  const updates = [];
  const db = {
    rpc: async () => ({ data: true, error: null }),
    from: () => ({ update: patch => ({ eq: async () => { updates.push(patch); return { error: null }; } }) }),
  };
  const controller = createSkladPhotoController({
    db, document: { activeElement: null, getElementById: id => elements.get(id), contains: () => false },
    window: { requestAnimationFrame: fn => fn() }, getItem: () => ({ id: 4, name: 'Кабель', photo_url: 'https://x/storage/v1/object/public/photos/items/4_1.jpg' }),
    loadItems: async () => {}, openModal() {}, closeModal() {}, requestDeletePin: (_title, action) => { pinAction = action; }, toast() {},
    cleanupPhotos: () => { cleanups++; },
  });
  controller.open(4);
  await controller.remove();
  assert.deepEqual(await pinAction('1234'), { ok: true });
  assert.deepEqual(updates, [{ photo_url: null }]);
  assert.equal(cleanups, 1);
});

test('switching photo dialogs during upload never changes its target item', async () => {
  const elements=new Map(); const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
  let release; const gate=new Promise(resolve=>{release=resolve});let image;let saving;const updates=[];
  const db={storage:{from:()=>({upload:async()=>{await gate;return {error:null}},getPublicUrl:path=>({data:{publicUrl:'https://example.test/'+path}})})},from:()=>({update:patch=>({eq:async(_,id)=>{updates.push({id,patch});return {error:null}}})})};
  const controller=createSkladPhotoController({db,document:{getElementById:get,createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:cb=>{saving=cb({})}})},
    window:{Image:class{constructor(){image=this;this.width=20;this.height=20}},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}}},getItem:id=>({id,name:'Item '+id}),loadItems:async()=>{},openModal(){},closeModal(){},requestDeletePin(){},toast(){},cleanupPhotos(){}});
  controller.open(1);get('photoFileI').files=[{}];await controller.upload();await image.onload();
  controller.open(2);release();await saving;
  assert.equal(updates[0].id,1);assert.match(updates[0].patch.photo_url,/items\/1_/);
  assert.equal(get('photoItemName').textContent,'Item 2');
});
