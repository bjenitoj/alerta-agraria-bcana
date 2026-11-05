/**
 * v6.3 · Nueva PAC: seguimiento oficial de la reforma de la PAC después de 2027
 * (propuestas de la Comisión de julio de 2025 para el MFP 2028-2034, planes de asociación
 * nacionales y regionales, negociación en Consejo y Parlamento).
 *
 * Solo fuentes oficiales. Si una fuente no responde, se dice y no se inventa nada.
 * Las convocatorias y pagos de la PAC actual se quedan en Ayudas / Calendario PAC.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchText } from "./net.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const NUEVA_PAC_HUB =
  "https://agriculture.ec.europa.eu/common-agricultural-policy/cap-post-2027-next-eu-budget_es";

export const NUEVA_PAC_SOURCES = [
  {
    id: "comision_hub",
    name: "Comisión Europea · DG AGRI (PAC después de 2027)",
    organism: "Comisión Europea · Dirección General de Agricultura y Desarrollo Rural",
    url: NUEVA_PAC_HUB,
    feed: NUEVA_PAC_HUB,
  },
  {
    id: "comision_noticias",
    name: "Comisión Europea · Noticias DG AGRI",
    organism: "Comisión Europea · DG AGRI",
    url: "https://agriculture.ec.europa.eu/media/news_es",
    feed: "https://agriculture.ec.europa.eu/media/news_es",
  },
  {
    id: "comision_prensa",
    name: "Comisión Europea · Notas de prensa (AGRI)",
    organism: "Comisión Europea",
    url: "https://ec.europa.eu/commission/presscorner/home/es",
    feed: "https://ec.europa.eu/commission/presscorner/api/rss?language=es&topic=AGRI",
  },
  {
    id: "red_pac",
    name: "Red PAC",
    organism: "Red PAC (Ministerio de Agricultura, Pesca y Alimentación)",
    url: "https://www.redpac.es/",
    feed: "https://www.redpac.es/rss.xml",
  },
  {
    id: "fega",
    name: "FEGA",
    organism: "Fondo Español de Garantía Agraria",
    url: "https://www.fega.gob.es/es/noticias",
    feed: "https://www.fega.gob.es/es/noticias",
  },
  {
    id: "mapa_reforma",
    name: "MAPA · Reforma PAC 2028-2034",
    organism: "Ministerio de Agricultura, Pesca y Alimentación",
    url: "https://www.mapa.gob.es/es/pac/reforma-pac-2028-2034",
    feed: "https://www.mapa.gob.es/es/pac/reforma-pac-2028-2034",
  },
];

/** Fuentes previstas que en esta lectura no respondieron (se documentan; no se inventa contenido). */
export const NUEVA_PAC_SOURCES_UNAVAILABLE = [
  { id: "mapa_prensa", name: "MAPA · Notas de prensa (RSS)", url: "https://www.mapa.gob.es/es/prensa/noticiasRss", reason: "Sin respuesta desde el servidor de la app" },
  { id: "consejo", name: "Consejo de la UE · Prensa / reforma PAC", url: "https://www.consilium.europa.eu/es/policies/cap-reform/", reason: "La web del Consejo devolvió 403" },
  { id: "parlamento", name: "Parlamento Europeo · Comisión AGRI", url: "https://www.europarl.europa.eu/committees/es/agri/home", reason: "La web del Parlamento devolvió 403 de forma intermitente" },
  { id: "junta_cyl", name: "Junta de Castilla y León · Agricultura", url: "https://agriculturaganaderia.jcyl.es/web/es/agricultura-ganaderia.html", reason: "Sin respuesta estable desde el servidor de la app" },
];

const MONTHS = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const clean = (s) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ")
    .replace(/&uuml;/gi, "ü").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();

const absUrl = (href, base) => {
  try { return new URL(href, base).href; } catch { return href || base; }
};

