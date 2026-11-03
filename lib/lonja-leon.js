/**
 * v5.9 · Precios de la Lonja de León (fuente provincial para León).
 * Fuente oficial: https://www.lonjadeleon.es/category/cotizaciones/ — una entrada por mesa y sesión
 * («lonja-cereal-29-10-2026»), con una tabla: producto · cotización anterior · cotización actual · dif.
 * Se copia tal cual: precio actual, anterior y unidad de la tabla. Lo que no tiene precio («S/C», vacío) se deja fuera.
 * Caché en memoria y en DATA_DIR/lonja-leon-cache.json; si falla, la última copia buena; si no hay, nada.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchBuffer } from "./net.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const LONJA_LEON = {
  fuente: "Lonja de León",
  organismo: "Lonja de León",
  pagina: "https://www.lonjadeleon.es/category/cotizaciones/",
  // slug de la entrada → mesa y sector
  mesas: [
    { slug: "cereal", nombre: "Cereales", sector: "agricultura" },
    { slug: "girasol", nombre: "Girasol", sector: "agricultura" },
    { slug: "forraje", nombre: "Forrajes", sector: "agricultura" },
    { slug: "patata", nombre: "Patatas", sector: "agricultura" },
    { slug: "alubia", nombre: "Alubias", sector: "agricultura" },
    { slug: "carne-de-vacuno", nombre: "Vacuno", sector: "ganaderia" },
    { slug: "carne-de-ovino-y-caprino", nombre: "Ovino y caprino", sector: "ganaderia" },
    { slug: "leche-de-vaca", nombre: "Leche de vaca", sector: "ganaderia" },
    { slug: "leche-de-oveja-y-cabra", nombre: "Leche de oveja y cabra", sector: "ganaderia" },
  ],
  horasCache: 12,
};

function cacheFile() {
  const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  return path.join(dir, "lonja-leon-cache.json");
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ", euro: "€" };
function text(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&(#\d+|[a-zA-Z]+);/g, (m, e) => (e[0] === "#" ? String.fromCharCode(Number(e.slice(1))) : ENTITIES[e] ?? m))
    .replace(/\s+/g, " ")
    .trim();
}

/** «1.100,00» → 1100; «S/C*», «», «-» → null. */
export function leonNumber(value) {
  const clean = String(value || "").replace(/\*/g, "").trim();
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(clean)) return null;
  return Number(clean.replace(/\./g, "").replace(",", "."));
}
const fmt = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

/** Últimas entradas de cada mesa en la página de cotizaciones: [{ slug, date: "2026-10-29", url }]. */
export function leonLatestPosts(html) {
  const out = new Map();
  for (const m of String(html || "").matchAll(/href="(https:\/\/www\.lonjadeleon\.es\/lonja-([a-z-]+?)-(\d{2})-(\d{2})-(\d{4})\/)"/g)) {
    const [, url, slug, d, mo, y] = m;
    if (!LONJA_LEON.mesas.some((mesa) => mesa.slug === slug)) continue;
    const date = `${y}-${mo}-${d}`;
    if (!out.has(slug) || out.get(slug).date < date) out.set(slug, { slug, date, url });
  }
  return [...out.values()];
}

/** Lee la tabla de una entrada. Solo filas con precio actual; la unidad sale de la fila de unidades de la tabla. */
export function parseLeonTable(html, mesa = { nombre: "", sector: "agricultura" }, date = "") {
  const table = String(html || "").match(/<table[\s\S]*?<\/table>/i)?.[0];
  if (!table) return [];
  const items = [];
  let unit = "";
  let section = mesa.nombre;
  let group = mesa.nombre;
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) => [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => text(c[1])));
  rows.forEach((cells, index) => {
    if (index === 0 || cells.length < 3) return; // cabecera (MESA · ANTERIOR · ACTUAL · DIF.)
    const [name, prevRaw, lastRaw] = cells;
    if (/€/.test(lastRaw) && leonNumber(lastRaw) == null) { // fila de unidades, a veces con subtítulo
      unit = lastRaw;
      if (name) section = group = name.charAt(0) + name.slice(1).toLowerCase();
      return;
    }
    const last = leonNumber(lastRaw);
    if (!name) return;
    if (last == null) {
      if (!prevRaw && !lastRaw) group = section === mesa.nombre ? name : `${section} · ${name}`; // subtítulo (p. ej. «Hembras 180-200 kg.»)
      return; // sin precio: fuera
    }
    const prev = leonNumber(prevRaw);
    const change = prev == null ? null : Math.round((last - prev) * 1000) / 1000;
    items.push({
      mesa: mesa.nombre, group, name: name.replace(/\s*\*+\s*$/, "").trim(), sector: mesa.sector, unit,
      last: lastRaw.replace(/\*/g, "").trim(), prev: prev == null ? null : prevRaw.replace(/\*/g, "").trim(), change, diff: change == null ? null : fmt(change),
      quoted: true, date,
    });
  });
  return items;
}

let memory = null;
let inflight = null;
function readCache() { try { return JSON.parse(fs.readFileSync(cacheFile(), "utf8")); } catch { return null; } }
function writeCache(data) {
  try { fs.mkdirSync(path.dirname(cacheFile()), { recursive: true }); fs.writeFileSync(cacheFile(), JSON.stringify(data, null, 2)); } catch { /* en memoria */ }
}
async function getHtml(url) {
  const { buf } = await fetchBuffer(url, { timeout: 20000, headers: { "User-Agent": "Mozilla/5.0 (AlertaAgraria)" } });
  return buf.toString("utf8");
}
async function download(now = new Date()) {
  const posts = leonLatestPosts(await getHtml(LONJA_LEON.pagina));
  if (!posts.length) throw new Error("La página de la Lonja de León no trae entradas de cotizaciones");
  const items = [];
  const links = [];
  for (const mesa of LONJA_LEON.mesas) {
    const post = posts.find((p) => p.slug === mesa.slug);
    if (!post) continue;
    const rows = parseLeonTable(await getHtml(post.url), mesa, post.date);
    if (rows.length) { items.push(...rows); links.push({ mesa: mesa.nombre, url: post.url, date: post.date }); }
  }
  if (!items.length) throw new Error("La Lonja de León no trae precios legibles");
  const session = links.map((l) => l.date).sort().pop();
  return { ok: true, session, items, links, fetchedAt: now.toISOString() };
}
function envelope(data, extra = {}) {
  return { source: LONJA_LEON.fuente, pageUrl: LONJA_LEON.pagina, ...(data || { ok: false, items: [] }), ...extra };
}

/** Precios de la Lonja de León con caché; nunca lanza error. */
export async function getLeonPrices({ force = false, now = new Date(), loader = download } = {}) {
  const ttl = LONJA_LEON.horasCache * 3600000;
  if (!memory) memory = readCache();
  if (memory?.ok && !force && now.getTime() - new Date(memory.fetchedAt).getTime() < ttl) return envelope(memory, { stale: false });
  if (!inflight) {
    inflight = loader(now)
      .then((data) => { memory = data; writeCache(data); return envelope(data, { stale: false }); })
      .catch((error) => {
        const reason = String(error?.message || error).slice(0, 160);
        if (memory?.ok) return envelope(memory, { stale: true, error: reason });
        return envelope(null, { ok: false, error: reason, explanation: "Ahora mismo no podemos leer los precios de la Lonja de León. Para no darte un precio equivocado, no enseñamos ninguno: míralos en el enlace oficial." });
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}
export function resetLeonCache() { memory = null; inflight = null; }
