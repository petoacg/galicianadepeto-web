import {test} from 'node:test';import assert from 'node:assert/strict';import {activeTab} from '../src/navigation';
test('Selected tabs match Android activeTab on every route',()=>{
 for(const screen of ['explore','hemeroteca','collections','data','about','legal','record'])assert.equal(activeTab(screen),'explore');
 for(const screen of ['home','search','history','backup'])assert.equal(activeTab(screen),'home');
 assert.equal(activeTab('saved'),'saved');
});

import {RootHistoryNavigator,type NavigationAdapter,type NavigationRoute,type NavigationState} from '../src/navigation';
type R=NavigationRoute;
class FakeHistory implements NavigationAdapter<R>{
 entries:{state:NavigationState<R>|null;route:R}[];
 position=1;y=0;changes:string[]=[];goRequests:number[]=[];pushes:string[]=[];externalRequests=0;
 queued:number[]=[];
 constructor(initial:R={screen:'home'},state:NavigationState<R>|null=null){this.entries=[{state:null,route:{screen:'external'}},{state,route:initial}]}
 state=()=>this.entries[this.position].state;
 locationRoute=()=>this.entries[this.position].route;
 routeUrl=(route:R)=>JSON.stringify(route);
 replace=(state:NavigationState<R>,route:R)=>{this.entries[this.position]={state:structuredClone(state),route}};
 push=(state:NavigationState<R>,route:R)=>{this.entries.splice(this.position+1);this.entries.push({state:structuredClone(state),route});this.position++;this.pushes.push(route.screen)};
 go=(delta:number)=>{this.goRequests.push(delta);this.queued.push(delta)};
 scroll=()=>this.y;
 changed=(route:R)=>{this.changes.push(route.screen)};
 flush(nav:RootHistoryNavigator<R>,duplicate=true){const delta=this.queued.shift();assert.notEqual(delta,undefined);this.position+=delta!;assert.ok(this.position>=0);if(this.position===0){this.externalRequests++;return}nav.handlePop();if(duplicate)nav.handlePop()}
 screens(){return this.entries.slice(1,this.position+1).map(e=>e.route.screen)}
}
function setup(initial:R={screen:'home'},state:NavigationState<R>|null=null){const history=new FakeHistory(initial,state);const nav=new RootHistoryNavigator(history,{screen:'home'});return{history,nav}}
test('Tabs pop nested Saved/Viewer to root before Explore; Back from Explore returns Home once',()=>{
 const {history:h,nav}=setup();h.y=83;nav.selectTab('saved');h.y=420;nav.navigate({screen:'viewer',path:'1510028'});
 nav.selectTab('explore');assert.deepEqual(h.goRequests,[-2]);assert.equal(nav.route.screen,'viewer');
 h.flush(nav);assert.deepEqual(h.screens(),['home','explore']);assert.deepEqual(h.pushes,['saved','viewer','explore']);assert.equal(h.entries[1].state?.gdpetoScroll,83);
 nav.back();h.flush(nav);assert.equal(nav.route.screen,'home');assert.equal(h.state()?.gdpetoScroll,83);assert.deepEqual(h.changes,['saved','viewer','explore','home']);
});
test('Selecting Home never pushes it: Android Back requests external navigation at root',()=>{
 const {history:h,nav}=setup();nav.selectTab('saved');nav.selectTab('home');h.flush(nav);
 assert.deepEqual(h.pushes,['saved']);assert.deepEqual(h.screens(),['home']);nav.back();h.flush(nav);assert.equal(h.externalRequests,1);assert.deepEqual(h.goRequests,[-1,-1]);
});
test('Deep link establishes root Home and retains the deep page as the only child',()=>{
 const {history:h,nav}=setup({screen:'viewer',path:'42',position:3});assert.deepEqual(h.screens(),['home','viewer']);assert.equal(h.state()?.gdpetoIndex,1);
 nav.back();h.flush(nav);assert.equal(nav.route.screen,'home');nav.back();h.flush(nav);assert.equal(h.externalRequests,1);
});
test('Root retaps do nothing, rapid pending taps keep only latest target, duplicate events do not push twice',()=>{
 const {history:h,nav}=setup();nav.selectTab('home');assert.deepEqual(h.goRequests,[]);assert.deepEqual(h.pushes,[]);
 nav.selectTab('saved');h.y=315;nav.selectTab('saved');assert.deepEqual(h.pushes,['saved']);assert.deepEqual(h.goRequests,[]);
 nav.selectTab('explore');nav.selectTab('home');nav.selectTab('saved');assert.deepEqual(h.goRequests,[-1]);h.flush(nav);
 assert.deepEqual(h.screens(),['home','saved']);assert.deepEqual(h.pushes,['saved','saved']);assert.equal(h.state()?.gdpetoScroll,315);
 nav.handlePop();nav.handlePop();assert.deepEqual(h.pushes,['saved','saved']);assert.deepEqual(h.changes,['saved','saved']);
});
test('Home actions from Viewer and Backup remove those branches without redefining nested back/replace',()=>{
 const {history:h,nav}=setup();nav.selectTab('saved');nav.navigate({screen:'viewer',page:3});nav.navigate({screen:'viewer',page:4},true);assert.equal(h.state()?.gdpetoIndex,2);
 nav.back();h.flush(nav);assert.equal(nav.route.screen,'saved');nav.navigate({screen:'backup'});nav.goHome();h.flush(nav);assert.deepEqual(h.screens(),['home']);
 nav.navigate({screen:'viewer',page:3});nav.goHome();h.flush(nav);assert.equal(nav.route.screen,'home');assert.ok(!h.pushes.includes('home'));
});
test('Reloaded legacy Home above index zero is collapsed only after listener readiness',()=>{
 const h=new FakeHistory();h.replace({route:{screen:'home'},gdpetoIndex:0,gdpetoScroll:60},{screen:'home'});h.push({route:{screen:'saved'},gdpetoIndex:1,gdpetoScroll:20},{screen:'saved'});h.push({route:{screen:'home'},gdpetoIndex:2,gdpetoScroll:0},{screen:'home'});
 const nav=new RootHistoryNavigator(h,{screen:'home'});assert.deepEqual(h.goRequests,[]);nav.ready();assert.deepEqual(h.goRequests,[-2]);h.flush(nav);assert.equal(h.state()?.gdpetoIndex,0);assert.equal(h.state()?.gdpetoScroll,60);
});

test('A legacy deep-link root beneath Saved is repaired before completing a tab transition',()=>{
 const h=new FakeHistory({screen:'viewer',path:'42'}, {route:{screen:'viewer',path:'42'},gdpetoIndex:0,gdpetoScroll:0});
 h.push({route:{screen:'saved'},gdpetoIndex:1,gdpetoScroll:140},{screen:'saved'});
 const nav=new RootHistoryNavigator(h,{screen:'home'});
 nav.selectTab('explore');assert.deepEqual(h.goRequests,[-1]);h.flush(nav);
 assert.deepEqual(h.screens(),['home','explore']);assert.equal(nav.route.screen,'explore');
 nav.back();h.flush(nav);assert.equal(nav.route.screen,'home');assert.equal(h.state()?.gdpetoIndex,0);
 nav.selectTab('saved');assert.equal(nav.route.screen,'saved');assert.deepEqual(h.screens(),['home','saved']);
});
