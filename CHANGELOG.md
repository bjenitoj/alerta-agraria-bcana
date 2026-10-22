# Cambios

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
