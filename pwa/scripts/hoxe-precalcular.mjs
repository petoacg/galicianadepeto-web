// «Tal día como hoxe» precalculado: para cada día, as portadas de hai 60, 80 e 100 anos.
// Pídeas á app publicada (o seu transporte fala con Galiciana a través do Apps Script), devagar,
// e garda un ficheiro por mes en public/hoxe/AAAA-MM.json. Pódese parar e volver lanzar: salta
// os días que xa estean. Uso (desde pwa/): node scripts/hoxe-precalcular.mjs 2026-11-28 2027-11-30
import {chromium} from '../../probas/node_modules/playwright/index.mjs';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
const [from, to] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) throw Error('Uso: hoxe-precalcular.mjs AAAA-MM-DD AAAA-MM-DD');
const dir = new URL('../public/hoxe/', import.meta.url); await mkdir(dir, {recursive: true});
const days = []; for (let d = new Date(from + 'T12:00:00Z'); d <= new Date(to + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
const months = new Map();
const load = async month => { if (!months.has(month)) { let data = {}; try { data = JSON.parse(await readFile(new URL(month + '.json', dir), 'utf8')); } catch {} months.set(month, data); } return months.get(month); };
const save = month => writeFile(new URL(month + '.json', dir), JSON.stringify(months.get(month)));
const browser = await chromium.launch(); const page = await browser.newPage();
await page.goto('https://petoacg.github.io/galicianadepeto-web/'); await page.waitForTimeout(3000);
const keep = ({path, label, day, exact, paper, publicationId, years, year, imageId}) => ({path, label, day, exact, paper, publicationId, years, year, imageId});
for (const day of days) {
  const month = day.slice(0, 7), data = await load(month);
  if (data[day]) continue;
  for (let tries = 1; tries <= 3; tries++) {
    const answer = await page.evaluate(async day => { try { const r = await fetch(`/api/day?date=${day}&years=60,80,100`); return r.ok ? await r.json() : {error: r.status}; } catch (e) { return {error: String(e)}; } }, day);
    if (answer.items) { data[day] = answer.items.map(keep); await save(month); console.log(day, answer.items.map(i => i.year + ' ' + i.paper + (i.exact ? '' : ' (' + i.day + ')')).join(' · ')); break; }
    console.log(day, 'erro', answer.error, 'intento', tries); await page.waitForTimeout(5000 * tries);
  }
  await page.waitForTimeout(400); // devagar: Galiciana é de todos
}
await browser.close();
