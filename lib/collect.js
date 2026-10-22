import * as cheerio from "cheerio";
import { aidFromBdns, aidFromText, finalizeAid, mergeAid } from "./aid.js";
import { LIST_PAGES, PAC_LINE_PAGES, SOURCES } from "./config.js";
import {
  ambitoPermitido,
  canonicalUrl,
  classify,
  decorateItem,
  isMascota,
  isRecentPublication,
  isRelevant,
  parseDate,
  titleKey,
} from "./classify.js";
import { fetchJson, fetchText } from "./net.js";
import { madridTodayKey } from "./preferences.js";
import { makeId, makeLineId } from "./store.js";

function absUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return href || base;
  }
}

function clean(text = "") {
  return String(text).replace(/\s+/g, " ").replace(/&nbsp;/g, " ").trim();
}

function decodeEntities(text = "") {
  return clean(
    text
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&aacute;/g, "á")
      .replace(/&eacute;/g, "é")
      .replace(/&iacute;/g, "í")
      .replace(/&oacute;/g, "ó")
      .replace(/&uacute;/g, "ú")
      .replace(/&ntilde;/g, "ñ")
      .replace(/&Aacute;/g, "Á")
      .replace(/&Eacute;/g, "É")
      .replace(/&Iacute;/g, "Í")
      .replace(/&Oacute;/g, "Ó")
      .replace(/&Uacute;/g, "Ú")
      .replace(/&Ntilde;/g, "Ñ")
      .replace(/&uuml;/g, "ü")
  );
}

function parseRssItems(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $("item").each((_, el) => {
    const node = $(el);
    items.push({
      title: decodeEntities(node.find("title").first().text()),
      url: decodeEntities(node.find("link").first().text() || node.find("guid").first().text()),
      summary: decodeEntities(node.find("description").first().text()),
      publishedAt: parseDate(
        node.find("pubDate").first().text() || node.find("dc\\:date").first().text() || node.find("date").first().text(),
        node.find("title").first().text()
      ),
      rawHtml: node.find("description").first().html() || node.find("description").first().text(),
    });
  });
  return items;
}

