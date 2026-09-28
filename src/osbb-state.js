// Згенеровано з src/osbb-state.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
function createOsbbRuntimeState() {
  return {
    staffLoginList: [],
    garbage: {},
    attendance: {},
    dispatcher: {},
    shiftRows: {},
    photosCache: null,
    lightboxPhotos: [],
    jiraIssues: [],
    elevatorData: []
  };
}
function optionalString(value, maxLength) {
  if (typeof value !== "string") return void 0;
  const text = value.trim();
  return text && text.length <= maxLength ? text : void 0;
}
function jiraIssuesFromResponse(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const row = entry;
    const key = optionalString(row.key, 100);
    const summary = optionalString(row.summary, 1e3);
    if (!key || !summary) return [];
    return [{
      key,
      summary,
      priority: optionalString(row.priority, 100),
      status: optionalString(row.status, 100),
      category: optionalString(row.category, 200),
      assignedRole: row.assignedRole === "plumber" || row.assignedRole === "janitor" || row.assignedRole === "electrician" ? row.assignedRole : void 0,
      url: optionalString(row.url, 2e3)
    }];
  });
}
export {
  createOsbbRuntimeState,
  jiraIssuesFromResponse
};
