import test from 'node:test';
import assert from 'node:assert/strict';

import { formatTimeMaskValue, isCompleteTimeValue, loadOsbbTheme, nextOsbbTheme, saveOsbbTheme, shouldApplyRealtimeRefresh } from '../src/osbb-client-state.js';

test('OSBB theme state normalizes values and survives storage failures', () => {
  const values = new Map([['selected_theme', 'theme-dark']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(loadOsbbTheme(storage), 'theme-dark');
  assert.equal(nextOsbbTheme('theme-dark'), 'theme-light');
  assert.equal(saveOsbbTheme(storage, 'invalid'), 'theme-light');
  assert.equal(values.get('selected_theme'), 'theme-light');
  assert.equal(loadOsbbTheme({ getItem() { throw new Error('blocked'); } }), 'theme-light');
});

test('OSBB time mask bounds hours and minutes', () => {
  assert.equal(formatTimeMaskValue('1a2'), '12');
  assert.equal(formatTimeMaskValue('2968'), '23:59');
  assert.equal(formatTimeMaskValue('075'), '07:5');
  assert.equal(formatTimeMaskValue(null), '');
  assert.equal(isCompleteTimeValue('23:59'), true);
  assert.equal(isCompleteTimeValue('24:00'), false);
  assert.equal(isCompleteTimeValue('07:5'), false);
});

test('realtime refresh only applies to the visible idle tab', () => {
  assert.equal(shouldApplyRealtimeRefresh('garbage', 'garbage', 'DIV'), true);
  assert.equal(shouldApplyRealtimeRefresh('garbage', 'dispatcher', 'DIV'), false);
  assert.equal(shouldApplyRealtimeRefresh('garbage', 'garbage', 'input'), false);
  assert.equal(shouldApplyRealtimeRefresh('garbage', 'garbage', 'TEXTAREA'), false);
});
