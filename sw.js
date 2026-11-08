// Cache file aplikasi supaya Studio Foto tetap terbuka tanpa internet.
const C = 'studiofoto-v21';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'charts.js', 'closing.js', 'sinkron.js', 'notif.js', 'manifest.json', 'icon.svg', 'ikon-192.png', 'ikon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // network-first supaya update langsung terasa, cache sebagai cadangan offline
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

// Notifikasi booking baru (dikirim lewat Apps Script dari perangkat yang menyimpan booking)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { isi: e.data && e.data.text() }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.judul || 'FotoFauk Studio', { body: d.isi || 'Ada booking baru', icon: 'ikon-192.png', badge: 'ikon-192.png', tag: d.tag || 'booking', renotify: true, vibrate: [200, 100, 200], data: { url: d.url || './' } }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage({ jenis: 'push', d })))
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) return c.navigate(url).then(w => (w || c).focus()).catch(() => c.focus());
    return self.clients.openWindow(url);
  }));
});
