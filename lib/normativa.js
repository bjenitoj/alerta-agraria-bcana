/**
 * v5.7 · Normativa en vigor del BOE (legislación consolidada, datos abiertos).
 * API oficial: https://www.boe.es/datosabiertos/api/legislacion-consolidada
 * - Filtro: Ministerio de Agricultura, Pesca y Alimentación (departamento 3120) o materias Agricultura (158),
 *   Ganadería (3879), Pesca (5567) y Política Agrícola Común (5641); rangos Ley (1300), Real Decreto (1340) y Orden (1350).
 * - En vigor: lo dice el propio BOE con el campo `vigencia_agotada` ("N" = no ha agotado su vigencia).
 *   Lo que el BOE marca con "S" (derogada o vigencia agotada) se quita. Sin ese dato, no se inventa nada.
 * - Nada de ayudas: lo que trata de ayudas, subvenciones o convocatorias va solo a la pestaña Ayudas.
 * Caché en memoria y en DATA_DIR/normativa-cache.json (12 h); si el BOE falla, la última copia buena.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJson } from "./net.js";
import { NOT_NORMA_AID } from "./classify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = "https://www.boe.es/datosabiertos/api/legislacion-consolidada";
export const NORMATIVA_QUERY =
  "(departamento@codigo:3120 or materia@codigo:158 or materia@codigo:3879 or materia@codigo:5567 or materia@codigo:5641) and vigencia_agotada:N and (rango@codigo:1300 or rango@codigo:1340 or rango@codigo:1350)";
export const NORMATIVA = { api: API, limite: 300, horasCache: 12, fuente: "BOE · Legislación consolidada (datos abiertos)" };

// v6.2 · Sector de cada norma por su título y por las materias que le pone el propio BOE (análisis oficial).
// Si encaja en varios, sale en todos ellos; si no encaja en ninguno (leyes generales), es común y sale con cualquiera.
const PESCA = /pesca|pesquer|pescado|marisq|acuicult|piscícol|caladero|captura|buques?|flota|molusco|invertebrados marinos|reservas? marinas?|marítim|desembarque|coralin|cofrad[ií]a|tripulaci|especies marinas/i;
const GANADERIA = /ganad|l[aá]cte|animal|pecuari|pastos|pastable|zoonosis|lengua azul|fiebre aftosa|pollos|bovino|vacuno|ovino|caprino|porcino|av[ií]col|ap[ií]col|abeja|equino|zoot[eé]cn|veterin|leche|pienso|explotaciones ganaderas|bienestar/i;
const AGRICULTURA = /agr[ií]col|agricult|vit[ií]col|viticultura|viñedo|viveros|obtenciones vegetales|sanidad vegetal|frutos secos|tractores|producci[oó]n agroecol|agropecuari|agrari|cultivo|semilla|fitosanit|riego|regad|\bvinos?\b|vitivin|fertiliz|cereal|fruta|hortaliz|olivar|aceite|tabaco|plantas|vegetal|suelo|forestal|\bpac\b|pol[ií]tica agr[ií]cola|denominaci[oó]n de origen|calidad diferenciada|seguros agrarios|cadena alimentaria/i;

export const NORMATIVA_CLASIFICACION = 4; // sube si cambia la clasificación por sector (invalida la caché)
// Título que habla de producción ganadera o de animales y no de cultivos ni de agricultura: es de Ganadería aunque
// diga «agrario» por el Seguro Agrario Combinado (p. ej. las normas de peritación de producciones ganaderas).
const LIVESTOCK_TITLE = /ganad|animal|pecuari|bovino|vacuno|ovino|caprino|porcino|av[ií]col|ap[ií]col|abeja|equino|zoot[eé]cn|veterin|reses/i;
const CROP_TITLE = /agr[ií]col|agricult|agrari|agropecuari|agroecol|vit[ií]col|viñedo|viveros|vegetal|cultivo|semilla|fitosanit|riego|regad|\bvinos?\b|vitivin|fertiliz|cereal|fruta|hortaliz|olivar|aceite|tabaco|plantas|suelo|forestal|\bpac\b/i;
function livestockOnly(title) {
  const t = String(title || "").replace(/seguros? agrarios? combinados?/gi, "seguro");
  return LIVESTOCK_TITLE.test(t) && !CROP_TITLE.test(t);
}

export function normaSectors(title, materias = []) {
  // El nombre del Ministerio (de Agricultura, Pesca y Alimentación…) no dice de qué sector es la norma.
  const text = `${title || ""} · ${(materias || []).join(" · ")}`.replace(/Ministerio de Agricultura,? (y )?(Pesca|Alimentaci[oó]n)[^·.;]*?(Alimentaci[oó]n|Medio Ambiente|Marino)/gi, "Ministerio");
  const out = [];
  if (AGRICULTURA.test(text) && !livestockOnly(title)) out.push("agricultura");
  if (GANADERIA.test(text)) out.push("ganaderia");
  if (PESCA.test(text)) out.push("pesca");
  return out.length ? out : ["agricultura", "ganaderia", "pesca"];
}

function isoDay(key) {
  const m = String(key || "").match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Respuesta oficial → normas en vigor, sin ayudas, con enlace oficial, por fecha de publicación (reciente arriba). */
