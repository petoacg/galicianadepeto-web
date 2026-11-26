import {api} from './api';

/**
 * Where the searched words are on a page (its ALTO, through the script). Kept for the last
 * few pages of this visit, in memory only: turning back shows the marks at once, and the
 * next page in the reading direction is asked for ahead. A failure is never kept.
 */
export interface Box {left:number;top:number;width:number;height:number}
export interface Page {ocrText:string;alto:{pageSize:[number,number];matches:{boxes:Box[]}[];status:string};matchCount:number;ocrFailed?:boolean}
export const NO_MARKS: Page = {ocrText: '', alto: {pageSize: [0, 0], matches: [], status: 'EMPTY'}, matchCount: 0};

const KEEP = 8;
const pages = new Map<string, Page>();
const reading = new Map<string, Promise<Page>>();
const request = (path: string, position: number, imageId: string | undefined, query: string, part: 'alto' | 'ocr') => {
  const params = new URLSearchParams({path, position: String(position), query, part});
  if (imageId) params.set('imageId', imageId);
  return 'page?' + params;
};

/** With a signal the request belongs to the page on screen and stops with it; without one it is read ahead. */
export function loadMarks(path: string, position: number, imageId: string | undefined, query: string, signal?: AbortSignal): Promise<Page> {
  const key = request(path, position, imageId, query, 'alto');
  const ready = pages.get(key);
  if (ready) { pages.delete(key); pages.set(key, ready); return Promise.resolve(ready); }
  const pending = reading.get(key);
  if (pending) return pending;
  const loading = api<Page>(key, undefined, signal).then(page => {
    if (['AVAILABLE', 'EMPTY'].includes(page.alto.status) && !page.ocrFailed) {
      pages.set(key, page);
      while (pages.size > KEEP) pages.delete(pages.keys().next().value as string);
    }
    return page;
  });
  if (signal) return loading;
  const ahead = loading.finally(() => reading.delete(key));
  reading.set(key, ahead);
  return ahead;
}

/** The recognised text, asked for only when someone opens it. */
export const loadText = (path: string, position: number, imageId: string | undefined, signal: AbortSignal) =>
  api<Page>(request(path, position, imageId, '', 'ocr'), undefined, signal).then(page => page.ocrText);
/** How often the words appear in a page's text: what reviewing the whole document asks for, as Android does. */
export const countInText = (path: string, position: number, imageId: string | undefined, query: string, signal: AbortSignal) =>
  api<Page>(request(path, position, imageId, query, 'ocr'), undefined, signal).then(page => page.matchCount);
