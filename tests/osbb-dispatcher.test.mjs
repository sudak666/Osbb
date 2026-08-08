import test from 'node:test';
import assert from 'node:assert/strict';

import {
    calculateDispatcherMonthStats,
    closeDispatcherTicket,
    dispatcherDayStatus,
    dispatcherDayStatusLabel,
    matchesDispatcherFilter,
  matchesDispatcherSearchAndWorker,
  normalizeDispatcherDay,
  normalizeDispatcherMonth,
  normalizeDispatcherTicket,
    reopenDispatcherTicket,
} from '../src/osbb-dispatcher.js';

test('normalizeDispatcherMonth залишає лише валідні дні та заявки', () => {
  assert.deepEqual(normalizeDispatcherMonth({
    1: { ticketsList: [{ id: 't1', text: 'Аварія' }, null, { text: 'без id' }] },
    invalid: { ticketsList: [{ id: 't2' }] },
    99: { ticketsList: [{ id: 't3' }] },
  }), { 1: { ticketsList: [{
    id: 't1', text: 'Аварія', role: '', priority: 'MEDIUM', status: 'open',
    comment: '', photos: [], createdAt: '', closedAt: '', closedBy: '',
  }] } });
  assert.deepEqual(normalizeDispatcherMonth(null), {});
});

test('dispatcherDayStatus визначає стан і доступний опис дня', () => {
    const urgent = normalizeDispatcherDay({ ticketsList: [{ id: '1', priority: 'HIGH', status: 'open' }] });
    const done = normalizeDispatcherDay({ ticketsList: [{ id: '2', priority: 'HIGH', status: 'done' }] });
    const open = normalizeDispatcherDay({ ticketsList: [{ id: '3', priority: 'LOW', status: 'open' }] });
    assert.equal(dispatcherDayStatus(urgent), 'urgent');
    assert.equal(dispatcherDayStatus(done), 'done');
    assert.equal(dispatcherDayStatus(open), 'open');
    assert.equal(dispatcherDayStatus(normalizeDispatcherDay({})), null);
    assert.equal(dispatcherDayStatusLabel('urgent'), 'є термінові заявки');
    assert.equal(dispatcherDayStatusLabel(null), 'подій немає');
});

test('matchesDispatcherSearchAndWorker поєднує пошук і виконавця', () => {
    const row = normalizeDispatcherDay({ ticketsList: [
        { id: '1', text: 'Замінити лампу', role: 'electrician' },
        { id: '2', text: 'Перевірити кран', role: 'plumber' },
    ] });
    assert.equal(matchesDispatcherSearchAndWorker(row, 'ЛАМПУ', 'electrician'), true);
    assert.equal(matchesDispatcherSearchAndWorker(row, 'кран', 'electrician'), true);
    assert.equal(matchesDispatcherSearchAndWorker(row, 'дах', 'all'), false);
    assert.equal(matchesDispatcherSearchAndWorker(row, '', 'janitor'), false);
});

test('calculateDispatcherMonthStats рахує заявки, події та виконання', () => {
    const stats = calculateDispatcherMonthStats([
        { row: normalizeDispatcherDay({ ticketsList: [
            { id: '1', priority: 'HIGH', status: 'open' },
            { id: '2', priority: 'LOW', status: 'done' },
        ] }) },
        { row: normalizeDispatcherDay({}), photosCount: 2 },
        { row: normalizeDispatcherDay({}) },
    ]);
    assert.deepEqual(stats, { events: 2, tickets: 2, urgent: 1, done: 1 });
});

test('normalizeDispatcherDay повертає безпечний список заявок', () => {
    const ticketsList = [{ id: 'ticket-1', status: 'open' }];

    assert.deepEqual(normalizeDispatcherDay(null), { ticketsList: [] });
    assert.deepEqual(normalizeDispatcherDay({ ticketsList: 'invalid' }), { ticketsList: [] });
    assert.notEqual(normalizeDispatcherDay({ ticketsList }).ticketsList, ticketsList);
});

test('normalizeDispatcherTicket sanitizes untrusted ticket fields', () => {
    assert.deepEqual(normalizeDispatcherTicket({
        id: ' ticket-1 ',
        text: ' <img src=x onerror=alert(1)> ',
        role: '"><script>alert(1)</script>',
        priority: 'HIGH evil-class',
        status: 'deleted',
        photos: [' https://example.com/a.jpg ', null, ''],
        comment: 42,
    }), {
        id: 'ticket-1',
        text: '<img src=x onerror=alert(1)>',
        role: '',
        priority: 'MEDIUM',
        status: 'open',
        comment: '',
        photos: ['https://example.com/a.jpg'],
        createdAt: '',
        closedAt: '',
        closedBy: '',
    });
    assert.equal(normalizeDispatcherTicket({ text: 'missing id' }), null);
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
