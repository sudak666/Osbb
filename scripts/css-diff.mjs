#!/usr/bin/env node
// Порівняння вигляду двох версій застосунку: чи змінились обчислені стилі
// хоча б одного елемента на будь-якому екрані.
//
//   node scripts/css-diff.mjs                 — поточна робоча копія проти origin/main
//   node scripts/css-diff.mjs --base <ref>    — проти іншого коміту/гілки
//   node scripts/css-diff.mjs --quick         — лише світла тема
//   CSS_DIFF_CHROME=<шлях> node scripts/...   — свій Chrome/Chromium (інакше — встановлений Chrome)
//
// Збирає обидві версії без мініфікації, відкриває їх у headless Chrome у світлій і
// темній темі, на 1280px і 375px, проходить усі розділи shell (у тому числі всередині
// iframe журналу й складу) та модулі окремо, і порівнює елемент за елементом
// (сам елемент, ::before, ::after) за списком видимих властивостей. Розмітка може
// відрізнятися класами — порівнюється порядок елементів і їхній вигляд, не класи.
// Дані беруться з живої бази лише на читання. Код виходу 1 — є відмінності.
//
// Потрібен для правок, після яких вигляд не мав змінитися: чистка CSS, перейменування
// класів, перехід з утиліт на власні стилі тощо. Див. CLAUDE.md.

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
const BASE_REF = arg('--base', 'origin/main');
const QUICK = argv.includes('--quick');
const ROOT = process.cwd();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'osbb-css-diff-'));
// vite запускається напряму через node (без оболонки): так kill() зупиняє сам сервер і на Windows.
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const log = (...a) => console.log('[css-diff]', ...a);

function build(srcDir, outDir) {
  execFileSync(process.execPath, [VITE, 'build', '--minify', 'false', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: srcDir, stdio: 'inherit' });
  // Копіювальний скрипт — завжди з поточної копії: у старих комітах він не знає OSBB_OUT_DIR.
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/copy-static-assets.mjs')], { cwd: srcDir, stdio: 'inherit', env: { ...process.env, OSBB_OUT_DIR: outDir } });
}

function buildBase() {
  const src = path.join(TMP, 'base-src');
  execFileSync('git', ['worktree', 'add', '--detach', src, BASE_REF], { cwd: ROOT, stdio: 'ignore' });
  const link = path.join(src, 'node_modules');
  fs.symlinkSync(path.join(ROOT, 'node_modules'), link, 'junction');
  try {
    build(src, path.join(TMP, 'base'));
  } finally {
    unlinkJunction(link);
    execFileSync('git', ['worktree', 'remove', '--force', src], { cwd: ROOT, stdio: 'ignore' });
  }
}

// Прибирає лише саме посилання на node_modules. Якщо це не вдалося — зупиняємось,
// бо подальше рекурсивне видалення теки пройшло б посиланням і стерло справжні node_modules.
function unlinkJunction(link) {
  try { fs.unlinkSync(link); } catch { try { fs.rmdirSync(link); } catch {} }
  let stillThere = false;
  try { fs.lstatSync(link); stillThere = true; } catch {}
  if (stillThere) throw new Error(`Не вдалося прибрати посилання ${link}; тимчасову теку ${TMP} не видаляю — приберіть посилання вручну.`);
}

