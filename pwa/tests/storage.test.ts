import 'fake-indexeddb/auto'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {readBackup,exportBackup,canonical,mergePreferences,jsonPref,prefJson,fingerprint,strictJson,counts} from '../src/backup.ts'
import {store} from '../src/storage.ts'
const hit={title:'Diario sintético',path:'123',position:2,snippets:['Texto ficticio'],savedQuery:'Galicia'}
test('Android v1 independent fixture preserves typed unknowns, bytes and tombstones',async()=>{
 const input=await readBackup(new Uint8Array(await readFile(new URL('./fixtures/android-v1-synthetic.zip',import.meta.url))))
 assert.equal(input.preferences.future_long.values[0],'9223372036854775807')
 assert.equal(input.preferences.future_text.values[0],'Galicia\n\b"á')
 assert.equal(counts(input.preferences).notes,0)
 const again=await readBackup(await exportBackup(input.preferences,input.createdAt))
 assert.equal(canonical(again),canonical(input))
 assert.throws(()=>strictJson('{"a":1,"a":2}'),/duplicado/)
})
test('merge retains deletion, preserves differing incoming note as a conflict and resolves explicitly',async()=>{
 const a={notes_json:jsonPref({'123|2':''})},b={notes_json:jsonPref({'123|2':'Nota antigua'})}
 const merged=await mergePreferences(a,b,1)
 assert.equal(prefJson(merged.preferences,'notes_json',{})['123|2'],'')
 assert.equal(merged.conflicts.length,1)
 const resolved=await mergePreferences(a,b,1,{[merged.conflicts[0].id]:'TAKE_INCOMING'})
 assert.equal(prefJson(resolved.preferences,'notes_json',{})['123|2'],'Nota antigua')
 assert.equal(resolved.conflicts.length,0)
})
test('transactional store keeps orphan notes, canonical deletion and rejects stale restore',async()=>{
 await store.saveNote(hit,'Nota sintética')
 assert.equal((await store.snapshot()).hits.length,1)
 await store.removeSaved(['123|2'])
 assert.equal((await store.snapshot()).annotated[0].note,'Nota sintética')
 await store.saveNote(hit,'')
 assert.equal((await store.snapshot()).annotated.length,0)
 const before=await store.preferences(),stamp=await fingerprint(before)
 await store.createFolder('Prueba')
 await assert.rejects(()=>store.replacePreferences(before,stamp),/cambiaron/)
 assert.deepEqual((await store.snapshot()).folders,['Prueba'])
 await store.toggleSaved(hit)
 assert.equal((await store.snapshot()).hits[0].note,'')
 await assert.rejects(()=>store.saveNote(hit,'x'.repeat(4001)),/4000/)
 assert.equal((await store.snapshot()).hits[0].note,'')
})
test('Android favorites_browse restores exact keys and preserves scroll/future fields on update',async()=>{
 const prefs=await store.preferences();prefs.favorites_browse=jsonPref({folder:'Prensa',query:'Galicia',notesOnly:true,sort:'Fecha',ascending:false,index:8,offset:42,folderIndex:2,folderOffset:10,future:{keep:true}})
 await store.replacePreferences(prefs)
 const before=await store.favoritesBrowse();assert.equal(before.sort,'Fecha');assert.equal(before.notesOnly,true)
 await store.saveFavoritesBrowse({folder:'Historia',query:'Vigo',notesOnly:false,sort:'Autor',ascending:true})
 const after=await store.favoritesBrowse();assert.equal(after.query,'Vigo');assert.equal(after.folder,'Historia');assert.equal(after.index,8);assert.equal(after.folderOffset,10);assert.deepEqual(after.future,{keep:true})
 const roundtrip=await readBackup(await exportBackup(await store.preferences(),1));assert.equal(prefJson(roundtrip.preferences,'favorites_browse',{}).sort,'Autor')
})
test('web anchor is additive and leaves native browse positions and unknown data intact',async()=>{
 const before=await store.favoritesBrowse()
 await store.saveFavoritesAnchor({key:'123|2',offset:-18.5,context:'synthetic-context'})
 const after=await store.favoritesBrowse()
 assert.equal(after.index,before.index);assert.equal(after.folderOffset,before.folderOffset);assert.deepEqual(after.future,before.future)
 assert.deepEqual(after.webAnchor,{key:'123|2',offset:-18.5,context:'synthetic-context'})
 await store.saveFavoritesBrowse({folder:'Prensa',query:'Vigo',notesOnly:false,sort:'Titulo',ascending:true})
 assert.deepEqual((await store.favoritesBrowse()).webAnchor,after.webAnchor)
})
