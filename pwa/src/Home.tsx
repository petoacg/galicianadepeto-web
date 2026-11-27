import {enterFullscreen,installedApp} from './Fullscreen';
import {InstallCard} from './InstallGate';
import {tr} from './i18n';
import {Maximize, Minimize} from 'lucide-react';
import {useEffect, useState} from 'react';
import type {Hit, Route, SearchPreset} from './types';
import {BASE, emptyPreset, errorText, thumb, warmUp} from './api';
import {MaterialIcon, ShellIcon, Status, Thumbnail, TabRootBar} from './components';
import {store, type ArchiveSnapshot} from './storage';
import {publicationIdentity, publicationDetails} from './publication';

const featured = [
  ['Grandes fiestas en Porriño', '1960', '13124554', '577655'],
  ['Puebla del Caramiñal: fiestas de septiembre', '1960', '13787413', '583444'],
  ['II Certamen Internacional de Cine de Humor', '1974', '14185891', '615091'],
  ['Fiestas del Berbés', '1963', '13872855', '586681'],
  ['Programa de las fiestas del Patrón', '1888', '13948376', '417147'],
  ['Grandes fiestas tradicionales del Apóstol', '1939', '14098722', '601479'],
  ['La voz del Centro', '1917-1918', '14175789', '615025'],
  ['El agrario', '1918-1926', '14153014', '615029'],
];

