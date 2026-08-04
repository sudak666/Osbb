import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createElevatorEntry,
  elevatorEntriesFromResponse,
    removeElevatorEntry,
    sortElevatorEntries,
} from '../src/osbb-elevator.js';

test('elevatorEntriesFromResponse нормалізує серверний журнал', () => {
  assert.deepEqual(elevatorEntriesFromResponse([
    { id: 'e1', day: 4, text: '  Заміна кнопки  ', createdAt: null, createdBy: 'Диспетчер' },
    { id: 'e2', day: 40, text: 'Некоректний день' },
    { id: 'e3', day: 5, text: '' },
  ]), [{ id: 'e1', day: 4, text: 'Заміна кнопки', createdAt: '', createdBy: 'Диспетчер' }]);
  assert.deepEqual(elevatorEntriesFromResponse({}), []);
});

test('createElevatorEntry нормалізує запис ліфтера', () => {
    const entry = createElevatorEntry('7', '  Перевірив кабіну  ', 'Іван', {
        now: new Date('2026-08-03T08:15:00.000Z'),
        idSuffix: 'test',
    });

    assert.deepEqual(entry, {
        id: 'e1785744900000test',
        day: 7,
        text: 'Перевірив кабіну',
        createdAt: '2026-08-03T08:15:00.000Z',
        createdBy: 'Іван',
    });
});

test('createElevatorEntry відхиляє порожній опис і нормалізує день', () => {
    assert.equal(createElevatorEntry(2, '   ', 'Іван'), null);
    assert.equal(createElevatorEntry('invalid', 'Огляд', null, {
        now: new Date('2026-08-03T08:15:00.000Z'),
        idSuffix: 'test',
    })?.day, 1);
});

test('removeElevatorEntry не змінює вхідний масив', () => {
    const entries = [
        { id: 'first', day: 1, text: 'A' },
        { id: 'second', day: 2, text: 'B' },
    ];

    assert.deepEqual(removeElevatorEntry(entries, 'first'), [{ id: 'second', day: 2, text: 'B' }]);
    assert.equal(entries.length, 2);
});

test('sortElevatorEntries сортує копію записів за днем', () => {
    const entries = [
        { id: 'second', day: 12, text: 'B' },
        { id: 'first', day: 3, text: 'A' },
    ];

    assert.deepEqual(sortElevatorEntries(entries).map((entry) => entry.id), ['first', 'second']);
    assert.deepEqual(entries.map((entry) => entry.id), ['second', 'first']);
});
