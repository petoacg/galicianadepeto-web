/** GalicianaApp.kt activeTab; history and backup fall through to Buscar. */
export function activeTab(screen:string):'home'|'explore'|'saved' {
  if(screen==='saved')return 'saved';
  return ['explore','hemeroteca','collections','data','about','legal','record'].includes(screen)?'explore':'home';
}

export type RootTab='home'|'explore'|'saved';
export interface NavigationRoute {screen:string;[key:string]:unknown}
export interface NavigationState<R extends NavigationRoute>{route:R;gdpetoIndex:number;gdpetoScroll:number;[key:string]:unknown}
export interface NavigationAdapter<R extends NavigationRoute>{
 state():unknown;
 locationRoute():R;
 routeUrl(route:R):string;
 replace(state:NavigationState<R>,route:R):void;
 push(state:NavigationState<R>,route:R):void;
 go(delta:number):void;
 scroll():number;
 changed(route:R):void;
}
/** GalicianaApp popUpTo(home)+launchSingleTop. Browser Back at Home is left to the host. */
export class RootHistoryNavigator<R extends NavigationRoute>{
 private current:NavigationState<R>;
 private pending:RootTab|undefined;
 private readonly tabScroll=new Map<RootTab,number>();
 constructor(private readonly adapter:NavigationAdapter<R>,private readonly home:R){
  const incoming=this.readState(),route=incoming?.route??adapter.locationRoute();
  if(incoming&&(incoming.gdpetoIndex>0||route.screen==='home'))this.current=incoming;
  else {
   const root=this.make(home,0,route.screen==='home'?(incoming?.gdpetoScroll??0):0);
   adapter.replace(root,home);
   this.current=root;
   if(route.screen!=='home'){this.current=this.make(route,1,incoming?.gdpetoScroll??0);adapter.push(this.current,route)}
  }
 }
 get route():R{return this.current.route}
 /** Called after listeners are installed; repairs Home entries pushed by the previous shell. */
 ready():void{if(this.current.route.screen==='home'&&this.current.gdpetoIndex>0)this.selectTab('home')}
 private readState():NavigationState<R>|undefined{
  const state=this.adapter.state() as Partial<NavigationState<R>>|null;
  return state&&typeof state.route?.screen==='string'&&Number.isInteger(state.gdpetoIndex)&&state.gdpetoIndex!>=0?
   {...state,route:state.route,gdpetoIndex:state.gdpetoIndex!,gdpetoScroll:typeof state.gdpetoScroll==='number'?state.gdpetoScroll:0} as NavigationState<R>:undefined;
 }
 private make(route:R,index:number,scroll=0):NavigationState<R>{return{route,gdpetoIndex:index,gdpetoScroll:scroll}}
 private publish(state:NavigationState<R>):void{
  const same=this.current.gdpetoIndex===state.gdpetoIndex&&this.current.gdpetoScroll===state.gdpetoScroll&&this.adapter.routeUrl(this.current.route)===this.adapter.routeUrl(state.route);
  this.current=state;if(!same)this.adapter.changed(state.route);
 }
 private saveCurrent():void{
  const state=this.readState()??this.current;
  const scroll=this.adapter.scroll();this.current={...state,gdpetoScroll:scroll};
  this.adapter.replace(this.current,this.current.route);
  if(['home','explore','saved'].includes(this.current.route.screen))this.tabScroll.set(this.current.route.screen as RootTab,scroll);
 }
 navigate(next:R,replace=false):void{
  // A root transition is atomic; do not insert a child into a branch being removed.
  if(this.pending!==undefined)return;
  this.saveCurrent();
  const sameUrl=this.adapter.routeUrl(next)===this.adapter.routeUrl(this.current.route);
  const state=this.make(next,replace||sameUrl?this.current.gdpetoIndex:this.current.gdpetoIndex+1);
  if(replace||sameUrl)this.adapter.replace(state,next);else this.adapter.push(state,next);
  this.current=state;this.adapter.changed(next);
 }
 selectTab(target:RootTab):void{
  if(this.pending!==undefined){this.pending=target;return}
  const index=this.current.gdpetoIndex;
  if(this.current.route.screen===target&&(target==='home'?index===0:index===1))return;
  this.saveCurrent();
  if(index>0){this.pending=target;this.adapter.go(-index);return}
  this.finishTab(target);
 }
 goHome():void{this.selectTab('home')}
 back():void{
  if(this.pending!==undefined)return;
  this.saveCurrent();this.adapter.go(-1);
 }
 private finishTab(target:RootTab):void{
  const root=this.readState()??this.make(this.home,0,this.tabScroll.get('home')??0);
  if(target==='home'){this.publish(root);return}
  const route={screen:target} as R,state=this.make(route,1,this.tabScroll.get(target)??0);
  this.adapter.push(state,route);this.current=state;this.adapter.changed(route);
 }
 /** Both popstate and hashchange call this; consuming a pending target is idempotent. */
 handlePop():void{
  let state=this.readState();
  if(this.pending!==undefined){
   if(!state||state.gdpetoIndex!==0)return;
   // Earlier shells could start a deep link at index zero. Repair that root
   // before consuming the tab target instead of leaving the transition pending.
   if(state.route.screen!=='home'){
    state=this.make(this.home,0,this.tabScroll.get('home')??0);
    this.adapter.replace(state,this.home);
   }
   const target=this.pending;this.pending=undefined;this.finishTab(target);return;
  }
  if(!state){state=this.make(this.adapter.locationRoute(),this.current.gdpetoIndex+1);this.adapter.replace(state,state.route)}
  this.publish(state);
 }
}
