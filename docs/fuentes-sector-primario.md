# Fuentes oficiales del sector primario (agricultura, ganadería, pesca)

Investigación para Alerta Agraria. Verificado el 21/10/2026 (hora de Madrid) con curl y WebFetch. Solo se incluyen URLs comprobadas; las bloqueadas se marcan.

**Leyenda.** `in_app`: ya la usa la app. Acceso: RSS/Atom, API, XLSX o HTML (hay que hacer scraping).

## Notas técnicas importantes

- **Certificados FNMT:** muchas webs del Estado (mapa.gob.es, FEGA, etc.) usan una cadena de la FNMT que el almacén de certificados de este servidor no reconoce (`self-signed certificate in certificate chain`). En Node, si da error, añade la CA raíz de la FNMT con `NODE_EXTRA_CA_CERTS`; no desactives la verificación TLS.
- **Bloqueos de red:** FEGA, BOCyL, BOJA (HTML), BOP Salamanca, BOPA, BON, navarra.es, BOC Cantabria y Agroseguro cortan la conexión o dan 403 desde la IP de este servidor, pero cargan con WebFetch. Hay que comprobarlas desde Render.
- **La Rioja (larioja.org)** está tras Cloudflare: bloquea tanto curl como WebFetch.
- **BDNS:** la mejora más rentable es filtrar `finalidad=12` (Agricultura, Pesca y Alimentación) y `regiones` (29 = CyL, 34 = Salamanca), y pedir la ficha `/api/convocatorias?vpd=GE&numConv=` para sacar `fechaInicioSolicitud`, `fechaFinSolicitud` y `abierto`.

