
const key='gdp-pages-ff253d3aa351';
self.addEventListener('install',e=>e.waitUntil(caches.open(key).then(c=>c.addAll(["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon.svg","./apple-touch-icon.png","./assets/app-VKEUFMCV.js","./assets/app-UVOEMWW7.css","./assets/transport-e9d9c438.js","./fonts/Roboto-Android.woff2","./fonts/MaterialSymbols-AndroidUI.ttf","./fonts/MaterialSymbols-AndroidFilled.ttf"]))));
// The app's "Actualizar" button asks the waiting worker to take over (as the gateway build's sw does).
self.addEventListener('message',e=>{if(e.data&&e.data.type==='ACTIVATE')self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gdp-pages-')&&k!==key).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==location.origin||!url.href.startsWith(self.registration.scope))return;
  if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('./')));
  // Files named by their content never change: from the cache first, and kept once fetched.
  else if(url.pathname.includes('/assets/')||url.pathname.includes('/fonts/'))e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(key).then(c=>c.put(e.request,copy))}return r})));
});
