import {tr,dateText} from './i18n';
import {useEffect,useState} from 'react';
import type {Hit} from './types';
import {api,errorText,thumb} from './api';
import {MaterialIcon,PageTitle,Thumbnail} from './components';
import {store} from './storage';
import bundled from './hoxe-mes.json';

/** One issue of a daily, as the gateway's /api/day answers it. */
export interface DayIssue {path:string;label:string;day:string;exact:boolean;paper:string;publicationId:string;years:number;year:number;imageId:string|null}
interface DayAnswer {date:string;items:DayIssue[];covered?:number}

/** The years «Tal día como hoxe» looks back. Galiciana has no daily paper for 1986, so not 40. */
export const YEARS_AGO=[60,80,100];

const isoToday=()=>{const d=new Date();return [d.getFullYear(),d.getMonth()+1,d.getDate()].map((v,i)=>String(v).padStart(i?2:4,'0')).join('-')};
const dayName=(iso:string,withYear=false)=>dateText(new Date(iso+'T12:00:00Z'),{year:withYear,utc:true});
const hitOf=(issue:DayIssue):Hit=>({path:issue.path,position:1,imageId:issue.imageId,title:`${issue.paper} · ${issue.label}`,parentTitle:issue.paper,snippets:[]});
async function openIssue(issue:DayIssue,onOpen:(hit:Hit)=>void){const hit=hitOf(issue);try{await store.rememberReading(hit)}catch{/* reading on is what matters */}onOpen(hit)}

/** Precomputed months (scripts/hoxe-precalcular.mjs): the build month comes inside the app; the
 * others are small files under hoxe/, kept in the phone once fetched. A missing day asks Galiciana. */
