// Обхід усіх екранів у Chrome з автоперевірками верстки (листопад 2026).
// npm run ui-sweep            — збирає dist/, піднімає vite preview, обходить shell, журнал і склад
//                               (телефон 412px і ПК 1280px, світла й темна тема), друкує зауваження.
// npm run ui-sweep -- --no-build   — без збірки (dist/ уже актуальний).
// Шукає: горизонтальну прокрутку, накладання кнопок, елементи, що впираються в рамку картки чи
// вилазять за неї, обрізаний текст, шрифт < 12px, помилки консолі. Знімки кожного екрана — у
// теці, яку скрипт друкує в кінці: їх варто проглянути очима, евристики не бачать усього.
// Дані з живої бази лише читаються. Потрібен встановлений Chrome або CSS_DIFF_CHROME=<шлях>.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(os.tmpdir(), 'osbb-ui-sweep');
const PORT = 4293;
const BASE = `http://localhost:${PORT}/Osbb/`;
const wait = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
if (!process.argv.includes('--no-build')) execFileSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: ROOT, stdio: 'ignore' }), execFileSync(process.execPath, [path.join(ROOT, 'scripts/copy-static-assets.mjs')], { cwd: ROOT, stdio: 'ignore' });
const server = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await wait(500); }

// ---------- перевірки в документі ----------
function checkDoc() {
  const out = [];
  const W = innerWidth;
  // Вміст закритого <details> (меню ⋯, «Фільтри») Chrome розміщує, хоч його й не видно.
  const closedDetails = e => { const d = e.closest('details:not([open])'); return !!d && !e.closest('summary'); };
  const hiddenAnc = e => !!e.closest('[hidden],.hidden,[aria-hidden="true"]') || closedDetails(e);
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && !hiddenAnc(e); };
  const name = e => {
    let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id;
    const c = [...e.classList].filter(x => !x.startsWith('md-')).slice(0, 2).join('.'); if (c) s += '.' + c;
    const t = (e.getAttribute('aria-label') || e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
    return s + (t ? ` «${t}»` : '');
  };
  const layerOf = e => { for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const pos = getComputedStyle(p).position; if (pos === 'fixed' || pos === 'sticky') return p; } return null; };
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.push(['h-overflow', `сторінка ширша за екран: ${de.scrollWidth} > ${de.clientWidth}`]);
  const inter = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),textarea,select,[role=button],[role=tab],summary,.custom-select-btn,.chip')].filter(vis);
  for (const e of inter) { const r = e.getBoundingClientRect(); if (r.right > W + 1 || r.left < -1) out.push(['offscreen', `${name(e)} ${Math.round(r.left)}..${Math.round(r.right)} (екран ${W})`]); }
  for (let i = 0; i < inter.length; i++) for (let j = i + 1; j < inter.length; j++) {
    const a = inter[i], b = inter[j];
    if (a.contains(b) || b.contains(a)) continue;
    if (layerOf(a) !== layerOf(b)) continue;
    const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
    const w = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left), h = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
    if (w > 0.5 && h > 0.5) out.push(['overlap', `${name(a)} ⟷ ${name(b)} (${Math.round(w)}×${Math.round(h)})`]);
  }
  // елементи, що торкаються рамки картки або вилазять за неї
  const bordered = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderTopLeftRadius) >= 12 && cs.borderTopStyle !== 'none') return p; } return null; };
  for (const e of inter) {
    const box = bordered(e); if (!box) continue;
    const r = e.getBoundingClientRect(), b = box.getBoundingClientRect(), cs = getComputedStyle(box);
    const bl = parseFloat(cs.borderLeftWidth), br = parseFloat(cs.borderRightWidth), bt = parseFloat(cs.borderTopWidth), bb = parseFloat(cs.borderBottomWidth);
    const innerW = b.width - bl - br, innerH = b.height - bt - bb;
    const gaps = { ліво: r.left - (b.left + bl), право: (b.right - br) - r.right, верх: r.top - (b.top + bt), низ: (b.bottom - bb) - r.bottom };
    const fullW = r.width >= innerW - 2, fullH = r.height >= innerH - 2;
    const bad = Object.entries(gaps).filter(([k, g]) => g < 3 && !((k === 'ліво' || k === 'право') ? fullW : fullH));
    if (bad.length) out.push([bad.some(([, g]) => g < -1) ? 'escape' : 'touch', `${name(e)} у ${name(box).split(' «')[0]}: ${bad.map(([k, g]) => `${k} ${g.toFixed(0)}px`).join(', ')}`]);
  }
  // текст
  const all = [...document.querySelectorAll('body *')].filter(e => !['SCRIPT', 'STYLE', 'svg', 'path', 'OPTION', 'SELECT'].includes(e.tagName) && vis(e));
  for (const e of all) {
    const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const cs = getComputedStyle(e);
    const icon = /material-symbols|(^|\s)ms(\s|$)/.test(e.className?.baseVal ?? e.className);
    if (hasText && !icon && !e.closest('[class*="rpt-"]') && parseFloat(cs.fontSize) < 12) out.push(['tiny-font', `${name(e)} ${cs.fontSize}`]);
    if (hasText && !icon && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) {
      if (cs.overflowX === 'visible') { if (e.matches('button,.custom-select-btn,[class*="chip"],[class*="pill"],[class*="badge"]')) out.push(['text-spill', `${name(e)} текст ${e.scrollWidth} > ${e.clientWidth}`]); }
      else out.push([cs.textOverflow === 'ellipsis' ? 'ellipsis' : 'clipped', `${name(e)} ${e.scrollWidth} > ${e.clientWidth}`]);
    }
  }
  if (innerWidth < 600) for (const e of inter) { const r = e.getBoundingClientRect(); if ((r.width < 32 || r.height < 32) && !e.matches('input,textarea')) out.push(['small-target', `${name(e)} ${Math.round(r.width)}×${Math.round(r.height)}`]); }
  return out;
}

