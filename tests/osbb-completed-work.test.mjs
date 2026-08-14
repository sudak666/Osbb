import test from 'node:test';
import assert from 'node:assert/strict';
import { completedWorkDefaultDate, completedWorkEntriesFromResponse, filterCompletedWork, validateCompletedWorkDraft } from '../src/osbb-completed-work.js';

const id = '123e4567-e89b-12d3-a456-426614174000';

test('completed work default date survives uninitialized calendar state', () => {
  const today = new Date(2026, 7, 14);
  assert.equal(completedWorkDefaultDate(undefined, undefined, today), '2026-08-14');
  assert.equal(completedWorkDefaultDate(2026, 6, today), '2026-07-01');
});

test('completed work boundary accepts only complete safe rows', () => {
  assert.deepEqual(completedWorkEntriesFromResponse([
    { id, work_date:'2026-08-14', worker_role:'electrician', description:'  Замінив лампу  ', note:'  3 поверх ' },
    { id:'bad', work_date:'2026-08-14', worker_role:'plumber', description:'x' },
    { id, work_date:'bad', worker_role:'admin', description:'x' },
  ]), [{ id, workDate:'2026-08-14', workerRole:'electrician', description:'Замінив лампу', note:'3 поверх' }]);
});

test('completed work draft requires date, worker and description', () => {
  assert.match(validateCompletedWorkDraft({}).error, /дату/);
  assert.match(validateCompletedWorkDraft({ workDate:'2026-08-14' }).error, /виконавця/);
  assert.match(validateCompletedWorkDraft({ workDate:'2026-08-14', workerRole:'janitor' }).error, /Опишіть/);
  assert.deepEqual(validateCompletedWorkDraft({ workDate:'2026-08-14', workerRole:'janitor', description:'  Пофарбував стіну ', note:' ' }).value,
    { id:null, workDate:'2026-08-14', workerRole:'janitor', description:'Пофарбував стіну', note:'' });
  assert.match(validateCompletedWorkDraft({ id:'bad', workDate:'2026-08-14', workerRole:'janitor', description:'x' }).error, /ідентифікатор/);
});

test('completed work search and worker filter combine', () => {
  const entries = [
    { workerRole:'electrician', description:'Замінив лампу', note:'' },
    { workerRole:'plumber', description:'Полагодив кран', note:'секція 1' },
  ];
  assert.deepEqual(filterCompletedWork(entries, 'секція', 'plumber'), [entries[1]]);
  assert.deepEqual(filterCompletedWork(entries, 'лампу', 'plumber'), []);
});
