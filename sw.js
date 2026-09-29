// Offline support. Every file the game needs is listed below and saved on
// first visit, so the game works with no signal afterwards.
// ⚠️ Change CACHE_NAME (v1 → v2 → …) EVERY time you publish a change, or players
// keep the old version. Add any new file to PRECACHE_URLS.
const CACHE_PREFIX = 'da-most-aura-';
const CACHE_NAME   = CACHE_PREFIX + 'v1';

const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/lib/tailwind-play.js',
  'js/engine.js',
  'js/foods.js',
  'js/game.js',
  'fonts/fredoka-latin.woff2',
  'fonts/fredoka-latin-ext.woff2',
  'icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      // Only this game's old caches: on username.github.io every repo shares one
      // origin, so another game's cache must never be touched.
      .then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first; anything not precached is fetched and kept — but only a complete
// 200, so a failed or missing file is never remembered as the answer.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
      if (res.status === 200 && new URL(event.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
      }
      return res;
    }))
  );
});
