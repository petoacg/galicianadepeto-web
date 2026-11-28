/**
 * Interface languages, as in the Android app: Galician by default, Spanish by choice
 * from Acerca de. Documents are shown as Galiciana offers them.
 */
export type Lang = 'gl' | 'es';
const KEY = 'ui_language';

function initial(): Lang {
  // Outside a browser (unit tests) the original Spanish texts stay, as in Android's tests.
  if (typeof localStorage === 'undefined') return 'es';
  try { return localStorage.getItem(KEY) === 'es' ? 'es' : 'gl'; } catch { return 'gl'; }
}

let current: Lang = initial();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const lang = (): Lang => current;

/** The interface text in the chosen language. */
export const tr = (gl: string, es: string): string => (current === 'gl' ? gl : es);

/** Saves the choice and reloads, so every screen is rebuilt in the new language. */
export function chooseLang(next: Lang) {
  if (next === current) return;
  try { localStorage.setItem(KEY, next); } catch { /* the reload still applies it for this visit */ }
  current = next;
  location.reload();
}

/** Month names by hand: some browsers ship no Galician date data and print «M11». */
const MONTHS={gl:['xaneiro','febreiro','marzo','abril','maio','xuño','xullo','agosto','setembro','outubro','novembro','decembro'],es:['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']};
/** «28 de novembro», «28 de novembro de 1946»; short: «28 nov.» */
export function dateText(d:Date,{year=false,short=false,utc=false}={}):string{
 const day=utc?d.getUTCDate():d.getDate(),m=utc?d.getUTCMonth():d.getMonth(),y=utc?d.getUTCFullYear():d.getFullYear(),name=MONTHS[current][m];
 if(short)return `${day} ${name.slice(0,3)}.`;
 return `${day} de ${name}${year?` de ${y}`:''}`;
}
