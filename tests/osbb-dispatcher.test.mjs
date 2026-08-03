import test from 'node:test';
import assert from 'node:assert/strict';

import {
    closeDispatcherTicket,
    matchesDispatcherFilter,
    normalizeDispatcherDay,
    reopenDispatcherTicket,
} from '../src/osbb-dispatcher.js';

test('normalizeDispatcherDay повертає безпечний список заявок', () => {
    const ticketsList = [{ id: 'ticket-1', status: 'open' }];

    assert.deepEqual(normalizeDispatcherDay(null), { ticketsList: [] });
    assert.deepEqual(normalizeDispatcherDay({ ticketsList: 'invalid' }), { ticketsList: [] });
    assert.equal(normalizeDispatcherDay({ ticketsList }).ticketsList, ticketsList);
});

test('closeDispatcherTicket зберігає нормалізовані дані закриття', () => {
    const ticket = { id: 'ticket-1', status: 'open' };
    const now = new Date('2026-08-02T09:30:00.000Z');

    closeDispatcherTicket(ticket, '  Виконано  ', 'Диспетчер', now);

    assert.deepEqual(ticket, {
        id: 'ticket-1',
        status: 'done',
        comment: 'Виконано',
        closedAt: '2026-08-02T09:30:00.000Z',
        closedBy: 'Диспетчер',
    });
});

test('reopenDispatcherTicket відкриває лише завершену заявку', () => {
    const doneTicket = {
        id: 'ticket-1',
        status: 'done',
        comment: 'Готово',
        closedAt: '2026-08-02T09:30:00.000Z',
        closedBy: 'Диспетчер',
    };

    assert.equal(reopenDispatcherTicket(doneTicket), true);
    assert.deepEqual(doneTicket, { id: 'ticket-1', status: 'open', comment: '' });
    assert.equal(reopenDispatcherTicket(doneTicket), false);
});

test('matchesDispatcherFilter застосовує фільтри подій і дат', () => {
    const row = normalizeDispatcherDay({ ticketsList: [] });

    assert.equal(matchesDispatcherFilter(row, true, 'has_event', false), true);
    assert.equal(matchesDispatcherFilter(row, false, 'today', true), true);
    assert.equal(matchesDispatcherFilter(row, true, 'current_week', false), false);
    assert.equal(matchesDispatcherFilter(row, false, 'all', false), true);
});

test('matchesDispatcherFilter враховує статус і пріоритет заявок', () => {
    const unresolved = normalizeDispatcherDay({
        ticketsList: [
            { id: 'ticket-1', priority: 'HIGH', status: 'open' },
            { id: 'ticket-2', priority: 'LOW', status: 'done' },
        ],
    });
    const done = normalizeDispatcherDay({
        ticketsList: [{ id: 'ticket-3', priority: 'HIGH', status: 'done' }],
    });
    const empty = normalizeDispatcherDay({});

    assert.equal(matchesDispatcherFilter(unresolved, false, 'urgent', false), true);
    assert.equal(matchesDispatcherFilter(unresolved, false, 'unresolved', false), true);
    assert.equal(matchesDispatcherFilter(unresolved, false, 'done', false), false);
    assert.equal(matchesDispatcherFilter(done, false, 'urgent', false), false);
    assert.equal(matchesDispatcherFilter(done, false, 'done', false), true);
    assert.equal(matchesDispatcherFilter(empty, false, 'done', false), false);
});
