import {tr,lang,chooseLang} from './i18n';
import {useEffect,useRef,useState} from 'react';
import {keyboardInput} from './layers';
import {ShellIcon,MaterialIcon} from './components';
import {BottomSheet,Snackbar} from './FolderSheet';
import {installedApp} from './Fullscreen';

/**
 * How to install. The web works in a browser tab from the first visit: nobody has to install
 * an app before seeing whether it helps. This screen opens only when asked (Acerca de, or the
 * offer after the first saved page, both through ?instalar). Chrome, Edge and Samsung Internet on Android hand over their own install dialog;
 * Safari, Firefox and the iPhone browsers have none, so a short drawn guide shows the way.
 */
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
let deferred:InstallEvent|undefined;
const listeners=new Set<()=>void>();
if(typeof window!=='undefined'){
 // The browser may offer installation before React starts: keep it from the first moment.
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e as InstallEvent;listeners.forEach(l=>l())});
 window.addEventListener('appinstalled',()=>{deferred=undefined;listeners.forEach(l=>l())});
}
const APK='https://github.com/petoacg/galicianadepeto/releases/latest';

export function installGateWanted():boolean{
 if(typeof window==='undefined'||installedApp())return false;
 const params=new URLSearchParams(location.search);
 // ?captura: the store screenshots of the manifest are taken from the app itself, without this screen.
 if(params.has('captura'))return false;
 return params.has('instalar');
}
/**
 * The aim is that people end up installing it, without a wall in front of the app. In a browser
 * tab, every visit invites twice, and never more: a card on Inicio when the app opens, and a
 * snackbar after the first search that brings results, when the app has just proved useful.
 * «Agora non» puts both away until the next visit; Acerca de switches them off for good. The
 * choice belongs to this browser, so it is not part of the backup.
 */
const OFFER='gdp_install_offer',LATER='gdp-install-later',ASKED='gdp-install-asked';
const session=(k:string)=>{try{return sessionStorage.getItem(k)==='1'}catch{return false}};
const remember=(k:string)=>{try{sessionStorage.setItem(k,'1')}catch{/* asked again on reload */}};
export const installOfferSupported=()=>typeof window!=='undefined'&&!installedApp()&&!new URLSearchParams(location.search).has('captura');
export function installOfferOn():boolean{if(!installOfferSupported())return false;try{return localStorage.getItem(OFFER)!=='0'}catch{return true}}
export function setInstallOfferOn(on:boolean){try{localStorage.setItem(OFFER,on?'1':'0')}catch{/* stays as it was for this visit */}}
export const openInstall=()=>{location.href=location.pathname+'?instalar'+location.hash};
/** Search announces results with this event; the offer listens for it. */
export const announceResults=()=>window.dispatchEvent(new Event('gdp-results'));
const why=()=>tr('Instalada vai mellor: ábrese ao momento desde a icona, a pantalla completa e sen barras do navegador.','Instalada va mejor: se abre al momento desde el icono, a pantalla completa y sin barras del navegador.');

/**
 * «Agora non»: the card and its gap go as one gesture. It fades fast (120 ms) while its height
 * folds in 220 ms with the app's ease-out, so what is below rises into the space as the card
 * leaves, not after. Reduced motion: only the fade. Keyboard: gone at once.
 */
