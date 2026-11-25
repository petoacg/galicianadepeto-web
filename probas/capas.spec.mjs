// Lo que se abre encima de una pantalla: menús, hojas, diálogos, portada y selección. Y dónde queda el foco.
import {test as base, expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {serve} from './servidor.mjs';
import {obra, simulate} from './galiciana.mjs';
// WebKit en el Mac, como Safari, sólo pasa por botones y enlaces con Opción+Tab (Tab va de campo en campo).
let TAB = 'Tab', SHIFT_TAB = 'Shift+Tab';
base.beforeEach(({browserName}) => { if (browserName === 'webkit' && process.platform === 'darwin') { TAB = 'Alt+Tab'; SHIFT_TAB = 'Alt+Shift+Tab'; } });
const root = fileURLToPath(new URL(process.env.GDP_SITE ?? '../', import.meta.url));
const test = base.extend({
  instalada: [true, {option: true}],
  web: async ({context, page, instalada}, use) => {
    const site = await serve(root), errors = [], log = [];
    // WebKit da por fallo de CORS una petición simulada que se corta al recargar la página; la app no la ve.
    page.on('pageerror', error => { if (!/due to access control checks/.test(String(error))) errors.push(String(error)); });
    if (instalada) await page.addInitScript(() => { const original = window.matchMedia.bind(window);
      window.matchMedia = query => /display-mode:\s*standalone/.test(query) ? original('all') : original(query); });
    await simulate(context, log);
    await use({page, log, open: async (hash = '') => { await page.goto(site.url + hash); }});
    expect(errors).toEqual([]); await site.close();
  },
});
test.use({serviceWorkers: 'block', contextOptions: {reducedMotion: 'reduce'}});
const resultados = '#screen=search&preset=' + encodeURIComponent(JSON.stringify({query: 'mestre canteiro', fullText: true}));
const visor = `#screen=viewer&path=${obra.path}&page=2&imageId=7002&title=${encodeURIComponent(obra.title)}`;
const foco = page => page.evaluate(() => { const e = document.activeElement; return (e.getAttribute('aria-label') || e.textContent || e.tagName).trim(); });
const dentro = (page, selector) => page.evaluate(s => !!document.activeElement.closest(s), selector);
/** Tab y Mayús+Tab, más veces que controles hay: el foco no sale y lo de detrás no responde. */
async function encerrado(page, selector, veces = 30) {
  expect(await dentro(page, selector)).toBe(true);
  for (let i = 0; i < veces; i++) { await page.keyboard.press(i < veces * .7 ? TAB : SHIFT_TAB); expect(await dentro(page, selector)).toBe(true); }
}
async function cabe(page) {
  const box = await page.getByRole('menu').boundingBox(), {width, height} = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(height);
}
/** Abre con el teclado y cierra de las tres maneras; siempre en la misma pantalla y con el foco en su botón. */
async function seCierra(page, button, title) {
  const menu = page.getByRole('menu'), url = page.url();
  for (const close of [() => page.keyboard.press('Escape'), () => page.goBack(), () => page.mouse.click(4, page.viewportSize().height - 4), () => page.keyboard.press(TAB)]) {
    await button.focus(); await page.keyboard.press('Enter');
    await expect(menu).toBeVisible(); await cabe(page);
    expect(await dentro(page, '[role=menu]')).toBe(true);
    await close();
    await expect(menu).toHaveCount(0); await expect(button).toBeFocused();
    await page.waitForTimeout(150);
    expect(page.url()).toBe(url); await expect(page.locator('h1').first()).toHaveText(title);
  }
}
test('el pie de «Seleccionar» se lee entero, a 360, 412 y 1280', async ({web: {page, open}}) => {
  await open(resultados); await expect(page.locator('.hit')).toHaveCount(2);
  await page.getByRole('button', {name: 'Seleccionar'}).click();
  for (const picked of [false, true]) {
    if (picked) await page.locator('.hit').first().click();
    for (const width of [360, 412, 1280]) {
      await page.setViewportSize({width, height: 800});
      const bar = await page.locator('.pick-bar').boundingBox(), text = await page.locator('.pick-bar span').boundingBox(), button = await page.locator('.pick-save').boundingBox();
      expect(text.width).toBeGreaterThan(150); expect(bar.height).toBeLessThan(90);
      expect(text.x + text.width).toBeLessThanOrEqual(button.x); expect(button.width).toBeLessThan(160);
    }
  }
  await expect(page.locator('.pick-bar span')).toHaveText('1 páxina seleccionada');
  await page.locator('.pick-save').click();
  await expect(page.getByRole('button', {name: 'Entendido'}).last()).toBeVisible();
});
test('el menú de orden: teclado, Escape, Atrás y toque fuera', async ({web: {page, open}}) => {
  await open(resultados); await expect(page.locator('.hit')).toHaveCount(2);
  const button = page.getByRole('button', {name: /^Orde:/}); await seCierra(page, button, 'Resultados');
  await button.press('ArrowDown'); expect(await foco(page)).toContain('Relevancia');
  await page.keyboard.press('ArrowDown'); expect(await foco(page)).toContain('Título');
  await page.keyboard.press('End'); expect(await foco(page)).toContain('Data');
  await page.keyboard.press('ArrowDown'); expect(await foco(page)).toContain('Relevancia');
  await page.keyboard.press('ArrowUp'); expect(await foco(page)).toContain('Data');
  await page.keyboard.press('Home'); expect(await foco(page)).toContain('Relevancia');
  // Tocar fuera sólo cierra: no abre el resultado que hay debajo.
  await page.locator('.m3-menu-scrim').click({position: {x: 200, y: 600}});
  await expect(page.getByRole('menu')).toHaveCount(0); await expect(page.locator('h1')).toHaveText('Resultados');
});
test('los menús de Gardados caben y se cierran; de ahí se abren sus diálogos', async ({web: {page, open}}) => {
  await open('#screen=saved');
  for (const name of ['Cartafol primeiro', 'Segundo cartafol', 'Terceiro']) {
    await page.getByRole('button', {name: 'Novo', exact: true}).click();
    await page.getByRole('alertdialog').getByRole('textbox').fill(name);
    await page.getByRole('alertdialog').getByRole('button').last().click();
    await expect(page.locator('.archive-folder-chip', {hasText: name})).toBeVisible();
  }
  await expect(page).toHaveURL(/folder=Terceiro/);
  await seCierra(page, page.getByRole('button', {name: 'Máis accións de Gardados'}), 'Gardados');
  for (const width of [360, 412]) {
    await page.setViewportSize({width, height: 740});
    const chip = page.locator('.archive-folder-chip', {hasText: 'Terceiro'}); await chip.scrollIntoViewIfNeeded();
    if (await chip.getAttribute('aria-pressed') !== 'true') await chip.click();
    await seCierra(page, chip, 'Gardados');
  }
  const chip = page.locator('.archive-folder-chip', {hasText: 'Terceiro'});
  await chip.press('Enter'); await page.getByRole('menuitem', {name: 'Eliminar cartafol'}).click();
  await encerrado(page, '.m3-dialog', 10);
  await page.keyboard.press('Escape'); await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(chip).toBeFocused(); await page.waitForTimeout(150);
  await page.getByRole('button', {name: 'Máis accións de Gardados'}).click();
  await page.getByRole('menuitem', {name: 'Copia dos teus datos'}).click();
  await expect(page.locator('h1')).toHaveText('Copia dos teus datos'); await expect(page.locator('h1')).toBeFocused();
  await page.goBack(); await expect(page.locator('h1')).toHaveText('Gardados');
  await expect(page.getByRole('button', {name: 'Máis accións de Gardados'})).toBeFocused();
});
test('las hojas y diálogos del visor retienen el foco y lo devuelven', async ({web: {page, open}}) => {
  await open(visor); await expect(page.locator('.facsimile img').first()).toBeVisible();
  const more = page.getByRole('button', {name: 'Accións desta páxina'});
  await more.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('dialog')).toBeVisible();
  await encerrado(page, '.m3-sheet');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(more).toBeFocused();
  const go = page.getByRole('button', {name: /ir á páxina/});
  await go.focus(); await page.keyboard.press('Enter'); await encerrado(page, '.m3-dialog', 12);
  await page.keyboard.press('Escape'); await expect(page.getByRole('alertdialog')).toHaveCount(0); await expect(go).toBeFocused();
  // De la hoja a otra cosa: al cerrarla, el foco vuelve al botón de la hoja y nada queda bloqueado.
  for (const [name, selector] of [[/^Nota de referencia/, '.note-editor'], [/^Organizar en cartafoles/, '.m3-sheet'], [/^Descargar páxina/, '.m3-dialog'], [/^Ler e copiar texto/, '.m3-sheet']]) {
    await more.focus(); await page.keyboard.press('Enter');
    await page.getByRole('dialog').getByRole('button', {name}).press('Enter');
    await expect(page.locator(selector)).toBeVisible(); await expect(page.locator('.viewer-actions')).toHaveCount(0);
    if (selector !== '.note-editor') await encerrado(page, selector, 14);
    await page.keyboard.press('Escape'); await expect(page.locator(selector)).toHaveCount(0);
    await expect(more).toBeFocused(); expect(await page.locator('[inert]').count()).toBe(0);
    await page.waitForTimeout(100);
  }
});
test('con un diálogo sobre la hoja, Escape cierra sólo el diálogo', async ({web: {page, open}}) => {
  await open(visor); await expect(page.locator('.facsimile img').first()).toBeVisible();
  await page.getByRole('button', {name: 'Accións desta páxina'}).click();
  await page.getByRole('button', {name: /^Organizar en cartafoles/}).click();
  await page.getByRole('textbox', {name: 'Nome do cartafol'}).fill('Proba');
  await page.getByRole('button', {name: 'Engadir', exact: true}).click();
  const bin = page.getByRole('button', {name: 'Eliminar cartafol Proba'}); await bin.focus(); await page.keyboard.press('Enter');
  await encerrado(page, '.m3-dialog', 10);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0); await expect(page.locator('.m3-sheet')).toBeVisible(); await expect(bin).toBeFocused();
  await encerrado(page, '.m3-sheet', 20);
  await page.keyboard.press('Escape'); await expect(page.locator('.m3-sheet')).toHaveCount(0);
});
test('descartar una nota: Escape vuelve al texto y no repite la pregunta', async ({web: {page, open}}) => {
  await open(resultados); await expect(page.locator('.hit')).toHaveCount(2);
  const add = page.getByRole('button', {name: 'Engadir nota de referencia á páxina 2'}); await add.click();
  await page.locator('#reference-note').fill('Texto de proba');
  await page.keyboard.press('Escape'); await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('#reference-note')).toHaveValue('Texto de proba');
  await page.getByRole('button', {name: 'Gardar', exact: true}).click();
  await expect(page.locator('.note-editor')).toHaveCount(0); await expect(add).toBeFocused();
});
test('cambiar de pantalla dice cuál es y lleva el foco; volver lo devuelve', async ({web: {page, open}}) => {
  await open(); await expect(page).toHaveTitle('Galiciana de Peto');
  await page.getByRole('button', {name: 'Buscar con filtros'}).press('Enter');
  await expect(page).toHaveTitle('Buscar · Galiciana de Peto'); await expect(page.locator('h1')).toBeFocused();
  await page.goBack(); await expect(page.getByRole('button', {name: 'Buscar con filtros'})).toBeFocused();
  await open(resultados); await page.reload(); await expect(page.locator('.hit')).toHaveCount(2);
  await expect(page).toHaveTitle('Resultados: mestre canteiro · Galiciana de Peto');
  const thumb = page.getByRole('button', {name: 'Abrir a páxina 5'}); await thumb.press('Enter');
  await expect(page).toHaveTitle(`${obra.title}, páx. 5 · Galiciana de Peto`); await expect(page.locator('h1')).toBeFocused();
  await expect(page.getByRole('button', {name: 'Anterior', exact: true})).toBeEnabled();
  await page.getByRole('button', {name: 'Anterior', exact: true}).press('Enter');
  await expect(page).toHaveTitle(`${obra.title}, páx. 4 · Galiciana de Peto`);
  await expect(page.getByRole('button', {name: 'Anterior', exact: true})).toBeFocused();
  await page.getByRole('button', {name: 'Volver'}).press('Enter');
  await expect(page).toHaveTitle('Resultados: mestre canteiro · Galiciana de Peto'); await expect(thumb).toBeFocused();
});
test('Escape cierra la búsqueda del visor y vuelve a la lupa', async ({web: {page, open}}) => {
  await open(visor); await expect(page.locator('.facsimile img').first()).toBeVisible();
  await page.getByRole('button', {name: 'Buscar na páxina'}).click();
  await expect(page.getByRole('textbox', {name: 'Buscar nesta páxina'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.viewer-search')).toHaveCount(0); await expect(page.getByRole('button', {name: 'Buscar na páxina'})).toBeFocused();
});
test('las referencias salen en gallego', async ({web: {page, open}}) => {
  await open(resultados); await page.getByRole('button', {name: 'Gardar páxina 2'}).click();
  await expect(page.getByRole('button', {name: 'Quitar de Gardados a páxina 2'})).toBeVisible();
  await page.getByRole('navigation', {name: 'Navegación principal'}).getByRole('button', {name: 'Gardados', exact: true}).click();
  await expect(page.getByText(obra.title).first()).toBeVisible();
  await page.getByRole('button', {name: 'Máis accións de Gardados'}).click();
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', {name: 'Exportar referencias'}).click()]);
  const text = await (await import('node:fs/promises')).readFile(await file.path(), 'utf8');
  for (const part of ['este ficheiro non inclúe imaxes', 'Páxina 2', 'Fonte: https://', 'consulta as condicións de dereitos']) expect(text).toContain(part);
  expect(text).not.toMatch(/Página|Fuente|Carpetas|imágenes/);
});
test.describe('sin instalar', () => {
  test.use({instalada: false});
  test('la portada es lo único que hay: ni foco detrás ni miniaturas', async ({web: {page, log, open}}) => {
    const thumbs = []; page.on('request', r => { if (/object-miniature|imagen_id/.test(r.url())) thumbs.push(r.url()); });
    await open(); await expect(page.locator('.install-gate')).toBeVisible();
    for (let i = 0; i < 8; i++) { await page.keyboard.press(TAB); expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('.install-gate'))).toBe(true); }
    await page.waitForTimeout(800); expect(thumbs).toEqual([]); expect(log).toEqual([]);
    await page.getByRole('button', {name: 'Seguir no navegador'}).press('Enter');
    await expect(page.getByRole('heading', {name: 'Busca en Galiciana'})).toBeFocused();
  });
});

// DESIGN.md › Movimiento (web): con el teclado nada se anima, y dos Intro seguidos pasan dos páginas.
test('con el teclado no se anima nada y no se pierde ninguna tecla', async ({web: {page, open}}) => {
  await open(visor); await expect(page).toHaveTitle(`${obra.title}, páx. 2 · Galiciana de Peto`);
  await page.getByRole('button', {name: /Accións desta páxina/}).press('Enter');
  const sheet = page.locator('.m3-sheet'); await expect(sheet).toBeVisible();
  expect(await sheet.evaluate(el => el.getAnimations().length)).toBe(0);
  await page.keyboard.press('Escape'); await expect(sheet).toHaveCount(0);
  const next = page.getByRole('button', {name: /^Seguinte/}).first();
  await next.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await expect(page).toHaveTitle(`${obra.title}, páx. 4 · Galiciana de Peto`);
});

// DESIGN.md › Movimiento (web): con «reducir movimiento» la página sigue al dedo; sólo el final no se anima.
test('con reducir movimiento la página sigue al dedo', async ({web: {page, open}, browserName}) => {
  test.skip(browserName !== 'chromium', 'los toques simulados van por CDP');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await open(visor); await expect(page).toHaveTitle(`${obra.title}, páx. 2 · Galiciana de Peto`);
  const cdp = await page.context().newCDPSession(page), box = await page.locator('.viewer-viewport').boundingBox(), y = box.y + box.height / 2;
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: x === undefined ? [] : [{x, y, id: 0}]});
  await touch('touchStart', 330); for (let x = 320; x >= 230; x -= 10) await touch('touchMove', x);
  expect(await page.locator('.viewer-viewport').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBeLessThan(-80);
  await touch('touchEnd');
});
// DESIGN.md › Movimiento (web): reducir movimiento es más suave, no nada; la barra de carga no se para.
test('con reducir movimiento la barra de carga sigue y la hoja aparece con un fundido', async ({web: {page, open}}) => {
  await open(visor); await expect(page).toHaveTitle(`${obra.title}, páx. 2 · Galiciana de Peto`);
  expect(await page.evaluate(() => { const bar = document.createElement('div'); bar.className = 'm3-linear-progress'; document.body.append(bar);
    const name = getComputedStyle(bar, '::after').animationName; bar.remove(); return name; })).toBe('m3-linear');
  await page.getByRole('button', {name: /Accións desta páxina/}).click();
  const sheet = page.locator('.m3-sheet'); await expect(sheet).toBeVisible();
  expect(await sheet.evaluate(el => getComputedStyle(el).animationName)).toBe('m3-scrim-in');
});

