import type {Hit} from './types';

/**
 * Axustes › Historial de lectura: off unless the user turns it on. When on, every work opened in
 * the reader is noted here, newest first, one line per work (opening it again moves it up).
 * It stays in this browser only; it is not part of the backup ZIP.
 */
export interface ReadingVisit {path:string;title:string;parentTitle?:string|null;imageId?:string|null;position:number;at:number}
const ON='gdpeto-reading-history-on',LIST='gdpeto-reading-history',MAX=500;

export function historyOn():boolean{try{return localStorage.getItem(ON)==='1'}catch{return false}}
export function setHistoryOn(on:boolean){try{if(on)localStorage.setItem(ON,'1');else localStorage.removeItem(ON)}catch{/* stays as it was */}}

export function readingHistory():ReadingVisit[]{try{const value=JSON.parse(localStorage.getItem(LIST)||'[]');return Array.isArray(value)?value.filter(v=>v&&typeof v.path==='string'):[]}catch{return []}}

export function noteVisit(hit:Hit){
 if(!historyOn()||!hit?.path)return;
 const visit:ReadingVisit={path:hit.path,title:hit.title,parentTitle:hit.parentTitle??null,imageId:hit.imageId??null,position:hit.position||1,at:Date.now()};
 const list=[visit,...readingHistory().filter(v=>v.path!==hit.path)].slice(0,MAX);
 try{localStorage.setItem(LIST,JSON.stringify(list))}catch{/* a full store only loses the newest line */}
}

export function clearReadingHistory(){try{localStorage.removeItem(LIST)}catch{/* nothing to clear */}}
