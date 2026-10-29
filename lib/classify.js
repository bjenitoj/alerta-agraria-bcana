import { aidFromText, farmSignals, finalizeAid, mergeAid } from "./aid.js";
import { TERRITORIES } from "./config.js";
import { madridTodayKey } from "./preferences.js";

const territoryRes = TERRITORIES.map((territory) => ({
  ...territory,
  re: territory.pattern ? new RegExp(territory.pattern, "i") : null,
}));

export const CATEGORIES = [
  {
    id: "ayudas_subvenciones",
    title: "Ayudas y subvenciones",
    blurb: "Convocatorias, extractos y líneas de ayuda de agricultura, ganadería y pesca.",
  },
  {
    id: "pac_pagos",
    title: "PAC",
    blurb: "Todas las líneas de la PAC: pagos, ecorregímenes, solicitud única, derechos y desarrollo rural.",
  },
  {
    id: "normativa_convocatorias",
    title: "Normativa",
    blurb: "Órdenes, resoluciones, leyes y reglamentos que afectan al campo y al mar.",
  },
  {
    id: "jovenes_modernizacion",
    title: "Jóvenes y modernización",
    blurb: "Incorporación, relevo generacional y planes de mejora de explotaciones.",
  },
  {
    id: "noticias_oficiales",
    title: "Noticias oficiales",
    blurb: "Notas de prensa del MAPA, del FEGA y de la Junta de Castilla y León.",
  },
];

const AGRARIO =
  /agricult|ganader|agroaliment|desarrollo rural|pac\b|pepac|feader|feaga|fega|ecorreg|viñedo|vinedo|vitivin|agrari|cereal|ovino|vacuno|caprino|porcino|apicult|regad[ií]|secano|explotaci[oó]n agr|j[oó]venes agricult|modernizaci[oó]n|sigpac|solicitud [uú]nica|ayuda b[aá]sica|remolacha|girasol|herb[aá]ce|fitosanit|fertiliz|seguro agr|enesa|itacyl|medio rural|pol[ií]tica agr|acuicult|pesquer|\bpesca\b|fempa/i;

const AGRICULTURA =
  /agricult(?!ura, pesca)|cultivo|cereal|viñedo|vinedo|vitivin|herb[aá]ce|remolacha|girasol|secano|regad[ií]|fitosanit|fertiliz|siembra|cosecha|olivar|frutal|hort[ií]cola|parcela agr|superficie agr|semilla|maquinaria agr[ií]cola|concentraci[oó]n parcelaria|leguminosa|mejorante/i;

const GANADERIA =
  /ganader|vacuno|ovino|caprino|porcino|av[ií]cola|l[aá]ctea|\bleche\b|ternero|oveja|cabra|pasto|pastoreo|c[aá]rnico|explotaci[oó]n ganad|sanidad animal|raza aut[oó]ctona|bienestar animal|apicult|colmena/i;

const JOVENES =
  /j[oó]ven(?:es)? agricult|incorporaci[oó]n|relevo generacional|primera instalaci[oó]n|modernizaci[oó]n(?: de)? explot|plan(?:es)? de mejora|titularidad compartida/i;

const PAC =
  /pol[ií]tica agr[ií]cola com[uú]n|\bpac\b|pepac|ecorreg|solicitud [uú]nica|ayuda b[aá]sica|abrs|pagos? directos?|fega|feaga|feader|derechos de ayuda|condicionalidad|sigpac|intervenci[oó]n sectorial/i;

const PAC_OPERATIVA =
  /ecorreg|solicitud [uú]nica|ayuda b[aá]sica|abrs|pagos? directos?|importes unitarios|circular de coordinaci[oó]n|derechos de ayuda|sigpac|condicionalidad|anticipo de la pac|monitorizaci[oó]n/i;

