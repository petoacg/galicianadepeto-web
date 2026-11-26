import {tr,lang} from './i18n';
import serverMessages from './serverMessages.json';

/** The gateway answers in Spanish, as the shared Android code does; show its messages in the chosen language. */
export const localized=(message:string)=>lang()==='gl'?((serverMessages as Record<string,string>)[message]??message):message;
/**
 * ErrorText.friendlyError: a failure is told in the user's terms, never as the transport's
 * own wording (which is Spanish and technical). Same categories and texts as Android.
 */
export function friendlyError(message:string):string{
 const m=message.trim(),known=(serverMessages as Record<string,string>)[m];
 if(known)return lang()==='gl'?known:m;
 if(/failed to fetch|networkerror|load failed|network request failed|sen conexión|sin conexión/i.test(m))return tr('Non hai conexión con Galiciana. Comproba a rede e téntao de novo.','No hay conexión con Galiciana. Comprueba la red y vuelve a intentarlo.');
 if(/tardando|tarda demasiado|timeout|timed out/i.test(m))return tr('Galiciana tarda demasiado en responder. Téntao de novo.','Galiciana tarda demasiado en responder. Vuelve a intentarlo.');
 if(/HTTP\s*\d|no está disponible|pasarela/i.test(m))return tr('Galiciana non responde agora. Téntao de novo nuns minutos.','Galiciana no responde ahora. Vuelve a intentarlo en unos minutos.');
 if(/hemeroteca/i.test(m))return tr('Galiciana non devolveu o índice de publicacións. Téntao de novo.','Galiciana no ha devuelto el índice de publicaciones. Vuelve a intentarlo.');
 if(/cat[aá]logo|colecci[oó]n/i.test(m)&&/devolv|devuelto|cargar/i.test(m))return tr('Galiciana non devolveu o catálogo. Téntao de novo.','Galiciana no ha devuelto el catálogo. Vuelve a intentarlo.');
 if(/devolv|devuelto|respuesta v[aá]lida|resultados/i.test(m))return tr('Galiciana non devolveu os resultados. Téntao de novo.','Galiciana no ha devuelto los resultados. Vuelve a intentarlo.');
 if(/caducado/i.test(m))return tr('A sesión de busca caducou. Volve buscar.','La sesión de búsqueda ha caducado. Vuelve a buscar.');
 if(/años de cuatro cifras/i.test(m))return tr('Introduce anos de catro cifras.','Introduce años de cuatro cifras.');
 if(/no quedan más registros/i.test(m))return tr('Non quedan máis rexistros.','No quedan más registros.');
 if(/imagen|jpeg/i.test(m))return tr('Galiciana non indica a imaxe dixitalizada desta páxina.','Galiciana no indica la imagen digitalizada de esta página.');
 if(/no v[aá]lid|no admitid|demasiado larg|no disponible en Apps Script|necesita una consulta/i.test(m))return tr('Produciuse un erro inesperado. Téntao de novo.','Se produjo un error inesperado. Vuelve a intentarlo.');
 return lang()==='gl'?localized(m):m;
}
import type {Hit,SearchPreset} from './types';
export const BASE='https://biblioteca.galiciana.gal';
export const proxy=(url:string)=>(globalThis as typeof globalThis&{gdpReferenceImage?:unknown}).gdpReferenceImage?url:'/api/media?url='+encodeURIComponent(url);
export const thumb=(hit:Pick<Hit,'imageId'>)=>hit.imageId?proxy(`${BASE}/es/media/object-miniature.do?id=${hit.imageId}`):undefined;
export const original=(hit:Hit)=>`${BASE}/es/catalogo_imagenes/grupo.do?path=${hit.path}&presentacion=pagina&posicion=${hit.position}`;
export async function api<T=any>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal,credentials:'same-origin'});const data=await response.json().catch(()=>({error:tr('Non se recibiu unha resposta válida. Comproba a conexión e téntao de novo.','No se ha recibido una respuesta válida. Comprueba la conexión y reintenta.')}));if(!response.ok||data.error)throw new Error(data.error?friendlyError(String(data.error)):tr('Galiciana non responde agora. Téntao de novo nuns minutos.','Galiciana no responde ahora. Vuelve a intentarlo en unos minutos.'));return data;}
export type SearchHit = Omit<Hit,'position'> & {position:number|null;unknownId?:string};
export interface Group {title:string;parentTitle?:string;pages:SearchHit[];occurrenceCount?:number}
export interface SearchResult {hits:SearchHit[];groups:Group[];nextUrls:string[];sortUrls:Record<string,string>;totalWorks?:number;incomplete:boolean;globalSortAvailable:boolean;unverifiedQuoted?:SearchHit[]}
export const emptyPreset:SearchPreset={query:'',title:'',author:'',place:'',yearFrom:'',yearTo:'',section:'',advanced:false,fullText:true};
export const keyOf=(h:SearchHit)=>`${h.path}|${h.position===null?(h.imageId?'image:'+h.imageId:'unknown:'+h.unknownId):h.position}`;
export const hitAliases=(h:SearchHit)=>[keyOf(h),...(h.imageId?[`${h.path}|image:${h.imageId}`]:[])];
export function identity(title:string){return title.replace(/\s*:\s*(rotativo|diario|semanario|periódico|periodico|revista)[\s\S]*/i,'').trim()||title;}
export const errorText=(e:unknown)=>e instanceof Error?friendlyError(e.message):tr('Produciuse un erro inesperado. Téntao de novo.','Se produjo un error inesperado. Vuelve a intentarlo.');

/**
 * The published web reaches Galiciana through Apps Script, whose connection and first answer are
 * the slow part. When someone starts a search (focus on the field), one tiny request opens that
 * way in advance, once per visit, so the real search does not pay for it. Apps Script answers it
 * with «Operación no admitida» at once; nothing reaches Galiciana.
 */
let warmed=false;
export function warmUp(){
 const endpoint=(globalThis as {gdpAppsScriptEndpoint?:string}).gdpAppsScriptEndpoint;
 if(warmed||!endpoint||!navigator.onLine)return;warmed=true;
 void fetch(endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({name:'calentar',args:[]}),priority:'low'} as RequestInit).catch(()=>{});
}
