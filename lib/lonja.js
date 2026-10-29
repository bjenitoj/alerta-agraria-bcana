/**
 * v5.7 · Precios de la Lonja Agropecuaria de Salamanca (Diputación de Salamanca).
 * Fuente oficial: https://www.lasalina.es/Aplicaciones/lonja/Cotizaciones.jsp (tabla HTML por mesa y sesión).
 * Se copia tal cual lo que publica la tabla: Anterior, Diferencia, Último y Medida, y la fecha de la sesión.
 * «0,00» en Último = sin cotización esa sesión (la tablilla en PDF lo pone como «S. / C.»): no se enseña precio.
 * Caché en memoria y en DATA_DIR/lonja-cache.json; si falla, la última copia buena con su fecha; si no hay, nada.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchBuffer } from "./net.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const LONJA = {
  fuente: "Lonja Agropecuaria de Salamanca (Diputación de Salamanca)",
  organismo: "Diputación de Salamanca",
  pagina: "https://www.lasalina.es/economiayhacienda/agriculturayganaderia/mercado/lonja/index.html",
  tabla: "https://www.lasalina.es/Aplicaciones/lonja/Cotizaciones.jsp",
  datosAbiertos: "https://datosabiertossalamanca.es/dataset/cotizaciones-semanales-de-la-lonja-de-salamanca",
  // Mesas que se leen (id del formulario oficial → nombre de la mesa).
  mesas: [
    { id: 5, nombre: "Cereales" },
    { id: 1, nombre: "Ovino" },
    { id: 2, nombre: "Bovino de vida" },
    { id: 3, nombre: "Bovino de carne" },
    { id: 4, nombre: "Porcino blanco e ibérico" },
  ],
  horasCache: 12,
};

function cacheFile() {
  const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  return path.join(dir, "lonja-cache.json");
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ", euro: "€", ntilde: "ñ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Ntilde: "Ñ", ordm: "º", deg: "º" };
function text(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|[a-zA-Z]+);/g, (m, e) => (e[0] === "#" ? String.fromCharCode(Number(e.slice(1))) : ENTITIES[e] ?? m))
    .replace(/\s+/g, " ")
    .trim();
}

/** Fechas de sesión del selector oficial (la primera es la última sesión). */
export function lonjaSessions(html) {
  const select = String(html).match(/<select name="fLonja"[\s\S]*?<\/select>/i)?.[0] || "";
  return [...select.matchAll(/<option value="(\d{2}\/\d{2}\/\d{4})"/g)].map((m) => m[1]);
}

/** «1.100,00» → 1100; «0,90 / 1,40» → null (horquilla: se enseña literal). */
function num(value) {
  const v = String(value || "").trim();
  if (!/^-?[\d.]+,\d+$|^-?\d+$/.test(v)) return null;
  return Number(v.replace(/\./g, "").replace(",", "."));
}

/** Filas de la tabla de cotizaciones de una mesa, literales. */
export function parseLonjaTable(html, mesa = "") {
  const start = String(html).indexOf("PDF Lonja");
  const body = start >= 0 ? String(html).slice(start) : String(html);
  const items = [];
  let section = "";
  let qualifier = "";
  for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi)]
      .filter((cell) => !/display:\s*none/i.test(cell[2]))
      .map((cell) => ({ tag: cell[1].toLowerCase(), attrs: cell[2], text: text(cell[3]) }));
    if (!cells.length) continue;
    if (cells[0].tag === "th") {
      const big = cells.find((cell) => /colspan="8"/.test(cell.attrs));
      if (big) { section = big.text; qualifier = ""; continue; }
      // Cabecera «Anterior / Diferencia / Último / Medida», a veces con un subtítulo (MACHOS, HEMBRAS…).
      if (cells.some((cell) => cell.text === "Anterior")) {
        const sub = cells.slice(3).find((cell) => cell.text && !/^(Anterior|Diferencia|Último|Medida)$/.test(cell.text));
        qualifier = sub ? sub.text : "";
      }
      continue;
    }
    // Fila de datos: id mesa, id producto, id categoría, nombre, anterior, diferencia, último, medida.
    if (cells.length < 8 || !/^\d+$/.test(cells[0].text)) continue;
    const [, , , name, previous, diff, last, unit] = cells.map((cell) => cell.text);
    if (!name) continue;
    const quoted = !/^0(,0+)?$/.test(last);
    items.push({
      mesa,
      group: section,
      name: qualifier ? `${name} (${qualifier.toLowerCase()})` : name,
      previous,
      diff,
      last,
      unit,
      quoted,
      value: quoted ? num(last) : null,
      change: quoted && num(previous) ? num(diff) : null,
    });
  }
  return items;
}

let memory = null;
let inflight = null;

function readCache() {
  try { return JSON.parse(fs.readFileSync(cacheFile(), "utf8")); } catch { return null; }
}
function writeCache(data) {
  try {
    fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify(data, null, 2));
  } catch { /* queda en memoria */ }
}

async function getHtml(body) {
  const { buf } = await fetchBuffer(LONJA.tabla, {
    timeout: 20000,
    method: body ? "POST" : "GET",
    body,
    headers: body ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
  });
  // La página dice UTF-8 pero viene en ISO-8859-1.
  return buf.toString("latin1");
}

async function download(now = new Date()) {
  const first = await getHtml(null);
  const session = lonjaSessions(first)[0];
  if (!session) throw new Error("La página de la Lonja no trae fechas de sesión");
  const items = [];
  for (const mesa of LONJA.mesas) {
    const html = await getHtml(`idMesa=${mesa.id}&idProducto=0&idCategoria=0&fLonja=${encodeURIComponent(session)}`);
    items.push(...parseLonjaTable(html, mesa.nombre));
  }
  if (!items.some((item) => item.quoted)) throw new Error("La tabla de la Lonja no trae cotizaciones");
  return { ok: true, session, items, fetchedAt: now.toISOString() };
}

function envelope(data, extra = {}) {
  return { source: LONJA.fuente, pageUrl: LONJA.pagina, tableUrl: LONJA.tabla, ...(data || { ok: false, items: [] }), ...extra };
}

/** Precios de la Lonja con caché; nunca lanza error. */
export async function getLonjaPrices({ force = false, now = new Date(), loader = download } = {}) {
  const ttl = LONJA.horasCache * 3600000;
  if (!memory) memory = readCache();
  const fresh = memory?.ok && now.getTime() - new Date(memory.fetchedAt).getTime() < ttl;
  if (fresh && !force) return envelope(memory, { stale: false });
  if (!inflight) {
    inflight = loader(now)
      .then((data) => { memory = data; writeCache(data); return envelope(data, { stale: false }); })
      .catch((error) => {
        const reason = String(error?.message || error).slice(0, 160);
        if (memory?.ok) return envelope(memory, { stale: true, error: reason });
        return envelope(null, {
          ok: false,
          error: reason,
          explanation: "Ahora mismo no podemos leer la tabla de la Lonja de Salamanca. Para no darte un precio equivocado, no enseñamos ninguno: mira la tabla oficial en el enlace.",
        });
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function resetLonjaCache() {
  memory = null;
  inflight = null;
}
