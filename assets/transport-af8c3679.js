// Dónde están las palabras buscadas en una página. Copia de OcrRepository.parseAltoSearch y de
// Highlight.kt (APK): mismas reglas, para que la web marque lo mismo que Android. Las pruebas de
// probas-web/alto.spec.mjs son las de AltoSearchTest, UserHyphenExamplesTest y PhraseRangeTest.
(() => {
  const HY = '-‐‑–—\\u00ad';
  const re = {
    marks: /\p{M}+/gu, hyphen: new RegExp('[' + HY + ']', 'g'), hyphenSpace: new RegExp('[' + HY + ']\\s+', 'g'),
    phrase: /["“«]([^"”»]+)["”»]/g, token: new RegExp('[\\p{L}\\p{N}]+(?:[' + HY + '][\\p{L}\\p{N}]+)*', 'gu'),
    piece: new RegExp('[\\p{L}\\p{N}�□■#*?]+(?:[-–—\\u00ad][\\p{L}\\p{N}]+)*', 'gu'),
  };
  const fold = s => s.normalize('NFD').replace(re.marks, '').toLowerCase().replace(re.hyphen, '');
  const dehyphen = s => s.replace(re.hyphenSpace, '').replace(re.hyphen, '');
  const letters = s => fold(dehyphen(s)).replace(/[^a-z0-9]/g, '');
  const ocrWords = s => fold(dehyphen(s)).replace(/(?<=[a-z])[�□■#*?](?=[a-z])/g, '?').match(/[a-z0-9?]+/g) || [];
  const QUOTES = /^["“”«»„‟'‘’]+|["“”«»„‟'‘’]+$/g;
  const strip = raw => raw.trim().replace(QUOTES, '').trim();
  const isQuoted = raw => { const t = raw.trim(); return t.length >= 2 && '"“«„‟\'‘'.includes(t[0]) && '"”»\'’'.includes(t.at(-1)); };
  const quotedPhrases = raw => {
    const out = [...raw.matchAll(re.phrase)].map(m => m[1].trim()).filter(Boolean);
    return out.length || !isQuoted(raw) ? out : [strip(raw)].filter(Boolean);
  };
  const queryTokens = query => strip(query).match(re.token) || [];
  const extraTokens = raw => isQuoted(raw) && raw.search(re.phrase) < 0 ? [] : queryTokens(raw.replace(re.phrase, ' '));
  const highlightTerms = query => {
    const phrases = quotedPhrases(query);
    if (phrases.length) return [...phrases.map(p => '"' + p + '"'), ...extraTokens(query)].join(' ');
    return queryTokens(query).join(' ') || strip(query);
  };
  const expectedOf = phrase => queryTokens(phrase).map(letters).filter(Boolean);
  const editDistance = (a, b) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 9;
    let row = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) next.push(Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
      row = next;
    }
    return row[b.length];
  };
  const CONFUSIONS = [['0', 'o'], ['1', 'l'], ['1', 'i'], ['5', 's'], ['rn', 'm'], ['vv', 'w']];
  const tokenMatches = (ocr, query, slack) => {
    const q = letters(query), o = fold(dehyphen(ocr));
    if (q.length < 2) return false;
    if (o === q) return true;
    if (q.length >= 4) {
      if (o.length === q.length && o.split('?').length === 2 && [...o].every((c, i) => c === '?' || c === q[i])) return true;
      if (CONFUSIONS.some(([a, b]) => o.replaceAll(a, b) === q || o.replaceAll(b, a) === q)) return true;
      const masked = o.replace(/[^a-z0-9]+/g, '.');
      if (masked.includes('.')) {
        const pattern = masked.split('.').filter(Boolean).join('[a-z]?');
        if (pattern.length >= 3 && new RegExp('^(?:' + pattern + ')$').test(q)) return true;
      }
    }
    if (slack <= 0) return false;
    if (q.length >= 5 && o.length >= 4 && editDistance(o, q) <= slack) return true;
    return o === q + 's' || q === o + 's' || o === q + 'es' || q === o + 'es';
  };
  const slackFor = (tokens, token) => {
    const length = letters(token).length;
    return (tokens.length >= 2 && length >= 5) || (tokens.length === 1 && length >= 10) ? 1 : 0;
  };
  const matchAt = (words, start, token, slack) => {
    const target = letters(token);
    if (target.length === 1) return words[start] === target;
    if (tokenMatches(words[start], token, slack)) return true;
    const a = words[start], b = words[start + 1];
    return !!b && a.length >= 2 && b.length >= 2 && a.length <= 5 && a.length + b.length <= target.length + 1 && tokenMatches(a + b, token, 0);
  };
  const phraseRanges = (words, expected) => {
    if (!expected.length) return [];
    if (expected.length === 1) return words.flatMap((w, i) => w === expected[0] ? [[i, i]] : []);
    const costs = new Map();
    const cost = (ocr, target) => {
      if (ocr === target) return 0;
      const key = ocr + '|' + target;
      if (costs.has(key)) return costs.get(key);
      let value = target.length >= 5 && ocr.length >= 4 && editDistance(ocr, target) === 1 ? 1 : 2;
      if (target.length >= 3 && ocr.split('?').length === 2) {
        const gap = ocr.indexOf('?');
        if ((ocr.length === target.length + 1 && ocr.replace('?', '') === target) ||
            (ocr.length === target.length && [...ocr].every((c, i) => i === gap || c === target[i]))) value = 0;
      }
      costs.set(key, value);
      return value;
    };
    const ranges = [];
    for (let start = 0; start < words.length; start++) {
      let cursor = start, errors = 0;
      const matched = expected.every(token => {
        if (cursor >= words.length) return false;
        const word = words[cursor], direct = cost(word, token);
        if (direct <= 1 && errors + direct <= 1) { errors += direct; cursor++; return true; }
        const joined = cursor + 1 < words.length && word.length >= 2 && word.length <= 5 ? cost(word + words[cursor + 1], token) : 2;
        if (joined <= 1 && errors + joined <= 1) { errors += joined; cursor += 2; return true; }
        return false;
      });
      if (matched) ranges.push([start, cursor - 1]);
    }
    return ranges;
  };
  const countMatches = (text, query) => {
    if (!text) return 0;
    const extras = extraTokens(query), words = ocrWords(text);
    return quotedPhrases(query).reduce((n, p) => n + phraseRanges(words, expectedOf(p)).length, 0) +
      extras.reduce((n, t) => n + words.filter((_, i) => matchAt(words, i, t, slackFor(extras, t))).length, 0);
  };
  const parse = (source, query) => {
    const none = status => ({pageSize: [0, 0], matches: [], status});
    const doc = new DOMParser().parseFromString(source || '', 'application/xml');
    const is = (node, name) => node?.localName?.toLowerCase() === name;
    const all = (root, name) => Array.from(root.getElementsByTagName('*')).filter(node => is(node, name));
    const attribute = (node, name) => {
      const exact = node.getAttribute(name);
      if (exact !== null) return exact;
      return Array.from(node.attributes).find(a => a.name.toLowerCase() === name.toLowerCase())?.value || '';
    };
    const number = (node, name) => { const value = attribute(node, name).trim(); return value && Number.isFinite(Number(value)) ? Number(value) : null; };
    const ancestor = (node, name) => { for (let up = node.parentElement; up; up = up.parentElement) if (is(up, name)) return up; return null; };
    if (doc.getElementsByTagName('parsererror').length || !all(doc, 'alto').length) return none('INVALID');
    const page = all(doc, 'page')[0];
    const width = page && number(page, 'WIDTH'), height = page && number(page, 'HEIGHT');
    if (!(width > 1) || !(height > 1)) return none('INVALID');
    const tags = all(page, 'string');
    if (!tags.length) return {pageSize: [width, height], matches: [], status: 'EMPTY'};
    const words = [];
    for (const tag of tags) {
      const [left, top, w, h] = ['HPOS', 'VPOS', 'WIDTH', 'HEIGHT'].map(name => number(tag, name));
      // Con coordenadas a medias, «no está» no sería de fiar.
      if ([left, top, w, h].includes(null) || left < 0 || top < 0 || w <= 0 || h <= 0 || left + w > width + 1 || top + h > height + 1) return none('INVALID');
      const content = [attribute(tag, 'CONTENT'), attribute(tag, 'SUBS_CONTENT'), tag.textContent].find(value => value.trim()) || '';
      const text = is(tag.nextElementSibling, 'hyp') && !content.trimEnd().endsWith('-') ? content + '-' : content;
      words.push({content: text, parts: [{left, top, width: w, height: h}], block: ancestor(tag, 'textblock') || page,
        type: attribute(tag, 'SUBS_TYPE').toLowerCase(), substitution: attribute(tag, 'SUBS_CONTENT'), source: tag, line: ancestor(tag, 'textline')});
    }
    // Un bloque puede partir una columna: solo se unen los que enlaza un corte de palabra.
    const parents = new Map();
    const flow = block => { while (parents.has(block)) block = parents.get(block); return block; };
    const link = (a, b) => { const x = flow(a.block), y = flow(b.block); if (x !== y) parents.set(y, x); };
    const bounds = new Map();
    const lineBounds = line => {
      if (bounds.has(line)) return bounds.get(line);
      const box = node => { const [x, y, w, h] = ['HPOS', 'VPOS', 'WIDTH', 'HEIGHT'].map(name => number(node, name)); return [x, y, w, h].includes(null) ? null : [x, y, x + w, y + h]; };
      const own = box(line);
      let result = own && own[2] > own[0] && own[3] > own[1] ? own : null;
      if (!result) {
        const members = all(line, 'string').map(box).filter(Boolean);
        result = members.length ? [0, 1, 2, 3].map(i => Math[i < 2 ? 'min' : 'max'](...members.map(m => m[i]))) : null;
      }
      bounds.set(line, result);
      return result;
    };
    const continues = (left, right) => {
      if (!left.line || !right.line || left.line === right.line) return false;
      if (all(left.line, 'string').at(-1) !== left.source || all(right.line, 'string')[0] !== right.source) return false;
      const a = lineBounds(left.line), b = lineBounds(right.line);
      if (!a || !b) return false;
      const size = Math.max(a[3] - a[1], b[3] - b[1]), down = b[1] - a[1], overlap = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
      return size > 0 && down >= size * .5 && down <= size * 3 && overlap >= Math.min(a[2] - a[0], b[2] - b[0]) * .6;
    };
    const cutEnd = /[-‐‑–—­¬]+$/, hasLetter = /\p{L}/u;
    for (let i = 0; i < words.length - 1;) {
      const a = words[i], b = words[i + 1], current = a.content.trim(), next = b.content.trim(), same = a.block === b.block;
      const substituted = a.type === 'hyppart1' && b.type === 'hyppart2' && a.substitution.trim() && (!b.substitution.trim() || a.substitution === b.substitution);
      const printed = current.length > 1 && cutEnd.test(current) && hasLetter.test(next) && (same || continues(a, b));
      if (substituted || printed) {
        link(a, b);
        words[i] = {...a, content: substituted ? a.substitution : current.replace(cutEnd, '') + next, parts: [...a.parts, ...b.parts], type: '', substitution: ''};
        words.splice(i + 1, 1);
      } else if (same && current && /^[-–—­¬]+$/.test(current) && i > 0 && words[i - 1].block === a.block && hasLetter.test(next) &&
          words[i - 1].line === a.line && continues(a, b)) {
        words[i - 1] = {...words[i - 1], content: words[i - 1].content + next, parts: [...words[i - 1].parts, ...b.parts]};
        words.splice(i, 2);
        i--;
      } else i++;
    }
    const boxes = parts => {
      const lines = [];
      for (const part of parts) {
        const line = lines.at(-1), previous = line?.at(-1);
        if (!previous || Math.abs(line[0].top - part.top) > Math.max(line[0].height, part.height) * .7 || part.left < previous.left ||
            part.left - previous.left - previous.width > Math.max(previous.height, part.height) * 4) lines.push([part]);
        else line.push(part);
      }
      return lines.map(line => {
        const left = Math.min(...line.map(p => p.left)), top = Math.min(...line.map(p => p.top));
        return {left, top, width: Math.max(...line.map(p => p.left + p.width)) - left, height: Math.max(...line.map(p => p.top + p.height)) - top};
      });
    };
    const found = [], terms = highlightTerms(query || ''), phrases = quotedPhrases(terms);
    if (phrases.length) {
      const expected = phrases.map(expectedOf), normalized = words.map(word => ocrWords(word.content));
      for (let start = 0; start < words.length;) {
        let end = start + 1;
        const own = flow(words[start].block);
        while (end < words.length && flow(words[end].block) === own) end++;
        const positioned = [];
        for (let i = start; i < end; i++) for (const text of normalized[i]) positioned.push({text, word: i});
        const texts = positioned.map(p => p.text);
        for (const phrase of expected) for (const [first, last] of phraseRanges(texts, phrase)) {
          const from = positioned[first].word, to = positioned[last].word;
          found.push([from, {boxes: boxes(words.slice(from, to + 1).flatMap(word => word.parts))}]);
        }
        start = end;
      }
    }
    const tokens = extraTokens(terms), known = new Map();
    const wordMatches = content => {
      if (!known.has(content)) known.set(content, tokens.some(token => {
        const target = letters(token);
        if (target.length === 1) return letters(content) === target;
        const slack = slackFor(tokens, token);
        return tokenMatches(content, token, slack) || (content.match(re.piece) || []).some(piece => tokenMatches(piece, token, slack));
      }));
      return known.get(content);
    };
    for (let i = 0; tokens.length && i < words.length;) {
      const direct = wordMatches(words[i].content), next = words[i + 1];
      const joined = !direct && next && flow(words[i].block) === flow(next.block) && tokens.some(token => {
        const a = letters(words[i].content), b = letters(next.content);
        return a.length >= 2 && a.length <= 5 && b.length >= 2 && a.length + b.length <= letters(token).length + 1 && tokenMatches(words[i].content + next.content, token, 0);
      });
      if (direct || joined) found.push([i, {boxes: boxes([...words[i].parts, ...(joined ? next.parts : [])])}]);
      i += joined ? 2 : 1;
    }
    const unique = new Map(found.sort((a, b) => a[0] - b[0]).map(([, match]) => [JSON.stringify(match), match]));
    return {pageSize: [width, height], matches: [...unique.values()], status: 'AVAILABLE'};
  };
  globalThis.gdpAlto = {parse, countMatches, ocrWords, phraseRanges, expectedOf};
})();
(() => {
  const endpoint = globalThis.gdpAppsScriptEndpoint;
  if (!globalThis.google?.script?.run && !endpoint) return;
  const fetchOriginal = globalThis.fetch.bind(globalThis);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  // Galiciana puede tardar 40 s la primera vez: el mismo límite para todo, como la APK (readTimeout).
  const LIMIT_MS = 90000;
  const rpc = async (signal, name, ...args) => {
    signal?.throwIfAborted();
    if (globalThis.google?.script?.run) return new Promise((resolve, reject) =>
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[name](...args));
    // AbortSignal.any no está en los navegadores de antes de 2024: se enlazan a mano.
    const controller = new AbortController();
    const leave = () => controller.abort(signal.reason);
    const timer = setTimeout(() => controller.abort(new DOMException('signal timed out', 'TimeoutError')), LIMIT_MS);
    signal?.addEventListener('abort', leave);
    let result;
    try {
      const response = await fetchOriginal(endpoint, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ name, args }), signal: controller.signal,
      });
      if (!response.ok) throw Error('La pasarela respondió HTTP ' + response.status + '.');
      result = await response.json();
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', leave); }
    if (!result.ok) throw Error(result.error || 'La pasarela no devolvió una respuesta válida.');
    return result.value;
  };
  const xml = (source, tag) => {
    const doc = new DOMParser().parseFromString(source || '', 'application/xml');
    return Array.from(doc.getElementsByTagNameNS('*', tag));
  };
  const decode = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const fold = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const words = text => fold(text).match(/[\p{L}\p{N}]+/gu) || [];
  const matches = (text, query) => {
    const tokens = new Set(words(text));
    return words(query).every(word => tokens.has(word));
  };
  const documentPages = (path, source) => {
    const files = new Map(xml(source, 'file').map(file => {
      const link = file.getElementsByTagNameNS('*', 'FLocat')[0];
      return [file.getAttribute('ID'), link?.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || link?.getAttribute('href') || ''];
    }));
    const imageId = href => href?.match(/(?:imagen_id\.(?:do|cmd)\?[^\s]*?idImagen=|object-miniature\.do\?id=)(\d+)/i)?.[1];
    const leaves = xml(source, 'div').filter(div => !div.getElementsByTagNameNS('*', 'div').length)
      .sort((a, b) => Number(a.getAttribute('ORDER') || Infinity) - Number(b.getAttribute('ORDER') || Infinity));
    const images = new Map();
    for (const leaf of leaves) {
      const links = Array.from(leaf.getElementsByTagNameNS('*', 'fptr'), ptr => files.get(ptr.getAttribute('FILEID')));
      const id = links.map(imageId).find(Boolean);
      if (id && !images.has(id)) images.set(id, links.some(href => /alto|ocr/i.test(href || '')));
    }
    if (!images.size) for (const href of files.values()) {
      const id = imageId(href);
      if (id) images.set(id, false);
    }
    if (!images.size) throw Error('El ejemplar no contiene páginas reconocibles.');
    // Las páginas no enlazan su texto, así que hasOcr no sirve para saber si la obra lo tiene.
    const hasText = [...files.values()].some(href => /descargar(?:Alto|TextoOCR)/i.test(href || ''));
    // Algunas obras se digitalizaron en un solo PDF: su «página» no es una imagen que se pueda dibujar.
    const kinds = new Map(xml(source, 'file').map(file => [imageId(files.get(file.getAttribute('ID'))), file.getAttribute('MIMETYPE') || '']));
    const pdf = [...images.keys()].every(id => /\/pdf\b/i.test(kinds.get(id) || ''));
    return { path, title: xml(source, 'title')[0]?.textContent, hasText, ...(pdf ? { pdf } : {}), pages:
      Array.from(images, ([imageId, hasOcr], index) => ({ imageId, hasOcr, position: index + 1, label: 'Pág. ' + (index + 1) })) };
  };
  const resource = async (name, path, position, imageId, signal) => {
    const data = await rpc(signal, 'recursoReferencia', name, path, position, imageId);
    if (data.error || !data[name]) throw Error(data.error || 'Galiciana no devolvió el recurso.');
    return decode(data[name]);
  };
  const text = bytes => new TextDecoder().decode(bytes);
  const work = async (path, signal) => documentPages(path, text(await resource('mets', path, '1', '0', signal)));
  // Galiciana responde 500 (o 404) cuando una página no tiene texto; cualquier otra cosa es un fallo.
  const absent = error => /^Galiciana respondió HTTP (?:404|500)$/.test(error?.message || '');
  const page = async (path, position, imageId, query, part, signal) => {
    const [ocr, alto] = await Promise.allSettled([
      part === 'alto' ? Promise.resolve(null) : resource('ocr', path, position, imageId || '0', signal),
      query && part !== 'ocr' ? resource('alto', path, position, imageId || '0', signal) : Promise.resolve(null),
    ]);
    signal?.throwIfAborted();
    const failed = [ocr, alto].find(result => result.status === 'rejected' && !absent(result.reason));
    if (failed && (part || ![ocr, alto].some(result => result.value))) throw failed.reason;
    const readable = value => { const found = value ? text(value) : ''; return /^\s*<(?:html|!doctype)/i.test(found) ? '' : found; };
    const { parse, countMatches } = globalThis.gdpAlto;
    let ocrText = ocr.status === 'fulfilled' ? readable(ocr.value) : '';
    const found = !query ? {pageSize:[0,0],matches:[],status:'EMPTY'}
      : alto.status === 'fulfilled' && alto.value ? parse(text(alto.value), query) : {pageSize:[0,0],matches:[],status:'UNAVAILABLE'};
    // Sin marcas, el texto dice si la palabra está aunque no se sepa dónde (ViewerScreen.kt).
    if (part === 'alto' && query && !found.matches.length) {
      try { ocrText = readable(await resource('ocr', path, position, imageId || '0', signal)); }
      catch (error) { signal?.throwIfAborted(); if (!absent(error)) return { ocrText:'', ocrFailed:true, matchCount:0, alto:found }; }
    }
    return { ocrText, matchCount:found.matches.length || countMatches(ocrText, query), alto:found };
  };
  const image = async (path, position, id, signal) => {
    const imageId = id || (await work(path, signal)).pages.find(p => p.position === Number(position))?.imageId;
    if (!imageId) throw Error('No se ha encontrado la imagen de la página.');
    return resource('jpeg', path, position, imageId, signal);
  };
  globalThis.gdpReferenceImage = async url => {
    const params = new URL(url, location.href).searchParams;
    const bytes = await image(params.get('path'), params.get('position'), params.get('imageId'));
    return URL.createObjectURL(new Blob([bytes], { type:'image/jpeg' }));
  };
  // Search normalization and scoring follow Highlight.kt and SearchRanking.kt.
  const hyphens = /[-‐‑–—\u00ad]\s*/gu;
  const searchFold = value => fold(value.replace(hyphens, ''));
  const queryTokens = value => value.match(/[\p{L}\p{N}]+(?:[-‐‑–—\u00ad][\p{L}\p{N}]+)*/gu) || [];
  const letters = value => searchFold(value).replace(/[^a-z0-9]/g, '');
  const phrases = value => [...value.matchAll(/"([^"]+)"/g)].map(match => match[1].trim()).filter(Boolean);
  const normalizedQuery = value => value.replace(/[“”«»„‟]/g, '"').replace(/[\s\u200B\u2060]+/gu, ' ').trim();
  const fullyQuoted = value => phrases(value).length === 1 && !queryTokens(value.replace(/"[^"]+"/g, '')).length;
  const searchTerms = query => [...new Set(queryTokens(query).map(letters).filter(Boolean))];
  const pageScore = (snippets, terms, quoted) => {
    const indexes = new Map(terms.map((term, index) => [term, index]));
    const seen = new Set();
    let best = 0;
    let strong = 0;
    for (const snippet of snippets) {
      const tokens = queryTokens(searchFold(snippet));
      for (let start = 0; start < tokens.length; start++) {
        const first = indexes.get(tokens[start]);
        if (first === undefined) continue;
        const found = new Set([first]);
        seen.add(first);
        let last = first;
        let ordered = true;
        let adjacent = 0;
        for (let end = start + 1; end <= Math.min(start + 35, tokens.length - 1); end++) {
          const index = indexes.get(tokens[end]);
          const previous = indexes.get(tokens[end - 1]);
          if (previous !== undefined && index === previous + 1) adjacent++;
          if (index === undefined || found.has(index)) continue;
          seen.add(index);
          found.add(index);
          if (index < last) ordered = false;
          last = index;
          const gap = end - start + 1 - found.size;
          const all = found.size === terms.length;
          const skipped = !quoted && terms.length >= 3 && found.size === terms.length - 1 &&
            found.has(0) && found.has(terms.length - 1);
          best = Math.max(best, found.size * 2500 + Math.max(0, 6000 - gap * 250) +
            (ordered ? 800 : 0) + (all ? 1000 : 0) + (skipped ? 1500 : 0) +
            Math.min(adjacent, terms.length - 1) * 800 +
            (all && ordered && gap === 0 ? 1200 + (quoted ? 2500 : 0) : 0));
          if (ordered && gap <= 2) strong++;
        }
      }
    }
    return {seen, score: best ? best + Math.min(20, strong) * 15 :
      seen.size === terms.length && terms.length > 1 ? 1000 * seen.size : 200 * seen.size};
  };
  const hitKey = hit => hit.path + '|' + (hit.position == null ? (hit.imageId ? 'image:' + hit.imageId : 'unknown:' + hit.unknownId) : hit.position);
  const hitAliases = hit => [hitKey(hit), ...(hit.imageId ? [hit.path + '|image:' + hit.imageId] : [])];
  const mergeHits = hits => {
    const merged = [], aliases = new Map();
    for (const hit of hits) {
      const previous = hitAliases(hit).map(key => aliases.get(key)).find(index => index !== undefined);
      const index = previous ?? merged.length, prior = merged[index];
      merged[index] = prior ? {...prior, position: prior.position ?? hit.position, imageId: prior.imageId || hit.imageId,
        parentTitle: prior.parentTitle || hit.parentTitle,
        snippets: [...new Set([...prior.snippets, ...hit.snippets])]} : hit;
      for (const key of [...hitAliases(hit), ...hitAliases(merged[index])]) aliases.set(key, index);
    }
    return merged;
  };
  const groupsFor = hits => {
    const groups = new Map();
    for (const hit of hits) {
      const key = hit.path ?? hit.title;
      if (!groups.has(key)) groups.set(key, {title:hit.title, parentTitle:hit.parentTitle, pages:[], occurrenceCount:0});
      const group = groups.get(key);
      group.pages.push(hit);
      group.occurrenceCount += hit.snippets.length;
    }
    return [...groups.values()];
  };
  const year = group => Math.max(0, ...(`${group.title} ${group.parentTitle || ''}`.match(/\b(?:17|18|19|20)\d{2}\b/g) || []).map(Number));
  const titleKey = title => searchFold(title.trim().replace(/^\d+\s*[-.:)]\s*/, ''))
    .replace(/^(?:(?:el|la|los|las|lo|un|una|unos|unas|o|a|os|as|unha|uns|unhas|the|le|les|l)\s+)+/, '');
  const orderedResults = (hits, query, sort = 'Relevancia', asc = false, localOrder = false) => {
    const terms = searchTerms(query);
    const quoted = fullyQuoted(query);
    const score = snippets => pageScore(snippets, terms, quoted);
    const displayed = hits.map(hit => ({...hit, snippets: hit.snippets
      .map(value => ({value, score:score([value]).score}))
      .sort((a,b) => b.score - a.score).map(item => item.value)}));
    let groups = groupsFor(displayed);
    if (sort === 'Relevancia' && terms.length) {
      groups = groups.map(group => {
        const pages = group.pages.map(hit => ({hit, ...score(hit.snippets)})).sort((a,b) => b.score - a.score);
        const seen = new Set(pages.flatMap(page => [...page.seen]));
        const best = pages[0]?.score || 0;
        const titleWords = queryTokens(searchFold(group.title + ' ' + (group.parentTitle || '')));
        const relevance = best + (terms.length > 1 && seen.size === terms.length && best < 4000 ? 1800 : 0) +
          (terms.every(term => titleWords.includes(term)) ? 1200 : 0);
        return {group:{...group, pages:pages.map(page => page.hit)}, relevance};
      }).sort((a,b) => b.relevance - a.relevance || year(b.group) - year(a.group)).map(item => item.group);
    } else if (localOrder && ['Titulo','Autor','Fecha'].includes(sort)) {
      const key = group => sort === 'Fecha' ? year(group) :
        titleKey(sort === 'Autor' ? group.parentTitle ?? group.title : group.title);
      groups.sort((a,b) => (asc ? 1 : -1) * (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    }
    return {hits:displayed, groups};
  };
  const editDistance = (a, b) => {
    let row = Array.from({length:b.length + 1}, (_, index) => index);
    for (let i = 0; i < a.length; i++) {
      const next = [i + 1];
      for (let j = 0; j < b.length; j++) {
        next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])));
      }
      row = next;
    }
    return row[b.length];
  };
  const phraseMatches = (text, phrase) => {
    const expected = queryTokens(phrase).map(letters).filter(Boolean);
    const tokens = searchFold(text).replace(/(?<=[a-z])[�□■#*?](?=[a-z])/g, '?').match(/[a-z0-9?]+/g) || [];
    if (!expected.length) return false;
    if (expected.length === 1) return tokens.includes(expected[0]);
    const cost = (word, target) => {
      if (word === target) return 0;
      if (target.length >= 3 && word.split('?').length === 2) {
        const gap = word.indexOf('?');
        if (word.replace('?', '') === target ||
            (word.length === target.length && [...word].every((char, i) => i === gap || char === target[i]))) return 0;
      }
      return target.length >= 5 && word.length >= 4 &&
        Math.abs(word.length - target.length) <= 1 && editDistance(word, target) === 1 ? 1 : 2;
    };
    return tokens.some((_, start) => {
      let index = start;
      let errors = 0;
      for (const target of expected) {
        if (index >= tokens.length) return false;
        const word = tokens[index];
        const direct = cost(word, target);
        if (errors + direct <= 1) { errors += direct; index++; continue; }
        const joined = index + 1 < tokens.length && word.length >= 2 && word.length <= 5
          ? cost(word + tokens[index + 1], target) : 2;
        if (errors + joined > 1) return false;
        errors += joined;
        index += 2;
      }
      return true;
    });
  };
  const fetchSearchPage = async (preset, cursor, sort, asc, signal, session) => {
    const data = await rpc(signal, 'buscarReferencia', preset, cursor, sort, asc, session);
    if (data.error || data.estado !== 200) throw Error(data.error || 'Galiciana no devolvió resultados válidos.');
    const doc = new DOMParser().parseFromString(data.html, 'text/html');
    const clean = value => (value || '').replace(/\s+/g, ' ').trim();
    const readHit = (node, card, unit) => {
      const link = node.querySelector('a[href*="grupo.do"][href*="path="]');
      if (!link) return null;
      const url = new URL(link.getAttribute('href'), 'https://biblioteca.galiciana.gal/es/consulta/');
      const path = url.searchParams.get('path');
      if (!/^\d+$/.test(path || '')) return null;
      const parentTitle = unit ? clean(node.innerHTML.match(/En:\s*([^<]+)/)?.[1]) || null : null;
      const title = clean(link.getAttribute('data-analytics-recordtitle')) ||
        clean(card?.querySelector('.titulo')?.textContent) || parentTitle || 'Documento ' + path;
      const position = Number(url.searchParams.get('posicion')) ||
        (unit ? Number(node.textContent.match(/p[áa]g(?:ina|\.)?\s*(\d+)/i)?.[1]) || null : 1);
      const snippets = unit ? [...new Set(Array.from(node.querySelectorAll('ul.texto_ocurrencias li'),
        item => clean(item.textContent)).filter(value => value.length >= 3 && /[\p{L}\p{N}]/u.test(value)))].slice(0, 12) : [];
      const imageId = url.searchParams.get('idImagen');
      return {path, position, title, parentTitle, imageId, snippets,
        ...(!position && !imageId ? {unknownId:crypto.randomUUID()} : {})};
    };
    const cards = [...doc.querySelectorAll('.nav_registros .nav_registro')];
    const units = (node, card) => [...node.querySelectorAll('.unidad_textual')].map(unit => readHit(unit, card, true)).filter(Boolean);
    const hits = cards.length ? cards.flatMap(card => {
      const pages = units(card, card);
      return pages.length ? pages : [readHit(card, card, false)].filter(Boolean);
    }) : units(doc, null);
    const empty = /sin resultados|no hay resultados|no se (?:han? |ha )?(?:encontrado|encontraron|hallado|hallaron) (?:resultados|documentos|registros)|no (?:ha |han )?(?:producido|obtenido|devuelto) resultados|ning[uú]n (?:resultado|documento|registro)/i;
    const nav = doc.querySelector('.navegacion_resultados')?.textContent || '';
    const total = nav.match(/\b\d+\s+al\s+\d+\s+de\s+([\d.]+)\b/i)?.[1];
    const totalWorks = total === undefined ? null : Number(total.replaceAll('.', ''));
    if (!hits.length && !empty.test(doc.body.textContent) && totalWorks !== 0) {
      throw Error('Galiciana no ha devuelto una página de resultados reconocible. Vuelve a intentarlo.');
    }
    return {hits, cursor:data.cursor, totalWorks, order:data.ordenAplicado};
  };
  const search = async ({preset, cursors = [], sort = 'Relevancia', asc = false, session}, signal) => {
    if (cursors.length > 2) throw Error('Cursores de búsqueda no válidos.');
    const query = normalizedQuery(preset.query);
    const apiQuery = (query.match(/"/g) || []).length % 2 ? query.replaceAll('"', '') : query;
    const section = preset.advanced ? (preset.section || '').trim() : '';
    const sections = fold(section) === 'sucesos y sociedad' ? ['Sucesos','Sociedad'] : [section];
    const pages = await Promise.all(cursors.length ? cursors.map(cursor => fetchSearchPage(preset, cursor, sort, asc, signal)) :
      sections.map(name => fetchSearchPage({...preset, query:[apiQuery, name].filter(Boolean).join(' ')}, '', sort, asc, signal, sections.length === 1 ? session : undefined)));
    const raw = mergeHits(pages.flatMap(page => page.hits));
    const required = preset.fullText === false ? [] : phrases(apiQuery);
    const accepted = hit => required.every(phrase =>
      [...hit.snippets, hit.title, hit.parentTitle || ''].some(value => phraseMatches(value, phrase)));
    const verified = raw.filter(accepted);
    const unverified = raw.filter(hit => !accepted(hit));
    const nextUrls = [...new Set(pages.map(page => page.cursor).filter(Boolean))];
    return {...orderedResults(verified, preset.fullText === false ? '' : query, sort),
      nextUrls, sortUrls:{}, totalWorks:pages.length === 1 ? pages[0].totalWorks : null,
      incomplete:Boolean(nextUrls.length), globalSortAvailable:pages.length === 1 &&
        Boolean(pages[0].order && pages[0].order === ({Fecha:'fechapublicacionorden',Titulo:'tituloorden',Autor:'autororden'})[sort]),
      unverifiedQuoted:unverified.slice(0,200), unverifiedQuotedTruncated:unverified.length > 200};
  };
  const auxiliary = async (body, variant, signal) => {
    const { preset, exclude = [] } = body;
    const query = normalizedQuery(preset.query);
    if (preset.fullText === false || !query) throw Error('La búsqueda auxiliar necesita una consulta OCR.');
    const phrase = fullyQuoted(query) && !(preset.advanced && preset.section) ? phrases(query)[0] : null;
    if (variant && !phrase) return {hits:[],groups:[],incomplete:false,truncated:false};
    const tokens = variant ? queryTokens(query) :
      [...new Map(queryTokens(query).map(word => [word.toLowerCase(),word])).values()];
    const candidates = new Set();
    if (tokens.length === 1) {
      if (variant) candidates.add(tokens[0]);
      else if (tokens[0].length >= 5) for (let i = 0; i < Math.min(12,tokens[0].length); i++) {
        candidates.add(tokens[0].slice(0,i)+'?'+tokens[0].slice(i+1));
      }
    } else if (tokens.length > 1) {
      candidates.add(tokens.join(' '));
      for (let i = 0; i < tokens.length && candidates.size < 12; i++) {
        candidates.add(tokens.filter((_, index) => index !== i).join(' '));
      }
      if (!variant) for (let i = 0; i < tokens.length && candidates.size < 12; i++) {
        for (let j = i+1; j < tokens.length && candidates.size < 12; j++) candidates.add(tokens[i]+' '+tokens[j]);
      }
    }
    const excluded = new Set(exclude.flatMap(hitAliases));
    const found = new Map();
    let incomplete = false, successful = 0, firstError;
    const queries = [...candidates];
    const maxPages = tokens.length === 1 ? (variant ? 4 : 1) : 2;
    const scan = async term => {
      const candidate = {...preset, query:term};
      const first = await fetchSearchPage(candidate, '', 'Relevancia', false, signal);
      const hits = [...first.hits];
      let cursor = first.cursor;
      for (let index = 1; cursor && index < maxPages; index++) {
        try {
          const next = await fetchSearchPage(candidate, cursor, 'Relevancia', false, signal);
          hits.push(...next.hits);
          if (next.cursor === cursor) break;
          cursor = next.cursor;
        } catch {
          break; // Keep the verified page already read and mark the scan partial.
        }
      }
      return {hits, cursor};
    };
    // De una en una, como la APK: a la vez se ponen en cola en Galiciana (24, 38 y 46 s).
    for (const term of queries) {
      signal?.throwIfAborted();
      const [result] = await Promise.allSettled([scan(term)]);
      signal?.throwIfAborted();
      if (result.status === 'rejected') { incomplete = true; firstError ||= result.reason; continue; }
      successful++;
      incomplete ||= Boolean(result.value.cursor);
      for (const hit of result.value.hits) {
        const key = hitKey(hit);
        if (hitAliases(hit).some(alias => excluded.has(alias))) continue;
        const snippets = hit.snippets;
        if (variant && !snippets.some(value => phraseMatches(value, phrase))) continue;
        const prior = found.get(key);
        found.set(key,{...hit,savedQuery:preset.query,snippets:[...new Set([...(prior?.snippets || []),...snippets])]});
      }
    }
    if (queries.length && !successful) throw firstError;
    const limit = variant ? 200 : Math.min(200,Math.max(1,Number(body.limit)||50));
    const candidatesFound = mergeHits([...(variant ? [] : body.unverifiedQuoted || []), ...found.values()])
      .filter(hit => !hitAliases(hit).some(alias => excluded.has(alias)));
    const truncated = candidatesFound.length > limit;
    return {...orderedResults(candidatesFound.slice(0,limit), query), incomplete:incomplete||truncated,truncated};
  };
  const base = 'https://biblioteca.galiciana.gal/es/';
  const catalogueDoc = async (signal, url, form = null) =>
    new DOMParser().parseFromString(await rpc(signal, 'catalogoReferencia', url, form), 'text/html');
  const nextLink = (doc, url) => {
    const href = doc.querySelector('#boton_siguiente[href], a[rel=next][href]')?.getAttribute('href');
    return href ? new URL(href, url).href : null;
  };
  const sections = [
    ['Libros y monografías','13124554','MONOGRAFIA'], ['Mapas y planos','14098722','CARTOGRAF'],
    ['Manuscritos','13948376','MANUSCRITO'], ['Imágenes y documentos gráficos','13787413','ILUSFOT'],
    ['Archivos personales','14185891','ARQUIVOS'], ['Grabaciones sonoras','13872855','SONS'],
    ['Vídeos y audiovisuales','14098722','AUDIOVISUA'], ['Partituras y música impresa','13948376','MUSICA'],
  ].map(([title,imageId,code]) => ({title,imageId,code}));
  const children = {
    ILUSFOT: [['Carteles','13124554','CARTEIS'],['Tarjetas postales','13787413','POSTAIS'],['Impresos efímeros','14185891','EPHEMERA'],['Imágenes del portal conjunto','14153014','FOTOS']],
    ARQUIVOS: [['Camilo Díaz Baliño','14185891','ARQCDB'],['Carlos Casares','14185891','ARQCCM']],
  };
  for (const section of sections) {
    if (children[section.code]) section.children = children[section.code].map(([title,imageId,code]) =>
      ({title,imageId,code,filterCode:section.code+'_'+code}));
  }
  const news = async signal => {
    const url = base + 'cms/coleccion.do?id=novedades%2Fnoticias';
    const doc = await catalogueDoc(signal, url);
    const latest = new Map();
    for (const a of doc.querySelectorAll('#contenido a[href],#pagina_contenido a[href]')) {
      const link = new URL(a.getAttribute('href'),url);
      if (link.origin !== new URL(base).origin || link.pathname !== '/es/cms/elemento.do' ||
          !link.searchParams.get('id')?.startsWith('novedades/noticias/')) continue;
      const card = a.closest('article,li,[class*=noticia],[class*=news]') || a.parentElement;
      const title = card?.querySelector('h2,h3,h4')?.textContent.trim() || a.textContent.trim();
      if (title.length < 8 || latest.has(fold(title))) continue;
      const description = Array.from(card?.querySelectorAll('.resumen,.descripcion,p') || [], p=>p.textContent.trim())
        .find(value=>value.length>20 && value!==title) || '';
      latest.set(fold(title),{title,description,url:link.href});
      if (latest.size === 3) break;
    }
    return {latest:[...latest.values()]};
  };
  // Every digitised issue on a year page of the Hemeroteca, with its date when the page gives one.
  const issuesOf = (doc, url) => {
    const issues = new Map();
    for (const link of doc.querySelectorAll('a[href*="grupo.do"][href*="path="]')) {
      if (!/^copia di[xg]ital/i.test(link.textContent.trim())) continue;
      const path = new URL(link.getAttribute('href'), url).searchParams.get('path');
      let context = '';
      for (let node = link.parentElement, depth = 0; node && depth < 7; node = node.parentElement, depth++) {
        if ([...node.querySelectorAll('a[href*="grupo.do"]')].filter(a => /copia/i.test(a.textContent)).length > 1) break;
        const value = node.textContent.trim().replace(/\s+/g, ' ');
        if (value.length > context.length) context = value;
      }
      const number = context.match(/\b(?:n[uú]mero|n[uú]m\.)\s*(?:s\.n\.|\d+[A-Za-z0-9./-]*)/i)?.[0];
      const months = ['xaneiro enero jan','febreiro febrero feb','marzo mar','abril abr','maio mayo may',
        'xuno junio jun','xullo julio jul','agosto ago','setembro septiembre setiembre sep',
        'outubro octubre oct','novembro noviembre nov','decembro diciembre dic'];
      const normalized = fold(context);
      const month = months.findIndex(names => names.split(' ').some(name => new RegExp('\\b'+name+'\\b').test(normalized))) + 1;
      const numeric = context.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
      const written = normalized.match(/\b(\d{4})\s+([a-z]+)\s+(\d{1,2})\b/);
      const reversed = normalized.match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})\b/);
      const named = written || reversed;
      const namedMonth = named ? months.findIndex(names => names.split(' ').includes(named[2])) + 1 : 0;
      const date = numeric ? [numeric[3],numeric[2],numeric[1]] :
        namedMonth ? [written ? written[1] : reversed[3],namedMonth,written ? written[3] : reversed[1]] : null;
      const formatted = date ? [date[2],date[1],date[0]].map(v=>String(v).padStart(2,'0')).join('/') : '';
      const label = [number,formatted].filter(Boolean).join(' · ') || 'Ejemplar sin fecha identificada';
      if (path) issues.set(path,{path,label,month:date ? Number(date[1]) : month || null,
        day:date ? [date[0],date[1],date[2]].map((v,i)=>String(v).padStart(i?2:4,'0')).join('-') : null});

    }
    return [...issues.values()];
  };
  // «Tal día como hoxe»: the daily papers of the Hemeroteca with an issue for almost every day.
  // Galician dailies in the Hemeroteca with a long, nearly daily run, most issues first (index of 28 Nov 2026).
  const dailies = [
    ['2342','El Correo Gallego',1878,1965],['215','El Pueblo Gallego',1924,1979],['128','El Regional',1885,1931],
    ['10043','La Región',1910,1955],['157','El Ideal Gallego',1917,1959],['3762','El Progreso',1941,1981],
    ['3144','El Diario de Pontevedra',1897,1976],['172','La Integridad',1888,1925],['147','Gaceta de Galicia',1879,1918],
    ['182','La Voz de la Verdad',1910,1937],['74','El Compostelano',1920,1946],['922','La Noche',1946,1967],
    ['200','El Norte de Galicia',1901,1923],['146','Galicia Nueva',1907,1929],['170','La Correspondencia Gallega',1897,1920],
    ['120','El Lucense',1886,1901],['71','El Correo de Galicia',1900,1919],['1862','La Zarpa',1921,1936],
    ['108','El Eco de Galicia',1872,1898],['155','La Idea Moderna',1898,1919],['187','El Miño',1898,1912],
    ['2883','El Eco de Santiago',1906,1938],['4323','Diario de Avisos de La Coruña',1871,1893],['103','El Eco de Galicia',1908,1915],
    ['254','El Telegrama',1874,1898],['6863','La Monarquía',1887,1896],['99','El Áncora',1897,1904],
    ['3162','Noticiero de Vigo',1905,1915],['7962','Galicia',1930,1935],
  ].map(([id,title,from,to]) => ({id,title,from,to}));
  const yearIssues = new Map();
  const issuesFor = (id, year, signal) => {
    const key = id + ':' + year;
    if (!yearIssues.has(key)) {
      const url = base + 'publicaciones/numeros_por_mes.do?' + new URLSearchParams({idPublicacion:id, anyo:String(year)});
      const request = catalogueDoc(signal, url).then(doc => issuesOf(doc, url));
      request.catch(() => yearIssues.delete(key));
      yearIssues.set(key, request);
    }
    return yearIssues.get(key);
  };
  const isoDay = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.toISOString().slice(0,10); };
  // The issue of that day, or of up to three days before when none came out (no paper on Mondays).
  const issueNear = async (paper, y, m, d, signal) => {
    const issues = await issuesFor(paper.id, y, signal);
    for (let back = 0; back <= 3; back++) {
      const day = isoDay(y, m, d - back);
      const found = issues.find(issue => issue.day === day);
      if (found) return {...found, day, exact:back === 0, paper:paper.title, publicationId:paper.id};
    }
    return null;
  };
  const firstImage = async (path, signal) => {
    try { return (await work(path, signal)).pages[0]?.imageId || null; }
    catch (error) { signal?.throwIfAborted(); return null; }
  };
  const onThisDay = async (p, signal) => {
    const match = (p.get('date') || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw Error('Fecha no válida.');
    const [y, m, d] = match.slice(1).map(Number);
    const covering = year => dailies.filter(paper => paper.from <= year && year <= paper.to);
    const attempt = async (paper, year) => {
      try { return await issueNear(paper, year, m, d, signal); }
      catch (error) { signal?.throwIfAborted(); return null; }
    };
    const withImage = async issue => ({...issue, imageId:await firstImage(issue.path, signal)});
    let items;
    if (p.get('years')) {
      // «Tal día como hoxe»: one paper a year, the first in the list that has that day; four tries at most.
      const ago = p.get('years').split(',').map(Number).filter(n => n > 0 && n < 300).slice(0, 4);
      items = (await Promise.all(ago.map(async years => {
        const year = y - years;
        for (const paper of covering(year).slice(0, 4)) {
          const issue = await attempt(paper, year);
          if (issue) return withImage({...issue, years, year});
        }
        return null;
      }))).filter(Boolean);
    } else {
      // «Un día na hemeroteca»: every daily that came out that day (or the day before when none did).
      items = await Promise.all((await Promise.all(covering(y).slice(0, 12).map(paper => attempt(paper, y))))
        .filter(Boolean).map(issue => withImage({...issue, years:0, year:y})));
    }
    return {date:isoDay(y, m, d), items, covered:dailies.length};
  };
  const hemeroteca = async (p, signal) => {
    const id = p.get('id'), year = p.get('year');
    if (id) {
      const url = base + 'publicaciones/numeros_por_mes.do?' + new URLSearchParams({idPublicacion:id, ...(year && year !== 'all' ? {anyo:year} : {})});
      const doc = await catalogueDoc(signal, url);
      if (!year) return { years: [...new Set(Array.from(doc.querySelectorAll('a[href*="anyo="]'), a =>
        new URL(a.getAttribute('href'), url).searchParams.get('anyo')).filter(y => /^\d{4}$/.test(y || '')))].sort() };
      return {issues:issuesOf(doc, url)};
    }
    const index = base + 'publicaciones/listar_cabeceras.do';
    const letter = p.get('letter') || 'A';
    let url = p.get('url') || index + '?' + new URLSearchParams({letra:letter,posicion:'1'});
    let doc = await catalogueDoc(signal, url);
    const query = p.get('q') || '';
    const q = fold(query);
    if (query && !p.get('url')) {
      const form = Array.from(doc.forms).find(item =>
        Array.from(item.querySelectorAll('input[name]')).some(input => /titulo|title|^patron$/i.test(input.name)));
      const field = form && Array.from(form.querySelectorAll('input[name]')).find(input => /titulo|title|^patron$/i.test(input.name));
      const fields = new URLSearchParams();
      if (field) {
        for (const input of form.querySelectorAll('input[name]')) {
          if (input.type === 'hidden' || input.type === 'text') fields.set(input.name,input === field ? query : input.value);
        }
        const submit = Array.from(form.querySelectorAll('[type=submit][name]')).find(input => input.name && !/limpiar/i.test(input.value+' '+input.textContent));
        if (submit) fields.set(submit.name,submit.value);
      } else {
        fields.set('letra','no');
        fields.set('patron',query);
      }
      const action = new URL(form?.getAttribute('action') || index,url);
      if (!field || form.method.toLowerCase() === 'post') doc = await catalogueDoc(signal, action.href,fields.toString());
      else {
        for (const [key,value] of fields) action.searchParams.set(key,value);
        doc = await catalogueDoc(signal, action.href);
      }
      url = action.href;
    }
    const cabeceras = new Map();
    for (const a of doc.querySelectorAll('a[href*="idPublicacion="]')) {
      const id = new URL(a.getAttribute('href'), url).searchParams.get('idPublicacion');
      const isTitle = value => /\p{L}/u.test(value) && !/^(copia|ver números|filtrar)/i.test(value);
      const label = a.textContent.trim();
      const title = isTitle(label) ? label : a.closest('tr')?.querySelector('td a')?.textContent.trim() || '';
      if (id && isTitle(title) && fold(title).includes(q)) {
        if (!cabeceras.has(id)) cabeceras.set(id,{id,title});
      }
    }
    if (!cabeceras.size && !doc.querySelector('table.nav_registros,table#nav_registros,.pagina_actual,a[href*="idPublicacion="]')) {
      throw Error('Galiciana no devolvió un índice de Hemeroteca reconocible.');
    }
    const current = new URL(url);
    const position = Number(current.searchParams.get('posicion') || 1);
    const selectedLetter = current.searchParams.get('letra') || letter;
    const navigation = [...new Map(Array.from(doc.querySelectorAll('a[href*="listar_cabeceras.do"]'), anchor => {
      const target = new URL(anchor.getAttribute('href'),url);
      return [Number(target.searchParams.get('posicion')),target];
    }).filter(([number,target]) => number > 0 && target.origin === current.origin &&
      target.pathname === current.pathname && (target.searchParams.get('letra') || selectedLetter) === selectedLetter)).entries()]
      .sort(([a],[b])=>a-b);
    const previousUrl = navigation.filter(([number])=>number < position).at(-1)?.[1].href;
    const nextUrl = nextLink(doc,url) || navigation.find(([number])=>number > position)?.[1].href;
    return {cabeceras:[...cabeceras.values()],paginas:[],selectedLetter,previousUrl,
      letras:Array.from('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', first => ({first,second:index+'?letra='+encodeURIComponent(first)+'&posicion=1'})),
      nextUrl};
  };
  // Una ficha puede ofrecer la copia con páginas y, antes en la lista, la misma obra en PDF.
  const digitalCopy = (root, url) => {
    const links = Array.from(root.querySelectorAll('a[href*="grupo.do"][href*="path="]'));
    const kind = a => a.getAttribute('data-analytics-grouptitle') || a.textContent || '';
    const isPdf = a => /pdf/i.test(kind(a)) || !!a.querySelector('[class*=__pdf]');
    const a = links.find(a => /copia di[xg]ital/i.test(kind(a)) && !isPdf(a)) || links.find(a => !isPdf(a)) || links[0];
    return (a && new URL(a.getAttribute('href'), url).searchParams.get('path')) || undefined;
  };
  // parseCatalogueMetadata (ColeccionesScreen.kt): pares etiqueta/valor, filas o definiciones.
  const catalogueMetadata = doc => {
    const root = doc.querySelector('#panel_ficha_dc, #ficha, .ficha');
    const clean = value => (value || '').replace(/\s+/g, ' ').trim();
    const fields = new Map();
    const add = (label, values) => {
      const name = clean(label).replace(/\s*:$/, ''), value = values.map(clean).filter(Boolean).join('\n');
      if (name && value) fields.set(name + '\n' + value, {label:name,value});
    };
    for (const row of root?.querySelectorAll('.ficha_valor') || []) {
      const value = row.querySelector('.valor')?.cloneNode(true);
      value?.querySelectorAll('.related-search,i,script,style').forEach(node => node.remove());
      const pieces = Array.from(value?.querySelectorAll('.field_value') || []).filter(node => !node.parentElement.closest('.field_value'));
      add(row.querySelector('.etiqueta')?.textContent, pieces.length ? pieces.map(node => node.textContent) : [value?.textContent]);
    }
    for (const row of root?.querySelectorAll('tr') || []) {
      const cells = Array.from(row.children).filter(cell => /^t[hd]$/i.test(cell.tagName));
      if (cells.length >= 2) add(cells[0].textContent, cells.slice(1).map(cell => cell.textContent));
    }
    for (const term of root?.querySelectorAll('dt') || []) {
      const values = [];
      for (let next = term.nextElementSibling; next && next.tagName !== 'DT'; next = next.nextElementSibling)
        if (next.tagName === 'DD') values.push(next.textContent);
      add(term.textContent, values);
    }
    return [...fields.values()];
  };
  const collections = async (p, signal) => {
    const code = p.get('code'), q = p.get('q');
    const section = sections.flatMap(item => [item,...(item.children || [])]).find(item => item.code === code);
    const listing = code === 'FOTOS' ? 'https://www.galiciana.gal/arpadhub/es/' : base;
    const filter = code === 'FOTOS' ? {busq_tipodoc:'Ilustraciones y Fotos',descrip_tipodoc:'Ilustraciones y Fotos',...(q?{busq_general:q}:{})}
      : {busq_secbib:code || '',descrip_secbib:section?.title || '',presentacion:'mosaico'};
    const post = !p.get('url') && q && code !== 'FOTOS' && section;
    const url = p.get('url') || (post ? base+'consulta/resultados_ocr.do' :
      listing+'consulta/resultados_busqueda.do?'+new URLSearchParams(filter));
    const doc = await catalogueDoc(signal, url,post ? new URLSearchParams({busq_general:q,
      ['secc_'+(section.filterCode || code)]:'on',busq_objetosmultimedia:'true',tipoResultados:'BIB'}).toString() : null);
    const works = [];
    for (const card of doc.querySelectorAll('.nav_registro')) {
      const path = digitalCopy(card, url);
      const record = card.querySelector('.titulo a[href*="registro.do"],a[href*="registro.do"]');
      const title = card.querySelector('.titulo')?.textContent.trim();
      if (!title || (!path && !record)) continue;
      const image = card.querySelector('img[src*="object-miniature.do"]');
      works.push({title,path,recordUrl:record ? new URL(record.getAttribute('href'),url).href : undefined,
        thumbnailUrl:image ? new URL(image.getAttribute('src'),url).href : undefined});
    }
    if (!works.length && !doc.querySelector('.nav_registros,.navegacion_resultados') &&
        !/sin resultados|no hay resultados|no se han encontrado/i.test(doc.body.textContent)) {
      throw Error('Galiciana no devolvió una colección reconocible. Reintenta.');
    }
    return {works,nextUrl:nextLink(doc,url)};
  };
  const record = async (url, signal) => {
    const doc = await catalogueDoc(signal, url);
    const pub = doc.querySelector('a[href*="idPublicacion="]');
    const photo = url.startsWith('https://www.galiciana.gal/arpadhub/');
    return {sourceUrl:url,description:'',metadata:catalogueMetadata(doc),
      ...(photo ? {imageUrl:doc.documentElement.outerHTML.replaceAll('&amp;','&').match(/https:\/\/(?:arquivo\.galiciana\.gal\/arpadweb|biblioteca\.galiciana\.gal)\/[^\s<>"]+\/catalogo_imagenes\/imagen_id\.(?:do|cmd)\?idImagen=\d+/)?.[0]} : {}),
      path:photo ? undefined : digitalCopy(doc,url),
      publicationId:pub ? new URL(pub.getAttribute('href'),url).searchParams.get('idPublicacion') : undefined};
  };
  let oaiToken;
  const catalogueData = async (p, signal) => {
    if (p.get('kind') === 'sparql') {
      const url = 'https://datos-abertos.galiciana.gal/arpad-bibdix-lod/es/sparql?' +
        new URLSearchParams({query:p.get('q') || '',format:'application/sparql-results+json'});
      return JSON.parse(await rpc(signal, 'catalogoReferencia',url));
    }
    const next = p.get('next') === 'true';
    if (next && !oaiToken) throw Error('No quedan más registros.');
    const url = base + 'oai/oai.do?' + new URLSearchParams(next ?
      {verb:'ListRecords',resumptionToken:oaiToken} : {verb:'ListRecords',metadataPrefix:'oai_dc'});
    const raw = await rpc(signal, 'catalogoReferencia',url);
    oaiToken = xml(raw,'resumptionToken')[0]?.textContent.trim();
    const works = xml(raw,'record').flatMap(node => {
      const values = tag => Array.from(node.getElementsByTagNameNS('*',tag), el=>el.textContent.trim());
      const title = values('title')[0];
      if (!title) return [];
      const identifiers = values('identifier');
      return [{title,creators:values('creator'),date:values('date')[0],rights:values('rights')[0],
        oaiId:identifiers[0],recordUrl:identifiers.find(value=>value.startsWith(base+'consulta/registro.do')),
        path:identifiers.map(value=>value.match(/[?&]path=(\d+)/)?.[1]).find(Boolean)}];
    });
    return {works,nextToken:oaiToken};
  };
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (url.origin === location.origin && url.pathname === '/fonts/NotoSans-Regular.ttf') {
      return fetchOriginal(new URL('fonts/NotoSans-Regular-b85c38ec.ttf', document.baseURI));
    }
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return fetchOriginal(input, init);
    const p = url.searchParams;
    const signal = init?.signal;
    const path = p.get('path'), position = p.get('position'), id = p.get('imageId');
    try {
      switch (url.pathname) {
        case '/api/search/variants': return json(await auxiliary(JSON.parse(init.body),true, signal));
        case '/api/search/recovery': return json(await auxiliary(JSON.parse(init.body),false, signal));
        case '/api/search': return json(await search(JSON.parse(init.body), signal));
        case '/api/rank': {
          const { hits, query, sort, asc } = JSON.parse(init.body);
          return json(orderedResults(mergeHits(hits), normalizedQuery(query || ''), sort, asc, true));
        }
        case '/api/health': return json({ok:true,apiVersion:1,product:'Galiciana de Peto'});
        case '/api/news': return json(await news(signal));
        case '/api/match': {
          const {text,query} = JSON.parse(init.body);
          return json({count:globalThis.gdpAlto.countMatches(text,query),matches:matches(text,query)});
        }
        case '/api/hemeroteca': return json(await hemeroteca(p, signal));
        case '/api/day': return json(await onThisDay(p, signal));
        case '/api/collections/sections': return json(sections);
        case '/api/collections': return json(await collections(p, signal));
        case '/api/record': return json(await record(p.get('url'), signal));
        case '/api/data': return json(await catalogueData(p, signal));
        case '/api/work': return json(await work(path, signal));
        case '/api/page': return json(await page(path, position, id, p.get('query') || '', p.get('part') || '', signal));
        case '/api/media': {
          const media = await rpc(signal, 'imagenReferencia', p.get('url'));
          return new Response(decode(media.base64), {headers:{'Content-Type':media.mime}});
        }
        case '/api/image': return new Response(await image(path, position, id, signal), {headers:{'Content-Type':'image/jpeg'}});
        case '/api/archive/filter': {
          const { hits, query } = JSON.parse(init.body);
          return json({ hits: hits.filter(hit => matches([hit.title, hit.parentTitle, ...hit.snippets, hit.note].join(' '), query)) });
        }
        default: return json({error:'Esta ruta aún no está disponible en Apps Script.'}, 501);
      }
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      return json({ error: error.message || 'Galiciana no está disponible.' }, 502);
    }
  };
})();
