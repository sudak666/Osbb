import { appendPhoto, buildPhotoCache, photoIdFromInsertResponse, photoStoragePathFromPublicUrl, photoUploadPath, photosFor, removePhoto } from './osbb-photos.js';

export function createOsbbPhotoController(deps) {
    const now = deps.now ?? Date.now;
    let cache = {};
    let loadId = 0;
    const publish = (day, role) => deps.onCacheChanged(cache, day, role);
    async function load() {
        const requestId = ++loadId;
        if (deps.isPreview) { cache = {}; publish(); return; }
        try {
            const rows = await deps.loadRows(deps.getMonthKey());
            if (requestId !== loadId) return;
            cache = buildPhotoCache(rows);
        } catch { if (requestId === loadId) cache = {}; }
        if (requestId === loadId) publish();
    }
    const get = (day, role) => photosFor(cache, day, role);
    async function upload(day, role, file) {
        if (!file) return;
        if (deps.isPreview) { deps.onStatus('preview'); return; }
        const timestamp = now();
        const monthKey = deps.getMonthKey();
        const path = photoUploadPath(monthKey, day, role, timestamp);
        if (!path) { deps.onStatus('error', new Error('invalid_photo_path')); return; }
        deps.onStatus('uploading');
        try {
            const blob = await deps.compress(file);
            await deps.upload(path, blob);
            const url = deps.publicUrl(path);
            const inserted = await deps.insertRow({ month_key: monthKey, day, role, url });
            cache = appendPhoto(cache, day, role, { id: photoIdFromInsertResponse(inserted, timestamp), url });
            publish(day, role);
            deps.onStatus('uploaded');
        } catch (error) { deps.onStatus('error', error); }
    }
    function remove(id, url, day, role) {
        if (deps.isPreview) { deps.onStatus('preview'); return; }
        deps.requestDeletePin(async pin => {
            try {
                if (await deps.verifyDelete(id, pin) !== true) { deps.onStatus('bad_pin'); return; }
                const path = photoStoragePathFromPublicUrl(url);
                if (path) await deps.removeObject(path);
                cache = removePhoto(cache, day, role, id);
                publish(day, role);
                deps.onStatus('deleted');
            } catch (error) { deps.onStatus('error', error); }
        });
    }
    return { load, get, upload, remove };
}
