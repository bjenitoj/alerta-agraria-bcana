# Cambios

## v5.8 · 30/10/2026 · Cabecera, apartados y Ajustes más claros

- Cabecera: sin el botón «Preferencias». Quedan Resumen, Herramientas y Ajustes; las preferencias están dentro de Ajustes.
- Chips de apartados: sin «Inicio» (está en la barra de abajo y en el logo). «Hoy en el campo» pasa a «Precios», con el mismo icono que la barra de abajo. Orden: Ayudas, Calendario PAC, Normativa, Precios y Mis favoritas, en MAYÚSCULAS.
- En el móvil (con barra de abajo) arriba no se repiten Ayudas, Normativa ni Precios: solo Calendario PAC y Mis favoritas. En iPad y ordenador se ve la fila completa.
- Ajustes en tres desplegables grandes, en este orden: Mis preferencias, Tema y Leídas y borradas (se guardan 15 días; «Recuperar borradas»). La explicación va en letra pequeña a la derecha del título. Sin el enlace «Ir a Mis preferencias».
- Sector en Mis preferencias sin «Todos»: Agricultura, Ganadería y Pesca, varios a la vez (los mismos que los chips de sector).
- /fuentes incluye «BOE · Legislación consolidada (datos abiertos)», la fuente de Normativa en vigor.
- Navegación final. Web (> 900 px): cabecera con Resumen, Herramientas y Ajustes (icono y texto) y fila AYUDAS · CALENDARIO PAC · NORMATIVA · PRECIOS · MIS FAVORITAS con icono y texto; sin barra de abajo. Móvil (≤ 900 px, vertical y horizontal): arriba los mismos 5 apartados solo con icono (calendario y estrella para Calendario PAC y Mis favoritas), con número y nombre accesible; abajo Inicio, Resumen (con número), Herramientas y Ajustes, con icono y texto pequeño (Inicio también con el logo). Bajo cada icono de arriba, texto pequeño: Ayudas, Calendario, Normativa, Precios, Favoritas. Las páginas sueltas sin barra mantienen los botones de la cabecera.
- Los cuadros de Inicio usan el mismo cálculo que la pantalla Ayudas (sectores elegidos, sin cerradas): «Abiertas» y «Cierran pronto» = Ayudas › Otras ayudas (abiertas incluye las que cierran pronto y las abiertas sin plazo conocido); «Líneas PAC» = Ayudas › Ayudas PAC › Abiertas.
- Inicio, «Lo que has puesto primero»: «Ayudas y subvenciones» muestra solo Otras ayudas (mismo número que Ayudas › Otras ayudas) y «PAC» solo las ayudas PAC; ninguna pieza sale en los dos. «Ver N» abre Ayudas en el grupo correspondiente.
- Caché `?v=49`.

## v5.7 · 28/10/2026 · Precios de la Lonja de Salamanca

### Nuevo
- **Hoy en el campo › Precios** tiene un desplegable **«Fuente: Ministerio (MAPA) | Lonja de Salamanca»**. Por defecto, el Ministerio; la elección se recuerda en el dispositivo (`alerta_precios_fuente`).
- **Lonja de Salamanca** (Lonja Agropecuaria de Salamanca, Diputación de Salamanca): se lee la tabla oficial de cotizaciones (`https://www.lasalina.es/Aplicaciones/lonja/Cotizaciones.jsp`) de la última sesión, mesas de Cereales (cereales, leguminosas, oleaginosas, forrajes), Ovino, Bovino de vida, Bovino de carne y Porcino blanco e ibérico. Mismas columnas (Producto / Precio / Variación); precio, unidad («€ / t», «€ / kg vivo», «€ / kg canal», «€ / ud.») y diferencia **tal como los publica la tabla**, con «Sesión del dd/mm/aaaa» y enlace a la tabla oficial. «0,00» en la tabla = **«Sin cotización»** (la tablilla en PDF pone «S. / C.»): no se enseña precio. Las horquillas («150,00 / 175,00») se copian literales.
- Copia en caché 12 h (`DATA_DIR/lonja-cache.json`); si la Diputación falla, la última copia buena con su fecha; si no hay ninguna, ningún precio y el enlace oficial.
- La Lonja sale de «Preparadas, aún no consultadas» en **Fuentes oficiales**: ahora figura como fuente de precios.
- API: `GET /api/precios/lonja`.
- Caché `?v=44`.

