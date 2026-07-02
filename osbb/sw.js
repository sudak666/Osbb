const CACHE_NAME = 'osbb-journal-v4';
const urlsToCache = [
  '/Osbb/',
  '/Osbb/index.html',
  '/Osbb/manifest.json',
  '/Osbb/icon-192.png',
  '/Osbb/icon-512.png'
];

// Встановлення — кешуємо ресурси, старий кеш видаляємо
self.addEventListener('install', event => {
  self.skipWaiting(); // Активуємо одразу, не чекаємо закриття вкладки
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Активація — видаляємо всі старі версії кешу
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // Одразу беремо контроль над всіма вкладками
  );
});

// Стратегія: Network First для HTML, Cache First для статики
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isHTML = event.request.destination === 'document' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/Osbb/' ||
                 url.pathname === '/Osbb';

  if (isHTML) {
    // HTML — завжди спочатку мережа, кеш тільки як fallback офлайн
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          // Зберігаємо свіжу версію в кеш
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)) // Офлайн — беремо з кешу
    );
  } else {
    // Статика (іконки, manifest) — Cache First
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
  }
});
