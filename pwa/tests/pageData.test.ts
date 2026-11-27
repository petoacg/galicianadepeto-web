import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadText} from '../src/pageData';

test('OCR retries one temporary gateway failure and returns the later response', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify({error:'Galiciana non responde agora.'}), {status:502});
    return new Response(JSON.stringify({ocrText:'Texto recuperado'}), {headers:{'Content-Type':'application/json'}});
  };
  try {
    assert.equal(await loadText('123', 4, '456', new AbortController().signal), 'Texto recuperado');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test('OCR does not retry when its viewer request is aborted', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    controller.abort(new DOMException('Aborted', 'AbortError'));
    throw controller.signal.reason;
  };
  try {
    await assert.rejects(loadText('123', 4, '456', controller.signal), {name:'AbortError'});
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
