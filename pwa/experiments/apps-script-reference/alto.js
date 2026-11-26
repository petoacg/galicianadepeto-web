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
