/**
 * v5.9 · Alertas: avisos oficiales de riesgo que no salen en ninguna otra sección.
 * Cuatro fuentes públicas, sin clave: AEMET (RSS de avisos CAP de Castilla y León), ITACyL (avisos del Portal
 * de plagas), RASVE (últimos focos de enfermedades animales, MAPA) y Junta de CyL (épocas de peligro de incendios).
 * Cada fuente se lee por separado; si una falla, se dice y se enlaza la página oficial. Nunca se inventa nada.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchText } from "./net.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ALERT_SOURCES = [
  { id: "aemet", name: "Avisos meteorológicos (AEMET)", organism: "Agencia Estatal de Meteorología", sectors: ["agricultura", "ganaderia"],
    url: "https://www.aemet.es/es/eltiempo/prediccion/avisos", feed: "https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_RSS.xml" },
  { id: "plagas", name: "Plagas y sanidad vegetal (ITACyL)", organism: "Instituto Tecnológico Agrario de Castilla y León", sectors: ["agricultura"],
    url: "https://plagas.itacyl.es/", feed: "https://plagas.itacyl.es/" },
  { id: "rasve", name: "Sanidad animal (RASVE)", organism: "Ministerio de Agricultura, Pesca y Alimentación", sectors: ["ganaderia"],
    url: "https://servicio.mapa.gob.es/rasve/Publico/Publico/ultimosfocos.aspx", feed: "https://servicio.mapa.gob.es/rasve/Publico/Publico/ultimosfocos.aspx" },
  { id: "incendios", name: "Peligro de incendios (Junta de Castilla y León)", organism: "Junta de Castilla y León", sectors: ["agricultura", "ganaderia"],
    url: "https://medioambiente.jcyl.es/web/es/medio-natural/actividades-epocas-peligro-incendios.html", feed: "https://medioambiente.jcyl.es/web/es/medio-natural/actividades-epocas-peligro-incendios.html" },
];

const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const pad = (n) => String(n).padStart(2, "0");
const clean = (s) => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const dayKey = (d) => d.toISOString().slice(0, 10);
const daysAgo = (now, n) => dayKey(new Date(now.getTime() - n * 86400000));

/** AEMET: cada <item> es un aviso (se salta el «Estado completo», que es un .tar.gz). */
export function parseAemet(xml, source = ALERT_SOURCES[0]) {
  const out = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const get = (tag) => clean((m[1].match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1]);
    const title = get("title");
    if (!/^Aviso\b/i.test(title)) continue;
    const date = get("pubDate").slice(0, 10);
    out.push({ title, summary: get("description"), date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, url: source.url, level: (title.match(/Nivel (amarillo|naranja|rojo)/i) || [])[1]?.toLowerCase() || null });
  }
  return out;
}

/** ITACyL: avisos fechados de la portada («23 octubre de 2026 DETECCIÓN DE …»), de los últimos 60 días. */
export function parsePlagas(html, now = new Date(), base = "https://plagas.itacyl.es/") {
  const out = [];
  const seen = new Set();
  for (const m of String(html).matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const text = clean(m[2]);
    const d = text.match(/^(\d{1,2}) (?:de )?([a-záéíóú]+) de (\d{4})\s+(.+)$/i);
    if (!d || !MONTHS[d[2].toLowerCase()]) continue;
    const date = `${d[3]}-${pad(MONTHS[d[2].toLowerCase()])}-${pad(d[1])}`;
    if (date < daysAgo(now, 60)) continue;
    const url = new URL(m[1].replace(/&amp;/g, "&"), base).href.replace(/\?redirect=.*$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    const title = d[4].charAt(0) + d[4].slice(1).toLowerCase();
    out.push({ title, summary: "Aviso del Portal de plagas del ITACyL.", date, url });
  }
  return out;
}

/** RASVE: tabla de los 15 últimos focos; se quedan los confirmados en los últimos 30 días. */
export function parseRasve(html, now = new Date(), source = ALERT_SOURCES[2]) {
  const s = String(html);
  const at = s.search(/15 [úu]ltimos focos|ltimos focos/i);
  if (at < 0) throw new Error("La página de RASVE no trae la tabla de últimos focos");
  const table = s.slice(s.indexOf("<table", at), s.indexOf("</table>", at));
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => [...r[0].matchAll(/<t[hd][\s\S]*?<\/t[hd]>/g)].map((c) => clean(c[0])));
  const head = rows.shift() || [];
  const col = (re) => head.findIndex((h) => re.test(h));
  const iE = col(/Enfermedad/i), iF = col(/Fecha/i), iC = col(/CCAA/i), iP = col(/Provincia/i), iM = col(/Municipio/i);
  if (iE < 0 || iF < 0) throw new Error("La tabla de RASVE ha cambiado");
  const out = [];
  for (const r of rows) {
    const f = (r[iF] || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!f || !r[iE]) continue;
    const date = `${f[3]}-${f[2]}-${f[1]}`;
    if (date < daysAgo(now, 30)) continue;
    const where = [r[iM], r[iP], r[iC]].filter(Boolean).join(", ");
    out.push({ title: `${r[iE]}${where ? ` · ${where}` : ""}`, summary: `Foco confirmado el ${f[1]}/${f[2]}/${f[3]}.`, date, url: source.url, local: /CASTILLA Y LE/i.test(r[iC] || "") });
  }
  return out;
}

