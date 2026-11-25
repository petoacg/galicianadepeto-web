// Las mismas pruebas que la APK (AltoSearchTest, UserHyphenExamplesTest, PhraseRangeTest), sobre alto.js.
import {test, expect} from '@playwright/test';
import {existsSync, readFileSync} from 'node:fs';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL(process.env.GDP_SITE ?? '../', import.meta.url));
const script = readFileSync(root + 'assets/' + readdirSync(root + 'assets').find(name => name.startsWith('transport-')), 'utf8');
test.beforeEach(async ({page}) => { await page.goto('about:blank'); await page.addScriptTag({content: script}); });
const run = (page, xml, query) => page.evaluate(([x, q]) => globalThis.gdpAlto.parse(x, q), [xml, query]);
const n = async (page, xml, query) => (await run(page, xml, query)).matches.length;
const count = (page, text, query) => page.evaluate(([t, q]) => globalThis.gdpAlto.countMatches(t, q), [text, query]);
const alto = (...words) => `<alto xmlns="http://www.loc.gov/standards/alto/ns-v4#"><Layout><Page WIDTH="1000" HEIGHT="2000"><PrintSpace><TextBlock><TextLine>${words.map((t, i) => `<String CONTENT="${t}" HPOS="${10 + i * 100}" VPOS="20" WIDTH="90" HEIGHT="20"/>`).join('')}</TextLine></TextBlock></PrintSpace></Page></Layout></alto>`;

