import {tr} from './i18n';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import type React from 'react';
import {ArrowLeft,ArrowRight,ExternalLink,ImageOff,LoaderCircle,X} from 'lucide-react';
import {proxy} from './api';
import {focusables,useFadeOut,useLayer,useScrollLock} from './layers';
export function ShellIcon({size=28,selected=true}:{size?:number;selected?:boolean}){
 const cx=14,cy=28*.46,r=28*.42,dpr=globalThis.devicePixelRatio||1;
 const points=Array.from({length:8},(_,i)=>{const a=Math.PI+i*Math.PI/7;return `${i?'L':'M'}${cx+r*Math.cos(a)},${cy+r*.92*Math.sin(a)}`}).join(' ');
 const outline=`${points} L${28*.72},${28*.78} Q${cx},${28*.98} ${28*.28},${28*.78} Z`;
 const ink=selected?'#12384F':'var(--muted)';
 // Saving (not removing, not drawing a saved list) gives the shell a small grow as confirmation (Emil).
 const svg=useRef<SVGSVGElement>(null),was=useRef(selected);
 useEffect(()=>{if(selected&&!was.current&&svg.current?.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)svg.current.animate([{transform:'scale(.85)'},{transform:'scale(1)'}],{duration:150,easing:'cubic-bezier(.23,1,.32,1)'});was.current=selected},[selected]);
 return <svg ref={svg} className="shell-icon" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true"><path d={outline} fill={selected?'#7EC8E3':'none'} style={{stroke:ink}} strokeWidth={1.6/dpr} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>{Array.from({length:7},(_,i)=>{const a=Math.PI+i*Math.PI/6.2;return <path key={i} d={`M${cx},${28*.78} L${cx+r*.78*Math.cos(a)},${cy+r*.72*Math.sin(a)}`} style={{stroke:ink}} strokeWidth={1.15/dpr} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>})}</svg>
}
/** Material Symbols paths for the few icons the bundled icon font subset lacks. */
const svgIcons:Record<string,string>={
 settings:'M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.09-.16-.26-.25-.44-.25-.06 0-.12.01-.17.03l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.06-.02-.12-.03-.18-.03-.17 0-.34.09-.43.25l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.09.16.26.25.44.25.06 0 .12-.01.17-.03l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.06.02.12.03.18.03.17 0 .34-.09.43-.25l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-1.98-1.71c.04.31.05.52.05.73 0 .21-.02.43-.05.73l-.14 1.13.89.7 1.08.84-.7 1.21-1.27-.51-1.04-.42-.9.68c-.43.32-.84.56-1.25.73l-1.06.43-.16 1.13-.2 1.35h-1.4l-.19-1.35-.16-1.13-1.06-.43c-.43-.18-.83-.41-1.23-.71l-.91-.7-1.06.43-1.27.51-.7-1.21 1.08-.84.89-.7-.14-1.13c-.03-.31-.05-.54-.05-.74s.02-.43.05-.73l.14-1.13-.89-.7-1.08-.84.7-1.21 1.27.51 1.04.42.9-.68c.43-.32.84-.56 1.25-.73l1.06-.43.16-1.13.2-1.35h1.39l.19 1.35.16 1.13 1.06.43c.43.18.83.41 1.23.71l.91.7 1.06-.43 1.27-.51.7 1.21-1.07.85-.89.7.14 1.13zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
 fullscreen_exit:'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z',
 fullscreen:'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
 share:'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',create_new_folder:'M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z',
 checklist:'M22 7h-9v2h9V7zm0 8h-9v2h9v-2zM5.54 11 2 7.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 11zm0 8L2 15.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 19z',
 menu_book:'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z M17.5 10.5c.88 0 1.73.09 2.5.26V9.24c-.79-.15-1.64-.24-2.5-.24-1.7 0-3.24.29-4.5.83v1.66c1.13-.64 2.7-.99 4.5-.99zM13 12.49v1.66c1.13-.64 2.7-.99 4.5-.99.88 0 1.73.09 2.5.26V11.9c-.79-.15-1.64-.24-2.5-.24-1.7 0-3.24.3-4.5.83zm4.5 1.84c-1.7 0-3.24.29-4.5.83v1.66c1.13-.64 2.7-.99 4.5-.99.88 0 1.73.09 2.5.26v-1.52c-.79-.16-1.64-.24-2.5-.24z',
 map:'m20.5 3-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM10 5.47l4 1.4v11.66l-4-1.4V5.47zm-5 .99 3-1.01v11.7l-3 1.16V6.46zm14 11.08-3 1.01V6.86l3-1.16v11.84z',
 history_edu:'M9 4v1.38c-.83-.33-1.72-.5-2.61-.5-1.79 0-3.58.68-4.95 2.05l3.33 3.33h1.11v1.11c.86.86 1.98 1.31 3.11 1.36V15H6v3c0 1.1.9 2 2 2h10c1.66 0 3-1.34 3-3V4H9zm-1.11 6.41V8.26H5.61L4.57 7.22a5.07 5.07 0 0 1 1.82-.34c1.34 0 2.59.52 3.54 1.46l1.41 1.41-.2.2a2.7 2.7 0 0 1-1.92.8c-.47 0-.93-.12-1.33-.34zM19 17c0 .55-.45 1-1 1s-1-.45-1-1v-2h-6v-2.59c.57-.23 1.1-.57 1.56-1.03l.2-.2L15.59 14H17v-1.41l-6-5.97V6h8v11z',
 photo_library:'M20 4v12H8V4h12m0-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 9.67 1.69 2.26 2.48-3.1L19 15H9zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z',
 campaign:'M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm5.03 1.71L11 9.53v4.94l-1.97-1.18-.48-.29H4v-2h4.55l.48-.29zM15.5 12c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z',
 mail:'M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0-8 4.99L4 6h16zm0 12H4V8l8 5 8-5v10z',
 receipt:'M19.5 3.5 18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5zM19 19.09H5V4.91h14v14.18zM6 15h12v2H6zm0-4h12v2H6zm0-4h12v2H6z',
 inventory_2:'M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-1 18H5V9h14v11zm1-13H4V4h16v3z M9 12h6v2H9z',
 person:'M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 10c2.7 0 5.8 1.29 6 2H6c.23-.72 3.31-2 6-2m0-12C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
 graphic_eq:'M7 18h2V6H7v12zm4 4h2V2h-2v20zm-8-8h2v-4H3v4zm12 4h2V6h-2v12zm4-8v4h2v-4h-2z',
 movie:'M4 6.47 5.76 10H20v8H4V6.47M22 4h-4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4z',
 music_note:'m12 3 .01 10.55c-.59-.34-1.27-.55-2-.55a4.001 4.001 0 1 0 0 8c2.22 0 3.99-1.79 3.99-4V7h4V3h-6zm-1.99 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
 expand_less:'m12 8-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z',
 language:'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 0 1 5.08 16zm2.95-8H5.08a7.987 7.987 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z',
 description:'M8 16h8v2H8zm0-4h8v2H8zm6-10H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z',
 format_quote:'M18.62 18h-5.24l2-4H13V6h8v7.24L18.62 18zm-2-2h.76L19 12.76V8h-4v4h3.62l-2 4zm-8 2H3.38l2-4H3V6h8v7.24L8.62 18zm-2-2h.76L9 12.76V8H5v4h3.62l-2 4z',
 ios_share:'m16 5-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6a2 2 0 0 1-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3a2 2 0 0 1 2 2z',
 more_horiz:'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
 add_box:'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-8-2h2v-4h4v-2h-4V7h-2v4H7v2h4z',
 install_mobile:'M17 18H7V6h7V4H7V3h7V1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-5h-2v2zm0 3H7v-1h10v1z m18 14 5-5-1.41-1.41L19 10.17V3h-2v7.17l-2.59-2.58L13 9z',
 download_done:'M5 18h14v2H5v-2zm4.6-2.7L5 10.7l2-1.9 2.6 2.6L17 4l2 2-9.4 9.3z',
 phone_android:'M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm1 17H7V4h10v14zm-3 3h-4v-1h4v1z',
 menu:'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
 arrow_upward:'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
 arrow_downward:'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
 delete:'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
 sell:'m21.41 11.41-8.83-8.83c-.37-.37-.88-.58-1.41-.58H4c-1.1 0-2 .9-2 2v7.17c0 .53.21 1.04.59 1.41l8.83 8.83c.78.78 2.05.78 2.83 0l7.17-7.17c.78-.78.78-2.04-.01-2.83zM12.83 20 4 11.17V4h7.17L20 12.83 12.83 20zM6.5 5C7.33 5 8 5.67 8 6.5S7.33 8 6.5 8 5 7.33 5 6.5 5.67 5 6.5 5z',
};
export function SvgIcon({name,size=24}:{name:string;size?:number}){return <svg className="svg-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d={svgIcons[name]} fillRule="evenodd"/></svg>}
/** The one header of the three tab roots (Android TabRootBar): the vieira as the app's mark,
 * then the destination's name, then its actions. Same height, margin and type everywhere. */
/** heading=false on Inicio, where the page's own «Busca en Galiciana» is the one h1. */
export function TabRootBar({title,children,heading=true}:{title:string;children?:ReactNode;heading?:boolean}){return <header className="tab-root-bar"><span className="tab-root-mark" aria-hidden="true"><ShellIcon size={24}/></span>{heading?<h1>{title}</h1>:<p className="tab-root-title">{title}</p>}{children}</header>}
export function PageTitle({title,onBack,children}:{title:string;onBack?:()=>void;children?:ReactNode}){return <header className="page-title">{onBack&&<button className="icon-button" onClick={onBack} aria-label={tr('Atrás','Atrás')}><MaterialIcon name="arrow_back" filled/></button>}<h1>{title}</h1>{children}</header>}
export function Status({loading,error,retry}:{loading?:boolean;error?:string;retry?:()=>void}){return <>{loading&&<ListSkeleton/>}{error&&<div className="error" role="alert"><p>{error}</p>{retry&&<button className="button secondary" onClick={retry}>{tr('Reintentar','Reintentar')}</button>}</div>}</>}
export function Thumbnail({src,title='',className=''}:{src?:string|null;title?:string;className?:string}){const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);return src&&!failed?<img className={'thumbnail '+className} src={src.startsWith('http')?proxy(src):src} alt={title} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<span className={'thumbnail no-image '+className} role="img" aria-label={tr('Sen miniatura','Sin miniatura')}><ImageOff size={24}/></span>}
export function External({href,children}:{href:string;children:ReactNode}){return <a href={href} target="_blank" rel="noopener noreferrer" className="external">{children}<ExternalLink size={16}/></a>}
export function Destination({title,description,onClick,icon}:{title:string;description:string;onClick:()=>void;icon?:ReactNode}){return <button className="destination" onClick={onClick}>{icon}<span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={22}/></button>}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
 const dialog=useRef<HTMLElement>(null),backdrop=useRef<HTMLDivElement>(null),closeRef=useRef(onClose);closeRef.current=onClose;
 useFadeOut(backdrop,100);
 useBackDismiss(()=>closeRef.current());
 useLayer(dialog,()=>closeRef.current(),{first:el=>focusables(el)[0]});
 useScrollLock();
 return <div className="modal-backdrop" ref={backdrop} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal" role="dialog" aria-modal="true" aria-label={title} ref={dialog} tabIndex={-1}><div className="row spread"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label={tr('Pechar','Cerrar')}><X/></button></div>{children}</section></div>}
