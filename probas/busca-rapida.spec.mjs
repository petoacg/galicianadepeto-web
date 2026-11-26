import {test, expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {serve} from './servidor.mjs';
import {simulate} from './galiciana.mjs';

const root = fileURLToPath(new URL(process.env.GDP_SITE ?? '../', import.meta.url));
const query = '#screen=search&preset=' + encodeURIComponent(JSON.stringify({query:'canteiro portada', fullText:true}));

test.use({serviceWorkers:'block', contextOptions:{reducedMotion:'reduce'}});

test('una consulta equivalente usa la copia aunque tenga otra fecha o espacios', async ({context, page}) => {
  const site = await serve(root), log = [];
  let delay = 0;
  const search = preset => '#screen=search&preset=' + encodeURIComponent(JSON.stringify(preset));
  try {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => /display-mode:\s*standalone/.test(query) ? original('all') : original(query);
    });
    await simulate(context, log, () => delay);
    await page.goto(site.url + search({query:'mestre   canteiro',fullText:true,id:'a',createdAt:1}));
    await expect(page.locator('.hit')).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => new Promise(resolve => {
      const open = indexedDB.open('gdp-buscas', 1);
      open.onsuccess = () => {
        const request = open.result.transaction('buscas').objectStore('buscas').count();
        request.onsuccess = () => { open.result.close(); resolve(request.result); };
      };
    }))).toBe(1);
    delay = 6000;
    await page.goto(site.url + search({query:'mestre canteiro',fullText:true,id:'b',createdAt:2}));
    await expect(page.locator('.hit')).toHaveCount(2, {timeout:2000});
    expect(log.filter(item => item === 'buscarReferencia:mestre canteiro')).toHaveLength(2);
    expect(log.filter(item => item === 'resposta:mestre canteiro')).toHaveLength(1);
  } finally { await site.close(); }
});

test('muestra las páginas sin número antes del METS y las completa después', async ({context, page}) => {
  const site = await serve(root), log = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  try {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => /display-mode:\s*standalone/.test(query) ? original('all') : original(query);
    });
    await simulate(context, log, undefined, {waitMets:() => gate});
    await page.goto(site.url + query);
    await expect(page.locator('.hit')).toHaveCount(4);
    await expect(page.getByRole('button', {name:'Abrir a páxina –'})).toHaveCount(2);
    expect(log.some(item => item.startsWith('recursoReferencia:mets:'))).toBe(true);
    expect(log.filter(item => item.startsWith('recursoReferencia:mets:'))).toHaveLength(1);
    release();
    for (const n of [3,4]) await expect(page.getByRole('button', {name:`Abrir a páxina ${n}`, exact:true})).toBeVisible();
    await page.getByRole('button', {name:'Abrir a páxina 4', exact:true}).click();
    await expect(page.getByRole('button', {name:/^4 \/ 6/})).toBeVisible();
  } finally { release(); await site.close(); }
});

test('guardar una página provisional guarda la página correcta al llegar el índice', async ({context, page}) => {
  const site = await serve(root), log = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  try {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => /display-mode:\s*standalone/.test(query) ? original('all') : original(query);
    });
    await simulate(context, log, undefined, {waitMets:() => gate});
    await page.goto(site.url + query);
    await expect(page.getByRole('button', {name:'Gardar páxina –'})).toHaveCount(2);
    await page.getByRole('button', {name:'Gardar páxina –'}).last().click();
    release();
    await expect(page.getByRole('button', {name:'Quitar de Gardados a páxina 4'})).toBeVisible();
  } finally { release(); await site.close(); }
});

test('si falla el índice, permite reintentar al abrir la página', async ({context, page}) => {
  const site = await serve(root), log = [];
  let failures = 1;
  try {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => /display-mode:\s*standalone/.test(query) ? original('all') : original(query);
    });
    await simulate(context, log, undefined, {fallos:args => args[0] === 'mets' && failures-- > 0});
    await page.goto(site.url + query);
    await expect(page.getByRole('button', {name:'Abrir a páxina –'})).toHaveCount(2);
    await expect(page.getByText('Non se puido consultar o índice dalgunhas páxinas.', {exact:false})).toBeVisible();
    await page.getByRole('button', {name:'Abrir a páxina –'}).last().click();
    await expect(page.getByRole('button', {name:/^4 \/ 6/})).toBeVisible();
  } finally { await site.close(); }
});

test('abrir una página provisional espera su índice y abre la imagen correcta', async ({context, page}) => {
  const site = await serve(root), log = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  try {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = query => /display-mode:\s*standalone/.test(query) ? original('all') : original(query);
    });
    await simulate(context, log, undefined, {waitMets:() => gate});
    await page.goto(site.url + query);
    await expect(page.getByRole('button', {name:'Abrir a páxina –'})).toHaveCount(2);
    await page.getByRole('button', {name:'Abrir a páxina –'}).last().click();
    release();
    await expect(page.getByRole('button', {name:/^4 \/ 6/})).toBeVisible();
  } finally { release(); await site.close(); }
});
