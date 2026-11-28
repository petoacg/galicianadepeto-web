import {keyboardInput} from './layers';
import {tr} from './i18n';
import {useEffect,useLayoutEffect,useRef,useState,Suspense} from 'react';
import {flushSync} from 'react-dom';
import {Search as SearchIcon,Compass,Bookmark,ArrowRight,Info,Newspaper,Library,Database,Download,WifiOff,RefreshCw} from 'lucide-react';
import type {Hit,Route,SearchPreset} from './types';
import {emptyPreset,BASE,identity,thumb,errorText,api} from './api';
import {PageTitle,ShellIcon,Thumbnail,Destination,External,Status,MaterialIcon,TabRootBar,consumeOverlayEntry,whenSettled} from './components';
// Every screen is in the bundle from the start, as in the app: moving between them never
// shows a loading text.
import Search from './Search';
import Viewer from './Viewer';
import Catalogue from './Catalogue';
import Archive from './Archive';
import {FullscreenOffer} from './Fullscreen';
import {InstallGate,installGateWanted,InstallOffer,installOfferOn} from './InstallGate';
import {AlertDialog} from './FolderSheet';
import {describeOrigin,screenKey,screenTitle,settleFocus} from './screenFocus';
/**
 * Changing screen: the new screen is there at once and takes taps from the first frame; it only
 * arrives with a subtle fade (220 ms) and 1/18 of the width of travel (260 ms), from the right going
 * forward and from the left going back, except when returning to search results. No view transition: while one plays, the page is a picture
 * and every tap is lost (Apple: never lock out input). A new change interrupts the arrival.
 * Reduced motion keeps a short fade; the keyboard, nothing. Steps within a screen do not move.
 */
