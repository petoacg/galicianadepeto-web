/*!
 * Copyright 2023 The Android Open Source Project
 * Copyright 2020 The Android Open Source Project (paragraph line-height resolver)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * TypeScript adaptation of androidx.compose.ui:ui-unit-android:1.7.5:
 * androidMain/androidx/compose/ui/unit/fontscaling/{FontScaleConverterFactory,
 * FontScaleConverterTable,MathUtils}.android.kt. The tables, cache semantics,
 * Float key quantization and interpolation are retained. Explicit Math.fround
 * operations reproduce Kotlin Float arithmetic. Browser signal/token plumbing
 * below is an addition by Galiciana de Peto (2026); it does not change layout dp.
 */

const f = Math.fround;
const add = (a:number,b:number) => f(f(a)+f(b));
const sub = (a:number,b:number) => f(f(a)-f(b));
const mul = (a:number,b:number) => f(f(a)*f(b));
const div = (a:number,b:number) => f(f(a)/f(b));
const lerp = (start:number,stop:number,amount:number) => add(start,mul(sub(stop,start),amount));
function constrainedMap(min:number,max:number,from:number,to:number,value:number):number {
 const amount=from!==to?div(sub(value,from),sub(to,from)):0;
 return lerp(min,max,Math.max(0,Math.min(1,amount)));
}
export interface FontScaleConverter {convertSpToDp(sp:number):number;convertDpToSp(dp:number):number}
export class FontScaleConverterTable implements FontScaleConverter {
 readonly fromSp:readonly number[];
 readonly toDp:readonly number[];
 constructor(fromSp:readonly number[],toDp:readonly number[]) {
  if(!fromSp.length||fromSp.length!==toDp.length)throw new RangeError('Array lengths must match and be nonzero');
  this.fromSp=fromSp.map(f);this.toDp=toDp.map(f);
 }
 convertSpToDp(sp:number):number{return this.lookup(f(sp),this.fromSp,this.toDp)}
 convertDpToSp(dp:number):number{return this.lookup(f(dp),this.toDp,this.fromSp)}
 private lookup(value:number,source:readonly number[],target:readonly number[]):number {
  const positive=Math.abs(value),sign=Math.sign(value);
  let low=0,high=source.length-1;
  while(low<=high){const middle=(low+high)>>>1;if(source[middle]===positive)return mul(sign,target[middle]);if(source[middle]<positive)low=middle+1;else high=middle-1}
  const lower=low-1;
  if(lower>=source.length-1){const start=source[source.length-1];if(start===0)return 0;return mul(value,div(target[target.length-1],start))}
  const from=lower<0?0:source[lower],start=lower<0?0:target[lower],end=lower+1;
  return mul(sign,constrainedMap(start,target[end],from,source[end],positive));
 }
}
const COMMON=[8,10,12,14,18,20,24,30,100] as const;
const ANCHORS:readonly [number,readonly number[]][]=[
 [1.15,[9.2,11.5,13.8,16.4,19.8,21.8,25.2,30,100]],
 [1.3,[10.4,13,15.6,18.8,21.6,23.6,26.4,30,100]],
 [1.5,[12,15,18,22,24,26,28,30,100]],
 [1.8,[14.4,18,21.6,24.4,27.6,30.8,32.8,34.8,100]],
 [2,[16,20,24,26,30,34,36,38,100]],
];
function scaleKey(scale:number):number {
 const value=mul(scale,100);
 // Kotlin Float.toInt truncates, saturates at Int bounds, and maps NaN to zero.
 return Number.isNaN(value)?0:value>=2147483647?2147483647:value<=-2147483648?-2147483648:Math.trunc(value);
}
export class FontScaleConverterFactory {
 private readonly tables=new Map<number,FontScaleConverter>(ANCHORS.map(([scale,values])=>[scaleKey(scale),new FontScaleConverterTable(COMMON,values)]));
 isNonLinearFontScalingActive(scale:number):boolean{return f(scale)>=f(1.03)}
 forScale(rawScale:number):FontScaleConverter|null {
  const scale=f(rawScale);
  if(!this.isNonLinearFontScalingActive(scale))return null;
  const key=scaleKey(scale),cached=this.tables.get(key);if(cached)return cached;
  const keys=[...this.tables.keys()].sort((a,b)=>a-b),higher=keys.findIndex(k=>k>key);
  let converter:FontScaleConverter;
  if(higher<0)converter=new FontScaleConverterTable([1],[scale]);
  else {
   const lower=higher-1,startScale=lower<0?1:div(keys[lower],100),endScale=div(keys[higher],100);
   const start=lower<0?new FontScaleConverterTable(COMMON,COMMON):this.tables.get(keys[lower])!;
   const end=this.tables.get(keys[higher])!,point=constrainedMap(0,1,startScale,endScale,scale);
   converter=new FontScaleConverterTable(COMMON,COMMON.map(sp=>lerp(start.convertSpToDp(sp),end.convertSpToDp(sp),point)));
  }
  this.tables.set(key,converter);return converter;
 }
}
const factory=new FontScaleConverterFactory();
/** Compose Density.toDp(TextUnit): a nonlinear converter, otherwise linear fontScale. */
export function convertSpToDp(sp:number,scale:number,source:FontScaleConverterFactory=factory):number {
 return source.forScale(scale)?.convertSpToDp(sp)??mul(sp,scale);
}
export function convertDpToSp(dp:number,scale:number,source:FontScaleConverterFactory=factory):number {
 return source.forScale(scale)?.convertDpToSp(dp)??div(dp,scale);
}
/** ui-text 1.7.5 SpannableExtensions.resolveLineHeightInPx, density=1 CSS dp.
 * Above 1.05 the nominal line/font ratio is preserved; the curve is NOT applied
 * to the line-height quantity independently. Threshold differs from Factory 1.03.
 */
