import {emptyPreset} from './api';
/**
 * How the installed app is opened from outside, as a native app is:
 * - Android's share sheet lists GdPeto (manifest share_target): a name or a phrase shared from any
 *   app opens straight as a search. Links in what is shared are dropped; a bare link opens Buscar.
 * - A long press on the icon offers Buscar and Gardados (manifest shortcuts).
 * The app is already open in the background most of the time (launch_handler focus-existing): then
 * the launch arrives through launchQueue and becomes an ordinary step in its history.
 */
export function sharedRoute(url:URL):string|undefined{
 const p=url.searchParams;if(!p.has('text')&&!p.has('title'))return undefined;
 const clean=(s:string|null)=>(s||'').replace(/https?:\/\/\S+/g,' ').replace(/\s+/g,' ').trim();
 const query=(clean(p.get('text'))||clean(p.get('title'))).slice(0,200);
 if(!query)return '#screen=home';
 return '#'+new URLSearchParams({screen:'search',preset:JSON.stringify({...emptyPreset,query})});
}

export function startLaunches(){
 const shared=sharedRoute(new URL(location.href));
 // Cold start from the share sheet: the shared text becomes the address the app opens on.
 if(shared){const rest=new URLSearchParams(location.search);for(const k of ['title','text','url'])rest.delete(k);
  history.replaceState(null,'',location.pathname+(rest.size?'?'+rest:'')+shared)}
 const queue=(window as Window&{launchQueue?:{setConsumer:(fn:(p:{targetURL?:string})=>void)=>void}}).launchQueue;
 queue?.setConsumer(({targetURL})=>{
  if(!targetURL)return;
  const url=new URL(targetURL),route=sharedRoute(url)??(url.hash.length>1?url.hash:undefined);
  if(route&&route!==location.hash)location.hash=route.slice(1);
 });
}