// v5.7: rango normativo al principio del título (BOE/BOCyL).
export const NORMA_TITLE = /^\s*(?:ley(?: org[aá]nica)?|real decreto(?:-ley| legislativo)?|decreto(?:-ley| legislativo)?|orden|resoluci[oó]n|reglamento(?: delegado| de ejecuci[oó]n)?(?: \(ue\))?|directiva|decisi[oó]n(?: de ejecuci[oó]n)?|correcci[oó]n de errores)\b/i;
export function isNormaTitle(title) {
  return NORMA_TITLE.test(String(title || ""));
}
// v5.7: portadas o índices genéricos de ayudas (no son una línea ni una convocatoria concreta).
export const GENERIC_AID_PAGE = /^\s*(?:ayudas,? solicitudes y normativa|gesti[oó]n electr[oó]nica de procedimientos y ayudas|ayudas para actividades (?:ganaderas|agr[ií]colas)|ayudas y subvenciones|ayudas|subvenciones|tr[aá]mites y ayudas|procedimientos y ayudas)\s*\.?\s*$/i;
export function isGenericAidPage(title) {
  return GENERIC_AID_PAGE.test(String(title || ""));
}
// Lo que es de ayudas nunca es Normativa.
export const NOT_NORMA_AID = /\bayudas?\b|subvenci[oó]n|subvenciones|convocatori|beneficiari|bases reguladoras|extracto de la|\bpremios?\b|\bbdns\b/i;

const AYUDAS =
  /subvenci[oó]n(?:es)?|(?:convocatoria|extracto).{0,80}(?:ayuda|subvenci)|bases reguladoras|\bayudas?\b(?! b[aá]sica)|bonificaci[oó]n|l[ií]nea de ayuda|infosubvenciones|\bbdns\b|seguro agr|ayuda asociada/i;

const LEYES = /real decreto|r\.?\s*d\.?\s*-?\s*ley|ley \d+\/\d+|orden apa\/|orden agr\/|reglamento \(ue\)|boe-a-|doue-/i;

const PESCA_SOLO =
  /\bpesquer|\barmador(?:es)?\b|caladero|arrastrero|lonja|acuicultur|marisqueo|buque (?:pesquero|oceanogr)|campaña (?:medits|juvena)|golfo de vizcaya|\bfota pesquer|secretar[ií]a general de pesca|fondos europeos para la pesca|captura for|cuota pesquer|ieo\b|oceanograf|fempa|fe mpa|pesca continental|licencia de pesca/i;

const ALERTA =
  /lengua azul|peste porcina|influenza aviar|gripe aviar|alerta sanitaria|aviso fitosanitario|incendio|sequ[ií]a|helada|granizo|enfermedad hemorr[aá]gica|tuberculosis bovina|brucelosis|sanidad animal/i;

const MASCOTA =
  /animal de compa[nñ][ií]a|\bperro\b|\bgato\b|n[uú]cleo zool[oó]gico|protectora de animales|animal dom[eé]stico/i;

const OTRA_COMUNIDAD =
  /andaluc[ií]a|arag[oó]n|\basturias\b|baleares|\bcanarias\b|\bcantabria\b|castilla[-\s]la mancha|catalu[nñ]a|catalunya|generalitat|comunidad valenciana|valencian[oa]|extremadura|\bgalicia\b|comunidad de madrid|regi[oó]n de murcia|\bmurcia\b|\bnavarra\b|pa[ií]s vasco|euskadi|\bla rioja\b|\bceuta\b|\bmelilla\b/i;

const MONTHS = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function stripMinisterio(text = "") {
  return String(text)
    .replace(/ministerio de agricultura,?\s*pesca y alimentaci[oó]n/gi, "MAPA")
    .replace(/agricultura,?\s*pesca y alimentaci[oó]n/gi, "agricultura y alimentación");
}

export function isAgrario(text = "") {
  return AGRARIO.test(text);
}

export function isCastillaLeon(text = "") {
  return /castilla y le[oó]n|junta de castilla|\bjcyl\b|\bbocyl\b|\bcyl\b|ES41/i.test(text);
}

export function isOtraComunidad(text = "") {
  return OTRA_COMUNIDAD.test(String(text || ""));
}

export function ambitoPermitido(text = "") {
  const hits = territoryRes.filter((territory) => territory.re && territory.re.test(text));
  if (!hits.length) return true;
  return hits.some((territory) => territory.enabled);
}

export function mentionsPesca(text = "") {
  return PESCA_SOLO.test(stripMinisterio(text)) || /\bpesca\b/i.test(stripMinisterio(text));
}

