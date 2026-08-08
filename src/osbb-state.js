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

function optionalString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function jiraIssuesFromResponse(value) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const key = optionalString(entry.key);
        const summary = optionalString(entry.summary);
        if (!key || !summary) return [];
        return [{
            key,
            summary,
            priority: optionalString(entry.priority),
            status: optionalString(entry.status),
            category: optionalString(entry.category),
            assignedRole: optionalString(entry.assignedRole),
            url: optionalString(entry.url),
        }];
    });
}