interface Props {
  onOpen: (hit: Hit) => void;
  onSearch: (preset: SearchPreset) => void;
  navigate: (route: Route) => void;
}
export default function Home({onOpen, onSearch, navigate}: Props) {
  // Installed as an app the window already belongs to it; the button is only for a browser tab.
  const installed = installedApp();
  const [data, setData] = useState<ArchiveSnapshot>();
  const [query, setQuery] = useState(() => {try{return sessionStorage.getItem('gdpeto-home-query') || '';}catch{return '';}});
  const [error, setError] = useState('');
  const [fullscreen,setFullscreen]=useState(Boolean(document.fullscreenElement));
  const [fullscreenError,setFullscreenError]=useState('');
  useEffect(()=>{
    const update=()=>setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange',update);
    return()=>document.removeEventListener('fullscreenchange',update);
  },[]);
  async function toggleFullscreen(){
    setFullscreenError('');
    try{
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(!await enterFullscreen()) throw new Error('Fullscreen unavailable');
    }catch{setFullscreenError(tr('O navegador non permitiu activar a pantalla completa.','El navegador no permitió activar la pantalla completa.'));}
  }
  useEffect(() => {
    const refresh = () => store.snapshot().then(setData).catch(e => setError(errorText(e)));
    void refresh();
    return store.subscribe(() => void refresh());
  }, []);
  useEffect(() => {try{sessionStorage.setItem('gdpeto-home-query', query);}catch{/* The query remains usable in this view. */}}, [query]);
  function search() {
    if (query.trim()) onSearch({...emptyPreset, query: query.trim()});
  }
  const reading = data?.reading;
  const saved = data?.hits || [];
  return <div className="native-home">
    <TabRootBar title="Galiciana de Peto" heading={false}>
      {document.fullscreenEnabled&&!installed&&<button className="icon-button" aria-label={fullscreen?tr('Saír da pantalla completa','Salir de pantalla completa'):tr('Pantalla completa','Pantalla completa')} onClick={()=>void toggleFullscreen()}><MaterialIcon name={fullscreen?'fullscreen_exit':'fullscreen'}/></button>}
      
      <button className="icon-button" aria-label={tr('Acerca de e aviso legal','Acerca de y aviso legal')} onClick={() => navigate({screen: 'about'})}><MaterialIcon name="info"/></button>
    </TabRootBar>
    <div className="native-home-content">
      {fullscreenError && <p role="alert" className="home-fullscreen-error">{fullscreenError}</p>}
      
      <section className="native-home-search">
        <h1>{tr('Busca en Galiciana','Busca en Galiciana')}</h1>
        <p>{tr('Persoas, lugares e historias entre as súas páxinas.','Personas, lugares e historias entre sus páginas.')}</p>
        <form onSubmit={e => {e.preventDefault(); search();}}>
          <label className={'native-search-field ' + (query ? 'has-value' : '')}>
            <span>{tr('A túa busca','Tu búsqueda')}</span>
            <input aria-label={tr('A túa busca','Tu búsqueda')} value={query} onFocus={warmUp} placeholder={tr('Palabras, persoas ou lugares','Palabras, personas o lugares')} enterKeyHint="search"
              onChange={e => setQuery(e.target.value)}/>
            {query && <button type="button" className="icon-button" aria-label={tr('Borrar a túa busca','Borrar Tu búsqueda')} onClick={() => setQuery('')}>
              <MaterialIcon name="close"/>
            </button>}
            {query.trim() && <button type="submit" className="icon-button native-field-search" aria-label={tr('Buscar','Buscar')}><MaterialIcon name="search"/></button>}
          </label>
          {query.trim() && <button className="button home-submit"><MaterialIcon name="search" size={18}/>{tr('Buscar','Buscar')}</button>}
        </form>
        <div className="native-search-links">
          <button className="text-button" onClick={() => navigate({screen: 'history'})}>{tr('As túas buscas','Tus búsquedas')}</button>
          <button className="text-button" onClick={() => navigate({screen: 'search', preset: {...emptyPreset, advanced: true}, form: true})}>{tr('Buscar con filtros','Buscar con filtros')}</button>
        </div>
      </section>
      <InstallCard/>
      <Status error={error}/>
      {reading && <section className="native-reading">
        <h2>{tr('Continuar lendo','Continuar leyendo')}</h2>
        <button className="native-continue" onClick={() => onOpen(reading)}>
          {reading.imageId && <Thumbnail src={thumb(reading)}/>}
          <span className="native-continue-copy"><strong>{publicationIdentity(reading.title, reading.parentTitle).shortTitle || 'Documento'}</strong>
            <small>{publicationDetails(reading)}</small></span>
          <MaterialIcon name="arrow_forward"/>
        </button>
      </section>}
      <section className="native-saved">
        <div className="native-saved-heading">
          <button className="icon-button" aria-label={tr('Abrir Gardados','Abrir favoritos')} onClick={() => navigate({screen: 'saved'})}><ShellIcon size={28}/></button>
          <div><h2>{tr('Gardados','Guardados')}</h2><p>{saved.length ? `${saved.length} ${saved.length === 1 ? tr('páxina gardada','página guardada') : tr('páxinas gardadas','páginas guardadas')}` : tr('Garda páxinas coa vieira para volver a elas.','Guarda páginas con la vieira para volver a ellas.')}</p></div>
          <button className="text-button" onClick={() => navigate({screen: 'saved'})}>{tr('Abrir','Abrir')}</button>
        </div>
        {saved.length > 0 && <div className="native-saved-gallery">
          {saved.slice(0, 6).map(hit => {
            const identity = publicationIdentity(hit.title, hit.parentTitle);
            return <button className="native-saved-item" key={`${hit.path}|${hit.position}`} onClick={() => onOpen(hit)}>
              <Thumbnail src={thumb(hit)}/>
              <strong>{identity.shortTitle || 'Documento'}</strong>
              {identity.date && <small>{identity.date}</small>}
              <small>{[identity.issue, tr(`Páxina ${hit.position}`,`Página ${hit.position}`)].filter(Boolean).join(' · ')}</small>
            </button>;
          })}
        </div>}
      </section>
      <section className="native-featured">
        <h2>{tr('Obras destacadas','Obras destacadas')}</h2>
        <div className="native-featured-gallery">
          {featured.map(([title, year, imageId, record]) => <button className="native-featured-item" key={record}
            onClick={() => navigate({screen: 'record', url: `${BASE}/es/consulta/registro.do?id=${record}`, title, featured: true})}>
            <Thumbnail src={`${BASE}/es/media/object-miniature.do?id=${imageId}`}/><strong>{title}</strong><small>{year}</small>
          </button>)}
        </div>
      </section>
      
    </div>
  </div>;
}