const results = [];
async function audit(page, label) {
  const found = [];
  for (const frame of page.frames()) {
    try {
      const url = frame.url();
      if (!url.startsWith('http')) continue;
      const vis = await frame.evaluate(() => { const fe = window.frameElement; if (!fe) return true; const r = fe.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(fe).visibility !== 'hidden'; });
      if (!vis) continue;
      const where = frame === page.mainFrame() ? 'shell' : (url.includes('/sklad/') ? 'склад' : 'журнал');
      for (const [kind, msg] of await frame.evaluate(checkDoc)) found.push([kind, `${where}: ${msg}`]);
    } catch (e) { found.push(['script', String(e).slice(0, 120)]); }
  }
  const file = label.replace(/[^\p{L}\p{N}]+/gu, '_') + '.png';
  // повний знімок: розтягнути вікно на висоту вмісту активного документа
  const vp = page.viewportSize();
  const h = await page.evaluate(() => {
    const f = [...document.querySelectorAll('iframe')].find(x => x.getBoundingClientRect().width > 0 && getComputedStyle(x).visibility !== 'hidden' && !x.closest('[hidden]'));
    const inner = f?.contentDocument?.documentElement?.scrollHeight ?? 0;
    return Math.max(document.documentElement.scrollHeight, inner + 140);
  });
  await page.setViewportSize({ width: vp.width, height: Math.min(Math.max(h, vp.height), 9000) });
  await wait(700);
  await page.screenshot({ path: path.join(OUT, file) });
  await page.setViewportSize(vp);
  await wait(300);
  results.push({ label, file, found });
  console.log(`${label}: ${found.length} зауважень`);
}

