const CACHE = 'cope-v19';
const ASSETS = [
  '/Cope/',
  '/Cope/index.html',
  '/Cope/manifest.json',
  '/Cope/logo-192.png',
  '/Cope/logo-512.png',
  '/Cope/splash-logo.png',
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

  // During the AWS migration, requests from the legacy Cope client to the
  // retired Cloudflare AI endpoint are redirected to the same-origin AWS API.
  // This keeps already-installed PWAs from continuing to depend on Cloudflare.
  if (url.includes('muddy-violet-2a0d.toastidtechllc.workers.dev') &&
      !url.includes('/validate-order')) {
    e.respondWith(
      fetch('/api/cope-ai', {
        method: e.request.method,
        headers: { 'Content-Type': 'application/json' },
        body: e.request.method === 'GET' || e.request.method === 'HEAD' ? undefined : e.request.clone().body
      })
    );
    return;
  }

  if (url.includes('fonts.googleapis.com') || url.includes('square.link') || url.includes('youtube.com') || url.includes('img.youtube.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