export function parseConsolidada(json) {
  const data = Array.isArray(json?.data) ? json.data : [];
  const out = [];
  const seen = new Set();
  for (const row of data) {
    const id = String(row?.identificador || "");
    const titulo = String(row?.titulo || "").trim();
    if (!/^BOE-A-\d{4}-\d+$/.test(id) || !titulo || seen.has(id)) continue;
    if (row.vigencia_agotada !== "N") continue; // solo lo que el BOE dice que sigue en vigor
    if (NOT_NORMA_AID.test(titulo)) continue; // las ayudas, en Ayudas
    const url = /^https:\/\/www\.boe\.es\//.test(row.url_html_consolidada || "") ? row.url_html_consolidada : `https://www.boe.es/buscar/act.php?id=${id}`;
    seen.add(id);
    out.push({
      id,
      title: titulo,
      rango: row.rango?.texto || "",
      departamento: row.departamento?.texto || "",
      publishedAt: isoDay(row.fecha_publicacion),
      vigenteDesde: isoDay(row.fecha_vigencia),
      updatedAt: isoDay(row.fecha_actualizacion),
      url,
      eli: /^https:\/\/www\.boe\.es\//.test(row.url_eli || "") ? row.url_eli : null,
      sectors: normaSectors(titulo),
      enVigor: "Según el BOE (legislación consolidada): no ha agotado su vigencia.",
    });
  }
  return out.sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
}

function cacheFile() {
  const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  return path.join(dir, "normativa-cache.json");
}
function readCache() {
  try { return JSON.parse(fs.readFileSync(cacheFile(), "utf8")); } catch { return null; }
}
function writeCache(data) {
  try { fs.writeFileSync(cacheFile(), JSON.stringify(data)); } catch { /* sin disco, solo memoria */ }
}

async function download(now) {
  const query = JSON.stringify({ query: { query_string: { query: NORMATIVA_QUERY } }, sort: [{ fecha_publicacion: "desc" }] });
  const params = new URLSearchParams({ query, limit: String(NORMATIVA.limite) });
  const json = await fetchJson(`${API}?${params}`);
  if (String(json?.status?.code) !== "200") throw new Error("El BOE no devolvió datos");
  const items = parseConsolidada(json);
  if (!items.length) throw new Error("El BOE no devolvió normas");
  await addMaterias(items, memory?.items || []);
  return { ok: true, clasificacion: NORMATIVA_CLASIFICACION, fetchedAt: now.toISOString(), items };
}

/** Materias oficiales del BOE (…/id/{id}/analisis) de cada norma, reutilizando las ya leídas. Si falla, solo el título. */
export async function addMaterias(items, previous = [], fetcher = (id) => fetchJson(`${API}/id/${encodeURIComponent(id)}/analisis`)) {
  const known = new Map(previous.filter((n) => Array.isArray(n?.materias)).map((n) => [n.id, n.materias]));
  const queue = [...items];
  const worker = async () => {
    for (let n = queue.shift(); n; n = queue.shift()) {
      let materias = known.get(n.id);
      if (!materias) {
        try {
          const json = await fetcher(n.id);
          materias = (json?.data?.[0]?.materias || []).map((m) => String(m?.materia?.texto || "")).filter(Boolean);
        } catch { materias = null; }
      }
      if (materias) n.materias = materias;
      n.sectors = normaSectors(n.title, materias || []);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return items;
}

let memory = null;
let inflight = null;
function envelope(data, extra) {
  return { ok: Boolean(data?.ok), source: NORMATIVA.fuente, sourceUrl: "https://www.boe.es/buscar/legislacion.php", fetchedAt: data?.fetchedAt || null, items: data?.items || [], ...extra };
}
export async function getNormativaVigente({ force = false, now = new Date(), loader = download } = {}) {
  if (!memory) memory = readCache();
  const fresh = memory?.ok && memory.clasificacion === NORMATIVA_CLASIFICACION && now.getTime() - new Date(memory.fetchedAt).getTime() < NORMATIVA.horasCache * 3600000;
  if (fresh && !force) return envelope(memory, { stale: false });
  if (!inflight) {
    inflight = loader(now)
      .then((data) => { memory = data; writeCache(data); return envelope(data, { stale: false }); })
      .catch((error) => {
        const reason = String(error?.message || error).slice(0, 160);
        if (memory?.ok) return envelope(memory, { stale: true, error: reason });
        return envelope(null, { ok: false, error: reason });
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}
export function resetNormativaCache() { memory = null; inflight = null; }
