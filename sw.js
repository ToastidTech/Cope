const CACHE = 'cope-v20';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo-192.png',
  './logo-512.png',
  './splash-logo.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Keep external services network-only. AI requests use the same-origin
  // backend and are intentionally never cached.
  if (url.includes('/api/cope-ai') ||
      url.includes('fonts.googleapis.com') ||
      url.includes('square.link') ||
      url.includes('youtube.com') ||
      url.includes('img.youtube.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
