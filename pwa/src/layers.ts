import {useEffect,useLayoutEffect,useRef,type RefObject} from 'react';
/**
 * Everything that opens on top of a screen (sheets, dialogs, menus, the note) shares this stack:
 * only the top one answers Escape and keeps Tab, what is behind cannot be reached, and on closing
 * the focus goes back to where it was, as Android's windows do.
 */
interface Layer{el:HTMLElement;key?:(e:KeyboardEvent)=>void;back:HTMLElement[]}
const layers:Layer[]=[];
const held=new WeakMap<Element,number>();
/** inert on everything beside the layer and beside its ancestors; counted, so layers may overlap. */
function hideOthers(el:HTMLElement){
 const mine:Element[]=[];
 for(let node:HTMLElement=el;node.parentElement&&node!==document.body;node=node.parentElement)
  for(const other of node.parentElement.children){
   if(other===node||!(other instanceof HTMLElement)||/^(SCRIPT|STYLE|LINK)$/.test(other.tagName))continue;
   const n=held.get(other)??0;if(!n&&other.inert)continue;
   held.set(other,n+1);other.inert=true;mine.push(other);
  }
 return()=>{for(const other of mine){const n=(held.get(other)??1)-1;held.set(other,n);if(!n)(other as HTMLElement).inert=false}};
}
export const focusables=(el:HTMLElement)=>Array.from(el.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex="0"]')).filter(x=>!(x as HTMLButtonElement).disabled&&!x.closest('[inert]')&&x.getClientRects().length>0);
/** Focus is nowhere useful: on the page itself or on something that is no longer there. */
// Safari does not focus a button when it is clicked or tapped, so the layer it opens would not know
// where to send the focus back. The last control pressed stands in for it (still focused or not).
let pressed:HTMLElement|null=null,pressedAt=0,closed:HTMLElement|undefined,closedAt=0;
const recent=(el:HTMLElement|null|undefined,at:number)=>el?.isConnected&&performance.now()-at<1000?el:null;
const opener=()=>{const a=document.activeElement as HTMLElement|null;return a&&a!==document.body&&a.id!=='main'?a:recent(pressed,pressedAt)};
export const focusLost=()=>{const a=document.activeElement;return !a||a===document.body||a.id==='main'};
/** The element the user was on before opening what is on top, if anything is. */
// A menu item that changes screen closes its menu first: the menu's opener is still the origin.
export const originElement=()=>(layers[0]?.back[0]??recent(closed,closedAt)??opener()) as HTMLElement|null;
function trap(el:HTMLElement,e:KeyboardEvent){
 const list=focusables(el),at=list.indexOf(document.activeElement as HTMLElement);
 if(!list.length){e.preventDefault();el.focus();return}
 if(e.shiftKey?at<=0:at===list.length-1||(at<0&&!el.contains(document.activeElement))){e.preventDefault();list[e.shiftKey?list.length-1:0].focus()}
}
if(typeof document!=='undefined')document.addEventListener('keydown',e=>{layers[layers.length-1]?.key?.(e)},true);
export interface LayerOptions{
 /** Where the focus goes on opening; the layer itself when it returns nothing. */
 first?:(el:HTMLElement)=>HTMLElement|null|undefined;
 /** A native <dialog> keeps Tab, Escape and the page behind by itself. */
 native?:boolean;
 /** Keys of its own, before Escape and Tab. Returns true when it has dealt with the key. */
 keys?:(e:KeyboardEvent,el:HTMLElement)=>boolean;
}
export function useLayer(ref:RefObject<HTMLElement|null>,onEscape:()=>void,options:LayerOptions={}){
 const now=useRef({onEscape,options});now.current={onEscape,options};
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  const active=opener(),owner=layers.find(l=>l.el.contains(active));
  const layer:Layer={el,back:[...(active&&active!==document.body?[active]:[]),...(owner?.back??[])]};
  const {native,first}=now.current.options;
  if(!native)layer.key=e=>{
   if(e.isComposing||now.current.options.keys?.(e,el))return;
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();now.current.onEscape()}
   else if(e.key==='Tab')trap(el,e);
  };
  layers.push(layer);
  const show=native?undefined:hideOthers(el);
  if(!native)(first?.(el)??el).focus({preventScroll:true});
  return()=>{
   layers.splice(layers.indexOf(layer),1);show?.();closed=layer.back[0];closedAt=performance.now();
   if(!focusLost())return;
   (layer.back.find(x=>x.isConnected&&!x.closest('[inert]'))??document.getElementById('main'))?.focus({preventScroll:true});
  };
 },[]);
}
/** The page behind does not scroll while something covers it. */
let locks=0,overflow='';
export function useScrollLock(){useEffect(()=>{if(!locks++){overflow=document.body.style.overflow;document.body.style.overflow='hidden'}return()=>{if(!--locks)document.body.style.overflow=overflow}},[])}

/**
 * As Android's menus, dialogs and snackbars, a surface fades out when it goes; but closing is never
 * delayed: a still copy, out of reach of taps and Tab, fades over the next frames while the real one leaves at once, so
 * focus, history and the layer stack move exactly as before.
 */
export function useFadeOut(ref:RefObject<HTMLElement|null>,duration:number){
 useLayoutEffect(()=>()=>{const el=ref.current;if(!el?.isConnected||typeof el.animate!=='function'||keyboardInput())return;
  const r=el.getBoundingClientRect();if(!r.width||!r.height)return;
  const copy=el.cloneNode(true) as HTMLElement;copy.removeAttribute('id');copy.setAttribute('aria-hidden','true');copy.setAttribute('tabindex','-1');copy.querySelectorAll('button,input,textarea,select,a,[tabindex]').forEach(n=>n.setAttribute('tabindex','-1'));
  Object.assign(copy.style,{position:'fixed',left:`${r.left}px`,top:`${r.top}px`,right:'auto',bottom:'auto',width:`${r.width}px`,height:`${r.height}px`,margin:'0',maxWidth:'none',pointerEvents:'none',zIndex:'200',animation:'none'});
  (document.getElementById('main')??document.body).append(copy);
  copy.animate([{opacity:1},{opacity:0}],{duration,easing:'linear',fill:'forwards'}).finished.finally(()=>copy.remove()).catch(()=>{})},[]);
}

/** Which input moved the interface last. What the keyboard opens or turns appears at once: keyboard
 * actions repeat, and motion on them reads as delay (Emil). Typing in a field does not count, so the
 * phone keyboard's Enter in the search box keeps the usual motion; Escape always counts. */
export function trackInputModality(){const root=document.documentElement;
 document.addEventListener('keydown',e=>{if(['Shift','Control','Alt','Meta','CapsLock'].includes(e.key))return;const t=e.target as Element|null;if(e.key!=='Escape'&&t?.closest?.('input,textarea,select,[contenteditable="true"]'))return;root.dataset.input='keyboard'},true);
 document.addEventListener('pointerdown',e=>{delete root.dataset.input;pressed=(e.target as Element|null)?.closest?.<HTMLElement>('button,a[href],[tabindex]')??null;pressedAt=performance.now()},true)}
export const keyboardInput=()=>typeof document!=='undefined'&&document.documentElement.dataset.input==='keyboard';
