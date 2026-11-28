import {keyboardInput} from './layers';
import {project,rubberband,springFrames} from './spring';
import {tr} from './i18n';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type React from 'react';
import type {Hit} from './types';
import {api,BASE,errorText,keyOf,original,proxy} from './api';
import {Modal,Status,ShellIcon,MaterialIcon} from './components';
import {store,type ArchiveSnapshot} from './storage';
import {NoteEditor} from './Archive';
import {FolderSheet,Snackbar,BottomSheet,AlertDialog} from './FolderSheet';
import {jpegDownload,pdfDownload} from './downloads';
import {anchoredScroll, imageAnchor, clampZoom} from './viewerGeometry';
import {hintedPages,scanOrder,adjacentMatchPage} from './pageHints';
import {pageKey,cachedPage,forgetPage,loadPage,readingDirection,setReadingDirection,type PageImage} from './pageImages';
import {countInText,loadMarks,loadText,NO_MARKS,type Page} from './pageData';
/** The address of this page in the app itself: whoever receives it opens GdPeto on the same page. */
function appLink(){const route=new URLSearchParams(location.hash.slice(1));route.delete('quiet');return location.origin+location.pathname+'#'+route}
/** The page index (METS) costs seconds through the script and rarely changes: the last ones are kept here. */
const WORKS='gdp-works';
const index=()=>{try{return JSON.parse(localStorage.getItem(WORKS)||'{}')}catch{return {}}};
/** Entries from earlier versions do not say whether the work has text, so they are read again. */
function cachedWork(path:string):any{const work=index()[path];return work&&typeof work.hasText==='boolean'?work:undefined}
function rememberWork(path:string,work:any){try{const all=index();delete all[path];all[path]={title:work.title,hasText:!!work.hasText,...(work.pdf?{pdf:true}:{}),pages:(work.pages||[]).map((p:any)=>({position:p.position,imageId:p.imageId,label:p.label}))};const keys=Object.keys(all);for(const k of keys.slice(0,Math.max(0,keys.length-12)))delete all[k];localStorage.setItem(WORKS,JSON.stringify(all))}catch{/* only a shortcut */}}
/**
 * Read ahead while the results are read: for the first results, their page index, the marks of the
 * searched words and (for the first two) the page image are asked for in silence, so opening one
 * shows the page with the word already found. Each is asked once per visit; a failure is forgotten
 * and the viewer asks again. Not with Data Saver on, nor offline.
 */
