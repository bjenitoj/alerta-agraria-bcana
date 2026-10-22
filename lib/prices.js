/**
 * «Hoy en el campo»: precios medios nacionales semanales del MAPA.
 * Lee la página oficial, busca el Excel del año y saca la última semana con precio.
 * Guarda copia en memoria y en DATA_DIR/precios-cache.json. Si el MAPA falla, enseña la
 * última copia buena con su fecha. Si no hay ninguna, no inventa precios: solo da el enlace.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchBuffer, fetchText } from "./net.js";
import { readFirstSheet } from "./xlsx-lite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PRICE_CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "precios-mapa.json"), "utf8"));

function cacheFile() {
  const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  return path.join(dir, "precios-cache.json");
}

function cleanLabel(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberOf(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cleanLabel(value).replace(/\./g, "").replace(",", ".");
  return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
}

/** Lunes y domingo de la semana ISO `week` de `year`. */
export function isoWeekRange(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

export function findXlsxLink(html, pageUrl, year) {
  const links = [...String(html).matchAll(/href="([^"]*precios_medios_nacionales_(\d{4})[^"]*\.xlsx)"/gi)];
  const pick = links.find((match) => Number(match[2]) === year) || links.sort((a, b) => Number(b[2]) - Number(a[2]))[0];
  return pick ? new URL(pick[1].replace(/&amp;/g, "&"), pageUrl).href : null;
}

/** Saca de la hoja la última semana con precio para cada producto configurado. */
export function parsePriceSheet(rows, products = PRICE_CONFIG.productos, year = null) {
  let headerRow = -1;
  for (let r = 0; r < Math.min(rows.length, 40); r += 1) {
    if ((rows[r] || []).filter((cell) => /^Semana\s*\d+/i.test(cleanLabel(cell))).length >= 1) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) throw new Error("No encuentro la fila de semanas en el Excel del MAPA");
  const weeks = [];
  (rows[headerRow] || []).forEach((cell, col) => {
    const match = cleanLabel(cell).match(/^Semana\s*(\d+)/i);
    if (match) weeks.push({ col, week: Number(match[1]), raw: cleanLabel((rows[headerRow + 1] || [])[col]) });
  });
  const found = [];
  for (const product of products) {
    const re = new RegExp(product.patron, "i");
    let rowIndex = -1;
    for (let r = headerRow + 1; r < rows.length; r += 1) {
      const row = rows[r] || [];
      if (row.slice(0, 4).some((cell) => re.test(cleanLabel(cell)))) {
        rowIndex = r;
        break;
      }
    }
    if (rowIndex < 0) continue;
    const row = rows[rowIndex];
    const label = cleanLabel(row.slice(0, 4).find((cell) => re.test(cleanLabel(cell))));
    // La unidad sale de la etiqueta de la hoja («Trigo blando (€/t)»). Sin unidad, no se enseña el producto.
    const unit = label.match(/\(([^)]*\/[^)]*)\)/)?.[1] || null;
    if (!unit) continue;
    const ref = row.slice(0, 4).map(cleanLabel).find((cell) => /^\(\d+\)$/.test(cell)) || null;
    const series = weeks.map((week) => ({ week: week.week, value: numberOf(row[week.col]) }));
    found.push({ ...product, label, unit, ref, series });
  }
  const positions = positionNotes(rows);
  if (!found.length) throw new Error("El Excel del MAPA no trae los productos esperados");
  const latestWeek = Math.max(...found.flatMap((item) => item.series.filter((s) => s.value != null).map((s) => s.week)));
  if (!Number.isFinite(latestWeek)) throw new Error("El Excel del MAPA no trae precios");
  const header = weeks.find((week) => week.week === latestWeek);
  const range = year ? isoWeekRange(year, latestWeek) : null;
  const items = found.map((item) => {
    const current = item.series.find((s) => s.week === latestWeek)?.value ?? null;
    const previous = [...item.series].reverse().find((s) => s.week < latestWeek && s.value != null) || null;
    const round = (value) => (value == null ? null : Math.round(value * 100) / 100);
    return {
      id: item.id,
      name: item.nombre,
      sheetLabel: item.label,
      group: item.grupo,
      unit: item.unit,
      positionRef: item.ref,
      position: item.ref ? positions[item.ref] || null : null,
      value: round(current),
      previous: current != null && previous ? round(previous.value) : null,
      previousWeek: current != null && previous ? previous.week : null,
      change: current != null && previous ? round(current - previous.value) : null,
      lastValue: current == null && previous ? round(previous.value) : null,
      lastWeek: current == null && previous ? previous.week : null,
    };
  });
  return {
    week: latestWeek,
    weekHeader: `Semana ${latestWeek}`,
    weekLabel: header?.raw || "",
    // Lunes y domingo de la semana ISO: lo calcula la app a partir del número de semana; no viene en la hoja.
    from: range?.from || null,
    to: range?.to || null,
    rangeComputed: Boolean(range),
    items,
  };
}

