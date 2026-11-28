// Service worker de la web publicada. build.mjs pone los valores de GDP_*.
const prefix = 'gdp-pages-';
const key = prefix + "9de7a58f0dca";
// Lo que hace falta para abrir, y lo que además puede llegar después (PDF).
const startup = ["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon.svg","./apple-touch-icon.png","./assets/app-XDKHI2QM.js","./assets/c-427Z5ASM.js","./assets/app-8795F9F7.css","./assets/transport-8921229a.js","./fonts/Roboto-Android-708951ba.woff2","./fonts/MaterialSymbols-AndroidUI-846aab11.ttf","./fonts/MaterialSymbols-AndroidFilled-9d2efe1e.ttf"];
const kept = ["./assets/c-4ABTDGTZ.js","./assets/c-MSECQALX.js","./assets/c-UW2PRYP5.js","./fonts/NotoSans-Regular-b85c38ec.ttf"];
// Sin cualquiera de estos la app no abre o abre sin diseño: la copia sólo vale si están todos.
const essential = ["./assets/app-XDKHI2QM.js","./assets/c-427Z5ASM.js","./assets/app-8795F9F7.css","./assets/transport-8921229a.js"];
const hashed = url => url.pathname.includes('/assets/') || url.pathname.includes('/fonts/');

// Los archivos con huella no cambian nunca: si la versión anterior ya los tiene, no se vuelven a
// descargar. El resto se pide sin pasar por la copia de 10 minutos del navegador.
async function fill(cache, path) {
  const url = new URL(path, self.location.href);
  const known = hashed(url) ? await caches.match(url.href) : undefined;
  const response = known || await fetch(new Request(url.href, {cache: 'reload'}));
  if (!response.ok) throw Error(path + ': ' + response.status);
  await cache.put(url.href, response);
}
self.addEventListener('install', event => event.waitUntil(
  caches.open(key).then(cache => Promise.all(startup.map(path => fill(cache, path))))));

// The app's "Actualizar" button asks the waiting worker to take over (as the gateway build's sw does).
self.addEventListener('message', event => { if (event.data && event.data.type === 'ACTIVATE') self.skipWaiting(); });

// Al actualizar se conservan las piezas opcionales que siguen siendo las mismas (las del PDF).
async function tidy() {
  const cache = await caches.open(key);
  for (const path of kept) {
    const href = new URL(path, self.location.href).href;
    if (await cache.match(href)) continue;
    const old = await caches.match(href);
    if (old) await cache.put(href, old);
  }
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith(prefix) && name !== key).map(name => caches.delete(name)));
  await self.clients.claim();
}
self.addEventListener('activate', event => event.waitUntil(tidy()));

// La app se abre con la copia guardada, sin esperar a la red. La versión nueva la busca el navegador
// por detrás (sw.js) y se ofrece con «Actualizar». Sin copia completa, se pide a la red.
async function open(request) {
  const cache = await caches.open(key);
  const [page, ...files] = await Promise.all(['./', ...essential].map(path => cache.match(path)));
  if (page && files.every(Boolean)) return page;
  try { return await fetch(request); } catch { return page || Response.error(); }
}
async function asset(request) {
  const cache = await caches.open(key);
  const hit = await cache.match(request) || await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) { const copy = response.clone(); cache.put(request, copy).catch(() => {}); }
  return response;
}
const home = new URL('./', self.location.href).pathname;
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    if (url.pathname === home || url.pathname === home + 'index.html') event.respondWith(open(request));
  } else if (hashed(url)) event.respondWith(asset(request));
});
