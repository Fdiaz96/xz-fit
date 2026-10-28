// Cachea la app para que abra sin conexión.
const CACHE = 'tendon-v1-28-0';
const FILES = ['./', 'index.html', 'styles.css', 'data.js', 'logic.js', 'figures.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'fonts/Oswald.woff2', 'CHANGELOG.md'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // solo archivos de la app
  // Red primero, validando con el servidor para recibir actualizaciones al instante; caché si no hay conexión.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
