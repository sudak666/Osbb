import { appendPhoto, buildPhotoCache, photoIdFromInsertResponse, photoStoragePathFromPublicUrl, photoUploadPath, photosFor, removePhoto, type PhotoCache } from './osbb-photos.ts';

export type PhotoStatus = 'preview' | 'uploading' | 'uploaded' | 'deleted' | 'bad_pin' | 'error';
export interface OsbbPhotoControllerDeps {
    isPreview: boolean;
    getMonthKey: () => string;
    loadRows: (monthKey: string) => Promise<unknown>;
    compress: (file: File) => Promise<Blob>;
    upload: (path: string, blob: Blob) => Promise<void>;
    publicUrl: (path: string) => string;
    insertRow: (row: { month_key: string; day: number; role: string; url: string }) => Promise<unknown>;
    verifyDelete: (id: string | number, pin: string) => Promise<unknown>;
    removeObject: (path: string) => Promise<void>;
    requestDeletePin: (callback: (pin: string) => Promise<void>) => void;
    onCacheChanged: (cache: PhotoCache, day?: number, role?: string) => void;
    onStatus: (status: PhotoStatus, error?: unknown) => void;
    now?: () => number;
}
export interface OsbbPhotoController {
    load(): Promise<void>;
    get(day: string | number, role: string): PhotoCache[string];
    upload(day: number, role: string, file: File | null | undefined): Promise<void>;
    remove(id: string | number, url: string, day: number, role: string): void;
}

export function createOsbbPhotoController(deps: OsbbPhotoControllerDeps): OsbbPhotoController {
    const now = deps.now ?? Date.now;
    let cache: PhotoCache = {};
    let loadId = 0;
    const publish = (day?: number, role?: string): void => deps.onCacheChanged(cache, day, role);

    async function load(): Promise<void> {
        const requestId = ++loadId;
        if (deps.isPreview) { cache = {}; publish(); return; }
        try {
            const rows = await deps.loadRows(deps.getMonthKey());
            if (requestId !== loadId) return;
            cache = buildPhotoCache(rows);
        } catch { if (requestId === loadId) cache = {}; }
        if (requestId === loadId) publish();
    }
    const get = (day: string | number, role: string): PhotoCache[string] => photosFor(cache, day, role);

    async function upload(day: number, role: string, file: File | null | undefined): Promise<void> {
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

    function remove(id: string | number, url: string, day: number, role: string): void {
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
