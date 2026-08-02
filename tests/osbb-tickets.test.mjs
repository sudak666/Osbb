import test from 'node:test';
import assert from 'node:assert/strict';

import {
  jiraPriorityClass,
  matchesDispatcherDateFilter,
  normalizeTicketPriority,
  ticketSortComparator,
} from '../src/osbb-tickets.js';

test('ticket priorities normalize unknown values and sort urgent tickets first', () => {
  assert.equal(normalizeTicketPriority('HIGH'), 'HIGH');
  assert.equal(normalizeTicketPriority('UNKNOWN'), 'MEDIUM');
  assert.equal(normalizeTicketPriority(null), 'MEDIUM');
  assert.equal(normalizeTicketPriority('UNKNOWN', 'LOW'), 'LOW');
  const tickets = [
    { id: 1, priority: 'LOW', createdAt: '2026-08-01T10:00:00Z' },
    { id: 2, priority: 'HIGH', createdAt: '2026-08-02T10:00:00Z' },
    { id: 3, priority: 'HIGH', createdAt: '2026-08-01T10:00:00Z' },
    { id: 4, priority: null, createdAt: '2026-08-01T09:00:00Z' },
  ];
  assert.deepEqual([...tickets].sort(ticketSortComparator).map((ticket) => ticket.id), [3, 2, 4, 1]);
});

test('Jira priorities map to the journal priority model', () => {
  assert.equal(jiraPriorityClass('Highest'), 'HIGH');
  assert.equal(jiraPriorityClass('High'), 'HIGH');
  assert.equal(jiraPriorityClass('Lowest'), 'LOW');
  assert.equal(jiraPriorityClass('Normal'), 'MEDIUM');
  assert.equal(jiraPriorityClass(null), 'MEDIUM');
});

test('dispatcher date filters use a Monday-to-Sunday current week', () => {
  const now = new Date(2026, 7, 5, 12, 0, 0); // середа
  assert.equal(matchesDispatcherDateFilter(2026, 7, 5, 'today', now), true);
  assert.equal(matchesDispatcherDateFilter(2026, 7, 4, 'today', now), false);
  assert.equal(matchesDispatcherDateFilter(2026, 7, 3, 'current_week', now), true);
  assert.equal(matchesDispatcherDateFilter(2026, 7, 9, 'current_week', now), true);
  assert.equal(matchesDispatcherDateFilter(2026, 7, 10, 'current_week', now), false);
  assert.equal(matchesDispatcherDateFilter(2026, 7, 10, 'all', now), true);
});