### Girar la pantalla
- La app gira entre vertical y horizontal en móvil y tableta, también instalada en la pantalla de inicio: `"orientation": "any"` en `manifest.webmanifest` (Android) y nada en la página bloquea el giro.
- En horizontal con poca altura (≤ 500 px), cabecera, barra de abajo, cuadros y botones más bajos; hojas y ventanas con scroll y alturas `dvh`; márgenes del notch a los lados (`safe-area-inset-left/right`); sin desplazamiento lateral.

### Normativa y Ayudas
- La regla «solo lo abierto» vale **solo para ayudas** (PAC y no PAC). **Normativa**, alertas y lo demás salen siempre, aunque no tengan plazo o figuren como cerradas; Normativa se ordena por fecha de publicación (lo más reciente arriba).
- Pestaña **Ayudas** rediseñada: dos bloques, **«Ayudas PAC»** y **«Otras ayudas»**, y chips de estado **Abiertas · Cierran pronto · Próximas** (por defecto Abiertas; lo cerrado no sale nunca; se recuerda en el dispositivo, `alerta_ayudas_estado_v1`). Los chips de sector siguen igual.
- **Normativa ≠ Ayudas** (excluyentes): en Normativa solo normas de BOE y BOCyL (leyes, reales decretos, decretos, órdenes, resoluciones, reglamentos) de agricultura, ganadería y pesca. Lo que trata de ayudas, subvenciones, convocatorias, beneficiarios o premios va solo a Ayudas. Los anuncios que no son normas ya no entran en Normativa.
- **Normas en vigor (BOE)**: nueva sección de consulta en Normativa, desde la API oficial de legislación consolidada del BOE (`/api/normativa/vigente`, `lib/normativa.js`): Ministerio de Agricultura, Pesca y Alimentación o materias Agricultura, Ganadería, Pesca y PAC; leyes, reales decretos y órdenes. «En vigor» = lo que el BOE marca con `vigencia_agotada: N`; lo derogado o agotado no sale. Nada inventado: lo publicado últimamente en BOE/BOCyL no tiene ese dato y se enseña sin estado. Caché de 12 h; si el BOE falla, la última copia buena. Filtrable con los chips de sector.
- **Sin pestaña PAC**: en **Ayudas** se elige primero **«Ayudas PAC» | «Otras ayudas»** (botones grandes, por defecto Ayudas PAC, se recuerda: `alerta_ayudas_grupo_v1`) y solo se lista ese grupo. Debajo, los **cuadros grandes de colores** Abiertas (verde) · Cierran pronto (naranja) · Próximas (azul), como los de Inicio, con el elegido marcado. Los avisos PAC que no son una línea de ayuda salen en «Ayudas PAC». La pestaña PAC antigua y el cuadro «Líneas PAC» de Inicio abren Ayudas > Ayudas PAC.
- **Barra de abajo**: Inicio · Ayudas · **Normativa** · Precios (PAC sale de la barra).
- **Números iguales**: el número de la pestaña Ayudas, los cuadros y la lista salen del mismo conjunto (sector, grupo y estado elegidos).
- **Listados de la Junta** (ayudas de incorporación, modernización, ganaderas): cada párrafo de requisitos ya no se publica como una «ayuda»; la página cuenta como una sola línea (su título) y se quitan las portadas genéricas («Ayudas, solicitudes y normativa», «Gestión electrónica de procedimientos y ayudas», «Ayudas para actividades ganaderas»). Las convocatorias y extractos enlazados siguen.
- Inicio no cambia: solo ayudas abiertas (cuadros Abiertas, Cierran pronto, Líneas PAC). Desde los cuadros, «Ver todas» abre Ayudas con el chip correspondiente.