/** Recorta texto literal de la fuente; si se corta, lo indica con «…» (no se reescribe). */
function cut(value, max) {
  const text = clean(value);
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function buildItem({
  sourceId,
  sourceName,
  title,
  url,
  summary,
  publishedAt,
  extra = "",
  aid = null,
  kind = "noticia",
  bdnsCode = null,
  tramiteUrl = null,
}) {
  // Sin enlace oficial (http/https) no se publica nada.
  if (!/^https?:\/\//i.test(String(url || "").trim())) return null;
  const blob = `${title} ${summary} ${extra} ${sourceName}`;
  const trusted = sourceId === "bdns" || sourceId === "junta_ayudas";
  if (isMascota(blob) || !ambitoPermitido(blob)) return null;
  if (!trusted && kind !== "linea" && !isRelevant(blob)) return null;
  const catalog = kind === "linea";
  const when = parseDate(publishedAt);
  const textAid = aidFromText(`${title}. ${summary}. ${extra}`);
  const merged = mergeAid(aid, {
    ...textAid,
    what: textAid.what || cut(summary, 280) || null,
  });
  const finalAid = finalizeAid(merged, madridTodayKey());
  return decorateItem({
    id: catalog ? makeLineId(sourceId, url, title) : makeId(sourceId, url, title),
    sourceId,
    sourceName,
    title: cut(title, 350),
    url,
    summary: cut(summary, 500),
    publishedAt: when,
    dateSource: catalog ? "catalogo" : "meta",
    category: classify({ sourceId, title, summary, extra }),
    aid: finalAid,
    kind: catalog ? "linea" : undefined,
    extra: clean(extra).slice(0, 300),
    bdnsCode: bdnsCode ? String(bdnsCode) : null,
    tramiteUrl: tramiteUrl || null,
  });
}

function uniqueByStory(items) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const seenLine = new Set();
  const out = [];
  for (const item of items) {
    if (!item || !item.title || !item.url) continue;
    if (item.kind === "linea") {
      const key = `${canonicalUrl(item.url)}|${titleKey(item.title)}`;
      if (seenLine.has(key)) continue;
      seenLine.add(key);
      out.push(item);
      continue;
    }
    const urlKey = canonicalUrl(item.url);
    const key = titleKey(item.title);
    if (urlKey && seenUrl.has(urlKey)) continue;
    if (key.length >= 40 && seenTitle.has(key)) continue;
    if (urlKey) seenUrl.add(urlKey);
    if (key.length >= 40) seenTitle.add(key);
    out.push(item);
  }
  return out;
}

async function collectRss(sourceId, sourceName, url, { filterRelevant = false } = {}) {
  const { text } = await fetchText(url);
  return parseRssItems(text)
    .filter((item) => item.title && item.url)
    .filter((item) => (filterRelevant ? isRelevant(`${item.title} ${item.summary}`) : true))
    .map((item) => buildItem({
      sourceId,
      sourceName,
      title: item.title,
      url: item.url,
      summary: item.summary,
      publishedAt: item.publishedAt,
    }))
    .filter(Boolean);
}

async function collectBocylRss() {
  const { text } = await fetchText("https://bocyl.jcyl.es/rss");
  const feedItems = parseRssItems(text);
  const out = [];
  for (const feed of feedItems) {
    const $ = cheerio.load(feed.rawHtml || feed.summary || "", { decodeEntities: true });
    $("li").each((_, li) => {
      const node = $(li);
      const link = node.find("a").first().attr("href") || feed.url;
      const heading = clean(node.find("a").first().text());
      const body = clean(node.find("p").last().text() || node.text());
      const title = body || heading;
      const blob = `${heading} ${body}`;
      if (!title || (!isRelevant(blob) && !/consejer[ií]a de agricultura|pesca/i.test(blob))) return;
      if (/autoridades y personal|cese del titular|nombramiento/i.test(blob)) return;
      out.push(buildItem({
        sourceId: "bocyl",
        sourceName: "BOCyL",
        title,
        url: absUrl(link, "https://bocyl.jcyl.es/"),
        summary: heading,
        publishedAt: feed.publishedAt,
        extra: blob,
      }));
    });
  }
  return out.filter(Boolean);
}

async function collectBocylSearch() {
  const queries = ["agricultura", "ganadería", "pesca", "PAC", "FEADER", "subvenciones agrarias", "apicultura", "secano", "regadío"];
  const out = [];
  for (const titulo of queries) {
    const { text } = await fetchText("https://bocyl.jcyl.es/busquedaTitulo", {
      method: "POST",
      headers: { Accept: "text/html", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ hiddenAccion: "Buscar", esPortada: "true", titulo, boton: "Buscar" }).toString(),
    });
    const $ = cheerio.load(text);
    $("#resultadosbusqueda li.nobullet").each((_, li) => {
      const node = $(li);
      const title = clean(node.find("p").first().text());
      const fecha = clean(node.find("dt:contains('Fecha') + dd").first().text());
      const organismo = clean(node.find("dt:contains('Organismo') + dd").first().text());
      const seccion = clean(node.find("dt:contains('Subsección'), dt:contains('Subseccion')").next("dd").text());
      const href = node.find("a[href*='.html'], a[href*='/html/']").attr("href") || node.find("a[href*='.pdf']").attr("href");
      if (!title || !href) return;
      if (/autoridades y personal|cese del titular|nombramiento/i.test(`${title} ${seccion}`)) return;
      const publishedAt = parseDate(fecha);
      if (!publishedAt || !isRecentPublication(publishedAt)) return;
      out.push(buildItem({
        sourceId: "bocyl",
        sourceName: "BOCyL",
        title,
        url: absUrl(href, "https://bocyl.jcyl.es/"),
        summary: organismo || seccion,
        publishedAt,
        extra: `${title} ${organismo}`,
      }));
    });
  }
  return out.filter(Boolean);
}

async function collectBocyl() {
  const rss = await collectBocylRss().catch(() => []);
  const search = await collectBocylSearch();
  return uniqueByStory([...rss, ...search]);
}