const AHEAD=3,AHEAD_IMAGES=2,asked=new Set<string>(),workAhead=new Map<string,Promise<any>>();
export function workForSearch(path:string):Promise<{pages:{position:number;imageId?:string|null}[]}>{
 const cached=cachedWork(path);
 if(Array.isArray(cached?.pages)&&cached.pages.length)return Promise.resolve(cached);
 let request=workAhead.get(path);
 if(!request){
  request=api('work?path='+encodeURIComponent(path)).then(w=>{if(!Array.isArray(w?.pages)||!w.pages.length)throw Error('No page index');rememberWork(path,w);return w});
  workAhead.set(path,request);
  request.catch(()=>workAhead.delete(path));
 }
 return request;
}
export function readAhead(hits:Hit[],query:string){
 const conn=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;
 if(!navigator.onLine||conn?.saveData)return;
 hits.slice(0,AHEAD).forEach((hit,i)=>{
  const key=keyOf(hit)+'|'+query;if(asked.has(key))return;asked.add(key);
  void workForSearch(hit.path).catch(()=>{});
  if(query.trim())loadMarks(hit.path,hit.position,hit.imageId||undefined,query).catch(()=>asked.delete(key));
  if(hit.imageId&&i<AHEAD_IMAGES)loadPage(hit.path,hit.position,hit.imageId).catch(()=>{});
 });
}
export default function Viewer({hit,onBack,onChange,onHome=onBack,quiet=false,onQuiet=()=>{}}:{hit:Hit;onBack:()=>void;onChange:(hit:Hit)=>void;onHome?:()=>void;quiet?:boolean;onQuiet?:(quiet:boolean)=>void}){
 const [work,setWork]=useState<any>(),[pageData,setPage]=useState<(Page&{identity:string})>(),[error,setError]=useState(''),[loading,setLoading]=useState(true),[query,setQuery]=useState(hit.savedQuery||''),[applied,setApplied]=useState(hit.savedQuery||''),[searching,setSearching]=useState(false),[actions,setActions]=useState(false),[note,setNote]=useState(false),[folders,setFolders]=useState(false),[text,setText]=useState(false),[info,setInfo]=useState(false),[download,setDownload]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[offer,setOffer]=useState(false),[goTo,setGoTo]=useState(false),[retryDownload,setRetryDownload]=useState<'JPEG'|'PDF'>(),[goText,setGoText]=useState(''),[snackId,setSnackId]=useState(0),[zoom,setZoom]=useState(1),[natural,setNatural]=useState<[number,number]>([1,1]),[selected,setSelected]=useState(0),[marks,setMarks]=useState(true),[snapshot,setSnapshot]=useState<ArchiveSnapshot>(),[workRetry,setWorkRetry]=useState(0),[workError,setWorkError]=useState(''),[pageError,setPageError]=useState(''),[imageError,setImageError]=useState('');
 const viewport=useRef<HTMLDivElement>(null),pointers=useRef(new Map<number,{x:number;y:number}>()),gesture=useRef<{x:number;y:number;left:number;top:number;distance?:number;zoom:number;anchor?:{x:number;y:number};moved?:boolean;multi?:boolean}>({x:0,y:0,left:0,top:0,zoom:1});
 // The zoom a pinch is at right now; it reaches state when the pinch ends.
 const zoomLive=useRef(1);useEffect(()=>{zoomLive.current=zoom},[zoom]);
 const [viewportSize,setViewportSize]=useState<[number,number]>([0,0]);
 // The page rests in a fixed frame: centred on the screen and clear of the title bar, as
 // in Android. Showing or hiding the controls never resizes it, so the page never jumps.
 const headerRef=useRef<HTMLElement>(null),[framePad,setFramePad]=useState(64),bottomRef=useRef<HTMLDivElement>(null),[bottomBar,setBottomBar]=useState(0);
 useEffect(()=>{const bar=bottomRef.current;if(!bar)return;const observer=new ResizeObserver(()=>{if(bar.offsetHeight)setBottomBar(h=>Math.max(h,bar.offsetHeight))/* opening the search form hides the bar for a moment; the frame must not follow it */});observer.observe(bar);return()=>observer.disconnect()},[]);
 useEffect(()=>{const header=headerRef.current;if(!header)return;const observer=new ResizeObserver(()=>{if(header.offsetHeight)setFramePad(header.offsetHeight)});observer.observe(header);return()=>observer.disconnect()},[]);
 const tapTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(tapTimer.current),[]);
 useEffect(()=>{const area=viewport.current;if(!area)return;let previous:[number,number]=[0,0];const observer=new ResizeObserver(()=>{const next:[number,number]=[area.clientWidth,area.clientHeight];if(next[0]===previous[0]&&next[1]===previous[1])return;const image=area.querySelector<HTMLElement>('.facsimile');const anchor=previous[0]&&previous[1]&&image?.offsetWidth&&image?.offsetHeight?[(area.scrollLeft+previous[0]/2-image.offsetLeft)/image.offsetWidth,(area.scrollTop+previous[1]/2-image.offsetTop)/image.offsetHeight]:null;previous=next;setViewportSize(next);if(anchor)requestAnimationFrame(()=>{const current=area.querySelector<HTMLElement>('.facsimile');if(current)area.scrollTo(current.offsetLeft+anchor[0]*current.offsetWidth-next[0]/2,current.offsetTop+anchor[1]*current.offsetHeight-next[1]/2)})});observer.observe(area);return()=>observer.disconnect()},[]);
 // On a wide screen the page has room to spare across, so it also keeps clear of the bar
 // below; on a phone it stays centred and the bar may lie over its foot, as in Android.
 const wide=viewportSize[0]>=900&&viewportSize[0]>viewportSize[1];
 const frameBottom=wide?Math.max(framePad,bottomBar):framePad;
 const frameHeight=Math.max(1,viewportSize[1]-framePad-frameBottom);
 // Until its dimensions are known, the silhouette uses the previous page's proportion.
 const ratio=natural[0]>1?natural[0]/natural[1]:1/1.45;
 const fitWidth=viewportSize[0]&&viewportSize[1]?Math.min(viewportSize[0],frameHeight*ratio):viewportSize[0];
 const [imageRetry,setImageRetry]=useState(0),[marksRetry,setMarksRetry]=useState(0);
 const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
 const pages=work?.path===hit.path?work.pages||[]:[];
 // A work Galiciana keeps as one PDF has no page image to draw, and one without recognised text has nothing to ask for.
 const pdfOnly=work?.path===hit.path&&!!work.pdf,noText=work?.path===hit.path&&work.hasText===false;
 // ViewerScreen: the image a result names is the page the user asked for. When the page index
 // gives it another number, the number is corrected, never the image (433 → 435).
 const seedPage=hit.imageId?pages.find((p:any)=>p.imageId===hit.imageId):undefined;
 const imageId=seedPage?hit.imageId:pages.find((p:any)=>p.position===hit.position)?.imageId||hit.imageId;
 useEffect(()=>{if(seedPage&&seedPage.position!==hit.position)onChange({...hit,position:seedPage.position,savedQuery:applied})},[seedPage?.position]);
 // The page image comes decoded from memory when it was read ahead or seen a moment ago;
 // otherwise it is downloaded once and kept, so turning back is instant.
 const currentKey=pageKey(hit.path,hit.position,imageId);
 // The page is drawn only once decoded: no broken image, no alt text, no marks over a hole.
 const [shown,setShown]=useState<{key:string;page:PageImage}>();
 const displayed=shown?.key===currentKey?shown.page:cachedPage(currentKey);
 useLayoutEffect(()=>{if(displayed)setNatural(n=>n[0]===displayed.width&&n[1]===displayed.height?n:[displayed.width,displayed.height])},[displayed]);
 useEffect(()=>{let disposed=false,retryTimer:ReturnType<typeof setTimeout>|undefined,finishRetry:(()=>void)|undefined;setImageError('');if(pdfOnly)return;
  void (async()=>{for(let attempt=0;;attempt++){try{const page=await loadPage(hit.path,hit.position,imageId);if(!disposed)setShown({key:currentKey,page});return}catch{if(disposed)return;if(attempt===0){await new Promise<void>(resolve=>{const finish=()=>{retryTimer=undefined;finishRetry=undefined;resolve()};finishRetry=finish;retryTimer=setTimeout(finish,700)});if(disposed)return;continue}setImageError(tr('Non se puido abrir a páxina. Comproba a conexión e téntao de novo.','No se pudo abrir la página. Comprueba la conexión y vuelve a intentarlo.'));return}}})();
  return()=>{disposed=true;if(retryTimer!==undefined){clearTimeout(retryTimer);finishRetry?.()}}},[currentKey,imageRetry,pdfOnly]);
 const imageSource=displayed?.url;
 // Ready means this very source has loaded. A flag reset by an effect lost the race with a
 // page already in memory, whose load event came first: the sheet then waited forever.
 const imgRef=useRef<HTMLImageElement>(null),[readySrc,setReadySrc]=useState('');
 const imgReady=!!imageSource&&readySrc===imageSource;
 useLayoutEffect(()=>{const img=imgRef.current;if(img&&imageSource&&img.getAttribute('src')===imageSource&&img.complete&&img.naturalWidth>0){setNatural([img.naturalWidth,img.naturalHeight]);setReadySrc(imageSource)}},[imageSource]);
 const pageContext=JSON.stringify([hit.path,hit.position,imageId||'',applied,marksRetry,noText,pdfOnly]);
 const page=pageData?.identity===pageContext?pageData:undefined;
 useEffect(()=>{const update=()=>store.snapshot().then(setSnapshot).catch(e=>setError(errorText(e)));void update();return store.subscribe(()=>void update())},[]);
 useEffect(()=>{const controller=new AbortController();const known=cachedWork(hit.path);setWork((previous:any)=>previous?.path===hit.path?previous:known?{...known,path:hit.path}:undefined);setWorkError('');if(known)return()=>controller.abort();// ViewerScreen: Galiciana sometimes fails the first request of a session, so the page
 // index is asked again twice (after 0.7 s and 1.4 s) before giving up.
 void (async()=>{for(let attempt=0;;attempt++){try{const w=await ((attempt===0&&workAhead.get(hit.path))||api('work?path='+hit.path,undefined,controller.signal));if(!Array.isArray(w.pages)||!w.pages.length)throw Error('No page index');return w}catch(e){if(controller.signal.aborted||attempt>=2)throw e;await new Promise(r=>setTimeout(r,700*(attempt+1)))}}})().then(w=>{if(controller.signal.aborted)return;rememberWork(hit.path,w);setWork({...w,path:hit.path})}).catch(()=>{if(!controller.signal.aborted)setWorkError(tr('Non se puido consultar o índice de páxinas. Podes seguir lendo esta imaxe. Téntao de novo para recuperar a navegación.','No se pudo consultar el índice de páginas. Puedes seguir leyendo esta imagen. Reintenta para recuperar la navegación.'))});return()=>controller.abort()},[hit.path,workRetry]);
 useEffect(()=>{setZoom(1);setSelected(0);setPage(undefined);if(displayed)setNatural([displayed.width,displayed.height]);viewport.current?.scrollTo(0,0);void store.rememberReading(hit).catch(e=>setError(errorText(e)))},[hit.path,hit.position]);
 // Only a search needs the words of the page; the text itself is asked for when it is opened.
 useEffect(()=>{setPageError('');if(!applied.trim()||noText||pdfOnly){setPage({...NO_MARKS,identity:pageContext});setLoading(false);return}const controller=new AbortController();setLoading(true);void loadMarks(hit.path,hit.position,imageId,applied,controller.signal).then(p=>{if(!controller.signal.aborted){setPage({...p,identity:pageContext});setSelected(0)}}).catch(()=>{if(!controller.signal.aborted)setPageError(tr('Non se puido consultar o texto nin as posicións desta páxina. A imaxe segue dispoñible; podes tentar de novo a consulta.','No se pudo consultar el texto ni las posiciones de esta página. La imagen sigue disponible; puedes reintentar la consulta.'))}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[pageContext]);
 const [ocr,setOcr]=useState<{identity:string;text?:string;failed?:boolean}>(),[ocrRetry,setOcrRetry]=useState(0);
 const ocrIdentity=JSON.stringify([hit.path,hit.position,imageId||'']),ocrNow=ocr?.identity===ocrIdentity?ocr:undefined;
 useEffect(()=>{if(!text)return;if(noText){setOcr({identity:ocrIdentity,text:''});return}if(ocrNow&&!ocrNow.failed)return;setOcr(undefined);const controller=new AbortController();loadText(hit.path,hit.position,imageId,controller.signal).then(value=>{if(!controller.signal.aborted)setOcr({identity:ocrIdentity,text:value})}).catch(()=>{if(!controller.signal.aborted)setOcr({identity:ocrIdentity,failed:true})});return()=>controller.abort()},[text,ocrIdentity,ocrRetry,noText]);
 const retryFailed=()=>{if(workError)setWorkRetry(n=>n+1);if(pageError)setMarksRetry(n=>n+1);if(imageError){forgetPage(currentKey);setShown(undefined);setImageRetry(n=>n+1)}};
 // Pages with matches come first from the search results, which already named them:
 // entering downloads nothing but the open page. Reading the rest of the document is the
 // reader's choice, two pages at a time.
 const [matchPages,setMatchPages]=useState<Map<number,number>>(()=>new Map()),[scanRequest,setScanRequest]=useState(0),[scan,setScan]=useState({checked:0,toCheck:0,failed:0});
 useEffect(()=>{setScanRequest(0);setScan({checked:0,toCheck:0,failed:0});setMatchPages(new Map(hintedPages(hit.path,applied,pages).map(p=>[p,0])))},[hit.path,applied]);
 // Once the index is here, each chip moves to where its result's image really is.
 useEffect(()=>{if(!pages.length)return;const fixed=hintedPages(hit.path,applied,pages);if(!fixed.length)return;setMatchPages(m=>{const out=new Map<number,number>(fixed.map(p=>[p,m.get(p)||0]));for(const [k,v] of m)if(v>0)out.set(k,v);return out})},[pages.length]);
 useEffect(()=>{
  if(!scanRequest||!applied.trim()||!pages.length)return;
  const controller=new AbortController(),order=scanOrder(hit.position,pages.length);
  let next=0,checked=0,failed=0;setScan({checked:0,toCheck:order.length,failed:0});
  const worker=async()=>{while(next<order.length&&!controller.signal.aborted){const pos=order[next++],id=pages.find((p:any)=>p.position===pos)?.imageId;
   try{const r=await countInText(hit.path,pos,id,applied,controller.signal);if(controller.signal.aborted)return;if(r>0)setMatchPages(m=>new Map(m).set(pos,r))}catch{if(controller.signal.aborted)return;failed++}
   checked++;setScan({checked,toCheck:order.length,failed})}};
  void Promise.all([worker(),worker()]);return()=>controller.abort()},[scanRequest]);
 const fullHit={...hit,imageId,savedQuery:applied};
 // The page asked for opens on its own; once it is on screen, and after a pause for its
 // marks, its two neighbours are read ahead, first the one in the reading direction.
 // A jump stops what was being read ahead for the page left behind: nothing new starts for it.
 useEffect(()=>{if(!displayed||!pages.length)return;let left=false;const timer=setTimeout(()=>{void(async()=>{for(const step of [readingDirection,-readingDirection]){if(left)return;const p=pages.find((x:any)=>x.position===hit.position+step);if(p)try{await loadPage(hit.path,p.position,p.imageId)}catch{/* read ahead is a bonus */}if(!left&&p&&step===readingDirection&&applied.trim()&&!noText)try{await loadMarks(hit.path,p.position,p.imageId,applied)}catch{/* idem */}}})()},800);return()=>{left=true;clearTimeout(timer)}},[displayed?.url,pages.length,applied,noText]);
 // Turning a page is one continuous movement: the page follows the finger, and on release
 // it carries on out while the next one comes in attached to it, even if it is still loading.
 const reduceMotion=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 // While the finger is down the page moves by direct style writes, never by a re-render.
 const [dragSide,setDragSide]=useState(0),dragSideRef=useRef(0),dragRef=useRef(0),peek=useRef<HTMLDivElement|null>(null),swiping=useRef(false),swipeBase=useRef(0);
 const [turn,setTurn]=useState<{id:number;dir:number;from:number;page:PageImage;width:number;velocity:number}|null>(null),turnId=useRef(0),leavingPage=useRef<HTMLDivElement>(null),track=useRef<{x:number;t:number}[]>([]);
 const setDragX=(x:number)=>{dragRef.current=x;const side=x?(x<0?1:-1):0;if(viewport.current)viewport.current.style.transform=x?`translateX(${x}px)`:'';if(peek.current&&side)peek.current.style.transform=`translateX(${x+side*viewportSize[0]}px)`;if(dragSideRef.current!==side){dragSideRef.current=side;setDragSide(side)}};
 /** Stops a spring-back where it is and returns that offset, so a finger can take over from there. */
 const catchPage=()=>{const el=viewport.current;if(!el)return 0;const live=new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
  el.getAnimations().forEach(a=>{if(!(a instanceof CSSAnimation)&&!(a instanceof CSSTransition))a.cancel()});peek.current?.getAnimations().forEach(a=>a.cancel());el.style.transform=live?`translateX(${live}px)`:'';return live};
 const canTurn=(step:number)=>index>=0&&!!pages[index+step];
 const pageWidth=(w:number,h:number)=>viewportSize[0]?Math.min(viewportSize[0],frameHeight*w/Math.max(1,h)):0;
 useLayoutEffect(()=>{const el=viewport.current,old=leavingPage.current;if(!turn||!el||!old)return;
  const {values,duration}=springFrames(turn.from,-turn.dir*viewportSize[0],turn.velocity,{damping:1,response:.25});
  const outgoing=old.animate(values.map(x=>({transform:`translateX(${x}px)`})),{duration,easing:'linear',fill:'both'});
  const incoming=el.animate(values.map(x=>({transform:`translateX(${x+turn.dir*viewportSize[0]}px)`})),{duration,easing:'linear',fill:'both'});
  incoming.onfinish=()=>setTurn(t=>t?.id===turn.id?null:t);
  return()=>{incoming.cancel();outgoing.cancel()}
 },[turn]);
 function turnTo(target:number|undefined,from=0,velocity=0){
  if(target===undefined||target===hit.position)return;
  const p=pages.find((x:any)=>x.position===target);if(!p)return;
  const dir=target>hit.position?1:-1,live=catchPage();setReadingDirection(dir);
  if(reduceMotion||keyboardInput()||!displayed||zoomLive.current>1.02){setTurn(null);setDragX(0);change(target);return}
  // A turn can be interrupted: the next one starts from where the arriving page is right now.
  setTurn({id:++turnId.current,dir,from:turn?live:from,page:displayed,width:pageWidth(displayed.width,displayed.height),velocity});setDragX(0);change(target);
 }const matches=page?.alto?.matches||[],count=matches.length;const saved=snapshot?.hits.some(h=>keyOf(h)===keyOf(hit)),inFolders=!!snapshot?.folderMap[keyOf(hit)]?.length,savedNote=!!(snapshot?.hits.find(h=>keyOf(h)===keyOf(hit)) as any)?.note;const index=pages.findIndex((p:any)=>p.position===hit.position);
 function change(position:number){const p=pages.find((p:any)=>p.position===position);if(p)onChange({...hit,imageId:p.imageId,position,savedQuery:applied})}
 // ViewerGeometry.focusPageMatch: same fit/zoom rule; browser scroll limits constrain offsets.
 function goMatch(forward:boolean){const keys=[...matchPages.keys()],others=keys.filter(p=>p!==hit.position),atEnd=forward?selected>=count-1:selected<=0;
  if((!count||atEnd)&&others.length){const target=adjacentMatchPage(keys,hit.position,forward);if(target!==undefined){change(target);return}}
  focusMatch(forward?selected+1:selected-1)}
 function focusMatch(n:number){if(!count)return;const next=(n+count)%count;setSelected(next);const box=matches[next].boxes[0],area=viewport.current,size=page?.alto.pageSize;if(!box||!area||!size||natural[0]<=1)return;const fit=Math.min(area.clientWidth/natural[0],area.clientHeight/natural[1]),widthAtFit=box.width*natural[0]*fit/Math.max(1,size[0]);const targetZoom=Math.min(8,Math.max(zoom,Math.max(2,Math.min(5,area.clientWidth*.65/Math.max(1,widthAtFit)))));setZoom(targetZoom);requestAnimationFrame(()=>{const element=area.querySelector<HTMLElement>('.facsimile');if(!element)return;const scale=element.offsetWidth/size[0];area.scrollTo({left:element.offsetLeft+(box.left+box.width/2)*scale-area.clientWidth/2,top:element.offsetTop+(box.top+box.height/2)*scale-area.clientHeight/2,behavior:'auto'})})}
 // OCR arriving or changing never takes control of the reader's zoom/position.
 function applyZoom(value:number,anchor:{x:number;y:number},point:{x:number;y:number},commit=true){
  const area=viewport.current,element=area?.querySelector<HTMLElement>('.facsimile');if(!area||!element||!fitWidth)return;
  const next=clampZoom(value),width=fitWidth*next,height=width*natural[1]/natural[0];
  // Apply size and scroll together, before paint; React retains the same width on render.
  element.style.width=`${width}px`;
  const scroll=anchoredScroll(anchor,point,{width:area.clientWidth,height:area.clientHeight},{width,height});
  area.scrollTo(scroll.x,scroll.y);zoomLive.current=next;if(commit)setZoom(next);
 }
 function zoomTo(value:number,client?:{x:number;y:number}){
  const area=viewport.current,element=area?.querySelector<HTMLElement>('.facsimile');if(!area||!element)return;
  const rect=area.getBoundingClientRect(),image=element.getBoundingClientRect();
  const point=client?{x:client.x-rect.left,y:client.y-rect.top}:{x:area.clientWidth/2,y:area.clientHeight/2};
  applyZoom(value,imageAnchor({x:rect.left+point.x,y:rect.top+point.y},image),point);
 }
 function startGesture(area:HTMLDivElement){
  const values=[...pointers.current.values()],first=values[0];if(!first)return;
  const previous=gesture.current,element=area.querySelector<HTMLElement>('.facsimile');
  if(values.length>=2&&(swiping.current||turn)){swiping.current=false;catchPage();setTurn(null);setDragX(0)}
  const midpoint=values.length>=2?{x:(values[0].x+values[1].x)/2,y:(values[0].y+values[1].y)/2}:first;
  gesture.current={x:first.x,y:first.y,left:area.scrollLeft,top:area.scrollTop,zoom:clampZoom(element&&fitWidth?element.offsetWidth/fitWidth:zoom),distance:values.length>=2?Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y):undefined,anchor:element?imageAnchor(midpoint,element.getBoundingClientRect()):undefined,moved:values.length>=2||previous.moved,multi:values.length>=2||previous.multi};
 }
 function settlePage(velocity:number){
  if(reduceMotion){setDragX(0);return}
  const el=viewport.current,from=dragRef.current,other=peek.current,offset=dragSideRef.current*viewportSize[0];
  if(!el||!from){setDragX(0);return}
  const {values,duration}=springFrames(from,0,velocity);
  const animation=el.animate(values.map(x=>({transform:`translateX(${x}px)`})),{duration,easing:'linear',fill:'both'});
  const neighbour=other?.animate(values.map(x=>({transform:`translateX(${x+offset}px)`})),{duration,easing:'linear',fill:'both'});
  animation.onfinish=()=>{setDragX(0);animation.cancel();neighbour?.cancel()};
 }
 function endPointer(area:HTMLDivElement,id:number,cancelled=false){
  const g=gesture.current,point=pointers.current.get(id);if(!point)return;
  // Android ViewerScreen: a turn needs a fifth of the width and a mostly horizontal drag.
  // A quick flick turns too: what counts is where its momentum would carry the page (Apple).
  const dx=point.x-g.x,dy=point.y-g.y,now=performance.now(),samples=track.current.filter(p=>now-p.t<100)/* a finger that stopped before lifting throws nothing */,a=samples[0],b=samples[samples.length-1],vx=a&&b&&b.t>a.t?(b.x-a.x)/(b.t-a.t):0,thrown=dx+project(vx);track.current=[];
  const side=dx<0?1:-1,turns=!cancelled&&Math.abs(dx)>Math.abs(dy)*1.5&&canTurn(side)&&(Math.abs(dx)>area.clientWidth*.22||(Math.sign(thrown)===Math.sign(dx)&&Math.abs(thrown)>area.clientWidth/2));
  if(swiping.current&&pointers.current.size===1){swiping.current=false;pointers.current.delete(id);gesture.current={x:0,y:0,left:0,top:0,zoom:1};
   if(turns)turnTo(pages[index+side]?.position,dragRef.current,vx);else settlePage(vx);return}
  // Zoomed in but already at that side's edge: the drag turns the page, as in Android.
  if(turns&&pointers.current.size===1&&!g.multi&&zoomLive.current>1.02&&Math.abs(area.scrollLeft-g.left)<2){pointers.current.delete(id);gesture.current={x:0,y:0,left:0,top:0,zoom:1};void turnTo(pages[index+side]?.position);return}
  if(pointers.current.size===1&&dragRef.current&&!turn)settlePage(0);
  if(!cancelled&&pointers.current.size===1&&!g.moved&&Math.hypot(point.x-g.x,point.y-g.y)<6){clearTimeout(tapTimer.current);tapTimer.current=setTimeout(()=>onQuiet(!quiet),300)}
  pointers.current.delete(id);
  // The pinch settles into state once, when it ends.
  if(pointers.current.size<2&&zoomLive.current!==zoom)setZoom(zoomLive.current);
  if(pointers.current.size)startGesture(area);else gesture.current={x:0,y:0,left:0,top:0,zoom:1};
 }
 const [undo,setUndo]=useState(false);
 // ViewerScreen.toggleFavorite: saving is one act and filing stays one tap away in the
 // snackbar («Páxina gardada · Organizar»); removing is one tap and reversible («Desfacer»).
 async function toggleSaved(fromSheet=false){
  if(saving)return;setSaving(true);setSaveError('');
  try{const added=await store.toggleSaved(fullHit);
   if(added){if(fromSheet)setActions(false);notify(tr('Páxina gardada','Página guardada'),{organize:true})}else notify(tr('Páxina quitada de Gardados','Página quitada de Guardados'),{undo:true})
  }catch(e){if(fromSheet)setSaveError(errorText(e));else setError(errorText(e))}finally{setSaving(false)}}
 function notify(text:string,options:{undo?:boolean;organize?:boolean}={}){setMessage(text);setUndo(!!options.undo);setOffer(!!options.organize);setSnackId(n=>n+1)}
 async function runDownload(kind:'JPEG'|'PDF'){setBusy(true);setError('');setMessage(tr(`Gardando a páxina ${hit.position}…`,`Guardando página ${hit.position}…`));setUndo(false);setOffer(false);setRetryDownload(undefined);setSnackId(n=>n+1);try{if(kind==='JPEG')await jpegDownload(fullHit);else await pdfDownload([fullHit]);notify(tr(`Páxina ${hit.position} gardada nas descargas do navegador`,`Página ${hit.position} guardada en las descargas del navegador`))}catch(e){notify(tr(`Non se puido descargar a páxina. ${errorText(e)}`,`No se pudo descargar la página. ${errorText(e)}`));setRetryDownload(kind)}finally{setBusy(false)}}
 const searchStatus=!applied||loading||count||!page?null:noText?tr('Esta páxina non ten texto recoñecido dispoñible.','Esta página no tiene texto reconocido disponible.'):page?.alto.status==='UNAVAILABLE'?tr('Non se puideron consultar as posicións das palabras. Podes tentalo de novo ou ler o texto.','No se pudieron consultar las posiciones de las palabras. Puedes reintentar o leer el texto.'):page?.alto.status==='INVALID'?tr('As posicións desta páxina non permiten un marcado fiable. Podes consultar o texto.','Las posiciones de esta página no permiten un marcado fiable. Puedes consultar el texto.'):page?.ocrFailed?tr('Non se puido consultar o texto desta páxina. Podes tentalo de novo.','No se pudo consultar el texto de esta página. Puedes reintentar.'):page?.matchCount?tr('Hai coincidencias no texto, pero non se localizaron sobre a imaxe. O texto e as súas posicións poden diferir.','Hay coincidencias en el texto, pero no se han localizado sobre la imagen. El texto y sus posiciones pueden diferir.'):page?.alto.status==='EMPTY'?tr('Esta páxina non ten palabras con posicións dispoñibles.','Esta página no tiene palabras con posiciones disponibles.'):[...matchPages.keys()].some(p=>p!==hit.position)?tr('Toca unha páxina ou usa as frechas.','Toca una página o usa las flechas.'):tr('Non se atopou esa expresión nesta páxina. Proba outra palabra ou revisa o texto.','No se encontró esa expresión en esta página. Prueba otra palabra o revisa el texto.');
 const actionIcon=(name:string,filled=true)=><MaterialIcon name={name} filled={filled}/>;
 // Pinch zoom is the phone's way, as in Android; only a mouse gets the zoom buttons.
 const fineMouse=typeof matchMedia!=='undefined'&&matchMedia('(pointer: fine)').matches;
 const wanted=Number(goText),goValid=!!goText&&Number.isInteger(wanted)&&wanted>=1&&wanted<=pages.length;
 return <div className={'viewer native-viewer '+(quiet?'quiet':'')} style={{'--frame-pad':`${framePad}px`,'--frame-bottom':`${frameBottom}px`} as React.CSSProperties}>
 <div className="viewer-viewport" ref={viewport} tabIndex={0} role="group" aria-label={tr('Imaxe dixitalizada. Usa os controis de zoom ou arrastra para desprazarte.','Imagen digitalizada. Usa los controles de zoom o arrastra para desplazarte.')} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onQuiet(!quiet)}if(e.key==='+'){e.preventDefault();zoomTo(zoom*1.3)}if(e.key==='-'){e.preventDefault();zoomTo(zoom/1.3)}}} onWheel={e=>{if(e.ctrlKey){e.preventDefault();zoomTo(zoom*Math.exp(-e.deltaY*.01),{x:e.clientX,y:e.clientY})}}} onPointerDown={e=>{clearTimeout(tapTimer.current);const area=e.currentTarget;area.setPointerCapture(e.pointerId);if(!pointers.current.size){track.current=[{x:e.clientX,t:performance.now()}];if(!turn&&dragRef.current)setDragX(catchPage())}pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});startGesture(area)}} onPointerMove={e=>{
  if(!pointers.current.has(e.pointerId))return;
  pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const values=[...pointers.current.values()],g=gesture.current,area=e.currentTarget;
  if(values.length>=2&&g.distance&&g.anchor){
   const rect=area.getBoundingClientRect(),distance=Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y);
   applyZoom(g.zoom*distance/g.distance,g.anchor,{x:(values[0].x+values[1].x)/2-rect.left,y:(values[0].y+values[1].y)/2-rect.top},false);
  }else if(values.length===1){const dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.hypot(dx,dy)>=6)g.moved=true;
   if(zoomLive.current<=1.02&&(swiping.current||(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)))){if(!swiping.current){swipeBase.current=catchPage();setTurn(null)}swiping.current=true;const now=performance.now();track.current=[...track.current.filter(p=>now-p.t<100),{x:e.clientX,t:now}];const side=dx<0?1:-1,x=swipeBase.current+(canTurn(side)?dx:Math.sign(dx)*rubberband(Math.abs(dx),area.clientWidth));
   // The finger produces this motion, so it follows even with reduced motion; only the release is instant.
   setDragX(x);return}
   area.scrollLeft=g.left-dx;area.scrollTop=g.top-dy}
 }} onPointerUp={e=>endPointer(e.currentTarget,e.pointerId)} onPointerCancel={e=>endPointer(e.currentTarget,e.pointerId,true)} onLostPointerCapture={e=>endPointer(e.currentTarget,e.pointerId,true)} onDoubleClick={e=>{clearTimeout(tapTimer.current);zoomTo(zoom>1?1:2.5,{x:e.clientX,y:e.clientY})}}><div className="facsimile-stage"><div className="facsimile" role="img" aria-label={tr(`Páxina ${hit.position} de ${hit.title}`,`Página ${hit.position} de ${hit.title}`)} aria-busy={!imgReady} style={{width:fitWidth?`${fitWidth*zoom}px`:`${zoom*100}%`,aspectRatio:natural[0]>1?`${natural[0]}/${natural[1]}`:'1/1.45'}}>{imageSource&&<img ref={imgRef} src={imageSource} alt="" className={imgReady?'ready':''} draggable={false} onLoad={e=>{const img=e.currentTarget;setImageError('');setNatural([img.naturalWidth,img.naturalHeight]);setReadySrc(img.getAttribute('src')||'')}} onError={()=>setImageError(tr('Non se puido abrir a páxina. Comproba a conexión e téntao de novo.','No se pudo abrir la página. Comprueba la conexión y vuelve a intentarlo.'))}/>}{!imgReady&&!imageError&&!pdfOnly&&<div className="page-skeleton" aria-hidden="true"/>}{imgReady&&marks&&count>0&&<svg viewBox={`0 0 ${page!.alto.pageSize[0]} ${page!.alto.pageSize[1]}`} preserveAspectRatio="none" className="ocr-overlay" aria-hidden="true">{matches.map((match,i)=>({match,i})).sort((a,b)=>Number(a.i===selected)-Number(b.i===selected)).flatMap(({match,i})=>match.boxes.map((b,j)=><rect key={`${i}-${j}`} x={b.left} y={b.top} width={b.width} height={b.height} rx={2*page!.alto.pageSize[0]/Math.max(1,fitWidth*zoom)} className={i===selected?'match active':'match'}/>))}{(()=>{const b=matches[selected]?.boxes[0];if(!b)return null;const unit=page!.alto.pageSize[0]/Math.max(1,fitWidth*zoom),r=Math.max(b.width,b.height)/2+10*unit,cx=b.left+b.width/2,cy=b.top+b.height/2;return <g key={`locator-${hit.position}-${selected}`} className="locator" style={{'--grow':`${(r+44*unit)/r}`} as React.CSSProperties}><circle className="locator-pulse" cx={cx} cy={cy} r={r}/>{zoom<1.6&&<circle className="locator-ring" cx={cx} cy={cy} r={r}/>}</g>})()}</svg>}</div></div></div>
 {!turn&&dragSide!==0&&(()=>{const side=dragSide;if(!canTurn(side))return null;const p=pages[index+side],copy=cachedPage(pageKey(hit.path,p.position,p.imageId)),w=copy?pageWidth(copy.width,copy.height):pageWidth(natural[0],natural[1]);
  return <div ref={el=>{peek.current=el;if(el)el.style.transform=`translateX(${dragRef.current+side*viewportSize[0]}px)`}} className="turn-layer" aria-hidden="true">{copy?<img src={copy.url} alt="" style={{width:w}}/>:<div className="blank-sheet" style={{width:w,aspectRatio:`${natural[0]}/${natural[1]}`}}><div className="page-skeleton"/></div>}</div>})()}
 {turn&&<div ref={leavingPage} className="turn-layer" aria-hidden="true"><img src={turn.page.url} alt="" style={{width:turn.width}}/></div>}
 <div className="viewer-top">
 <header className="viewer-header" ref={headerRef}><button className="icon-button" onClick={onBack} aria-label={tr('Volver','Volver')}>{actionIcon('arrow_back')}</button><div className="viewer-heading"><h1 className="viewer-title"><strong title={hit.title}>{hit.title||'Documento'}</strong></h1><span>{pdfOnly?tr('Documento PDF','Documento PDF'):<>{tr('Páxina','Página')} {hit.position}{pages.length?` de ${pages.length}`:''}</>}{saved?(savedNote?tr(' · Gardada con nota',' · Guardada con nota'):tr(' · Gardada',' · Guardada')):''}</span></div><button className="icon-button viewer-vieira" disabled={saving} onClick={()=>void toggleSaved()} aria-pressed={!!saved} aria-label={saved?tr('Quitar de Gardados','Quitar de Guardados'):tr('Gardar páxina','Guardar página')}><ShellIcon size={24} selected={!!saved}/></button>{!pdfOnly&&!applied&&<button className="icon-button" onClick={()=>setSearching(!searching)} aria-expanded={searching} aria-label={searching?tr('Pregar a busca na páxina','Plegar búsqueda en la página'):tr('Buscar na páxina','Buscar en la página')}>{actionIcon('search')}</button>}<button className="icon-button" onClick={()=>setActions(true)} aria-label={tr('Accións desta páxina','Acciones de esta página')}>{actionIcon('more_vert')}</button></header>
 {searching&&<div className="viewer-search" onKeyDown={e=>{if(e.key==='Escape'&&!e.nativeEvent.isComposing){e.preventDefault();setSearching(false);requestAnimationFrame(()=>(headerRef.current?.querySelector<HTMLElement>('[aria-expanded]')??bottomRef.current?.querySelector<HTMLElement>('.match-query'))?.focus())}}}><form className="viewer-query-form" onSubmit={e=>{e.preventDefault();if(query.trim()){setApplied(query);setSearching(false);setMarks(true);void store.rememberReading({...hit,savedQuery:query})}}}><div className="viewer-query-field"><input autoFocus className="field" enterKeyHint="search" autoComplete="off" spellCheck={false} aria-label={tr('Buscar nesta páxina','Buscar en esta página')} placeholder={tr('Buscar nesta páxina','Buscar en esta página')} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" className="icon-button" onClick={()=>setQuery('')} aria-label={tr('Borrar o texto de busca','Borrar texto de búsqueda')}>{actionIcon('close')}</button>}</div><button className="button tonal" type="submit" disabled={!query.trim()||loading}>{tr('Buscar','Buscar')}</button></form>{applied&&<button type="button" className="text-button" onClick={()=>{setApplied('');setQuery('');setSearching(false);setSelected(0)}}>{tr('Quitar busca e marcas','Quitar búsqueda y marcas')}</button>}</div>}
 <Status error={workError||pageError||imageError} retry={retryFailed}/><Status error={error}/>{(loading||!imgReady)&&!imageError&&!pdfOnly&&<div className="m3-linear-progress viewer-progress" role="progressbar" aria-label={tr('Cargando a páxina','Cargando la página')}/>}</div>
 {pdfOnly&&<PdfOnly path={hit.path} imageId={pages[0]?.imageId} title={hit.title}/>}
 {quiet&&<button className="restore-controls" onClick={()=>onQuiet(false)} aria-label={tr('Mostrar controis de lectura','Mostrar controles de lectura')}>{actionIcon('fullscreen_exit')}</button>}
 <div className="viewer-bottom" ref={bottomRef}>{!searching&&applied&&!pdfOnly&&<><div className="viewer-matchbar"><button className="match-query" onClick={()=>setSearching(true)}>{actionIcon('search',false)}<span>{applied}</span><small aria-live="polite">{/* hitLabel in ViewerScreen.kt; shown short, read in full */count?<><span aria-hidden="true">{`${selected+1} / ${count}`}</span><span className="sr-only">{tr(`${selected+1} de ${count} nesta páxina`,`${selected+1} de ${count} en esta página`)}</span></>:loading?'Localizando…':page?.matchCount?tr(`${page.matchCount} no texto`,`${page.matchCount} en el texto`):[...matchPages.keys()].some(p=>p!==hit.position)?tr('Non está nesta páxina','No está en esta página'):tr('Sen marcas','Sin marcas')}</small><span className="sr-only">{tr('. Editar busca','. Editar búsqueda')}</span></button>{count>0||[...matchPages.keys()].some(p=>p!==hit.position)?<><button className="icon-button" onClick={()=>goMatch(false)} aria-label={tr('Coincidencia anterior','Coincidencia anterior')}>{actionIcon('expand_less')}</button><button className="icon-button" onClick={()=>goMatch(true)} aria-label={tr('Seguinte coincidencia','Siguiente coincidencia')}>{actionIcon('expand_more')}</button></>:!loading&&!noText&&(page?.alto.status==='UNAVAILABLE'||page?.ocrFailed||pageError)?<button className="text-button" onClick={()=>setMarksRetry(n=>n+1)}>{tr('Reintentar','Reintentar')}</button>:null}</div>{searchStatus&&<p className="viewer-search-status">{searchStatus}</p>}</>}{!searching&&!pdfOnly&&<footer className="viewer-footer"><button className="icon-button" onClick={()=>void turnTo(pages[index-1]?.position)} disabled={index<=0} aria-label={tr('Anterior','Anterior')}>{actionIcon('chevron_left')}</button>{applied&&!noText&&<MatchPagesRow pages={matchPages} current={hit.position} scanned={scanRequest>0} state={scan} pageCount={pages.length} onOpen={p=>void turnTo(p)} onScanAll={()=>setScanRequest(n=>n+1)}/>}<button type="button" className="text-button viewer-page-count" disabled={pages.length<=1} onClick={()=>{setGoText('');setGoTo(true)}} aria-label={tr(`${hit.position} / ${pages.length||'…'}, ir á páxina`,`${hit.position} / ${pages.length||'…'}, ir a la página`)}>{`${hit.position} / ${pages.length||'…'}`}</button><button className="icon-button" disabled={index<0||index>=pages.length-1} onClick={()=>void turnTo(pages[index+1]?.position)} aria-label={tr('Seguinte','Siguiente')}>{actionIcon('chevron_right')}</button></footer>}</div>
 {actions&&<BottomSheet label={tr(`Páxina ${hit.position}`,`Página ${hit.position}`)} onClose={()=>setActions(false)}>{()=><div className="viewer-actions"><h2 className="viewer-actions-title">{tr(`Páxina ${hit.position}`,`Página ${hit.position}`)}</h2><p className="viewer-action-publication">{hit.title||'Documento'}</p><Status error={saveError}/><div className="viewer-action-tiles"><button type="button" className={'viewer-action-tile'+(saved?' on':'')} disabled={saving} onClick={()=>void toggleSaved(true)} aria-label={saving?tr('Gardando…','Guardando…'):saved?tr('Páxina gardada. Toca para quitala de Gardados','Página guardada. Toca para quitarla de favoritos'):tr('Gardar páxina','Guardar página')}><ShellIcon size={24} selected={!!saved}/><span>{saved?tr('Gardada','Guardada'):tr('Gardar','Guardar')}</span></button><button type="button" className="viewer-action-tile" onClick={()=>{setActions(false);setNote(true)}} aria-label={tr('Nota de referencia','Nota de referencia')}>{actionIcon('edit',false)}<span>{tr('Nota','Nota')}</span></button><button type="button" className={'viewer-action-tile'+(inFolders?' on':'')} onClick={()=>{setActions(false);setFolders(true)}} aria-label={tr('Organizar en cartafoles','Organizar en carpetas')}>{actionIcon('folder',false)}<span>{tr('Cartafol','Carpeta')}</span></button>{pdfOnly?<a className="viewer-action-tile" href={pdfUrl(pages[0]?.imageId,hit.path)} target="_blank" rel="noopener noreferrer" aria-label={tr('Abrir o PDF en Galiciana','Abrir el PDF en Galiciana')}>{actionIcon('download')}<span>PDF</span></a>:<button type="button" className="viewer-action-tile" onClick={()=>{setActions(false);setDownload(true)}} aria-label={tr('Descargar páxina','Descargar página')}>{actionIcon('download')}<span>{tr('Descargar','Descargar')}</span></button>}</div>{typeof navigator.share==='function'&&<button className="destination" onClick={()=>{setActions(false);void navigator.share({title:`${hit.title}, páx. ${hit.position}`,text:tr(`En Galiciana: ${original(fullHit)}`,`En Galiciana: ${original(fullHit)}`),url:appLink()}).catch(()=>{/* closed without sharing */})}}><span className="viewer-action-icon">{actionIcon('share')}</span><span><strong>{tr('Compartir páxina','Compartir página')}</strong><small>{tr('Ábrese en GdPeto; leva tamén a ligazón de Galiciana','Se abre en GdPeto; lleva también el enlace de Galiciana')}</small></span></button>}<h3>{tr('Lectura','Lectura')}</h3>{!pdfOnly&&<button className="destination" onClick={()=>{setActions(false);setText(true)}}><span className="viewer-action-icon">{actionIcon('text_snippet')}</span><span><strong>{tr('Ler e copiar texto','Leer y copiar texto')}</strong><small>{noText?tr('Esta obra non ten texto recoñecido','Esta obra no tiene texto reconocido'):tr('Texto recoñecido desta páxina','Texto reconocido de esta página')}</small></span></button>}{count>0&&<label className="destination viewer-switch-row"><span className="viewer-action-icon">{actionIcon('visibility_off')}</span><span><strong>{tr('Ocultar as marcas','Ocultar las marcas')}</strong><small>{tr('Conserva a busca mentres les o orixinal','Conserva la búsqueda mientras lees el original')}</small></span><input type="checkbox" role="switch" className="m3-switch" checked={!marks} onChange={e=>setMarks(!e.target.checked)}/></label>}<button className="destination" onClick={()=>setInfo(!info)} aria-expanded={info}><span className="viewer-action-icon">{actionIcon('info')}</span><span><strong>{tr('Datos da publicación','Datos de la publicación')}</strong><small>{info?tr('Ocultar información','Ocultar información'):tr('Título, páxina e fonte','Título, página y fuente')}</small></span></button><div className={'viewer-bibliography-wrap'+(info?' open':'')}><div><div className="viewer-bibliography"><p>{hit.title||tr('Título non dispoñible','Título no disponible')}</p><p>{tr(`Páxina ${hit.position}`,`Página ${hit.position}`)}{(()=>{const label=pages.find((p:any)=>p.position===hit.position)?.label;return label&&!/^P[áa][gx]\.?\s*\d+$/.test(label.trim())?` · ${label}`:''})()}</p><p>{tr('Fonte: Galiciana · Biblioteca Dixital de Galicia','Fuente: Galiciana · Biblioteca Dixital de Galicia')}</p></div></div></div><a className="destination" href={original(fullHit)} target="_blank" rel="noopener noreferrer"><span className="viewer-action-icon">{actionIcon('open_in_new')}</span><span><strong>{tr('Abrir orixinal en Galiciana','Abrir original en Galiciana')}</strong><small>{tr('Ábrese no navegador','Se abre en el navegador')}</small></span></a><button className="destination" onClick={()=>{setActions(false);onHome()}}><span className="viewer-action-icon">{actionIcon('home')}</span><span><strong>{tr('Volver ao inicio','Volver al inicio')}</strong></span></button>{fineMouse&&!pdfOnly&&<details className="viewer-browser-controls"><summary>{tr('Controis de ampliación','Controles de ampliación')}</summary><div className="row"><button className="icon-button" onClick={()=>zoomTo(zoom/1.3)} disabled={zoom<=1} aria-label={tr('Afastar','Alejar')}>{actionIcon('zoom_out')}</button><button className="text-button" onClick={()=>zoomTo(1)}>{tr('Axustar','Ajustar')}</button><button className="icon-button" onClick={()=>zoomTo(zoom*1.3)} disabled={zoom>=8} aria-label={tr('Achegar','Acercar')}>{actionIcon('zoom_in')}</button><span>{Math.round(zoom*100)} %</span></div><button className="text-button" onClick={()=>{setActions(false);onQuiet(true)}}>{tr('Lectura sen controis','Lectura sin controles')}</button><label>{tr('Ir á páxina','Ir a página')}<select value={hit.position} onChange={e=>{change(+e.target.value);setActions(false)}}>{pages.length?pages.map((p:any)=><option key={p.position} value={p.position}>{p.position} / {pages.length}</option>):<option>{hit.position}</option>}</select></label></details>}</div>}</BottomSheet>}
 {note&&<NoteEditor hit={fullHit} onClose={()=>setNote(false)}/>}{folders&&<FolderSheet hit={fullHit} onClose={()=>setFolders(false)} onConfirmed={async()=>{if(!saved)await store.toggleSaved(fullHit)}}/>}
 {text&&<BottomSheet label={tr(`Texto da páxina ${hit.position}`,`Texto de la página ${hit.position}`)} onClose={()=>setText(false)} tall>{close=><div className="viewer-text-sheet"><div className="viewer-text-head"><div><h2>{tr(`Texto da páxina ${hit.position}`,`Texto de la página ${hit.position}`)}</h2><p>{hit.title||'Documento'}</p></div><button type="button" className="icon-button" aria-label={tr('Pechar texto','Cerrar texto')} onClick={close}><MaterialIcon name="close"/></button></div><hr/>{!ocrNow?<><div className="m3-linear-progress"/><p className="viewer-text-status">{tr('Cargando o texto…','Cargando texto…')}</p></>:ocrNow.failed?<><p className="viewer-text-status" role="alert">{tr('Non se puido cargar o texto desta páxina. Comproba a conexión e téntao de novo.','No se pudo cargar el texto de esta página. Comprueba la conexión y vuelve a intentarlo.')}</p><button type="button" className="m3-text-button" onClick={()=>setOcrRetry(n=>n+1)}>Reintentar</button></>:<p className="ocr-text" lang={ocrNow.text?'':undefined}>{ocrNow.text||tr('Esta páxina non ten texto recoñecido dispoñible.','Esta página no tiene texto reconocido disponible.')}</p>}</div>}</BottomSheet>}
 {download&&<AlertDialog title={tr(`Descargar a páxina ${hit.position}`,`Descargar página ${hit.position}`)} text={tr('Elixe JPEG ou PDF para esta páxina. O PDF inclúe o texto OCR dispoñible para buscar ou copiar; a súa selección non segue a posición das palabras na imaxe.','Elige JPEG o PDF para esta página. El PDF incluye el texto OCR disponible para buscar o copiar; su selección no sigue la posición de las palabras en la imagen.')} confirm="PDF" onConfirm={()=>{setDownload(false);void runDownload('PDF')}} onCancel={()=>setDownload(false)} extra={<button type="button" className="m3-text-button" disabled={!imageId} onClick={()=>{setDownload(false);void runDownload('JPEG')}}>JPEG</button>}/>}
 {goTo&&<AlertDialog title={tr('Ir á páxina','Ir a la página')} confirm="Ir" confirmDisabled={!goValid} onConfirm={()=>{if(goValid){setGoTo(false);void turnTo(wanted)}}} onCancel={()=>setGoTo(false)}><label className={'m3-outlined-field'+(goText&&!goValid?' error':'')}><span>{tr(`Número de páxina (1–${pages.length})`,`Número de página (1–${pages.length})`)}</span><input inputMode="numeric" enterKeyHint="go" autoComplete="off" value={goText} onChange={e=>setGoText(e.target.value.replace(/\D/g,'').slice(0,5))} onKeyDown={e=>{if(e.key==='Enter'&&goValid){setGoTo(false);void turnTo(wanted)}}}/></label></AlertDialog>}
 {message&&<Snackbar key={snackId} message={message} long={undo} action={undo?tr('Desfacer','Deshacer'):offer?'Organizar':retryDownload?'Reintentar':undefined} indefinite={busy} onAction={()=>{if(undo)void store.toggleSaved(fullHit).catch(e=>setError(errorText(e)));else if(offer)setFolders(true);else if(retryDownload)void runDownload(retryDownload)}} onDismiss={()=>{setMessage('');setUndo(false);setOffer(false);setRetryDownload(undefined)}} bottom={quiet?0:(bottomRef.current?.offsetHeight??0)}/>}
 </div>
}
function MatchPagesRow({pages,current,scanned,state,pageCount,onOpen,onScanAll}:{pages:Map<number,number>;current:number;scanned:boolean;state:{checked:number;toCheck:number;failed:number};pageCount:number;onOpen:(page:number)=>void;onScanAll:()=>void}){
 const scanning=scanned&&state.checked<state.toCheck,keys=[...pages.keys()].sort((a,b)=>a-b),onlyHere=keys.every(k=>k===current);
 return <div className="match-pages" role="group" aria-label={tr('Páxinas con coincidencias','Páginas con coincidencias')}>
  {keys.length>0&&onlyHere&&!scanning?<span className="match-pages-note">{scanned?tr('Só nesta páxina','Solo en esta página'):tr('Nos resultados, só esta páxina','En los resultados, solo esta página')}</span>
  :keys.length===0?<span className="match-pages-note">{scanning?tr(`Buscando noutras páxinas… ${state.checked} de ${state.toCheck}`,`Buscando en otras páginas… ${state.checked} de ${state.toCheck}`):!scanned?tr('Outras páxinas sen revisar','Otras páginas sin revisar'):state.failed===state.toCheck?tr('Non se puideron revisar as outras páxinas','No se pudieron revisar las otras páginas'):tr('Non aparece no texto doutras páxinas','No aparece en el texto de otras páginas')}</span>
  :<><span className="match-pages-note">{tr('Páxinas','Páginas')}</span>{keys.map(p=>{const n=pages.get(p)||0,here=p===current;return <button key={p} type="button" className={'match-page-chip'+(here?' selected':'')} aria-current={here?'page':undefined}
    aria-label={n===0?tr(`Páxina ${p}`,`Página ${p}`):n===1?tr(`Páxina ${p}, 1 coincidencia`,`Página ${p}, 1 coincidencia`):tr(`Páxina ${p}, ${n} coincidencias`,`Página ${p}, ${n} coincidencias`)} onClick={()=>{if(!here)onOpen(p)}}>{p}</button>})}</>}
  {scanning&&keys.length>0&&<span className="match-pages-note">{state.checked} / {state.toCheck}</span>}
  {!scanned&&pageCount>1&&<button type="button" className="text-button" onClick={onScanAll}>{tr('Revisar todo o documento','Revisar todo el documento')}</button>}
  {scanned&&!scanning&&state.failed>0&&<button type="button" className="text-button" onClick={onScanAll}>{state.failed===1?tr('1 sen revisar · Reintentar','1 sin revisar · Reintentar'):tr(`${state.failed} sen revisar · Reintentar`,`${state.failed} sin revisar · Reintentar`)}</button>}
  {scanned&&!scanning&&state.failed===0&&state.toCheck<pageCount-1&&<span className="match-pages-note">{tr(`· revisadas ${state.toCheck+1} de ${pageCount}`,`· revisadas ${state.toCheck+1} de ${pageCount}`)}</span>}
 </div>;
}
const pdfUrl=(imageId:string|undefined,path:string)=>imageId?`${BASE}/es/catalogo_imagenes/imagen_id.do?idImagen=${imageId}`:`${BASE}/es/catalogo_imagenes/grupo.do?path=${path}`;
/** Galiciana keeps this copy as a single PDF: it is read there, and the app says so plainly. */
function PdfOnly({path,imageId,title}:{path:string;imageId?:string;title:string}){
 const [cover,setCover]=useState(true);
 return <section className="pdf-only" aria-label={tr('Documento PDF','Documento PDF')}>
  {imageId&&cover&&<img src={proxy(`${BASE}/es/media/object-miniature.do?id=${imageId}`)} loading="lazy" decoding="async" alt={tr(`Miniatura de ${title}`,`Miniatura de ${title}`)} referrerPolicy="no-referrer" onError={()=>setCover(false)}/>}
  <h2>{tr('Esta copia é un só PDF','Esta copia es un solo PDF')}</h2>
  <p>{tr('Galiciana non a ofrece páxina a páxina, así que non se pode ler nin marcar aquí. Ábrese no navegador e pode pesar varios megas.','Galiciana no la ofrece página a página, así que no se puede leer ni marcar aquí. Se abre en el navegador y puede pesar varios megas.')}</p>
  <a className="m3-filled-button" href={pdfUrl(imageId,path)} target="_blank" rel="noopener noreferrer">{tr('Abrir o PDF en Galiciana','Abrir el PDF en Galiciana')}<MaterialIcon name="open_in_new" size={18}/></a>
 </section>;
}
