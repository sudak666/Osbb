const HTML_ENTITIES: Readonly<Record<string, string>> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character] ?? character);
}

export function escapeAttr(value: unknown): string {
    return escapeHtml(value);
}

export function safeExternalUrl(value: unknown, baseUrl?: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    try {
        const fallbackBase = baseUrl || globalThis.location?.href;
        const url = fallbackBase ? new URL(raw, fallbackBase) : new URL(raw);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
        return escapeHtml(url.href);
    } catch {
        return '';
    }
}