async function mapPool(list, limit, worker) {
  const queue = [...list];
  const out = new Array(list.length);
  let cursor = 0;
  async function run() {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(queue[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, run));
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(value) {
  return clean(String(value || "").replace(/<[^>]+>/g, " "));
}

function dayOnly(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function searchBdns(regiones, pages) {
  const rows = [];
  let total = null;
  for (let page = 0; page < pages; page += 1) {
    const params = new URLSearchParams({
      vpd: "GE",
      finalidad: "12",
      page: String(page),
      pageSize: "25",
      order: "fechaRecepcion",
      direccion: "desc",
    });
    if (regiones) params.set("regiones", regiones);
    const json = await fetchJson(`https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda?${params}`);
    if (total == null && Number.isFinite(Number(json.totalElements))) total = Number(json.totalElements);
    rows.push(...(json.content || []));
    await sleep(120);
  }
  return { rows, total };
}

async function collectBdns() {
  const batches = [
    { regiones: "34", pages: 2, rank: 0 },
    { regiones: "29", pages: 2, rank: 1 },
    { regiones: "", pages: 1, rank: 2 },
  ];
  const rows = [];
  const seen = new Set();
  const totals = {};
  for (const batch of batches) {
    const found = await searchBdns(batch.regiones, batch.pages);
    totals[batch.regiones || "ES"] = found.total;
    for (const row of found.rows) {
      const key = String(row.numeroConvocatoria || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({ ...row, rank: batch.rank });
    }
  }
  rows.sort((a, b) => a.rank - b.rank || String(b.fechaRecepcion || "").localeCompare(String(a.fechaRecepcion || "")));
  const limited = rows.slice(0, 36);
  const detailed = await mapPool(limited, 4, async (row) => {
    const code = String(row.numeroConvocatoria);
    let detail = null;
    try {
      const payload = await fetchJson(
        `https://www.infosubvenciones.es/bdnstrans/api/convocatorias?vpd=GE&numConv=${encodeURIComponent(code)}`
      );
      detail = Array.isArray(payload) ? payload[0] : payload;
    } catch {
      detail = null;
    }
    const aid = detail ? aidFromBdns(detail) : null;
    const regions = (detail?.regiones || []).map((item) => item.descripcion).join(", ");
    const sectors = (detail?.sectores || []).map((item) => item.descripcion).join(", ");
    const summary = [row.nivel2, row.nivel3, regions, sectors, `BDNS ${code}`].filter(Boolean).join(" · ");
    const sede = detail?.sedeElectronica || detail?.sede?.url || "";
    return buildItem({
      sourceId: "bdns",
      sourceName: "BDNS / infosubvenciones",
      title: detail?.descripcion || row.descripcion,
      url: `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/${code}`,
      summary,
      publishedAt: detail?.fechaRecepcion || row.fechaRecepcion,
      extra: `${summary} ${regions} ${detail?.descripcionFinalidad || ""} ${detail?.tipoConvocatoria || ""}`,
      aid,
      kind: "ayuda",
      bdnsCode: code,
      tramiteUrl: sede && /^https?:/i.test(sede) ? sede : null,
    });
  });
  const salamanca = totals["34"];
  const cyl = totals["29"];
  return {
    items: detailed.filter(Boolean),
    note: `Fichas leídas: ${limited.length}. El buscador indica ${salamanca ?? "—"} en Salamanca y ${cyl ?? "—"} en Castilla y León (finalidad agricultura, pesca y alimentación). No se descarga el listado entero.`,
  };
}

async function collectJuntaAyudas() {
  const source = SOURCES.find((item) => item.id === "junta_ayudas");
  const json = await fetchJson(source.feed);
  const records = json.results || [];
  const items = records
    .map((row) => {
      const title = stripHtml(row.titulo);
      const description = stripHtml(row.descripcion);
      const who = stripHtml(row.beneficiarios || row.destinatarios);
      const amount = stripHtml(row.cuantia);
      const implies = stripHtml(row.requisitos || row.conceptos_subvencionables);
      const plazo = stripHtml(row.plazo_presentacion);
      const textAid = aidFromText(`${plazo}. ${description}. ${amount}. ${who}`);
      const sinPlazo = textAid.deadlineNote && /sin plazo/i.test(textAid.deadlineNote);
      const openField = sinPlazo ? null : dayOnly(row.fecha_apertura);
      const closeField = sinPlazo ? null : dayOnly(row.fecha_limite);
      const structuredDeadline = Boolean(openField || closeField);
      const aid = {
        ...textAid,
        what: cut(description, 280) || textAid.what,
        who: cut(who, 280) || textAid.who,
        amount: cut(amount, 240) || textAid.amount,
        amountAmbiguous: amount ? false : textAid.amountAmbiguous,
        implies: cut(implies, 240) || textAid.implies,
        opensAt: structuredDeadline ? openField : textAid.opensAt,
        closesAt: structuredDeadline ? closeField : textAid.closesAt,
        deadlineAmbiguous: structuredDeadline ? false : textAid.deadlineAmbiguous,
      };
      const tramite = String(row.enlace_contenido || "");
      const code = row.codigo_bdns ? String(row.codigo_bdns) : null;
      return buildItem({
        sourceId: "junta_ayudas",
        sourceName: "Junta de Castilla y León · datos abiertos",
        title,
        url: /^https?:/i.test(tramite) ? tramite : source.url,
        summary: cut([who, plazo].filter(Boolean).join(" · "), 500) || cut(description, 280),
        publishedAt: row.fecha_publicacion,
        extra: `${title} ${description}`,
        aid,
        kind: "ayuda",
        bdnsCode: code,
        tramiteUrl: /^https?:/i.test(tramite) ? tramite : null,
      });
    })
    .filter(Boolean);
  return {
    items,
    note: "El conjunto de datos abiertos va por detrás de las convocatorias nuevas. Si hay código BDNS, se cruza con la ficha nacional.",
  };
}

async function collectRedPac() {
  const { text } = await fetchText("https://www.redpac.es/rss.xml");
  const raw = parseRssItems(text).filter((item) => item.title && item.url);
  const items = raw
    .map((item) =>
      buildItem({
        sourceId: "red_pac",
        sourceName: "Red PAC",
        title: item.title,
        url: item.url,
        summary: item.summary,
        publishedAt: item.publishedAt,
        extra: item.summary,
      })
    )
    .filter(Boolean);
  return {
    items,
    note:
      raw.length && !items.length
        ? "El canal trae convocatorias, pero en esta lectura ninguna es de Castilla y León."
        : null,
  };
}

function mergeBdnsRecords(items) {
  const byCode = new Map();
  const out = [];
  for (const item of items) {
    const code = item?.bdnsCode ? String(item.bdnsCode) : "";
    if (!code) {
      out.push(item);
      continue;
    }
    const index = byCode.get(code);
    if (index == null) {
      byCode.set(code, out.length);
      out.push(item);
      continue;
    }
    const prev = out[index];
    const base = prev.sourceId === "bdns" || item.sourceId !== "bdns" ? prev : item;
    const extra = base === prev ? item : prev;
    const aid = finalizeAid(mergeAid(base.aid, extra.aid), madridTodayKey());
    const tramite = extra.tramiteUrl || base.tramiteUrl || null;
    out[index] = {
      ...base,
      aid,
      summary: base.summary || extra.summary,
      publishedAt: base.publishedAt || extra.publishedAt,
      tramiteUrl: tramite && tramite !== base.url ? tramite : base.tramiteUrl || null,
    };
  }
  return out;
}

async function collectFega() {
  const { text } = await fetchText("https://www.fega.gob.es/es/noticias");
  const $ = cheerio.load(text);
  const out = [];
  $(".card-item, .views-row").each((_, el) => {
    const node = $(el);
    const link = node.find(".views-field-title a, h2 a, h3 a").first();
    const title = clean(link.text());
    const href = link.attr("href");
    if (!title || !href) return;
    const summary = clean(node.find(".views-field-body, p").first().text());
    const publishedAt =
      parseDate(node.find("time").attr("datetime") || node.find("time").text() || node.find(".datetime").text()) ||
      parseDate(clean(node.text()).slice(0, 220));
    out.push(buildItem({
      sourceId: "fega",
      sourceName: "FEGA",
      title,
      url: absUrl(href, "https://www.fega.gob.es/"),
      summary,
      publishedAt,
    }));
  });
  return out.filter(Boolean);
}

async function collectJuntaComunicacion() {
  const { text } = await fetchText("https://comunicacion.jcyl.es/");
  const $ = cheerio.load(text);
  const out = [];
  $("a").each((_, el) => {
    const link = $(el);
    const href = link.attr("href") || "";
    const title = clean(link.text());
    if (!title || title.length < 35) return;
    if (!/comunicacion\.jcyl\.es|NotaPrensa|Noticia|Comunicacion/i.test(href)) return;
    if (!isRelevant(title)) return;
    const block = clean(link.closest("article, li, div").text() || title);
    out.push(buildItem({
      sourceId: "junta_comunicacion",
      sourceName: "Comunicación Junta CyL",
      title,
      url: absUrl(href, "https://comunicacion.jcyl.es/"),
      summary: "",
      publishedAt: parseDate(block.slice(0, 220)),
      extra: title,
    }));
  });
  return uniqueByStory(out.filter(Boolean));
}

async function collectMapaPrensa() {
  const source = SOURCES.find((item) => item.id === "mapa_prensa");
  const items = await collectRss(source.id, source.name, source.feed);
  return items.slice(0, 25);
}

async function collectItacyl() {
  const { text } = await fetchText("https://www.itacyl.es/");
  const $ = cheerio.load(text);
  const out = [];
  $("a").each((_, el) => {
    const link = $(el);
    const title = clean(link.text());
    const href = link.attr("href") || "";
    if (!title || title.length < 32 || title.length > 180) return;
    if (!/itacyl\.es/i.test(href) && !href.startsWith("/")) return;
    if (/twitter|facebook|linkedin|aviso legal|contacto|accesibilidad|mapa web|inicio|instagram|youtube/i.test(title)) return;
    if (!/ayuda|convocatoria|proyecto|cultivo|ganader|innov|noticia|jornada|publicaci/i.test(title)) return;
    const block = clean(link.closest("li, article, div").text() || title);
    out.push(buildItem({
      sourceId: "itacyl",
      sourceName: "ITACyL",
      title,
      url: absUrl(href, "https://www.itacyl.es/"),
      summary: "",
      publishedAt: parseDate(block.slice(0, 220)),
      extra: title,
    }));
  });
  return uniqueByStory(out.filter(Boolean)).slice(0, 15);
}

function lineItems(html, pageUrl, sourceId, sourceName) {
  const $ = cheerio.load(html);
  const scope = $("#contenidos");
  const root = scope.length ? scope : $.root();
  const lines = [];
  let current = null;
  root.find("h1, h2, h3, dt, p").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = clean($(el).text());
    if (!text || text.length < 16) return;
    if (tag === "h1" || tag === "h2" || tag === "dt") {
      if (current && current.body.length) lines.push(current);
      current = { title: cut(text.replace(/^\d+\s*\.?\s*-?\s*/, ""), 240), body: [] };
    } else if (current && current.body.length < 3) {
      current.body.push(cut(text, 480));
    }
  });
  if (current && current.body.length) lines.push(current);
  return lines
    .filter((line) => /ayuda|pago|ecorreg|solicitud|feader|condicion|beneficiar|intervenci[oó]n|olivar|ganader|cultivo/i.test(`${line.title} ${line.body.join(" ")}`))
    .map((line) => {
      const summary = line.body.join(" ");
      return buildItem({
        sourceId,
        sourceName,
        title: line.title,
        url: pageUrl,
        summary,
        publishedAt: null,
        extra: "",
        kind: "linea",
      });
    })
    .filter(Boolean);
}

async function collectPacLines() {
  const out = [];
  for (const page of PAC_LINE_PAGES) {
    try {
      const { text } = await fetchText(page);
      out.push(...lineItems(text, page, "pac_lineas", "Líneas PAC Castilla y León"));
    } catch (error) {
      out.push(null);
      console.error("[alerta] Página PAC no leída:", page, error.message);
    }
  }
  return { items: uniqueByStory(out.filter(Boolean)), catalog: true };
}

function linkItems(html, pageUrl, sourceId, sourceName) {
  const $ = cheerio.load(html);
  const scope = $("#contenidos");
  const root = scope.length ? scope : $.root();
  const out = [];
  root.find("li, p").each((_, el) => {
    const node = $(el);
    const link = node.find("a").first();
    const href = link.attr("href") || "";
    const title = clean(link.text() || node.text());
    const full = clean(node.text());
    if (!title || title.length < 28 || title.length > 320) return;
    if (!/ayuda|convocatoria|subvenci|plazo|orden /i.test(`${title} ${full}`)) return;
    if (/saltar|escuchar|aviso legal|mapa web/i.test(title)) return;
    out.push(buildItem({
      sourceId,
      sourceName,
      title,
      url: absUrl(href || pageUrl, pageUrl),
      summary: cut(full, 500),
      publishedAt: null,
      extra: full,
      kind: "linea",
    }));
  });
  return uniqueByStory(out.filter(Boolean)).slice(0, 60);
}

async function collectListCatalog() {
  const grouped = new Map();
  for (const page of LIST_PAGES) {
    try {
      const { text } = await fetchText(page.url);
      const items = linkItems(text, page.url, page.sourceId, page.sourceName);
      const prev = grouped.get(page.sourceId) || { sourceId: page.sourceId, sourceName: page.sourceName, items: [] };
      prev.items.push(...items);
      grouped.set(page.sourceId, prev);
    } catch (error) {
      console.error("[alerta] Listado no leído:", page.url, error.message);
    }
  }
  return [...grouped.values()];
}

async function collectCylPesca() {
  const url = "https://medioambiente.jcyl.es/web/es/caza-pesca.html";
  const { text } = await fetchText(url);
  const items = linkItems(text, url, "cyl_pesca", "Pesca continental CyL").filter((item) =>
    /pesca|acuicult|licencia de pesca/i.test(`${item.title} ${item.summary}`)
  );
  return {
    items,
    note: items.length
      ? null
      : "La página de Castilla y León habla de licencias de caza y pesca, no de convocatorias de ayuda.",
  };
}

const SPECIAL_JOBS = [
  { id: "bocyl", run: collectBocyl },
  { id: "bdns", run: collectBdns },
  { id: "junta_ayudas", run: collectJuntaAyudas },
  { id: "fega", run: collectFega },
  { id: "pac_lineas", catalog: "pac_lineas", run: collectPacLines },
  { id: "itacyl", run: collectItacyl },
  { id: "junta_comunicacion", run: collectJuntaComunicacion },
  { id: "cyl_pesca", run: collectCylPesca },
  { id: "red_pac", run: collectRedPac },
  { id: "mapa_prensa", run: collectMapaPrensa },
];

function configuredJobs() {
  const special = new Map(SPECIAL_JOBS.map((job) => [job.id, job]));
  const jobs = [];
  for (const source of SOURCES) {
    if (!source.enabled) continue;
    const custom = special.get(source.id);
    if (custom) {
      jobs.push({ ...custom, name: source.name });
      continue;
    }
    if (source.kind === "rss" && source.feed) {
      jobs.push({
        id: source.id,
        name: source.name,
        run: () => collectRss(source.id, source.name, source.feed, { filterRelevant: true }),
      });
    }
  }
  return jobs;
}

const JOBS = configuredJobs();

export async function collectAll() {
  const reports = {};
  const all = [];
  const catalogs = [];
  const queue = [...JOBS];
  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      const started = Date.now();
      try {
        const result = await job.run();
        const items = Array.isArray(result) ? result : result.items || [];
        reports[job.id] = {
          name: job.name,
          ok: true,
          count: items.length,
          ms: Date.now() - started,
          error: null,
          note: result && !Array.isArray(result) ? result.note || null : null,
        };
        if (job.catalog) catalogs.push({ sourceId: job.catalog, items });
        else all.push(...items);
      } catch (error) {
        reports[job.id] = {
          name: job.name,
          ok: false,
          count: 0,
          ms: Date.now() - started,
          error: String(error.message || error),
          note: null,
        };
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const merged = mergeBdnsRecords(all);
  all.length = 0;
  all.push(...merged);
  try {
    const lists = await collectListCatalog();
    for (const group of lists) {
      catalogs.push({ sourceId: group.sourceId, items: group.items });
      reports[group.sourceId] = {
        name: group.sourceName,
        ok: true,
        count: group.items.length,
        ms: 0,
        error: null,
        note: null,
      };
    }
  } catch (error) {
    reports.listados = { name: "Listados de ayudas", ok: false, count: 0, ms: 0, error: String(error.message || error), note: null };
  }
  return { items: uniqueByStory(all), catalogs, reports };
}

export { JOBS };