test('espacios de nombres, comillas y apóstrofos', async ({page}) => {
  const xml = `<a:alto xmlns:a="http://www.loc.gov/standards/alto/ns-v4#"><a:Layout><a:Page WIDTH='1000' HEIGHT='2000'><a:TextLine><a:String CONTENT="d'Artagnan" HPOS='10' VPOS='20' WIDTH='90' HEIGHT='20'/><a:String CONTENT='Mar&#237;a' HPOS="110" VPOS="20" WIDTH="90" HEIGHT="20"/></a:TextLine></a:Page></a:Layout></a:alto>`;
  expect(await n(page, xml, 'Artagnan')).toBe(1); expect(await n(page, xml, 'María')).toBe(1);
  expect((await run(page, xml, 'María')).pageSize).toEqual([1000, 2000]);
});
test('una palabra entre comillas es literal; una frase admite un solo error', async ({page}) => {
  expect(await n(page, alto('Ubeila'), '"ubeira"')).toBe(0); expect(await n(page, alto('Bárcena'), '"barcena"')).toBe(1);
  expect(await n(page, alto('Anselmo', 'Bárcena', 'Ubeila'), '"anselmo bárcena ubeira"')).toBe(await count(page, 'Anselmo Bárcena Ubeila', '"anselmo bárcena ubeira"'));
  expect(await n(page, alto('Anselmo', 'Bárcena', 'Ubeila'), '"anselmo bárcena ubeira"')).toBe(1);
  expect(await n(page, alto('Anselmo', 'Bárcana', 'Ubeila'), '"anselmo bárcena ubeira"')).toBe(0);
  expect(await count(page, 'Anselmo Bárcana Ubeila', '"anselmo bárcena ubeira"')).toBe(0);
});
test('frase y palabra partidas en dos renglones: una coincidencia, dos cajas', async ({page}) => {
  const phrase = await run(page, alto('María', 'de', 'la', 'Cruz').replace('CONTENT="la" HPOS="210" VPOS="20"', 'CONTENT="la" HPOS="10" VPOS="50"').replace('CONTENT="Cruz" HPOS="310" VPOS="20"', 'CONTENT="Cruz" HPOS="110" VPOS="50"'), '"María de la Cruz"');
  expect(phrase.matches).toHaveLength(1); expect(phrase.matches[0].boxes).toHaveLength(2);
  expect(phrase.matches[0].boxes.every(b => b.height === 20 && b.width < 300)).toBe(true);
  const word = await run(page, alto('Bár-', 'cena').replace('CONTENT="cena" HPOS="110" VPOS="20"', 'CONTENT="cena" HPOS="10" VPOS="50"'), '"bárcena"');
  expect(word.matches.map(m => m.boxes.length)).toEqual([2]);
});
test('varias veces en la página, sin las palabras de antes y en orden de lectura', async ({page}) => {
  const many = await run(page, alto('ayer', 'María', 'de', 'la', 'María', 'de', 'la'), '"María de la"');
  expect(many.matches).toHaveLength(2); expect(many.matches[0].boxes[0].left).toBe(110);
  const mixed = await run(page, alto('Salceda', 'María', 'Cruz', 'Salceda'), '"María Cruz" Salceda');
  expect(mixed.matches.map(m => m.boxes[0].left)).toEqual([10, 110, 310]);
});
test('coordenadas que no valen, página sin palabras y palabra que no está son cosas distintas', async ({page}) => {
  const s = async (xml, q = 'María') => (await run(page, xml, q)).status;
  expect(await s(alto('María').replace(' WIDTH="1000"', ''))).toBe('INVALID');
  expect(await s(alto('María').replace('HPOS="10"', 'HPOS="NaN"'))).toBe('INVALID');
  expect(await s(alto('María').replace('HPOS="10"', 'HPOS="9999"'))).toBe('INVALID');
  expect(await s(alto(), 'Salceda')).toBe('EMPTY');
  expect(await s('<html><body>Servicio no disponible</body></html>', 'Salceda')).toBe('INVALID');
  expect(await run(page, alto('María'), 'Salceda')).toMatchObject({status: 'AVAILABLE', matches: []});
});
test('letras sueltas, palabras cortadas y frases en una o varias piezas', async ({page}) => {
  expect(await n(page, alto('a', 'gato'), 'a')).toBe(1); expect(await n(page, alto('Bar', 'cena'), 'Bárcena')).toBe(1); expect(await n(page, alto('gato'), 'pato')).toBe(0);
  const q = '"María de la Cruz"';
  expect(await n(page, alto('María de la Cruz'), q)).toBe(1); expect(await n(page, alto('María', 'de', 'la', 'Cruz'), q)).toBe(1); expect(await n(page, alto('María de la Cruz'), q + ' ' + q)).toBe(1);
});
test('columnas y bloques sin relación no se juntan', async ({page}) => {
  expect((await run(page, alto('María', 'Cruz').replace('HPOS="110"', 'HPOS="800"'), '"María Cruz"')).matches.map(m => m.boxes.length)).toEqual([2]);
  const apart = word => xml => xml.replace(`<String CONTENT="${word}"`, `</TextLine></TextBlock><TextBlock><TextLine><String CONTENT="${word}"`);
  const cut = apart('cena')(alto('Bár-', 'cena'));
  expect(await n(page, cut, '"Bárcena"')).toBe(0); expect(await n(page, cut, '"Bár cena"')).toBe(0); expect(await n(page, cut.replace('Bár-', 'Bar'), 'Bárcena')).toBe(0);
  const two = apart('Salceda')(alto('María', 'Salceda'));
  expect(await n(page, two, 'María Salceda')).toBe(2); expect(await n(page, two, '"María Salceda"')).toBe(0);
});
test('los guiones del propio ALTO se respetan', async ({page}) => {
  const down = xml => xml.replace('HPOS="110" VPOS="20"', 'HPOS="10" VPOS="50"');
  for (const xml of [
    down(alto('Bár', 'cena').replace('CONTENT="Bár"', 'CONTENT="Bár" SUBS_TYPE="HypPart1" SUBS_CONTENT="Bárcena"').replace('CONTENT="cena"', 'CONTENT="cena" SUBS_TYPE="HypPart2" SUBS_CONTENT="Bárcena"')),
    down(alto('Bár', 'cena').replace('<String CONTENT="cena"', '<HYP CONTENT="-"/></TextLine><TextLine><String CONTENT="cena"')),
    alto('Bar', '-', 'cena').replace('<String CONTENT="cena"', '</TextLine><TextLine><String CONTENT="cena"').replace('HPOS="210" VPOS="20"', 'HPOS="10" VPOS="50"'),
  ]) expect((await run(page, xml, '"bárcena"')).matches.map(m => m.boxes.length)).toEqual([2]);
  const dash = await run(page, alto('Moreiras', '-', 'Xinzo', 'de', 'Limia'), '"Xinzo de Limia"');
  expect(dash.matches.map(m => m.boxes[0].left)).toEqual([210]);
});
const fernandez = (left = 606, top = 402) => `<alto><Layout><Page WIDTH="2000" HEIGHT="3000"><PrintSpace><TextBlock ID="block11"><TextLine HPOS="606" VPOS="355" WIDTH="462" HEIGHT="28"><String CONTENT="Manuel" HPOS="886" VPOS="356" WIDTH="102" HEIGHT="27"/><String CONTENT="Fer-" HPOS="1013" VPOS="355" WIDTH="54" HEIGHT="26"/></TextLine></TextBlock><TextBlock ID="block12"><TextLine HPOS="${left}" VPOS="${top}" WIDTH="462" HEIGHT="28"><String CONTENT="nández" HPOS="${left}" VPOS="${top}" WIDTH="99" HEIGHT="27"/><String CONTENT="Arce" HPOS="${left + 110}" VPOS="${top}" WIDTH="70" HEIGHT="27"/></TextLine></TextBlock></PrintSpace></Page></Layout></alto>`;
test('un apellido cortado entre bloques alineados se une; a otra columna o lejos, no', async ({page}) => {
  const phrase = (await run(page, fernandez(), '"Manuel Fernández"')).matches;
  expect(phrase).toHaveLength(1); expect(phrase[0].boxes.map(b => [b.left, b.top])).toEqual([[886, 355], [606, 402]]);
  expect((await run(page, fernandez(), '"Fernández"')).matches[0].boxes.map(b => b.left)).toEqual([1013, 606]);
  expect(await n(page, fernandez(1200), '"Fernández"')).toBe(0); expect(await n(page, fernandez(606, 1200), '"Fernández"')).toBe(0);
  expect(await n(page, fernandez().replace('Fer-', 'Fer'), '"Manuel Fernández"')).toBe(0);
  for (const second of ['Fernández', '']) {
    const xml = fernandez(1200, 1200).replace('CONTENT="Fer-"', 'CONTENT="Fer¬" SUBS_TYPE="HypPart1" SUBS_CONTENT="Fernández"').replace('CONTENT="nández"', `CONTENT="nández" SUBS_TYPE="HypPart2" SUBS_CONTENT="${second}"`);
    expect((await run(page, xml, '"Manuel Fernández"')).matches.map(m => m.boxes.length)).toEqual([2]);
  }
});
const reference = fileURLToPath(new URL('../../app/src/test/resources/alto/reference_1264535_p15_cuts.xml', import.meta.url));
test('la página de referencia recupera sus tres cortes', async ({page}) => {
  test.skip(!existsSync(reference));
  const xml = readFileSync(reference, 'utf8');
  for (const [q, times] of [['Amador', 1], ['Regimiento de Infantería Zamora', 1], ['Xinzo de Limia', 3]]) {
    const {status, matches} = await run(page, xml, `"${q}"`);
    expect([q, status, matches.map(m => m.boxes.length)]).toEqual([q, 'AVAILABLE', Array(times).fill(2)]);
  }
});
const examples = [['Federación Gallega', 'Federación Ga-llega'], ['Elisardo Núñez Seabra', 'Elisardo Núñez Sea-bra'], ['Manuel Fernández', 'Manuel Fer-nández'], ['Amador', 'Ama-dor'], ['Regimiento de Infantería Zamora', 'Regimiento de Infante-ria Zamora'], ['Xinzo de Limia', 'Xinzo de Li-mia'], ['Javier Vázquez', 'Ja-vier Vázquez']];
test('los cortes señalados a mano, en el texto y en la imagen', async ({page}) => {
  for (const [name, printed] of examples) {
    const terms = name.split(' ').length;
    for (const text of [name, printed, printed.replace('-', '-\n'), printed.replace('-', '- '), printed.replace('-', '-\r\n')]) {
      expect([text, await count(page, text, `"${name}"`)]).toEqual([text, 1]);
      expect([text, await count(page, text, name)]).toEqual([text, terms]);
    }
    const [a, b] = printed.split('-');
    const lines = [a + '-', b].map((line, i) => `<TextLine>${line.split(' ').map((w, j) => `<String CONTENT="${w}" HPOS="${10 + j * 90}" VPOS="${20 + i * 40}" WIDTH="80" HEIGHT="20"/>`).join('')}</TextLine>`).join('');
    const xml = `<alto xmlns="http://www.loc.gov/standards/alto/ns-v4#"><Layout><Page WIDTH="1200" HEIGHT="1600"><PrintSpace><TextBlock>${lines}</TextBlock></PrintSpace></Page></Layout></alto>`;
    const quoted = (await run(page, xml, `"${name}"`)).matches;
    expect([name, quoted.map(m => m.boxes.map(x => x.top))]).toEqual([name, [[20, 60]]]);
    const plain = (await run(page, xml, name)).matches;
    expect([name, plain.length, plain.filter(m => m.boxes.length === 2).length]).toEqual([name, terms, 1]);
  }
});
test('los tramos de una frase y sus errores permitidos', async ({page}) => {
  const ranges = (text, phrase) => page.evaluate(([t, p]) => { const g = globalThis.gdpAlto; return g.phraseRanges(g.ocrWords(t), g.expectedOf(p)); }, [text, phrase]);
  expect(await ranges('Ubeila Ubeira Ubeiras', 'Ubeira')).toEqual([[1, 1]]); expect(await ranges('Bár-\ncena', 'Bárcena')).toEqual([[0, 0]]);
  expect(await ranges('Anselmo Bar cena Ubeira', 'Anselmo Bárcena Ubeira')).toEqual([[0, 3]]); expect(await ranges('Anselmo Bár#cena Ubeira', 'Anselmo Bárcena Ubeira')).toEqual([[0, 2]]);
  expect(await ranges('Anselmo Bárcana Ubeila', 'Anselmo Bárcena Ubeira')).toEqual([]); expect(await ranges('Anselmo llegó Bárcena Ubeira', 'Anselmo Bárcena Ubeira')).toEqual([]);
  expect(await ranges('María María María', 'María María')).toEqual([[0, 1], [1, 2]]);
});
test('una página de periódico grande se resuelve enseguida', async ({page}) => {
  const strings = Array.from({length: 6000}, (_, i) => `<String CONTENT="${[1000, 4000].includes(i) ? 'Manuel' : [1001, 4001].includes(i) ? 'Fernández' : 'noticia' + i}" HPOS="${10 + i % 10 * 90}" VPOS="${20 + Math.floor(i / 10) * 24}" WIDTH="80" HEIGHT="20"/>`).join('');
  const xml = `<alto><Layout><Page WIDTH="1000" HEIGHT="20000"><TextBlock><TextLine>${strings}</TextLine></TextBlock></Page></Layout></alto>`;
  const start = Date.now();
  expect((await run(page, xml, '"Manuel Fernández"')).matches.map(m => m.boxes[0].top)).toEqual([2420, 9620]);
  expect(await n(page, xml, 'Manuel Fernández')).toBe(4);
  expect(Date.now() - start).toBeLessThan(3000);
});
