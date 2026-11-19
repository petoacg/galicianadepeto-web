
const key='gdp-pages-f11751e3d3b7';
self.addEventListener('install',e=>e.waitUntil(caches.open(key).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon.svg','./apple-touch-icon.png']))));
// The app's "Actualizar" button asks the waiting worker to take over (as the gateway build's sw does).
self.addEventListener('message',e=>{if(e.data&&e.data.type==='ACTIVATE')self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gdp-pages-')&&k!==key).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==location.origin||!url.href.startsWith(self.registration.scope))return;
  if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('./')));
});
