import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FontScaleConverterFactory,FontScaleConverterTable,convertSpToDp,convertDpToSp,spToken,startNativeTextScale,nativeLineHeight} from '../src/androidTextScale';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/android-font-scale-1.7.5.json',import.meta.url),'utf8')) as {source:string;cases:{scale:number;input:number;dp:number;sp:number}[]};
test('All nonlinear roles, interpolated scales and tracking agree with ORIGINAL Compose JVM classes',()=>{
 const factory=new FontScaleConverterFactory();assert.match(fixture.source,/classes.jar original/);assert.ok(fixture.cases.length>1000);
 for(const row of fixture.cases){
  assert.equal(convertSpToDp(row.input,row.scale,factory),Math.fround(row.dp),`sp→dp ${row.input} at ${row.scale}`);
  assert.equal(convertDpToSp(row.input,row.scale,factory),Math.fround(row.sp),`dp→sp ${row.input} at ${row.scale}`);
 }
});
test('Native role anchors are nonlinear rather than a root multiplier',()=>{
 const factory=new FontScaleConverterFactory();
 assert.equal(convertSpToDp(14,1.15,factory),Math.fround(16.4));assert.equal(convertSpToDp(28,1.15,factory),Math.fround(28.4));
 assert.equal(convertSpToDp(20,1.15,factory),Math.fround(21.8));assert.equal(convertSpToDp(22,1.15,factory),Math.fround(23.5));
 assert.equal(convertSpToDp(100,1.15,factory),100);assert.notEqual(convertSpToDp(28,1.15,factory),Math.fround(28*1.15));
});
test('Activation, Float key truncation and cache retain native behavior',()=>{
 const factory=new FontScaleConverterFactory();assert.equal(factory.forScale(1),null);assert.equal(factory.forScale(1.02999),null);assert.notEqual(factory.forScale(1.03),null);
 assert.equal(factory.forScale(1.15999),factory.forScale(1.15));assert.equal(factory.forScale(2.009),factory.forScale(2));
 assert.equal(convertSpToDp(140,2.5,new FontScaleConverterFactory()),350);
 assert.equal(convertSpToDp(14,.85,new FontScaleConverterFactory()),Math.fround(Math.fround(14)*Math.fround(.85)));
});
test('Signs, signed zero, table extrapolation and inverse conversions remain native',()=>{
 const table=new FontScaleConverterTable([8,10],[12,15]);assert.equal(table.convertSpToDp(.2),Math.fround(.3));assert.equal(table.convertSpToDp(-20),-30);assert.equal(table.convertDpToSp(-30),-20);
 assert.equal(table.convertSpToDp(-0),-0);assert.equal(table.convertSpToDp(0),0);assert.equal(convertSpToDp(-0,1),-0);assert.equal(convertSpToDp(14,0),0);
 assert.equal(new FontScaleConverterTable([0],[0]).convertSpToDp(10),0);assert.throws(()=>new FontScaleConverterTable([],[]),RangeError);assert.throws(()=>new FontScaleConverterTable([1],[]),RangeError);
});
test('CSS identifiers preserve fractions and negative tracking; SSR installs no DOM behavior',()=>{
 assert.equal(spToken(14),'--sp-14');assert.equal(spToken(.2),'--sp-0_2');assert.equal(spToken(-.2),'--sp-neg0_2');assert.equal(spToken(-0),'--sp-0');assert.throws(()=>spToken(NaN),RangeError);
 const cleanup=startNativeTextScale([14,28,-.2]);assert.equal(typeof cleanup,'function');cleanup();
});

test('Paragraph line height preserves nominal proportions only above ui-text 1.05',()=>{
 const factory=new FontScaleConverterFactory();
 for(const scale of [1,1.03,1.04,1.05])assert.equal(nativeLineHeight(24,16,scale,factory),convertSpToDp(24,scale,factory));
 assert.ok(Math.abs(nativeLineHeight(24,16,1.15,factory)-27.15)<1e-5);
 assert.ok(Math.abs(nativeLineHeight(20,14,1.15,factory)-23.428571428571427)<1e-5);
 assert.ok(Math.abs(nativeLineHeight(16,12,1.15,factory)-18.4)<1e-5);
 assert.ok(Math.abs(nativeLineHeight(36,28,1.15,factory)-36.51428571428571)<1e-5);
 assert.notEqual(nativeLineHeight(24,16,1.05001,factory),convertSpToDp(24,1.05001,factory));
});
