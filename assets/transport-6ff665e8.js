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
    const imageId = href => href?.match(/(?:imagen_id\.do\?[^\s]*?idImagen=|object-miniature\.do\?id=)(\d+)/i)?.[1];
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
    return { path, title: xml(source, 'title')[0]?.textContent, hasText, pages:
      Array.from(images, ([imageId, hasOcr], index) => ({ imageId, hasOcr, position: index + 1, label: 'Pág. ' + (index + 1) })) };
  };
  const resource = async (name, path, position, imageId, signal) => {
    const data = await rpc(signal, 'recursoReferencia', name, path, position, imageId);
    if (data.error || !data[name]) throw Error(data.error || 'Galiciana no devolvió el recurso.');
    return decode(data[name]);
  };
  const text = bytes => new TextDecoder().decode(bytes);
  const work = async (path, signal) => documentPages(path, text(await resource('mets', path, '1', '0', signal)));
  const box = node => Object.fromEntries([
    ['left','HPOS'], ['top','VPOS'], ['width','WIDTH'], ['height','HEIGHT'],
  ].map(([key, name]) => [key, Number(node.getAttribute(name))]));
  const page = async (path, position, imageId, query, signal) => {
    const [ocr, alto] = await Promise.allSettled([
      resource('ocr', path, position, imageId || '0', signal),
      query ? resource('alto', path, position, imageId || '0', signal) : Promise.resolve(null),
    ]);
    signal?.throwIfAborted();
    let ocrText = ocr.status === 'fulfilled' ? text(ocr.value) : '';
    if (/^\s*<(?:html|!doctype)/i.test(ocrText)) ocrText = '';
    const source = alto.status === 'fulfilled' && alto.value ? text(alto.value) : '';
    const sheet = xml(source, 'Page')[0];
    const size = ['WIDTH', 'HEIGHT'].map(name => Number(sheet?.getAttribute(name)));
    const terms = new Set(words(query));
    const found = [];
    if (sheet && terms.size) {
      const tokens = Array.from(sheet.getElementsByTagNameNS('*', 'String'));
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const word = token.getAttribute('CONTENT') || '';
        const next = tokens[i + 1];
        const substitution = token.getAttribute('SUBS_CONTENT');
        const first = token.getAttribute('SUBS_TYPE') === 'HypPart1';
        const paired = first && next?.getAttribute('SUBS_TYPE') === 'HypPart2' &&
          substitution && substitution === next.getAttribute('SUBS_CONTENT');
        if (paired && terms.has(fold(substitution))) {
          found.push({boxes:[box(token),box(next)]});
          i++;
        } else if (terms.has(fold(word).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,''))) {
          found.push({boxes:[box(token)]});
        }
      }
    }
    return { ocrText, matchCount: found.length, alto: {
      pageSize: size, matches: found.filter(match => match.boxes.every(value => value.width > 0 && value.height > 0)), status: !query ? 'EMPTY' : !sheet ? 'UNAVAILABLE' : found.length ? 'AVAILABLE' : 'EMPTY',
    }};
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
  const hitKey = hit => hit.path + '|' + hit.position;
  const mergeHits = hits => {
    const merged = new Map();
    for (const hit of hits) {
      const key = hitKey(hit);
      const prior = merged.get(key);
      merged.set(key, prior ? {...prior, imageId: prior.imageId || hit.imageId,
        parentTitle: prior.parentTitle || hit.parentTitle,
        snippets: [...new Set([...prior.snippets, ...hit.snippets])]} : hit);
    }
    return [...merged.values()];
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
      return {path, position, title, parentTitle, imageId:url.searchParams.get('idImagen'), snippets};
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
    const excluded = new Set(exclude.map(hit => hit.path+'|'+hit.position));
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
        const key = hit.path+'|'+hit.position;
        if (excluded.has(key)) continue;
        const snippets = hit.snippets;
        if (variant && !snippets.some(value => phraseMatches(value, phrase))) continue;
        const prior = found.get(key);
        found.set(key,{...hit,savedQuery:preset.query,snippets:[...new Set([...(prior?.snippets || []),...snippets])]});
      }
    }
    if (queries.length && !successful) throw firstError;
    const limit = variant ? 200 : Math.min(200,Math.max(1,Number(body.limit)||50));
    const candidatesFound = mergeHits([...(variant ? [] : body.unverifiedQuoted || []), ...found.values()])
      .filter(hit => !excluded.has(hitKey(hit)));
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
  const hemeroteca = async (p, signal) => {
    const id = p.get('id'), year = p.get('year');
    if (id) {
      const url = base + 'publicaciones/numeros_por_mes.do?' + new URLSearchParams({idPublicacion:id, ...(year && year !== 'all' ? {anyo:year} : {})});
      const doc = await catalogueDoc(signal, url);
      if (!year) return { years: [...new Set(Array.from(doc.querySelectorAll('a[href*="anyo="]'), a =>
        new URL(a.getAttribute('href'), url).searchParams.get('anyo')).filter(y => /^\d{4}$/.test(y || '')))].sort() };
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
        if (path) issues.set(path,{path,label,month:date ? Number(date[1]) : month || null});

      }
      return {issues:[...issues.values()]};
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
      const group = card.querySelector('a[href*="grupo.do"][href*="path="]');
      const record = card.querySelector('.titulo a[href*="registro.do"],a[href*="registro.do"]');
      const path = group && new URL(group.getAttribute('href'),url).searchParams.get('path');
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
    const a = doc.querySelector('a[href*="grupo.do"][href*="path="]');
    const pub = doc.querySelector('a[href*="idPublicacion="]');
    const metadata = Array.from(doc.querySelectorAll('.ficha tr,#panel_ficha_dc tr'), row => {
      const cells = Array.from(row.querySelectorAll('th,td'), el => el.textContent.trim());
      return {label:cells[0],value:cells.slice(1).join(' ')};
    }).filter(field => field.label && field.value);
    return {sourceUrl:url,description:'',metadata,
      path:a ? new URL(a.getAttribute('href'),url).searchParams.get('path') : undefined,
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
          const terms = new Set(words(query));
          return json({count:words(text).filter(word=>terms.has(word)).length,matches:matches(text,query)});
        }
        case '/api/hemeroteca': return json(await hemeroteca(p, signal));
        case '/api/collections/sections': return json(sections);
        case '/api/collections': return json(await collections(p, signal));
        case '/api/record': return json(await record(p.get('url'), signal));
        case '/api/data': return json(await catalogueData(p, signal));
        case '/api/work': return json(await work(path, signal));
        case '/api/page': return json(await page(path, position, id, p.get('query') || '', signal));
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
