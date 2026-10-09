// Service Worker — CSK Business OS
// Strategi: NETWORK-FIRST untuk HTML (biar update app langsung kepakai),
// cache-first untuk aset statis (logo, manifest).
const CACHE_NAME = 'csk-business-os-v2.4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo-horizontal.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHTML = event.request.mode === 'navigate' ||
                 (event.request.headers.get('accept') || '').includes('text/html') ||
                 url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // NETWORK-FIRST: selalu coba ambil versi terbaru, cache hanya sebagai fallback offline
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST untuk aset statis
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});