export function Mark({text,query}:{text:string;query:string}){const terms=Array.from(new Set(query.match(/[\p{L}\p{N}]+/gu)||[]));if(!terms.length)return <>{text}</>;const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();const source=fold(text);const ranges:{a:number;b:number}[]=[];for(const term of terms){const token=fold(term);if(!token)continue;let index=0;while((index=source.indexOf(token,index))>=0){ranges.push({a:index,b:index+token.length});index+=token.length;}}ranges.sort((a,b)=>a.a-b.a);
 // Highlight.highlightRegex: with several words the whole run «Pedro Antonio» is one mark, joined across spaces and punctuation.
 if(terms.length>1){const joined:{a:number;b:number}[]=[];for(const r of ranges){const last=joined.at(-1);if(last&&r.a>=last.b&&/^[\s.,;:·\-–—'’"“”]+$/.test(text.slice(last.b,r.a)))last.b=Math.max(last.b,r.b);else if(!last||r.a>=last.b)joined.push({...r})}ranges.length=0;ranges.push(...joined)}const out:ReactNode[]=[];let cursor=0;for(const r of ranges){if(r.a<cursor)continue;out.push(text.slice(cursor,r.a),<mark key={r.a}>{text.slice(r.a,r.b)}</mark>);cursor=r.b}out.push(text.slice(cursor));return <>{out}</>}

export function MaterialIcon({name,size=24,filled=false}:{name:string;size?:number;filled?:boolean}){if(svgIcons[name])return <SvgIcon name={name} size={size}/>;return <span className={'material-icon'+(filled?' filled':'')} aria-hidden="true" style={{fontSize:size}}>{name}</span>}

/**
 * MatteControls.ClearableField: a filled field on surfaceVariant with 12 dp corners, no
 * indicator, a floating label when it has one, and ✕ to clear it as soon as there is text.
 */
export function ClearableField({value,onChange,label,placeholder,onSearch,clearLabel,inputMode,maxLength,ariaLabel,className=''}:{value:string;onChange:(v:string)=>void;label?:string;placeholder?:string;onSearch?:()=>void;clearLabel?:string;inputMode?:'numeric'|'text';maxLength?:number;ariaLabel?:string;className?:string}){
 return <label className={'native-search-field clearable-field '+(value?'has-value ':'')+(label?'':'no-label ')+className}>
  {label&&<span>{label}</span>}
  <input aria-label={ariaLabel||label||placeholder} value={value} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} enterKeyHint={onSearch?'search':'done'} onChange={e=>onChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(onSearch)onSearch();(e.target as HTMLInputElement).blur()}}}/>
  {value&&<button type="button" className="icon-button" aria-label={clearLabel||(label?tr(`Borrar ${label.toLocaleLowerCase()}`,`Borrar ${label.toLocaleLowerCase()}`):tr('Borrar o texto','Borrar el texto'))} onClick={()=>onChange('')}><MaterialIcon name="close"/></button>}
 </label>
}

/** Android's "seen" set (LocalStore.visited): pages opened from results read "· Xa aberta". */
const SEEN='gdp_seen';
export function visitedPages():Set<string>{try{return new Set(JSON.parse(localStorage.getItem(SEEN)||'[]'))}catch{return new Set()}}
export function markVisited(path:string,position:number){try{const seen=visitedPages();seen.add(`${path}|${position}`);localStorage.setItem(SEEN,JSON.stringify([...seen].slice(-2000)))}catch{/* only a hint */}}

export interface MenuItem{label:string;active?:boolean;detail?:string;danger?:boolean;disabled?:boolean;onClick:()=>void}
/**
 * M3 DropdownMenu, the only menu: below its button and always inside the screen, over a layer that
 * takes the outside tap. Escape, Back and that tap close it; arrows, Home and End move inside.
 */
export function DropdownMenu({anchor,label,items,radio=false,align='start',onClose}:{anchor:RefObject<HTMLElement|null>;label:string;items:MenuItem[];radio?:boolean;align?:'start'|'end';onClose:()=>void}){
 const box=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useFadeOut(box,75);
 const move=(to:number)=>{const list=focusables(box.current!);list[(to+list.length)%list.length]?.focus({preventScroll:true})};
 useBackDismiss(()=>close.current());
 useLayer(box,()=>close.current(),{
  first:el=>el.querySelector<HTMLElement>('[aria-checked="true"]')??focusables(el)[0],
  keys:(e,el)=>{const at=focusables(el).indexOf(document.activeElement as HTMLElement);
   const to=e.key==='ArrowDown'?at+1:e.key==='ArrowUp'?(at<0?-1:at-1):e.key==='Home'?0:e.key==='End'?-1:undefined;
   if(to!==undefined){e.preventDefault();e.stopPropagation();move(to);return true}
   if(e.key==='Tab'){e.preventDefault();close.current();return true}
   return false},
 });
 useLayoutEffect(()=>{
  const place=()=>{const a=anchor.current?.getBoundingClientRect(),el=box.current;if(!a||!el)return;
   const w=el.offsetWidth,h=el.offsetHeight,vw=document.documentElement.clientWidth,vh=innerHeight,edge=8;
   el.style.left=`${Math.max(edge,Math.min(align==='end'?a.right-w:a.left,vw-w-edge))}px`;
   const below=a.bottom+h<=vh-edge;el.style.top=`${below?a.bottom:Math.max(edge,a.top-h)}px`;
   // It grows out of its button: from the button's side and from the edge that touches it.
   el.style.transformOrigin=`${align==='end'?'right':'left'} ${below?'top':'bottom'}`};
  place();addEventListener('resize',place);addEventListener('scroll',place,true);
  return()=>{removeEventListener('resize',place);removeEventListener('scroll',place,true)};
 },[]);
 return createPortal(<div className="m3-menu-scrim" onClick={e=>{if(e.target===e.currentTarget)close.current()}}>
  <div className="m3-menu" role="menu" aria-label={label} ref={box} tabIndex={-1}>{items.map(item=><button type="button" role={radio?'menuitemradio':'menuitem'} aria-checked={radio?!!item.active:undefined} tabIndex={-1} key={item.label} disabled={item.disabled} className={item.danger?'danger':undefined} onClick={()=>{close.current();item.onClick()}}><span>{item.active&&item.detail?`${item.label} · ${item.detail}`:item.label}</span>{item.active&&<MaterialIcon name="check"/>}</button>)}</div>
 </div>,document.getElementById('main')??document.body);
}
/** SortMenuItem rows: label (· ascendente/descendente when active) and a ✓. */
export function SortMenu({label,items,disabled,align}:{label:ReactNode;disabled?:boolean;align?:'start'|'end';items:MenuItem[]}){
 const [open,setOpen]=useState(false),button=useRef<HTMLButtonElement>(null);
 return <span className="m3-menu-anchor"><button type="button" ref={button} className="text-button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true)}}}>{label}</button>
  {open&&<DropdownMenu anchor={button} label={button.current?.textContent??''} items={items} radio align={align} onClose={()=>setOpen(false)}/>}
 </span>
}

/** A designed wait: a fine bar and rows with the shape of what is coming, never a loose spinner. */
export function ListSkeleton({rows=4,thumbs=false}:{rows?:number;thumbs?:boolean}){
 return <div className="list-skeleton" role="status" aria-label={tr('Consultando Galiciana…','Consultando Galiciana…')}>
  <div className="m3-linear-progress"/>
  {Array.from({length:rows},(_,i)=><div className={'skeleton-row'+(thumbs?' with-thumb':'')} key={i} style={{'--d':`${i*90}ms`} as React.CSSProperties}>{thumbs&&<span className="skeleton-thumb"/>}<span className="skeleton-lines"><span className="skeleton-line" style={{width:`${[78,64,86,58][i%4]}%`}}/><span className="skeleton-line short" style={{width:`${[44,36,50,30][i%4]}%`}}/></span></div>)}
 </div>
}

/**
 * Android's Back closes the sheet or dialog on top before leaving the screen. While anything is
 * open on top, one extra step sits in the browser history: Back consumes it and closes the top
 * one (and the step comes back if others remain). One sheet replacing another keeps the same
 * step, and navigating away with something open consumes it so the history stays exact.
 */
const overlays:Array<()=>void>=[];
let overlayEntry=false,pendingBack:number|undefined;
// Taking the step away is a history.back(), which arrives a moment later: whatever moves in the
// history meanwhile waits for it, or that back would undo it.
let returning:number|undefined;const waiting:Array<()=>void>=[];
function settled(){if(returning===undefined)return;clearTimeout(returning);returning=undefined;for(const fn of waiting.splice(0))whenSettled(fn)}
export function whenSettled(fn:()=>void){if(returning===undefined)fn();else waiting.push(fn)}
function leaveEntry(){overlayEntry=false;returning=window.setTimeout(settled,500);history.back()}
const isOverlayState=()=>!!(history.state as {gdpOverlay?:boolean}|null)?.gdpOverlay;
function ensureEntry(){if(returning!==undefined){waiting.push(()=>{if(overlays.length)ensureEntry()});return}if(pendingBack!==undefined){clearTimeout(pendingBack);pendingBack=undefined}if(!overlayEntry){history.pushState({...(history.state||{}),gdpOverlay:true},'');overlayEntry=true}}
if(typeof window!=='undefined')addEventListener('popstate',()=>{if(returning!==undefined)setTimeout(settled,0);if(!overlayEntry||isOverlayState())return;overlayEntry=false;const top=overlays[overlays.length-1];top?.();setTimeout(()=>{if(overlays.length)ensureEntry()},0)});
/** The app's navigation calls this before moving: the overlay step is used up, not left behind. */
export function consumeOverlayEntry():boolean{const was=overlayEntry&&isOverlayState();overlayEntry=false;if(pendingBack!==undefined){clearTimeout(pendingBack);pendingBack=undefined}return was}
export function useBackDismiss(onDismiss:()=>void){
 const dismiss=useRef(onDismiss);dismiss.current=onDismiss;
 useEffect(()=>{
  const fn=()=>dismiss.current();
  overlays.push(fn);ensureEntry();
  return()=>{const i=overlays.lastIndexOf(fn);if(i>=0)overlays.splice(i,1);
   if(!overlays.length&&overlayEntry)pendingBack=window.setTimeout(()=>{pendingBack=undefined;if(!overlays.length&&overlayEntry&&isOverlayState())leaveEntry()},0)};
 },[]);
}
