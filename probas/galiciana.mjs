// Galiciana y el script de Google, simulados con textos inventados: las pruebas no llaman a nadie.
export const obra = {path: '900001', title: 'Boletín de proba', pages: 6};
const b64 = text => Buffer.from(text).toString('base64');
const unit = (page, snippet) => `<div class="unidad_textual"><a href="grupo.do?path=${obra.path}&posicion=${page}&idImagen=${7000 + page}" data-analytics-recordtitle="${obra.title}">Páxina ${page}</a><ul class="texto_ocurrencias"><li>${snippet}</li></ul></div>`;
const results = `<html><body><div class="navegacion_resultados">1 al 1 de 1</div><div class="nav_registros"><div class="nav_registro"><span class="titulo">${obra.title}</span>${unit(2, 'O mestre canteiro traballou na ponte')}${unit(5, 'Outro mestre canteiro de Muros')}</div></div></body></html>`;
const pages = Array.from({length: obra.pages}, (_, i) => i + 1);
const mets = `<mets xmlns="http://www.loc.gov/METS/" xmlns:xlink="http://www.w3.org/1999/xlink"><dmdSec><title>${obra.title}</title></dmdSec><fileSec><fileGrp>${pages.map(n => `<file ID="F${n}"><FLocat xlink:href="imagen_id.do?idImagen=${7000 + n}"/></file><file ID="A${n}"><FLocat xlink:href="alto${n}.xml"/></file>`).join('')}</fileGrp></fileSec><structMap>${pages.map(n => `<div ORDER="${n}"><fptr FILEID="F${n}"/><fptr FILEID="A${n}"/></div>`).join('')}</structMap></mets>`;
const alto = `<alto><Layout><Page WIDTH="1000" HEIGHT="1400"><String CONTENT="mestre" HPOS="200" VPOS="300" WIDTH="120" HEIGHT="30"/><String CONTENT="canteiro" HPOS="330" VPOS="300" WIDTH="150" HEIGHT="30"/></Page></Layout></alto>`;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400"><rect width="1000" height="1400" fill="#eee"/></svg>';

/** Responde a todo lo que no sea la propia web. `log` recoge lo que se pidió; `slow(query)`, cuánto tarda cada búsqueda. */
export async function simulate(context, log, slow = () => 0) {
  await context.route(url => url.hostname !== '127.0.0.1', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === 'script.google.com') {
      const {name, args} = JSON.parse(request.postData());
      log.push(name + (name === 'recursoReferencia' ? ':' + args[0] + ':' + args[2] : name === 'buscarReferencia' ? ':' + args[0].query : ''));
      if (name === 'buscarReferencia') { await new Promise(done => setTimeout(done, slow(args[0].query))); log.push('resposta:' + args[0].query); }
      const value = name === 'buscarReferencia' ? {estado: 200, html: results, cursor: null}
        : name === 'recursoReferencia' ? (args[0] === 'mets' ? {mets: b64(mets)} : args[0] === 'alto' ? {alto: b64(alto)} : args[0] === 'ocr' ? {ocr: b64('O mestre canteiro')} : undefined) : undefined;
      return route.fulfill({json: value ? {ok: true, value} : {ok: false, error: 'simulado'}, headers: {'access-control-allow-origin': '*'}}).catch(() => log.push('cancelada'));
    }
    if (url.pathname.endsWith('imagen_id.do')) {
      log.push('imaxe:' + url.searchParams.get('idImagen'));
      return route.fulfill({contentType: 'image/svg+xml', body: svg});
    }
    return route.abort();
  });
}
