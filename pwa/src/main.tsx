import {startNativeTextScale} from './androidTextScale';
import {createRoot} from 'react-dom/client';
import App from './App';
import './app.css';
import {startRipples} from './ripple';
import {trackInputModality} from './layers';
import {startLaunches} from './launch';
startNativeTextScale([0.1, 0.15, 0.2, 0.25, 0.4, 0.5, 11.0, 12.0, 12.8, 13.6, 14.0, 14.4, 14.8, 15.2, 16, 16.8, 17.2, 17.6, 18.4, 19.2, 20.0, 20.8, 22.0, 23.2, 24, 28.0, 30.4, 32.0, 34.0, 36.0, 40.0]);
// Browser controls can resize the visible area before CSS viewport units settle.
const viewport = window.visualViewport;
if (viewport) {
  // The variable is inherited by the whole page, so every change restyles everything: write it at
  // most once a frame, and only when the height really changed (animation-performance).
  let last = '', queued = 0;
  const updateVisibleHeight = () => {
    queued = 0;
    const next = `${Math.round(viewport.height)}px`;
    if (viewport.scale === 1 && next !== last) {
      last = next;
      document.documentElement.style.setProperty('--visible-height', next);
    }
  };
  viewport.addEventListener('resize', () => { if (!queued) queued = requestAnimationFrame(updateVisibleHeight); });
  updateVisibleHeight();
}
// Apple devices read in Apple's own letter (DESIGN.md › Typography); the rest keep Roboto.
if(/Macintosh|iPhone|iPad|iPod/.test(navigator.userAgent))document.documentElement.classList.add('apple');
startLaunches();
createRoot(document.getElementById('root')!).render(<App/>);
startRipples();
trackInputModality();
// The startup screen leaves with a short fade once the first screen has been painted.
requestAnimationFrame(()=>requestAnimationFrame(()=>{const splash=document.getElementById('gdp-splash');if(!splash)return;splash.classList.add('out');setTimeout(()=>splash.remove(),260)}));
