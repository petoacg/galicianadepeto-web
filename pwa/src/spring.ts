// Gesture physics from Apple's "Designing Fluid Interfaces" (WWDC 2018), for the sheet and the page swipe.

/** Where a flick would come to rest, as scroll deceleration does. Velocity in px/ms, result in px. */
export const project=(velocity:number,rate=.998)=>velocity*rate/(1-rate);

/** Resistance past an edge: the further the pull, the less it follows (UIScrollView's formula). */
export const rubberband=(overshoot:number,dimension:number,c=.55)=>overshoot*dimension*c/(dimension+c*Math.abs(overshoot));

/**
 * A spring from `from` to `to` that starts at the finger's velocity (px/ms), sampled per frame so
 * it can run as a linear WAAPI animation on the compositor. Damping 1 settles without bounce;
 * response is roughly how long it takes to get there, in seconds.
 */
export function springFrames(from:number,to:number,velocity:number,{damping=1,response=.3}={}){
 const w=2*Math.PI/response,d0=from-to,v0=velocity*1000,step=1/60,values:number[]=[];
 const at=(t:number)=>{const e=Math.exp(-damping*w*t);
  if(damping>=1)return to+(d0+(v0+w*d0)*t)*e;
  const wd=w*Math.sqrt(1-damping*damping);return to+e*(d0*Math.cos(wd*t)+(v0+damping*w*d0)/wd*Math.sin(wd*t))};
 for(let t=0;t<1.2;t+=step){const x=at(t);values.push(x);if(t>.05&&Math.abs(x-to)<.5&&Math.abs(at(t+step)-x)<.5)break}
 values.push(to);return {values,duration:Math.round((values.length-1)*step*1000)};
}