### Quitado
- Pestañas **«Jóvenes»** (Jóvenes y modernización) y **«Noticias»** (Noticias oficiales). La barra de abajo (Inicio, Ayudas, PAC, Precios) no cambia.
- «Noticias» deja de ser un tipo en **Mis preferencias** y en «Lo que has puesto primero». Si estaba guardado en el dispositivo, se ignora (si era lo único elegido, vuelven Ayudas y PAC).
- La clasificación de las piezas no cambia: lo que es de Ayudas o PAC sigue saliendo ahí.

## v5.6 · 25/10/2026 · Pie de página discreto y legal; fichas más limpias; «Herramientas» en la cabecera; fuera «Estado de las fuentes» y el botón «← Inicio»

### Quitado
- **«Estado de las fuentes»** ya no sale al final de cada página. El listado completo, con el estado de cada fuente y sus condiciones de reutilización, sigue en la página **Fuentes oficiales** (`/fuentes`).
- **Botón «← Inicio»** (de v5.4) en todas las vistas y páginas sueltas. Para volver a Inicio se toca el título **«Alerta Agraria»** de la cabecera (en la consulta cambia a Inicio sin recargar; en /fuentes, /aviso-legal, /privacidad, /cookies, /herramientas, /quienes-somos y /planes lleva a `/`) o **Inicio** en la barra de abajo del móvil.
- Del pie salen el lema y los enlaces Inicio, Herramientas oficiales, Quiénes somos, Planes y Administración, y la frase «Información orientativa…» (sigue en cada aviso).

### Cambiado
- **Pie de página único y discreto** (letra pequeña y gris, claro y oscuro, no lo tapa la barra de abajo): «Información obtenida de fuentes oficiales, con enlace y fecha en cada aviso. Esta app no está vinculada a ningún organismo público.» y enlaces a Fuentes oficiales, Aviso legal, Privacidad y Cookies. El titular («BC») sigue saliendo solo en el Aviso legal.
- **Aviso legal:** nuevo párrafo sobre la reutilización de información del sector público (Ley 37/2007 y RD 1495/2011): se cita la fuente con su enlace, la fecha de publicación o de última actualización que da la fuente, no se cambia el sentido y la app no está vinculada a ningún organismo ni la patrocina o respalda ninguno.
- **«Lo que has puesto primero»** (Inicio): cada título lleva ahora también su fecha de publicación cuando la fuente la da, además de la fuente.
- **Tarjeta «Pagos PAC»** de Inicio: añade «Revisado el …» (la misma fecha de revisión del calendario PAC).

### Ficha de cada ayuda o noticia (todas las listas, cuadros, Resumen y favoritas)
- **Chips de arriba:** fuera «Plazo no indicado», «Fuera de tus filtros» / «En tus filtros», «Sin plazo indicado», «Línea», «Ayuda» y el de sector (Agricultura…). Se quedan «Nueva» / «✓ Leída», el tema (PAC, Normativa, Alerta) y los plazos reales («Cierra en N días», «Abre en…», «Abierta ahora», «Próxima apertura», «Cerrada»…).
- **Título en MAYÚSCULAS.**
- **Fuera el bloque «Por qué te puede interesar»** (menciones, «Solo se citan palabras…», beneficiarios).
- **«★ Favorita» y «Compartir» arriba a la derecha**, pequeños. Compartir usa el menú de compartir del iPhone/iPad (`navigator.share`) y, si no existe, abre WhatsApp. En móvil estrecho Compartir es solo el icono.
- **Abajo fuera:** «Favorita», «Compartir por WhatsApp», «Sin fecha para el calendario», «Ocultar esta ayuda» y «Abrir fuente oficial».
- **Fuente oficial:** el nombre de la fuente es ahora un botón que abre la publicación oficial en otra pestaña. «Publicado: dd/mm/aaaa» sale pequeño solo si la fuente da la fecha; si no la da, no sale ninguna línea.
- **Calendario:** si la ficha trae una fecha real y el plazo no ha cerrado, sale un enlace pequeño «Añadir al calendario» dentro de «Plazo e importe»; si no hay fecha, nada.
- Lo ya ocultado antes sigue oculto y se recupera en Ajustes › «Volver a mostrar ocultas». Tocar para marcar como leída, «Borrar leídas» y las favoritas siguen igual.

