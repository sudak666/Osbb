const HTML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character] ?? character);
}

export function safeExternalUrl(value, baseUrl) {
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
