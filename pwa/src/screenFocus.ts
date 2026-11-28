import {tr} from './i18n';
import type {Hit,Route,SearchPreset} from './types';
import {publicationIdentity} from './publication';
import {focusLost,originElement} from './layers';

/** Which screen this is: turning pages, selecting, opening a folder or hiding the controls is not another one. */
export function screenKey(route:Route):string{
 if(route.screen==='viewer')return 'viewer|'+(route.hit as Hit)?.path;
 if(route.screen==='saved')return 'saved';
 const {picking,...rest}=route;return JSON.stringify(rest);
}
/** The name of the browser tab: what the screen is about and, last, the app. */
export function screenTitle(route:Route):string{
 const text=(value:unknown)=>typeof value==='string'?value.trim():'';
 const hit=route.hit as Hit|undefined,query=text((route.preset as SearchPreset|undefined)?.query);
 const name=route.screen==='viewer'&&hit?`${publicationIdentity(hit.title,hit.parentTitle).shortTitle||tr('Documento','Documento')}, ${tr('páx.','pág.')} ${hit.position}`
  :route.screen==='search'?[route.form?tr('Buscar','Buscar'):tr('Resultados','Resultados'),query].filter(Boolean).join(': ')
  :route.screen==='explore'?tr('Explorar','Explorar')
  :route.screen==='saved'?tr('Gardados','Guardados')
  :route.screen==='history'?tr('As túas buscas','Tus búsquedas')
  :route.screen==='backup'?tr('Copia dos teus datos','Copia de tus datos')
  :route.screen==='hemeroteca'?text(route.title)||tr('Hemeroteca','Hemeroteca')
  :route.screen==='collections'?text(route.title)||tr('Coleccións','Colecciones')
  :route.screen==='record'?text(route.title)||tr('Ficha do catálogo','Ficha del catálogo')
  :route.screen==='day'?tr('Un día na hemeroteca','Un día en la hemeroteca')
  :route.screen==='data'?text(route.label)||tr('Índices do catálogo','Índices del catálogo')
  :route.screen==='about'?tr('Axustes','Ajustes')
  :route.screen==='reading'?tr('Historial de lectura','Historial de lectura')
  :route.screen==='legal'?tr('Aviso legal','Aviso legal'):'';
 return (name?name+' · ':'')+'Galiciana de Peto';
}

/** The control a screen was left from, remembered by what it says, since the screen is built again. */
interface Origin{tag:string;name:string;nth:number}
const nameOf=(el:Element)=>(el.getAttribute('aria-label')||el.textContent||'').trim();
const likes=(tag:string,name:string)=>Array.from(document.querySelectorAll<HTMLElement>('#main '+tag)).filter(el=>nameOf(el)===name);
export function describeOrigin():Origin|undefined{
 const el=originElement();
 // On a phone, focusing a field would bring the keyboard up.
 if(!el||!/^(BUTTON|A|INPUT)$/.test(el.tagName)||!el.closest('#main')||el.tagName==='INPUT'&&matchMedia('(pointer:coarse)').matches)return;
 const tag=el.tagName.toLowerCase(),name=nameOf(el);return {tag,name,nth:likes(tag,name).indexOf(el)};
}
const find=(origin?:Origin)=>origin&&likes(origin.tag,origin.name)[origin.nth];
/** The focus goes to the control it came from or to the heading; never away from where the user put it. */
export function settleFocus(origin:Origin|undefined,wait:boolean){
 if(!focusLost())return;
 const h1=document.querySelector<HTMLElement>('#main h1');
 const there=find(origin);if(there){there.focus({preventScroll:true});return}
 if(h1){h1.tabIndex=-1;h1.focus({preventScroll:true})}
 if(!origin||!wait)return;
 // Results and archives arrive a moment later.
 const until=Date.now()+2000,timer=setInterval(()=>{
  if(Date.now()>until||document.activeElement!==h1&&!focusLost()){clearInterval(timer);return}
  const now=find(origin);if(now){clearInterval(timer);now.focus({preventScroll:true})}
 },100);
 return()=>clearInterval(timer);
}
