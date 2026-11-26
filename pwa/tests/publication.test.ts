import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicationIdentity} from '../src/publication';
test('Publication labels reproduce the Android reference cases without inventing metadata',()=>{
 const original='El pueblo gallego : rotativo de la mañana: Ano 51 Número 18760 - 1975 xullo 1';
 assert.deepEqual(publicationIdentity(original),{fullTitle:original,shortTitle:'El pueblo gallego',date:'1975 xullo 1',issue:'Número 18760'});
 assert.equal(publicationIdentity('El Progreso: Año LXVIII Número 21127 - 1975 julio 13').shortTitle,'El Progreso');
 assert.equal(publicationIdentity('El correo de Galicia: Num. 4902 (20/03/1917)').date,'20/03/1917');
 assert.equal(publicationIdentity('Galicia: mapas y territorios').shortTitle,'Galicia: mapas y territorios');
 assert.equal(publicationIdentity('Galicia: mapas y territorios').date,undefined);
 assert.equal(publicationIdentity('Número 42 - 1917-03-20','El correo de Galicia').shortTitle,'El correo de Galicia');
});
