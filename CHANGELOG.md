# Cambios

## v5.3 · 23/10/2026 · Pasos 2 y 3 según el sector

### Cambiado
- **Paso 2:** la zona sigue igual (Salamanca y CyL, Salamanca, Castilla y León, España). El segundo bloque depende del sector del paso 1:
  - Agricultura → «Tierra»: ☀️ Secano, 💧 Regadío.
  - Ganadería → «Tipo de explotación»: 🌳 Extensiva, 🏭 Intensiva, 🔄 Mixta, 🏡 Autoconsumo (varios a la vez).
  - Pesca → «Actividad»: 🎣 Pesca marítima, 🦪 Marisqueo, 🐟 Acuicultura, 🏞️ Pesca continental (varios a la vez). Título «¿Dónde trabajas?».
  - Todos → los tres bloques, cada uno con una línea pequeña («🌾 Agricultura · Tierra», …) y tarjetas más compactas.
- **Paso 3:** solo lo del sector elegido. Agricultura «¿Qué cultivas?» (cultivos), Ganadería «¿Qué crías?» (especies de ganado), Pesca «¿Qué pescas o crías?» (🐠 Peces, 🐚 Moluscos, 🦐 Crustáceos, 🌿 Algas), Todos «¿Qué cultivas, crías o pescas?» con todo agrupado por sector.
- **Al cambiar de sector** se quita lo que ya no aplica (cultivos, especies, tipo de explotación, actividad; la tierra vuelve a «secano y regadío», que no cambia nada). La zona se queda. La tierra solo cuenta en el orden si el sector incluye la agricultura.
- **«Mis preferencias»** enseña los mismos bloques según el sector, y el apartado de abajo se llama «Cultivos», «Especies» o «Cultivos y especies».
- **Preferencias guardadas** en el mismo sitio (`alerta_prefs_v1`), versión 3, con dos campos nuevos: `farm` (tipo de explotación) y `fishing` (actividad). Las preferencias de antes se leen sin problema: campos nuevos vacíos; si estaban marcadas «Pesca marítima» o «Acuicultura» como cultivo, pasan a «Actividad».
- **El orden usa los campos nuevos solo si la palabra sale tal cual en el texto oficial** (título, resumen, objeto o beneficiarios): «extensiva», «intensiva», «explotación mixta», «explotación de autoconsumo» (no cuenta el autoconsumo eléctrico), «marisqueo», «acuicultura», «pesca marítima», «pesca continental»… No se deduce ni se inventa nada; nunca se oculta nada. «Por qué puede interesar» cita esas palabras si aparecen.
- Versión de caché `?v=29`.
- Pruebas: `test/prefs-v53.test.js` (bloques por sector, paso 3 por sector, limpieza al cambiar de sector, migración, palabras literales).

## v5.2 · 23/10/2026 · Asistente más sencillo y vistoso

### Quitado
- La frase larga bajo los tipos de información («Por este orden: 1. Ayudas y subvenciones, 2. PAC. El Resumen del día solo enseña estos; en Inicio y en las pestañas lo demás va detrás.») ya no sale en el asistente ni en ningún otro sitio. También se quitan «Ganadería queda delante…», «Has elegido: …», «Marcados: …» y «Puedes marcar varios. El número es el orden en que salen.».