### Fuentes oficiales: estado discreto
- En `/fuentes`, el **estado de las fuentes** pasa a una lista compacta: una línea por fuente («BOE alimentación 3 piezas · Última lectura correcta…», ya con el espacio), letra de 13 px gris y separadores finos; los errores, en rojo pequeño.
- **«Preparadas, aún no consultadas (N)»** va en un desplegable cerrado; esas fuentes ya no salen como tarjetas.
- `/api/fuentes` añade el número de piezas de la última lectura (`count`).
- Caché `?v=39`.

### Solo lo abierto, sectores de selección múltiple
- Se quita el chip **«Solo abiertas»**: la app enseña siempre solo lo abierto. Lo **cerrado** y lo que **aún no ha abierto** (próximo) no sale en listas, Inicio, Resumen, plazos, contadores ni Mis favoritas (las favoritas se guardan igual y vuelven a salir si reabren). Lo que no trae fechas (líneas, anuncios) sí sale: nada dice que esté cerrado.
- Se quita el cuadro **«Próximas»** de Inicio (quedan 3: Abiertas, Cierran pronto, Líneas PAC) y la etiqueta «Próxima apertura» de las fichas.
- Se quita el chip **«Todos»**. Agricultura, Ganadería y Pesca se pueden marcar varios a la vez: ninguno = todo; varios = la suma. Se guarda en el dispositivo (`alerta_sectores_v1`); la primera vez parte del sector de Mis preferencias.

### Inicio más compacto
- Pestañas (Inicio, Ayudas, PAC, Calendario PAC…) y chips de sector (Solo abiertas, Agricultura…) con letra y relleno más pequeños: caben más en iPad y móvil.
- Se quita la pestaña **«Resumen»**: el resumen se abre con el botón «Resumen» de la cabecera (con su número).
- Los 4 cuadros de colores (Abiertas, Cierran pronto, Próximas, Líneas PAC) son más bajos; siguen desplegándose al tocarlos.

### Sin «Ocultar»
- Se quita la opción de **ocultar noticias** en todas partes: ficha, listas, cuadros de Inicio, Resumen, Mis favoritas (recuadro «Ayudas que ocultaste») y Ajustes («Volver a mostrar ocultas»).
- Lo que se hubiera ocultado antes **vuelve a verse**: al abrir la app se borra la lista antigua del dispositivo (`alerta_ocultadas_v1`). Las listas internas de la administración ya no ocultan nada al público.
- **«Borrar leídas» se mantiene** (es otra cosa): quita de la vista las leídas durante 15 días, con «Deshacer» y «Recuperar borradas» en Ajustes.

### Cabecera
- **Nuevo botón «Herramientas»** (icono de llave inglesa) entre «Preferencias» y «Ajustes»: Resumen, Preferencias, Herramientas, Ajustes. Abre «Herramientas oficiales» (en las páginas sueltas lleva a `/herramientas`). Se quita la pestaña «Herramientas» de la barra de pestañas; la barra de abajo sigue con Inicio, Ayudas, PAC y Precios. Cabe en 390 px (botones de 44 px).

### Pruebas
- `test/footer-v56.test.js`: sin «Estado de las fuentes», pie con la frase y los enlaces, sin «BC» en el pie, aviso legal con las condiciones de reutilización, fuente y fecha en cada pieza, sin botón «← Inicio» y vuelta con el título y la barra de abajo, caché v=39; sin «Ocultar»; ficha (chips, mayúsculas, sin «Por qué…», Favorita y Compartir arriba, fuente como botón, fecha solo si existe) y cabecera con Herramientas.
- Se adaptan las pruebas de v5.4/v5.5 que esperaban el botón «← Inicio» y la caché v=33.

## v5.5 · 23/10/2026 · Vuelven «tocar para marcar como leída» y «Borrar leídas»; botón «Preferencias» en la cabecera; el sector filtra los números

