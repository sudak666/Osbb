export function createOsbbRuntimeState() {
    return {
        staffLoginList: [],
        garbage: {},
        attendance: {},
        dispatcher: {},
        shiftRows: {},
        photosCache: null,
        lightboxPhotos: [],
        jiraIssues: [],
        elevatorData: [],
    };
}

function optionalString(value, maxLength) {
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    return text && text.length <= maxLength ? text : undefined;
}

export function jiraIssuesFromResponse(value) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const key = optionalString(entry.key, 100);
        const summary = optionalString(entry.summary, 1000);
        if (!key || !summary) return [];
        return [{
            key,
            summary,
            priority: optionalString(entry.priority, 100),
            status: optionalString(entry.status, 100),
            category: optionalString(entry.category, 200),
            assignedRole: ['plumber', 'janitor', 'electrician'].includes(entry.assignedRole) ? entry.assignedRole : undefined,
            url: optionalString(entry.url, 2000),
        }];
    });
}
