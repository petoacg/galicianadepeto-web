import {test} from 'node:test'
import assert from 'node:assert/strict'
import {dossierMarkdown} from '../src/dossier.ts'
test('Dossier retains Android fields and rights reminder without document content',()=>{
 const out=dossierMarkdown([{title:'Diario\nficticio',path:'123',position:2,snippets:['No se exporta en Markdown'],savedQuery:'"Galicia"',note:'Nota sintética'}],{'123|2':['Historia','Prensa']})
 assert.equal(out,'# Galiciana de Peto · Dossier de investigación\n\nReferencias y Notas de referencia exportadas. Los documentos se consultan en Galiciana; este archivo no incluye imágenes.\n\n## 1. Diario ficticio\n\nPágina 2\n\nFuente: https://biblioteca.galiciana.gal/es/catalogo_imagenes/grupo.do?path=123&presentacion=pagina&posicion=2\n\nCarpetas: Historia, Prensa\n\nConsulta: "Galicia"\n\n### Nota de referencia\n\nNota sintética\n\n---\n\nAntes de reutilizar imágenes o documentos, consulta las condiciones de derechos indicadas en cada ficha original.\n')
 assert.throws(()=>dossierMarkdown([{title:'X',path:'../x',position:1,snippets:[]}],{}),/válida/)
})
