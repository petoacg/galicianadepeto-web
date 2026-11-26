import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const project = new URL('../../', import.meta.url);
const output = new URL('./build/', import.meta.url);
// Fonts the page asks for only when a character needs them (unicode-range).
const lazyFonts = [];
const { outputFiles } = await build({
  absWorkingDir: fileURLToPath(project),
  entryPoints: ['src/main.tsx'],
  outdir: 'out',
  write: false,
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' },
  jsx: 'automatic',
  external: ['/fonts/*'],
});
const script = outputFiles.find(file => file.path.endsWith('.js')).text;
let css = outputFiles.find(file => file.path.endsWith('.css')).text;
for (const match of [...css.matchAll(/url\(["']?\/fonts\/([\w.-]+)["']?\)/g)]) {
  const name = match[1];
  const font = await readFile(new URL('public/fonts/' + name, project));
  const mime = name.endsWith('.woff2') ? 'font/woff2' : 'font/ttf';
  css = css.replace(match[0], 'url(data:' + mime + ';base64,' + font.toString('base64') + ')');
}
const pdfFont = await readFile(new URL('public/fonts/NotoSans-Regular.ttf', project));
const transport = (await readFile(new URL('./transport.js', import.meta.url), 'utf8')).replace('GDP_PDF_FONT_BASE64', () => pdfFont.toString('base64'));
const alto = await readFile(new URL('./alto.js', import.meta.url), 'utf8');
const pack = js => gzipSync(JSON.stringify({ css, script: alto + transport + '\n' + js })).toString('base64');
const packed = pack(script);
const html = `<!doctype html>
<html lang="gl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content">
<meta name="color-scheme" content="dark">
<title>Galiciana de Peto</title>
<style>body{background:#101a23;color:#e5edf3;font:16px system-ui;margin:0}#gdp-splash{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;background:#101a23;transition:opacity .2s cubic-bezier(.2,0,0,1)}#gdp-splash.out{opacity:0;pointer-events:none}#gdp-splash svg{width:76px;height:76px}#gdp-splash .bar{position:relative;width:112px;height:3px;border-radius:2px;background:#253d50;overflow:hidden}#gdp-splash .bar::after{content:'';position:absolute;top:0;bottom:0;left:0;width:40%;border-radius:2px;background:#8bccff;animation:gdp-splash 1.2s cubic-bezier(.4,0,.2,1) infinite}@keyframes gdp-splash{from{transform:translateX(-100%)}to{transform:translateX(250%)}}#gdp-splash p{margin:0;max-width:280px;text-align:center;color:#b2c3d0;font-size:14px;line-height:20px}.gdp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}@media (prefers-reduced-motion:reduce){#gdp-splash .bar::after{width:100%;transform:none;animation:gdp-splash-breathe 2s ease-in-out infinite}}@keyframes gdp-splash-breathe{50%{opacity:.5}}@media (prefers-color-scheme:light){body,#gdp-splash{background:#f1f5f9;color:#161c22}#gdp-splash .bar{background:#d2e5f6}#gdp-splash .bar::after{background:#1f6394}#gdp-splash p{color:#40484f}}</style>
</head><body><div id="gdp-splash" role="status"><svg viewBox="0 0 28 28" aria-hidden="true"><path d="M2.2 12.9 C2.2 6.1 7.4 1.6 14 1.6 S25.8 6.1 25.8 12.9 L20.2 21.8 Q14 27.4 7.8 21.8 Z" fill="#7ec8e3" stroke="#12384f" stroke-width=".9" stroke-linejoin="round"/><g stroke="#12384f" stroke-width=".8" stroke-linecap="round"><path d="M14 21.8 L14 3.4"/><path d="M14 21.8 L9 4.3"/><path d="M14 21.8 L19 4.3"/><path d="M14 21.8 L5 7.1"/><path d="M14 21.8 L23 7.1"/><path d="M14 21.8 L3 11.4"/><path d="M14 21.8 L25 11.4"/></g></svg><div class="bar"></div><span class="gdp-sr" id="gdp-splash-text">Abrindo Galiciana de Peto…</span></div><div id="root"></div><script>try{if(localStorage.getItem('ui_language')==='es')document.getElementById('gdp-splash-text').textContent='Abriendo Galiciana de Peto…'}catch(e){}</script>
<script>
(async function () {
  const root = document.getElementById('root');
  try {
    const bytes = Uint8Array.from(atob('${packed}'), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const bundle = await new Response(stream).json();
    const style = document.createElement('style');
    style.textContent = bundle.css;
    document.head.append(style);
    const script = document.createElement('script');
    script.textContent = bundle.script;
    document.body.append(script);
  } catch (error) {
    const splash = document.getElementById('gdp-splash'); splash.querySelector('.bar')?.remove(); const note = document.createElement('p'); note.textContent = (()=>{try{return localStorage.getItem('ui_language')==='es'}catch(e){return false}})() ? 'No se pudo iniciar Galiciana de Peto. Vuelve a cargar la página.' : 'Non se puido iniciar Galiciana de Peto. Volve cargar a páxina.'; splash.append(note);
    console.error(error);
  }
})();
</script></body></html>`;
await mkdir(output, { recursive: true });
await writeFile(new URL('Index.txt', output), html);

const endpoint = process.env.GDP_APPS_SCRIPT_URL;
// GitHub Pages needs only the client. The standalone Apps Script build also needs the gateway source.
if (!endpoint) {
  await writeFile(new URL('Code.txt', output), await readFile(new URL('../../../docs/apps-script/Code.gs', import.meta.url)));
}
if (endpoint) {
  const apiUrl = new URL(endpoint);
  if (apiUrl.origin !== 'https://script.google.com' || !/^\/macros\/s\/[\w-]+\/exec$/.test(apiUrl.pathname) || apiUrl.search || apiUrl.hash) {
    throw Error('GDP_APPS_SCRIPT_URL debe ser una URL de despliegue /exec.');
  }
  const site = new URL('./pages/', output);
  await mkdir(site, {recursive:true});
  // GitHub Pages serves files on their own, compressed: the app is split by need. The PDF
  // tools and their font arrive only when a PDF is asked for; everything is kept by sw.js.
  await rm(new URL('assets/',site),{recursive:true,force:true});
  await rm(new URL('fonts/',site),{recursive:true,force:true});
  const split = await build({
    absWorkingDir: fileURLToPath(project), entryPoints: {app:'src/main.tsx'}, outdir: 'out', write: false,
    bundle: true, minify: true, splitting: true, format: 'esm', target: 'es2022',
    entryNames: '[name]-[hash]', chunkNames: 'c-[hash]', metafile: true,
    define: { 'process.env.NODE_ENV': '"production"' }, jsx: 'automatic', external: ['/fonts/*'],
  });
  await mkdir(new URL('assets/',site),{recursive:true});
  await mkdir(new URL('fonts/',site),{recursive:true});
  const files = [];
  let entryJs, entryCss;
  // Fonts carry their fingerprint too: an update downloads only what really changed.
  const fontFiles = new Set(), startupFonts = [];
  const publishFont = async name => {
    const bytes = await readFile(new URL('public/fonts/' + name, project));
    const dot = name.lastIndexOf('.');
    const published = name.slice(0,dot) + '-' + createHash('sha256').update(bytes).digest('hex').slice(0,8) + name.slice(dot);
    await writeFile(new URL('fonts/' + published, site), bytes);
    fontFiles.add(published);
    return published;
  };
  const pdfFontName = await publishFont('NotoSans-Regular.ttf');
  for (const file of split.outputFiles) {
    const name = file.path.split('/').pop();
    let text = file.text;
    if (name.endsWith('.css')) {
      const named = new Map([['NotoSans-Regular.ttf', pdfFontName]]);
      for (const [, f] of text.matchAll(/url\(["']?\/fonts\/([\w.-]+)["']?\)/g)) if (!named.has(f)) {
        named.set(f, await publishFont(f));
        if (!lazyFonts.includes(f)) startupFonts.push(named.get(f));
      }
      text = text.replace(/url\(["']?\/fonts\/([\w.-]+)["']?\)/g, (_, f) => 'url(../fonts/' + named.get(f) + ')');
      // The name is the fingerprint of what is written, fonts included.
      entryCss = 'app-' + createHash('sha256').update(text).digest('hex').slice(0,8).toUpperCase() + '.css';
      await writeFile(new URL('assets/' + entryCss, site), text);
      files.push('./assets/' + entryCss);
      continue;
    }
    if (!name.endsWith('.js')) continue;
    text = text.replaceAll('"/sw.js"','"./sw.js"');
    if (name.startsWith('app-')) entryJs = name;
    await writeFile(new URL('assets/' + name, site), text);
    files.push('./assets/' + name);
  }
  const textFont = startupFonts.find(f => f.startsWith('Roboto-Android'));
  const iconFont = startupFonts.find(f => f.startsWith('MaterialSymbols-AndroidUI'));
  const filledFont = startupFonts.find(f => f.startsWith('MaterialSymbols-AndroidFilled'));
  if (!textFont || !iconFont || !filledFont) throw Error('No se encontraron las fuentes de arranque.');
  const pagesTransport = alto + (await readFile(new URL('./transport.js', import.meta.url), 'utf8')).replace(
    "return new Response(decode('GDP_PDF_FONT_BASE64'), {headers:{'Content-Type':'font/ttf'}});",
    "return fetchOriginal(new URL('fonts/" + pdfFontName + "', document.baseURI));");
  if (pagesTransport.includes('GDP_PDF_FONT_BASE64')) throw Error('transport.js: no se pudo cambiar la fuente del PDF.');
  const transportName = 'transport-' + createHash('sha256').update(pagesTransport).digest('hex').slice(0,8) + '.js';
  await writeFile(new URL('assets/' + transportName, site), pagesTransport);
  files.push('./assets/' + transportName);
  const loaderStart = html.indexOf('<script>\n(async function');
  const failure = html.slice(html.indexOf("const splash = document.getElementById('gdp-splash')", loaderStart), html.indexOf('console.error(error);', loaderStart));
  // What WhatsApp, Telegram and the rest show when the link is shared.
  const home = 'https://petoacg.github.io/galicianadepeto-web/';
  const about = JSON.parse(await readFile(new URL('public/manifest.webmanifest',project),'utf8')).description + ' Aplicación independente.';
  const preview = '<meta name="description" content="' + about + '">' + Object.entries({type:'website',site_name:'Galiciana de Peto',title:'Galiciana de Peto',
    description:about,url:home,image:home+'compartir.jpg','image:width':1200,'image:height':630,'image:type':'image/jpeg',
    'image:alt':'Galiciana de Peto: persoas, lugares e historias entre as súas páxinas',locale:'gl_ES','locale:alternate':'es_ES'})
    .map(([name,value]) => '<meta property="og:' + name + '" content="' + value + '">').join('') + '<meta name="twitter:card" content="summary_large_image">';
  // The app's stylesheet goes after the splash's inline style, so the app's body rules win.
  const page = html.slice(0, loaderStart).replace('<title>', () =>
    preview + '<meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#15222d">' +
    '<link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="./icon.svg">' +
    '<link rel="apple-touch-icon" href="./apple-touch-icon.png">' +
    '<link rel="preconnect" href="https://biblioteca.galiciana.gal"><link rel="preconnect" href="https://script.google.com" crossorigin><link rel="preconnect" href="https://script.googleusercontent.com" crossorigin>' +
    // Fonts the first screen needs, asked for with the page instead of after the stylesheet: the
    // icons always (they stay blank until their font arrives); Roboto only where it is the letter,
    // not on Apple devices, which read in their own (main.tsx, html.apple).
    '<script>(function(){function p(h,t){var l=document.createElement("link");l.rel="preload";l.as="font";l.type=t;l.crossOrigin="";l.href=h;document.head.appendChild(l)}' +
    'p("./fonts/' + iconFont + '","font/ttf");p("./fonts/' + filledFont + '","font/ttf");if(/Macintosh|iPhone|iPad|iPod/.test(navigator.userAgent))document.documentElement.classList.add("apple");else p("./fonts/' + textFont + '","font/woff2")})()</script>' +
    '<script>globalThis.gdpAppsScriptEndpoint=' + JSON.stringify(apiUrl.href) + ';globalThis.gdpFail=function(){' + failure + 'navigator.serviceWorker?.getRegistration().then(r=>r?.waiting?.postMessage({type:"ACTIVATE"}));};</script><title>').replace('</head>', () => '<link rel="stylesheet" href="./assets/' + entryCss + '"></head>') +
    '<script src="./assets/' + transportName + '"></script>' +
    '<script type="module" src="./assets/' + entryJs + '" onerror="gdpFail()"></script></body></html>';
  await writeFile(new URL('index.html',site),page);
  await writeFile(new URL('.nojekyll',site),'');
  // The repository's description: what the app does and how to install it, step by step.
  await copyFile(new URL('pages-README.md',project),new URL('README.md',site));
  const manifest = JSON.parse(await readFile(new URL('public/manifest.webmanifest',project),'utf8'));
  Object.assign(manifest,{id:'./',start_url:'./',scope:'./',
    // Lets the browser tab know the app is already installed on this phone (getInstalledRelatedApps).
    related_applications:[{platform:'webapp',url:'https://petoacg.github.io/galicianadepeto-web/manifest.webmanifest'}]});
  for (const icon of manifest.icons) icon.src = '.' + icon.src;
  for (const shot of manifest.screenshots ?? []) shot.src = '.' + shot.src;
  // Shortcuts (long press on the icon) and the share target live under the site's folder too.
  for (const cut of manifest.shortcuts ?? []) { cut.url = '.' + cut.url; for (const icon of cut.icons ?? []) icon.src = '.' + icon.src; }
  if (manifest.share_target) manifest.share_target.action = '.' + manifest.share_target.action;
  // The store-like install sheet of Chrome shows these images.
  await mkdir(new URL('screenshots/',site),{recursive:true});
  for (const shot of manifest.screenshots ?? []) await copyFile(new URL('public'+shot.src.slice(1),project),new URL(shot.src.slice(2),site));
  await writeFile(new URL('manifest.webmanifest',site),JSON.stringify(manifest));
  for (const name of ['icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png','install-badge.svg','compartir.jpg']) {
    await copyFile(new URL('public/'+name,project),new URL(name,site));
  }
  // What the entry imports directly is needed to open; what it asks for with import() is not.
  const shared = new Set();
  const follow = name => { for (const {path, kind} of split.metafile.outputs['out/' + name].imports) {
    const file = path.split('/').pop();
    if (kind === 'import-statement' && file.endsWith('.js') && !shared.has('./assets/' + file)) { shared.add('./assets/' + file); follow(file); }
  } };
  follow(entryJs);
  const startup = ['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon.svg','./apple-touch-icon.png','./assets/'+entryJs,...shared,'./assets/'+entryCss,'./assets/'+transportName,...startupFonts.map(f=>'./fonts/'+f)];
  // The version covers every published byte, so a change in any of them reaches the phones.
  const fingerprint = createHash('sha256');
  const kept = [...files,...[...fontFiles].map(f=>'./fonts/'+f)].sort();
  for (const path of new Set([...startup.slice(1),...kept])) fingerprint.update(path).update(await readFile(new URL(path,site)));
  const template = await readFile(new URL('./sw.template.js', import.meta.url), 'utf8');
  fingerprint.update(template);
  const values = {GDP_VERSION:fingerprint.digest('hex').slice(0,12),GDP_STARTUP:startup,GDP_KEPT:kept.filter(p=>!startup.includes(p)),GDP_ESSENTIAL:['./assets/'+entryJs,...shared,'./assets/'+entryCss,'./assets/'+transportName]};
  const worker = template.replace(/= (GDP_\w+);/g, (_, name) => '= ' + JSON.stringify(values[name]) + ';').replace('prefix + GDP_VERSION', () => 'prefix + ' + JSON.stringify(values.GDP_VERSION));
  if (/= GDP_|\+ GDP_/.test(worker)) throw Error('sw.template.js: quedan valores sin poner.');
  await writeFile(new URL('sw.js',site), worker);
}
