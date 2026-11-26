/**
 * The first page of a search. Galiciana takes 4–37 s the first time anyone asks for something and
 * about 1 s afterwards, so an answer on its way is never asked for twice, is kept when the reader
 * leaves before it arrives, and the last few stay on this device for six hours (as long as their
 * session in the script) to open at once.
 * Only result lists are kept (no images, documents or page text), outside the research archive,
 * and they go when the recent searches are cleared.
 */
import {api, type SearchResult} from './api';
import type {SearchPreset} from './types';

const KEEP = 20, MAX_AGE = 6 * 3600_000;
interface Kept {key: string; at: number; result: SearchResult}
const onTheWay = new Map<string, Promise<SearchResult>>();
let generation = 0;

function withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open('gdp-buscas', 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('buscas', {keyPath: 'key'});
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result, transaction = db.transaction('buscas', mode), request = work(transaction.objectStore('buscas'));
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  });
}

/** The copy on this device, if there is a recent one. It is a help: any failure means no copy. */
export async function keptSearch(key: string): Promise<SearchResult | undefined> {
  try {
    const kept = await withStore<Kept>('readonly', store => store.get(key));
    return kept && Date.now() - kept.at < MAX_AGE ? kept.result : undefined;
  } catch { return undefined; }
}

async function keep(key: string, result: SearchResult) {
  try {
    await withStore('readwrite', store => store.put({key, at: Date.now(), result} satisfies Kept));
    const all = await withStore<Kept[]>('readonly', store => store.getAll());
    const extra = all.sort((a, b) => b.at - a.at).filter((item, index) => index >= KEEP || Date.now() - item.at >= MAX_AGE);
    for (const item of extra) await withStore('readwrite', store => store.delete(item.key));
  } catch { /* without a copy the search still works */ }
}

export async function forgetSearches() {
  generation++;
  try { await withStore('readwrite', store => store.clear()); } catch { /* nothing kept */ }
}

/** Rejects as soon as `signal` is cancelled; the search itself goes on and its answer is kept. */
export function firstResults(preset: SearchPreset, signal: AbortSignal): Promise<SearchResult> {
  const key = JSON.stringify(preset), born = generation;
  let request = onTheWay.get(key);
  if (!request) {
    request = api<SearchResult>('search', {preset, sort: 'Relevancia', asc: false}).then(result => {
      if (result.hits.length && born === generation) void keep(key, result);
      return result;
    }).finally(() => onTheWay.delete(key));
    onTheWay.set(key, request);
  }
  const shared = request;
  return new Promise((resolve, reject) => {
    const stop = () => reject(new DOMException('Cancelada', 'AbortError'));
    if (signal.aborted) stop(); else signal.addEventListener('abort', stop, {once: true});
    shared.then(resolve, reject);
  });
}
