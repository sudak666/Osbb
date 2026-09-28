import { escapeHtml, safeExternalUrl } from './app-security.js';
import { requestPhotoCleanup } from './supabase-api.js';
void escapeHtml; void safeExternalUrl; void requestPhotoCleanup;
export declare function createSkladPhotoController(options: Record<string, unknown>): {
  closeLightbox(): void; open(id: number): void; openLightbox(url: string, itemId?: number | null): void;
  remove(): Promise<void>; removeFromLightbox(event: Event): Promise<void>; upload(): Promise<void>;
};
