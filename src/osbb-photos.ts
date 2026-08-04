import { safeExternalUrl } from './app-security.ts';

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

export function photoIdFromInsertResponse(value: unknown, fallback: string | number): string | number {
    if (!Array.isArray(value) || value.length === 0) return fallback;
    const row = value[0];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return fallback;
    const id = (row as Record<string, unknown>).id;
    if (typeof id === 'string' && id.trim()) return id;
    return typeof id === 'number' && Number.isFinite(id) ? id : fallback;
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

export function appendPhoto(
    cache: PhotoCache | null,
    day: string | number,
    role: string,
    photo: Pick<PhotoRecord, 'id' | 'url'>,
): PhotoCache {
    const url = safeExternalUrl(photo.url);
    if (!url) return cache || {};
    const current = cache || {};
    const key = photoCacheKey(day, role);
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
