import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstResults, forgetSearches, keptSearch} from '../src/searches';
import type {SearchPreset} from '../src/types';

const result = {
  hits:[{title:'Prueba',path:'123',position:1,snippets:[]}],
  groups:[],nextUrls:[],sortUrls:{},incomplete:false,globalSortAvailable:false,
};

test('equivalent queries share an in-flight search and its local copy, but filters remain separate', async () => {
  await forgetSearches();
  const original = globalThis.fetch;
  let release!: () => void, calls = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  globalThis.fetch = async () => {
    calls++;
    await gate;
    return new Response(JSON.stringify(result), {headers:{'Content-Type':'application/json'}});
  };
  const first:SearchPreset = {query:' «mestre   canteiro» ',fullText:true,id:'first',createdAt:1};
  const same:SearchPreset = {query:'"mestre canteiro"',fullText:true,id:'second',createdAt:2};
  const filtered:SearchPreset = {...same,advanced:true,title:'Outro título'};
  try {
    const pending = firstResults(first, new AbortController().signal);
    const shared = firstResults(same, new AbortController().signal);
    const separate = firstResults(filtered, new AbortController().signal);
    assert.equal(calls, 2);
    release();
    assert.deepEqual(await Promise.all([pending, shared, separate]), [result, result, result]);
    let copy;
    for (let i=0; i<100 && !copy; i++) {
      copy = await keptSearch(same);
      if (!copy) await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.deepEqual(copy, result);
    assert.equal(await keptSearch({...same,query:'Mestre canteiro'}), undefined);
  } finally {
    globalThis.fetch = original;
    await forgetSearches();
  }
});

test('reads existing copies written with the original cache key', async () => {
  await forgetSearches();
  const preset:SearchPreset = {query:'antiga',fullText:true,id:'guardada'};
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('gdp-buscas', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('buscas', 'readwrite');
      tx.objectStore('buscas').put({key:JSON.stringify(preset),at:Date.now(),result});
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
  assert.deepEqual(await keptSearch(preset), result);
  await forgetSearches();
});