### Cambiado
- **Los 3 pasos del asistente, rediseñados para el móvil:** barra de progreso de 3 tramos en verde oscuro, «1 de 3», un título corto («¿Qué te interesa?», «¿Dónde está tu explotación?», «¿Qué cultivas o crías?») y como mucho una pista gris de pocas palabras («Lo elegido sale primero», «Opcional»).
- **Tarjetas grandes con icono** en dos columnas: 🌾 Agricultura, 🐄 Ganadería, 🐟 Pesca, 🌐 Todos; 💶 Ayudas, 🇪🇺 PAC, 📜 Normativa, ⚠️ Alertas, 📰 Noticias; ⭐ Salamanca y CyL, 📍 Salamanca, 🏰 Castilla y León, 🇪🇸 España; ☀️ Secano, 💧 Regadío; y un icono por cultivo o ganado. Lo elegido se rellena de verde con una marca ✓; en Información la marca es el número de orden (1, 2…). Pista: «Toca en orden de prioridad».
- **Los botones de abajo ya no quedan tapados** por la barra de pestañas: «Atrás / Siguiente» y «Empezar con lo recomendado» van en un pie fijo dentro de la ventana, con margen para la zona segura del iPhone. Si la pantalla es pequeña, solo se desplazan las tarjetas. En 390×844 los 3 pasos caben sin desplazar.
- **«Mis preferencias»** usa las mismas tarjetas con icono. Nota corta: «Guardado solo en este dispositivo.».
- Mismo comportamiento: varios tipos de información con orden, asistente solo la primera vez, preferencias guardadas en el dispositivo, el Resumen enseña solo lo elegido e Inicio ordena sin ocultar.
- Versión de caché `?v=28`.
- Pruebas: la frase quitada no puede volver a salir; hay pie fijo con zona segura, barra de progreso, tarjetas y pistas de 5 palabras como mucho.

## v5.1 · 23/10/2026 · Resumen de lo seleccionado y textos de ayuda discretos

### Cambiado
- **El Resumen del día enseña solo los tipos de información elegidos** en «Mis preferencias» (por ejemplo, Ayudas y PAC; si se marca Normativa, también normativa). Lo no elegido no sale en el Resumen. Si no hay nada elegido, se usan Ayudas y PAC. Cada pieza sale una vez, en la sección del primer tipo elegido que tiene. Sigue siendo solo de piezas oficiales con su enlace.
- Arriba del Resumen hay una línea discreta: «Mostrando: Ayudas y subvenciones, PAC · Cambiar en Mis preferencias». El enlace abre «Mis preferencias».
- «Plazos que cierran en menos de 15 días» solo sale en el Resumen si están elegidas Ayudas o PAC.
- **Inicio y las pestañas no cambian:** ordenan por preferencias sin ocultar nada.
- **Textos de ayuda discretos** (clase `hint`): letra más pequeña, gris, sin negrita ni fondo. Afecta al texto bajo el título del asistente («Ganadería queda delante…», «Has elegido: …»), a las notas bajo «Tipo de información», a la nota de dónde se guardan las preferencias y a la línea «Mostrando» del Resumen.
- Versión de caché `?v=27`.
- Pruebas: `test/prefs-v5.test.js` con la selección del Resumen (`digestSelection`) y los textos discretos.

## v5.0 · 23/10/2026 · Preferencias que se ven y se guardan

### Arreglado
- **Paso 1, sector.** El texto de arriba decía siempre «La agricultura queda delante», aunque se eligiera Ganadería o Pesca. Ahora dice el sector elegido («Ganadería queda delante…», «Todos los sectores por igual»). Además el orden ya no pone la agricultura delante a la fuerza: el sector elegido va primero.
- **Paso 2, zona.** El texto de arriba era fijo («Salamanca y Castilla y León, con secano y regadío»). Ahora dice exactamente lo elegido («Has elegido: Castilla y León · secano y regadío»). El paso 3 tampoco tiene ya un texto fijo de cultivos.
- **«Empezar con lo recomendado»** solo sale la primera vez. Al repasar las preferencias más tarde, el botón es «Cancelar y dejar como estaba» y ya no borra lo elegido.
- **El asistente no tapaba bien con el cartel «En revisión»**: ahora empieza debajo del cartel y se puede desplazar en móvil.

