import {tr} from './i18n';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {store} from './storage';
import type {Hit} from './types';
import {MaterialIcon,SvgIcon,useBackDismiss} from './components';
import {errorText} from './api';
import {project,rubberband,springFrames} from './spring';
import {focusables,useFadeOut,useLayer,useScrollLock,keyboardInput} from './layers';

const ARCHIVADOR='Archivador general';
const same=(a:string,b:string)=>a.toLocaleLowerCase()===b.toLocaleLowerCase();
/** The iOS drawer curve (Emil): fast from the first frame, long gentle finish. Matches app.css. */
const DRAWER='cubic-bezier(.32,.72,0,1)';
/** i18n folderLabel: only the stored name of the general folder is translated. */
export const folderLabel=(name:string)=>same(name,ARCHIVADOR)?tr('Arquivador xeral','Archivador general'):name;
const hitKey=(h:Hit)=>`${h.path}|${h.position}`;

/**
 * Material 3 ModalBottomSheet as Android draws it: scrim at 32 %, surface #15222D with 28 dp
 * top corners, a 32 × 4 drag handle in a 48 dp strip, slides up from the bottom edge and
 * back down on dismissal (scrim tap, Escape, or a downward drag or flick on the handle or on
 * content scrolled to the top).
 */
export function BottomSheet({label,onClose,children,tall=false}:{label:string;onClose:()=>void;children:(close:()=>void)=>ReactNode;tall?:boolean}){
 const [leaving,setLeaving]=useState(false),[flung,setFlung]=useState(false),sheet=useRef<HTMLElement>(null),body=useRef<HTMLDivElement>(null),veil=useRef<HTMLDivElement>(null);
 const drag=useRef<{y:number;y0:number;dy:number;samples:{y:number;t:number}[]}|null>(null);
 const closeRef=useRef(onClose);closeRef.current=onClose;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 // Closed while it is still rising: it turns back from where it is, not from fully open.
 const close=()=>{if(leaving)return;const el=sheet.current,entry=el&&!reduced()?el.getAnimations().find(a=>(a as CSSAnimation).animationName==='m3-sheet-in'&&a.playState==='running'):undefined;
  if(el&&entry){freeze();leave(200,DRAWER)}else setLeaving(true);setTimeout(()=>closeRef.current(),reduced()||keyboardInput()?0:200)};
 /** Stops the entrance (sheet and veil) where it is, so a finger or a close can take over from there. */
 function freeze(){const el=sheet.current,v=veil.current;if(!el)return;
  const now=getComputedStyle(el).transform,shade=v?getComputedStyle(v).opacity:'1';
  el.getAnimations().forEach(a=>a.cancel());v?.getAnimations().forEach(a=>a.cancel());
  el.style.transition='none';el.style.transform=now==='none'?'':now;if(v){v.style.transition='none';v.style.opacity=shade}el.getBoundingClientRect()}
 /** Leaves from wherever the sheet is now, in ms milliseconds, with the veil fading in step. A fling
  * goes at an even pace, the finger's (its time is the way left at that speed); a close starts at
  * full speed and eases out, so it never seems to hesitate. */
 function leave(ms:number,easing='linear'){const el=sheet.current,v=veil.current;if(!el)return;const t=`${ms}ms ${easing}`;
  el.style.transition='transform '+t;el.style.transform='translateY(100%)';if(v){v.style.transition='opacity '+t;v.style.opacity='0'}setFlung(true);setLeaving(true)}
 const offset=()=>{const m=sheet.current&&new DOMMatrixReadOnly(getComputedStyle(sheet.current).transform);return m?m.m42:0};
 const shade=(dy:number)=>{const v=veil.current,h=sheet.current?.offsetHeight||1;if(v)v.style.opacity=String(Math.max(0,Math.min(1,1-dy/h)))};
 const closeNow=useRef(close);closeNow.current=close;
 useBackDismiss(()=>closeNow.current());
 useLayer(sheet,()=>closeNow.current());useScrollLock();
 // While the finger is down the sheet is the finger. On release it closes if the flick would carry it
 // far enough (see release), and it leaves or returns from where it was let go, at the finger's speed.
 const begin=(y:number)=>{if(leaving)return;freeze();const from=Math.max(0,offset());drag.current={y:y-from,y0:y,dy:from,samples:[{y,t:performance.now()}]};shade(from)};
 const follow=(y:number)=>{const d=drag.current,el=sheet.current;if(!d||!el)return;const raw=y-d.y;d.dy=Math.max(0,raw);const t=performance.now();d.samples=[...d.samples.filter(p=>t-p.t<100),{y,t}];
  // Upwards there is nothing further: it gives a little, less the more you pull, instead of a hard stop.
  el.style.transform=`translateY(${raw<0?-rubberband(-raw,el.offsetHeight):raw}px)`;shade(d.dy)};
 const release=(cancelled=false)=>{const d=drag.current,el=sheet.current;drag.current=null;if(!d||!el)return;
  // Only the last 100 ms count: a finger that stopped before lifting throws nothing.
  const now=performance.now(),recent=d.samples.filter(p=>now-p.t<100),first=recent[0],last=d.samples[d.samples.length-1],velocity=first&&recent.length>1&&last.t>first.t?(last.y-first.y)/(last.t-first.t):0;
  // A sheet caught while rising and let go without moving settles open.
  // It closes when the flick would carry it past half its height, or 180 px on a tall sheet (Apple's
  // momentum projection; a slow drag stops where the finger stops).
  const away=!cancelled&&d.dy>0&&last.y-d.y0>4&&d.dy+project(Math.max(0,velocity))>Math.min(el.offsetHeight/2,180);
  const v=veil.current;
  if(reduced()){el.style.transition='';el.style.transform='';if(v){v.style.transition='';v.style.opacity=''}if(away)close();return}
  // A flick leaves at the finger's speed: the time is what is left of the way at that speed (120–250 ms).
  if(away){const ms=Math.round(Math.max(120,Math.min(250,velocity>0?(el.offsetHeight-d.dy)/velocity:200)));leave(ms);setTimeout(()=>closeRef.current(),ms);return}
  // It returns on a spring that starts at the finger's speed, so letting go has no seam.
  const h=el.offsetHeight||1,{values,duration}=springFrames(offset(),0,velocity);
  el.style.transition='';el.style.transform='';el.animate(values.map(y=>({transform:`translateY(${y}px)`})),{duration,easing:'linear'});
  if(v){v.style.transition='';v.style.opacity='';v.animate(values.map(y=>({opacity:Math.max(0,Math.min(1,1-y/h))})),{duration,easing:'linear'})}};
 const releaseRef=useRef(release);releaseRef.current=release;
 // Android drags the sheet from its content too, once that content is scrolled to the top.
 useEffect(()=>{const area=body.current;if(!area)return;let start:{x:number;y:number;top:boolean}|null=null,dragging=false;
  const down=(e:TouchEvent)=>{if(e.touches.length!==1){start=null;return}const t=e.touches[0];start={x:t.clientX,y:t.clientY,top:area.scrollTop<=0};dragging=false};
  const move=(e:TouchEvent)=>{if(!start||!start.top||e.touches.length!==1)return;const t=e.touches[0],dy=t.clientY-start.y,dx=t.clientX-start.x;
   if(!dragging){if(dy>8&&dy>Math.abs(dx)&&area.scrollTop<=0){dragging=true;begin(t.clientY)}else if(Math.abs(dx)>8||dy<-8){start=null;return}else return}
   e.preventDefault();follow(t.clientY)};
  const up=(e:TouchEvent)=>{if(dragging)releaseRef.current(e.type==='touchcancel');dragging=false;start=null};
  area.addEventListener('touchstart',down,{passive:true});area.addEventListener('touchmove',move,{passive:false});area.addEventListener('touchend',up);area.addEventListener('touchcancel',up);
  return()=>{area.removeEventListener('touchstart',down);area.removeEventListener('touchmove',move);area.removeEventListener('touchend',up);area.removeEventListener('touchcancel',up)}},[]);
 return <div className={'m3-sheet-scrim'+(leaving?' leaving':'')+(flung?' flung':'')} onClick={e=>{if(e.target===e.currentTarget||e.target===veil.current)close()}}>
  <div className="m3-sheet-veil" ref={veil} aria-hidden="true"/>
  <section ref={sheet} className={'m3-sheet'+(tall?' tall':'')+(leaving?' leaving':'')+(flung?' flung':'')} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
   <div className="m3-sheet-handle" onPointerDown={e=>{begin(e.clientY);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>follow(e.clientY)} onPointerUp={()=>release()} onPointerCancel={()=>release(true)}>
    <button type="button" aria-label={tr('Pechar folla','Cerrar hoja')} onClick={close}><span/></button>
   </div>
   <div className="m3-sheet-body" ref={body}>{children(close)}</div>
  </section>
 </div>
}

/** M3 AlertDialog: surfaceContainerHigh, 28 dp corners, title 24, text 14, text buttons at the end. */
export function AlertDialog({title,text,confirm,danger,onConfirm,onCancel,children,confirmDisabled,extra,stacked=false,dismiss}:{dismiss?:string;stacked?:boolean;title:string;text?:string;confirm:string;danger?:boolean;onConfirm:()=>void;onCancel:()=>void;children?:ReactNode;confirmDisabled?:boolean;extra?:ReactNode}){
 const box=useRef<HTMLElement>(null),scrim=useRef<HTMLDivElement>(null);
 const cancel=useRef(onCancel);cancel.current=onCancel;
 useFadeOut(scrim,100);
 useBackDismiss(()=>cancel.current());
 useLayer(box,()=>cancel.current(),{first:el=>focusables(el)[0]});
 return <div className="m3-dialog-scrim" ref={scrim} onClick={e=>{if(e.target===e.currentTarget)onCancel()}}>
  <section ref={box} className="m3-dialog" role="alertdialog" aria-modal="true" aria-label={title} tabIndex={-1}>
   <h2>{title}</h2>{text&&<p>{text}</p>}{children}
   <div className={'m3-dialog-actions'+(stacked?' stacked':'')}><button type="button" className="m3-text-button" onClick={onCancel}>{dismiss??tr('Cancelar','Cancelar')}</button>{extra}<button type="button" className={'m3-text-button'+(danger?' danger':'')} disabled={confirmDisabled} onClick={onConfirm}>{confirm}</button></div>
  </section>
 </div>
}

/**
 * FolderPickSheet.kt: «Gardar en», every folder with a checkbox (Arquivador xeral first and
 * ticked when the page has no folder), a bin beside the others, «Novo cartafol» with its own
 * field and «Engadir», and «Feito», which is the only moment anything is stored.
 */
export function FolderSheet({hit,onClose,onConfirmed}:{hit:Hit;onClose:()=>void;onConfirmed?:()=>void|Promise<void>}){
 const [folders,setFolders]=useState<string[]>([ARCHIVADOR]),[selected,setSelected]=useState<string[]>([ARCHIVADOR]),[draft,setDraft]=useState(''),[pendingDelete,setPendingDelete]=useState<string>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const list=(names:string[])=>[ARCHIVADOR,...names.filter(n=>!same(n,ARCHIVADOR))];
 useEffect(()=>{let alive=true;void store.snapshot().then(s=>{if(!alive)return;setFolders(list(s.folders));const have=s.folderMap[hitKey(hit)]??[];setSelected(have.length?have:[ARCHIVADOR])}).catch(e=>setError(errorText(e)));return()=>{alive=false}},[]);
 const on=(name:string)=>selected.some(n=>same(n,name));
 const toggle=(name:string)=>setSelected(on(name)?selected.filter(n=>!same(n,name)):[...selected,name]);
 const [fresh,setFresh]=useState('');
 async function add(){const n=draft.trim();if(!n)return;try{await store.createFolder(n);const s=await store.snapshot();setFolders(list(s.folders));setFresh(n);if(!on(n))setSelected([...selected,n]);setDraft('')}catch(e){setError(errorText(e))}}
 async function remove(target:string){setPendingDelete(undefined);try{await store.deleteFolder(target);const s=await store.snapshot();setFolders(list(s.folders));const keep=selected.filter(n=>!same(n,target));setSelected(keep.length?keep:[ARCHIVADOR])}catch(e){setError(errorText(e))}}
 return <BottomSheet label={tr('Gardar en','Guardar en')} onClose={onClose}>{close=><>
  <h2 className="folder-sheet-title">{tr('Gardar en','Guardar en')}</h2>
  <p className="folder-sheet-hint">{tr('Podes marcar varios á vez.','Puedes marcar varias a la vez.')}</p>
  <div className="folder-sheet-list">{folders.map(name=><div className={'folder-sheet-row'+(fresh&&same(name,fresh)?' fresh':'')} key={name}>
   <label><input type="checkbox" className="m3-checkbox" checked={on(name)} onChange={()=>toggle(name)}/><span>{folderLabel(name)}</span></label>
   {!same(name,ARCHIVADOR)&&<button type="button" className="folder-sheet-delete" aria-label={tr(`Eliminar cartafol ${name}`,`Eliminar carpeta ${name}`)} onClick={()=>setPendingDelete(name)}><MaterialIcon name="delete" size={18}/></button>}
  </div>)}</div>
  <p className="folder-sheet-new"><SvgIcon name="create_new_folder" size={20}/>{tr('Novo cartafol','Nueva carpeta')}</p>
  <form className="folder-sheet-add" onSubmit={e=>{e.preventDefault();(document.activeElement as HTMLElement|null)?.blur()}}>
   <label className={'m3-filled-field'+(draft?' filled':'')}><input value={draft} onChange={e=>setDraft(e.target.value)} enterKeyHint="done" autoComplete="off"/><span>{tr('Nome do cartafol','Nombre de la carpeta')}</span></label>
   <button type="button" className="m3-text-button" disabled={!draft.trim()} onClick={()=>void add()}>{tr('Engadir','Añadir')}</button>
  </form>
  {error&&<p className="folder-sheet-error" role="alert">{error}</p>}
  <button type="button" className="m3-filled-button" disabled={busy} onClick={()=>void(async()=>{setBusy(true);try{await store.setFolders(hit,selected.length?selected:[ARCHIVADOR]);await onConfirmed?.();close()}catch(e){setError(errorText(e));setBusy(false)}})()}>{tr('Feito','Listo')}</button>
  {pendingDelete&&<AlertDialog title={tr('Eliminar cartafol','Eliminar carpeta')} text={tr(`Eliminar «${pendingDelete}»? As páxinas consérvanse nos seus outros cartafoles; as que non teñan ningún pasarán ao arquivador xeral.`,`¿Eliminar «${pendingDelete}»? Las páginas se conservan en sus otras carpetas; las que no tengan ninguna pasarán al archivador general.`)} confirm={tr('Eliminar','Eliminar')} danger onConfirm={()=>void remove(pendingDelete)} onCancel={()=>setPendingDelete(undefined)}/>}
 </>}</BottomSheet>
}

/**
 * M3 Snackbar as the app shows it: inverse surface #E5EDF3, text #15222D 14 sp, action in
 * #12476D, 4 dp corners, 48 dp tall, 12 dp from the sides and from whatever it sits on.
 * Short lasts 4 s and Long 10 s, as SnackbarDuration.
 */
export function Snackbar({message,action,onAction,onDismiss,long=false,bottom=0,indefinite=false}:{message:string;action?:string;onAction?:()=>void;onDismiss:()=>void;long?:boolean;bottom?:number;indefinite?:boolean}){
 const dismiss=useRef(onDismiss),bar=useRef<HTMLDivElement>(null);dismiss.current=onDismiss;
 useFadeOut(bar,75);
 // The clock only runs while the page is seen: a snackbar never runs out behind another app.
 useEffect(()=>{if(indefinite)return;let left=long?10000:4000,start=0,t=0;
  const run=()=>{if(document.hidden)return;start=Date.now();t=window.setTimeout(()=>dismiss.current(),left)};
  const pause=()=>{if(!t)return;clearTimeout(t);t=0;left=Math.max(0,left-(Date.now()-start))};
  const onVis=()=>{if(document.hidden)pause();else if(!t)run()};
  run();document.addEventListener('visibilitychange',onVis);
  return()=>{clearTimeout(t);document.removeEventListener('visibilitychange',onVis)}},[message,long,indefinite]);
 return <div className="m3-snackbar" ref={bar} role="status" style={{bottom:bottom+12}}><span>{message}</span>{action&&<button type="button" onClick={()=>{onAction?.();dismiss.current()}}>{action}</button>}</div>
}
