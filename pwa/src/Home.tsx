import {tr} from './i18n';
import {useEffect, useState} from 'react';
import type {Hit, Route, SearchPreset} from './types';
import {BASE, emptyPreset, errorText, thumb, warmUp} from './api';
import {MaterialIcon, ShellIcon, Status, Thumbnail, TabRootBar} from './components';
import {InstallCard} from './InstallGate';
import {TodayInHistory} from './OnThisDay';
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
  const [data, setData] = useState<ArchiveSnapshot>();
  const [query, setQuery] = useState(() => {try{return sessionStorage.getItem('gdpeto-home-query') || '';}catch{return '';}});
  const [error, setError] = useState('');
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
    {/* Axustes (language, theme, install, full screen, about) from the gear; install and «As túas buscas» are also here, where a first visit looks. */}
    <TabRootBar title="Galiciana de Peto">
      <button className="icon-button" aria-label={tr('Axustes','Ajustes')} onClick={() => navigate({screen: 'about'})}><MaterialIcon name="settings"/></button>
    </TabRootBar>
    <div className="native-home-content">
      <section className="native-home-search">
        <form onSubmit={e => {e.preventDefault(); search();}}>
          <label className={'native-search-field ' + (query ? 'has-value' : '')}>
            <span>{tr('A túa busca','Tu búsqueda')}</span>
            <input aria-label={tr('A túa busca','Tu búsqueda')} value={query} onFocus={warmUp} placeholder={tr('Un nome, un lugar, unha frase…','Un nombre, un lugar, una frase…')} enterKeyHint="search"
              onChange={e => setQuery(e.target.value)}/>
            {query && <button type="button" className="icon-button" aria-label={tr('Borrar a túa busca','Borrar tu búsqueda')} onClick={() => setQuery('')}>
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
      <TodayInHistory onOpen={onOpen}/>
      <InstallCard/>
      <Status error={error}/>
      {/* Before anything is read or saved, each section already shows its shape: the same box, the
       * same size, an icon and one line on what will appear there. Not buttons: nothing to press yet. */}
      {data && <section className="native-reading">
        <h2>{tr('Continuar lendo','Continuar leyendo')}</h2>
        {!reading ? <div className="native-continue native-empty">
          <span className="native-empty-icon"><MaterialIcon name="menu_book" size={26}/></span>
          <span className="native-continue-copy"><strong>{tr('Aínda non abriches nada','Aún no has abierto nada')}</strong>
            <small>{tr('Aquí estará a última páxina.','Aquí estará la última página.')}</small></span>
        </div> : <button className="native-continue" onClick={() => onOpen(reading)}>
          {reading.imageId && <Thumbnail src={thumb(reading)}/>}
          <span className="native-continue-copy"><strong>{publicationIdentity(reading.title, reading.parentTitle).shortTitle || 'Documento'}</strong>
            <small>{publicationDetails(reading)}</small></span>
          <MaterialIcon name="arrow_forward"/>
        </button>}
      </section>}
      {data && <section className="native-saved">
        <div className="native-saved-heading">
          <h2>{tr('Gardado hai pouco','Guardado hace poco')}</h2>
          {saved.length > 0 && <button className="text-button" onClick={() => navigate({screen: 'saved'})}>{tr('Ver todos','Ver todos')}</button>}
        </div>
        <div className="native-saved-gallery">
          {!saved.length && <div className="native-saved-item native-empty">
            <span className="thumbnail native-empty-thumb"><span className="native-empty-icon"><ShellIcon size={24}/></span></span>
            <strong>{tr('Garda coa vieira','Guarda con la vieira')}</strong>
            <small>{tr('As páxinas que gardes','Las páginas que guardes')}</small>
            <small>{tr('aparecen aquí','aparecen aquí')}</small>
          </div>}
          {!saved.length && [0,1].map(n => <span key={n} className="native-saved-item native-empty native-empty-ghost" aria-hidden="true"><span className="thumbnail native-empty-thumb"/></span>)}
          {saved.slice(0, 6).map(hit => {
            const identity = publicationIdentity(hit.title, hit.parentTitle);
            return <button className="native-saved-item" key={`${hit.path}|${hit.position}`} onClick={() => onOpen(hit)}>
              <Thumbnail src={thumb(hit)}/>
              <strong>{identity.shortTitle || 'Documento'}</strong>
              {identity.date && <small>{identity.date}</small>}
              <small>{[identity.issue, tr(`Páxina ${hit.position}`,`Página ${hit.position}`)].filter(Boolean).join(' · ')}</small>
            </button>;
          })}
        </div>
      </section>}
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