### Recuperado (como en la app original)
- **Tocar una noticia o ayuda la marca como leída** (otra vez la deja sin leer). Se ve atenuada, con el borde gris y la etiqueta «✓ Leída» en lugar de «Nueva». Abrir el enlace oficial (o «Ir al trámite») también la marca. En las leídas aparece «Marcar como no leída». Funciona en Ayudas, PAC, demás listas, cuadros de Inicio, Resumen y Mis favoritas.
- **«Borrar leídas (N)»** encima de las listas (Ayudas, PAC, Normativa…), dentro de los cuadros de Inicio abiertos y en el Resumen. Quita de la vista las leídas durante 15 días (como la app original). Las favoritas nunca se borran. Sale un aviso pequeño «Borradas N leídas · Deshacer» (8 s).
- **Ajustes › «Leídas y borradas»:** «Recuperar borradas (N)» y «Volver a mostrar ocultas (N)».

### Corregido
- **Los chips de sector (Agricultura / Ganadería / Pesca / Todos) ahora filtran de verdad.** Antes solo cambiaban el orden y los números no variaban. Ahora cambian los cuadros de Inicio (Abiertas, Cierran pronto, Próximas, Líneas PAC), su lista desplegada y «Ver todas (N)», «Lo que has puesto primero», los números de las pestañas, las listas de Ayudas, PAC, Normativa…, el Resumen y su número, y los plazos que cierran pronto. Se usa la clasificación que ya trae cada pieza (sector de la fuente oficial o del texto); lo que no tiene sector conocido solo sale en «Todos». «Solo abiertas» sigue aplicándose igual en todas partes.
- «Ver todas» lleva siempre el número (es el mismo que el del cuadro y el de la lista que abre).
- El número de la pestaña «Resumen» es el mismo que el del botón de la cabecera (piezas del último resumen), no el número de días guardados.

### Cambiado
- Todo se guarda **solo en este dispositivo** (`alerta_leidas_v1`: leídas y borradas con su fecha; cada marca caduca a los 15 días). Sin cuentas y sin enviar nada al servidor. Las marcas antiguas (`alerta_leidas_local`) se conservan.
- Los números de cuadros, pestañas y del botón «Resumen» ya no cuentan las borradas; las leídas que no se han borrado sí cuentan.
- «Solo no leídas» (en Mis preferencias › filtros) usa estas marcas también para el público.
- «Ocultar esta ayuda» sigue aparte (una sola ayuda, sin caducidad); se recupera desde Ajustes.
- **Cabecera:** nuevo botón «Preferencias» (icono de reguladores) entre «Resumen» y «Ajustes». En pantallas anchas se ve el texto; en móvil estrecho solo el icono, con `aria-label="Mis preferencias"`. Abre directamente el panel «Mis preferencias» (el mismo de Ajustes, sin el tema). Ajustes conserva el tema, «Leídas y borradas», un enlace «Ir a Mis preferencias ›» y las preferencias. En las páginas sueltas (/fuentes…) lleva a `/#preferencias`. Sin desbordes a 320 px.
- La línea del Resumen pasa a «Cambiar en Mis preferencias».
- Caché `?v=33`.

### Pruebas
- `test/sector-v55.test.js`: los cuadros cambian por sector, lo que no tiene sector solo sale en «Todos», número del cuadro = piezas del cuadro abierto = «Ver todas (N)», y listas, pestañas, Resumen y plazos usan el mismo filtro.
- `test/leidas-v55.test.js`: caducidad a 15 días, migración, borrar sin tocar favoritas, Deshacer, Recuperar, filtros de listas y Resumen, tarjeta (✓ Leída / Marcar como no leída / enlace oficial), «Borrar leídas (N)», Ajustes, cabecera con 3 botones y caché v=33.

## v5.4 · 23/10/2026 · Precios más limpios, cabecera con «Resumen» y «Ajustes», «← Inicio», cuadros desplegables