async function serve(dir, port) {
  const child = spawn(process.execPath, [VITE, 'preview', '--outDir', dir, '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${port}/Osbb/`); if (r.ok) return child; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('preview server did not start on ' + port);
}

// ---- у сторінці: знімок обчислених стилів ----
const PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'box-sizing',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'color', 'background-color', 'background-image', 'opacity', 'visibility', 'box-shadow',
  'outline-style', 'outline-width', 'outline-color',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'text-align', 'text-transform', 'text-decoration-line', 'white-space', 'vertical-align',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-items', 'justify-content', 'align-self',
  'row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows',
  'overflow-x', 'overflow-y', 'transform', 'cursor', 'list-style-type', 'object-fit', 'content',
];
function pageSnapshot({ props, mode, want }) {
  const docs = [['top', document]];
  document.querySelectorAll('iframe').forEach(f => { try { if (f.contentDocument && f.getBoundingClientRect().width > 0) docs.push([f.id || 'iframe', f.contentDocument]); } catch {} });
  const out = {};
  for (const [key, doc] of docs) {
    const win = doc.defaultView;
    const els = [...doc.body.querySelectorAll('*')].filter(el => !['SCRIPT', 'STYLE', 'LINK', 'META'].includes(el.tagName));
    const rows = els.map((el, i) => {
      if (mode === 'detail' && !(want[key] || []).includes(i)) return null;
      const parts = [];
      for (const pseudo of [null, '::before', '::after']) {
        const cs = win.getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) { parts.push(''); continue; }
        parts.push(props.map(p => cs.getPropertyValue(p)).join('\u0001'));
      }
      if (mode === 'detail') return { i, tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].slice(0, 3).map(c => '.' + c).join(''), parts };
      let h = 2166136261;
      const s = el.tagName + '\u0002' + parts.join('\u0002');
      for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); }
      return h >>> 0;
    });
    out[key] = mode === 'detail' ? rows.filter(Boolean) : rows;
  }
  return out;
}

function closeEnough(a, b) {
  if (a === b) return true;
  const na = a.match(/-?[\d.]+/g), nb = b.match(/-?[\d.]+/g);
  if (!na || !nb || na.length !== nb.length) return false;
  if (a.replace(/-?[\d.]+/g, '#') !== b.replace(/-?[\d.]+/g, '#')) return false;
  return na.every((x, i) => Math.abs(parseFloat(x) - parseFloat(nb[i])) < 0.05); // субпіксельний шум розкладки
}

async function compare(basePage, newPage, label, report) {
  const [h1, h2] = await Promise.all([basePage, newPage].map(p => p.evaluate(pageSnapshot, { props: PROPS, mode: 'hash' })));
  const want = {};
  let structural = [];
  for (const key of new Set([...Object.keys(h1), ...Object.keys(h2)])) {
    const a = h1[key] || [], b = h2[key] || [];
    if (a.length !== b.length) structural.push(`${key}: ${a.length} → ${b.length} елементів`);
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) (want[key] ||= []).push(i);
  }
  const diffs = [];
  if (Object.keys(want).length) {
    const [d1, d2] = await Promise.all([basePage, newPage].map(p => p.evaluate(pageSnapshot, { props: PROPS, mode: 'detail', want })));
    for (const key of Object.keys(want)) {
      const byIndex = new Map((d1[key] || []).map(r => [r.i, r]));
      for (const r2 of d2[key] || []) {
        const r1 = byIndex.get(r2.i);
        if (!r1) continue;
        [0, 1, 2].forEach(k => {
          const a = r1.parts[k].split('\u0001'), b = r2.parts[k].split('\u0001');
          if (r1.parts[k] === '' && r2.parts[k] === '') return;
          PROPS.forEach((p, pi) => {
            if (!closeEnough(a[pi] ?? '', b[pi] ?? '')) diffs.push(`${key} ${r2.tag}${['', '::before', '::after'][k]} ${p}: ${a[pi] ?? '—'} → ${b[pi] ?? '—'}`);
          });
        });
      }
    }
  }
  report.push({ label, structural, diffs });
  log(`${label}: ${diffs.length ? diffs.length + ' відмінностей' : 'без відмінностей'}${structural.length ? '; структура: ' + structural.join(', ') : ''}`);
}