/** Palabras de la reforma post-2027 / MFP 2028-2034. */
export const NUEVA_PAC_INCLUDE =
  /reforma\s+(de\s+la\s+)?pac|pac\s*2028[\s-]*2034|negotiating\s+position.{0,40}agricultural|posici[oó]n\s+negociadora.{0,40}pac|pac\s*post[\s-]*2027|post[\s-]*2027\s*cap|nueva\s+pac|pac\s*2028|pac\s*2028[\s-]*2034|cap\s*2028|cap\s*after\s*2027|future\s+of\s+the\s+cap|futur[oa]\s+de\s+la\s+pac|marco\s+financiero\s+plurianual|mfp\s*2028|\bmff\b|presupuesto\s+(a\s+largo\s+plazo|de\s+la\s+ue)\s*.{0,40}2028|planes?\s+de\s+asociaci[oó]n\s+(nacionales?|regionales?)|fondo\s+[uú]nico|national\s+and\s+regional\s+partnership|propuesta\s+de\s+la\s+pac\s*(posterior|2028)|pac\s+despu[eé]s\s+de\s+2027|cap\s+post[\s-]*2027|asignaciones?\s+nacionales?\s+m[ií]nimas?.{0,30}(pac|2027)|ayuda\s+a\s+la\s+renta.{0,40}(2028|post[\s-]*2027|propuesta)/i;

/** Convocatorias y pagos de la PAC / PEPAC actuales: se quedan en Ayudas y Calendario. */
export const NUEVA_PAC_EXCLUDE =
  /convocatoria\s+de\s+ayuda|extracto\s+de\s+la\s+orden|bases\s+reguladoras|\bbdns\b|solicitud\s+[uú]nica|campa[nñ]a\s+pac\s*20(2[3-6]|27)|pepac\s*2023|pagos?\s+directos?\s+de\s+la\s+campa|circular\s+de\s+coordinaci[oó]n|imcap\s*2027|acercar\s+la\s+pac\s+a\s+los\s+ciudadanos|oportunidades?\s+de\s+pesca|fishing\s+opportunities/i;

export function isNuevaPacText(...parts) {
  const blob = parts.filter(Boolean).join(" · ");
  if (!blob) return false;
  if (NUEVA_PAC_EXCLUDE.test(blob)) return false;
  return NUEVA_PAC_INCLUDE.test(blob);
}