/** Junta: última resolución de época de peligro de incendios, si es de los últimos 45 días. */
export function parseIncendios(html, now = new Date(), base = ALERT_SOURCES[3].url) {
  const out = [];
  for (const m of String(html).matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const text = clean(m[2]);
    const d = text.match(/^RESOLUCI[ÓO]N de (\d{1,2}) de ([a-záéíóú]+) de (\d{4}).*?(peligro|alerta)/i);
    if (!d || !MONTHS[d[2].toLowerCase()]) continue;
    const date = `${d[3]}-${pad(MONTHS[d[2].toLowerCase()])}-${pad(d[1])}`;
    if (date < daysAgo(now, 45)) continue;
    out.push({ title: text.replace(/\s*\(\d[\d.]* kbytes\)\s*$/, ""), summary: "Resolución publicada por la Junta de Castilla y León.", date, url: new URL(m[1].replace(/&amp;/g, "&"), base).href });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 1);
}

const PARSERS = { aemet: (t) => parseAemet(t), plagas: (t, now) => parsePlagas(t, now), rasve: (t, now) => parseRasve(t, now), incendios: (t, now) => parseIncendios(t, now) };

async function download(now = new Date()) {
  const groups = await Promise.all(ALERT_SOURCES.map(async (source) => {
    try {
      const { text } = await fetchText(source.feed, { timeout: 20000 });
      const items = PARSERS[source.id](text, now).map((item, i) => ({ id: `${source.id}-${item.date || ""}-${i}`, sourceId: source.id, sourceName: source.name, sectors: source.sectors, ...item }));
      return { ...source, ok: true, items };
    } catch (error) {
      return { ...source, ok: false, items: [], error: String(error?.message || error).slice(0, 160) };
    }
  }));
  return { ok: groups.some((g) => g.ok), fetchedAt: now.toISOString(), groups };
}

function cacheFile() {
  return path.join(process.env.DATA_DIR || path.join(__dirname, "..", "data"), "alertas-cache.json");
}
let memory = null;
let inflight = null;

/** Avisos con caché de 1 hora; nunca lanza error. Si una fuente falla, se guarda la última copia buena de esa fuente. */
export async function getAlerts({ force = false, now = new Date(), loader = download } = {}) {
  if (!memory) { try { memory = JSON.parse(fs.readFileSync(cacheFile(), "utf8")); } catch { memory = null; } }
  if (memory && !force && now.getTime() - new Date(memory.fetchedAt).getTime() < 3600000) return memory;
  if (!inflight) {
    inflight = loader(now).then((data) => {
      const groups = data.groups.map((g) => {
        const old = memory?.groups?.find((o) => o.id === g.id && o.ok);
        return g.ok || !old ? g : { ...old, stale: true, error: g.error };
      });
      memory = { ...data, groups };
      try { fs.mkdirSync(path.dirname(cacheFile()), { recursive: true }); fs.writeFileSync(cacheFile(), JSON.stringify(memory, null, 2)); } catch { /* queda en memoria */ }
      return memory;
    }).catch((error) => memory || { ok: false, groups: ALERT_SOURCES.map((s) => ({ ...s, ok: false, items: [] })), error: String(error?.message || error) })
      .finally(() => { inflight = null; });
  }
  return inflight;
}
export function resetAlertCache() { memory = null; inflight = null; }
