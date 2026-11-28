/**
 * Axustes › Tema: the app follows the phone (light or dark) unless the user picks one.
 * The choice is a data-theme on <html>; app.css keys its light palette on it. The reader stays dark.
 */
export type Theme = 'system' | 'light' | 'dark';
const KEY = 'ui_theme';

export function theme(): Theme {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}

/** Whether the screens are light now, by choice or by the phone. */
export function isLight(): boolean {
  const t = theme();
  return t === 'system' ? matchMedia('(prefers-color-scheme: light)').matches : t === 'light';
}

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme; else root.dataset.theme = t;
  window.dispatchEvent(new Event('gdpeto-theme'));
}

export function chooseTheme(t: Theme) {
  try { if (t === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* applies for this visit */ }
  apply(t);
}

if (typeof document !== 'undefined') apply(theme());