function dateFromUrl(url) {
  const m = String(url).match(/(20\d{2})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function dateFromSpanish(text) {
  const m = String(text).match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(20\d{2})/i);
  if (!m) return null;
  const mo = MONTHS[m[2].toLowerCase()];
  if (!mo) return null;
  return `${m[3]}-${String(mo).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}

function dateFromIso(text) {
  const m = String(text).match(/(20\d{2})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parseRss(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const get = (tag) => clean((m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")) || [])[1] || "");
    const title = get("title");
    const link = get("link") || clean((m[1].match(/<link[^>]+href="([^"]+)"/i) || [])[1] || "");
    const summary = get("description");
    const pub = get("pubDate") || get("dc:date") || get("date");
    const date = dateFromIso(pub) || dateFromSpanish(pub) || dateFromUrl(link);
    if (title && link) out.push({ title, url: link, summary: summary.slice(0, 280), date });
  }
  return out;
}

/** Enlaces a noticias DG AGRI en una página HTML. */
export function parseAgriNewsLinks(html, base = "https://agriculture.ec.europa.eu/") {
  const out = [];
  const seen = new Set();
  for (const m of String(html).matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].replace(/&amp;/g, "&");
    if (!/\/media\/news\//i.test(href)) continue;
    const title = clean(m[2]);
    if (title.length < 20) continue;
    const url = absUrl(href, base);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title, url, summary: "", date: dateFromUrl(url) });
  }
  return out;
}

/** Enlaces de noticias en la portada FEGA. */
export function parseFegaNews(html, base = "https://www.fega.gob.es/") {
  const out = [];
  const seen = new Set();
  for (const m of String(html).matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const title = clean(m[2]);
    if (title.length < 30 || title.length > 220) continue;
    if (!/\/es\/noticias\//i.test(href) && !/\/noticias\//i.test(href)) continue;
    const url = absUrl(href, base);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title, url, summary: "", date: dateFromSpanish(title) || dateFromUrl(url) });
  }
  return out;
}

export const NUEVA_PAC_TYPES = ["Norma", "Propuesta", "Avance", "Postura", "Consulta", "Documento", "Otro"];

/** Clasifica una noticia solo con pistas del título, la URL y el resumen oficial. */
export function classifyNuevaPacType(item = {}) {
  const blob = `${item.title || ""} · ${item.summary || ""} · ${item.url || ""}`;
  if (/questions?\s+and\s+answers|preguntas\s+y\s+respuestas|fichas?\s+informativ|factsheet/i.test(blob)) return "Documento";
  if (/eur-lex\.europa\.eu|celex:|\bnorma\b/i.test(blob) && !/propuesta|proposal|COM\(/i.test(blob)) return "Norma";
  if (/reforma-pac-2028|mapa\.gob\.es\/es\/pac\/reforma/i.test(blob)) return "Postura";
  if (/postura|posici[oó]n\s+negociadora|negotiating\s+position|consejo\s+secures/i.test(blob)) return "Avance";
  if (/mapa|ministerio\s+de\s+agricultura|junta\s+de\s+castilla|gobierno\s+de\s+espa[nñ]a/i.test(blob) && /reforma|pac\s*2028|post[\s-]*2027|futur/i.test(blob)) return "Postura";
  if (/negociaci|partial\s+general\s+approach|orientaci[oó]n\s+general|tr[ií]logo/i.test(blob)) return "Avance";
  if (/consulta|di[aá]logo\s+estrat[eé]gico|panel\s+de\s+ciudadanos|hearing|consulta\s+p[uú]blica/i.test(blob)) return "Consulta";
  if (/propuesta|proposal|COM\(\d{4}\)|52025PC|paquete\s+legislativ/i.test(blob)) return "Propuesta";
  if (/documento|publicaci[oó]n/i.test(blob)) return "Documento";
  if (/asignaciones?\s+nacionales|cap\s+post|pac\s+despu[eé]s/i.test(blob)) return "Propuesta";
  return "Otro";
}

/** Recorta el texto oficial a 1-2 frases; no reescribe ni inventa. */
export function miniSummaryFromOfficial(text) {
  let t = clean(text);
  if (!t) return "";
  // Quita restos típicos de menús pegados al principio.
  t = t.replace(/^(Skip to|Saltar al|Menu|Menú|Search|Buscar)[\s\S]{0,80}?/i, "").trim();
  const parts = t.split(/(?<=[.!?…])\s+/).map((p) => p.trim()).filter((p) => p.length > 20);
  if (!parts.length) {
    return t.length > 280 ? `${t.slice(0, 277).trimEnd()}…` : t;
  }
  let out = parts[0];
  if (parts[1] && (out + " " + parts[1]).length <= 320) out = `${out} ${parts[1]}`;
  if (out.length > 320) out = `${out.slice(0, 317).trimEnd()}…`;
  return out;
}

/** Saca título, fecha y texto oficial (descripción o primeros párrafos) de una página HTML. */
export function extractOfficialPage(html) {
  const raw = String(html || "");
  const ogTitle = clean((raw.match(/property="og:title"\s+content="([^"]+)"/i) || [])[1] || "");
  const titleTag = clean((raw.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || "");
  const ogDesc = clean((raw.match(/property="og:description"\s+content="([^"]+)"/i) || [])[1] || "");
  const metaDesc = clean((raw.match(/name="description"\s+content="([^"]+)"/i) || [])[1] || "");
  const iso = (raw.match(/property="article:published_time"\s+content="([^"]+)"/i) || raw.match(/datetime="(20\d{2}-\d{2}-\d{2}[^"]*)"/i) || [])[1] || "";
  const timeTxt = clean((raw.match(/<time[^>]*>([^<]+)<\/time>/i) || [])[1] || "");
  let body = "";
  const main = (raw.match(/<main[\s\S]*?<\/main>/i) || raw.match(/<article[\s\S]*?<\/article>/i) || [])[0] || "";
  if (main) {
    const paras = [...main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => clean(m[1])).filter((p) => p.length > 60);
    body = paras.slice(0, 4).join(" ");
  }
  const description = ogDesc || metaDesc || body;
  return {
    title: ogTitle || titleTag,
    date: dateFromIso(iso) || dateFromSpanish(timeTxt) || dateFromSpanish(description),
    description,
  };
}

function summariesFile() {
  return path.join(process.env.DATA_DIR || path.join(__dirname, "..", "data"), "nueva-pac-summaries.json");
}

function loadSummaries() {
  try { return JSON.parse(fs.readFileSync(summariesFile(), "utf8")); } catch { return {}; }
}

function saveSummaries(map) {
  try {
    fs.mkdirSync(path.dirname(summariesFile()), { recursive: true });
    fs.writeFileSync(summariesFile(), JSON.stringify(map, null, 2));
  } catch { /* queda en memoria del proceso */ }
}

/** Completa tipo, enlace de la fuente y resumen (caché por URL; no se regenera si ya está). */
export async function enrichNewsItem(item, source, summaries, fetcher = (url) => fetchText(url, { timeout: 18000 })) {
  const sourceUrl = source?.url || item.sourceUrl || "";
  const sourceName = source?.name || item.sourceName || "";
  const type = classifyNuevaPacType(item);
  const key = String(item.url || "").replace(/\/$/, "");
  let summary = summaries[key] || "";
  let title = item.title;
  const urlDate = dateFromUrl(item.url);
  let date = urlDate || item.date; // la fecha del slug oficial manda sobre fechas de «última actualización» de la plantilla
  let pageDesc = item.summary || "";

  if (!summary || !date || (title || "").length < 40) {
    try {
      const { text } = await fetcher(item.url);
      const page = extractOfficialPage(text);
      if (page.title && page.title.length > 15) title = page.title;
      if (!urlDate && page.date) date = page.date;
      if (page.description) pageDesc = page.description;
      if (!summary) {
        summary = miniSummaryFromOfficial(pageDesc || item.summary || "");
        // No guardar como resumen el título solo (poco útil).
        if (summary && summary.toLowerCase() !== String(title || "").toLowerCase()) summaries[key] = summary;
        else summary = summary.toLowerCase() === String(title || "").toLowerCase() ? "" : summary;
      }
    } catch {
      if (!summary) {
        summary = miniSummaryFromOfficial(item.summary || "");
        if (summary && summary.toLowerCase() !== String(title || "").toLowerCase()) summaries[key] = summary;
        else if (summary.toLowerCase() === String(title || "").toLowerCase()) summary = "";
      }
    }
  }

  return {
    ...item,
    title,
    date: date || item.date || urlDate,
    type,
    sourceName,
    sourceUrl,
    summary: summary || "",
  };
}

export function filterNuevaPacItems(items) {
  return items.filter((item) => isNuevaPacText(item.title, item.summary, item.url));
}

/**
 * Etapas de la reforma. Solo se marca como hecha o actual lo que dicen las fuentes oficiales.
 * Fuente del calendario: página DG AGRI «La PAC después de 2027…» (Calendario indicativo)
 * y la nota IP/25/1847 (16/07/2025).
 */
export function buildStages(now = new Date()) {
  const hub = NUEVA_PAC_HUB;
  const propuestaUrl = "https://ec.europa.eu/commission/presscorner/detail/es/ip_25_1847";
  const today = now.toISOString().slice(0, 10);
  const stages = [
    {
      id: "propuesta",
      name: "Propuesta de la Comisión",
      blurb: "La Comisión presentó el 16 de julio de 2025 la propuesta del marco financiero plurianual 2028-2034, que incluye la propuesta de la PAC posterior a 2027.",
      date: "2025-07-16",
      sourceLabel: "Comisión Europea · IP/25/1847",
      sourceUrl: propuestaUrl,
    },
    {
      id: "negociacion",
      name: "Negociación en Consejo y Parlamento",
      blurb: "Tras la propuesta, el calendario indicativo de la Comisión señala a continuación los planes nacionales (2027) y el inicio del nuevo marco (enero 2028). No ha anunciado aún un acuerdo interinstitucional.",
      date: null,
      sourceLabel: "Comisión Europea · Calendario indicativo (DG AGRI)",
      sourceUrl: hub,
    },
    {
      id: "acuerdo",
      name: "Acuerdo",
      blurb: "Las fuentes oficiales consultadas no han anunciado todavía un acuerdo definitivo sobre la PAC posterior a 2027.",
      date: null,
      sourceLabel: "Comisión Europea · Calendario indicativo (DG AGRI)",
      sourceUrl: hub,
    },
    {
      id: "planes",
      name: "Planes nacionales",
      blurb: "Según el calendario indicativo de la Comisión, en 2027 los países de la UE deberán presentar un proyecto de plan nacional alineado con las nuevas normas.",
      date: "2027",
      sourceLabel: "Comisión Europea · Calendario indicativo (DG AGRI)",
      sourceUrl: hub,
    },
    {
      id: "vigor",
      name: "Entrada en vigor 2028",
      blurb: "Según el calendario indicativo de la Comisión, en enero de 2028 empieza el nuevo marco financiero 2028-2034.",
      date: "2028-01",
      sourceLabel: "Comisión Europea · Calendario indicativo (DG AGRI)",
      sourceUrl: hub,
    },
  ];
  // Actual = negociación, porque la propuesta (16/07/2025) ya está hecha y no hay acuerdo anunciado.
  const propuestaHecha = today >= "2025-07-16";
  return stages.map((stage) => {
    let status = "pendiente";
    if (stage.id === "propuesta" && propuestaHecha) status = "hecho";
    else if (stage.id === "negociacion" && propuestaHecha) status = "actual";
    else if (stage.id === "planes" && today >= "2027-01-01" && today < "2028-01-01") status = "actual";
    else if (stage.id === "vigor" && today >= "2028-01-01") status = "actual";
    return { ...stage, status };
  });
}

/** Documentos oficiales clave (URLs comprobadas con respuesta 200). */
export function buildDocuments() {
  return [
    {
      title: "La PAC después de 2027 en el próximo presupuesto de la UE",
      sourceLabel: "Comisión Europea · DG AGRI",
      url: NUEVA_PAC_HUB,
    },
    {
      title: "Preguntas y respuestas sobre la propuesta de la PAC posterior a 2027",
      sourceLabel: "Comisión Europea · DG AGRI · 23/07/2025",
      url: "https://agriculture.ec.europa.eu/media/news/questions-and-answers-cap-post-2027-proposal-2025-07-23_es",
    },
    {
      title: "Un presupuesto ambicioso para una Europa más fuerte: 2028-2034 (nota de prensa)",
      sourceLabel: "Comisión Europea · IP/25/1847 · 16/07/2025",
      url: "https://ec.europa.eu/commission/presscorner/detail/es/ip_25_1847",
    },
    {
      title: "Presupuesto de la UE 2028-2034",
      sourceLabel: "Comisión Europea",
      url: "https://commission.europa.eu/strategy-and-policy/eu-budget/long-term-eu-budget/eu-budget-2028-2034_es",
    },
    {
      title: "Propuesta de Reglamento sobre las condiciones de aplicación del apoyo de la UE a la PAC",
      sourceLabel: "Comisión Europea · Publicaciones",
      url: "https://commission.europa.eu/publications/common-agricultural-policy_en",
    },
    {
      title: "Propuesta de modificación del Reglamento de la OCM (EUR-Lex)",
      sourceLabel: "EUR-Lex · 52025PC0553",
      url: "https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=celex:52025PC0553",
    },
    {
      title: "Propuesta de Reglamento sobre las condiciones de aplicación del apoyo de la UE a la PAC (COM(2025) 560)",
      sourceLabel: "Comisión Europea · COM(2025) 560 · 17/07/2025",
      url: "https://commission.europa.eu/publications/common-agricultural-policy_en",
      also: "https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:52025PC0560",
    },
    {
      title: "Reforma de la PAC 2028-2034",
      sourceLabel: "MAPA",
      url: "https://www.mapa.gob.es/es/pac/reforma-pac-2028-2034",
    },
    {
      title: "MFP 2028-2034: el Consejo acuerda su posición negociadora para una PAC fuerte y orientada al futuro",
      sourceLabel: "Consejo de la UE · 26/10/2026",
      url: "https://www.consilium.europa.eu/es/press/press-releases/2026/10/26/mff-2028-2034-council-secures-negotiating-position-for-a-strong-and-future-oriented-common-agricultural-policy/",
    },
  ];
}

async function download(now = new Date()) {
  const summaries = loadSummaries();
  const groups = await Promise.all(
    NUEVA_PAC_SOURCES.map(async (source) => {
      try {
        const { text } = await fetchText(source.feed, { timeout: 25000 });
        let raw = [];
        if (source.id === "comision_prensa" || source.id === "red_pac") raw = parseRss(text);
        else if (source.id === "fega") raw = parseFegaNews(text);
        else if (source.id === "mapa_reforma") {
          const page = extractOfficialPage(text);
          raw = [{
            title: page.title || "Reforma de la PAC 2028-2034",
            url: source.url,
            summary: page.description || "",
            date: page.date || null,
          }];
        } else raw = parseAgriNewsLinks(text, source.url);
        raw = raw.map((item) => {
          if ((item.title || "").length < 40 && /\/media\/news\//.test(item.url || "")) {
            const slug = item.url.split("/media/news/")[1]?.replace(/_es$/, "").replace(/-/g, " ") || item.title;
            return { ...item, title: slug.charAt(0).toUpperCase() + slug.slice(1) };
          }
          return item;
        });
        let items = filterNuevaPacItems(raw);
        // La página MAPA de la reforma es siempre relevante aunque el filtro falle por textos cortos.
        if (source.id === "mapa_reforma" && !items.length && raw.length) items = raw;
        items = await Promise.all(items.slice(0, 12).map((item, i) => enrichNewsItem({
          id: `${source.id}-${item.date || "s"}-${i}`,
          sourceId: source.id,
          ...item,
        }, source, summaries)));
        return { ...source, ok: true, items };
      } catch (error) {
        return { ...source, ok: false, items: [], error: String(error?.message || error).slice(0, 160) };
      }
    })
  );

  // Si MAPA no respondió, dejamos al menos el enlace oficial de la reforma (sin inventar resumen).
  {
    const mapaUrl = "https://www.mapa.gob.es/es/pac/reforma-pac-2028-2034";
    const g = groups.find((x) => x.id === "mapa_reforma");
    if (!g?.ok || !(g.items || []).length) {
      groups.push({
        id: "mapa_reforma",
        name: "MAPA · Reforma PAC 2028-2034",
        organism: "Ministerio de Agricultura, Pesca y Alimentación",
        url: mapaUrl,
        ok: false,
        items: [{
          id: "mapa-reforma-2028",
          sourceId: "mapa_reforma",
          sourceName: "MAPA · Reforma PAC 2028-2034",
          sourceUrl: mapaUrl,
          title: "Reforma de la PAC 2028-2034",
          url: mapaUrl,
          date: null,
          type: "Postura",
          summary: "",
        }],
        error: g?.error || "Sin respuesta",
      });
    }
  }

  // Noticia curada del Consejo (URL oficial); si el fetch falla, entra sin resumen.
  const councilUrl = "https://www.consilium.europa.eu/es/press/press-releases/2026/10/26/mff-2028-2034-council-secures-negotiating-position-for-a-strong-and-future-oriented-common-agricultural-policy/";
  const councilSource = {
    id: "consejo",
    name: "Consejo de la UE",
    url: "https://www.consilium.europa.eu/es/press/press-releases/",
  };
  try {
    const { text } = await fetchText(councilUrl, { timeout: 20000 });
    const page = extractOfficialPage(text);
    const item = await enrichNewsItem({
      id: "consejo-2026-10-26",
      sourceId: "consejo",
      title: page.title || "MFP 2028-2034: el Consejo acuerda su posición negociadora para una PAC fuerte y orientada al futuro",
      url: councilUrl,
      summary: page.description || "",
      date: page.date || "2026-10-26",
    }, councilSource, summaries);
    groups.push({ ...councilSource, organism: "Consejo de la Unión Europea", ok: true, items: [item] });
  } catch (error) {
    groups.push({
      ...councilSource,
      organism: "Consejo de la Unión Europea",
      ok: false,
      items: [{
        id: "consejo-2026-10-26",
        sourceId: "consejo",
        sourceName: councilSource.name,
        sourceUrl: councilSource.url,
        title: "MFP 2028-2034: el Consejo acuerda su posición negociadora para una PAC fuerte y orientada al futuro",
        url: councilUrl,
        date: "2026-10-26",
        type: "Avance",
        summary: "",
      }],
      error: String(error?.message || error).slice(0, 160),
    });
  }

  saveSummaries(summaries);

  const byUrl = new Map();
  for (const group of groups) {
    for (const item of group.items || []) {
      const key = String(item.url || "").replace(/_en$/, "_es").replace(/\/$/, "");
      if (!key) continue;
      const prev = byUrl.get(key);
      if (!prev || (item.date || "") > (prev.date || "")) byUrl.set(key, item);
    }
  }
  const news = [...byUrl.values()].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a.title.localeCompare(b.title, "es"));

  return {
    ok: groups.some((g) => g.ok),
    fetchedAt: now.toISOString(),
    stages: buildStages(now),
    currentStageId: buildStages(now).find((s) => s.status === "actual")?.id || null,
    documents: buildDocuments(),
    news,
    groups,
    unavailable: NUEVA_PAC_SOURCES_UNAVAILABLE,
  };
}

function cacheFile() {
  return path.join(process.env.DATA_DIR || path.join(__dirname, "..", "data"), "nueva-pac-cache.json");
}

let memory = null;
let inflight = null;

/** Caché de 6 horas; nunca lanza. */
export async function getNuevaPac({ force = false, now = new Date(), loader = download } = {}) {
  if (!memory) {
    try { memory = JSON.parse(fs.readFileSync(cacheFile(), "utf8")); } catch { memory = null; }
  }
  if (memory?.ok && !force && now.getTime() - new Date(memory.fetchedAt).getTime() < 6 * 3600000) return memory;
  if (!inflight) {
    inflight = loader(now)
      .then((data) => {
        memory = data;
        try {
          fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
          fs.writeFileSync(cacheFile(), JSON.stringify(memory, null, 2));
        } catch { /* queda en memoria */ }
        return memory;
      })
      .catch((error) => memory || { ok: false, stages: buildStages(now), currentStageId: "negociacion", documents: buildDocuments(), news: [], groups: [], unavailable: NUEVA_PAC_SOURCES_UNAVAILABLE, error: String(error?.message || error) })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function resetNuevaPacCache() {
  memory = null;
  inflight = null;
}