async function main() {
  const servers = [];
  let browser = null;
  const report = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // Усе — в одному try: тимчасова тека й сервери прибираються за будь-якої помилки.
  try {
    log(`збираю поточну версію і ${BASE_REF}…`);
    build(ROOT, path.join(TMP, 'new'));
    buildBase();
    servers.push(await serve(path.join(TMP, 'base'), 4290), await serve(path.join(TMP, 'new'), 4291));
    const exe = process.env.CSS_DIFF_CHROME;
    browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
    const themes = QUICK ? ['theme-light'] : ['theme-light', 'theme-dark'];
    const viewports = [{ width: 1280, height: 860 }, { width: 375, height: 812 }];
    for (const theme of themes) for (const viewport of viewports) {
      const tag = `${theme.replace('theme-', '')} ${viewport.width}px`;
      const open = async (port, url) => {
        const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        await ctx.addInitScript(t => {
          try { sessionStorage.setItem('auth', 'ok'); sessionStorage.setItem('auth_at', String(Date.now())); sessionStorage.setItem('osbb_splash_shown', '1'); localStorage.setItem('selected_theme', t); } catch {}
          document.addEventListener('DOMContentLoaded', () => {
            const s = document.createElement('style');
            s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';
            document.head.appendChild(s);
          });
        }, theme);
        const page = await ctx.newPage();
        await page.goto(`http://localhost:${port}${url}`);
        await wait(4000);
        return page;
      };
      const both = async (url) => Promise.all([open(4290, url), open(4291, url)]);
      const act = async (pages, fn, arg) => { await Promise.all(pages.map(p => p.evaluate(fn, arg))); await wait(2500); };

      // shell з розділами (модулі — в iframe)
      let pages = await both('/Osbb/');
      await compare(...pages, `${tag} shell: Головна`, report);
      for (const section of ['completed-work', 'garbage', 'tabel', 'items', 'log', 'audit', 'stats']) {
        await act(pages, s => document.querySelector(`[data-shell-section="${s}"]`)?.click(), section);
        await compare(...pages, `${tag} shell: ${section}`, report);
      }
      await Promise.all(pages.map(p => p.context().close()));

      // модулі окремо (без html.in-shell)
      pages = await both('/Osbb/osbb/');
      for (const tab of ['completed-work', 'garbage', 'tabel']) {
        await act(pages, t => document.querySelector(`[data-osbb-tab="${t}"]`)?.click(), tab);
        await compare(...pages, `${tag} журнал: ${tab}`, report);
      }
      await Promise.all(pages.map(p => p.context().close()));
      pages = await both('/Osbb/sklad/');
      for (const page of ['items', 'issue', 'add', 'log', 'audit', 'stats']) {
        await act(pages, s => document.querySelector(`[data-sklad-page="${s}"]`)?.click(), page);
        await compare(...pages, `${tag} склад: ${page}`, report);
      }
      await act(pages, () => { document.querySelector('[data-sklad-page="items"]')?.click(); document.querySelector('[data-item-action="history"]')?.click(); });
      await compare(...pages, `${tag} склад: вікно історії`, report);
      await Promise.all(pages.map(p => p.context().close()));
    }
  } finally {
    await browser?.close();
    servers.forEach(s => s.kill());
    // buildBase() вже прибрав посилання на node_modules (або зупинився з помилкою до цього кроку).
    if (!fs.existsSync(path.join(TMP, 'base-src', 'node_modules'))) fs.rmSync(TMP, { recursive: true, force: true });
  }
  const bad = report.filter(r => r.diffs.length || r.structural.length);
  if (!bad.length) { log(`усе однаково: ${report.length} станів без відмінностей.`); return; }
  console.log(`\n${bad.length} з ${report.length} станів мають відмінності:`);
  for (const r of bad) {
    console.log(`\n■ ${r.label}`);
    r.structural.forEach(s => console.log('  структура: ' + s));
    const unique = [...new Set(r.diffs)];
    unique.slice(0, 25).forEach(d => console.log('  ' + d));
    if (unique.length > 25) console.log(`  … ще ${unique.length - 25}`);
  }
  process.exitCode = 1;
}

main().catch(err => { console.error(err); process.exitCode = 2; });