const exe = process.env.CSS_DIFF_CHROME;
const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
const consoleErrors = [];
try {
  for (const theme of ['theme-light', 'theme-dark']) for (const viewport of [{ width: 412, height: 915 }, { width: 1280, height: 860 }]) {
    const phone = viewport.width < 600;
    const tag = `${theme === 'theme-dark' ? 'темна' : 'світла'} ${phone ? 'телефон' : 'ПК'}`;
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.addInitScript(t => { try { sessionStorage.setItem('auth', 'ok'); sessionStorage.setItem('auth_at', String(Date.now())); sessionStorage.setItem('osbb_splash_shown', '1'); localStorage.setItem('selected_theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`${tag} ${m.location()?.url?.split('/Osbb/')[1] ?? ''}: ${m.text().slice(0, 200)}`); });
    page.on('pageerror', e => consoleErrors.push(`${tag} pageerror: ${String(e).slice(0, 200)}`));
    page.on('requestfailed', r => consoleErrors.push(`${tag} requestfailed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
    await page.goto(BASE); await wait(5000);
    const sec = async s => { await page.evaluate(s => document.querySelector(`[data-shell-section="${s}"]`)?.click(), s); await wait(3500); };
    const inFrame = async (mod, fn, arg) => { const f = page.frames().find(f => f.url().includes(`/${mod}/`)); if (f) await f.evaluate(fn, arg).catch(e => console.log('  ! ' + e.message.slice(0, 100))); await wait(1500); };

    await audit(page, `${tag} · Головна`);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Звіт для керівництва'))?.click()); await wait(2500);
    await audit(page, `${tag} · Звіт для керівництва`);
    await page.keyboard.press('Escape'); await wait(500);
    await page.evaluate(() => document.querySelector('#shell-report [data-report-close], #shell-report .shell-report-close, #shell-report button[aria-label*="Закрити"]')?.click()); await wait(800);
    if (phone) { await page.evaluate(() => document.querySelector('[data-shell-more]')?.click()); await wait(800); await audit(page, `${tag} · лист «Ще»`); await page.evaluate(() => document.querySelector('[data-shell-more-close]')?.click()); await wait(600); }
    else { await page.evaluate(() => document.querySelector('[data-shell-settings]')?.click()); await wait(800); await audit(page, `${tag} · Налаштування`); await page.keyboard.press('Escape'); await wait(500); }

    await sec('completed-work'); await audit(page, `${tag} · Виконані роботи`);
    await sec('garbage'); await audit(page, `${tag} · Сміття`);
    await inFrame('osbb', () => { const d = document.querySelector('#g-days-list .is-today, #g-days-list [aria-current="date"], #g-days-list .today'); (d?.closest('button,[role=button]') ?? d)?.click(); });
    await audit(page, `${tag} · Сміття · день`);
    await inFrame('osbb', () => { document.querySelector('.day-detail-close, [data-g-action="close"], .g-day-detail-close')?.click(); document.querySelector('.garbage-chart-panel')?.setAttribute('open', ''); });
    await audit(page, `${tag} · Сміття · графік`);
    await sec('tabel'); await audit(page, `${tag} · Табель`);
    await inFrame('osbb', () => { document.querySelector('[data-att-mobile-toggle][aria-expanded="false"]')?.click(); });
    if (phone) await audit(page, `${tag} · Табель · день`);
    await sec('items'); await audit(page, `${tag} · Запаси`);
    await inFrame('sklad', () => { const m = document.querySelector('.items-list details.item-more:not(.topbar-more) summary, #itemsTable details.item-more summary, details.item-more:not(.topbar-more) > summary'); m?.click(); });
    await audit(page, `${tag} · Запаси · меню ⋯`);
    await inFrame('sklad', () => { document.querySelector('[data-item-action="edit"]')?.click(); });
    await audit(page, `${tag} · Запаси · редагування`);
    await page.keyboard.press('Escape'); await inFrame('sklad', () => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); document.querySelectorAll('.modal.open,.modal.show,.modal-backdrop.open').forEach(m => m.classList.remove('open', 'show')); });
    await inFrame('sklad', () => { document.querySelector('[data-item-action="history"]')?.click(); });
    await audit(page, `${tag} · Запаси · історія`);
    await page.keyboard.press('Escape'); await inFrame('sklad', () => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); });
    await inFrame('sklad', () => document.querySelector('[data-sklad-page="issue"]')?.click()); await audit(page, `${tag} · Видача`);
    await inFrame('sklad', () => document.querySelector('[data-sklad-page="add"]')?.click()); await audit(page, `${tag} · Додати товар`);
    await sec('log'); await audit(page, `${tag} · Рух: видачі`);
    await inFrame('sklad', () => document.querySelector('[data-sklad-page="receipts"]')?.click()); await audit(page, `${tag} · Рух: надходження`);
    await sec('audit'); await audit(page, `${tag} · Інвентаризація`);
    await sec('stats'); await audit(page, `${tag} · Статистика`);
    await sec('shifts'); await audit(page, `${tag} · Зміни (PIN)`);
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ results, consoleErrors }, null, 1));
// Відомий шум евристик: дрібні цілі, «…» навмисно, стрічки фільтрів із прокруткою вбік,
// підкладка під листом «Ще», приховані для екранних читачів підписи.
const noise = (kind, msg) => ['small-target', 'ellipsis', 'offscreen'].includes(kind) || /sr-only|scrim|rpt-seg|att-mobile-day-toggle|supplier-tag/.test(msg);
const unique = new Map();
for (const r of results) for (const [kind, msg] of r.found) {
  if (noise(kind, msg)) continue;
  const key = kind + ' ' + msg.replace(/-?\d+(\.\d+)?/g, '#');
  if (!unique.has(key)) unique.set(key, { kind, msg, where: r.label, n: 0 });
  unique.get(key).n++;
}
const errors = [...new Set(consoleErrors)];
console.log(`
Екранів: ${results.length}. Знімки й report.json: ${OUT}`);
console.log(`Помилок консолі: ${errors.length}`);
errors.slice(0, 20).forEach(e => console.log('  ' + e));
console.log(`Зауважень верстки: ${unique.size}`);
for (const u of [...unique.values()].sort((a, b) => a.kind.localeCompare(b.kind))) console.log(`  ${u.kind.padEnd(10)} ${u.msg.slice(0, 160)}  [${u.n}× · ${u.where}]`);
if (errors.length) process.exitCode = 1;
