// Згенеровано з src/osbb-dispatcher.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
const WORKER_ROLES = /* @__PURE__ */ new Set(["plumber", "janitor", "electrician"]);
const TICKET_PRIORITIES = /* @__PURE__ */ new Set(["HIGH", "MEDIUM", "LOW"]);
function boundedText(value, maxLength) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength);
}
function normalizeDispatcherTicket(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value;
  const id = boundedText(row.id, 128);
  if (!id) return null;
  const priority = TICKET_PRIORITIES.has(row.priority) ? row.priority : "MEDIUM";
  const status = row.status === "done" ? "done" : "open";
  const role = WORKER_ROLES.has(String(row.role)) ? String(row.role) : "";
  const photos = Array.isArray(row.photos) ? row.photos.filter((photo) => typeof photo === "string" && photo.trim() !== "").map((photo) => photo.trim()) : [];
  return {
    id,
    text: boundedText(row.text, 2e3),
    role,
    priority,
    status,
    comment: boundedText(row.comment, 4e3),
    photos,
    createdAt: boundedText(row.createdAt, 100),
    closedAt: boundedText(row.closedAt, 100),
    closedBy: boundedText(row.closedBy, 200)
  };
}
function normalizeDispatcherDay(row) {
  if (typeof row !== "object" || row === null) return { ticketsList: [] };
  const source = "ticketsList" in row && Array.isArray(row.ticketsList) ? row.ticketsList : [];
  const ticketsList = source.flatMap((ticket) => {
    const normalized = normalizeDispatcherTicket(ticket);
    return normalized ? [normalized] : [];
  });
  return { ticketsList };
}
function normalizeDispatcherMonth(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([day, row]) => {
    const numericDay = Number(day);
    if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) return [];
    return [[day, normalizeDispatcherDay(row)]];
  }));
}
function closeDispatcherTicket(ticket, comment, closedBy, now = /* @__PURE__ */ new Date()) {
  ticket.status = "done";
  ticket.comment = String(comment ?? "").trim();
  ticket.closedAt = now.toISOString();
  ticket.closedBy = String(closedBy ?? "");
}
function reopenDispatcherTicket(ticket) {
  if (ticket.status !== "done") return false;
  ticket.status = "open";
  ticket.comment = "";
  delete ticket.closedAt;
  delete ticket.closedBy;
  return true;
}
function matchesDispatcherFilter(row, hasEvent, filter, dateMatches) {
  if (filter === "today" || filter === "current_week") return dateMatches;
  if (filter === "has_event") return hasEvent;
  if (filter === "urgent") return row.ticketsList.some((ticket) => ticket.priority === "HIGH" && ticket.status !== "done");
  if (filter === "unresolved") return row.ticketsList.some((ticket) => ticket.status !== "done");
  if (filter === "done") return row.ticketsList.length > 0 && row.ticketsList.every((ticket) => ticket.status === "done");
  return true;
}
function dispatcherDayStatus(row) {
  if (!row.ticketsList.length) return null;
  if (row.ticketsList.some((ticket) => ticket.priority === "HIGH" && ticket.status !== "done")) return "urgent";
  if (row.ticketsList.every((ticket) => ticket.status === "done")) return "done";
  return "open";
}
function dispatcherDayStatusLabel(status) {
  if (status === "urgent") return "є термінові заявки";
  if (status === "done") return "усі заявки виконано";
  if (status === "open") return "є відкриті заявки";
  return "подій немає";
}
function matchesDispatcherSearchAndWorker(row, query, workerRole) {
  const normalizedQuery = String(query ?? "").trim().toLocaleLowerCase("uk-UA");
  const searchableText = row.ticketsList.map((ticket) => String(ticket.text ?? "")).join(" ").toLocaleLowerCase("uk-UA");
  const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
  const role = String(workerRole ?? "all");
  const matchesWorker = role === "all" || row.ticketsList.some((ticket) => ticket.role === role);
  return matchesSearch && matchesWorker;
}
function calculateDispatcherMonthStats(entries) {
  return entries.reduce((totals, entry) => {
    const tickets = entry.row.ticketsList;
    if (tickets.length > 0 || Number(entry.photosCount || 0) > 0) totals.events += 1;
    totals.tickets += tickets.length;
    totals.urgent += tickets.filter((ticket) => ticket.priority === "HIGH" && ticket.status !== "done").length;
    totals.done += tickets.filter((ticket) => ticket.status === "done").length;
    return totals;
  }, { events: 0, tickets: 0, urgent: 0, done: 0 });
}
export {
  calculateDispatcherMonthStats,
  closeDispatcherTicket,
  dispatcherDayStatus,
  dispatcherDayStatusLabel,
  matchesDispatcherFilter,
  matchesDispatcherSearchAndWorker,
  normalizeDispatcherDay,
  normalizeDispatcherMonth,
  normalizeDispatcherTicket,
  reopenDispatcherTicket
};
