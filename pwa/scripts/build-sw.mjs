import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const assets=(await readdir('dist/assets')).filter(n=>/\.(js|css)$/.test(n)).map(n=>'/assets/'+n);
const shell=['/','/index.html','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/fonts/Roboto-Android.woff2','/fonts/MaterialSymbols-AndroidUI.ttf','/fonts/MaterialSymbols-AndroidFilled.ttf',...assets];
const fingerprint=createHash('sha256').update(JSON.stringify(shell));
for(const path of shell)fingerprint.update(await readFile('dist'+(path==='/'?'/index.html':path)));
const version=fingerprint.digest('hex').slice(0,16);
await writeFile('dist/sw.js',`const CACHE='gdpeto-shell-${version}',FILES=${JSON.stringify(shell)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new Request(path,{cache:'reload'}))))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gdpeto-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
if(event.request.mode==='navigate'){event.respondWith(caches.open(CACHE).then(async cache=>{const stored=await Promise.all(FILES.map(path=>cache.match(path)));return stored.every(Boolean)?cache.match('/index.html'):fetch(event.request)}));return;}
if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
});`);
console.log('Shell instalable generado: '+shell.length+' recursos; API, imágenes, OCR y documentos excluidos.');
