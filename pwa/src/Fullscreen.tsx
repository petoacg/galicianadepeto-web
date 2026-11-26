import {tr} from './i18n';
import {useEffect,useRef,useState} from 'react';
import {Snackbar} from './FolderSheet';

/**
 * Full screen for the whole web app. Browsers only enter it after a tap, and Android leaves
 * it whenever another app comes forward, so the app offers it with a snackbar each time it
 * is opened or comes back, once per visit. iPhone Safari has no full screen for pages: there
 * nothing is offered. The offer can be switched off in Acerca de; the choice belongs to this
 * browser, not to the research data, so it is not part of the backup.
 */
const KEY='gdp_fullscreen_offer';
/** Installed from the browser, the app already opens in its own window without browser bars, on
 * Android as on iPhone: the offer is only for the browser tab. */
// A browser tab put in full screen also reports display-mode: fullscreen, so that mode counts as
// installed only when it is not the Fullscreen API at work.
export const installedApp=()=>typeof location!=='undefined'&&new URLSearchParams(location.search).has('captura')||typeof matchMedia!=='undefined'&&(['standalone','minimal-ui'].some(m=>matchMedia(`(display-mode: ${m})`).matches)||(matchMedia('(display-mode: fullscreen)').matches&&!document.fullscreenElement))||(navigator as Navigator&{standalone?:boolean}).standalone===true;
export const fullscreenSupported=()=>typeof document!=='undefined'&&!!document.fullscreenEnabled&&typeof document.documentElement.requestFullscreen==='function'&&!installedApp();
export function fullscreenOfferOn():boolean{if(new URLSearchParams(location.search).has('captura'))return false;try{return localStorage.getItem(KEY)!=='0'}catch{return true}}
export function setFullscreenOffer(on:boolean){try{localStorage.setItem(KEY,on?'1':'0')}catch{/* stays on for this visit */}}

export async function enterFullscreen():Promise<boolean>{
 try{await document.documentElement.requestFullscreen({navigationUI:'hide'});return true}catch{return false}
}

/** Something already speaks to the user: a sheet, a dialog, the note editor or another snackbar. */
const busyScreen=()=>!!document.querySelector('dialog[open],.m3-menu-scrim,.m3-sheet-scrim,.m3-dialog-scrim,.modal-backdrop,.m3-snackbar');

export function FullscreenOffer({bottom}:{bottom:()=>number}){
 const [offer,setOffer]=useState(false),[failed,setFailed]=useState(false),[visit,setVisit]=useState(0);
 const shownFor=useRef(-1);
 useEffect(()=>{
  if(!fullscreenSupported())return;
  // A visit begins when the app opens and every time it comes back to the front.
  const back=()=>{if(document.visibilityState==='visible')setVisit(v=>v+1)};
  document.addEventListener('visibilitychange',back);
  return()=>document.removeEventListener('visibilitychange',back);
 },[]);
 useEffect(()=>{
  if(!fullscreenSupported()||!fullscreenOfferOn()||shownFor.current===visit)return;
  // Half a second lets the first screen settle; a user's own snackbar or open sheet wins.
  const timer=setTimeout(()=>{
   if(document.fullscreenElement||document.visibilityState!=='visible'||busyScreen()||!fullscreenOfferOn())return;
   shownFor.current=visit;setOffer(true);
  },500);
  return()=>clearTimeout(timer);
 },[visit]);
 // Entering full screen by any other way ends the offer.
 useEffect(()=>{const done=()=>{if(document.fullscreenElement)setOffer(false)};document.addEventListener('fullscreenchange',done);return()=>document.removeEventListener('fullscreenchange',done)},[]);
 // The bar under the page grows when its marks or its message arrive: the offer stays above it.
 const [,setRise]=useState(0);
 useEffect(()=>{const bar=offer&&document.querySelector('.viewer-bottom');if(!bar)return;const observer=new ResizeObserver(()=>setRise(bar.clientHeight));observer.observe(bar);return()=>observer.disconnect()},[offer]);
 if(failed)return <Snackbar message={tr('O navegador non permitiu activar a pantalla completa.','El navegador no permitió activar la pantalla completa.')} onDismiss={()=>setFailed(false)} bottom={bottom()}/>;
 if(!offer)return null;
 return <Snackbar message={tr('Ver a pantalla completa','Ver en pantalla completa')} action="Activar" onAction={()=>{void enterFullscreen().then(ok=>{if(!ok)setFailed(true)})}} onDismiss={()=>setOffer(false)} long bottom={bottom()}/>;
}