type Month={month:string;days:Record<string,DayIssue[]>};
const MONTH='gdpeto-hoxe-mes-';
function monthOf(month:string):Month|undefined{
 if((bundled as Month).month===month)return bundled as Month;
 try{const raw=localStorage.getItem(MONTH+month);return raw?{month,days:JSON.parse(raw)}:undefined}catch{return undefined}
}
async function fetchMonth(month:string,signal:AbortSignal){
 if(monthOf(month))return;
 const answer=await fetch(`./hoxe/${month}.json`,{signal});
 if(!answer.ok)return;
 const days=await answer.json();
 try{
  // Only this month and the next stay: the rest is yesterday's paper.
  for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith(MONTH)&&k<MONTH+isoToday().slice(0,7))localStorage.removeItem(k)}
  localStorage.setItem(MONTH+month,JSON.stringify(days));
 }catch{/* the live answer still works */}
}
const nextMonth=(iso:string)=>{const [y,m]=iso.slice(0,7).split('-').map(Number);return m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,'0')}`};
const precomputed=(day:string):DayAnswer|undefined=>{const items=monthOf(day.slice(0,7))?.days[day];return items?{date:day,items}:undefined};

/** The day's answer is kept for that day: coming back to Inicio does not ask Galiciana again. */
function cached(key:string):DayAnswer|undefined{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):undefined}catch{return undefined}}
function keep(key:string,value:DayAnswer){try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith('gdpeto-hoxe-')&&k!==key)localStorage.removeItem(k)}localStorage.setItem(key,JSON.stringify(value))}catch{/* only the cache is lost */}}

/** Inicio: the front page of a Galician daily of this same day, 60, 80 and 100 years ago. */
export function TodayInHistory({onOpen}:{onOpen:(hit:Hit)=>void}){
 const today=isoToday(),key=`gdpeto-hoxe-${today}`;
 const [data,setData]=useState<DayAnswer|undefined>(()=>precomputed(today)??cached(key)),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError('');
  // After Inicio has drawn: it never holds up the search field. This month's file if it is not in
  // the phone yet, and from the 20th the next one too, so the 1st already opens with it.
  const start=setTimeout(()=>void (async()=>{
   if(!data){
    await fetchMonth(today.slice(0,7),controller.signal).catch(()=>{});
    const ready=precomputed(today);
    if(ready){setData(ready);return}
    try{const answer=await api<DayAnswer>(`day?date=${today}&years=${YEARS_AGO.join(',')}`,undefined,controller.signal);keep(key,answer);setData(answer)}
    catch(e){if(!controller.signal.aborted)setError(errorText(e))}
   }
   if(+today.slice(8)>=20)await fetchMonth(nextMonth(today),controller.signal).catch(()=>{});
  })(),300);
  return()=>{clearTimeout(start);controller.abort()}},[retry]);
 const items=[...(data?.items??[])].sort((a,b)=>a.years-b.years);
 if(data&&!items.length)return null;
 return <section className="on-this-day" aria-labelledby="on-this-day-title">
  <div className="on-this-day-head"><h2 id="on-this-day-title">{tr('Tal día como hoxe','Tal día como hoy')}</h2><span>{dayName(today)}</span></div>
  {error?<p className="on-this-day-error" role="alert">{error} <button className="text-button" onClick={()=>setRetry(n=>n+1)}>{tr('Reintentar','Reintentar')}</button></p>
  :<div className="on-this-day-row" aria-busy={!data}>{data?items.map(issue=><button key={issue.path} className="on-this-day-card" onClick={()=>void openIssue(issue,onOpen)}>
    <Thumbnail src={thumb(issue)} title={tr(`Portada de ${issue.paper} do ${dayName(issue.day,true)}`,`Portada de ${issue.paper} del ${dayName(issue.day,true)}`)}/>
    <span className="on-this-day-year"><strong>{issue.year}</strong><span>{tr(`hai ${issue.years} anos`,`hace ${issue.years} años`)}</span></span>
    <small>{issue.exact?issue.paper:tr(`${issue.paper} · ${dayName(issue.day)}; o ${dayName(today)} non saíu`,`${issue.paper} · ${dayName(issue.day)}; el ${dayName(today)} no salió`)}</small>
   </button>):YEARS_AGO.map(years=><span key={years} className="on-this-day-card on-this-day-placeholder" aria-hidden="true"><span className="thumbnail"/><span className="on-this-day-year"><strong>{new Date().getFullYear()-years}</strong><span>{tr(`hai ${years} anos`,`hace ${years} años`)}</span></span></span>)}</div>}
 </section>;
}

/** Explorar: a field for any date, which opens the list of that day's dailies. */
export function DayPicker({onPick}:{onPick:(date:string)=>void}){
 const [value,setValue]=useState('');
 const valid=/^\d{4}-\d{2}-\d{2}$/.test(value)&&+value.slice(0,4)>=1871&&+value.slice(0,4)<=1981;
 return <form className="day-picker" onSubmit={e=>{e.preventDefault();if(valid)onPick(value)}}>
  <strong>{tr('Un día na hemeroteca','Un día en la hemeroteca')}</strong>
  <span>{tr('Escolle unha data entre 1871 e 1981 e mira que xornais saíron ese día.','Elige una fecha entre 1871 y 1981 y mira qué periódicos salieron ese día.')}</span>
  <div className="day-picker-row"><label className={'day-picker-field'+(value?' filled':'')}><input type="date" min="1871-01-01" max="1981-12-31" value={value} onChange={e=>setValue(e.target.value)} aria-label={tr('Data','Fecha')}/>{/* Android shows an empty date field as a bare arrow */}{!value&&<span aria-hidden="true">{tr('Escoller data','Elegir fecha')}</span>}<MaterialIcon name="calendar_month" size={20}/></label><button className="m3-filled-button" disabled={!valid}>{tr('Ver','Ver')}</button></div>
 </form>;
}

/** The dailies of one day, each with its front page. */
export function DayPage({date,onBack,onOpen}:{date:string;onBack:()=>void;onOpen:(hit:Hit)=>void}){
 const [data,setData]=useState<DayAnswer>(),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const valid=/^\d{4}-\d{2}-\d{2}$/.test(date);
 useEffect(()=>{if(!valid)return;const controller=new AbortController();setData(undefined);setError('');void api<DayAnswer>(`day?date=${date}`,undefined,controller.signal).then(setData).catch(e=>{if(!controller.signal.aborted)setError(errorText(e))});return()=>controller.abort()},[date,retry]);
 const title=valid?dayName(date,true):tr('Un día na hemeroteca','Un día en la hemeroteca');
 return <><PageTitle title={title} onBack={onBack}/><div className="content day-page">
  {!valid?<p>{tr('Esa data non é válida.','Esa fecha no es válida.')}</p>
  :error?<p role="alert">{error} <button className="text-button" onClick={()=>setRetry(n=>n+1)}>{tr('Reintentar','Reintentar')}</button></p>
  :!data?<p className="muted" role="status">{tr('Buscando os xornais dese día…','Buscando los periódicos de ese día…')}</p>
  :!data.items.length?<p>{tr('Ningún dos diarios da hemeroteca ten un número dese día nin dos tres anteriores.','Ninguno de los diarios de la hemeroteca tiene un número de ese día ni de los tres anteriores.')}</p>
  :<div className="day-page-grid">{data.items.map(issue=><button key={issue.path} className="day-page-issue" onClick={()=>void openIssue(issue,onOpen)}>
    <Thumbnail src={thumb(issue)} title={tr(`Portada de ${issue.paper}`,`Portada de ${issue.paper}`)}/>
    <strong>{issue.paper}</strong>
    <small>{issue.exact?issue.label:tr(`${issue.label} · ese día non saíu`,`${issue.label} · ese día no salió`)}</small>
   </button>)}</div>}
 </div></>;
}
