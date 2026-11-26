import {tr} from './i18n';
import type {Hit} from './types';

/** Same presentation rules as Android PublicationIdentity.kt; original text stays intact. */
export function publicationIdentity(title: string, parentTitle?: string | null) {
  const fullTitle = title.trim();
  const months = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|xaneiro|febreiro|maio|xuño|xullo|setembro|outubro|novembro|decembro';
  const date = fullTitle.match(new RegExp(`\\b\\d{4}\\s+(?:${months})\\s+\\d{1,2}\\b`, 'i'))?.[0]
    ?? fullTitle.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const issue = fullTitle.match(/(?:Número|N[uú]m\.?|N[º°])\s*\d+(?:[-/]\d+)?/i)?.[0];
  const shorten = (value: string) => value
    .replace(/\s*:\s*(?:rotativo|diario|semanario|periódico|revista|boletín)\b.*/i, '')
    .replace(/\s*[:·-]?\s*(?:A[nñ]o\s+[IVXLCDM\d]+|N[uú]mero\s+\d|N[uú]m\.?\s+\d).*$/i, '')
    .trim().replace(/[:·-]+$/, '').trim();
  const short = shorten(fullTitle);
  const shortTitle = short && !/^(?:p[áa]gina|documento)\s*\d*$/i.test(short)
    ? short : (parentTitle && shorten(parentTitle)) || fullTitle;
  return {fullTitle, shortTitle, date, issue};
}
export function publicationDetails(hit: Hit) {
  const identity = publicationIdentity(hit.title, hit.parentTitle);
  return [identity.date, identity.issue, tr(`Páxina ${hit.position}`,`Página ${hit.position}`)].filter(Boolean).join(' · ');
}
