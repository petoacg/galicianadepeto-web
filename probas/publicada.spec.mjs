// Pruebas de la web publicada, tal como llega al teléfono. No llaman a Galiciana ni al script de Google.
import {test as base, expect} from '@playwright/test';
import {readdir, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {scope, serve} from './servidor.mjs';
import {ficha, obra, obraPdf, obraSenTexto, simulate} from './galiciana.mjs';
const root = fileURLToPath(new URL(process.env.GDP_SITE ?? '../', import.meta.url));

const test = base.extend({
  site: async ({}, use) => { const site = await serve(root); await use(site); await site.close(); },
  app: async ({site, context, page}, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    // Como instalada: en una pestaña normal saldría encima la pantalla de instalación.
    // «Tal día como hoxe» ya respondido hoy: en WebKit con service worker la petición saldría a la red real.
    await page.addInitScript(() => { const d = new Date(), day = [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((v, i) => String(v).padStart(i ? 2 : 4, '0')).join('-');
      try { localStorage.setItem('gdpeto-hoxe-' + day, JSON.stringify({date: day, items: []})); } catch {} });
    await page.addInitScript(() => { const original = window.matchMedia.bind(window);
      window.matchMedia = query => /display-mode:\s*standalone/.test(query) ? original('all') : original(query); });
    await context.route(url => url.hostname !== '127.0.0.1', route => route.abort());
    await use({page, site, errors, ready: () => expect(page.getByRole('heading', {name: 'Galiciana de Peto', level: 1})).toBeVisible(),
      controlled: async () => {
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.waitForFunction(() => navigator.serviceWorker.controller);
      }});
    expect(errors).toEqual([]);
  },
});
// Lo que hace el navegador cuando la versión publicada cambia: la misma web con otro sw.js.
const newer = (file, body) => file === 'sw.js' ? Buffer.from(String(body).replace(/prefix \+ "\w+"/, 'prefix + "nova"'))
  : file === 'index.html' ? Buffer.from(String(body).replace('<html lang="gl">', '<html lang="gl" data-nova>')) : undefined;

test('abre en gallego y con un solo título', async ({app}) => {
  await app.page.goto(app.site.url); await app.ready();
  await expect(app.page.locator('h1')).toHaveCount(1);
  await expect(app.page.locator('html')).toHaveAttribute('lang', /^gl/);
});
test('los tres destinos abren', async ({app}) => {
  await app.page.goto(app.site.url); await app.ready();
  const bar = app.page.getByRole('navigation', {name: 'Navegación principal'});
  for (const name of ['Explorar', 'Gardados', 'Buscar']) {
    await bar.getByRole('button', {name, exact: true}).click();
    await expect(bar.getByRole('button', {name, exact: true})).toHaveAttribute('aria-current', 'page');
  }
});
test('no se sale de la pantalla a 360 px', async ({app}) => {
  await app.page.setViewportSize({width: 360, height: 740});
  await app.page.goto(app.site.url); await app.ready();
  expect(await app.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
test('la primera carga no trae las piezas del PDF', async ({app}) => {
  await app.page.goto(app.site.url); await app.ready(); await app.controlled();
  expect(app.site.state.requests.filter(path => /NotoSans/.test(path))).toEqual([]);
  const scripts = app.site.state.requests.filter(path => path.endsWith('.js'));
  const sizes = await Promise.all([...new Set(scripts)].map(async path => (await stat(root + path.slice(scope.length))).size));
  expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThan(700_000); // sin pdf-lib ni fontkit (1,3 MB)
});
test('abre sin conexión', async ({app, context}) => {
  await app.page.goto(app.site.url); await app.ready(); await app.controlled();
  await context.setOffline(true);
  await app.page.reload(); await app.ready();
});
test('abre aunque la red no responda', async ({app}) => {
  await app.page.goto(app.site.url); await app.ready(); await app.controlled();
  app.site.state.stall = true;
  const start = Date.now();
  await app.page.reload({waitUntil: 'commit'}); await app.ready();
  expect(Date.now() - start).toBeLessThan(4000);
});
test('la versión nueva se ofrece, y al actualizar sólo baja lo que cambió', async ({app}) => {
  await app.page.goto(app.site.url); await app.ready(); await app.controlled();
  // Una pieza del PDF ya usada debe seguir guardada después de actualizar.
  const pdf = (await readdir(root + 'fonts')).find(name => name.startsWith('NotoSans'));
  await app.page.evaluate(path => fetch(path).then(r => r.arrayBuffer()), 'fonts/' + pdf);
  app.site.state.change = newer; app.site.state.requests.length = 0;
  await app.page.reload();
  await expect(app.page.getByText('Hai unha actualización dispoñible.')).toBeVisible();
  // Hasta que la persona acepta, se sigue con la versión anterior.
  await expect(app.page.locator('html')).not.toHaveAttribute('data-nova');
  await app.page.getByRole('button', {name: 'Actualizar'}).first().click();
  await app.page.getByRole('alertdialog').getByRole('button', {name: 'Actualizar'}).click();
  await expect(app.page.locator('html')).toHaveAttribute('data-nova', ''); await app.ready();
  expect(app.site.state.requests.filter(path => /\/(assets|fonts)\//.test(path))).toEqual([]);
  expect(await app.page.evaluate(async path => !!(await caches.match(new URL(path, location.href).href)), 'fonts/' + pdf)).toBe(true);
  expect((await app.page.evaluate(() => caches.keys())).filter(name => name.startsWith('gdp-pages-'))).toEqual(['gdp-pages-nova']);
});
test('si no está guardada entera, se abre desde la red', async ({app}) => {
  await app.page.goto(app.site.url); await app.ready(); await app.controlled();
  await app.page.evaluate(async () => { for (const name of await caches.keys()) { const cache = await caches.open(name);
    for (const request of await cache.keys()) if (/\/assets\/app-.*js$/.test(request.url)) await cache.delete(request); } });
  await app.page.reload(); await app.ready();
});
for (const [que, archivo] of [['el diseño', /\/assets\/app-.*css$/], ['un trozo del programa', /\/assets\/c-.*js$/], ['el transporte', /\/assets\/transport-.*js$/]])
test('si falta ' + que + ' y el servidor ya cambió, se abre la versión nueva', async ({app}) => {
  await app.page.goto(app.site.url); await app.ready(); await app.controlled();
  await app.page.evaluate(async source => { for (const name of await caches.keys()) { const cache = await caches.open(name);
    for (const request of await cache.keys()) if (new RegExp(source).test(request.url)) await cache.delete(request); } }, archivo.source);
  app.site.state.change = newer;
  await app.page.reload(); await app.ready();
  await expect(app.page.locator('html')).toHaveAttribute('data-nova', '');
});
test('el aviso de versión nueva se anuncia', async ({app}) => {
  await app.page.goto(app.site.url); await app.ready(); await app.controlled();
  app.site.state.change = newer; await app.page.reload();
  await expect(app.page.getByRole('status').filter({hasText: 'Hai unha actualización dispoñible.'})).toBeVisible();
});
test('al compartir el enlace hay título, texto e imagen', async ({site, request}) => {
  const page = await (await request.get(site.url)).text();
  for (const name of ['og:title', 'og:description', 'og:image', 'og:url']) expect(page).toContain('property="' + name + '"');
  const image = page.match(/og:image" content="[^"]*\/([\w.-]+)"/)[1];
  expect((await request.get(site.url + image)).status()).toBe(200);
});
test('buscar, abrir una página y saltar con un chip', async ({app, context}) => {
  const log = []; await simulate(context, log);
  const {page} = app;
  await page.goto(app.site.url); await app.ready();
  await page.getByRole('textbox', {name: 'A túa busca'}).fill('mestre canteiro');
  await page.getByRole('textbox', {name: 'A túa busca'}).press('Enter');
  await expect(page.getByText(obra.title).first()).toBeVisible();
  await expect(page.locator('.hit')).toHaveCount(2);
  await page.locator('.hit').first().click();
  await expect(page.locator('h1.viewer-title')).toContainText(obra.title);
  await expect(page.getByText('Páxina 2 de 6')).toBeVisible();
  await expect(page.locator('.ocr-overlay rect').first()).toBeVisible();
  // La página y sus vecinas, y la del segundo resultado, que se leyó por adelantado desde la lista. Ninguna más.
  await page.waitForTimeout(1600);
  expect([...new Set(log.filter(x => x.startsWith('imaxe:')))].sort()).toEqual(['imaxe:7001', 'imaxe:7002', 'imaxe:7003', 'imaxe:7005']);
  await page.locator('.match-page-chip', {hasText: '5'}).click();
  await expect(page.getByText('Páxina 5 de 6')).toBeVisible();
  await expect(page.locator('.facsimile img').first()).toBeVisible();
  await page.goBack();
  await expect(page.locator('.hit')).toHaveCount(2);
});
const busca = async (page, text) => {
  await page.getByRole('textbox', {name: 'A túa busca'}).fill(text);
  await page.getByRole('textbox', {name: 'A túa busca'}).press('Enter');
};
test('una búsqueda que se deja a medias no se pide dos veces y avisa si tarda', async ({app, context}) => {
  const log = []; await simulate(context, log, () => 8500);
  const {page} = app;
  await page.goto(app.site.url); await app.ready();
  await busca(page, 'mestre');
  await page.waitForTimeout(500);
  await page.goBack(); await app.ready();
  await busca(page, 'mestre');
  await expect(page.getByText('A primeira vez pode tardar medio minuto')).toBeVisible({timeout: 8000});
  await expect(page.locator('.hit')).toHaveCount(2);
  await expect(page.getByText('A primeira vez pode tardar medio minuto')).toHaveCount(0);
  expect(log.filter(x => x === 'buscarReferencia:mestre')).toHaveLength(1);
});
test('una búsqueda hecha se abre al momento al volver, y se borra con las recientes', async ({app, context}) => {
  const log = []; let wait = 0; await simulate(context, log, () => wait);
  const {page} = app;
  await page.goto(app.site.url); await app.ready();
  await busca(page, 'mestre'); await expect(page.locator('.hit')).toHaveCount(2);
  wait = 6000;
  await page.waitForTimeout(400); await page.goBack(); await app.ready(); await page.reload(); await app.ready();
  await busca(page, 'mestre');
  await expect(page.locator('.hit')).toHaveCount(2, {timeout: 2000});
  // Y se refresca por detrás, sin vaciar la lista (los primeros resultados se leen por adelantado mientras tanto).
  const busca_ = () => log.filter(x => /^(buscarReferencia|resposta):/.test(x)).at(-1);
  expect(busca_()).toBe('buscarReferencia:mestre');
  await expect.poll(busca_, {timeout: 8000}).toBe('resposta:mestre');
  await expect(page.locator('.hit')).toHaveCount(2);
  await expect(page.locator('.m3-linear-progress')).toHaveCount(0);
  const kept = () => page.evaluate(() => new Promise(done => { const o = indexedDB.open('gdp-buscas', 1); o.onsuccess = () => { const r = o.result.transaction('buscas').objectStore('buscas').count(); r.onsuccess = () => { o.result.close(); done(r.result); }; }; }));
  expect(await kept()).toBe(1);
  await page.goBack(); await app.ready();
  await page.goto(app.site.url + '#screen=history');
  await page.getByText('Recentes', {exact: true}).first().click();
  await page.getByText('Borrar recentes', {exact: true}).first().click();
  await page.getByText('Borrar recentes', {exact: true}).last().click();
  await expect.poll(kept).toBe(0);
});
test('las variantes van de una en una y se paran al salir', async ({app, context}) => {
  const log = []; await simulate(context, log, text => text.startsWith('"') ? 0 : 1200);
  const {page} = app;
  await page.goto(app.site.url); await app.ready();
  await busca(page, '"mestre canteiro vello"');
  await expect(page.getByText('Comprobando outras grafías no OCR…')).toBeVisible();
  await expect.poll(() => log.filter(x => x.startsWith('buscarReferencia')).length).toBeGreaterThan(2);
  const pedidas = log.filter(x => x.startsWith('buscarReferencia:') && !x.includes('"')).length, respondidas = log.filter(x => x.startsWith('resposta:') && !x.includes('"')).length;
  expect(pedidas - respondidas).toBeLessThanOrEqual(1);
  await page.goBack(); await app.ready();
  await page.waitForTimeout(300); const antes = log.filter(x => x.startsWith('buscarReferencia')).length;
  await page.waitForTimeout(3500);
  expect(log.filter(x => x.startsWith('buscarReferencia')).length).toBe(antes);
});
const abreFicha = async ({page, site}) => page.goto(site.url + '#screen=record&url=' + encodeURIComponent('https://biblioteca.galiciana.gal/es/consulta/registro.do?id=1'));
test('la ficha enseña sus datos y abre la copia con páginas, no el PDF', async ({app, context}) => {
  const log = []; await simulate(context, log, undefined, {ficha: ficha()});
  await abreFicha(app);
  const {page} = app;
  await expect(page.getByRole('heading', {name: 'Datos do catálogo'})).toBeVisible();
  await expect(page.locator('dd', {hasText: 'Canteiros'})).toContainText('Pontes');
  await page.getByRole('button', {name: 'Abrir copia dixital'}).click();
  await expect(page.getByText('Páxina 1 de 6')).toBeVisible();
  expect(log).not.toContain('recursoReferencia:mets:' + obraPdf);
});
test('una obra que solo está en PDF se dice y se abre fuera', async ({app, context}) => {
  const log = []; await simulate(context, log, undefined, {ficha: ficha(obraPdf)});
  await abreFicha(app);
  const {page} = app;
  await page.getByRole('button', {name: 'Abrir copia dixital'}).click();
  await expect(page.getByRole('heading', {name: 'Esta copia é un só PDF'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Abrir o PDF en Galiciana'})).toHaveAttribute('href', /idImagen=8001$/);
  await page.waitForTimeout(1500);
  await expect(page.getByText('Comproba a conexión')).toHaveCount(0);
  await expect(page.getByText('Páxina 1 de 1')).toHaveCount(0);
  await page.getByRole('button', {name: 'Accións desta páxina'}).click();
  await expect(page.getByText('Descargar páxina')).toHaveCount(0);
});
test('abrir otra página no pide el texto, que se pide al abrirlo; y un fallo no se dice «sin texto»', async ({app, context}) => {
  const log = []; let falla = true; await simulate(context, log, undefined, {fallos: args => args[0] === 'ocr' && falla});
  const {page} = app;
  await page.goto(app.site.url); await app.ready();
  await busca(page, 'mestre canteiro'); await page.locator('.hit').first().click();
  await expect(page.locator('.ocr-overlay rect').first()).toBeVisible();
  await page.waitForTimeout(1600);
  expect(log.filter(x => x.startsWith('recursoReferencia:ocr'))).toEqual([]);
  // Las marcas de la siguiente se leen por adelantado, y las del segundo resultado desde la lista; la abierta, una sola vez.
  expect(log.filter(x => x.startsWith('recursoReferencia:alto')).sort()).toEqual(['recursoReferencia:alto:2', 'recursoReferencia:alto:3', 'recursoReferencia:alto:5']);
  await page.getByRole('button', {name: 'Seguinte', exact: true}).click();
  await expect(page.getByText('Páxina 3 de 6')).toBeVisible();
  await page.waitForTimeout(700);
  await page.getByRole('button', {name: 'Anterior', exact: true}).click();
  await expect(page.getByText('Páxina 2 de 6')).toBeVisible();
  expect(log.filter(x => /alto:[23]$/.test(x))).toHaveLength(2);
  await page.getByRole('button', {name: 'Accións desta páxina'}).click();
  await page.getByRole('button', {name: /Ler e copiar texto/}).click();
  await expect(page.getByText('Non se puido cargar o texto desta páxina')).toBeVisible();
  falla = false;
  await page.getByRole('button', {name: 'Reintentar'}).click();
  await expect(page.locator('.ocr-text')).toHaveText('O mestre canteiro');
});
test('en una obra sin texto no se pide ni se ofrece revisarlo', async ({app, context}) => {
  const log = []; await simulate(context, log, undefined, {ficha: ficha().replaceAll(obra.path, obraSenTexto)});
  await abreFicha(app);
  const {page} = app;
  await page.getByRole('button', {name: 'Abrir copia dixital'}).click();
  await expect(page.getByText('Páxina 1 de 6')).toBeVisible();
  await page.getByRole('button', {name: 'Buscar na páxina', exact: true}).click();
  await page.getByRole('textbox', {name: 'Buscar nesta páxina'}).fill('mestre');
  await page.getByRole('textbox', {name: 'Buscar nesta páxina'}).press('Enter');
  await expect(page.getByText('Esta páxina non ten texto recoñecido dispoñible.')).toBeVisible();
  await expect(page.getByText('Revisar todo o documento')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Reintentar'})).toHaveCount(0);
  expect(log.filter(x => /:(alto|ocr):/.test(x))).toEqual([]);
});
test('lo guardado y sus notas se abren sin conexión', async ({app, context, browserName}) => {
  // En WebKit, Playwright no intercepta lo que pide el service worker: buscaría en la Galiciana real.
  test.skip(browserName === 'webkit', 'WebKit no simula la red tras el service worker');
  const log = []; await simulate(context, log);
  const {page} = app;
  await page.goto(app.site.url); await app.ready(); await app.controlled();
  await busca(page, 'mestre canteiro');
  await page.locator('.hit').first().getByRole('button', {name: 'Gardar páxina'}).click();
  await expect(page.locator('.hit').first().getByRole('button', {name: 'Quitar de Gardados'})).toBeVisible();
  await context.setOffline(true);
  await page.goto(app.site.url); await app.ready();
  await page.getByRole('navigation', {name: 'Navegación principal'}).getByRole('button', {name: 'Gardados', exact: true}).click();
  await expect(page.getByText(obra.title).first()).toBeVisible();
  await page.getByRole('button', {name: /^Opcións da páxina/}).first().click();
  await page.getByRole('menuitem', {name: /nota de referencia/i}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
test('todo lo que nombra el service worker existe', async ({site, request}) => {
  const worker = await (await request.get(site.url + 'sw.js')).text();
  for (const [, path] of worker.matchAll(/"(\.\/[^"]*)"/g)) expect((await request.get(new URL(path, site.url).href)).status(), path).toBe(200);
});