export function isPesca(text = "") {
  const cleaned = stripMinisterio(text);
  if (PESCA_SOLO.test(cleaned) && !(AGRICULTURA.test(cleaned) || GANADERIA.test(cleaned))) return true;
  const hasPescaWord = /\bpesca\b/i.test(cleaned);
  const hasCampo = AGRICULTURA.test(cleaned) || GANADERIA.test(cleaned) || PAC.test(cleaned);
  return hasPescaWord && !hasCampo;
}

export function isMascota(text = "") {
  return MASCOTA.test(text) && !GANADERIA.test(stripMinisterio(text));
}

export function isRelevant(text = "") {
  if (isMascota(text)) return false;
  return isAgrario(text) || GANADERIA.test(text) || mentionsPesca(text) || PAC.test(text);
}

export function sectorsOf(text = "") {
  const cleaned = stripMinisterio(text);
  const out = [];
  if (AGRICULTURA.test(cleaned)) out.push("agricultura");
  if (GANADERIA.test(cleaned)) out.push("ganaderia");
  if (mentionsPesca(cleaned) && !isMascota(text)) out.push("pesca");
  if (!out.length && (PAC.test(cleaned) || /desarrollo rural|agroaliment|explotaci[oó]n agraria/i.test(cleaned))) {
    out.push("agricultura", "ganaderia");
  }
  if (!out.length && isAgrario(cleaned)) out.push("agricultura");
  return [...new Set(out)];
}

function literalHits(re, text, limit = 4) {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const out = [];
  const source = String(text || "");
  const letter = /[\p{L}\p{N}]/u;
  for (const m of source.matchAll(new RegExp(re.source, flags))) {
    // Palabra completa del texto oficial, no la raíz de la regla («agricult» → «agricultura»).
    let start = m.index;
    let end = m.index + String(m[0] || "").length;
    while (start > 0 && letter.test(source[start - 1])) start -= 1;
    while (end < source.length && letter.test(source[end])) end += 1;
    const word = source.slice(start, end).trim();
    if (word && !out.some((seen) => seen.toLowerCase() === word.toLowerCase())) out.push(word);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Palabras literales del título y el resumen oficiales que justifican cada sector.
 * Si un sector se dedujo sin palabra (p. ej. solo por «PAC»), no tiene evidencia y la app no lo muestra.
 */
export function sectorEvidence(text = "") {
  const cleaned = stripMinisterio(text);
  const out = {};
  const agri = literalHits(AGRICULTURA, cleaned);
  const gana = literalHits(GANADERIA, cleaned);
  const pesca = /\bpesca\b/i.test(cleaned) && !isMascota(text) ? literalHits(/\bpesca\b/i, cleaned, 1) : [];
  if (agri.length) out.agricultura = agri;
  if (gana.length) out.ganaderia = gana;
  if (pesca.length) out.pesca = pesca;
  return out;
}

export function zoneOf(text = "") {
  const blob = String(text || "");
  if (/salamanca/i.test(blob)) return "salamanca";
  if (isCastillaLeon(blob)) return "cyl";
  const other = territoryRes.find((territory) => territory.re && territory.id !== "es-cl" && territory.id !== "es-cl-sa" && territory.re.test(blob));
  if (other) return other.enabled ? other.id : "otra";
  return "nacional";
}

export function topicOf(text = "") {
  const sectors = sectorsOf(text);
  if (sectors.length === 1) return sectors[0] === "ganaderia" ? "ganaderia" : sectors[0] === "pesca" ? "pesca" : "agricultura";
  if (sectors.includes("pesca") && sectors.length === 1) return "pesca";
  if (sectors.includes("ganaderia") && !sectors.includes("agricultura") && !sectors.includes("pesca")) return "ganaderia";
  if (sectors.includes("agricultura") && !sectors.includes("ganaderia") && !sectors.includes("pesca")) return "agricultura";
  if (isPesca(text)) return "pesca";
  return "ambos";
}

export function madridDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return madridTodayKey(date);
}

export function isAfterMadridDay(value, dayKey = madridDateKey()) {
  const key = madridDateKey(value);
  return Boolean(key && key > dayKey);
}

export const RECENT_DAYS = 15;

export function isRecentPublication(value, days = RECENT_DAYS) {
  const key = madridDateKey(value);
  if (!key) return false;
  const today = madridDateKey();
  if (key > today) return false;
  const published = Date.parse(`${key}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  return (current - published) / 86400000 <= days;
}

export function canonicalUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|mc_|blobheader|blobnocache)/i.test(key)) parsed.searchParams.delete(key);
    }
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    const query = parsed.searchParams.toString();
    return `${parsed.hostname.replace(/^www\./, "")}${pathname}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return String(url || "").split("#")[0].trim().toLowerCase();
  }
}

export function documentKeys(url, title = "") {
  const found = new Set();
  let host = "";
  try {
    const parsed = new URL(String(url || ""));
    host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const id = parsed.searchParams.get("id");
    if (host && id && id.trim().length >= 6) found.add(`d:${host}:${id.trim().toLowerCase()}`);
  } catch {
    /* la direccion puede no ser una URL */
  }
  const blob = `${url || ""} ${title || ""}`;
  for (const match of blob.matchAll(/\b((?:boe|doue|bocyl)[-–][a-z0-9]+(?:[-–][a-z0-9]+){2,6})\b/gi)) {
    found.add(`d:${match[1].replace(/–/g, "-").toLowerCase()}`);
  }
  const uuid = blob.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) found.add(`d:${uuid[0].toLowerCase()}`);
  return [...found];
}

