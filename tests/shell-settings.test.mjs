import test from 'node:test';
import assert from 'node:assert/strict';

import { AUTO_LOCK_KEY, createShellSettings, normalizeShellTheme, PIN_KEY, THEME_KEY } from '../src/shell-settings.js';

function makeEnv(initial = {}) {
  const store = new Map(Object.entries(initial));
  const listeners = {};
  const on = (target) => (name, handler) => { (target[name] ??= []).push(handler); };
  const classes = new Set(['theme-light']);
  const meta = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } };
  const makeInput = (key) => {
    const row = { classes: new Set(), classList: { toggle(name, on) { if (on) row.classes.add(name); else row.classes.delete(name); } } };
    const input = { key, checked: false, disabled: false, handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; }, closest: () => row, row };
    return input;
  };
  const inputs = {
    '[data-shell-theme]': [makeInput('theme'), makeInput('theme')],
    '[data-shell-pin]': [makeInput('pin'), makeInput('pin')],
    '[data-shell-auto-lock]': [makeInput('auto'), makeInput('auto')],
  };
  const lockButtons = [{ hidden: false }, { hidden: false }];
  const docListeners = {};
  const document = {
    body: { classList: { add: (n) => classes.add(n), remove: (...ns) => ns.forEach((n) => classes.delete(n)) } },
    querySelector: (sel) => (sel === 'meta[name="theme-color"]' ? meta : null),
    querySelectorAll: (sel) => (sel === '[data-shell-lock]' ? lockButtons : inputs[sel] ?? []),
    getElementById: () => null,
    addEventListener: on(docListeners),
  };
  const window = {
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    addEventListener: on(listeners),
  };
  return { store, listeners, classes, meta, inputs, lockButtons, document, window };
}

test('normalizeShellTheme falls back to light', () => {
  assert.equal(normalizeShellTheme('theme-dark'), 'theme-dark');
  assert.equal(normalizeShellTheme('whatever'), 'theme-light');
  assert.equal(normalizeShellTheme(null), 'theme-light');
});

test('switches reflect stored settings; PIN defaults to on', () => {
  const env = makeEnv({ [THEME_KEY]: 'theme-dark' });
  createShellSettings({ document: env.document, window: env.window }).bind();
  assert.ok(env.inputs['[data-shell-theme]'].every((i) => i.checked));
  assert.ok(env.inputs['[data-shell-pin]'].every((i) => i.checked));
  assert.ok(env.inputs['[data-shell-auto-lock]'].every((i) => i.checked && !i.disabled));
  assert.ok(env.lockButtons.every((b) => !b.hidden));
});

test('turning PIN off disables auto-lock, hides lock buttons and notifies', () => {
  const env = makeEnv();
  let notified = 0;
  createShellSettings({ document: env.document, window: env.window, onSecurityChanged: () => { notified += 1; } }).bind();
  const pin = env.inputs['[data-shell-pin]'][0];
  pin.checked = false;
  pin.handlers.change();
  assert.equal(env.store.get(PIN_KEY), '0');
  assert.equal(env.store.get(AUTO_LOCK_KEY), '0');
  assert.equal(notified, 1);
  assert.ok(env.inputs['[data-shell-pin]'].every((i) => !i.checked), 'both PIN switches are synced');
  assert.ok(env.inputs['[data-shell-auto-lock]'].every((i) => !i.checked && i.disabled));
  assert.ok(env.lockButtons.every((b) => b.hidden));
});

test('theme switch applies and stores the theme', () => {
  const env = makeEnv();
  createShellSettings({ document: env.document, window: env.window }).bind();
  const theme = env.inputs['[data-shell-theme]'][1];
  theme.checked = true;
  theme.handlers.change();
  assert.equal(env.store.get(THEME_KEY), 'theme-dark');
  assert.ok(env.classes.has('theme-dark') && !env.classes.has('theme-light'));
  assert.equal(env.meta.attrs.content, '#121214');
  assert.ok(env.inputs['[data-shell-theme]'][0].checked, 'the other copy of the switch follows');
});

test('changes made in the journal (storage event) resync the shell', () => {
  const env = makeEnv();
  let notified = 0;
  createShellSettings({ document: env.document, window: env.window, onSecurityChanged: () => { notified += 1; } }).bind();
  env.store.set(PIN_KEY, '0');
  env.listeners.storage.forEach((fn) => fn({ key: PIN_KEY, newValue: '0' }));
  assert.ok(env.inputs['[data-shell-pin]'].every((i) => !i.checked));
  assert.equal(notified, 1);
  env.store.set(THEME_KEY, 'theme-dark');
  env.listeners.storage.forEach((fn) => fn({ key: THEME_KEY, newValue: 'theme-dark' }));
  assert.ok(env.classes.has('theme-dark'));
});
