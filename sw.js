const CACHE_NAME = 'gathoni-admin-pwa-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/admin.html',
  '/index.css',
  '/app.js',
  '/assets/favicon/site.webmanifest',
  '/assets/favicon/admin.webmanifest',
  '/assets/favicon/android-chrome-192x192.png',
  '/assets/favicon/android-chrome-512x512.png',
  '/assets/favicon/favicon.ico',
  '/assets/style_by_gathoni.svg',
  '/assets/hero.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests, skip Firestore / API calls dynamically
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests unless they are specific CDNs (like fonts), 
  // but for safety, we focus on same-origin caching with network first.
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network First strategy
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache the dynamically fetched response if it is successful
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
  );
});
