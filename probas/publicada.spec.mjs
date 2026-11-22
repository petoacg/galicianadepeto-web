// Pruebas de la web publicada, tal como llega al teléfono. No llaman a Galiciana ni al script de Google.
import {test as base, expect} from '@playwright/test';
import {readdir, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {scope, serve} from './servidor.mjs';
import {obra, simulate} from './galiciana.mjs';
const root = fileURLToPath(new URL(process.env.GDP_SITE ?? '../', import.meta.url));

const test = base.extend({
  site: async ({}, use) => { const site = await serve(root); await use(site); await site.close(); },
  app: async ({site, context, page}, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    // Como instalada: en una pestaña normal saldría encima la pantalla de instalación.
    await page.addInitScript(() => { const original = window.matchMedia.bind(window);
      window.matchMedia = query => /display-mode:\s*standalone/.test(query) ? original('all') : original(query); });
    await context.route(url => url.hostname !== '127.0.0.1', route => route.abort());
    await use({page, site, errors, ready: () => expect(page.getByRole('heading', {name: 'Busca en Galiciana'})).toBeVisible(),
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
  // Sólo la página y sus vecinas: nunca la del otro chip.
  await page.waitForTimeout(1600);
  expect([...new Set(log.filter(x => x.startsWith('imaxe:')))].sort()).toEqual(['imaxe:7001', 'imaxe:7002', 'imaxe:7003']);
  await page.locator('.match-page-chip', {hasText: '5'}).click();
  await expect(page.getByText('Páxina 5 de 6')).toBeVisible();
  await expect(page.locator('.facsimile img').first()).toBeVisible();
  await page.goBack();
  await expect(page.locator('.hit')).toHaveCount(2);
});
test('todo lo que nombra el service worker existe', async ({site, request}) => {
  const worker = await (await request.get(site.url + 'sw.js')).text();
  for (const [, path] of worker.matchAll(/"(\.\/[^"]*)"/g)) expect((await request.get(new URL(path, site.url).href)).status(), path).toBe(200);
});
