---
name: Galiciana de Peto
description: Archivo gallego contemporáneo, centrado en buscar, leer y documentar hallazgos.
colors:
  galiciana-blue: "#8BCCFF"
  galiciana-blue-deep: "#12476D"
  galiciana-blue-light: "#1F6394"
  shell-celeste: "#7EC8E3"
  canvas: "#101A23"
  canvas-light: "#F1F5F9"
  surface: "#15222D"
  surface-light: "#FBFDFF"
  surface-muted: "#20313F"
  ink: "#E5EDF3"
  ink-light: "#161C22"
  ink-muted: "#B2C3D0"
  selection: "#253D50"
  outline: "#354B5C"
  reader-stage: "#1C1A17"
typography:
  headline:
    fontFamily: "Roboto (Android, Windows) · letra del sistema de Apple (Mac, iPhone, iPad)"
    fontSize: "32px"
    fontWeight: 700
  title:
    fontFamily: "Roboto · letra del sistema de Apple"
    fontSize: "22px"
    fontWeight: 600
  body:
    fontFamily: "Roboto · letra del sistema de Apple"
    fontSize: "16px"
    fontWeight: 400
  label:
    fontFamily: "Roboto · letra del sistema de Apple"
    fontSize: "14px"
    fontWeight: 500
rounded:
  small: "8px"
  medium: "12px"
  large: "16px"
spacing:
  compact: "8px"
  group: "16px"
  margin: "20px"
components:
  primary-action:
    backgroundColor: "{colors.galiciana-blue}"
    textColor: "{colors.surface}"
    height: "48px minimum"
  reference-note:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.medium}"
---

# Design System: Galiciana de Peto

Desde el 25 de noviembre de 2026 la **versión web instalable (PWA)** es la app principal y la norma de este documento. Mejora por su cuenta y puede ser distinta de Android. La APK 0.4.5 queda descrita en `verification/android-ref/` y lo que sólo vale para ella está en «Sólo la APK», al final. Las ideas de la web que funcionen se llevan después a la APK.

Las medidas van en px de CSS. En la APK, 1 dp equivale a 1 px y los sp siguen el tamaño de letra raíz.

## Overview

Archivo gallego contemporáneo. La identidad se apoya en el azul y la vieira. La interfaz da protagonismo al documento y al contexto de investigación. El usuario aprobó la navegación Buscar / Explorar / Gardados y el rediseño del lector y de las notas. El nombre exacto «Nota de referencia» es vinculante.

Lo que más importa en esta app es la **agilidad**: todo responde al instante y nada hace esperar (ver «Velocidad» y «Movimiento»). Tiene que sentirse como una app instalada en cualquier teléfono.

## Colors

**La app sigue el modo claro u oscuro del teléfono, salvo que en Axustes se elija «Claro» o «Escuro»** (`pwa/src/theme.ts`, atributo `data-theme` en `<html>`). Los colores viven como roles en `pwa/src/app.css` (`--md-*`): el oscuro es el de siempre, que salió de las capturas del Pixel, y el claro, su pareja con el mismo azul. Ningún rol queda en la paleta violácea por defecto de Material. Ningún color de interfaz se escribe a mano fuera de los roles: así cambiar de modo es cambiar un solo bloque.
<!-- 2026-11-25: antes era siempre oscura; Pedro aceptó seguir al sistema tras la revisión con ask-emil -->

**El visor es siempre oscuro.** Las páginas escaneadas son papel amarillento con márgenes grises: sobre blanco se ven sucias y el blanco de alrededor deslumbra más que la propia página. Sobre un fondo oscuro neutro la página es lo más luminoso de la pantalla, como en Fotos o Libros a pantalla completa. Al entrar en el visor desde una pantalla clara, la sala se oscurece en un fundido (ver «Movimiento»), nunca de golpe. Las hojas y menús que se abren desde el visor sí siguen el modo del teléfono.
<!-- 2026-11-25: «que se vea natural ese cambio, que no parezca que la web se ha construido con trozos recortados» -->

