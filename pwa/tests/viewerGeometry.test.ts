import {test} from 'node:test';
import assert from 'node:assert/strict';
import {anchoredScroll,imageAnchor,clampZoom} from '../src/viewerGeometry';
test('pinch keeps an off-centre image point under the fingers',()=>{
 const anchor=imageAnchor({x:150,y:400},{left:50,top:0,width:300,height:600});
 const scroll=anchoredScroll(anchor,{x:150,y:400},{width:400,height:600},{width:900,height:1800});
 assert.deepEqual(scroll,{x:150,y:800});
 assert.equal(anchor.x*900-scroll.x,150);assert.equal(anchor.y*1800-scroll.y,400);
});
test('moving both fingers pans while zooming',()=>{
 const scroll=anchoredScroll({x:.6,y:.6},{x:250,y:350},{width:400,height:600},{width:1200,height:2400});
 assert.deepEqual(scroll,{x:470,y:1090});
});
test('zooming out recentres a page smaller than the viewport',()=>{
 assert.deepEqual(anchoredScroll({x:.9,y:.9},{x:50,y:50},{width:400,height:600},{width:300,height:600}),{x:0,y:0});
});
test('image edges constrain scrolling without leaving blank space',()=>{
 assert.deepEqual(anchoredScroll({x:1,y:1},{x:10,y:10},{width:400,height:600},{width:800,height:1200}),{x:400,y:600});
});
test('releasing a pinch and starting another uses the actual current image position',()=>{
 const anchor=imageAnchor({x:180,y:270},{left:-240,top:-600,width:900,height:1800});
 assert.deepEqual(anchoredScroll(anchor,{x:180,y:270},{width:400,height:600},{width:900,height:1800}),{x:240,y:600});
 assert.equal(clampZoom(.2),1);assert.equal(clampZoom(12),8);
});
