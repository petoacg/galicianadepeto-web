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