export function titleKey(title) {
  return String(title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function clampDate(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  if (isAfterMadridDay(date)) return null;
  return date.toISOString();
}

function fromSpanishLongDate(text) {
  const match = String(text).match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (month == null) return null;
  return clampDate(new Date(Number(match[3]), month, Number(match[1]), 12, 0, 0));
}

function parseExplicit(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return clampDate(new Date(year, month - 1, day, 12, 0, 0));
    }
  }
  if (raw.length < 80) {
    const short = fromSpanishLongDate(raw);
    if (short) return short;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) || /[A-Za-z]{3},/.test(raw) || raw.includes("T")) {
    const parsed = clampDate(new Date(raw));
    if (parsed) return parsed;
  }
  return fromSpanishLongDate(raw);
}

export function parseDate(value, fallbackText = "") {
  return parseExplicit(value) || (fallbackText ? fromSpanishLongDate(fallbackText) : null);
}

function isAidText(sourceId, blob) {
  return (
    sourceId === "bdns" ||
    sourceId === "junta_ayudas" ||
    sourceId === "boe_ayudas" ||
    sourceId === "pac_lineas" ||
    sourceId === "ayudas_ganaderia" ||
    AYUDAS.test(blob) ||
    /ayuda asociada|pago directo|ecorregimen|solicitud [uú]nica/i.test(blob)
  );
}

function regionName(zone) {
  if (zone === "nacional") return "España";
  if (zone === "salamanca") return "Salamanca";
  if (zone === "cyl") return "Castilla y León";
  return TERRITORIES.find((territory) => territory.id === zone)?.name || "";
}

export function classify({ sourceId = "", title = "", summary = "", extra = "" }) {
  const blob = `${sourceId} ${title} ${summary} ${extra}`;
  const grantText = `${title} ${summary}`.replace(/https?:\/\/\S+/gi, "");
  if (JOVENES.test(blob) && !/ayuda asociada|pago directo asociado/i.test(blob)) return "jovenes_modernizacion";
  const esConvocatoria = sourceId === "bdns" || sourceId === "boe_ayudas" || sourceId === "ayudas_ganaderia" || AYUDAS.test(grantText);
  if (PAC_OPERATIVA.test(blob) && !/convocatoria|extracto de la orden|bases reguladoras|\bbdns\b/i.test(blob)) {
    return "pac_pagos";
  }
  if (esConvocatoria && !PAC_OPERATIVA.test(title)) return "ayudas_subvenciones";
  // v5.7: Normativa = solo normas (leyes, reales decretos, decretos, órdenes, resoluciones, reglamentos) de BOE/BOCyL.
  // Nada de ayudas: lo que habla de ayudas, convocatorias, beneficiarios o premios va a Ayudas (exclusivo).
  if (/^boe_/.test(sourceId) || sourceId === "bocyl" || sourceId === "boe_consolidada" || LEYES.test(blob)) {
    if (NOT_NORMA_AID.test(grantText)) return "ayudas_subvenciones";
    if (PAC.test(blob) && !/ley |real decreto|reglamento/i.test(title)) return "pac_pagos";
    if (isNormaTitle(title) || LEYES.test(title)) return "normativa_convocatorias";
    if (/^boe_/.test(sourceId) || sourceId === "bocyl") return "noticias_oficiales";
  }
  if (sourceId === "fega" || sourceId === "pac_cyl" || sourceId === "pac_lineas" || PAC.test(blob)) return "pac_pagos";
  if (isAidText(sourceId, blob)) return "ayudas_subvenciones";
  if (
    sourceId === "mapa_rss" ||
    sourceId === "mapa_prensa" ||
    sourceId === "mapa_pesca" ||
    sourceId === "junta_comunicacion" ||
    sourceId === "itacyl" ||
    sourceId === "cyl_pesca"
  ) {
    if (PAC.test(blob)) return "pac_pagos";
    if (isAidText(sourceId, blob)) return "ayudas_subvenciones";
    return "noticias_oficiales";
  }
  return "noticias_oficiales";
}

