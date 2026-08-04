import { safeExternalUrl } from './app-security.js';

export function photoCacheKey(day, role) {
    return `${day}-${role}`;
}

export function buildPhotoCache(records) {
    const cache = {};
    if (!Array.isArray(records)) return cache;
    for (const photo of records) {
        if (typeof photo !== 'object' || photo === null || Array.isArray(photo)) continue;
        if (!(typeof photo.id === 'string' || typeof photo.id === 'number' && Number.isFinite(photo.id))) continue;
        if (photo.day === null || photo.day === undefined || !photo.role) continue;
        if (typeof photo.day !== 'string' && typeof photo.day !== 'number' || typeof photo.role !== 'string') continue;
        const url = safeExternalUrl(photo.url);
        if (!url) continue;
        const key = photoCacheKey(photo.day, photo.role);
        (cache[key] ||= []).push({ id: photo.id, url });
    }
    return cache;
}

export function appendPhoto(cache, day, role, photo) {
    const url = safeExternalUrl(photo.url);
    if (!url) return cache || {};
    const current = cache || {};
    const key = photoCacheKey(day, role);
    return { ...current, [key]: [...(current[key] || []), { id: photo.id, url }] };
}

export function removePhoto(cache, day, role, id) {
    if (!cache) return {};
    const key = photoCacheKey(day, role);
    return { ...cache, [key]: (cache[key] || []).filter((photo) => String(photo.id) !== String(id)) };
}

export function photosFor(cache, day, role) {
    return cache?.[photoCacheKey(day, role)] || [];
}

export function createLightboxState(cache, requestedUrl) {
    const requested = safeExternalUrl(requestedUrl);
    if (!requested) return null;
    const photos = Object.values(cache || {}).flatMap((group) => group.map((photo) => safeExternalUrl(photo.url)).filter(Boolean));
    const index = photos.indexOf(requested);
    return index >= 0 ? { photos, index } : { photos: [requested], index: 0 };
}

export function moveLightbox(state, offset) {
    if (!state.photos.length) return { photos: [], index: 0 };
    return { photos: state.photos, index: (state.index + offset + state.photos.length) % state.photos.length };
}
