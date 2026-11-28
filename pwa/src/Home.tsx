import {tr} from './i18n';
import {useEffect, useState} from 'react';
import type {Hit, Route, SearchPreset} from './types';
import {emptyPreset, errorText, thumb, warmUp} from './api';
import {MaterialIcon, Status, Thumbnail, TabRootBar} from './components';
import {TodayInHistory} from './OnThisDay';
import {store, type ArchiveSnapshot} from './storage';
import {publicationIdentity, publicationDetails} from './publication';


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
    {/* Each thing once: Axustes (language, theme, install, full screen, about) from here only. */}
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
          <button className="text-button" onClick={() => navigate({screen: 'search', preset: {...emptyPreset, advanced: true}, form: true})}>{tr('Buscar con filtros','Buscar con filtros')}</button>
        </div>
      </section>
      <TodayInHistory onOpen={onOpen}/>
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
      {saved.length > 0 && <section className="native-saved">
        <div className="native-saved-heading">
          <h2>{tr('Gardado hai pouco','Guardado hace poco')}</h2>
          <button className="text-button" onClick={() => navigate({screen: 'saved'})}>{tr('Ver todos','Ver todos')}</button>
        </div>
        <div className="native-saved-gallery">
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
    </div>
  </div>;
}
