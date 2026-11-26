/**
 * Press highlight, as Apple draws it: the whole touched control lights up the moment the finger
 * lands (no circle growing from the touch, which is Android's ripple) and fades when it lifts.
 *
 * - Colour: the theme's pressed layer, primary at 16 % (--md-state-pressed).
 * - Timing: on at once; off in 150 ms. A quick tap still flashes.
 * - It is drawn in a layer of its own, fixed over the control and following it if it moves, so React's markup, the control's
 *   position and overflow, and the enlarged touch areas of the chips are left alone. Only opacity is animated.
 * - Listeners are passive: clicks are never delayed. A touch that turns into a scroll is cancelled
 *   by the browser before the highlight starts (60 ms grace), so lists do not flash while scrolling.
 * - Reduced motion changes nothing: it is a change of light, not of place.
 * - A control can opt out with data-no-ripple. A card that is clickable as a whole carries
 *   data-ripple; buttons inside it that only repeat its action carry data-ripple-parent.
 */
const HOSTS = 'button,[role=button],[role=tab],a[href],summary,label:has(>input[type=checkbox]),[data-ripple]';
const FADE_OUT = 150, TOUCH_GRACE = 60;

export function startRipples() {
  if (typeof document === 'undefined' || !('animate' in Element.prototype)) return;

  document.addEventListener('pointerdown', down => {
    if (down.button !== 0 || !down.isPrimary) return;
    let target = (down.target as Element | null)?.closest?.(HOSTS) as HTMLElement | null;
    // A button that only does what its card does (a result's thumbnail or excerpt) ripples the whole
    // card, as one clickable Column does in Compose.
    if (target?.hasAttribute('data-ripple-parent')) target = target.parentElement?.closest('[data-ripple]') ?? target;
    if (!target || target.matches(':disabled,[aria-disabled="true"]') || target.closest('[data-no-ripple]')) return;
    // In the bar and the rail the highlight belongs to the pill.
    const host = (target.closest('.bottom-nav') && target.querySelector<HTMLElement>(':scope>span')) || target;
    let ripple: {release: () => void} | undefined, released = false;

    const begin = () => { if (!ripple && host.isConnected) ripple = draw(host); };
    const end = (kind: 'up' | 'cancel') => {
      if (released) return; released = true;
      window.clearTimeout(timer);
      removeEventListener('pointerup', up, true); removeEventListener('pointercancel', cancel, true);
      // A quick tap still flashes; a touch that became a scroll shows nothing.
      if (!ripple && kind === 'up') begin();
      ripple?.release();
    };
    const up = (e: PointerEvent) => { if (e.pointerId === down.pointerId) end('up'); };
    const cancel = (e: PointerEvent) => { if (e.pointerId === down.pointerId) end('cancel'); };
    addEventListener('pointerup', up, {capture: true, passive: true});
    addEventListener('pointercancel', cancel, {capture: true, passive: true});
    const timer = down.pointerType === 'touch' ? window.setTimeout(begin, TOUCH_GRACE) : 0;
    if (down.pointerType !== 'touch') begin();
  }, {capture: true, passive: true});
}

function draw(host: HTMLElement) {
  const box = host.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'gdp-ripple-layer';
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px',
    borderRadius: getComputedStyle(host).borderRadius, opacity: '1',
  });
  document.body.append(layer);
  // The layer is fixed, so it follows the control while it lives: a tap that moves the content
  // (a section opening, a list scrolling into view) does not leave the highlight behind.
  const follow = () => {
    if (!layer.isConnected) return;
    if (!host.isConnected) { layer.remove(); return; }
    const now = host.getBoundingClientRect();
    layer.style.transform = now.left === box.left && now.top === box.top ? '' : `translate(${now.left - box.left}px,${now.top - box.top}px)`;
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);

  return {
    release() {
      // Whatever happens to the animation (a hidden tab draws no frames), the layer goes.
      window.setTimeout(() => layer.remove(), FADE_OUT + 400);
      if (!host.isConnected) { layer.remove(); return; }
      layer.animate([{opacity: 1}, {opacity: 0}], {duration: FADE_OUT, easing: 'ease-out', fill: 'forwards'})
        .finished.then(() => layer.remove(), () => layer.remove());
    },
  };
}
