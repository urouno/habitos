// Hábitos: funciona sin conexión. Cambia la versión cuando subas cambios para forzar la actualización.
const PREFIJO = 'habitos-';
const CACHE = PREFIJO + 'v8';
const ARCHIVOS = ['./', './index.html', './manifest.json', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];
const ESPERA_RED = 4000; // ms antes de usar la copia guardada si la red está muy lenta

self.addEventListener('install', e => {
  // Cada archivo por separado: si uno falla, la app igual queda instalada sin conexión.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ARCHIVOS.map(a => c.add(new Request(a, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // Solo se borran versiones viejas de esta app, no las cachés de otras apps del mismo dominio.
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIJO) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // Google Apps Script y demás: siempre a la red

  const guardada = () => caches.match(e.request, { ignoreSearch: true })
    .then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));

  // Primero la red (para recibir actualizaciones); si no hay internet o tarda demasiado, la copia guardada.
  const red = fetch(e.request).then(r => {
    if (r.ok && !url.search) { const copia = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {})); }
    return r;
  });
  const lenta = new Promise(res => setTimeout(res, ESPERA_RED)).then(guardada);

  e.respondWith(
    Promise.race([red.catch(() => undefined), lenta])
      .then(r => r || red.catch(() => guardada()))
      .then(r => r || Response.error())
  );
});
