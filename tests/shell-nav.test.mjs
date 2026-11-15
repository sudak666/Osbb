import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHELL_SECTIONS, isMobilePrimarySection, isShellSection, sectionForModulePage, sectionModule,
} from '../src/shell-nav.js';

test('shell sections map to their owning module', () => {
  assert.equal(sectionModule('home'), null);
  assert.equal(sectionModule('tabel'), 'journal');
  assert.equal(sectionModule('audit'), 'sklad');
  assert.equal(Object.keys(SHELL_SECTIONS).length, 9);
});

test('module sub-pages highlight their parent menu item', () => {
  assert.equal(sectionForModulePage('sklad', 'issue'), 'items');
  assert.equal(sectionForModulePage('sklad', 'add'), 'items');
  assert.equal(sectionForModulePage('sklad', 'receipts'), 'log');
  assert.equal(sectionForModulePage('sklad', 'stats'), 'stats');
  assert.equal(sectionForModulePage('journal', 'shifts'), 'shifts');
});

test('sections reported by the wrong module or unknown values are rejected', () => {
  assert.equal(sectionForModulePage('journal', 'items'), null);
  assert.equal(sectionForModulePage('sklad', 'garbage'), null);
  assert.equal(sectionForModulePage('sklad', '__proto__'), null);
  assert.equal(sectionForModulePage('journal', 42), null);
  assert.equal(isShellSection('constructor'), false);
  assert.equal(isShellSection('home'), true);
});

test('mobile bottom navigation keeps daily sections, the rest go to «Ще»', () => {
  assert.equal(isMobilePrimarySection('garbage'), true);
  assert.equal(isMobilePrimarySection('tabel'), true);
  assert.equal(isMobilePrimarySection('audit'), false);
});