### Nuevo
- **Varios tipos de información.** Se pueden marcar varios (Ayudas, PAC, Normativa, Alertas, Noticias). El número de cada botón es el orden en que salen. Lo no marcado no se oculta: va detrás.
- **Orden en todas las listas:** 1) sector elegido, 2) tipos de información elegidos en su orden, 3) plazos que cierran pronto, 4) zona, agua y cultivos.
- **Resumen del día por secciones** en el orden de tus preferencias. Además de las ayudas nuevas, enseña las demás piezas oficiales publicadas ese día (normativa, noticias…). No se quita nada por tipo; todo con enlace a la fuente oficial.
- **Inicio: bloque «Lo que has puesto primero»** con los 3 primeros títulos oficiales de cada tipo elegido y un botón a su pestaña.
- **«Mis preferencias»** (botón de la barra superior y botón Preferencias del móvil) incluye ya el tipo de información. Explica que se guardan solo en este dispositivo y, en la app del iPhone, aparte de Safari.
- El navegador recibe la petición de guardar los datos de forma persistente (`navigator.storage.persist`), cuando lo permite.

### Técnico
- `lib/preferences.js`: campo `info` (lista ordenada), `PREFS_VERSION = 2` con la misma clave `alerta_prefs_v1` (las preferencias guardadas se conservan; de las antiguas se toma como elegido el primer tipo). Nuevas funciones `itemInfoTypes`, `infoRank`, `infoSection`, `prefsSummary`. `forYou` usa todos los tipos elegidos. `digestGroup`/`compareItems` sin sector fijo.
- Versión de caché `?v=26` en `public/index.html`.
- Pruebas: nuevo `test/prefs-v5.test.js`.

## v4.2 · 22/10/2026 · Cartel «En revisión»

### Nuevo
- **Cartel fijo arriba** en todas las páginas públicas: consulta, herramientas, fuentes, quiénes somos, planes y páginas legales. Dice: «Versión en revisión. Estamos comprobando los datos; consulta siempre la publicación oficial.» Ocupa una línea en escritorio y dos en móvil, y tiene modo oscuro.
- **Variable `REVIEW_MODE`.** Activa por defecto; se apaga con `off`, `0` o `false`.
  - Mientras está activa:
    - el servidor pinta el cartel en el HTML;
    - añade `<meta name="robots" content="noindex, nofollow">`;
    - envía la cabecera `X-Robots-Tag: noindex, nofollow`;
    - sirve `/robots.txt` con `Disallow: /`.
  - Con `REVIEW_MODE=off`, `/robots.txt` pasa a `Allow: /`.
- **El cliente conoce el estado** por `/api/review` y por `reviewMode` en `/api/state`.
- **Pruebas:** nuevo `test/review-mode.test.js`, que prueba los dos estados.

## v4.1 · 22/10/2026 · Auditoría: nada inventado

Norma: la app no inventa nada. Todo lo que muestra viene de una fuente oficial publicada y enlazada.

### Cambiado
- **«Por qué te puede interesar»** solo cita coincidencias literales: «Menciona: «cereal», «Salamanca»» o «Coincide con tus filtros (clasificación automática por palabras)». Ya no afirma que cumplas requisitos.
  - Muestra la palabra completa del texto oficial, no la raíz («agricultura», no «agricult»).
  - Los beneficiarios se citan tal cual: «Beneficiarios (texto de la convocatoria)».
- **Extracción dudosa → «Ver en la convocatoria oficial».** Pasa con:
  - plazos con varias fechas de cierre, sin año, imposibles o de ejecución/justificación;
  - varios importes distintos.
- **Estado «abierta»** solo con fecha de cierre o si la fuente lo dice.
- **Organismo** solo si el texto dice «resolución/orden/extracto… de…». Organismo, fondo y BDNS indican si salen de la ficha oficial o del texto.
- **Sin fuente, no se muestra.** Las tarjetas, ítems, plazos y resúmenes sin enlace http(s) oficial se ocultan, también en la API.
- **Sin textos de relleno.** Se quitan los resúmenes inventados («Nota de prensa de la Junta…», «Novedad del ITACyL»), «Castilla y León» por defecto y el fondo «Minimis».
- **Calendario PAC.** Cada fecha lleva su cita literal y su fuente (nota MAPA del 16/10/2026 y díptico del FEGA). Lo aproximado va marcado como «orientativa». Se muestra la diferencia 75 % / 70 % con las dos citas.
- **Precios MAPA.**
  - El nombre del producto y la semana son el texto literal de la tabla.
  - Se muestra la posición comercial que dice la nota de la tabla.
  - Sin unidad en la tabla, el producto no se muestra (ya no se supone «€/t»).