Los contenedores (diálogos, menús, hojas y avisos) suben en escalones desde el lienzo: en oscuro de #0C141B a #2B3D4C; en claro, de #FFFFFF a #E1E7EC. El aviso (snackbar) invierte la superficie: tinta sobre superficie.

Colores fijos fuera de los roles, intencionados:

- Escenario del documento: #1C1A17, cálido y neutro, para no teñir el facsímil. Sus textos de estado usan blanco y gris claro.
- Coincidencias OCR en la imagen: relleno ámbar translúcido (#40FFE36D; activa #66FFC54D) con borde #996700; la activa lleva borde azul #075A9C.
- Resaltado en extractos de texto: #FFE36D con tinta #1A1A1A, igual en los dos modos.
- Carpetas: icono ámbar (`--folder-amber`: #E6C27A en oscuro, #A06E00 en claro), el color de una carpeta de archivo, distinto del azul de acción.
- Vieira: celeste #7EC8E3 con nervaduras #12384F cuando la página está guardada; sin guardar, sólo el contorno en el gris de los textos secundarios.

## Typography

**Roboto en Android y en Windows; la letra del sistema de Apple en Mac, iPhone y iPad.** Roboto va en la web como un archivo recortado de 60 KB (`fonts/Roboto-Android.woff2`), que se guarda la primera vez y no se vuelve a descargar. En los aparatos de Apple, `html.apple` (`pwa/src/main.tsx`) cambia `--app-font` a la letra del sistema, que trae sus tamaños ópticos.
Por qué: Apple recomienda la letra del sistema, que ya viene afinada para cada tamaño, y con Roboto la web se veía «de otro sitio» en el Mac. En el Pixel no cambia nada.
`system-ui` nunca va en la lista general: en Android puede ser otra letra que Roboto. Por eso la elección se hace sólo para Apple.
<!-- 2026-11-25: punto 6 de la revisión con ask-emil -->

Las únicas tipografías descargadas son ésa, los iconos Material Symbols recortados y Noto Sans, que sólo se carga al crear un PDF (capa de texto). No se añaden más.

**Cifras:** proporcionales en el texto corrido (un «1911» dentro de una frase no se ve separado); tabulares (`tabular-nums`) sólo donde los números cambian en su sitio o se alinean: recuentos, número de página, años y números en listas. La lista de clases está al final de `app.css`.

Titulares para destinos; títulos de publicación con jerarquía contenida; cuerpo legible para extractos y notas. Los controles respetan el tamaño de letra del sistema. Los textos extensos se desplazan o se amplían con una acción explícita; no desaparecen recortados sin acceso al contenido.

## Layout

Tres destinos estables en la barra inferior (riel lateral desde 600 px de ancho). El visor tiene navegación propia y puede ocultar sus controles para leer la imagen. Un único margen lateral de 20 px en todas las pantallas (`--md-margin`). El contenido y las cabeceras de Gardados comparten una lista desplazable. Los filtros y las carpetas son progresivos.

**Todo control táctil mide al menos 48 × 48 px**, también los botones de icono.
<!-- 2026-11-25: los botones de icono medían 44 (la medida de Apple) frente a la regla de 48; se eligió una -->

## Elevation & Depth

**Las barras son un material, no una franja opaca.** La cabecera fija de cada pantalla y la barra inferior son algo translúcidas (82 %), con lo que pasa por debajo difuminado (16 px). La cabecera muestra una línea finísima sólo cuando hay contenido por debajo; la barra inferior lleva siempre la suya encima, como en Apple. Con «reducir transparencia» o «más contraste» vuelven a ser opacas.

**En el visor, los controles flotan sobre la página**: la cabecera y la barra de abajo son opacas y se ocultan para leer (un toque en la página, o el botón con FullscreenExit los devuelve). Leyendo sin controles, la barra de estado toma el color del escenario.

Hojas y diálogos: superficie del escalón correspondiente, con velo oscuro detrás.

## Shapes

Radios 4/8/12/16/28 (`--md-shape-*`). Un vocabulario común de campos, botones y chips. La vieira conserva su silueta y su celeste, con una etiqueta accesible que explica la acción.

## Components

- Buscar: consulta directa, filtros desplegables y continuar leyendo.
- Resultados: cantidad y orden compactos; extractos breves ampliables; acciones de página separadas del texto.
- Gardados: páginas / notas de referencia, búsqueda que incluye las anotaciones, carpetas plegables, orden y selección.
- Visor: cabecera compacta, búsqueda plegable, navegación por coincidencias y hoja de acciones.
- Nota de referencia: editor protegido a pantalla completa, contexto de publicación y página, copia de referencia, hasta 4.000 caracteres y confirmación antes de descartar o eliminar. Al guardar, la nota se actualiza en todos sus sitios a la vez.

## Do's and Don'ts

Conservar los datos existentes, los controles nativos y la distinción entre resultados precisos y aproximados. No presentar la falta de metadatos o un error de red como cero resultados. No añadir tipografías descargadas, fondos ornamentales ni movimiento que retrase la tarea. No cambiar «Nota de referencia» por un nombre genérico. No escribir colores de interfaz fuera de los roles.

Las listas de publicaciones identifican el contexto: título, año, número y página de índice no son equivalentes. La paginación del índice usa Anterior / Siguiente con estado explícito. Los años se eligen en un selector con búsqueda. Las fichas no abren el visor solas al cargarse. El contexto bibliográfico disponible acompaña al lector y a la Nota de referencia.

## La web: tokens y tacto

Una sola hoja de estilo, `pwa/src/app.css`. Empieza con los tokens: nacieron copiados de `ui/theme/Theme.kt` y desde el 25 nov 2026 evolucionan por su cuenta.

- **Colores:** roles `--md-*` en oscuro y en claro (ver «Colors»); el visor vuelve a declarar los oscuros.
- **Formas:** 4, 8, 12, 16 y 28.
- **Tipografía:** la escala M3 con los pesos de archivo; `--app-font` decide la letra.
- **Marco:** cabecera de 64; barra o riel de 80 (el riel, desde 600 de ancho); toque mínimo de 48; márgenes de 20.
- **Movimiento:** tres curvas con nombre (`--ease-out`, `--ease-drawer`, `--ease-loop`); los tiempos están en «Movimiento».

**Estados:** al pulsar, un resalte de todo el control con el azul de acción al 16 % (ver «Movimiento»; no hay onda); en el ordenador, al pasar el ratón, al 8 %. En la barra y el riel el resalte va en la píldora.

**Tacto:** sin destello gris del navegador, sin espera de doble toque, sin seleccionar texto ni menú de pulsación larga en controles e imágenes, y sin rebote ni «tirar para recargar». El texto de las notas y los campos sí se puede seleccionar. Los campos miden al menos 16 px de letra en pantallas táctiles, para que el iPhone no amplíe la página.

## Movimiento

**Tiempos de hoy:**

- Cambio de pantalla: la nueva entra con un fundido de 220 ms y un desplazamiento de 260 ms (200 y 240 al volver); la anterior desaparece sin animarse (`App.tsx`, `withTransition`).
- Entrar en el visor o salir de él: la sala se oscurece o se aclara en 240 ms, al mismo tiempo que llega la pantalla.
- Halo de la coincidencia: 700 ms, tres veces.
- Hojas: entran en 300 ms y salen en 200 con la curva de cajón; si las lanza el dedo, salen a su velocidad.
- Paso de página: de 120 a 300 ms según la velocidad del lanzamiento; 300 con los botones.
- Pulsar: escala .97 y resalte al instante; el resalte se apaga en 150 ms.

**Reglas:**

- **Una curva para todo lo que llega, cambia o se va: `--ease-out`, `cubic-bezier(.23,1,.32,1)`, que arranca rápido y frena.** Las hojas usan la curva de cajón `--ease-drawer`, `cubic-bezier(.32,.72,0,1)`. Sólo las barras de carga, que se repiten, usan la simétrica `--ease-loop`. No se escriben curvas sueltas.
  Por qué: con tres curvas de Material y dos de Apple mezcladas, la app parecía hecha a trozos; con una sola, todo se mueve con el mismo carácter.
  <!-- 2026-11-25: «que no parezca que la web se ha construido con trozos recortados de distintas versiones» -->
- **Entrar en el visor oscurece la sala; nunca un corte de claro a oscuro.** Es un velo del color del escenario bajo la pantalla (`.app::before`), que sólo cambia de opacidad.
  <!-- 2026-11-25: misma petición -->
- **Con «reducir movimiento», lo que mueve el dedo lo sigue 1:1. Sólo el final, al soltar, va sin animación.** Afecta a pasar página en el visor y a arrastrar la hoja inferior.
  Por qué: ese movimiento lo produce el usuario, no la app. Quitarlo deja la pantalla quieta bajo el dedo. En esto la web se aparta de Android.
  <!-- 2026-11-25: decisión de Pedro en la pasada de gestos; confirmado en learn-taste -->
- **Nada se anima si se acciona con el teclado:**
  - menús, diálogos y hojas, al entrar y al salir;
  - cambio de pantalla y el oscurecer de la sala;
  - Anterior/Seguinte en el visor;
  - el cajón de «Datos da publicación».

  Escribir en un campo no cuenta como teclado; Escape sí. El mecanismo es `html[data-input=keyboard]` (`pwa/src/layers.ts`, `trackInputModality`) y `keyboardInput()`.
  Por qué: con el teclado las acciones se repiten muchas veces y la animación se nota como espera. Antes se perdía el segundo Intro durante el paso de página.
  <!-- 2026-11-25: aprobado en remove-animations; confirmado en learn-taste -->
- **Todo control táctil responde al apoyar el dedo, con escala .97 y un resalte del control entero, como en Apple (`ripple.ts`).** El resalte aparece al instante y se apaga en 150 ms al soltar; no hay onda que crece desde el dedo. No se quita aunque se use muchas veces.
  Por qué: confirma el toque en el mismo momento, sin esperar a levantar el dedo. La onda era de Android; Pedro quiere que la web se sienta como una app de Apple.
  <!-- 2026-11-25: decisión de Pedro en remove-animations; resalte en vez de onda el mismo día, tras la revisión con apple-design -->
- **Ninguna animación hace esperar.** Nunca retrasa la aparición del contenido, nunca bloquea un toque o una tecla, y siempre se puede interrumpir: un segundo toque durante un paso de página empieza el siguiente desde donde está.
  Por qué: la rapidez es lo que más valora Pedro de la PWA.
  <!-- 2026-11-25: «¿Alguna ralentiza la velocidad que tiene ahora?»; confirmado en learn-taste -->
- **Con «reducir movimiento» nada se desliza, pero no todo se queda quieto.** Hojas, menús, diálogos, avisos, cambios de pantalla y la sala del visor aparecen con un fundido corto (100–150 ms), y las barras de carga siguen vivas sin desplazarse: llenan su ancho y respiran (sólo opacidad, 2 s), igual que la página que se está cargando. Nunca una regla que pare todas las animaciones a la vez.
  Por qué: así lo hace Apple, y con todo parado la barra de «Buscando…» se quedaba congelada y parecía que la app se había colgado.
  <!-- 2026-11-25: revisión con improve-animations y apple-design, aprobada por Pedro -->
- **Al cambiar de pantalla, la nueva responde desde el primer momento.** Llega con un fundido y un pequeño desplazamiento sobre la página real, no con una transición de vista (`startViewTransition`), que convierte la página en una imagen y pierde los toques. Lo que llega de lado no puede ensanchar la página (`.app{overflow-x:clip}`).
  Por qué: «ninguna animación hace esperar».
  <!-- 2026-11-25: misma revisión; prueba en capas.spec.mjs -->
- **Lo que sale de la pantalla empieza rápido y frena, nunca arranca despacio.** Si lo lanza el dedo, sale a la velocidad del dedo.
  <!-- 2026-11-25: misma revisión -->

## Velocidad

Lo lento de esta app no es el teléfono sino el camino hasta los datos: GitHub Pages, Apps Script y Galiciana (la primera búsqueda puede tardar de 4 a 37 s por Galiciana). Por eso:

- **Sólo se anima `transform` y `opacity`.** La línea bajo la cabecera es su propia capa de 1 px que sólo cambia de opacidad. La única excepción es el cajón de «Datos da publicación», que se abre con `grid-template-rows` porque su altura es desconocida.
- **Nada se escribe en el estilo de toda la página a cada momento.** `--visible-height` se actualiza como mucho una vez por fotograma y sólo si la altura cambió (`main.tsx`).
- **El camino hacia Apps Script se abre antes de buscar.** Al tocar el campo de Inicio sale una petición mínima, una vez por visita (`api.ts`, `warmUp`). Apps Script la rechaza al momento y Galiciana no la recibe, pero la conexión ya está hecha cuando llega la búsqueda.
- **Lo que ya se vio se abre al momento:** las búsquedas recientes, lo guardado y sus notas, también sin conexión (service worker y `searches.ts`).
- Las imágenes que no se ven al abrir se cargan cuando hacen falta (`loading="lazy"`).
- **Las fuentes del primer momento se piden con la página**, no después de la hoja de estilo: los iconos siempre (si no, salen en blanco un instante) y Roboto sólo fuera de Apple. En Mac e iPhone no se descarga Roboto: `html.apple` se pone en la cabecera de la página, antes de pintar nada (`build.mjs`).
- **El JavaScript de arranque no se trocea más.** Lo grande (las herramientas de PDF) ya llega sólo al crear un PDF. Separar Gardados o la copia de datos ahorraría unos 30 KB comprimidos, pero dejaría la copia sin funcionar sin conexión la primera vez; no compensa.
<!-- 2026-11-25: «hoy en día nadie tiene móviles modestos para mover algo así, lo modesto son los medios de la web» -->

## Como una app instalada

- **La web se usa sin instalar desde el primer momento.** Instalar se ofrece, no se exige: no hay pantalla previa que tape la app.
  - Tras la primera búsqueda con resultados de cada visita, un aviso con el mismo texto y «Instalar».
  - El aviso se repite en cada visita hasta que se instala. Axustes tiene una fila «Instalar GdPeto» y un interruptor para apagar el aviso del todo. Desde el rediseño del 28 nov 2026 ya no hay tarjeta en Inicio. Mientras se ofrece instalar, no se ofrece además la pantalla completa.
  - «Instalar» abre la pantalla con los pasos de cada navegador (`?instalar`, `InstallGate.tsx`).

  Por qué: la meta es que la gente acabe instalándola, pero un muro delante de la app espanta a quien sólo quiere probar. La invitación llega cuando la app ya ha demostrado que sirve.
  <!-- 2026-11-25: «Yo ofrecería instalarla después de la primera búsqueda… Mi idea es que la gente se la acabe instalando. Se podría reiterar varias veces» y «añade una invitación a instalarla al iniciar» -->
- **Compartir hacia la app:** en el menú de compartir de Android sale GdPeto (`share_target` del manifiesto). Lo compartido abre como búsqueda; los enlaces se descartan y un enlace solo abre Buscar (`src/launch.ts`).
- **Accesos directos:** al mantener pulsado el icono salen Buscar y Gardados (`shortcuts`). Con la app abierta, llegan por `launchQueue` como un paso más del historial.
- **Compartir una página:** «Compartir páxina» en las acciones del visor abre el menú del sistema con un enlace que abre **GdPeto** en esa misma página, y el enlace a Galiciana en el texto. Sólo aparece si el navegador tiene `navigator.share`.
- **Barra de estado:** toma el color de lo que hay arriba en cada modo; en el visor, el de su barra, y leyendo sin controles, el del escenario (`#1C1A17`).
- **Teclado:** los campos de búsqueda llevan la tecla «Buscar» (`enterKeyHint`), el de ir a una página, «Ir», y ninguno autocompleta.

## Rediseño del 28 de noviembre de 2026
<!-- Maqueta aprobada: https://claude.ai/artifact/4vACKKzrXYEuULineTbKMF · «Sí, impleméntala» -->
- **Inicio**: título «Galiciana de Peto», engranaje a Axustes, el campo de busca, «Buscar con filtros», «Tal día como hoxe», «Continuar lendo» y «Gardado hai pouco» (seis, con «Ver todos»). Sin obras destacadas, sin tarjeta de instalar y sin pantalla completa: cada cosa vive en un solo sitio.
- **Tal día como hoxe**: la portada de un diario gallego de este mismo día hace 60, 80 y 100 años (Galiciana no tiene diarios de 1986, por eso no 40). Si ese día no salió (los lunes), el número de hasta tres días antes, y se dice. Se pide 300 ms después de pintar Inicio y se guarda ese día (`gdpeto-hoxe-<fecha>`). En Explorar, «Un día na hemeroteca» abre todos los diarios de cualquier fecha entre 1871 y 1981.
- **Gardados**: tres segmentos con su número (Páxinas, Notas, Buscas); la busca se abre con la lupa de la barra; cada página tiene un solo ⋮ con Nota, Cartafoles y Quitar. Las buscas guardadas viven aquí.
- **Axustes** (antes Acerca de), en dos partes. Arriba los ajustes: Idioma, Tema (Como o teléfono / Claro / Escuro; el visor sigue siempre oscuro), Historial de lectura (apagado por defecto; guarda por orden cada obra abierta, sólo en este navegador y fuera de la copia) y Esta app no teléfono. Abajo, Acerca de: identidad, aviso legal y fuentes.
- **Visor**: abajo, una cápsula flotante en lugar de tres bandas. Arriba la busca («Castelao», «1 / 1», ↑ ↓ entre coincidencias; tocar la busca la edita, sin lápiz) y abajo ‹ páginas con coincidencias · «11 / 85» ›. Sin busca, sólo ‹ 11 / 85 ›. La lupa de la barra superior sólo está mientras no hay busca. La palabra encontrada se marca como un rotulador ámbar, sin el recuadro azul. En las acciones, Gardar, Nota, Cartafol y Descargar son mosaicos. La barra superior conserva su color porque de él sale el de la barra de estado.
- El movimiento hecho con Copilot (toques, visor, cargas) no se tocó.

## Decisiones de producto (web y APK)

### Investigación y copias · 0.4.0

Inicio identifica ejemplares con cabecera breve, fecha y número cuando la fuente los ofrece; conserva el título original. El formulario de búsqueda agrupa publicación/persona/lugar y periodo, mantiene Buscar accesible fuera del desplazamiento y permite guardar y reutilizar consultas.

Las fichas muestran etiqueta y valor, derechos y enlace al registro original; los campos largos y el texto íntegro se despliegan sin eliminar contenido. Las galerías reservan una superficie consistente para miniaturas ausentes.

Copia de tus datos está en el ⋮ de Gardados. Exportar y abrir una copia son acciones distintas; la vista previa muestra cantidades y diferencias antes de importar. Combinar es la opción predeterminada. La interfaz no usa jerga de checksum, preferencias tipadas o manifiestos para explicar la tarea.

### Icono

Vieira celeste #7EC8E3 sobre azul noche #15222D, con siete nervaduras #12384F y silueta suavizada. Etiqueta del icono: GdPeto. Nombre de la app: Galiciana de Peto. Fuente vectorial en design/launcher-icon.svg.

### Crítica del 13 de noviembre de 2026

Vocabulario único: el lugar se llama «Gardados» y su contenido «páxinas gardadas»; no se usa «favoritos» ni «páginas marcadas». «Quitar» retira una página de Gardados; «Eliminar» destruye una carpeta o una Nota de referencia; «Borrar» queda para vaciar texto o el historial. Todo diálogo de retirada dice qué ocurre con la Nota de referencia.

Visor: la vieira con estado vive en la barra superior, y la línea de página añade «Gardada» o «Gardada con nota». Quitar una página desde el visor es inmediato y reversible con «Desfacer». Abrir «Organizar en cartafoles» no guarda nada hasta pulsar «Listo». La hoja de acciones no invade la barra de estado.

Gardados: sin carpeta elegida se muestran y se buscan todas las páginas. «Arquivador xeral» es una carpeta más.

Resultados: mientras Galiciana no responde se muestra «Buscando en Galiciana…», nunca un recuento a cero. Un fallo ofrece «Reintentar» y conserva consulta y filtros. La primera vez que hay resultados, una pista explica la vieira y el icono de nota.

Barras de altura fija (etiquetas de navegación, títulos del visor y del editor de notas): el texto sigue el tamaño del sistema hasta el 130 %. El contenido escala sin límite. La cabecera de Inicio queda fija y el contenido no se desliza bajo la barra de estado. Axustes, Aviso legal, Historial de lectura y Copia de tus datos cuelgan de Buscar (se llega desde el engranaje de Inicio); las fichas siguen el destino desde el que se llegó.

### Idiomas · galego por defecto

A interface ofrécese en galego (por defecto) e en español, elixible en Axustes. Cambiar o idioma recarga a páxina na web (`pwa/src/i18n.ts`) e recrea a pantalla na APK, sen reiniciar a app. Os textos viven no código como pares `tr("galego", "español")`; todo texto novo engádese nos dous idiomas. Vocabulario galego: Gardados, páxina gardada, cartafol, busca, Nota de referencia (sen cambios), Arquivador xeral, Quitar / Eliminar / Borrar co mesmo reparto que en español. Os termos seguen a versión galega de Galiciana.

Non se traducen: os títulos, extractos e campos que chegan de Galiciana; os temas orientativos da busca (son palabras que se engaden á consulta sobre prensa en español); o nome almacenado do cartafol «Archivador general», do que só se traduce a etiqueta, para non alterar datos gardados nin copias. O aviso legal ten versión galega propia.

Termos galegos confirmados polo usuario: «Gardados» (pestana), «cartafol» (carpeta) e o lema «Galiciana, de peto.». As cadeas galegas revísanse en docs/GALEGO_REVISION.md.

### Detalles finales · 13 de noviembre de 2026

Visor: deslizar horizontalmente con un dedo sobre la página entera pasa de página; con la página ampliada el gesto desplaza la imagen, y pasa de página cuando ya está en el borde de ese lado, como en cualquier lector. Las fuentes externas se abren desde una fila de acciones más, con icono. Cerrar la Nota de referencia devuelve al visor. Tras fallar la búsqueda ampliada, «Reintentar» repite esa búsqueda, no la normal.

Pasar página: la página anterior sale hacia el lado del gesto mientras la nueva entra por el contrario, sin esperar a que se descargue su imagen: si aún no ha llegado, entra con la misma silueta y la carga, y permite reintentar si falla. Para la salida se guarda una copia ajustada a la pantalla, nunca la imagen completa, y se libera al terminar. Con «reducir movimiento» la nueva aparece sin movimiento al soltar, pero mientras se arrastra la página sigue al dedo.

Navegación: una búsqueda escrita en Inicio abre directamente los resultados y Atrás vuelve a Inicio; el formulario sólo es un paso cuando se ha abierto. Explorar y Gardados comparten barra sin flecha; Inicio lleva «Galiciana de Peto» como título y un único engranaje que abre Axustes; Explorar ya no repite Acerca de.

Inicio: el campo es la búsqueda. Se lanza con la tecla del teclado o con el botón de buscar dentro del campo, que aparece al escribir; el botón ancho «Buscar» sólo se muestra cuando hay texto.

Formulario de búsqueda: un solo nombre, «Buscar con filtros», en Inicio y en el formulario, con un interruptor.

Resultados: las notas de alcance viven en Detalles; sólo se avisa arriba cuando el orden por fecha se aplica a resultados parciales. Los tres niveles se nombran y se explican en una línea («Coincidencias exactas», variantes de OCR, coincidencias más amplias); el primero sólo lleva encabezado cuando hay otros niveles. En Gardados la Nota de referencia se lee completa bajo demanda y precede a un único extracto en tono secundario. Copia de datos y Exportar referencias están en el menú de la barra de Gardados.

Coleccións: los tipos de fondo se muestran como mosaicos iguales con un símbolo propio, no con portadas de muestra. Una obra sin portada muestra el icono de su tipo de fondo y su año en el espacio de la portada. Los títulos recortados por la fuente se muestran con una sola elipsis.

Carpetas: el icono de cartafol es siempre ámbar, en resultados, Gardados y la hoja de cartafoles. Crear cartafol usa el icono de carpeta nueva en el azul de acción.

Copias: los tipos de diferencia son valores fijos dentro de las copias; sólo su etiqueta se traduce.

Letra grande: las etiquetas de chips y botones de cabecera no se parten; se acortan («Notas», con el nombre completo para el lector de pantalla) o pasan a otra línea. Los botones de texto de cabeceras y filas de acciones miden al menos 48 px.

## Sólo la APK

- Tema en `ui/theme/Theme.kt`: un único esquema oscuro (`DarkColors`), sin modo claro; carpetas en `FolderAmber`.
- Tipografía nativa de Android mediante Material 3; medidas en dp y sp.
- Pasar página dura 200 ms; con «Quitar animaciones» la nueva aparece sin movimiento.
- Al pulsar, la onda de Android (*ripple*), con primary al 16 %.
- Cambiar de idioma hace `recreate()` (`i18n/Lang.kt`).
- Icono adaptativo en capas, compatible con máscara circular y capa monocroma, con variantes rasterizadas para densidades heredadas. Comprobado en el lanzador del Pixel.
- Lector de pantalla: TalkBack. Aviso legal gallego en `legal_notice_gl.json`.
- Antes de tocar la APK: «Orde: Data» rota en gallego y `.impeccable/audit/2026-11-22-pendiente-para-la-apk.md`.

### «Tal día como hoxe» precalculado y revisión Emil (28 nov 2026, tarde)

- **«Tal día» no espera a Galiciana.** `pwa/scripts/hoxe-precalcular.mjs` calcula día a día las portadas de hace 60, 80 y 100 años y escribe `pwa/public/hoxe/AAAA-MM.json`. El mes en curso va dentro de la app (`src/hoxe-mes.json`, lo genera el build); los demás son ficheros pequeños en `hoxe/` que el móvil baja solo, 300 ms después de pintar Inicio, y desde el día 20 baja ya el mes siguiente. Si falta un día, se pregunta a Galiciana como antes. Volver a lanzar el script una vez al año (`node scripts/hoxe-precalcular.mjs AAAA-MM-DD AAAA-MM-DD`, reanudable) y publicar.
- **Campo de fecha de «Un día na hemeroteca».** En Android un `input type=date` vacío se pinta como una flecha suelta. El campo es ahora una etiqueta que llena la fila, con «Escoller data» y una icona de calendario; el input nativo va encima, transparente, y abre el selector del sistema. «Ver» tiene su propio ancho (el `.m3-filled-button` es de ancho completo por defecto).
- **Revisión Emil de toda la PWA.** Sin `transition: all`, sin `ease-in`, sin `scale(0)`, todo `:hover` dentro de `(hover:hover) and (pointer:fine)`. Todos los botones tienen respuesta al pulsar (la capa de `ripple.ts` y `scale(.97)`), las cifras usan `tabular-nums`, y el foco por teclado se ve en todo. El movimiento de Copilot no se ha tocado.
