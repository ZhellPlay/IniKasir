const CACHE_NAME = 'ini-kasir-v3';
const urlsToCache = [
  './',
  'index.html',
  'style.css',
  'style-upgrade.css',
  'manifest.json',
  'logo.png',
  'logo-192.png',
  'logo-maskable.png',
  'js/init.js',
  'js/utils.js',
  'js/layout.js',
  'js/sortableTable.js',
  'js/state.js',
  'js/auth.js',
  'js/realtime.js',
  'js/kasir.js',
  'js/history.js',
  'js/menuManager.js',
  'js/bahanManager.js',
  'js/modifierManager.js',
  'js/laporan.js',
  'js/settings.js',
  'js/pengeluaran.js',
  'js/printer.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        urlsToCache.map(url =>
          cache.add(url).catch(() => { })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isExternal = !url.origin.includes(self.location.origin.split('//')[1]);
  const isFirebase = url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic');
  const isCDN = url.hostname.includes('cdn') ||
    url.hostname.includes('cdnjs') ||
    url.hostname.includes('jsdelivr');

  if (isExternal || isFirebase || isCDN) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;

        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 ||
            networkResponse.type === 'opaque') {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });

          return networkResponse;
        });
      })
      .catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      })
  );
});