/**
 * Pages of a document that the last search results named for a query. The viewer lists
 * them at once instead of downloading every page to find them again (Android 0.4.5).
 * Only exact results count: variants and the approximate search are not matches.
 */
let last: {path: string; query: string; pages: number[]; images: Map<number, string>} | undefined;
const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');

/** Each result keeps the image it named: Galiciana's page number can differ from the index. */
export function rememberPages(path: string, query: string, results: Iterable<{position: number; imageId?: string | null}>) {
  const list = [...results], images = new Map<number, string>();
  for (const r of list) if (r.imageId && !images.has(r.position)) images.set(r.position, r.imageId);
  const pages = [...new Set(list.map(r => r.position))].sort((a, b) => a - b);
  last = {path, query: norm(query), pages, images};
}

const matches = (path: string, query: string) => !!last && last.path === path && !!norm(query) && last.query === norm(query);

/**
 * Pages the results named, with each number corrected to where its image sits in the index
 * (the result said 516, its image is page 518): a chip opens the very page of the result.
 */
export function hintedPages(path: string, query: string, index: {position: number; imageId?: string | null}[] = []): number[] {
  if (!matches(path, query)) return [];
  const where = new Map(index.filter(p => p.imageId).map(p => [p.imageId!, p.position]));
  return [...new Set(last!.pages.map(p => where.get(last!.images.get(p) ?? '') ?? p))].sort((a, b) => a - b);
}

/** Pages to read when the reader asks to review the whole document: nearest first. */
export function scanOrder(current: number, count: number, cap = 120): number[] {
  const order: number[] = [];
  for (let d = 1; order.length < cap && (current - d >= 1 || current + d <= count); d++) {
    if (current + d <= count) order.push(current + d);
    if (current - d >= 1 && order.length < cap) order.push(current - d);
  }
  return order;
}

/** The next page with matches after (or before) the current one, wrapping round. */
export function adjacentMatchPage(pages: number[], current: number, forward: boolean): number | undefined {
  const others = pages.filter(p => p !== current).sort((a, b) => a - b);
  if (!others.length) return undefined;
  return forward ? others.find(p => p > current) ?? others[0] : [...others].reverse().find(p => p < current) ?? others[others.length - 1];
}