let lastIndex=0,lastScreen='',arriving:Animation[]=[];
const EASE_OUT='cubic-bezier(.23,1,.32,1)';
function withTransition(next:{screen:string},apply:()=>void){
 const index=Number((history.state as {gdpetoIndex?:number}|null)?.gdpetoIndex??0),back=index<lastIndex,changed=next.screen!==lastScreen;
 lastIndex=index;lastScreen=next.screen;
 arriving.forEach(a=>a.cancel());arriving=[];
 const main=document.getElementById('main');
 if(!changed||keyboardInput()||typeof main?.animate!=='function'){apply();return}
 const navBefore=!!document.querySelector('.bottom-nav');
 flushSync(apply);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 arriving.push(main.animate([{opacity:.92},{opacity:1}],reduce?{duration:150,easing:'linear'}:{duration:back?200:220,easing:EASE_OUT}));
 if(!reduce&&!(back&&next.screen==='search'))arriving.push(main.animate([{transform:`translateX(${(back?-1:1)*innerWidth/18}px)`},{transform:'none'}],{duration:back?240:260,easing:EASE_OUT}));
 // The bottom bar stays put between tabs; coming back from the viewer (which has none) it fades in
 // with the screen, same curve and length, so both land on the same frame.
 const nav=document.querySelector<HTMLElement>('.bottom-nav');
 if(nav&&!navBefore)arriving.push(nav.animate([{opacity:0},{opacity:1}],reduce?{duration:150,easing:'linear'}:{duration:back?200:220,easing:EASE_OUT}));
}
import {store,type ArchiveSnapshot} from './storage';
import legal from './legal.json';
import Home from './Home';
import {isLight} from './theme';
import {noteVisit} from './readingHistory';
import {DayPicker,DayPage} from './OnThisDay';
import {About,Legal,ReadingHistory} from './About';
import {activeTab,RootHistoryNavigator,type NavigationState} from './navigation';
function routeFromLocation():Route{try{const p=new URLSearchParams(location.hash.slice(1));const screen=p.get('screen')||'home';if(screen==='viewer'){return {screen,hit:{path:p.get('path')||'',position:Math.max(1,Number(p.get('page'))||1),imageId:p.get('imageId')||undefined,title:p.get('title')||tr('Documento de Galiciana','Documento de Galiciana'),savedQuery:p.get('query')||'',snippets:[]},...(p.get('quiet')?{quiet:true}:{})}}if(screen==='search')return{screen,preset:{...emptyPreset,...JSON.parse(p.get('preset')||'{}')}};return {screen,...Object.fromEntries(p)}}catch{return{screen:'home'}}}
function routeUrl(route:Route){const p=new URLSearchParams({screen:route.screen});if(route.screen==='viewer'){const h=route.hit as Hit;for(const[k,v]of Object.entries({path:h.path,page:h.position,imageId:h.imageId,title:h.title,query:h.savedQuery}))if(v)p.set(k,String(v));if(route.quiet)p.set('quiet','1');}else for(const[k,v]of Object.entries(route))if(k!=='screen'&&v!=null)p.set(k,typeof v==='object'?JSON.stringify(v):String(v));return '#'+p}
/** What a screen wrote about itself while a sheet, dialog or menu was on top: its own step gets it when that one is left. */
const rewritten=new Map<number,{state:NavigationState<Route>;url:string}>();
// Closing the dialog goes back one history entry, which cancels a reload already started: reload after it.
function reloadAfterDialog(){const go=()=>location.reload();if(!(history.state as {gdpOverlay?:boolean}|null)?.gdpOverlay){go();return}window.addEventListener('popstate',()=>setTimeout(go,50),{once:true});setTimeout(go,3000)}
export default function App(){const [nav]=useState(()=>new RootHistoryNavigator<Route>({state:()=>history.state,locationRoute:routeFromLocation,routeUrl,replace:(state,next)=>{const covered=!!(history.state as {gdpOverlay?:boolean}|null)?.gdpOverlay,url=routeUrl(next);if(covered)rewritten.set(state.gdpetoIndex,{state,url});else rewritten.delete(state.gdpetoIndex);history.replaceState(covered?{...state,gdpOverlay:true}:state,'',url)},push:(state,next)=>{rewritten.delete(state.gdpetoIndex);if(consumeOverlayEntry())history.replaceState(state,'',routeUrl(next));else history.pushState(state,'',routeUrl(next))},go:delta=>{history.go(consumeOverlayEntry()&&delta<0?delta-1:delta)},scroll:()=>window.scrollY,changed:next=>withTransition(next,()=>setRoute(next))},{screen:'home'}));// The screen the app opened on counts as the last one, so a link straight into the viewer does not
 // treat its first page turn as a change of screen (the whole screen would fade in again).
 const [route,setRoute]=useState<Route>(()=>{const first=nav.route;if(!lastScreen)lastScreen=(first as {screen:string}).screen;return first}),[online,setOnline]=useState(navigator.onLine),[update,setUpdate]=useState<ServiceWorkerRegistration>(),[askUpdate,setAskUpdate]=useState(false),[gate,setGate]=useState(installGateWanted),[install,setInstall]=useState<any>(),[fatal,setFatal]=useState('');
 // The status bar takes the colour of what is under it; reading with the controls hidden, the page's.
 // The status bar takes the colour at the top of the screen, light or dark as the phone is; the reader is always dark.
 const [light,setLight]=useState(isLight);
  useEffect(()=>{const q=matchMedia('(prefers-color-scheme: light)'),change=()=>setLight(isLight());q.addEventListener('change',change);window.addEventListener('gdpeto-theme',change);return()=>{q.removeEventListener('change',change);window.removeEventListener('gdpeto-theme',change)}},[]);
 useEffect(()=>{const top=route.screen==='viewer'?(route.quiet?'#1C1A17':'#162029'):getComputedStyle(document.documentElement).getPropertyValue(route.screen==='explore'?'--md-background':'--md-surface').trim();document.querySelector('meta[name="theme-color"]')?.setAttribute('content',top)},[route.screen,route.screen==='viewer'&&route.quiet,light]);
 const historyIndex=()=>Number((history.state as {gdpetoIndex?:number}|null)?.gdpetoIndex??0);
 const origins=useRef(new Map<number,ReturnType<typeof describeOrigin>>()),shown=useRef({key:screenKey(route),screen:route.screen,index:historyIndex(),gate});
 function navigate(next:Route,replace=false){whenSettled(()=>{
  // A screen that only rewrites its own step, with nothing pressed, keeps what was noted.
  const origin=describeOrigin();if(origin||!replace)origins.current.set(historyIndex(),origin);
  nav.navigate(next,replace);
 })}
 useEffect(()=>{document.title=gate?'Galiciana de Peto':screenTitle(route)},[route,gate]);
 const key=screenKey(route);
 useEffect(()=>{
  const before=shown.current,index=historyIndex();shown.current={key,screen:route.screen,index,gate};
  if(gate||before.key===key&&before.gate===gate)return;
  // Back returns to the control it left from; a change within the screen keeps the one just pressed.
  const back=index<before.index,within=!back&&before.screen===route.screen;
  return settleFocus(origins.current.get(back?index:within?before.index:-1),back);
 },[key,gate]);
 const back=()=>whenSettled(()=>nav.back());
 const home=()=>whenSettled(()=>nav.goHome());
 useEffect(()=>{history.scrollRestoration='manual';const pop=()=>{const now=history.state as {gdpetoIndex?:number;gdpOverlay?:boolean}|null,mine=now&&!now.gdpOverlay?rewritten.get(now.gdpetoIndex??-1):undefined;if(mine){rewritten.delete(mine.state.gdpetoIndex);history.replaceState(mine.state,'',mine.url)}nav.handlePop()};const connection=()=>setOnline(navigator.onLine);const prompt=(e:Event)=>{setInstall(e)};let registration:ServiceWorkerRegistration|undefined,checked=Date.now();const fresh=()=>{if(document.visibilityState==='visible'&&registration&&Date.now()-checked>1800000){checked=Date.now();void registration.update().catch(()=>{})}};document.addEventListener('visibilitychange',fresh);window.addEventListener('popstate',pop);window.addEventListener('hashchange',pop);nav.ready();window.addEventListener('online',connection);window.addEventListener('offline',connection);window.addEventListener('beforeinstallprompt',prompt);if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').then(reg=>{registration=reg;if(reg.waiting)setUpdate(reg);reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)setUpdate(reg)})})}).catch(()=>{});return()=>{document.removeEventListener('visibilitychange',fresh);window.removeEventListener('popstate',pop);window.removeEventListener('hashchange',pop);window.removeEventListener('online',connection);window.removeEventListener('offline',connection);window.removeEventListener('beforeinstallprompt',prompt)}},[]);
 useLayoutEffect(()=>{window.scrollTo(0,history.state?.gdpetoScroll||0)},[route]);
  // Axustes › Historial de lectura (off by default): one line per work opened in the reader.
  const viewerPath=route.screen==='viewer'?(route.hit as Hit)?.path:undefined;
  useEffect(()=>{if(viewerPath)noteVisit(route.hit as Hit)},[viewerPath]);
 const open=(hit:Hit)=>navigate({screen:'viewer',hit});const search=(preset:SearchPreset)=>navigate({screen:'search',preset});const isViewer=route.screen==='viewer';
 // Nothing is mounted under the installation screen: it would load pictures and take the focus unseen.
 if(gate)return <div className="app"><InstallGate onContinue={()=>setGate(false)}/></div>;
 return <div className={'app '+(isViewer?'reading':'')}><a className="skip-link" href="#main" onClick={e=>{e.preventDefault();document.getElementById('main')?.focus()}}>{tr('Saltar ao contido','Saltar al contenido')}</a>{!online&&<div className="connection" role="status"><WifiOff size={16}/>{tr('Sen conexión. Os teus gardados e notas consérvanse; os documentos precisan internet.','Sin conexión. Tus guardados y notas se conservan; los documentos requieren internet.')}</div>}<div role="status" style={{display:'contents'}}>{update&&!isViewer&&<div className="update-banner"><span>{tr('Hai unha actualización dispoñible.','Hay una actualización disponible.')}</span><button className="text-button" onClick={()=>{if(document.querySelector('dialog[open]'))return;setAskUpdate(true)}}><RefreshCw size={16}/>{tr('Actualizar','Actualizar')}</button></div>}</div>{askUpdate&&update&&<AlertDialog title={tr('Aplicar a actualización?','¿Aplicar la actualización?')} text={tr('A aplicación volverá cargar. Garda os cambios antes de continuar.','La aplicación se volverá a cargar. Guarda los cambios antes de continuar.')} confirm={tr('Actualizar','Actualizar')} onConfirm={()=>{setAskUpdate(false);navigator.serviceWorker.addEventListener('controllerchange',reloadAfterDialog,{once:true});update.waiting?.postMessage({type:'ACTIVATE'})}} onCancel={()=>setAskUpdate(false)}/>}<main id="main" tabIndex={-1}><Suspense fallback={<div className="content" role="status">{tr('Abrindo…','Abriendo…')}</div>}>{route.screen==='home'?<Home onOpen={open} onSearch={search} navigate={navigate}/>:route.screen==='search'?<Search key={JSON.stringify(route.preset)} preset={route.preset as SearchPreset||emptyPreset} onHistory={()=>navigate({screen:'history'})} initialForm={Boolean(route.form)} onBack={back} onOpen={open} onSubmit={(p,fromForm)=>navigate({screen:'search',preset:p},!fromForm)} onFilters={()=>navigate({screen:'search',preset:route.preset,form:true})} pickingStep={route.picking===true} onPickingStep={on=>on?navigate({...route,picking:true}):back()}/>:isViewer?<Viewer key={(route.hit as Hit)?.path} hit={route.hit as Hit} onBack={back} onChange={h=>navigate({screen:'viewer',hit:h,...(route.quiet?{quiet:true}:{})},true)} onHome={home} quiet={Boolean(route.quiet)} onQuiet={q=>{if(q)navigate({...route,quiet:true});else if(route.quiet)back()}}/>:route.screen==='explore'?<Explore navigate={navigate}/>:['saved','history','backup'].includes(route.screen)?<><Archive route={route} navigate={navigate} onHome={home} view={route.screen as 'saved'|'history'|'backup'} onBack={back} onOpen={open} onSearch={search} onBackup={()=>navigate({screen:'backup'})}/>{route.screen==='backup'&&<StorageSafety/>}</>:['hemeroteca','collections','record','data'].includes(route.screen)?<div className="catalogue-shell"><Catalogue route={route} navigate={navigate} onBack={back} onOpen={open}/></div>:route.screen==='day'?<DayPage date={String(route.date??'')} onBack={back} onOpen={open}/>:route.screen==='legal'?<Legal onBack={back}/>:route.screen==='about'?<About onBack={back} onLegal={()=>navigate({screen:'legal'})} onHistory={()=>navigate({screen:'reading'})}/>:route.screen==='reading'?<ReadingHistory onBack={back} onOpen={open}/>:<><PageTitle title={tr('Páxina non atopada','Página no encontrada')} onBack={back}/><div className="content"><button className="button" onClick={home}>{tr('Volver ao inicio','Volver al inicio')}</button></div></>}</Suspense></main>{installOfferOn()?<InstallOffer bottom={()=>isViewer?(route.quiet?0:(document.querySelector<HTMLElement>('.viewer-bottom')?.offsetHeight??0)):(document.querySelector<HTMLElement>('.bottom-nav')?.offsetHeight??0)}/>:<FullscreenOffer bottom={()=>isViewer?(route.quiet?0:(document.querySelector<HTMLElement>('.viewer-bottom')?.offsetHeight??0)):(document.querySelector<HTMLElement>('.bottom-nav')?.offsetHeight??0)}/>}{!isViewer&&<nav className="bottom-nav" aria-label={tr('Navegación principal','Navegación principal')}>{[['home',tr('Buscar','Buscar'),SearchIcon],['explore',tr('Explorar','Explorar'),Compass],['saved',tr('Gardados','Guardados'),Bookmark]].map(([screen,label,Icon]:any)=><button key={screen} className={(screen===activeTab(route.screen)?'active':'')} onClick={()=>whenSettled(()=>nav.selectTab(screen))} aria-current={screen===activeTab(route.screen)?'page':undefined}><span><MaterialIcon name={screen==='home'?'search':screen==='explore'?'explore':'bookmarks'}/></span>{label}</button>)}</nav>}</div>
}
function Explore({navigate}:{navigate:(r:Route)=>void}){return <><TabRootBar title={tr('Explorar','Explorar')}/><div className="content explore"><Destination icon={<MaterialIcon name="newspaper" size={28}/>} title={tr('Hemeroteca','Hemeroteca')} description={tr('Periódicos e revistas por título, ano e número.','Periódicos y revistas por título, año y número.')} onClick={()=>navigate({screen:'hemeroteca'})}/><DayPicker onPick={date=>navigate({screen:'day',date})}/><Destination icon={<MaterialIcon name="collections_bookmark" size={28}/>} title={tr('Coleccións','Colecciones')} description={tr('Libros, mapas, fotos, programas de festas.','Libros, mapas, fotos, programas de fiestas.')} onClick={()=>navigate({screen:'collections'})}/><Destination icon={<MaterialIcon name="sell" size={28}/>} title={tr('Índices do catálogo','Índices del catálogo')} description={tr('Materias, autores e lugares.','Materias, autores y lugares.')} onClick={()=>navigate({screen:'data'})}/></div></>}
function StorageSafety(){const [persistent,setPersistent]=useState<boolean|null>(null),[message,setMessage]=useState('');useEffect(()=>{void navigator.storage?.persisted?.().then(setPersistent)},[]);return <section className="content small storage-safety"><h2>{tr('Almacenamento neste navegador','Almacenamiento en este navegador')}</h2><p className="muted">{persistent?tr('O navegador concedeu almacenamento persistente.','El navegador ha concedido almacenamiento persistente.'):tr('O navegador pode liberar datos do sitio se precisa espazo.','El navegador puede liberar datos del sitio si necesita espacio.')} {tr('Borrar os datos do sitio ou desinstalar o navegador pode eliminar o teu arquivo. Conserva unha copia ZIP fóra da aplicación.','Borrar los datos del sitio o desinstalar el navegador puede eliminar tu archivo. Conserva una copia ZIP fuera de la aplicación.')}</p>{persistent===false&&navigator.storage?.persist&&<button className="button secondary" onClick={async()=>{try{const granted=await navigator.storage.persist();setPersistent(granted);setMessage(granted?tr('Almacenamento persistente concedido.','Almacenamiento persistente concedido.'):tr('O navegador non o concedeu. O teu arquivo segue dispoñible; garda unha copia ZIP.','El navegador no lo ha concedido. Tu archivo sigue disponible; guarda una copia ZIP.'))}catch{setMessage(tr('Non se puido consultar o permiso. Garda unha copia ZIP.','No se pudo consultar el permiso. Guarda una copia ZIP.'))}}}>{tr('Solicitar almacenamento persistente','Solicitar almacenamiento persistente')}</button>}{message&&<p role="status">{message}</p>}</section>}
