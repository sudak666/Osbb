const CACHE_NAME = 'osbb-journal-v3';
const urlsToCache = [
  '/Osbb/',
  '/Osbb/index.html',
  '/Osbb/manifest.json',
  '/Osbb/icon-192.png',
  '/Osbb/icon-512.png'
];

// Встановлення кешу
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Стратегія кешування
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Повертаємо з кешу якщо є, інакше з мережі
        return response || fetch(event.request);
      })
  );
});