// DESIGN.md › Movimiento (web): ninguna animación hace esperar; la pantalla nueva responde mientras llega.
test('al cambiar de pantalla, un toque durante la llegada no se pierde', async ({web: {page, open}}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await open('#screen=home'); const tabs = page.locator('.bottom-nav button'); await expect(tabs).toHaveCount(3);
  const home = await tabs.nth(0).boundingBox();
  await tabs.nth(1).click(); await page.waitForTimeout(50);
  // Antes, mientras la pantalla nueva llegaba, la página era una imagen y el toque se perdía. Y lo
  // que llega de lado no ensancha la página, que en el móvil movería la barra de abajo.
  expect(await page.evaluate(() => document.getElementById('main').getAnimations().length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.mouse.click(home.x + home.width / 2, home.y + home.height / 2);
  await expect(page).toHaveURL(/screen=home/);
});

test('desde la búsqueda, las páginas sin número abren con su número y se pasan', async ({web: {page, open}}) => {
  await open('#screen=search&preset=' + encodeURIComponent(JSON.stringify({query: 'canteiro portada', fullText: true})));
  // Galiciana no les pone número: sale del índice de la obra, y cada una queda por separado.
  for (const n of [3, 4]) await expect(page.getByRole('button', {name: `Abrir a páxina ${n}`, exact: true})).toBeVisible();
  await expect(page.getByText(/páxina (null|–)/i)).toHaveCount(0);
  await page.getByRole('button', {name: 'Abrir a páxina 4', exact: true}).click();
  await expect(page.getByRole('button', {name: /^4 \/ 6/})).toBeVisible();
  await page.getByRole('button', {name: 'Seguinte', exact: true}).click();
  await expect(page.getByRole('button', {name: /^5 \/ 6/})).toBeVisible();
});
