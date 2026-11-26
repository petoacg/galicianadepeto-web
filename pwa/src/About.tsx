import {tr} from './i18n';
import {useState} from 'react';
import {MaterialIcon, PageTitle} from './components';
import legalEs from './legal.json';
import legalGl from './legal_gl.json';
import {chooseLang,lang} from './i18n';
import {openInstall,installOfferSupported,installOfferOn,setInstallOfferOn} from './InstallGate';
import {fullscreenSupported,fullscreenOfferOn,setFullscreenOffer,installedApp} from './Fullscreen';

function Source({title,url}:{title:string;url:string}) {
  return <a className="native-source" href={url} target="_blank" rel="noopener noreferrer"><span>{title}</span><MaterialIcon name="open_in_new" size={20}/></a>;
}
export function About({onBack,onLegal,onBackup}:{onBack:()=>void;onLegal:()=>void;onBackup:()=>void}) {
  const [other,setOther]=useState(false),[offerOn,setOfferOn]=useState(fullscreenOfferOn),[installOn,setInstallOn]=useState(installOfferOn);
  return <><PageTitle title={tr('Acerca de','Acerca de')} onBack={onBack}/><div className="native-about">
    <section><h2 className="about-name">Galiciana de Peto</h2><p className="about-tagline">{tr('Galiciana, de peto.','Galiciana, de bolsillo.')}</p><p className="about-version">{tr('Versión web instalable 0.6.0','Versión web instalable 0.6.0')}</p></section>
    <p>{tr('Unha aplicación independente para consultar documentos e organizar os teus achados. Non é unha aplicación oficial da Xunta de Galicia.','Una aplicación independiente para consultar documentos y organizar tus hallazgos. No es una aplicación oficial de la Xunta de Galicia.')}</p>
    <section className="about-language"><h2>{tr('Idioma da aplicación','Idioma de la aplicación')}</h2><div className="about-language-chips" role="radiogroup" aria-label={tr('Idioma da aplicación','Idioma de la aplicación')}>
      {([['gl','Galego'],['es','Español']] as const).map(([code,label])=><button key={code} type="button" role="radio" aria-checked={lang()===code} className={'select-chip'+(lang()===code?' selected':'')} onClick={()=>chooseLang(code)}>{lang()===code&&<MaterialIcon name="check" size={18}/>}{label}</button>)}
    </div></section>
    {installOfferSupported()&&<section className="about-fullscreen"><h2>{tr('Instalación','Instalación')}</h2><label className="m3-switch-row"><span><strong>{tr('Ofrecer instalar a app','Ofrecer instalar la app')}</strong><small>{tr('Unha tarxeta en Inicio e un aviso tras a primeira busca de cada visita.','Una tarjeta en Inicio y un aviso tras la primera búsqueda de cada visita.')}</small></span><input type="checkbox" role="switch" className="m3-switch" checked={installOn} onChange={e=>{setInstallOfferOn(e.target.checked);setInstallOn(e.target.checked)}}/></label></section>}
    {fullscreenSupported()&&<section className="about-fullscreen"><h2>{tr('Pantalla completa','Pantalla completa')}</h2><label className="m3-switch-row"><span><strong>{tr('Ofrecer pantalla completa ao abrir','Ofrecer pantalla completa al abrir')}</strong><small>{tr('Android sae da pantalla completa ao cambiar de app; este aviso permite recuperala cun toque.','Android sale de la pantalla completa al cambiar de app; este aviso permite recuperarla con un toque.')}</small></span><input type="checkbox" role="switch" className="m3-switch" checked={offerOn} onChange={e=>{setFullscreenOffer(e.target.checked);setOfferOn(e.target.checked)}}/></label></section>}
    {!installedApp()&&<button className="m3-filled-button about-install" onClick={openInstall}>{tr('Instalar a app','Instalar la app')}</button>}
    <button className="button full" onClick={onLegal}>{tr('Aviso legal e licenza','Aviso legal y licencia')}</button>
    <button className="button secondary full" onClick={onBackup}>{tr('Copia dos teus datos','Copia de tus datos')}</button>
    <section className="about-source-heading"><hr/><h2>{tr('Fontes dos documentos e datos','Fuentes de los documentos y datos')}</h2></section>
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
    </>}
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
