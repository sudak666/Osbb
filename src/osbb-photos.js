import { safeExternalUrl } from './app-security.js';

const PHOTO_ROLES = new Set(['dispatcher']);

function validPhotoId(value) {
    return typeof value === 'number' && Number.isFinite(value)
        || typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

function validPhotoCoordinates(day, role) {
    const numericDay = Number(day);
    return Number.isInteger(numericDay) && numericDay >= 1 && numericDay <= 31
        && typeof role === 'string' && PHOTO_ROLES.has(role);
}

export function photoIdFromInsertResponse(value, fallback) {
    if (!Array.isArray(value) || value.length === 0) return fallback;
    const row = value[0];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return fallback;
    const id = row.id;
    return validPhotoId(id) ? id : fallback;
}

export function photoUploadPath(monthKey, day, role, timestamp) {
    if (!/^\d{4}-\d{1,2}$/.test(monthKey) || !validPhotoCoordinates(day, role) || !Number.isFinite(timestamp)) return null;
    return `osbb-duty/${monthKey}/${Number(day)}-${role}-${Math.trunc(timestamp)}.jpg`;
}

export function photoStoragePathFromPublicUrl(value) {
    const url = safeExternalUrl(value);
    if (!url) return null;
    try {
        const marker = '/storage/v1/object/public/photos/';
        const parsed = new URL(url);
        const index = parsed.pathname.indexOf(marker);
        if (index < 0) return null;
        const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
        return path && !path.split('/').some(segment => segment === '..') ? path : null;
    } catch { return null; }
}

export function photoCacheKey(day, role) {
    return `${day}-${role}`;
}

export function buildPhotoCache(records) {
    const cache = {};
    if (!Array.isArray(records)) return cache;
    for (const photo of records) {
        if (typeof photo !== 'object' || photo === null || Array.isArray(photo)) continue;
        if (!validPhotoId(photo.id) || !validPhotoCoordinates(photo.day, photo.role)) continue;
        const url = safeExternalUrl(photo.url);
        if (!url) continue;
        const key = photoCacheKey(Number(photo.day), photo.role);
        (cache[key] ||= []).push({ id: photo.id, url });
    }
    return cache;
}

export function appendPhoto(cache, day, role, photo) {
    if (!validPhotoCoordinates(day, role) || !photo || !validPhotoId(photo.id)) return cache || {};
    const url = safeExternalUrl(photo.url);
    if (!url) return cache || {};
    const current = cache || {};
    const key = photoCacheKey(Number(day), role);
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
