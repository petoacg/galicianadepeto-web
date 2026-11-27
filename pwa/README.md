# Código fuente de la PWA

Este directorio contiene el cliente React y el transporte usados para generar la web publicada en la raíz del repositorio. La pasarela de Google Apps Script no está incluida.

Con Node.js 22.12 o posterior:

```sh
cd pwa
npm ci
npm test
GDP_APPS_SCRIPT_URL='https://script.google.com/macros/s/ID_DEL_DESPLIEGUE/exec' node experiments/apps-script-reference/build.mjs
```

La web generada queda en `experiments/apps-script-reference/build/pages/`. Comprueba los cambios antes de copiarla a la raíz del repositorio para publicarla. Usa la URL del despliegue existente de la pasarela, no la URL de edición del proyecto.

La búsqueda muestra las páginas sin número en cuanto llega el HTML; su posición se resuelve en segundo plano desde el METS. Si se abre o guarda una de ellas antes de terminar, la acción espera el índice y señala cualquier error.

La copia local de la primera página y las peticiones en curso reutilizan consultas con la misma normalización de espacios y comillas que aplica el transporte, sin distinguir los identificadores y fechas de búsquedas guardadas. Se conservan las diferencias de mayúsculas, tildes y filtros; las copias anteriores siguen siendo legibles.

El paso de página responde al gesto sin esperar a descargar la imagen siguiente; mientras llega, el visor muestra la carga y permite reintentar si falla.
La previsualización y la página en carga conservan la misma silueta durante el paso; las páginas ya descargadas usan sus dimensiones reales desde el primer fotograma. La indicación táctil se cancela al desplazar el dedo, sin bloquear el desplazamiento de las listas. Al volver del visor, los resultados conservan su posición sin desplazamiento lateral de entrada.
Un fallo transitorio al pedir el texto OCR tiene un reintento automático; si también falla, el lector conserva la opción de reintentar manualmente.

La prueba táctil del visor usa Chrome y respuestas simuladas, sin consultar Galiciana: `node tests/viewer-gestures.mjs`. Por defecto busca Chrome en `/usr/bin/google-chrome`; se puede indicar otra ruta con `CHROME_PATH`.
