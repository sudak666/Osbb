const CACHE_NAME = 'osbb-shell-v3';
const urlsToCache = [
  '/Osbb/',
  '/Osbb/index.html',
  '/Osbb/styles.css',
  '/Osbb/shared/ui.css',
  '/Osbb/manifest.json',
  '/Osbb/icon-192.png',
  '/Osbb/icon-512.png'
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

// Обробляємо лише запити самої shell-оболонки (корінь сайту). Розділи
// /Osbb/osbb/ та /Osbb/sklad/ мають власні service worker'и з власним
// scope і цей файл їх не чіпає.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isShellPath = url.pathname === '/Osbb/' || url.pathname === '/Osbb/index.html';
  const isShellStatic = url.pathname === '/Osbb/styles.css' ||
                         url.pathname === '/Osbb/shared/ui.css' ||
                         url.pathname === '/Osbb/manifest.json' ||
                         url.pathname === '/Osbb/icon-192.png' ||
                         url.pathname === '/Osbb/icon-512.png';

  if (isShellPath) {
    // HTML — мережа спочатку, кеш лише як офлайн-fallback
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else if (isShellStatic) {
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
  }
  // Все інше (вкладені /Osbb/osbb/*, /Osbb/sklad/*, Supabase, CDN) —
  // не перехоплюємо, лишаємо звичайній мережі/іншим service worker'ам.
});