- **Herramientas oficiales.** Sin paráfrasis: nombre, organismo, enlace y, si la hay, una cita literal de la página oficial.
- **Fuentes.** Nuevo bloque «Calendario PAC, precios y herramientas», con la tabla de precios del MAPA, el díptico FEGA, la nota MAPA y las webs de herramientas.
- **Textos legales.** Rellenados en `lib/legal.js` (`LEGAL_OWNER`). El titular solo aparece en Aviso legal y Privacidad. No se muestra NIF y no quedan marcadores.

### Pruebas
- Nuevo `test/no-invent.test.js`, que falla si se cuela un dato sin fuente, un valor por defecto o una afirmación de elegibilidad.

## v4 · 22/10/2026

Todo funciona sin cuentas y sin datos personales. Favoritas, ocultas y filtros se guardan solo en el navegador (localStorage).

### Nuevo
- **Ayudas en 4 bloques:** Qué ha salido · Por qué te puede interesar · Plazo e importe · Fuente oficial.
  - Si se pueden sacar, también muestra organismo, fondo (FEADER, FEAGA, FEMPA…), código BDNS e importe máximo.
  - Si la convocatoria no indica plazo o importe, lo dice. No se inventa nada.
- **Etiqueta de cierre** en cada ayuda: «Cierra en X días», «Cierra mañana», «Cerrada» o «Plazo no indicado».
  - Nueva sección del Resumen: «Plazos que cierran en menos de 15 días».
- **Calendario de pagos PAC 2026** con cuenta atrás.
  - Fechas del MAPA y el FEGA, con sus fuentes citadas. Lo aproximado va marcado como orientativo.
  - Las fechas se editan en `config/pac-calendario.json`.
- **Favoritas (☆) y «Ocultar esta ayuda».**
  - Filtro «Solo abiertas», activado por defecto. Oculta solo las cerradas.
  - Vista «Mis favoritas».
  - Filtros por sector: agricultura, ganadería, pesca y todos.
- **Hoy en el campo:** precios medios nacionales semanales del MAPA para trigo blando, cebada, maíz, girasol y leguminosas.
  - Muestra la semana, la fuente y el enlace.
  - Usa caché de 12 h. Si el Ministerio no responde, enseña la última copia buena.
  - Si no hay ningún dato, enseña el enlace oficial y explica por qué. Nunca se inventan precios.
- **Compartir por WhatsApp** y **Añadir al calendario** (.ics con la fecha de cierre y aviso 2 días antes).
- **Página «Herramientas oficiales»** (/herramientas): SIGPAC (FEGA y CyL), GeoFotos, Sga@pp, Oficina Virtual PAC CyL, Sativum, Red PAC, alertas BDNS, Mi BOE y suscripción al BOCYL.

### Mejoras
- Mejor detección de plazos:
  - «hasta el…», «finaliza el…», «fecha límite…», «antes del…»;
  - los plazos relativos («quince días hábiles desde…») salen como nota, sin inventar la fecha.
- Nombres de BDNS en mayúsculas pasados a formato legible, y organismo y fondos leídos de BDNS.
- Diseño móvil: ya no hay desbordamiento horizontal con muchas pestañas.

### Técnico
- Rutas nuevas: `/api/pac-calendario`, `/api/herramientas`, `/api/precios`, `/calendario.ics` (sin estado, con parámetros validados) y `/herramientas`.
- Lectura de Excel (xlsx) sin dependencias nuevas (`lib/xlsx-lite.js`).
- Tests nuevos de extracción de plazos, .ics, calendario PAC y precios.
