// Cache file aplikasi supaya Studio Foto tetap terbuka tanpa internet.
const C = 'studiofoto-v14';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'charts.js', 'closing.js', 'sinkron.js', 'manifest.json', 'icon.svg', 'ikon-192.png', 'ikon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // network-first supaya update langsung terasa, cache sebagai cadangan offline
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
