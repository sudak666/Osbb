import { safeExternalUrl } from './app-security.ts';

const PHOTO_ROLES = new Set(['dispatcher']);

function validPhotoId(value: unknown): value is string | number {
    return typeof value === 'number' && Number.isFinite(value)
        || typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

function validPhotoCoordinates(day: unknown, role: unknown): role is string {
    const numericDay = Number(day);
    return Number.isInteger(numericDay) && numericDay >= 1 && numericDay <= 31
        && typeof role === 'string' && PHOTO_ROLES.has(role);
}

export interface PhotoRecord {
    id: string | number;
    url: string;
    day?: string | number | null;
    role?: string | null;
}

export type PhotoCache = Record<string, Array<Pick<PhotoRecord, 'id' | 'url'>>>;

export interface LightboxState {
    photos: string[];
    index: number;
}

export function photoUploadPath(monthKey: string, day: string | number, role: string, timestamp: number): string | null {
    if (!/^\d{4}-\d{1,2}$/.test(monthKey) || !validPhotoCoordinates(day, role) || !Number.isFinite(timestamp)) return null;
    return `osbb-duty/${monthKey}/${Number(day)}-${role}-${Math.trunc(timestamp)}.jpg`;
}

export function photoStoragePathFromPublicUrl(value: unknown): string | null {
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

export function photoIdFromInsertResponse(value: unknown, fallback: string | number): string | number {
    if (!Array.isArray(value) || value.length === 0) return fallback;
    const row = value[0];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return fallback;
    const id = (row as Record<string, unknown>).id;
    return validPhotoId(id) ? id : fallback;
}

export function photoCacheKey(day: string | number, role: string): string {
    return `${day}-${role}`;
}

export function buildPhotoCache(records: unknown): PhotoCache {
    const cache: PhotoCache = {};
    if (!Array.isArray(records)) return cache;
    for (const value of records) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
        const photo = value as Record<string, unknown>;
        if (!validPhotoId(photo.id) || !validPhotoCoordinates(photo.day, photo.role)) continue;
        const url = safeExternalUrl(photo.url);
        if (!url) continue;
        const key = photoCacheKey(Number(photo.day), photo.role);
        (cache[key] ||= []).push({ id: photo.id, url });
    }
    return cache;
}

export function appendPhoto(
    cache: PhotoCache | null,
    day: string | number,
    role: string,
    photo: Pick<PhotoRecord, 'id' | 'url'>,
): PhotoCache {
    if (!validPhotoCoordinates(day, role) || !photo || !validPhotoId(photo.id)) return cache || {};
    const url = safeExternalUrl(photo.url);
    if (!url) return cache || {};
    const current = cache || {};
    const key = photoCacheKey(Number(day), role);
    return { ...current, [key]: [...(current[key] || []), { id: photo.id, url }] };
}

export function removePhoto(cache: PhotoCache | null, day: string | number, role: string, id: unknown): PhotoCache {
    if (!cache) return {};
    const key = photoCacheKey(day, role);
    return { ...cache, [key]: (cache[key] || []).filter((photo) => String(photo.id) !== String(id)) };
}

export function photosFor(cache: PhotoCache | null, day: string | number, role: string): PhotoCache[string] {
    return cache?.[photoCacheKey(day, role)] || [];
}

export function createLightboxState(cache: PhotoCache | null, requestedUrl: unknown): LightboxState | null {
    const requested = safeExternalUrl(requestedUrl);
    if (!requested) return null;
    const photos = Object.values(cache || {}).flatMap((group) => group.map((photo) => safeExternalUrl(photo.url)).filter(Boolean));
    const index = photos.indexOf(requested);
    return index >= 0 ? { photos, index } : { photos: [requested], index: 0 };
}

export function moveLightbox(state: LightboxState, offset: -1 | 1): LightboxState {
    if (!state.photos.length) return { photos: [], index: 0 };
    return {
        photos: state.photos,
        index: (state.index + offset + state.photos.length) % state.photos.length,
    };
}
