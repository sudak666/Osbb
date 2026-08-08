import { escapeHtml, safeExternalUrl } from './app-security.js';

export function createSkladPhotoController(options) {
  const { db, document, window, getItem, loadItems, openModal, closeModal, requestDeletePin, toast } = options;
  let photoItemId = null;
  let lightboxItemId = null;
  let focusReturn = null;
  function open(id) {
    const item = getItem(id, 'фото');
    if (!item) return;
    photoItemId = id;
    document.getElementById('photoItemName').textContent = item.name;
    document.getElementById('photoStatus').textContent = '';
    document.getElementById('photoFileI').value = '';
    const current = document.getElementById('photoCurrent');
    const deleteButton = document.getElementById('delPhotoBtn');
    const photo = item.photo_url ? safeExternalUrl(item.photo_url) : '';
    if (photo) {
      current.innerHTML = `<img src="${photo}" loading="lazy" alt="Фото товару ${escapeHtml(item.name || '')}" class="photo-current-img" data-photo-current-lightbox data-item-id="${item.id}" data-photo-url="${photo}">`;
      deleteButton.style.display = 'inline-flex';
    } else {
      current.innerHTML = '<div class="photo-empty-state">Фото ще не додано</div>';
      deleteButton.style.display = 'none';
    }
    openModal('photoModal');
  }
  async function upload() {
    const file = document.getElementById('photoFileI').files[0];
    if (!file || !photoItemId) return;
    const status = document.getElementById('photoStatus');
    status.textContent = 'Завантаження...';
    const canvas = document.createElement('canvas');
    const image = new window.Image();
    image.onload = async () => {
      const max = 800; let width = image.width; let height = image.height;
      if (width > max) { height = Math.round(height * max / width); width = max; }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(image, 0, 0, width, height);
      canvas.toBlob(async blob => {
        const path = `items/${photoItemId}_${Date.now()}.jpg`;
        const { error: uploadError } = await db.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) {
          status.innerHTML = /bucket/i.test(uploadError.message)
            ? '<span class="ms ic-15-3">cancel</span> Сховище фото не налаштовано.<br><small>Потрібно створити Storage bucket "photos" (Public) в Supabase Dashboard.</small>'
            : 'Помилка: ' + escapeHtml(uploadError.message);
          return;
        }
        const { data: { publicUrl } } = db.storage.from('photos').getPublicUrl(path);
        const { error } = await db.from('inventory_items').update({ photo_url: publicUrl }).eq('id', photoItemId);
        if (error) { status.textContent = 'Помилка: ' + error.message; return; }
        status.innerHTML = '<span class="ms ic-14-2">check_circle</span> Збережено!';
        await loadItems(); open(photoItemId);
      }, 'image/jpeg', .82);
    };
    image.src = window.URL.createObjectURL(file);
  }
  async function remove() {
    if (!photoItemId) return;
    requestDeletePin('PIN для видалення фото', async pin => {
      const { data: valid, error: pinError } = await db.rpc('verify_pin', { attempt: pin });
      if (pinError) return { ok: false, reason: 'network' };
      if (valid !== true) return { ok: false, reason: 'bad_pin' };
      const { error } = await db.from('inventory_items').update({ photo_url: null }).eq('id', photoItemId);
      if (error) { toast('Помилка: ' + error.message, 'error'); return { ok: false, reason: 'network' }; }
      toast('Фото видалено', 'info'); closeModal('photoModal'); await loadItems();
      return { ok: true };
    });
  }
  function openLightbox(url, itemId = null) {
    const safeUrl = safeExternalUrl(url);
    if (!safeUrl) return;
    lightboxItemId = itemId || photoItemId || null;
    focusReturn = document.activeElement;
    document.getElementById('lbImg').src = safeUrl;
    const deleteButton = document.getElementById('lbDelBtn');
    deleteButton.style.display = lightboxItemId ? 'inline-flex' : 'none';
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.add('open');
    window.requestAnimationFrame(() => (deleteButton.style.display === 'none' ? lightbox : deleteButton).focus({ preventScroll: true }));
  }
  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
    lightboxItemId = null;
    const opener = focusReturn; focusReturn = null;
    if (opener && document.contains(opener) && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
  }
  async function removeFromLightbox(event) {
    event.stopPropagation();
    if (!lightboxItemId) return;
    photoItemId = lightboxItemId;
    closeLightbox();
    await remove();
  }
  return { closeLightbox, open, openLightbox, remove, removeFromLightbox, upload };
}
