const CACHE = 'cope-v21';
const ASSETS = ['./','./index.html','./manifest.json','./lead-capture.js','./logo-192.png','./logo-512.png','./splash-logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('/api/') || url.includes('fonts.googleapis.com') || url.includes('square.link') || url.includes('youtube.com') || url.includes('img.youtube.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  if (e.request.mode === 'navigate' || url.endsWith('/index.html')) {
    e.respondWith(fetch(e.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return response;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