/** Notas de «Posición comercial: (1) …; (2) …» tal como vienen en la hoja. */
export function positionNotes(rows) {
  const out = {};
  for (const row of rows || []) {
    const text = (row || []).map(cleanLabel).filter(Boolean).join(" ");
    const at = text.search(/Posici[oó]n comercial:/i);
    if (at < 0) continue;
    const body = text.slice(at).replace(/^Posici[oó]n comercial:\s*/i, "");
    for (const match of body.matchAll(/\((\d+)\)\s*([^;(]+?)(?=\s*;|\s*\(\d+\)|$)/g)) {
      const value = match[2].trim().replace(/[.;]$/, "");
      if (value && !out[`(${match[1]})`]) out[`(${match[1]})`] = value;
    }
  }
  return out;
}

let memory = null;
let inflight = null;

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(cacheFile(), "utf8"));
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify(data, null, 2));
  } catch {
    // Sin disco no pasa nada: queda la copia en memoria.
  }
}

async function download(now = new Date()) {
  const page = PRICE_CONFIG.pagina;
  const { text } = await fetchText(page, { timeout: 20000 });
  const year = now.getFullYear();
  const xlsxUrl = findXlsxLink(text, page, year);
  if (!xlsxUrl) throw new Error("La página del MAPA no enlaza el Excel de precios");
  const fileYear = Number(xlsxUrl.match(/precios_medios_nacionales_(\d{4})/)?.[1]) || year;
  const { buf } = await fetchBuffer(xlsxUrl, { timeout: 30000, headers: { Accept: "*/*" } });
  const parsed = parsePriceSheet(readFirstSheet(buf), PRICE_CONFIG.productos, fileYear);
  return { ok: true, year: fileYear, ...parsed, fileUrl: xlsxUrl, fetchedAt: now.toISOString() };
}

function envelope(data, extra = {}) {
  return {
    source: PRICE_CONFIG.fuente,
    pageUrl: PRICE_CONFIG.pagina,
    ...(data || { ok: false, items: [] }),
    ...extra,
  };
}

/** Precios con caché; nunca lanza error. */
export async function getPrices({ force = false, now = new Date(), loader = download } = {}) {
  const ttl = (Number(PRICE_CONFIG.horasCache) || 12) * 3600000;
  if (!memory) memory = readCache();
  const fresh = memory?.ok && now.getTime() - new Date(memory.fetchedAt).getTime() < ttl;
  if (fresh && !force) return envelope(memory, { stale: false });
  if (!inflight) {
    inflight = loader(now)
      .then((data) => {
        memory = data;
        writeCache(data);
        return envelope(data, { stale: false });
      })
      .catch((error) => {
        const reason = String(error?.message || error).slice(0, 160);
        if (memory?.ok) return envelope(memory, { stale: true, error: reason });
        return envelope(null, {
          ok: false,
          error: reason,
          explanation:
            "Ahora mismo no podemos leer el Excel de precios del Ministerio. Para no darte un precio equivocado, no enseñamos ninguno: mira la tabla oficial en el enlace.",
        });
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function resetPriceCache() {
  memory = null;
  inflight = null;
}