export function nativeLineHeight(lineSp:number,fontSp:number,scale:number,source:FontScaleConverterFactory=factory):number {
 if(f(scale)<=1.05)return convertSpToDp(lineSp,scale,source);
 const fontDp=convertSpToDp(fontSp,scale,source),resolvedFontSp=convertDpToSp(fontDp,scale,source);
 return mul(div(lineSp,resolvedFontSp),fontDp);
}

/** Exact stable CSS identifier for a nominal sp quantity, including tracking values. */
export function spToken(sp:number):string {
 if(!Number.isFinite(sp))throw new RangeError('A CSS sp token must be finite');
 return `--sp-${sp<0?'neg':''}${String(Math.abs(sp)).replace('.','_')}`;
}
export const DEFAULT_SP_TOKENS:readonly number[]=[-0.5,-0.4,-0.2,-0.1,0,0.1,0.2,0.25,0.4,0.5,0.8,1,8,10,11,12,14,16,18,20,22,24,28,30,32,36,40,48,56];

/**
 * Read only the browser-exposed preference, not DPR/UA or an assumed Android scale.
 * Unsupported env, nonfinite values, or a nonnominal root leave the rem fallback
 * intact. In particular root20px + env1.25 must not apply the preference twice.
 */
export function startNativeTextScale(tokens:readonly number[]=DEFAULT_SP_TOKENS):()=>void {
 if(typeof document==='undefined'||typeof window==='undefined')return()=>{};
 const root=document.documentElement,properties=[...new Set(tokens)].map(sp=>({sp,name:spToken(sp)}));
 const names=[...properties.map(({name})=>name),'--native-lh-proportional','--native-lh-independent'];
 const original=new Map(names.map(name=>[name,{value:root.style.getPropertyValue(name),priority:root.style.getPropertyPriority(name)}]));
 const probe=document.createElement('div');
 probe.setAttribute('aria-hidden','true');
 probe.style.cssText='position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;contain:strict;box-sizing:content-box;padding:0;border:0;height:0;width:calc(100px * env(preferred-text-scale, 0));transform:none;';
 root.appendChild(probe);
 let previousScale:number|null|undefined,frame:number|undefined,stopped=false;
 const restore=()=>{for(const name of names){const old=original.get(name)!;if(old.value)root.style.setProperty(name,old.value,old.priority);else root.style.removeProperty(name)}};
 const measure=()=>{
  if(stopped)return;
  const width=Number.parseFloat(window.getComputedStyle(probe).width),rootSize=Number.parseFloat(window.getComputedStyle(root).fontSize),scale=width/100;
  const next=Number.isFinite(scale)&&scale>0&&Number.isFinite(rootSize)&&Math.abs(rootSize-16)<0.01?f(scale):null;
  if(next===previousScale)return;
  previousScale=next;
  if(next===null){restore();return}
  for(const {sp,name}of properties)root.style.setProperty(name,`${convertSpToDp(sp,next)}px`);
  root.style.setProperty('--native-lh-proportional',next>1.05?'1':'0');
  root.style.setProperty('--native-lh-independent',next>1.05?'0':'1');
 };
 const schedule=()=>{if(stopped||frame!==undefined)return;frame=window.requestAnimationFrame(()=>{frame=undefined;measure()})};
 const onVisible=()=>{if(document.visibilityState==='visible')schedule()};
 window.addEventListener('focus',schedule);window.addEventListener('resize',schedule);
 document.addEventListener('visibilitychange',onVisible);window.visualViewport?.addEventListener('resize',schedule);
 measure();
 return()=>{stopped=true;if(frame!==undefined)window.cancelAnimationFrame(frame);window.removeEventListener('focus',schedule);window.removeEventListener('resize',schedule);document.removeEventListener('visibilitychange',onVisible);window.visualViewport?.removeEventListener('resize',schedule);probe.remove();restore()};
}