function leave(el:HTMLElement|null,done:()=>void){
 if(!el||keyboardInput()||typeof el.animate!=='function'){done();return}
 el.style.pointerEvents='none';
 const fade=el.animate([{opacity:1},{opacity:0}],{duration:120,easing:'linear',fill:'forwards'});
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){fade.onfinish=done;return}
 const cs=getComputedStyle(el);el.style.overflow='hidden';
 el.animate([{height:el.getBoundingClientRect().height+'px',paddingTop:cs.paddingTop,paddingBottom:cs.paddingBottom,marginTop:cs.marginTop,marginBottom:cs.marginBottom},{height:'0px',paddingTop:'0px',paddingBottom:'0px',marginTop:'0px',marginBottom:'0px'}],{duration:220,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'}).onfinish=done;
}

export function InstallCard(){
 const [shown,setShown]=useState(()=>installOfferOn()&&!session(LATER));
 const card=useRef<HTMLElement>(null);
 if(!shown)return null;
 return <section ref={card} className="install-card" aria-labelledby="install-card-title">
  <ShellIcon size={40}/>
  <div><h2 id="install-card-title">{tr('Instala GdPeto','Instala GdPeto')}</h2><p>{why()}</p>
   <div className="install-card-actions"><button type="button" className="m3-filled-button" onClick={openInstall}>{tr('Instalar','Instalar')}</button>
    <button type="button" className="m3-text-button" onClick={()=>{remember(LATER);leave(card.current,()=>setShown(false))}}>{tr('Agora non','Ahora no')}</button></div></div>
 </section>;
}

export function InstallOffer({bottom}:{bottom:()=>number}){
 const [offer,setOffer]=useState(false);
 useEffect(()=>{
  const results=()=>{
   if(!installOfferOn()||session(LATER)||session(ASKED))return;
   // Someone else already speaks (a sheet, a dialog, another snackbar): this visit's offer waits for the next search.
   if(document.querySelector('dialog[open],.m3-menu-scrim,.m3-sheet-scrim,.m3-dialog-scrim,.modal-backdrop,.m3-snackbar'))return;
   remember(ASKED);setOffer(true);
  };
  window.addEventListener('gdp-results',results);return()=>window.removeEventListener('gdp-results',results);
 },[]);
 if(!offer)return null;
 return <Snackbar message={why()} action={tr('Instalar','Instalar')} onAction={openInstall} onDismiss={()=>setOffer(false)} long bottom={bottom()}/>;
}

type Platform='android-chrome'|'android-samsung'|'android-firefox'|'ios-safari'|'ios-chrome'|'ios-firefox'|'desktop-safari'|'desktop-chromium'|'desktop-other';
function platform():Platform{
 const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(ios)return /CriOS|EdgiOS/.test(ua)?'ios-chrome':/FxiOS/.test(ua)?'ios-firefox':'ios-safari';
 if(/Android/.test(ua))return /Firefox/.test(ua)?'android-firefox':/SamsungBrowser/.test(ua)?'android-samsung':'android-chrome';
 if(/Firefox/.test(ua))return 'desktop-other';
 if(/Chrome|Edg\//.test(ua))return 'desktop-chromium';
 return /Safari/.test(ua)?'desktop-safari':'desktop-other';
}
/** Menu names as the phone's browser writes them: Spanish phones in Spanish, Galician ones in Galician. */
const galicianPhone=()=>/^gl/i.test(navigator.language||'');
const m=(es:string,gl:string)=>galicianPhone()?gl:es;

interface Step{icon:string;text:React.ReactNode}
function guide(p:Platform):{steps:Step[];note?:string}{
 const b=(s:string)=><strong>{s}</strong>;
 switch(p){
  case 'ios-safari':return{steps:[
   {icon:'more_horiz',text:<>{tr('Toca','Toca')} {b('···')} {tr('abaixo á dereita, xunto ao enderezo.','abajo a la derecha, junto a la dirección.')}</>},
   {icon:'ios_share',text:<>{tr('Toca','Toca')} {b(m('Compartir','Compartir'))}.</>},
   {icon:'add_box',text:<>{tr('Baixa e toca','Baja y toca')} {b(m('Añadir a pantalla de inicio','Engadir á pantalla de inicio'))}.</>},
   {icon:'check',text:<>{tr('Deixa activado','Deja activado')} {b(m('Abrir como app web','Abrir como app web'))} {tr('e toca','y toca')} {b(m('Añadir','Engadir'))}.</>}],
   note:tr('Se ves o botón Compartir directamente, tócao e segue no paso 3.','Si ves el botón Compartir directamente, tócalo y sigue en el paso 3.')};
  case 'ios-chrome':return{steps:[
   {icon:'ios_share',text:<>{tr('Toca','Toca')} {b(m('Compartir','Compartir'))} {tr('á dereita da barra do enderezo.','a la derecha de la barra de direcciones.')}</>},
   {icon:'add_box',text:<>{tr('Toca','Toca')} {b(m('Añadir a pantalla de inicio','Engadir á pantalla de inicio'))}.</>},
   {icon:'check',text:<>{tr('Toca','Toca')} {b(m('Añadir','Engadir'))}.</>}]};
  case 'ios-firefox':return{steps:[
   {icon:'menu',text:<>{tr('Toca o menú','Toca el menú')} {b('☰')} {tr('abaixo á dereita.','abajo a la derecha.')}</>},
   {icon:'ios_share',text:<>{tr('Toca','Toca')} {b(m('Compartir','Compartir'))}.</>},
   {icon:'add_box',text:<>{tr('Toca','Toca')} {b(m('Añadir a pantalla de inicio','Engadir á pantalla de inicio'))}.</>},
   {icon:'check',text:<>{tr('Toca','Toca')} {b(m('Añadir','Engadir'))}.</>}]};
  case 'android-firefox':return{steps:[
   {icon:'more_vert',text:<>{tr('Toca o menú','Toca el menú')} {b('⋮')}. {tr('Está abaixo á dereita ou arriba, segundo onde teñas a barra do enderezo.','Está abajo a la derecha o arriba, según dónde tengas la barra de direcciones.')}</>},
   {icon:'add_box',text:<>{tr('Toca','Toca')} {b(m('Añadir a pantalla de inicio','Engadir á pantalla de inicio'))}. {tr('Nalgunhas versións chámase','En algunas versiones se llama')} {b(m('Instalar','Instalar'))}.</>},
   {icon:'check',text:<>{tr('Toca','Toca')} {b(m('Añadir','Engadir'))}.</>}]};
  case 'android-samsung':return{steps:[
   {icon:'menu',text:<>{tr('Toca o menú','Toca el menú')} {b('☰')} {tr('abaixo á dereita.','abajo a la derecha.')}</>},
   {icon:'add_box',text:<>{tr('Toca','Toca')} {b(m('Añadir página a','Engadir páxina a'))} {tr('e despois','y después')} {b(m('Pantalla de inicio','Pantalla de inicio'))}.</>},
   {icon:'check',text:<>{tr('Toca','Toca')} {b(m('Añadir','Engadir'))}.</>}]};
  case 'android-chrome':return{steps:[
   {icon:'more_vert',text:<>{tr('Toca o menú','Toca el menú')} {b('⋮')} {tr('arriba á dereita.','arriba a la derecha.')}</>},
   {icon:'install_mobile',text:<>{tr('Toca','Toca')} {b(m('Instalar aplicación','Instalar aplicación'))}. {tr('Tamén pode chamarse','También puede llamarse')} {b(m('Añadir a pantalla de inicio','Engadir á pantalla de inicio'))}.</>},
   {icon:'check',text:<>{tr('Toca','Toca')} {b(m('Instalar','Instalar'))}.</>}]};
  case 'desktop-safari':return{steps:[
   {icon:'menu',text:<>{tr('No menú','En el menú')} {b(m('Archivo','Ficheiro'))}, {tr('elixe','elige')} {b(m('Añadir al Dock','Engadir ao Dock'))}.</>}]};
  case 'desktop-chromium':return{steps:[
   {icon:'install_mobile',text:<>{tr('Toca a icona de instalar, á dereita da barra do enderezo, ou abre o menú e elixe','Pulsa el icono de instalar, a la derecha de la barra de direcciones, o abre el menú y elige')} {b(m('Instalar Galiciana de Peto','Instalar Galiciana de Peto'))}.</>}]};
  default:return{steps:[],note:tr('Este navegador non permite instalala. Ábrea en Chrome ou Edge para instalala, ou segue no navegador.','Este navegador no permite instalarla. Ábrela en Chrome o Edge para instalarla, o sigue en el navegador.')};
 }
}

export function InstallGate({onContinue}:{onContinue:()=>void}){
 const [, setTick]=useState(0),[guideOpen,setGuideOpen]=useState(false),[installed,setInstalled]=useState(false),[already,setAlready]=useState(false),[waited,setWaited]=useState(false);
 const p=platform(),android=p.startsWith('android');
 useEffect(()=>{const l=()=>setTick(t=>t+1);listeners.add(l);
  // Chrome needs a moment to decide the app can be installed; until then the button waits.
  const t=setTimeout(()=>setWaited(true),1500);
  const onInstalled=()=>setInstalled(true);window.addEventListener('appinstalled',onInstalled);
  // Already installed on this phone: Chrome lists it, and it can only be opened from its icon.
  void (navigator as Navigator&{getInstalledRelatedApps?:()=>Promise<unknown[]>}).getInstalledRelatedApps?.().then(list=>{if(list.length)setAlready(true)}).catch(()=>{});
  return()=>{listeners.delete(l);clearTimeout(t);window.removeEventListener('appinstalled',onInstalled)}},[]);
 const proceed=()=>{if(location.search)history.replaceState(history.state,'',location.pathname+location.hash);onContinue()};
 async function install(){
  if(!deferred){setGuideOpen(true);return}
  const e=deferred;await e.prompt();const choice=await e.userChoice.catch(()=>({outcome:'dismissed' as const}));
  if(choice.outcome==='accepted')setInstalled(true);
  deferred=undefined;setTick(t=>t+1);
 }
 const g=guide(p),canPrompt=!!deferred,unsupported=!g.steps.length&&!canPrompt;
 const primary=installed?null:already?null:canPrompt||(p==='android-chrome'||p==='desktop-chromium')&&!waited?{label:tr('Instalar a app','Instalar la app'),busy:!canPrompt&&!waited}:unsupported?null:{label:tr('Como instalala','Cómo instalarla'),busy:false};
 return <div className="install-gate" role="main" aria-labelledby="install-gate-title">
  {/* The language comes first, so everyone can follow the steps that follow. */}
  <div className="install-gate-language" role="radiogroup" aria-label={tr('Idioma','Idioma')}>
   {([['gl','Galego'],['es','Español']] as const).map(([code,label])=><button key={code} type="button" role="radio" aria-checked={lang()===code} className={'select-chip'+(lang()===code?' selected':'')} onClick={()=>chooseLang(code)}>{lang()===code&&<MaterialIcon name="check" size={18}/>}{label}</button>)}
  </div>
  <div className="install-gate-body">
   <div className="install-gate-mark"><ShellIcon size={96}/></div>
   <h1 id="install-gate-title">Galiciana de Peto</h1>
   <p className="install-gate-tagline">{tr('Galiciana, de peto.','Galiciana, de bolsillo.')}</p>
   <p className="install-gate-lead">{tr('Busca, le e garda páxinas da hemeroteca de Galiciana.','Busca, lee y guarda páginas de la hemeroteca de Galiciana.')}</p>
   <ul className="install-gate-points">
    <li><MaterialIcon name="phone_android" size={22}/>{tr('Ábrese coma unha app, sen barras do navegador','Se abre como una app, sin barras del navegador')}</li>
    <li><MaterialIcon name="add_box" size={22}/>{tr('Icona GdPeto na pantalla de inicio','Icono GdPeto en la pantalla de inicio')}</li>
    <li><MaterialIcon name="bookmarks" size={22}/>{tr('Os teus gardados quedan no teu teléfono','Tus guardados se quedan en tu teléfono')}</li>
   </ul>
  </div>
  <div className="install-gate-actions">
   {installed&&<p className="install-gate-done" role="status"><MaterialIcon name="download_done" size={22}/>{tr('Listo. Abre Galiciana de Peto desde a icona GdPeto.','Listo. Abre Galiciana de Peto desde el icono GdPeto.')}</p>}
   {!installed&&already&&<p className="install-gate-done" role="status"><MaterialIcon name="download_done" size={22}/>{tr('Xa a tes instalada. Ábrea desde a icona GdPeto da pantalla de inicio.','Ya la tienes instalada. Ábrela desde el icono GdPeto de la pantalla de inicio.')}</p>}
   {unsupported&&!installed&&!already&&<p className="install-gate-note">{g.note}</p>}
   {primary&&<button type="button" className="m3-filled-button install-gate-primary" disabled={primary.busy} onClick={()=>void install()}>{primary.label}</button>}
   {android&&!installed&&!already&&<a className="install-gate-apk" href={APK} target="_blank" rel="noopener noreferrer">{tr('Prefires a app completa para Android? Descarga o APK','¿Prefieres la app completa para Android? Descarga el APK')}</a>}
   <button type="button" className="install-gate-continue" onClick={proceed}>{tr('Seguir no navegador','Seguir en el navegador')}</button>
  </div>
  {guideOpen&&<BottomSheet label={tr('Como instalala','Cómo instalarla')} onClose={()=>setGuideOpen(false)}>{close=><div className="install-guide">
   <h2>{tr('Como instalala','Cómo instalarla')}</h2>
   <ol>{g.steps.map((s,i)=><li key={i}><span className="install-guide-number">{i+1}</span><span className="install-guide-icon"><MaterialIcon name={s.icon} size={24}/></span><span className="install-guide-text">{s.text}</span></li>)}</ol>
   {g.note&&g.steps.length>0&&<p className="install-guide-note">{g.note}</p>}
   <button type="button" className="m3-filled-button" onClick={close}>Entendido</button>
  </div>}</BottomSheet>}
 </div>;
}
