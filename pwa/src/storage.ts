import {forgetSearches} from './searches';
import {tr} from './i18n';
import type { Hit, SearchPreset } from './types'
import { canonical, fingerprint, jsonPref, prefJson, validatePreferences, type Preferences } from './backup'
export type SavedSearch = SearchPreset & {id:string;createdAt:number}
export interface ArchiveSnapshot {hits:Hit[];annotated:Hit[];notes:Record<string,string>;folders:string[];folderMap:Record<string,string[]>;searches:SavedSearch[];recent:SavedSearch[];draft:SearchPreset|null;reading:Hit|null}
export const hitKey=(h:Pick<Hit,'path'|'position'>)=>`${h.path}|${h.position}`
const listeners=new Set<()=>void>()
let channel:BroadcastChannel|undefined
function notify(){listeners.forEach(fn=>fn());channel?.postMessage('changed')}
let dbPromise:Promise<IDBDatabase>|undefined
function database():Promise<IDBDatabase>{
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(Error(tr('Este navegador non ofrece almacenamento local.','Este navegador no ofrece almacenamiento local.')));return}const request=indexedDB.open('galiciana-de-peto',1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();dbPromise=undefined};resolve(db)};request.onerror=()=>{dbPromise=undefined;reject(request.error??Error(tr('Non se puido abrir o arquivo local.','No se pudo abrir el archivo local.')))};request.onblocked=()=>reject(Error(tr('Pecha outras pestanas da aplicación para actualizar o arquivo local.','Cierra otras pestañas de la aplicación para actualizar el archivo local.')))})
 return dbPromise
}
async function readPreferences():Promise<Preferences>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('state','readonly'),request=tx.objectStore('state').get('preferences');let value:Preferences=Object.create(null);request.onsuccess=()=>{value=request.result??Object.create(null)};tx.oncomplete=()=>resolve(structuredClone(value));tx.onerror=tx.onabort=()=>reject(tx.error??Error(tr('Non se puido ler o arquivo local.','No se pudo leer el archivo local.')))})}
async function update(fn:(prefs:Preferences)=>void):Promise<void>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),table=tx.objectStore('state'),request=table.get('preferences');let failure:unknown;request.onsuccess=()=>{try{const prefs:Preferences=request.result??Object.create(null);fn(prefs);table.put(validatePreferences(prefs),'preferences')}catch(e){failure=e;tx.abort()}};tx.oncomplete=()=>{notify();resolve()};tx.onerror=tx.onabort=()=>reject(failure??tx.error??Error(tr('Non se puido gardar. Consérvase o contido anterior.','No se pudo guardar. El contenido anterior se conserva.')))})}
function records(p:Preferences,key='fav_json'):Record<string,any>[]{const value=prefJson(p,key,[]);if(!Array.isArray(value)||value.some(v=>!v||typeof v!=='object'||Array.isArray(v)))throw Error(tr('O arquivo contén rexistros ilexibles. Consérvanse os datos e bloquéanse os cambios para evitar perdas.','El archivo contiene registros ilegibles. Se conservan los datos y se bloquean los cambios para evitar pérdidas.'));return value}
function mapping(p:Preferences,key:string):Record<string,any>{const v=prefJson(p,key,{});if(!v||typeof v!=='object'||Array.isArray(v))throw Error(tr('O arquivo contén datos ilexibles. Consérvanse sen cambios.','El archivo contiene datos ilegibles. Se conservan sin cambios.'));return v}
function noteMap(p:Preferences):Record<string,string>{const n=mapping(p,'notes_json');if(Object.values(n).some(v=>typeof v!=='string'))throw Error(tr('Non se poden ler as Notas de referencia. Os datos consérvanse.','No se pueden leer las Notas de referencia. Los datos se conservan.'));return n}
function names(raw:any):string[]{if(Array.isArray(raw)&&raw.every(v=>typeof v==='string'))return raw;if(typeof raw==='string')return raw.startsWith('[')?names(JSON.parse(raw)):raw?[raw]:[];return []}
const text=(p:Preferences,k:string)=>p[k]?.type==='STRING'?p[k].values[0]:undefined
const asHit=(r:Record<string,any>,p:Preferences,n:Record<string,string>):Hit=>({title:String(r.title||text(p,`work_${r.path}`)||`Documento ${r.path}`),path:String(r.path??''),position:Math.max(1,Number(r.pos)||1),imageId:r.imageId||undefined,parentTitle:r.parent||text(p,`workp_${r.path}`)||undefined,snippets:Array.isArray(r.snips)?r.snips.map(String):String(r.snips??'').split('\n\n').filter(Boolean),savedQuery:r.q||'',note:Object.hasOwn(n,`${r.path}|${r.pos??1}`)?n[`${r.path}|${r.pos??1}`]:r.note||''})
const toRecord=(h:Hit)=>({title:h.title,path:h.path,pos:h.position,imageId:h.imageId??'',parent:h.parentTitle??'',snips:h.snippets.join('\n\n'),q:h.savedQuery??'',note:h.note??''})
function writeFavs(p:Preferences,rows:Record<string,any>[]){p.fav_json_previous=p.fav_json??jsonPref([]);p.fav_json=jsonPref(rows)}
function rememberWork(p:Preferences,h:Hit){if(h.title&& !/^Documento(?:\s|$)/i.test(h.title)){p[`work_${h.path}`]={type:'STRING',values:[h.title]};p[`workp_${h.path}`]={type:'STRING',values:[h.parentTitle??'']}}}
function addSaved(p:Preferences,h:Hit){const rows=records(p),key=hitKey(h);if(rows.some(r=>`${r.path}|${r.pos??1}`===key))return;const stash=mapping(p,'fav_stash')[key]??{},n=noteMap(p);const raw={...stash,...toRecord(h)};if(!h.snippets.length&&stash.snips)raw.snips=stash.snips;if(!h.savedQuery&&stash.q)raw.q=stash.q;if(!h.imageId&&stash.imageId)raw.imageId=stash.imageId;if(Object.hasOwn(n,key))raw.note=n[key];rows.unshift(raw);writeFavs(p,rows);rememberWork(p,h)}
const criteria=(s:SearchPreset)=>[s.query,s.title??'',s.author??'',s.place??'',s.yearFrom??'',s.yearTo??'',s.section??'',s.advanced??false,s.fullText??true].join('\0')
function searchRecord(s:SearchPreset):SavedSearch{return{query:s.query,title:s.title??'',author:s.author??'',place:s.place??'',yearFrom:s.yearFrom??'',yearTo:s.yearTo??'',section:s.section??'',advanced:s.advanced??false,fullText:s.fullText??true,id:s.id??crypto.randomUUID(),createdAt:s.createdAt??Date.now()}}
export const store={
 subscribe(fn:()=>void){listeners.add(fn);if(typeof BroadcastChannel!=='undefined'&&!channel){channel=new BroadcastChannel('galiciana-de-peto');channel.onmessage=()=>listeners.forEach(f=>f())}return()=>{listeners.delete(fn)}},
 preferences:readPreferences,
 async saveFavoritesAnchor(anchor:{key:string;offset:number;context:string}){await update(p=>{p.favorites_browse=jsonPref({...mapping(p,'favorites_browse'),webAnchor:anchor})})},
 async favoritesBrowse():Promise<Record<string,unknown>>{return structuredClone(mapping(await readPreferences(),'favorites_browse'))},
 async saveFavoritesBrowse(state:{folder:string;query:string;notesOnly:boolean;sort:string;ascending:boolean}){await update(p=>{p.favorites_browse=jsonPref({...mapping(p,'favorites_browse'),...state})})},
 async snapshot():Promise<ArchiveSnapshot>{const p=await readPreferences(),n=noteMap(p),raw=records(p),hits=raw.map(r=>asHit(r,p,n)).filter(h=>/^\d+$/.test(h.path)),stash=mapping(p,'fav_stash');const annotated=new Map(hits.filter(h=>h.note?.trim()).map(h=>[hitKey(h),h]));for(const[key,note]of Object.entries(n)){if(!note.trim())continue;const match=/^(\d+)\|(\d+)$/.exec(key);if(!match)continue;const h=hits.find(h=>hitKey(h)===key)??asHit({...stash[key],path:match[1],pos:Number(match[2])},p,n);annotated.set(key,{...h,note})}const folders=names(prefJson(p,'fav_folders',[]));const folderMap=Object.fromEntries(Object.entries(mapping(p,'fav_folder_map')).map(([k,v])=>[k,names(v)]));let draft:SearchPreset|null=null,reading:Hit|null=null;if(p.search_draft_json)draft=prefJson(p,'search_draft_json',null);if(p.last_reading){const r=prefJson(p,'last_reading',null);if(r?.path)reading=asHit(r,p,n)}return{hits,annotated:[...annotated.values()],notes:n,folders,folderMap,searches:records(p,'search_saved_json')as SavedSearch[],recent:records(p,'search_history_json')as SavedSearch[],draft,reading}},
 async isSaved(h:Hit){return(await this.snapshot()).hits.some(x=>hitKey(x)===hitKey(h))},
 async toggleSaved(h:Hit){let selected=false;await update(p=>{const rows=records(p),key=hitKey(h),found=rows.find(r=>`${r.path}|${r.pos??1}`===key);if(found){const stash=mapping(p,'fav_stash');stash[key]=found;p.fav_stash=jsonPref(stash);writeFavs(p,rows.filter(r=>`${r.path}|${r.pos??1}`!==key))}else{addSaved(p,h);selected=true}});return selected},
 async removeSaved(keys:string[]){await update(p=>{const rows=records(p),stash=mapping(p,'fav_stash');for(const r of rows)if(keys.includes(`${r.path}|${r.pos??1}`))stash[`${r.path}|${r.pos??1}`]=r;p.fav_stash=jsonPref(stash);writeFavs(p,rows.filter(r=>!keys.includes(`${r.path}|${r.pos??1}`)))})},
 async saveNote(h:Hit,value:string){if(value.length>4000)throw Error(tr('A Nota de referencia admite ata 4000 caracteres.','La Nota de referencia admite hasta 4000 caracteres.'));await update(p=>{const note=value.trim()?value:'',key=hitKey(h);if(note)addSaved(p,h);const n=noteMap(p);n[key]=note;p.notes_json=jsonPref(n);const stash=mapping(p,'fav_stash');if(stash[key])stash[key]={...stash[key],note};p.fav_stash=jsonPref(stash);const rows=records(p);writeFavs(p,rows.map(r=>`${r.path}|${r.pos??1}`===key?{...r,note}:r));rememberWork(p,h)})},
 async savePageWithReference(h:Hit,note:string,folder:string){
  if(note.length>4000)throw Error(tr('A Nota de referencia admite ata 4000 caracteres.','La Nota de referencia admite hasta 4000 caracteres.'))
  await update(p=>{
   addSaved(p,h)
   const key=hitKey(h),notes=noteMap(p)
   notes[key]=note
   p.notes_json=jsonPref(notes)
   const name=folder.trim()
   if(name){
    const folders=names(prefJson(p,'fav_folders',[]))
    const existing=folders.find(value=>value.toLowerCase()===name.toLowerCase())
    if(!existing)p.fav_folders=jsonPref([...folders,name])
    const assignments=mapping(p,'fav_folder_map')
    assignments[key]=[...new Set([...names(assignments[key]),existing??name])]
    p.fav_folder_map=jsonPref(assignments)
   }
  })
 },
 async foldersFor(h:Hit){return(await this.snapshot()).folderMap[hitKey(h)]??[]},
 async setFolders(h:Hit,values:string[]){await update(p=>{const m=mapping(p,'fav_folder_map'),clean=[...new Set(values.map(v=>v.trim()).filter(Boolean))];if(clean.length)m[hitKey(h)]=clean;else delete m[hitKey(h)];p.fav_folder_map=jsonPref(m)})},
 async addToFolder(keys:string[],name:string){await update(p=>{const m=mapping(p,'fav_folder_map');for(const key of keys)m[key]=[...new Set([...names(m[key]),name])];p.fav_folder_map=jsonPref(m)})},
 async createFolder(name:string){const clean=name.trim();if(!clean)throw Error(tr('Escribe o nome do cartafol.','Escribe el nombre de la carpeta.'));await update(p=>{const f=names(prefJson(p,'fav_folders',[]));if(!f.some(n=>n.toLowerCase()===clean.toLowerCase()))f.push(clean);p.fav_folders=jsonPref(f)})},
 /** Renames a folder everywhere it is used (Android LocalStore.renameFolder). */
 async renameFolder(from:string,to:string){const old=from.trim(),next=to.trim();
  if(!next)throw Error(tr('Escribe o nome do cartafol.','Escribe el nombre de la carpeta.'));
  if(old.toLowerCase()==='archivador general'||next.toLowerCase()==='archivador general')throw Error(tr('O arquivador xeral non se renomea.','El archivador general no se renombra.'));
  await update(p=>{const list=names(prefJson(p,'fav_folders',[]));
   if(old.toLowerCase()!==next.toLowerCase()&&list.some(n=>n.toLowerCase()===next.toLowerCase()))throw Error(tr('Xa existe un cartafol con ese nome.','Ya existe una carpeta con ese nombre.'));
   p.fav_folders=jsonPref(list.map(n=>n.toLowerCase()===old.toLowerCase()?next:n));
   const m=mapping(p,'fav_folder_map');for(const[k,v]of Object.entries(m))m[k]=names(v).map(n=>n.toLowerCase()===old.toLowerCase()?next:n);p.fav_folder_map=jsonPref(m)})},
 async deleteFolder(name:string){if(name.toLowerCase()==='archivador general')throw Error(tr('O arquivador xeral non se elimina.','El archivador general no se elimina.'));await update(p=>{p.fav_folders=jsonPref(names(prefJson(p,'fav_folders',[])).filter(n=>n.toLowerCase()!==name.toLowerCase()));const m=mapping(p,'fav_folder_map');for(const[k,v]of Object.entries(m)){const keep=names(v).filter(n=>n.toLowerCase()!==name.toLowerCase());if(keep.length)m[k]=keep;else delete m[k]}p.fav_folder_map=jsonPref(m)})},
 async saveSearch(s:SearchPreset){await update(p=>{p.search_saved_json=jsonPref([searchRecord(s),...records(p,'search_saved_json').filter(r=>criteria(r as SearchPreset)!==criteria(s))])})},
 async removeSearch(id:string,recent=false){if(recent)await forgetSearches();await update(p=>{const key=recent?'search_history_json':'search_saved_json';p[key]=jsonPref(records(p,key).filter(r=>r.id!==id))})},
 async clearRecent(){await forgetSearches();await update(p=>{p.search_history_json=jsonPref([])})},
 async rememberSearch(s:SearchPreset){await update(p=>{p.search_history_json=jsonPref([searchRecord(s),...records(p,'search_history_json').filter(r=>criteria(r as SearchPreset)!==criteria(s))].slice(0,40));p.search_draft_json=jsonPref(searchRecord(s))})},
 async saveDraft(s:SearchPreset){await update(p=>{p.search_draft_json=jsonPref(searchRecord(s))})},
 async rememberReading(h:Hit){await update(p=>{p.last_reading=jsonPref(toRecord(h));rememberWork(p,h)})},
 async replacePreferences(next:Preferences,expectedFingerprint?:string){const validated=validatePreferences(next);const before=await readPreferences();if(expectedFingerprint&&await fingerprint(before)!==expectedFingerprint)throw Error(tr('Os teus datos cambiaron desde a vista previa. Volve abrir a copia antes de importala.','Tus datos cambiaron desde la vista previa. Reabre la copia antes de importarla.'));const expected=canonical(before);await update(p=>{if(canonical(p)!==expected)throw Error(tr('Os teus datos cambiaron. Volve abrir a vista previa da copia.','Tus datos cambiaron. Reabre la vista previa de la copia.'));for(const key of Object.keys(p))delete p[key];Object.assign(p,validated)})},
}
