import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const tokensCss = await readFile(new URL('../shared/material-tokens.css', import.meta.url), 'utf8');
const journalHtml = await readFile(new URL('../osbb/index.html', import.meta.url), 'utf8');
const journalRuntime = await readFile(new URL('../src/osbb-app.js', import.meta.url), 'utf8');
const journalCss = await readFile(new URL('../osbb/styles.css', import.meta.url), 'utf8');
const shellHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const skladHtml = await readFile(new URL('../sklad/index.html', import.meta.url), 'utf8');
const skladCss = await readFile(new URL('../sklad/styles.css', import.meta.url), 'utf8');
const shellCss = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const sharedUiCss = await readFile(new URL('../shared/ui.css', import.meta.url), 'utf8');

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
  // Outlined-стиль тримається на контурі: межі полів і карток мають бути видимі
  // (WCAG 1.4.11 — 3:1 для меж елементів керування). Напівпрозорий rgba тут не годиться.
  assert.match(colors.outline, /^#[\da-f]{6}$/i, `${selector}: outline має бути непрозорим кольором`);
  const outlineRatio = contrast(colors.outline, colors.surface);
  assert.ok(outlineRatio >= 3, `${selector}: outline/surface має контраст ${outlineRatio.toFixed(2)}:1`);
  for (const role of ['secondary', 'secondary-container']) {
    const hex = colors[role].slice(1);
    const [r, g, b] = [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
    assert.ok(g >= b, `${selector}: ${role} має бути з зеленої палітри, а не синім (${colors[role]})`);
  }
}

const allHtml = [shellHtml, journalHtml, journalRuntime, skladHtml].join('\n');
const allCss = [shellCss, journalCss, skladCss, sharedUiCss].join('\n');
assert.doesNotMatch(`${skladHtml}\n${skladCss}`, /--ios-/, 'Склад ще використовує legacy iOS токени');
// Перевіряємо лише реальне підключення MDI або CSS-класи MDI. Загальний пошук
// `\bmdi` дає хибні збіги у довільному вмісті великого inline-скрипту.
assert.doesNotMatch(allHtml, /@mdi\/font/, 'Інтерфейс ще підключає шрифт MDI');
const legacyMdiClasses = [...allHtml.matchAll(/class=["']([^"']*)["']/g)]
  .flatMap(([, classNames]) => classNames.split(/\s+/))
  .filter(className => className === 'mdi' || className.startsWith('mdi-'));
assert.deepEqual(legacyMdiClasses, [], `Знайдено legacy MDI класи: ${[...new Set(legacyMdiClasses)].join(', ')}`);
assert.equal((allHtml.match(/href="\/Osbb\/shared\/material-symbols\.css"/g) || []).length, 3, 'Material Symbols Rounded мають бути підключені у трьох застосунках');
assert.ok((await readFile(new URL('../shared/fonts/material-symbols-rounded.woff2', import.meta.url))).length > 0, 'Local icon font must be shipped');
assert.doesNotMatch(allHtml + allCss, /fonts.(googleapis|gstatic).com/, 'Шрифти мають бути локальні (shared/fonts), не з Google Fonts (і в HTML, і в CSS)');
for (const subset of ['cyrillic', 'latin']) for (const weight of [400, 500, 700]) {
  assert.ok((await readFile(new URL(`../shared/fonts/roboto-${subset}-${weight}.woff2`, import.meta.url))).length > 0, `Local Roboto ${subset} ${weight} must be shipped`);
}
assert.equal((allHtml.match(/<svg\b/g) || []).length, 1, 'Знайдено інтерфейсні inline SVG замість Material Symbols');
const syntheticRobotoWeights = [...allCss.matchAll(/font-weight:\s*(300|600|650|750|800|850)\b/g)]
  .map(([, weight]) => weight);
assert.deepEqual(syntheticRobotoWeights, [], `Знайдено синтетичні ваги Roboto: ${[...new Set(syntheticRobotoWeights)].join(', ')}`);
// Розміри тексту — лише зі шкали --app-font-* (листопад 2026). Іконки (.ms, *-icon, гліфи)
// і папір звіту (.rpt-*) мають власні розміри; em/%/clamp/inherit/var — відносні й дозволені.
{
  const iconOrPaper = /\.ms\b|material-symbols|icon|glyph|\.si\b|\.ic-\d|logo|\.rpt-|chevron/;
  const offScale = [];
  for (const [file, css] of Object.entries({ 'styles.css': shellCss, 'osbb/styles.css': journalCss, 'sklad/styles.css': skladCss, 'shared/ui.css': sharedUiCss })) {
    for (const [, selector, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
      if (iconOrPaper.test(selector)) continue;
      for (const [, value] of body.matchAll(/font-size\s*:\s*([^;!}]+)/g)) {
        if (/^\s*[\d.]+(px|rem)\s*$/.test(value) && Number.parseFloat(value) !== 0) offScale.push(`${file}: ${selector.trim().slice(0, 60)} → ${value.trim()}`);
      }
    }
  }
  assert.deepEqual(offScale, [], `Розміри тексту поза шкалою --app-font-*:\n${offScale.join('\n')}`);
}
const shapeTokenPattern = /var\(--md-sys-shape-corner-(?:extra-small|small|medium|large|extra-large|full),\s*(?:4|8|12|16|28|999)px\)/g;
const nonTokenRadii = [...allCss.matchAll(/border-radius:\s*([^;}]+)/g)]
  .map(([, value]) => value.replace(shapeTokenPattern, '').trim())
  .filter(value => /(?:\d+(?:\.\d+)?(?:px|rem|%)|calc\()/.test(value));
assert.deepEqual(nonTokenRadii, [], `Знайдено радіуси поза M3 shape tokens: ${[...new Set(nonTokenRadii)].join(', ')}`);
assert.match(journalCss, /@media \(pointer:coarse\)[\s\S]*min-height:48px/, 'Немає 48dp touch targets');

// Інтерактивні елементи, які раніше були меншими за 40px (MD3: 40dp візуально, 48dp зона дотику).
const minInteractive = [
  [sharedUiCss, /\.custom-date-day\{height:(\d+)px/],
  [sharedUiCss, /\.custom-date-nav\{width:\d+px;height:(\d+)px/],
  [skladCss, /\.custom-date-day\{height:(\d+)px/],
  [skladCss, /\.preset-chip \{ min-height: (\d+)px/],
  [journalCss, /\.att-absence-action \{[^}]*min-height:(\d+)px/],
  [journalCss, /\.day-detail-close \{ flex-shrink: 0; width: \d+px; height: (\d+)px/],
];
for (const [css, pattern] of minInteractive) {
  const match = css.match(pattern);
  assert.ok(match, `Не знайдено правило ${pattern}`);
  assert.ok(Number(match[1]) >= 40, `${pattern}: ${match[1]}px < 40px`);
}

// Мінімальний текст — MD3 label-small (11px). Винятки: іконковий утиліт-клас і декоративний uppercase-кікер.
const tinyText = [...allCss.matchAll(/([^{}]*)\{[^{}]*font-size:\s*(\d+(?:\.\d+)?)px/g)]
  .filter(([, , size]) => Number(size) < 11)
  .map(([, selector]) => selector.replace(/\/\*[\s\S]*?\*\//g, '').trim())
  .filter(selector => !/^\.ic-10$/.test(selector) && !/app-module-kicker/.test(selector));
assert.deepEqual(tinyText, [], `Текст менший за 11px: ${tinyText.join(' | ')}`);

console.log('Material 3 tokens, contrast, typography, icons and touch targets: OK');
