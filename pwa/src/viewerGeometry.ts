export interface Point {x:number;y:number}
export interface Size {width:number;height:number}
export const clampZoom=(value:number)=>Math.max(1,Math.min(8,value));
/** Coordinates within the image, independent of its scale and centering margins. */
export function imageAnchor(point:Point,image:Size&{left:number;top:number}):Point {
 return {x:(point.x-image.left)/Math.max(1,image.width),y:(point.y-image.top)/Math.max(1,image.height)};
}
/** Keep the chosen image point under the moving pinch midpoint, within page bounds. */
export function anchoredScroll(anchor:Point,point:Point,viewport:Size,image:Size):Point {
 return {
  x:Math.max(0,Math.min(Math.max(0,image.width-viewport.width),Math.max(0,(viewport.width-image.width)/2)+anchor.x*image.width-point.x)),
  y:Math.max(0,Math.min(Math.max(0,image.height-viewport.height),Math.max(0,(viewport.height-image.height)/2)+anchor.y*image.height-point.y)),
 };
}
