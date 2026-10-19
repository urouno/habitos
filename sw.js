/* Hábitos · Service Worker
   Guarda la app en el teléfono para que abra sin internet.
   Los datos viven en el teléfono (localStorage) y se suben a Google Sheets
   en cuanto hay conexión; las llamadas a Apps Script siempre van directo a la red.
   Si cambias index.html, sube el número de versión para forzar la actualización. */
const CACHE = 'habitos-v3';
const ASSETS = ['./', './index.html', './manifest.json', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function guardar(req, res) {
  if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Apps Script y otros: directo a la red

  // Página principal: primero la red (para recibir actualizaciones), si tarda o no hay red, la copia guardada
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(new Promise(resolve => {
      let listo = false;
      const desdeCache = () => caches.match(req, { ignoreSearch: true })
        .then(r => r || caches.match('./index.html'))
        .then(r => { if (!listo && r) { listo = true; resolve(r); } return r; });
      const timer = setTimeout(desdeCache, 3500);
      fetch(req).then(res => {
        clearTimeout(timer);
        guardar(req, res);
        if (!listo) { listo = true; resolve(res); }
      }).catch(() => {
        clearTimeout(timer);
        desdeCache().then(r => { if (!listo) { listo = true; resolve(r || new Response('Sin conexión', { status: 503 })); } });
      });
    }));
    return;
  }

  // Íconos, manifest, etc.: primero la copia guardada
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => guardar(req, res))));
});
