import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeAttr, escapeHtml, safeExternalUrl } from '../src/app-security.js';

test('escapeHtml escapes every HTML-sensitive character', () => {
  assert.equal(
    escapeHtml('<a href="x&y">\'текст\'</a>'),
    '&lt;a href=&quot;x&amp;y&quot;&gt;&#39;текст&#39;&lt;/a&gt;',
  );
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeAttr('a"b'), 'a&quot;b');
});

test('safeExternalUrl accepts only HTTP protocols', () => {
  const base = 'https://example.com/sklad/';
  assert.equal(safeExternalUrl('/photo 1.jpg', base), 'https://example.com/photo%201.jpg');
  assert.equal(safeExternalUrl('https://cdn.example.com/a.jpg?x=1&y=2', base), 'https://cdn.example.com/a.jpg?x=1&amp;y=2');
  assert.equal(safeExternalUrl('javascript:alert(1)', base), '');
  assert.equal(safeExternalUrl('data:text/html,test', base), '');
});

test('safeExternalUrl fails closed for invalid input', () => {
  assert.equal(safeExternalUrl(''), '');
  assert.equal(safeExternalUrl('relative-without-base'), '');
  assert.equal(safeExternalUrl({}), '');
});