function themesFor(item, blob, category) {
  const themes = [];
  if (category === "pac_pagos" || PAC.test(blob) || item.sourceId === "pac_cyl" || item.sourceId === "pac_lineas" || item.sourceId === "fega") {
    themes.push("pac");
  }
  if (isAidText(item.sourceId, blob) || category === "ayudas_subvenciones" || item.kind === "linea") themes.push("ayuda");
  if (JOVENES.test(blob) || category === "jovenes_modernizacion") themes.push("jovenes");
  if (ALERTA.test(blob)) themes.push("alerta");
  return [...new Set(themes)];
}

function infoTypesFor(category, themes) {
  const types = [];
  if (themes.includes("ayuda") || category === "ayudas_subvenciones") types.push("ayudas");
  if (themes.includes("pac") || category === "pac_pagos") types.push("pac");
  if (category === "normativa_convocatorias") types.push("normativa");
  if (themes.includes("alerta")) types.push("alertas");
  if (category === "noticias_oficiales" || category === "jovenes_modernizacion") types.push("noticias");
  if (!types.length) types.push("noticias");
  return [...new Set(types)];
}

function pinnedStatus(status) {
  return status === "abierta" || status === "proxima" || status === "cierra_pronto";
}

export function decorateItem(item, today = new Date()) {
  if (!item) return null;
  const extra = item.extra || "";
  const blob = `${item.title || ""} ${item.summary || ""} ${item.sourceName || ""} ${extra}`;
  if (isMascota(blob)) return null;
  if (!ambitoPermitido(blob)) return null;
  const publishedAt = item.publishedAt ? parseDate(item.publishedAt) : null;
  const catalog = item.kind === "linea" || item.dateSource === "catalogo";
  if (!catalog && item.dateSource && item.dateSource !== "meta") return null;
  if (!catalog && !publishedAt) return null;
  const farm = farmSignals(blob);
  const textAid = aidFromText(`${item.title || ""}. ${item.summary || ""}`);
  if (!textAid.what) {
    const summary = String(item.summary || "").replace(/\s+/g, " ").trim();
    textAid.what = summary ? (summary.length > 280 ? `${summary.slice(0, 279).trimEnd()}…` : summary) : null;
  }
  const aid = finalizeAid(mergeAid(item.aid, textAid), madridTodayKey(today));
  const zone = zoneOf(blob);
  if (zone === "otra") return null;
  const category = classify({
    sourceId: item.sourceId,
    title: item.title,
    summary: item.summary,
    extra: blob,
  });
  const themes = themesFor(item, blob, category);
  const infoTypes = infoTypesFor(category, themes);
  const visible = catalog || pinnedStatus(aid.status) || (publishedAt && isRecentPublication(publishedAt, RECENT_DAYS));
  if (!visible) return null;
  return {
    ...item,
    dateSource: catalog ? "catalogo" : "meta",
    publishedAt: publishedAt || null,
    topic: topicOf(blob),
    sectors: sectorsOf(blob),
    sectorEvidence: sectorEvidence(`${item.title || ""} ${item.summary || ""}`),
    crops: farm.crops,
    water: farm.water,
    zone,
    region: regionName(zone),
    category,
    themes,
    infoTypes,
    aid,
    kind: item.kind === "linea" ? "linea" : infoTypes.includes("ayudas") ? "ayuda" : "noticia",
  };
}
