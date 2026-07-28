import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const tokensCss = await readFile(new URL('../shared/material-tokens.css', import.meta.url), 'utf8');
const journalHtml = await readFile(new URL('../osbb/index.html', import.meta.url), 'utf8');
const journalCss = await readFile(new URL('../osbb/styles.css', import.meta.url), 'utf8');
const shellHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const skladHtml = await readFile(new URL('../sklad/index.html', import.meta.url), 'utf8');
const skladCss = await readFile(new URL('../sklad/styles.css', import.meta.url), 'utf8');
const shellCss = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

const requiredRoles = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'surface', 'on-surface', 'surface-container-low', 'surface-container',
  'surface-container-high', 'surface-container-highest', 'surface-dim', 'surface-bright',
  'outline', 'outline-variant', 'inverse-surface', 'inverse-on-surface', 'inverse-primary',
];

function themeBlock(selector) {
  const start = tokensCss.indexOf(selector);
  assert.notEqual(start, -1, `Не знайдено тему ${selector}`);
  const open = tokensCss.indexOf('{', start);
  const close = tokensCss.indexOf('\n}', open);
  return tokensCss.slice(open + 1, close);
}

function readColors(block) {
  return Object.fromEntries([...block.matchAll(/--md-sys-color-([\w-]+):\s*(#[\da-f]{6}|rgba?\([^;]+\))/gi)]
    .map(([, role, value]) => [role, value]));
}

function luminance(hex) {
  const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const selector of ['.theme-light', '.theme-dark']) {
  const colors = readColors(themeBlock(selector));
  requiredRoles.forEach(role => assert.ok(colors[role], `${selector}: відсутня роль ${role}`));
  const pairs = [
    ['on-primary', 'primary'], ['on-primary-container', 'primary-container'],
    ['on-secondary', 'secondary'], ['on-secondary-container', 'secondary-container'],
    ['on-tertiary', 'tertiary'], ['on-tertiary-container', 'tertiary-container'],
    ['on-error', 'error'], ['on-error-container', 'error-container'],
    ['on-surface', 'surface'], ['on-surface-variant', 'surface-container'],
    ['inverse-on-surface', 'inverse-surface'],
  ];
  for (const [foreground, background] of pairs) {
    const ratio = contrast(colors[foreground], colors[background]);
    assert.ok(ratio >= 4.5, `${selector}: ${foreground}/${background} має контраст ${ratio.toFixed(2)}:1`);
  }
}

const allHtml = [shellHtml, journalHtml, skladHtml].join('\n');
const allCss = [shellCss, journalCss, skladCss].join('\n');
// Перевіряємо лише реальне підключення MDI або CSS-класи MDI. Загальний пошук
// `\bmdi` дає хибні збіги у довільному вмісті великого inline-скрипту.
assert.doesNotMatch(
  allHtml,
  /@mdi\/font|class=["'][^"']*\bmdi(?:\s|-[^"']*)/,
  'Інтерфейс ще використовує MDI замість Material Symbols',
);
assert.equal((allHtml.match(/Material\+Symbols\+Rounded/g) || []).length, 3, 'Material Symbols Rounded мають бути підключені у трьох застосунках');
assert.doesNotMatch(allCss, /font-weight:\s*(?:300|600|650|750|800|850)\b/, 'Виявлено синтетичну вагу Roboto');
assert.match(journalCss, /@media \(pointer:coarse\)[\s\S]*min-height:48px/, 'Немає 48dp touch targets');

console.log('Material 3 tokens, contrast, typography, icons and touch targets: OK');
