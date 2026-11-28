import {tr,dateText} from './i18n';
import {useState} from 'react';
import {MaterialIcon, PageTitle, Thumbnail} from './components';
import {AlertDialog} from './FolderSheet';
import type {Hit} from './types';
import {thumb} from './api';
import {publicationIdentity} from './publication';
import {chooseTheme,theme,type Theme} from './theme';
import {historyOn,setHistoryOn,readingHistory,clearReadingHistory} from './readingHistory';
import legalEs from './legal.json';
import legalGl from './legal_gl.json';
import {chooseLang,lang} from './i18n';
import {openInstall,installOfferSupported,installOfferOn,setInstallOfferOn} from './InstallGate';
import {fullscreenSupported,fullscreenOfferOn,setFullscreenOffer,installedApp,enterFullscreen} from './Fullscreen';

function Source({title,url}:{title:string;url:string}) {
  return <a className="native-source" href={url} target="_blank" rel="noopener noreferrer"><span>{title}</span><MaterialIcon name="open_in_new" size={20}/></a>;
}
export function About({onBack,onLegal,onHistory}:{onBack:()=>void;onLegal:()=>void;onHistory:()=>void}) {
  const [other,setOther]=useState(false),[fullscreenError,setFullscreenError]=useState(''),[offerOn,setOfferOn]=useState(fullscreenOfferOn),[installOn,setInstallOn]=useState(installOfferOn),[current,setCurrent]=useState<Theme>(theme),[keepHistory,setKeepHistory]=useState(historyOn);
  const blocked=()=>setFullscreenError(tr('O navegador non permitiu activala.','El navegador no permitió activarla.'));
  return <><PageTitle title={tr('Axustes','Ajustes')} onBack={onBack}/><div className="native-about">
    {/* Two parts: the settings themselves, then what the app is and where its documents come from. */}
    <section className="about-group"><h2>{tr('Idioma','Idioma')}</h2><div className="about-language-chips" role="radiogroup" aria-label={tr('Idioma da aplicación','Idioma de la aplicación')}>
      {([['gl','Galego'],['es','Español']] as const).map(([code,label])=><button key={code} type="button" role="radio" aria-checked={lang()===code} className={'select-chip'+(lang()===code?' selected':'')} onClick={()=>chooseLang(code)}>{lang()===code&&<MaterialIcon name="check" size={18}/>}{label}</button>)}
    </div></section>
    <section className="about-group"><h2>{tr('Tema','Tema')}</h2><div className="about-language-chips" role="radiogroup" aria-label={tr('Tema','Tema')}>
      {([['system',tr('Como o teléfono','Como el teléfono')],['light',tr('Claro','Claro')],['dark',tr('Escuro','Oscuro')]] as const).map(([code,label])=><button key={code} type="button" role="radio" aria-checked={current===code} className={'select-chip'+(current===code?' selected':'')} onClick={()=>{chooseTheme(code);setCurrent(code)}}>{current===code&&<MaterialIcon name="check" size={18}/>}{label}</button>)}
    </div><p className="about-note">{tr('O visor segue sempre en escuro, para que a páxina dixitalizada sexa o máis luminoso.','El visor sigue siempre en oscuro, para que la página digitalizada sea lo más luminoso.')}</p></section>
    <section className="about-group"><h2>{tr('Historial de lectura','Historial de lectura')}</h2>
      <label className="m3-switch-row about-row"><span><strong>{tr('Gardar as obras que abro','Guardar las obras que abro')}</strong><small>{tr('Por orde, só neste navegador. Non entra na copia dos teus datos.','Por orden, solo en este navegador. No entra en la copia de tus datos.')}</small></span><input type="checkbox" role="switch" className="m3-switch" checked={keepHistory} onChange={e=>{setHistoryOn(e.target.checked);setKeepHistory(e.target.checked)}}/></label>
      {(keepHistory||readingHistory().length>0)&&<button className="about-row about-link" onClick={onHistory}><strong>{tr('Ver o historial','Ver el historial')}</strong><MaterialIcon name="chevron_right"/></button>}
    </section>
    {(!installedApp()||installOfferSupported()||fullscreenSupported())&&<section className="about-group"><h2>{tr('Esta app no teléfono','Esta app en el teléfono')}</h2>
      {!installedApp()&&<div className="about-row"><span><strong>{tr('Instalar GdPeto','Instalar GdPeto')}</strong><small>{tr('Como unha app, coa súa icona.','Como una app, con su icono.')}</small></span><button className="m3-outlined-button" onClick={openInstall}>{tr('Instalar','Instalar')}</button></div>}
      {installOfferSupported()&&<label className="m3-switch-row about-row"><span><strong>{tr('Lembrarme instalala','Recordarme instalarla')}</strong><small>{tr('Un aviso tras a primeira busca de cada visita.','Un aviso tras la primera búsqueda de cada visita.')}</small></span><input type="checkbox" role="switch" className="m3-switch" checked={installOn} onChange={e=>{setInstallOfferOn(e.target.checked);setInstallOn(e.target.checked)}}/></label>}
      {fullscreenSupported()&&!installedApp()&&<div className="about-row"><span><strong>{tr('Pantalla completa','Pantalla completa')}</strong><small>{fullscreenError||tr('Agocha as barras do navegador.','Oculta las barras del navegador.')}</small></span><button className="m3-outlined-button" onClick={()=>{setFullscreenError('');void enterFullscreen().then(ok=>{if(!ok)blocked()}).catch(blocked)}}>{tr('Activar','Activar')}</button></div>}
      {fullscreenSupported()&&<label className="m3-switch-row about-row"><span><strong>{tr('Ofrecer pantalla completa ao abrir','Ofrecer pantalla completa al abrir')}</strong><small>{tr('Android sae dela ao cambiar de app; o aviso permite recuperala cun toque.','Android sale de ella al cambiar de app; el aviso permite recuperarla con un toque.')}</small></span><input type="checkbox" role="switch" className="m3-switch" checked={offerOn} onChange={e=>{setFullscreenOffer(e.target.checked);setOfferOn(e.target.checked)}}/></label>}
    </section>}
    <h2 className="about-part">{tr('Acerca de','Acerca de')}</h2>
    <section className="about-identity"><p className="about-name">Galiciana de Peto</p><p className="about-tagline">{tr('Galiciana, de peto.','Galiciana, de bolsillo.')}</p><p className="about-version">{tr('Versión web instalable 0.6.0','Versión web instalable 0.6.0')}</p>
    <p>{tr('Unha aplicación independente para consultar documentos e organizar os teus achados. Non é unha aplicación oficial da Xunta de Galicia.','Una aplicación independiente para consultar documentos y organizar tus hallazgos. No es una aplicación oficial de la Xunta de Galicia.')}</p></section>
    <button className="about-row about-link" onClick={onLegal}><strong>{tr('Aviso legal e licenza','Aviso legal y licencia')}</strong><MaterialIcon name="chevron_right"/></button>
    <section className="about-group"><h2>{tr('Fontes dos documentos e datos','Fuentes de los documentos y datos')}</h2>
    <Source title="Biblioteca Dixital de Galicia" url="https://biblioteca.galiciana.gal"/>
    <Source title="Galiciana Patrimonio Dixital" url="https://www.galiciana.gal/arpadhub/es/inicio/inicio.do"/>
    <Source title={tr('Datos abertos de Galiciana','Datos abiertos de Galiciana')} url="https://datos-abertos.galiciana.gal/arpad-bibdix-lod/"/>
    <p className="about-source-note">{tr('Estas ligazóns ábrense no teu navegador.','Estos enlaces se abren en tu navegador.')}</p>
    <button className="text-button" onClick={()=>setOther(!other)}>{other?tr('Ocultar outros recursos','Ocultar otros recursos'):tr('Outros recursos de investigación','Otros recursos de investigación')}</button>
    {other&&<>
      <Source title="Galiciana Arquivo Dixital" url="https://arquivo.galiciana.gal/arpadweb/es/inicio/inicio.do"/>
      <Source title="Memoria e Concordia" url="https://memoriaeconcordia.galiciana.gal/es"/>
      <Source title="Prensa histórica galega" url="https://prensahistorica.galiciana.gal/es"/>
      <Source title="Hispana" url="https://hispana.mcu.es"/>
      <Source title="Europeana" url="https://www.europeana.eu"/>
      <Source title="Digital Public Library of America" url="https://dp.la"/>
    </>}</section>
  </div></>;
}
/** Axustes › Historial de lectura: the works opened, newest first. */
export function ReadingHistory({onBack,onOpen}:{onBack:()=>void;onOpen:(hit:Hit)=>void}){
  const [list,setList]=useState(readingHistory),[ask,setAsk]=useState(false);
  const when=(at:number)=>{const d=new Date(at);return `${dateText(d,{short:true})} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
  return <><PageTitle title={tr('Historial de lectura','Historial de lectura')} onBack={onBack}/><div className="content reading-history">
    {!historyOn()&&<p className="muted">{tr('O historial está apagado: non se engaden obras novas.','El historial está apagado: no se añaden obras nuevas.')}</p>}
    {!list.length?<p>{tr('Aínda non abriches ningunha obra con el aceso.','Todavía no has abierto ninguna obra con él encendido.')}</p>:<>
    <ol className="reading-history-list">{list.map(v=>{const id=publicationIdentity(v.title,v.parentTitle);return <li key={v.path}><button onClick={()=>onOpen({path:v.path,position:v.position,imageId:v.imageId,title:v.title,parentTitle:v.parentTitle,snippets:[]})}><Thumbnail src={thumb({imageId:v.imageId})}/><span><strong>{id.shortTitle||v.title}</strong><small>{[id.date,tr(`páx. ${v.position}`,`pág. ${v.position}`)].filter(Boolean).join(' · ')}</small><small>{when(v.at)}</small></span></button></li>})}</ol>
    <button className="text-button" onClick={()=>setAsk(true)}>{tr('Borrar o historial','Borrar el historial')}</button></>}
    {ask&&<AlertDialog title={tr('Borrar o historial?','¿Borrar el historial?')} text={tr('Quítanse todas as obras desta lista. Os teus gardados e notas non se tocan.','Se quitan todas las obras de esta lista. Tus guardados y notas no se tocan.')} confirm={tr('Borrar','Borrar')} onConfirm={()=>{clearReadingHistory();setList([]);setAsk(false)}} onCancel={()=>setAsk(false)}/>}
  </div></>;
}
export function Legal({onBack}:{onBack:()=>void}) {
  return <div className="native-legal-screen"><PageTitle title={tr('Aviso legal','Aviso legal')} onBack={onBack}/><article className="native-legal">
    {(lang()==='gl'?legalGl:legalEs).map((paragraph,index)=>{
      const heading=index<2||/^[1-4]\. .+/.test(paragraph);
      return index===0?<h2 key={index} className="legal-title">{paragraph}</h2>:heading?<h2 key={index}>{paragraph}</h2>:<p key={index}>{paragraph}</p>;
    })}
    <Source title={tr('Consultar a licenza CC BY-NC-SA 4.0','Consultar la licencia CC BY-NC-SA 4.0')} url="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es"/>
    <Source title={tr('Aviso legal de Galiciana','Aviso legal de Galiciana')} url="https://biblioteca.galiciana.gal/es/contenido/avisolegal.do"/>
  </article></div>;
}
