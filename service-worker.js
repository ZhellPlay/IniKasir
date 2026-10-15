const CACHE_NAME = 'ini-kasir-v3';
const externalUrlsToCache = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11.14.5/dist/sweetalert2.min.css',
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-analytics-compat.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11.14.5/dist/sweetalert2.all.min.js',
  'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

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
  'js/offline.js',
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
    }).then(async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(externalUrlsToCache.map(async url => {
        try {
          const response = await fetch(url, { cache: 'no-store' });
          if (response.ok || response.type === 'opaque') await cache.put(url, response);
        } catch (_) { }
      }));
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
  const isExternal = url.origin !== self.location.origin;
  const isFirebase = url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic');
  const isCDN = url.hostname.includes('cdn') ||
    url.hostname.includes('cdnjs') ||
    url.hostname.includes('jsdelivr');

  if (isExternal || isFirebase || isCDN) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(response => {
          if (response && (response.ok || response.type === 'opaque')) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone())).catch(() => { });
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

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
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone))
            .catch(() => { });

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
