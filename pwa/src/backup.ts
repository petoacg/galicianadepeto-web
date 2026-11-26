import {tr} from './i18n';
import { strFromU8, unzipSync, zipSync } from 'fflate'

export type PreferenceType = 'STRING'|'BOOLEAN'|'INT'|'LONG'|'FLOAT'|'STRING_SET'
export interface Preference { type:PreferenceType; values:string[] }
export type Preferences = Record<string,Preference>
export interface BackupPayload { preferences:Preferences; createdAt:number|bigint }
export interface Conflict { id:string; key:string; kind:string; localValue:string; incomingValue:string; createdAt:number|bigint }
export type Resolution = 'KEEP_BOTH'|'KEEP_LOCAL'|'TAKE_INCOMING'
export interface Counts { preferences:number; favorites:number; notes:number; folders:number; searches:number }
export interface BackupPreview { payload:BackupPayload; fingerprint:string; counts:Counts; currentCounts:Counts; conflicts:Conflict[] }
export const MAX_BYTES = 8*1024*1024
const encoder = new TextEncoder()
const object = (v:unknown):v is Record<string,any> => !!v && typeof v==='object' && !Array.isArray(v)
export function canonical(v:any):string {
  if(v===null) return 'null'
  if(typeof v==='string') return '"'+v.replace(/["\\\u0000-\u001f]/g,c=>c==='"'?'\\"':c==='\\'?'\\\\':c==='\n'?'\\n':c==='\r'?'\\r':c==='\t'?'\\t':'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))+'"'
  if(typeof v==='boolean'||typeof v==='bigint') return String(v)
  if(typeof v==='number' && Number.isFinite(v)) return String(v)
  if(Array.isArray(v)) return '['+v.map(canonical).join(',')+']'
  if(object(v)) return '{'+Object.keys(v).sort().map(k=>canonical(k)+':'+canonical(v[k])).join(',')+'}'
  throw new Error(tr('Valor de copia non compatible.','Valor de copia no compatible.'))
}
// The Android encoder substitutes isolated UTF-16 surrogates with '?'.
const utf8 = (s:string)=>encoder.encode(s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,'?'))
export async function sha256(bytes:Uint8Array):Promise<string> {
  const buffer = new Uint8Array(bytes).buffer
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(x=>x.toString(16).padStart(2,'0')).join('')
}
/** Strict JSON parsing: duplicate names, trailing input, unsafe integer truncation and deep nesting are rejected/preserved. */
export function strictJson(source:string):any {
  if(source.length>MAX_BYTES) throw new Error(tr('A copia supera o tamaño permitido.','La copia supera el tamaño permitido.'))
  let at=0
  const ws=()=>{while(/[ \t\r\n]/.test(source[at]??'!'))at++}
  const string=()=>{const start=at++;let escaped=false;while(at<source.length){const c=source[at++];if(c==='"'&&!escaped)return JSON.parse(source.slice(start,at));if(c.charCodeAt(0)<32)throw Error(tr('Cadea non válida.','Cadena inválida.'));if(c==='\\'&&!escaped)escaped=true;else escaped=false}throw Error('Cadena incompleta.')}
  const value=(depth:number):any=>{if(depth>32)throw Error(tr('Copia demasiado aniñada.','Copia demasiado anidada.'));ws();const c=source[at];if(c==='"')return string();if(c==='{'){at++;ws();const out=Object.create(null);if(source[at]==='}'){at++;return out}while(true){ws();if(source[at]!=='"')throw Error(tr('Campo non válido.','Campo inválido.'));const k=string();if(Object.hasOwn(out,k))throw Error(tr('Campo duplicado na copia.','Campo duplicado en la copia.'));ws();if(source[at++]!==':')throw Error(tr('Obxecto non válido.','Objeto inválido.'));out[k]=value(depth+1);ws();const end=source[at++];if(end==='}')return out;if(end!==',')throw Error('Objeto incompleto.')}}if(c==='['){at++;ws();const out:any[]=[];if(source[at]===']'){at++;return out}while(true){out.push(value(depth+1));ws();const end=source[at++];if(end===']')return out;if(end!==',')throw Error(tr('Lista non válida.','Lista inválida.'))}}for(const [literal,v] of [['true',true],['false',false],['null',null]]as const){if(source.startsWith(literal,at)){at+=literal.length;return v}}const n=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(at))?.[0];if(!n)throw Error('Valor inválido en la copia.');at+=n.length;if(!/[.eE]/.test(n)){const big=BigInt(n);return big<=BigInt(Number.MAX_SAFE_INTEGER)&&big>=BigInt(Number.MIN_SAFE_INTEGER)?Number(big):big}const num=Number(n);if(!Number.isFinite(num))throw Error(tr('Número non válido.','Número inválido.'));return num}
  const result=value(0);ws();if(at!==source.length)throw Error(tr('Contido adicional na copia.','Contenido adicional en la copia.'));return result
}
export function validatePreferences(raw:any):Preferences {
  if(!object(raw)||Object.keys(raw).length>20000)throw Error(tr('Preferencias non válidas.','Preferencias inválidas.'))
  const out:Preferences=Object.create(null)
  for(const [key,item] of Object.entries(raw)){
    if(key.length>4096||!object(item)||Object.keys(item).sort().join(',')!=='type,values'||!Array.isArray(item.values)||item.values.some((x:any)=>typeof x!=='string'))throw Error(tr('Preferencia non válida.','Preferencia inválida.'))
    const {type,values}=item as Preference
    if(!['STRING','BOOLEAN','INT','LONG','FLOAT','STRING_SET'].includes(type)|| (type!=='STRING_SET'&&values.length!==1))throw Error(tr('Tipo de preferencia non válido.','Tipo de preferencia inválido.'))
    const v=values[0]
    if(type==='BOOLEAN'&&v!=='true'&&v!=='false')throw Error(tr('Valor lóxico non válido.','Valor lógico inválido.'))
    if(type==='INT'||type==='LONG'){if(!/^[+-]?\d+$/.test(v))throw Error(tr('Enteiro non válido.','Entero inválido.'));const n=BigInt(v);const lim=type==='INT'?31n:63n;if(n<-(1n<<lim)||n>(1n<<lim)-1n)throw Error(tr('Enteiro fóra de rango.','Entero fuera de rango.'))}
    if(type==='FLOAT'&&!['NaN','Infinity','-Infinity'].includes(v)&&!Number.isFinite(Number(v)))throw Error(tr('Decimal non válido.','Decimal inválido.'))
    if(type==='STRING_SET'&&new Set(values).size!==values.length)throw Error(tr('Conxunto con duplicados.','Conjunto con duplicados.'))
    out[key]={type,values:[...values]}
  }return out
}
export const prefJson = (prefs:Preferences,key:string,fallback:any):any => {
  const p=prefs[key];if(!p)return structuredClone(fallback);if(p.type!=='STRING'||p.values.length!==1)throw Error(tr(`Non se pode ler ${key}. Consérvanse os datos orixinais.`,`No se puede ler ${key}. Los datos originales se conservan.`.replace('ler ','leer ')))
  return strictJson(p.values[0])
}
export const jsonPref=(v:any):Preference=>({type:'STRING',values:[canonical(v)]})
export const fingerprint=(prefs:Preferences)=>sha256(utf8(canonical(prefs)))
export async function exportBackup(preferences:Preferences,createdAt:number|bigint=Date.now()):Promise<Uint8Array> {
  const prefs=validatePreferences(preferences)
  const unsigned={format:'galiciana-peto-preferences',version:1,createdAt,preferences:prefs}
  const bytes=utf8(canonical({...unsigned,sha256:await sha256(utf8(canonical(unsigned)))}))
  if(bytes.length>MAX_BYTES)throw Error(tr('A copia supera o límite de 8 MiB.','La copia supera el límite de 8 MiB.'))
  return zipSync({'manifest.json':bytes},{level:6})
}
export async function readBackup(bytes:Uint8Array):Promise<BackupPayload> {
  if(bytes.length>20*1024*1024)throw Error(tr('O ficheiro supera o límite de 20 MiB.','El archivo supera el límite de 20 MiB.'))
  let count=0
  const files=unzipSync(bytes,{filter:file=>{count++;if(count!==1||file.name!=='manifest.json'||file.originalSize>MAX_BYTES)throw Error(tr('A copia contén ficheiros adicionais ou non permitidos.','La copia contiene archivos adicionales o no permitidos.'));return true}})
  if(count!==1||!files['manifest.json']||files['manifest.json'].length>MAX_BYTES)throw Error(tr('O ficheiro non contén unha copia válida.','El archivo no contiene una copia válida.'))
  const root=strictJson(strFromU8(files['manifest.json']))
  if(!object(root)||Object.keys(root).sort().join(',')!=='createdAt,format,preferences,sha256,version'||root.format!=='galiciana-peto-preferences'||root.version!==1)throw Error(tr('Versión ou estrutura de copia non compatible.','Versión o estructura de copia no compatible.'))
  if((typeof root.createdAt!=='number'&&typeof root.createdAt!=='bigint')||root.createdAt<0||typeof root.createdAt==='number'&&!Number.isSafeInteger(root.createdAt)||BigInt(root.createdAt)>9223372036854775807n)throw Error(tr('Data de copia non válida.','Fecha de copia inválida.'))
  if(typeof root.sha256!=='string'||!(/^[0-9a-f]{64}$/).test(root.sha256))throw Error(tr('Falta a comprobación de integridade.','Falta la comprobación de integridad.'))
  const {sha256:checksum,...unsigned}=root
  if(await sha256(utf8(canonical(unsigned)))!==checksum)throw Error(tr('A copia está danada: non coincide a súa comprobación de integridade.','La copia está dañada: no coincide su comprobación de integridad.'))
  return {preferences:validatePreferences(root.preferences),createdAt:root.createdAt}
}
const safe=(fn:()=>any,fallback:any)=>{try{return fn()}catch{return fallback}}
const list=(p:Preferences,k:string):any[]=>{const a=prefJson(p,k,[]);if(!Array.isArray(a))throw Error(tr('Lista non válida.','Lista inválida.'));return a}
const map=(p:Preferences,k:string):Record<string,any>=>{const a=prefJson(p,k,{});if(!object(a))throw Error(tr('Mapa non válido.','Mapa inválido.'));return a}
export const conflictsOf=(p:Preferences):Conflict[]=>safe(()=>list(p,'backup_conflicts_json'),[])
export function counts(p:Preferences):Counts {
  const favs=safe(()=>list(p,'fav_json'),[])as any[];const notes=safe(()=>map(p,'notes_json'),{})as Record<string,any>;const keys=new Set(Object.keys(notes).filter(k=>typeof notes[k]==='string'&&notes[k].trim()))
  for(const h of favs){const k=`${h.path}|${h.pos??1}`;if(!Object.hasOwn(notes,k)&&typeof h.note==='string'&&h.note.trim())keys.add(k)}
  return {preferences:Object.keys(p).length,favorites:favs.length,notes:keys.size,folders:safe(()=>list(p,'fav_folders').length,0),searches:safe(()=>list(p,'search_history_json').length,0)+safe(()=>list(p,'search_saved_json').length,0)}
}
export async function mergePreferences(current:Preferences,incoming:Preferences,createdAt:number|bigint,resolutions:Record<string,Resolution>={}):Promise<{preferences:Preferences;conflicts:Conflict[]}> {
  const result=structuredClone(current),pending=new Map<string,Conflict>(),detected=new Map<string,Conflict>()
  for(const c of [...conflictsOf(current),...conflictsOf(incoming)])pending.set(c.id,c)
  const choose=async(key:string,kind:string,a:any,b:any)=>{if(canonical(a)===canonical(b))return a;const localValue=typeof a==='string'?a:canonical(a),incomingValue=typeof b==='string'?b:canonical(b);const id=kind+':'+key+':'+(await sha256(utf8(localValue+'\0'+incomingValue))).slice(0,24);const c={id,key,kind,localValue,incomingValue,createdAt};detected.set(id,c);const r=resolutions[id]??'KEEP_BOTH';if(r!=='KEEP_BOTH')pending.delete(id);else pending.set(id,c);return r==='TAKE_INCOMING'?b:a}
  const notesOf=(p:Preferences)=>{const n:Record<string,string>=Object.create(null);for(const h of safe(()=>list(p,'fav_json'),[]))if(typeof h.note==='string'&&h.note.trim())n[`${h.path}|${h.pos??1}`]=h.note;const m=safe(()=>map(p,'notes_json'),{});if(Object.values(m).some(v=>typeof v!=='string'))return n;return {...n,...m}}
  const notes=notesOf(current);for(const [key,value]of Object.entries(notesOf(incoming)))notes[key]=Object.hasOwn(notes,key)?await choose(key,tr('Nota de referencia','Nota de referencia'),notes[key],value):value
  const folders=(v:any):string[]=>{if(typeof v==='string')return v.trim().startsWith('[')?folders(strictJson(v)):v?[v]:[];if(Array.isArray(v)&&v.every(n=>typeof n==='string'))return v;throw Error('Carpetas inválidas.')}
  const unique=(a:string[])=>a.filter((s,i)=>a.findIndex(x=>x.toLowerCase()===s.toLowerCase())===i)
  for(const [key,value]of Object.entries(incoming)){
    if(key==='backup_conflicts_json'||key==='notes_json')continue;const old=current[key];if(!old){result[key]=structuredClone(value);continue}if(canonical(old)===canonical(value))continue
    let combined:Preference|undefined
    try{
      if(old.type==='STRING_SET'&&value.type===old.type)combined={type:'STRING_SET',values:[...new Set([...old.values,...value.values])].sort()}
      else if(['fav_json','search_history_json','search_saved_json'].includes(key)){
        const rows=new Map<string,any>();const fav=key==='fav_json';const recordKey=(r:any)=>fav&&typeof r.path==='string'?`${r.path}|${r.pos??1}`:typeof r.id==='string'?r.id:canonical(r)
        for(const r of list(current,key)){if(!object(r))throw Error(tr('Rexistro non válido.','Registro inválido.'));rows.set(recordKey(r),r)}
        for(const r of list(incoming,key)){if(!object(r))throw Error(tr('Rexistro non válido.','Registro inválido.'));const k=recordKey(r),prev=rows.get(k);if(!prev){rows.set(k,r);continue}if(fav){const row={...r};for(const[f,v]of Object.entries(prev))if(v!==null&&v!==''&&canonical(v)!=='[]')row[f]=v;const a={...prev},b={...r};delete a.note;delete b.note;const differing=Object.entries(b).some(([f,v])=>v!==null&&v!==''&&a[f]!=null&&a[f]!==''&&canonical(a[f])!==canonical(v));if(differing){const selected=await choose(k,'Contexto de página',a,b);if(canonical(selected)===canonical(b))for(const[f,v]of Object.entries(b))if(v!==null&&v!=='')row[f]=v}rows.set(k,row)}else rows.set(k,await choose(k,'Búsqueda',prev,r))}
        combined=jsonPref([...rows].map(([k,r])=>fav&&Object.hasOwn(notes,k)?{...r,note:notes[k]}:r))
      }else if(key==='fav_folders')combined=jsonPref(unique([...folders(prefJson(current,key,[])),...folders(prefJson(incoming,key,[]))]))
      else if(key==='fav_folder_map'){const m={...map(current,key)};for(const[k,v]of Object.entries(map(incoming,key)))m[k]=Object.hasOwn(m,k)?unique([...folders(m[k]),...folders(v)]):folders(v);combined=jsonPref(m)}
      else if(key==='fav_stash'){const m={...map(current,key)};for(const[k,v]of Object.entries(map(incoming,key)))m[k]=Object.hasOwn(m,k)?await choose(k,tr('Páxina arquivada','Página archivada'),m[k],v):v;combined=jsonPref(m)}
    }catch{combined=undefined}
    result[key]=combined??await choose(key,tr('Preferencia','Preferencia'),old,value)
  }
  if(Object.keys(notes).length||current.notes_json||incoming.notes_json)result.notes_json=jsonPref(notes)
  if(result.fav_json)try{result.fav_json=jsonPref(list(result,'fav_json').map(r=>{const k=`${r.path}|${r.pos??1}`;return Object.hasOwn(notes,k)?{...r,note:notes[k]}:r}))}catch{/* preserved typed bytes */}
  for(const [i,p]of [current,incoming].entries())if(p.notes_json)try{const m=map(p,'notes_json');if(Object.values(m).some(v=>typeof v!=='string'))throw Error()}catch{await choose(`notes_json:${i}`,tr('Ficheiro de notas non interpretable','Archivo de notas no interpretable'),'',p.notes_json.values.join('\n'))}
  if(pending.size)result.backup_conflicts_json=jsonPref([...pending.values()]);else delete result.backup_conflicts_json
  return {preferences:result,conflicts:[...detected.values()].filter(c=>pending.has(c.id))}
}
export async function previewBackup(payload:BackupPayload,current:Preferences):Promise<BackupPreview>{const merged=await mergePreferences(current,payload.preferences,payload.createdAt);return{payload,fingerprint:await fingerprint(current),counts:counts(payload.preferences),currentCounts:counts(current),conflicts:merged.conflicts}}
