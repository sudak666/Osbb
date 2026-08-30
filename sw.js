const CACHE_NAME = 'osbb-shell-v10';
const urlsToCache = [
  '/Osbb/',
  '/Osbb/index.html',
  '/Osbb/styles.css',
  '/Osbb/shared/ui.css',
  '/Osbb/shared/material-tokens.css',
  '/Osbb/shared/material-symbols-ready.js',
  '/Osbb/shared/enhance-select.js',
  '/Osbb/shared/enhance-date.js',
  '/Osbb/manifest.json',
  '/Osbb/icon-192.png',
  '/Osbb/icon-512.png',
  '/Osbb/icon.svg'
];

// Встановлення — кешуємо ресурси самої shell-оболонки, старий кеш видаляємо
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Активація — видаляємо всі старі версії кешу
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isShellPath = url.pathname === '/Osbb/' || url.pathname === '/Osbb/index.html';
  const isAppDocument = event.request.mode === 'navigate' &&
    (url.pathname.startsWith('/Osbb/osbb/') ||
     url.pathname.startsWith('/Osbb/sklad/') ||
     url.pathname.startsWith('/Osbb/promin/'));
  const isVersionedAsset = url.origin === self.location.origin && url.pathname.startsWith('/Osbb/assets/');
  const isShellStatic = url.pathname === '/Osbb/styles.css' ||
                         url.pathname === '/Osbb/shared/ui.css' ||
                         url.pathname === '/Osbb/shared/material-tokens.css' ||
                         url.pathname === '/Osbb/shared/material-symbols-ready.js' ||
                         url.pathname === '/Osbb/shared/enhance-select.js' ||
                         url.pathname === '/Osbb/shared/enhance-date.js' ||
                         url.pathname === '/Osbb/manifest.json' ||
                         url.pathname === '/Osbb/icon-192.png' ||
                         url.pathname === '/Osbb/icon-512.png';

  if (isShellPath || isAppDocument) {
    // HTML завжди звіряємо з мережею, щоб він не посилався на assets минулого деплою.
    event.respondWith(networkFirst(event.request));
  } else if (isVersionedAsset) {
    // Хешовані Vite-assets не змінюються: зберігаємо попередні версії для вкладок
    // зі старим HTML, які могли залишитися відкритими під час нового деплою.
    event.respondWith(cacheFirst(event.request));
  } else if (isShellStatic) {
    // Shared design tokens change independently from hashed Vite assets.
    // Prefer the network so an old cached stylesheet cannot invalidate new CSS variables.
    event.respondWith(networkFirst(event.request));
  }
  // Supabase, CDN та інші запити лишаємо звичайній мережі.
});
