// Service Worker — CSK Business OS
// Strategi: NETWORK-FIRST untuk HTML (biar update app langsung kepakai),
// cache-first untuk aset statis (logo, manifest).
const CACHE_NAME = 'csk-business-os-optimization-v4-20261103';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sync-safe.js',
  './hpp-calculator.js',
  './hpp-ui.js',
  './email-marketing.js',
  './email-marketing-ui.js',
  './persona-leads.js',
  './operations-core.js',
  './operations-ui.js',
  './logo-horizontal.svg',
  './favicon.svg',
  './app-icon.svg'
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

// Cache only the pinned/static presentation dependencies. Apps Script API
// hosts are deliberately excluded so token-bearing GET requests are never cached.
const THIRD_PARTY_STATIC_HOSTS = new Set([
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
]);

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    const staticDestination = ['script', 'style', 'font'].includes(event.request.destination);
    if (!THIRD_PARTY_STATIC_HOSTS.has(url.hostname) || !staticDestination) return;
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(event.request, response.clone());
      }
      return response;
    })());
    return;
  }
  const isHTML = event.request.mode === 'navigate' ||
                 (event.request.headers.get('accept') || '').includes('text/html') ||
                 url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // NETWORK-FIRST: selalu coba ambil versi terbaru, cache hanya sebagai fallback offline
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const copy = resp.clone();
          if (resp.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST untuk aset statis
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
