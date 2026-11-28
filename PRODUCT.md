# Galiciana de Peto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

App principal (desde el 25 nov 2026): web instalable (PWA) en `pwa/`, con React 19, TypeScript y esbuild. Se publica en GitHub Pages (`petoacg/galicianadepeto-web`) y llega a Galiciana a través de Google Apps Script (`docs/apps-script/Code.gs`).

Segunda versión: APK de Android en Kotlin / Jetpack Compose, Material 3, Navigation Compose, OkHttp, Coil y Jsoup (0.4.5). Lo que funcione en la web se lleva después a la APK.

## Product Purpose

Consultar los documentos de Galiciana, investigar en su hemeroteca, leer páginas digitalizadas con búsqueda OCR y organizar hallazgos mediante páginas guardadas, carpetas y notas de referencia.

## Operating Context

El usuario investiga nombres, publicaciones y noticias históricas. La búsqueda y la lectura deben conservar el contexto entre pantallas. Se prueba en un Pixel 10 y en los Mac del usuario; no hay iPhone para pruebas. La app tiene que sentirse instalada y ágil en cualquier teléfono: lo lento es el camino hasta los datos (GitHub Pages, Apps Script y Galiciana), no el aparato.

Uso real: teléfono en vertical y con el tamaño de letra normal. La orientación horizontal y la letra ampliada al 200 % quedan fuera de las revisiones de diseño por decisión del usuario (lista en `.impeccable/critique/ignore.md`); la app no se bloquea en vertical.

## Capabilities and Constraints

Los documentos, metadatos e índices proceden del servicio de Galiciana. El texto OCR y las coordenadas ALTO pueden diferir; los fallos de conexión no deben presentarse como cero resultados. Favoritos, carpetas y notas existentes deben conservarse. Los documentos se muestran con sus colores originales.

## Brand Commitments

Nombre confirmado: «Galiciana de Peto». Autor y contacto del aviso legal se dejan vacíos hasta la fase final por instrucción del usuario. El aviso remite a los derechos indicados en cada documento, sin presumir dominio público de todos los fondos.

La web sigue el modo claro u oscuro del teléfono (desde el 25 nov 2026); el oscuro es el de las capturas aportadas. El visor es siempre oscuro, para que la página escaneada sea lo más luminoso de la pantalla. La APK sigue siendo sólo oscura.

El usuario mantiene los colores principales de identidad gallega y aprueba un diseño moderno, rápido e intuitivo. Se conserva la vieira. El término exacto «Nota de referencia» es una decisión explícita del usuario y un guiño al mundo archivístico e investigador.

## Product Principles

- Buscar, leer y guardar con pocos pasos y controles reconocibles.
- Dar protagonismo a los documentos y a los hallazgos.
- Mostrar los límites del OCR y del servicio sin perder el contexto.
- Proteger las anotaciones y los cambios sin guardar.

## Evidence on Hand

Página real aportada: El Pueblo Gallego, 01/07/1975, página 15, grupo 1264535. Siete consultas comprobadas en servicio, texto y coordenadas; evidencia en verification/REFERENCE_PAGE.md. La aplicación contiene favoritos y notas reales del usuario; las pruebas de almacenamiento de esta revisión usan preferencias aisladas.

## Navigation and scope

Hemeroteca ofrece el índice alfabético de periódicos y revistas y sus años/números. Colecciones agrupa otros tipos de documentos, con una ficha antes de abrir la copia. Materias y datos del catálogo separa índices y herramientas técnicas de la búsqueda OCR. «Sucesos y sociedad» es una opción temática orientativa dentro de los filtros generales, no un repositorio ni una clasificación editorial del archivo.

## Datos de investigación y portabilidad

La app se utiliza online para consultar Galiciana. No incorpora un archivo offline de imágenes, documentos ni OCR. Se mantienen las descargas existentes de JPEG y PDF. Sin cuentas ni inicio de sesión.

Los datos personales de investigación se almacenan en el teléfono: páginas marcadas, carpetas y asociaciones, Notas de referencia (incluidas las de páginas ya desmarcadas), consultas recientes, búsquedas guardadas, borrador con filtros, contexto de lectura y preferencias. Una copia ZIP ligera y versionada permite exportarlos/importarlos sin incluir documentos descargados. La importación se previsualiza; Combinar conserva diferencias por defecto y Reemplazar exige confirmación explícita.

La etiqueta abreviada del icono es «GdPeto», por indicación del usuario. No sustituye el nombre «Galiciana de Peto» dentro de la app o en su aviso legal.

## La PWA, app principal

Desde el 25 de noviembre de 2026 la web instalable es la app principal y la referencia de diseño (DESIGN.md); la APK ya no es su modelo. Conserva el nombre «Galiciana de Peto», la abreviatura «GdPeto», la vieira, los destinos Buscar / Explorar / Gardados y el término «Nota de referencia». Se usa sin instalar, pero invita a instalarla: una tarjeta en Inicio y un aviso tras la primera búsqueda de cada visita, hasta que se instale (se pueden apagar en Acerca de). Instalada, aparece en el menú de compartir de Android, tiene accesos directos y comparte páginas con un enlace que abre GdPeto.

La investigación personal reside en IndexedDB, separada por navegador, perfil y origen. No hay cuentas ni sincronización automática; la copia ZIP compatible con Android permite trasladarla. La interfaz puede abrir los datos locales sin conexión; imágenes, documentos, metadatos y OCR se consultan online. La pasarela mantiene sesiones de consulta temporales y aisladas, sin almacenar la investigación personal.

Publicada en https://petoacg.github.io/galicianadepeto-web/ (GitHub Pages), con Google Apps Script como pasarela hacia Galiciana. La pasarela JVM y el contenedor Docker de mismo origen quedan como alternativa no usada; detalles en `docs/PWA_IMPLEMENTATION.md`.

## Idioma

La interfaz está en gallego por defecto y en español a elección del usuario, desde Acerca de, por indicación del usuario. El contenido de los documentos se muestra como lo ofrece Galiciana.