### Cambiado
- Cabecera de «Precios medios nacionales»: solo la semana en negrita («Semana 41 · 05/10-1/10»). Se quitan «Última columna con precios en la tabla oficial:» y «(texto literal de la cabecera)».
- Tablas de todos los grupos (cereales, girasol, leguminosas…): la columna se llama «Producto», sin «(tal como figura en la tabla)»; «Frente a la semana anterior publicada» pasa a «Variación».
- Se quita la línea «Posición comercial (n): …» bajo cada producto y la llamada «(n)». Se mantiene la unidad («Trigo blando (€/t)»).
- Se mantienen la fuente y los enlaces a la página oficial del MAPA y al Excel oficial.
- **Cabecera:** solo dos botones con icono SVG de trazo (como los de la barra de abajo): «Resumen» (periódico) y «Ajustes» (engranaje). En pantallas anchas se ve el texto; en móvil estrecho solo el icono, con `aria-label`. Se quitan el botón «Oscuro» y la barra «Mis preferencias» de la parte de arriba. El administrador sigue viendo «Actualizar».
- **Ajustes** (engranaje): panel con «Tema» (Claro / Oscuro / Automático) y, debajo, «Mis preferencias» completas. El tema se guarda igual que antes (`alerta_theme` en este dispositivo); «Automático» borra lo guardado y sigue el modo del sistema. En las páginas sueltas (/fuentes, /planes…) el panel solo enseña el tema.
- **Resumen del día:** se abre desde el botón «Resumen» de la cabecera (vista completa; desde las páginas sueltas lleva a `/#resumen`). El número pequeño del botón es lo que trae el último resumen en los tipos elegidos; si es 0 no sale. Se quita el bloque del resumen del cuerpo de Inicio. La línea «Mostrando: … · Cambiar en Ajustes › Mis preferencias» abre Ajustes en «Mis preferencias».
- **Barra de abajo (móvil):** Inicio, Ayudas, PAC y Precios. Se quitan «Resumen» y «Preferencias» porque ya están en la cabecera.
- **«← Inicio»:** botón pequeño arriba de cada vista que no es Inicio (Hoy en el campo/precios, Resumen, Calendario PAC, Favoritas, listas…) y en las páginas sueltas sin barra de abajo: /fuentes, /herramientas, /aviso-legal, /privacidad, /cookies, /quienes-somos, /planes.
- **Textos sobre cuentas y planes, discretos:** «Plan Gratis. Próximamente: plan Pro…» en Inicio, «Todavía no se contrata ni se cobra.» en /planes y «no hay cuenta ni se envía nada» en Favoritas pasan a letra pequeña gris, sin caja ni negrita.
- /fuentes: los textos largos ya no desbordan a 320 px.
- **Inicio sin textos repetidos:** «Abiertas», «Cierran pronto», «Próximas» y «Líneas PAC» salían dos veces (en los cuadros de colores y otra vez en las columnas «Abiertas ahora / Próximas / Cierran pronto» y el bloque «PAC» de más abajo). Ahora solo quedan los cuadros de colores.
- **Cuadros desplegables:** al tocar un cuadro se despliega debajo su lista (las mismas tarjetas de siempre, con enlace a la fuente oficial y la etiqueta del plazo), hasta 10, con «Ver todas (N)» que lleva a la lista completa con ese mismo filtro («Mostrando solo: … · Ver todo el apartado»). Tocar otra vez lo cierra; solo uno abierto a la vez. Botones con `aria-expanded` y `aria-controls`, flecha pequeña que gira y animación corta (sin animación si el móvil lo pide). Sin piezas: «No hay ninguna ahora».
- Los números de los cuadros son la cuenta real; «Líneas PAC» antes se cortaba en 8 y ahora cuenta todas.
- «Abiertas» ahora incluye también las que cierran pronto (antes, y ya en v5.3, solo contaba las de estado «abierta» y salía 0 aunque hubiera 3 cerrando pronto). Las próximas y las que no tienen fecha conocida no cuentan como abiertas. «Cierran pronto» es siempre parte de «Abiertas».
- Versión de caché `?v=32`.

### Comprobado
- Fechas de la semana: la app no corta nada. En el Excel oficial `precios_medios_nacionales_2026-s36.xlsx` la cabecera de la semana 41 dice literalmente «05/10-1/10» (la semana 40 dice «28/09-04/10»). Se enseña tal cual; no se corrige ni se inventa.
- Pruebas: `test/prices-v54.test.js` con la cabecera real y `test/ui-v54.test.js` (cabecera, Ajustes, tema, Resumen, barra de abajo, «← Inicio», textos de cuentas) y `test/inicio-cuadros-v54.test.js` (sin nombres repetidos, cuadros desplegables, lista, vacío).
- Sin desbordamiento horizontal a 320, 390 y 1024 px.

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
