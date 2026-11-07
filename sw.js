
const key='gdp-pages-090fa105bc13';
self.addEventListener('install',e=>e.waitUntil(caches.open(key).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon.svg','./apple-touch-icon.png']))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gdp-pages-')&&k!==key).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==location.origin||!url.href.startsWith(self.registration.scope))return;
  if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('./')));
});