## Nacional

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BDNS / SNPSAP – API de convocatorias (filtrada por finalidad Agricultura, Pesca y Alimentación)](https://www.infosubvenciones.es/bdnstrans/GE/es/inicio) *(in_app)* | agricultura, ganaderia, pesca, alimentacion · ayudas | nacional+CCAA+local | API JSON (OpenAPI: https://www.infosubvenciones.es/bdnstrans/estaticos/doc/snpsap-api.json)<br>`https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda?vpd=GE&finalidad=12&page=0&pageSize=50&order=fechaRecepcion&direccion=desc` | OK 2026-10-21 (curl 200) | Ya en la app, pero conviene: (1) filtrar finalidad=12 (AGRICULTURA, PESCA Y ALIMENTACIÓN); (2) regiones=29 (CyL) o 34 (Salamanca), códigos NUTS de /api/regiones; (3) pedir la ficha /api/convocatorias?vpd=GE&numConv=<código> que trae abierto, fechaInicioSolicitud, fechaFinSolicitud, presupuestoTotal, sectores y beneficiarios. Probado: finalidad=12&regiones=29 devuelve 492 convocatorias. Diaria. |
| [BOE – canal RSS Ganadería y animales](https://www.boe.es/rss/) | ganaderia · normativa, ayudas | nacional+UE | RSS<br>`https://www.boe.es/rss/canal_leg.php?l=l&c=117` | OK 2026-10-21 (curl 200) | 55 elementos el 21/10/2026. Diaria. La app ya lee Agricultura (c=101) y Alimentación (c=102). |
| [BOE – canal RSS Pesca](https://www.boe.es/rss/) | pesca · normativa, ayudas | nacional+UE | RSS<br>`https://www.boe.es/rss/canal_leg.php?l=l&c=122` | OK 2026-10-21 (curl 200) | Resoluciones de la Secretaría General de Pesca, vedas, cuotas. Diaria. |
| [BOE – canal RSS Medio ambiente](https://www.boe.es/rss/) | agricultura, ganaderia, desarrollo_rural · normativa | nacional+UE | RSS<br>`https://www.boe.es/rss/canal_leg.php?l=l&c=119` | OK 2026-10-21 (curl 200) | Útil para nitratos, agua, fitosanitarios. Mucho ruido: filtrar por palabras clave. |
| [BOE – canal RSS Unión Europea](https://www.boe.es/rss/) | agricultura, ganaderia, pesca · normativa, PAC | UE (reseñado en BOE) | RSS<br>`https://www.boe.es/rss/canal_leg.php?l=l&c=134` | OK 2026-10-21 (curl 200) | 141 elementos; recoge Reglamentos de ejecución UE. Filtrar por palabras clave PAC/agrícola. |
| [BOE – canales Agricultura, Alimentación y Ayudas](https://www.boe.es/rss/) *(in_app)* | agricultura, alimentacion · normativa, ayudas | nacional | RSS<br>`https://www.boe.es/rss/canal_leg.php?l=l&c=101 \| https://www.boe.es/rss/canal_leg.php?l=l&c=102 \| https://www.boe.es/rss/canal.php?c=ayudas` | OK 2026-10-21 (curl 200) | Ya usados por la app. Verificados. |
| [BOE – API de datos abiertos (sumario diario)](https://www.boe.es/datosabiertos/api/api.php) | agricultura, ganaderia, pesca · normativa, ayudas | nacional | API JSON/XML<br>`https://www.boe.es/datosabiertos/api/boe/sumario/AAAAMMDD` | OK 2026-10-21 (curl 200) | Requiere cabecera 'Accept: application/json' (sin ella devuelve 400). Alternativa más estructurada que los RSS. |
| [MAPA – RSS de noticias](https://www.mapa.gob.es/es/prensa/ultimas-noticias/) *(in_app)* | agricultura, ganaderia, pesca, alimentacion · noticias, ayudas, PAC | nacional | RSS<br>`https://www.mapa.gob.es/es/prensa/noticiasRss` | OK 2026-10-21 (curl 200) | Feed general (incluye pesca). Ya en la app (prensa/RSS). |
| [MAPA – RSS de agenda](https://www.mapa.gob.es/es/prensa/ultimas-noticias/) | agricultura, ganaderia, pesca · agenda | nacional | RSS<br>`https://www.mapa.gob.es/es/prensa/agendarss` | OK 2026-10-21 (curl 200) | Reuniones, conferencias sectoriales (reparto de fondos a CCAA). |
| [MAPA – Pesca (Secretaría General de Pesca)](https://www.mapa.gob.es/es/pesca/temas/) | pesca · ayudas, normativa, noticias | nacional | HTML<br>— | OK 2026-10-21 (curl 200) | No se encontró RSS propio de pesca; usar BOE c=122 + RSS de noticias MAPA. |
| [MAPA – FEMPA (Fondo Europeo Marítimo, de Pesca y Acuicultura)](https://www.mapa.gob.es/es/pesca/temas/fondos-europeos/fempa/) | pesca · ayudas | nacional | HTML<br>— | OK 2026-10-21 (curl 200) | Programa y convocatorias del FEMPA 2021-2027. |
| [FEGA – Noticias y circulares PAC](https://www.fega.gob.es/es/noticias) *(in_app)* | agricultura, ganaderia · PAC, ayudas | nacional | HTML<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | Ya en la app. Circulares de coordinación, importes de ecorregímenes, pagos FEAGA/FEADER. Desde la red de este servidor da error TLS; por WebFetch sí carga. Comprobar desde Render. |
| [Red PAC (Red Rural Nacional) – RSS con convocatorias PEPAC de todas las CCAA](https://www.redpac.es/) | agricultura, ganaderia, desarrollo_rural · ayudas, PAC | nacional (todas las CCAA) | RSS<br>`https://www.redpac.es/rss.xml` | OK 2026-10-21 (curl 200) | Publica 'Convocatoria de ayuda-2026-PEPAC <CCAA>-nnnn' por cada convocatoria del Plan Estratégico PAC en cada comunidad. Ideal para escalar a toda España. Fechas del 05/10/2026. |
| [MAPA – PAC 2023-2027 (PEPAC)](https://www.mapa.gob.es/es/pac/pac-2023-2027) | agricultura, ganaderia · PAC | nacional | HTML<br>— | OK 2026-10-21 (curl 200) | Documentación oficial del Plan Estratégico. |
| [MAPA – RASVE: últimos focos de enfermedades animales](https://servicio.mapa.gob.es/rasve/Publico/Publico/ultimosfocos.aspx) | ganaderia · alertas | nacional | HTML (tabla ASP.NET)<br>— | OK 2026-10-21 (curl 200) | 15 últimos focos (enfermedad, fecha, CCAA, provincia, municipio). Ej.: Newcastle 16/10/2026 en Castilla-La Mancha. Buscador: https://servicio.mapa.gob.es/rasve/Publico/Publico/BuscadorFocos.aspx |
| [MAPA – Situación sanitaria / consulta de focos](https://www.mapa.gob.es/es/ganaderia/temas/sanidad-animal-higiene-ganadera/sanidad-animal/consulta-focos) | ganaderia · alertas | nacional | HTML<br>— | OK 2026-10-21 (curl 200) | Página de entrada a lengua azul, gripe aviar, DNC, etc. |
| [MAPA – Sanidad vegetal / organismos nocivos](https://www.mapa.gob.es/es/agricultura/temas/sanidad-vegetal/organismos-nocivos/) | agricultura · alertas | nacional | HTML<br>— | OK 2026-10-21 (curl 200) | Plagas de cuarentena y planes de contingencia. |
| [MAPA – Precios medios nacionales (semanal)](https://www.mapa.gob.es/es/estadistica/temas/estadisticas-agrarias/economia/precios-medios-nacionales/) | agricultura, ganaderia · precios | nacional | XLSX (URL cambia por semana: ..._AAAA-sNN.xlsx)<br>`https://www.mapa.gob.es/dam/mapa/contenido/estadisticas/temas/estadisticas-agrarias/1.economicas/precios-medios/precios_medios_nacionales_2026-s36.xlsx` | OK 2026-10-21 (curl 200) | Cereales, ganado, leche, frutas… El último fichero enlazado era la semana 36 de 2026: va con retraso. |
| [MAPA – Observatorio de la cadena alimentaria](https://www.mapa.gob.es/es/alimentacion/temas/observatorio-cadena/) | agricultura, ganaderia, alimentacion · precios | nacional | HTML<br>— | OK 2026-10-21 (curl 200) | Costes y márgenes por producto. |
| [ENESA – Seguros agrarios (MAPA)](https://www.mapa.gob.es/es/enesa/) | agricultura, ganaderia, pesca · ayudas, seguros | nacional | HTML<br>— | OK 2026-10-21 (curl 200) | Subvenciones al seguro agrario y plazos de contratación por línea. |
| [Agroseguro](https://agroseguro.es/) | agricultura, ganaderia, pesca · seguros, alertas | nacional | HTML (WordPress; /feed/ y /rss dan 403)<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | Novedades de líneas de seguro y siniestros (p. ej. DANA). Bloquea curl (403); WebFetch sí carga la portada. |
| [AICA – Agencia de Información y Control Alimentarios](https://www.aica.gob.es/) | agricultura, ganaderia, alimentacion · normativa, precios | nacional | HTML<br>— | OK 2026-10-21 (curl 200) | Ley de la cadena, contratos alimentarios. Tiene API del Registro de Contratos (no de noticias). |
| [SAECA – Avales y financiación agraria](https://saeca.es/) | agricultura, ganaderia, pesca · ayudas, financiacion | nacional | RSS<br>`https://saeca.es/feed/` | OK 2026-10-21 (curl 200) | Líneas de préstamos avalados (p. ej. ayudas extraordinarias). Poca frecuencia (último 30/06/2026). |
| [Mercasa – noticias de la red de Mercas](https://www.mercasa.es/) | agricultura, pesca, alimentacion · noticias, precios | nacional | RSS<br>`https://www.mercasa.es/feed/` | OK 2026-10-21 (curl 200) | Útil sobre todo para mercados mayoristas; poco sobre ayudas. |
| [AEMET – Avisos meteorológicos (CAP) por CCAA](https://www.aemet.es/es/rss_info/avisos/esp) | agricultura, ganaderia, pesca · alertas, clima | nacional/CCAA | RSS/Atom (CAP)<br>`https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAC67_RSS.xml` | OK 2026-10-21 (curl 200) | Castilla y León = AFAC67 (verificado); España = CAP_AFAE_RSS.xml. Códigos: 61 Andalucía, 62 Aragón, 63 Asturias, 64 Baleares, 65 Canarias, 66 Cantabria, 67 CyL, 68 CLM, 69 Cataluña, 70 Extremadura, 71 Galicia, 72 Madrid, 73 Murcia, 74 Navarra, 75 País Vasco, 76 La Rioja, 77 C. Valenciana (63 y 67 comprobados por título, resto según el índice de AEMET). También hay _ATOM.xml. |
| [AEMET OpenData (API)](https://opendata.aemet.es/centrodedescargas/inicio) | agricultura, ganaderia · clima | nacional | API REST (requiere API key gratuita)<br>`https://opendata.aemet.es/centrodedescargas/productosAEMET` | OK 2026-10-21 (curl 200) | Predicciones por municipio, observación, productos climatológicos (balance hídrico, etc.). |
| [SiAR – Sistema de Información Agroclimática para el Regadío](https://observatorioregadio.gob.es/recursos-de-interes/siar/) | agricultura · clima | nacional | HTML (descargas de datos de estaciones)<br>— | OK 2026-10-21 (curl 200) | Datos agroclimáticos de estaciones y necesidades de riego. La antigua URL servicio.mapa.gob.es/websiar/ da 404. |
| [datos.gob.es – catálogo 'Medio rural y pesca' (API)](https://datos.gob.es/) | agricultura, ganaderia, pesca · datos | nacional | API JSON<br>`https://datos.gob.es/apidata/catalog/dataset/theme/medio-rural-pesca` | OK 2026-10-21 (curl 200) | Para descubrir datasets de todas las administraciones. |
| [Fundación Biodiversidad – convocatorias (economía azul / FEMPA)](https://fundacion-biodiversidad.es/) | pesca · ayudas | nacional | HTML<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | Organismo intermedio de fondos (FEMPA, PRTR). Relevancia media para pescadores. |

## Castilla y León / Salamanca

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [Junta CyL – Datos abiertos: Convocatorias de Ayudas y Subvenciones (API)](https://datosabiertos.jcyl.es/web/es/datos-abiertos-castilla-leon.html) | agricultura, ganaderia · ayudas, PAC | CCAA | API JSON (Opendatasoft v2.1), también CSV/JSON export<br>`https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/ayudas-y-subvenciones/records?where=materia%3D%22Agricultura%20y%20Ganader%C3%ADa%22&order_by=-fecha_publicacion&limit=100` | OK 2026-10-21 (curl 200) | 695 convocatorias, 121 de 'Agricultura y Ganadería'. Campos: titulo, fecha_publicacion, fecha_apertura, fecha_limite, plazo_presentacion, cuantia, destinatarios, codigo_bdns, enlace_contenido. Ojo: la más reciente indexada era del 30/01/2026, así que puede ir con retraso: usarla junto a la BDNS. |
| [Junta CyL – Datos abiertos: Solicitud Única PAC (superficies, solicitudes por SAC)](https://datosabiertos.jcyl.es/) | agricultura, ganaderia · PAC, datos | CCAA | API JSON<br>`https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets?where=search(%22ayudas%22)` | OK 2026-10-21 (curl 200) | Datasets 'solicitudes-sac', 'solicitudes-regimen-ayuda-sac', 'solicitudes-superficie-cultivo-provincia' (actualizados en jul-ago 2026). |
| [BOCyL](https://bocyl.jcyl.es/) *(in_app)* | agricultura, ganaderia · normativa, ayudas | CCAA | RSS + búsqueda (ya en la app)<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | Ya en la app. Bloquea curl desde este servidor (TLS), WebFetch OK. |
| [Junta CyL – PAC, Agricultura y Ganadería, Comunicación, ITACyL](https://pac.jcyl.es/) *(in_app)* | agricultura, ganaderia · PAC, ayudas, noticias | CCAA | HTML (ya en la app)<br>— | OK 2026-10-21 (curl 200) | Ya en la app: pac.jcyl.es, agriculturaganaderia.jcyl.es, comunicacion.jcyl.es, itacyl.es (todas 200). |
| [ITACyL – Portal de Plagas](https://plagas.itacyl.es/) | agricultura · alertas | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) | Avisos fitosanitarios y seguimiento de plagas (topillo, etc.). |
| [ITACyL – Portal de APIs (Sativum, etc.)](https://portal.api.itacyl.es/portal/) | agricultura · clima, datos | CCAA | API REST (con token)<br>`https://portal.api.itacyl.es/portal/apis/` | OK 2026-10-21 (curl 200) | Sativum: parcelas, clima, suelo, recomendaciones de abonado (convenio FEGA-ITACyL). Útil para funciones avanzadas. |
| [InfoRiego (ITACyL) – estaciones agrometeorológicas](https://www.inforiego.org/opencms/opencms/estaciones/index.html) | agricultura · clima | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) | Datos agroclimáticos de unas 54 estaciones. http://www.inforiego.org/ (raíz) da error 500/timeout; usar la ruta https indicada. |
| [BOP de Salamanca (Diputación)](https://sede.diputaciondesalamanca.gob.es/opencms/opencms/sede/BOP/) | agricultura, ganaderia · ayudas, normativa | provincia | HTML + PDF (BOP-SA-AAAAMMDD-NNN.pdf); sin RSS<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | Sumario diario con extractos BDNS de ayuntamientos y Diputación. Bloquea curl (TLS) desde este servidor; WebFetch OK. Mucho contenido no agrario: filtrar. |
| [Diputación de Salamanca – Subvenciones de Agricultura y Ganadería](https://www.lasalina.es/economiayhacienda/agriculturayganaderia/subvenciones/) | agricultura, ganaderia · ayudas | provincia | HTML<br>— | OK 2026-10-21 (curl 200) | Reposición de ovino/caprino, ferias, OPAs, reproductores selectos… con plazos. |
| [Lonja Agropecuaria de Salamanca – cotizaciones semanales](https://www.lasalina.es/economiayhacienda/agriculturayganaderia/mercado/lonja/) | agricultura, ganaderia · precios | provincia | HTML/PDF semanal (los lunes)<br>`http://www.lasalina.es/Aplicaciones/lonja/Cotizaciones.jsp` | OK 2026-10-21 (curl 200) | Cereales y ganado (lechazo, terneros, añojo…). Referencia de precios en Salamanca. La app de cotizaciones carga lenta. Existe además un dataset en datosabiertossalamanca.es ('cotizaciones-semanales-de-la-lonja-de-salamanca'), pero está tras Cloudflare (403) desde curl. |

## Comunidades autónomas

### Andalucía

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BOJA – Atom (boletín completo y por secciones)](https://www.juntadeandalucia.es/eboja/) | agricultura, ganaderia, pesca · normativa, ayudas | CCAA | Atom<br>`https://www.juntadeandalucia.es/boja/distribucion/boja.xml` | OK 2026-10-21 (curl 200) | Secciones: s51.xml (1. Disposiciones generales), s53.xml (2.2), etc. (índice: https://www.juntadeandalucia.es/informacion/fuentesweb.html). boja.xml y s51.xml verificados por curl. |
| [Consejería de Agricultura, Pesca, Agua y Desarrollo Rural – Solicitud Única PAC 2026](https://www.juntadeandalucia.es/organismos/agriculturapescaaguaydesarrollorural/areas/politica-agraria-comun/ayudas-pac/paginas/solicitud-unica-2026.html) | agricultura, ganaderia, pesca · PAC, ayudas | CCAA | HTML<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | El dominio bloquea curl desde este servidor; WebFetch OK. |

### Aragón

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BOA – Boletín Oficial de Aragón](https://www.boa.aragon.es/) | agricultura, ganaderia · normativa, ayudas | CCAA | HTML; suscripción por email (aplicaciones.aragon.es/sus_publico), con tema 'Ayudas y subvenciones'<br>— | OK 2026-10-21 (curl 200) | No se localizó una URL RSS pública verificable. |
| [Gobierno de Aragón – PAC 2026 y Novedades](https://www.aragon.es/pac-2026) | agricultura, ganaderia · PAC | CCAA | HTML<br>`https://www.aragon.es/pac-2026/novedades` | OK 2026-10-21 (curl 200) | También https://www.aragon.es/temas/agricultura-ganaderia-medio-rural/politica-agraria-comun-pac |

### Principado de Asturias

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BOPA](https://sede.asturias.es/ultimos-boletines) | agricultura, ganaderia, pesca · normativa, ayudas | CCAA | HTML; alertas por email (miBOPA); sin RSS<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | Bloquea curl; WebFetch OK. |
| [Asturias – Ayudas de la PAC 2023-2027](https://www.asturias.es/temas/agricultura-gestion-forestal/ayudas-agrarias/ayudas-pac) | agricultura, ganaderia · PAC, ayudas | CCAA | HTML<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | Fichas de cada línea, avisos (fuerza mayor, monitorización). |

### Illes Balears

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BOIB – RSS](https://www.caib.es/eboibfront/) | agricultura, ganaderia, pesca · normativa, ayudas | CCAA | RSS<br>`https://www.caib.es/eboibfront/indexrss.do?lang=es` | OK 2026-10-21 (curl 200) | Boletín diario. |
| [FOGAIBA – Ayudas directas PAC 2026 (sede)](https://www.caib.es/seucaib/es/200/persones/tramites/tramite/6451166) | agricultura, ganaderia · PAC, ayudas | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) | El portal https://www.caib.es/sites/fogaiba/ redirige a un login de intranet. |

### Canarias

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BOC Canarias – RSS (índice de feeds)](https://www.gobiernodecanarias.org/boc/) | agricultura, ganaderia, pesca · normativa, ayudas | CCAA | RSS<br>`https://www.gobiernodecanarias.org/boc/feeds/` | OK 2026-10-21 (curl 200) | Hay feeds por capítulo, cabildo y consejería. El de consejería/agricultura.rss responde pero estaba vacío (0 elementos): mejor por capítulo (capitulo/otras_resoluciones.rss, etc.) y filtrar. |
| [Consejería de Agricultura, Ganadería, Pesca y Soberanía Alimentaria (POSEI)](https://www.gobiernodecanarias.org/agpsa/) | agricultura, ganaderia, pesca · ayudas | CCAA | HTML<br>`https://www.gobiernodecanarias.org/agpsa/viceconsejeria/temas/posei/` | OK 2026-10-21 (curl 200) | POSEI sustituye a buena parte de los pagos directos en Canarias. |

### Cantabria

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BOC Cantabria](https://boc.cantabria.es/boces/inicioAvisos.do) | agricultura, ganaderia, pesca · normativa, ayudas | CCAA | HTML; avisos por email (avisosboc.cantabria.es)<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | Bloquea curl; WebFetch OK. No se encontró RSS verificable. |
| [Cantabria – Solicitud Única 2026 (sede)](https://sede.cantabria.es/sede/catalogo-de-tramites/convocatoria/orden-des-37-2025-solicitud-unica-2026/2458) | agricultura, ganaderia · PAC | CCAA | HTML<br>— | NO VERIFICADO (curl bloqueado) | Solo encontrada por búsqueda; curl bloqueado. Pendiente de verificar con navegador. |

### Castilla-La Mancha

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [DOCM](https://docm.jccm.es/docm/) | agricultura, ganaderia · normativa, ayudas | CCAA | HTML; alertas por email (docm.jccm.es/docm/alertas.do)<br>— | OK 2026-10-21 (curl 200) | Sin RSS localizado. |
| [Aplicaciones de Agricultura CLM – PAC](https://apliagri.castillalamancha.es/pac) | agricultura, ganaderia · PAC, ayudas | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) | Portal de la Consejería de Agricultura para la PAC. |

### Cataluña

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [DOGC](https://dogc.gencat.cat/) | agricultura, ganaderia, pesca · normativa, ayudas | CCAA | HTML + XML/RDF por documento; alertas por email; sin RSS<br>— | OK 2026-10-21 (curl 200) |  |
| [Govern.cat – RSS de notas de prensa (todos los departamentos)](https://govern.cat/salapremsa/) | agricultura, ganaderia, pesca · noticias, ayudas | CCAA | RSS<br>`https://govern.cat/salapremsa/api/v1/rss/search?objectType=1` | OK 2026-10-21 (curl 200) | Incluye el Departament d'Agricultura, Ramaderia, Pesca i Alimentació; filtrar por palabras clave. |
| [DARPA – Declaració Única Agrària (DUN)](https://agricultura.gencat.cat/ca/ambits/desenvolupament-rural/declaracio-unica-agraria/) | agricultura, ganaderia · PAC | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) |  |
| [Ruralcat](https://ruralcat.gencat.cat/) | agricultura, ganaderia · noticias, formacion | CCAA | HTML (la página de RSS no devolvió un feed XML)<br>`https://ruralcat.gencat.cat/web/guest/rss_ruralcat` | OK 2026-10-21 (curl 200) |  |

### Extremadura

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [DOE – RSS por secciones](https://doe.juntaex.es/) | agricultura, ganaderia · normativa, ayudas | CCAA | RSS<br>`https://doe.juntaex.es/rss/rss.php?seccion=1` | OK 2026-10-21 (curl 200) | seccion=0..5 (1 Disposiciones generales, 3 Otras resoluciones). Índice: https://doe.juntaex.es/rss/index.php |
| [Juntaex – PAC (noticias de plazos)](https://www.juntaex.es/w/ampliacion-plazo-solicitud-unica-pac-1) | agricultura, ganaderia · PAC | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) | Gestión en sga.juntaex.es. |

### Galicia

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [DOG – RSS por sección](https://www.xunta.gal/diario-oficial-galicia) | agricultura, ganaderia, pesca · normativa, ayudas | CCAA | RSS<br>`https://www.xunta.gal/diario-oficial-galicia/rss/Sumario_gl.rss` | OK 2026-10-21 (curl 200) | Seccion6_gl.rss = III. Outras disposicións (donde salen las ayudas). Índice: /diario-oficial-galicia/suscricionsRSS.do |
| [Consellería do Medio Rural – novas](https://mediorural.xunta.gal/gl/recursos/novas) | agricultura, ganaderia · noticias, ayudas | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) |  |
| [FOGGA (organismo pagador PAC)](https://fogga.xunta.gal/gl) | agricultura, ganaderia · PAC | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) |  |
| [Consellería do Mar / Pesca de Galicia](https://mar.xunta.gal/gl) | pesca · ayudas, normativa, precios | CCAA | HTML<br>`https://www.pescadegalicia.gal/` | OK 2026-10-21 (curl 200) | Clave para pesca y marisqueo (pescadegalicia.gal incluye datos de lonjas). |

### La Rioja

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BOR – Boletín Oficial de La Rioja](https://www.larioja.org/bor) | agricultura, ganaderia · normativa, ayudas | CCAA | HTML tras Cloudflare; 'BOR a la carta' por email<br>— | BLOQUEADO (Cloudflare) | Cloudflare bloquea curl y WebFetch: requiere navegador. |
| [La Rioja – Agricultura y Ganadería](https://web.larioja.org/agricultura-y-ganaderia) | agricultura, ganaderia · PAC, ayudas | CCAA | HTML<br>— | BLOQUEADO (Cloudflare) | Redirección verificada desde www.larioja.org/agricultura/es; contenido bloqueado por Cloudflare. |

### Comunidad de Madrid

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BOCM – RSS de sumarios](https://www.bocm.es/) | agricultura, ganaderia · normativa, ayudas | CCAA | RSS<br>`https://www.bocm.es/sumarios.rss` | OK 2026-10-21 (curl 200) | También /boletines.rss y /ultimo-boletin.xml. Nota: un elemento traía el año mal ('3026'). |
| [Comunidad de Madrid – PAC ayudas directas](https://www.comunidad.madrid/agricultura-ganaderia-medio-rural/politica-agricola-comun-pac-ayudas-directas) | agricultura, ganaderia · PAC | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) |  |

### Región de Murcia

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BORM](https://www.borm.es/) | agricultura, ganaderia, pesca · normativa, ayudas | CCAA | HTML (SPA Angular); canales RSS dentro de la app (#/home/rss), sin URL de feed estable localizada<br>`https://www.borm.es/services/boletin/ultimo` | OK 2026-10-21 (curl 200) |  |
| [CARM – Sede: Ayudas PAC (solicitud única)](https://sede.carm.es/web/pagina?IDCONTENIDO=2154&IDTIPO=240&RASTRO=c%24m40293) | agricultura, ganaderia · PAC | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) |  |

### Comunidad Foral de Navarra

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BON – Boletín Oficial de Navarra](https://bon.navarra.es/es/) | agricultura, ganaderia · normativa, ayudas | CCAA | HTML; alertas MiBON por email<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | Bloquea curl; WebFetch OK. |
| [Navarra – Política Agraria Común](https://www.navarra.es/es/agricultura-y-ganaderia/pac) | agricultura, ganaderia · PAC | CCAA | HTML<br>— | OK 2026-10-21 (WebFetch; bloqueado desde curl del servidor) | Bloquea curl; WebFetch OK. |

### País Vasco

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BOPV – último boletín (XML)](https://www.euskadi.eus/bopv) | agricultura, ganaderia, pesca · normativa, ayudas | CCAA | XML/RSS<br>`https://www.euskadi.eus/bopv2/datos/Ultimo.xml` | OK 2026-10-21 (curl 200) | Boletín del día en XML. |
| [Gobierno Vasco – Agricultura, Pesca e Industria Alimentaria](https://www.euskadi.eus/eusko-jaurlaritza/nekazaritza-arrantza-elikagai-industria/hasiera/) | agricultura, ganaderia, pesca · ayudas, noticias | CCAA | HTML<br>— | OK 2026-10-21 (curl 200) |  |

### Comunitat Valenciana

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [DOGV](https://dogv.gva.es/) | agricultura, ganaderia, pesca · normativa, ayudas | CCAA | HTML; alertas por email (dogv.gva.es/es/alertas-del-diari-oficial)<br>— | OK 2026-10-21 (curl 200) | Sin RSS localizado. |
| [Portal Agrari GVA – PAC](https://portalagrari.gva.es/va/pac) | agricultura, ganaderia · PAC | CCAA | HTML<br>`https://agricultura.gva.es/va/pac1` | OK 2026-10-21 (curl 200) |  |

### Ceuta y Melilla

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [BOME – Boletín Oficial de Melilla](https://bomemelilla.es/) |  · normativa | ciudad autónoma | HTML<br>— | OK 2026-10-21 (curl 200) | Relevancia agraria mínima. Web del BOCCE (Ceuta) no respondió a curl. |

## Unión Europea

| Fuente | Cubre | Ámbito | Acceso / feed | Estado | Notas |
|---|---|---|---|---|---|
| [Comisión Europea – DG AGRI: noticias](https://agriculture.ec.europa.eu/media/news_en) | agricultura, ganaderia · PAC, noticias | UE | RSS<br>`https://agriculture.ec.europa.eu/node/2/rss_en` | OK 2026-10-21 (curl 200) | 30 elementos; último 20/10/2026. |
| [Comisión Europea – DG MARE: noticias de pesca](https://oceans-and-fisheries.ec.europa.eu/news_en) | pesca · noticias, normativa | UE | RSS<br>`https://oceans-and-fisheries.ec.europa.eu/node/2/rss_en` | OK 2026-10-21 (curl 200) |  |
| [EUR-Lex – Actos del DOUE serie L (RSS)](https://eur-lex.europa.eu/oj/daily-view/L-series/default.html) | agricultura, ganaderia, pesca · normativa | UE | RSS<br>`https://eur-lex.europa.eu/ES/display-feed.rss?rssId=222` | OK 2026-10-21 (curl 200) | En español. Sin filtro temático: filtrar por palabras clave o crear un RSS propio con cuenta en EUR-Lex. rssId=162 = toda la legislación del Parlamento y el Consejo. |
| [EU Agri-food Data Portal – API de precios](https://agridata.ec.europa.eu/extensions/DataPortal/agricultural_markets.html) | agricultura, ganaderia · precios | UE (por Estado miembro) | API JSON<br>`https://api.tech.ec.europa.eu/agrifood/api/beef/prices?memberStateCodes=ES&years=2026` | OK 2026-10-21 (curl 200) | Precios semanales por país (vacuno, cereales, leche, porcino, etc.). Ideal para la expansión europea. |
| [Comisión Europea – Press corner RSS](https://ec.europa.eu/commission/presscorner/) | agricultura, ganaderia, pesca · noticias | UE | RSS<br>`https://ec.europa.eu/commission/presscorner/api/rss?language=es&pagesize=10` | OK 2026-10-21 (curl 200) | General; filtrar por palabras clave. |
| [EFSA – todas las novedades](https://www.efsa.europa.eu/en/news) | ganaderia, alimentacion · alertas | UE | RSS<br>`https://www.efsa.europa.eu/en/all/rss` | OK 2026-10-21 (curl 200) | Gripe aviar, seguridad alimentaria. |
| [EU CAP Network](https://eu-cap-network.ec.europa.eu/index_en) | agricultura, ganaderia, desarrollo_rural · PAC | UE | HTML<br>— | OK 2026-10-21 (curl 200) |  |
| [ADIS – Animal Disease Information System](https://food.ec.europa.eu/animals/animal-diseases/animal-disease-information-system-adis_en) | ganaderia · alertas | UE | HTML<br>— | OK 2026-10-21 (curl 200) |  |
| [Funding & Tenders Portal (UE)](https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home) | agricultura, ganaderia, pesca · ayudas | UE | HTML/SPA<br>— | OK 2026-10-21 (curl 200) | Convocatorias directas de la UE (Horizon, LIFE…), no de la PAC. |
| [WOAH WAHIS (sanidad animal mundial)](https://wahis.woah.org/) | ganaderia · alertas | internacional | SPA<br>— | OK 2026-10-21 (curl 200) |  |
| [RASFF Window (alertas alimentarias UE)](https://webgate.ec.europa.eu/rasff-window/screen/search) | alimentacion · alertas | UE | SPA<br>— | OK 2026-10-21 (curl 200) |  |

## Huecos detectados

- No hay RSS oficial en DOGC, DOGV, DOCM, BOA, BON, BOPA, BOR, BOC Cantabria ni BOP Salamanca: solo HTML o alertas por email. Para cubrir estas CCAA, lo más práctico es **BDNS (finalidad=12 + región)** y el **RSS de Red PAC**.
- MAPA no publica un RSS específico de pesca ni de sanidad animal; RASVE solo da HTML (los 15 últimos focos).
- No hay una API pública de lonjas nacionales; las de Salamanca van en HTML/PDF (el dataset de la Diputación está tras Cloudflare).
- Los precios medios del MAPA van con retraso (último xlsx: semana 36 de 2026); para precios recientes conviene la API Agri-food de la UE.
- No encontré un RSS verificable de Agroseguro (403) ni de ENESA.
- No se revisaron las webs de las organizaciones agrarias (ASAJA, COAG, UPA) ni la prensa sectorial, porque el encargo era solo de fuentes oficiales.
