// Galiciana y el script de Google, simulados con textos inventados: las pruebas no llaman a nadie.
export const obra = {path: '900001', title: 'Boletín de proba', pages: 6};
const b64 = text => Buffer.from(text).toString('base64');
const unit = (page, snippet) => `<div class="unidad_textual"><a href="grupo.do?path=${obra.path}&posicion=${page}&idImagen=${7000 + page}" data-analytics-recordtitle="${obra.title}">Páxina ${page}</a><ul class="texto_ocurrencias"><li>${snippet}</li></ul></div>`;
// Como Galiciana desde nov. 2026: las páginas sin número impreso dicen «Página -» y el enlace sólo lleva la imagen.
const sinNumero = (page, snippet) => `<li class="unidad_textual"><a href="../catalogo_imagenes/grupo.do?path=${obra.path}&amp;idImagen=${7000 + page}&amp;texto_busqueda=x" data-analytics-recordtitle="${obra.title}">Página -</a><ul class="texto_ocurrencias"><li>${snippet}</li></ul></li>`;
const resultsFor = query => `<html><body><div class="navegacion_resultados">1 al 1 de 1</div><div class="nav_registros"><div class="nav_registro"><span class="titulo">${obra.title}</span>${unit(2, 'O mestre canteiro traballou na ponte')}${unit(5, 'Outro mestre canteiro de Muros')}${query === 'canteiro portada' ? sinNumero(3, 'O mestre canteiro da portada') + sinNumero(4, 'Canteiro da portada sen número') : ''}</div></div></body></html>`;
const pages = Array.from({length: obra.pages}, (_, i) => i + 1);
const mets = `<mets xmlns="http://www.loc.gov/METS/" xmlns:xlink="http://www.w3.org/1999/xlink"><dmdSec><title>${obra.title}</title></dmdSec><fileSec><fileGrp>${pages.map(n => `<file ID="F${n}"><FLocat xlink:href="https://biblioteca.galiciana.gal/gl/catalogo_imagenes/imagen_id.cmd?idImagen=${7000 + n}"/></file><file ID="A${n}"><FLocat xlink:href="https://biblioteca.galiciana.gal/es/catalogo_imagenes/descargarAlto.cmd?path=${obra.path}&amp;posicion=${n}"/></file>`).join('')}</fileGrp></fileSec><structMap>${pages.map(n => `<div ORDER="${n}"><fptr FILEID="F${n}"/><fptr FILEID="A${n}"/></div>`).join('')}</structMap></mets>`;
const metsPdf = `<mets xmlns="http://www.loc.gov/METS/" xmlns:xlink="http://www.w3.org/1999/xlink"><fileSec><fileGrp><file ID="FID0" MIMETYPE="application/pdf"><FLocat xlink:href="https://biblioteca.galiciana.gal/gl/catalogo_imagenes/imagen_id.do?idImagen=8001"/></file></fileGrp></fileSec><structMap><div LABEL="Fichero PDF"><div ORDER="1"><fptr FILEID="FID0"/></div></div></structMap></mets>`;
const metsSenTexto = mets.replaceAll('descargarAlto', 'outro');
export const obraPdf = '900002', obraSenTexto = '900003';
const copia = (path, kind, id) => `<a id="${id}${path}" href="../catalogo_imagenes/grupo.do?path=${path}" data-analytics-grouptitle="${kind}"><i class="media-application__${kind === 'Versión PDF' ? 'pdf' : 'mets'}"></i></a>`;
/** A ficha de Galiciana, co PDF enlazado antes ca copia con páxinas, como a de verdade. */
export const ficha = only => `<html><body><div class="ficha">${copia(obraPdf, 'Versión PDF', 'fav')}${only ? copia(only, 'Versión PDF', 'gr') : copia(obra.path, 'Copia dixital', 'gr') + copia(obraPdf, 'Versión PDF', 'gr')}<p class="ficha_valor"><span class="etiqueta">Título: </span><span class="valor"><span class="field_value"><bdi>${obra.title}</bdi></span></span></p><p class="ficha_valor"><span class="etiqueta">Materia: </span><span class="valor"><span class="field_value"><bdi>Canteiros</bdi></span><span class="field_value"><bdi>Pontes</bdi></span></span></p></div></body></html>`;
const alto = `<alto><Layout><Page WIDTH="1000" HEIGHT="1400"><String CONTENT="mestre" HPOS="200" VPOS="300" WIDTH="120" HEIGHT="30"/><String CONTENT="canteiro" HPOS="330" VPOS="300" WIDTH="150" HEIGHT="30"/></Page></Layout></alto>`;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400"><rect width="1000" height="1400" fill="#eee"/></svg>';

/** Responde a todo lo que no sea la propia web. `log` recoge lo que se pidió; `slow(query)`, cuánto tarda cada búsqueda. */
export async function simulate(context, log, slow = () => 0, options = {}) {
  await context.route(url => url.hostname !== '127.0.0.1', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === 'script.google.com') {
      const {name, args} = JSON.parse(request.postData());
      // The warm-up when the search field gets focus (api.ts warmUp): answered like Apps Script, not logged.
      if (name === 'calentar') return route.fulfill({json: {ok: false, error: 'Operación no admitida.'}, headers: {'access-control-allow-origin': '*'}}).catch(() => {});
      // «Tal día como hoxe» on Inicio asks for the year lists of the dailies: an empty year, not logged, unless a test gives one.
      if (name === 'catalogoReferencia' && /numeros_por_mes/.test(args[0])) return route.fulfill({json: {ok: true, value: options.ano?.(args[0]) ?? '<html><body><p>Sen números</p></body></html>'}, headers: {'access-control-allow-origin': '*'}}).catch(() => {});
      log.push(name + (name === 'recursoReferencia' ? ':' + args[0] + ':' + args[2] : name === 'buscarReferencia' ? ':' + args[0].query : ''));
      if (name === 'buscarReferencia') { await new Promise(done => setTimeout(done, slow(args[0].query))); log.push('resposta:' + args[0].query); }
      if (name === 'recursoReferencia' && args[0] === 'mets' && options.waitMets) await options.waitMets();
      const value = name === 'buscarReferencia' ? {estado: 200, html: resultsFor(args[0].query), cursor: null}
        : name === 'recursoReferencia' ? (options.fallos?.(args) ? undefined : args[0] === 'mets' ? {mets: b64(args[1] === obraPdf ? metsPdf : args[1] === obraSenTexto ? metsSenTexto : mets)} : args[0] === 'alto' ? {alto: b64(alto)} : args[0] === 'ocr' ? {ocr: b64('O mestre canteiro')} : undefined) : name === 'catalogoReferencia' && options.ficha ? options.ficha : undefined;
      return route.fulfill({json: value ? {ok: true, value} : {ok: false, error: 'simulado'}, headers: {'access-control-allow-origin': '*'}}).catch(() => log.push('cancelada'));
    }
    if (url.pathname.endsWith('imagen_id.do') && url.searchParams.get('idImagen') !== '8001') {
      log.push('imaxe:' + url.searchParams.get('idImagen'));
      return route.fulfill({contentType: 'image/svg+xml', body: svg});
    }
    return route.abort();
  });
}
