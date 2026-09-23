import * as cheerio from "cheerio";
import { canonicalUrl, classify, decorateItem, isAgrario, isCastillaLeon, isPesca, isRecentPublication, parseDate, titleKey, topicOf } from "./classify.js";
import { makeId } from "./store.js";

const UA =
  "AlertaAgrariaCyL/1.0 (consulta personal de novedades agrarias oficiales)";

function absUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function clean(text = "") {
  return text.replace(/\s+/g, " ").replace(/&nbsp;/g, " ").trim();
}

function decodeEntities(text = "") {
  return clean(
    text
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
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

function recentEnough(iso) {
  return isRecentPublication(iso);
}

function dateIn(text) {
  return parseDate(clean(text).slice(0, 220));
}

async function fetchBuffer(url, extraHeaders = {}, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: {
      "User-Agent": UA,
      Accept: "text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
      ...extraHeaders,
    },
    body,
    signal: AbortSignal.timeout(30000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") || "";
  return { buf, ct, finalUrl: res.url };
}

async function fetchText(url, extraHeaders = {}, method = "GET", body) {
  const { buf, ct } = await fetchBuffer(url, extraHeaders, method, body);
  if (/iso-8859-1|latin-1/i.test(ct) || /boe\.es\/rss/i.test(url)) {
    return buf.toString("latin1");
  }
  return buf.toString("utf8");
}

async function fetchJson(url) {
  const text = await fetchText(url, { Accept: "application/json" });
  if (text.trim().startsWith("<")) throw new Error("La API devolvió HTML en lugar de JSON");
  return JSON.parse(text);
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
        node.find("pubDate").first().text() ||
          node.find("dc\\:date").first().text() ||
          node.find("date").first().text(),
        node.find("title").first().text()
      ),
      rawHtml: node.find("description").first().html() || node.find("description").first().text(),
    });
  });
  return items;
}

function toItem(sourceId, sourceName, title, url, summary, publishedAt, extra = "") {
  const blob = `${title} ${summary} ${extra} ${sourceName}`;
  if (isPesca(blob)) return null;
  const category = classify({ sourceId, title, summary, extra });
  const when = parseDate(publishedAt);
  if (!when || !recentEnough(when)) return null;
  return decorateItem({
    id: makeId(sourceId, url, title),
    sourceId,
    sourceName,
    title: clean(title).slice(0, 350),
    url,
    summary: clean(summary).slice(0, 420),
    publishedAt: when,
    dateSource: "meta",
    category,
    topic: topicOf(blob),
    region: isCastillaLeon(blob) ? "Castilla y León" : "España",
  });
}

async function collectRss(sourceId, sourceName, url, { filterAgrario = false } = {}) {
  const xml = await fetchText(url);
  const items = parseRssItems(xml)
    .filter((it) => it.title && it.url)
    .filter((it) => recentEnough(it.publishedAt))
    .filter((it) => (filterAgrario ? isAgrario(`${it.title} ${it.summary}`) : true))
    .map((it) => toItem(sourceId, sourceName, it.title, it.url, it.summary, it.publishedAt))
    .filter(Boolean);
  return items;
}

async function collectBocylRss() {
  const xml = await fetchText("https://bocyl.jcyl.es/rss");
  const feedItems = parseRssItems(xml);
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
      if (!title) return;
      if (!isAgrario(blob) && !/consejer[ií]a de agricultura/i.test(blob)) return;
      if (/autoridades y personal|cese del titular|nombramiento/i.test(blob)) return;
      out.push(
        toItem("bocyl", "BOCyL", title, absUrl(link, "https://bocyl.jcyl.es/"), heading, feed.publishedAt, blob)
      );
    });
  }
  return out;
}

async function collectBocylSearch() {
  const queries = ["agricultura", "ganadería", "PAC", "FEADER", "subvenciones agrarias"];
  const out = [];
  for (const titulo of queries) {
    const html = await fetchText(
      "https://bocyl.jcyl.es/busquedaTitulo",
      {
        Accept: "text/html",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      "POST",
      new URLSearchParams({
        hiddenAccion: "Buscar",
        esPortada: "true",
        titulo,
        boton: "Buscar",
      })
    );
    const $ = cheerio.load(html);
    $("#resultadosbusqueda li.nobullet").each((_, li) => {
      const node = $(li);
      const title = clean(node.find("p").first().text());
      const fecha = clean(node.find("dt:contains('Fecha') + dd").first().text());
      const organismo = clean(node.find("dt:contains('Organismo') + dd").first().text());
      const seccion = clean(node.find("dt:contains('Subsección'), dt:contains('Subseccion')").next("dd").text());
      const href =
        node.find("a[href*='.html'], a[href*='/html/']").attr("href") ||
        node.find("a[href*='.pdf']").attr("href");
      if (!title || !href) return;
      if (/autoridades y personal|cese del titular|nombramiento/i.test(`${title} ${seccion}`)) return;
      const publishedAt = parseDate(fecha);
      if (!recentEnough(publishedAt)) return;
      out.push(
        toItem(
          "bocyl",
          "BOCyL",
          title,
          absUrl(href, "https://bocyl.jcyl.es/"),
          organismo || seccion,
          publishedAt,
          `${title} ${organismo}`
        )
      );
    });
  }
  return out;
}

async function collectBocyl() {
  const rss = await collectBocylRss().catch(() => []);
  const search = await collectBocylSearch();
  return uniqueByStory([...rss, ...search]);
}

async function collectBdns() {
  const queries = [
    "FEADER",
    "PAC",
    "agricultura",
    "ganader",
    "explotaciones agrarias",
    "jóvenes agricultores",
    "modernización explotaciones",
    "viñedo",
    "desarrollo rural",
  ];
  const seen = new Set();
  const out = [];
  for (const q of queries) {
    const url =
      "https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda?" +
      new URLSearchParams({
        page: "0",
        pageSize: "20",
        order: "fechaRecepcion",
        direccion: "desc",
        vpd: "GE",
        descripcion: q,
      });
    const json = await fetchJson(url);
    for (const row of json.content || []) {
      const blob = `${row.descripcion} ${row.nivel1} ${row.nivel2} ${row.nivel3}`;
      const relevante =
        /castilla y le[oó]n|ministerio de agricultura|fega|fondo español de garant/i.test(blob);
      if (!relevante) continue;
      const publishedAt = parseDate(row.fechaRecepcion);
      if (!recentEnough(publishedAt)) continue;
      const itemUrl = `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/${row.numeroConvocatoria}`;
      const idKey = String(row.numeroConvocatoria || row.id);
      if (seen.has(idKey)) continue;
      seen.add(idKey);
      out.push(
        toItem(
          "bdns",
          "BDNS / infosubvenciones",
          row.descripcion,
          itemUrl,
          `${row.nivel2 || ""} · ${row.nivel3 || ""} · BDNS ${row.numeroConvocatoria}`,
          publishedAt,
          blob
        )
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return out;
}

async function collectFega() {
  const html = await fetchText("https://www.fega.gob.es/es/noticias");
  const $ = cheerio.load(html);
  const out = [];
  $(".card-item, .views-row").each((_, el) => {
    const node = $(el);
    const a = node.find(".views-field-title a, h2 a, h3 a").first();
    const title = clean(a.text());
    const href = a.attr("href");
    if (!title || !href) return;
    const summary = clean(node.find(".views-field-body, p").first().text());
    const publishedAt =
      parseDate(node.find("time").attr("datetime") || node.find("time").text() || node.find(".datetime").text()) ||
      dateIn(node.text());
    if (!recentEnough(publishedAt)) return;
    out.push(
      toItem("fega", "FEGA", title, absUrl(href, "https://www.fega.gob.es/"), summary, publishedAt)
    );
  });
  return out;
}

async function collectJuntaComunicacion() {
  const html = await fetchText("https://comunicacion.jcyl.es/");
  const $ = cheerio.load(html);
  const out = [];
  $("a").each((_, el) => {
    const a = $(el);
    const href = a.attr("href") || "";
    const title = clean(a.text());
    if (!title || title.length < 35) return;
    if (!/comunicacion\.jcyl\.es|NotaPrensa|Noticia|Comunicacion/i.test(href)) return;
    if (!isAgrario(title) && !/l[aá]ctea|campo|rural|agrari/i.test(title)) return;
    const block = clean(a.closest("article, li, div").text() || title);
    out.push(
      toItem(
        "junta_comunicacion",
        "Comunicación Junta CyL",
        title,
        absUrl(href, "https://comunicacion.jcyl.es/"),
        "Nota de prensa de la Junta de Castilla y León",
        dateIn(block),
        title
      )
    );
  });
  return uniqueByStory(out);
}

async function collectMapaPrensa() {
  const html = await fetchText("https://www.mapa.gob.es/es/prensa/ultimas-noticias");
  const $ = cheerio.load(html);
  const out = [];
  $("a[href*='detalle_noticias'], a[href*='ultimas-noticias']").each((_, el) => {
    const a = $(el);
    const title = clean(a.text());
    const href = a.attr("href");
    if (!title || title.length < 25 || !href) return;
    if (/sala de prensa|últimas noticias/i.test(title)) return;
    const block = clean(a.parent().text() || a.closest("li, article, div").text() || title);
    out.push(
      toItem(
        "mapa_prensa",
        "MAPA · prensa",
        title,
        absUrl(href, "https://www.mapa.gob.es/"),
        "Nota de prensa del Ministerio de Agricultura, Pesca y Alimentación",
        dateIn(block),
        title
      )
    );
  });
  return uniqueByStory(out).slice(0, 25);
}

async function collectPacCyl() {
  const urls = [
    "https://pac.jcyl.es/web/es/politica-agraria-comun.html",
    "https://agriculturaganaderia.jcyl.es/web/es/produccion-agricola/ayudas-actividades-agricolas.html",
  ];
  const out = [];
  for (const page of urls) {
    const html = await fetchText(page);
    const $ = cheerio.load(html);
    $("a").each((_, el) => {
      const a = $(el);
      const title = clean(a.text());
      const href = a.attr("href") || "";
      if (!title || title.length < 20) return;
      if (!isAgrario(title) && !/PAC|novedad|ayuda|convocatoria|plazo/i.test(title)) return;
      if (!/jcyl\.es|tramitacastillayleon|bocyl/i.test(href)) return;
      const sourceId = /pac\.jcyl/.test(page) ? "pac_cyl" : "ayudas_cyl";
      const sourceName = /pac\.jcyl/.test(page) ? "PAC Castilla y León" : "Ayudas agrícolas CyL";
      const block = clean(a.closest("li, article, p, div").text() || title);
      out.push(
        toItem(sourceId, sourceName, title, absUrl(href, page), `Publicado en ${page}`, dateIn(block), title)
      );
    });
  }
  return uniqueByStory(out).slice(0, 40);
}

async function collectJovenesCyl() {
  const urls = [
    "https://agriculturaganaderia.jcyl.es/web/es/desarrollo-rural/ayudas-incorporacion.html",
    "https://agriculturaganaderia.jcyl.es/web/es/desarrollo-rural/ayudas-modernizacion-agraria.html",
  ];
  const out = [];
  for (const page of urls) {
    const html = await fetchText(page);
    const $ = cheerio.load(html);
    $("a, li, p").each((_, el) => {
      const node = $(el);
      const title = clean(node.is("a") ? node.text() : node.find("a").text() || node.text());
      const href = node.is("a") ? node.attr("href") : node.find("a").attr("href");
      if (!title || title.length < 25 || title.length > 280) return;
      if (!/orden |extracto|convocatoria|solicitud|sede electr[oó]nica|plazo|modernizaci[oó]n agraria|incorporaci[oó]n/i.test(title)) return;
      if (!href && !/orden |extracto|convocatoria/i.test(title)) return;
      out.push(
        toItem(
          "jovenes_cyl",
          "Desarrollo rural CyL",
          title,
          absUrl(href || page, page),
          `Página oficial: ${page}`,
          dateIn(clean(node.closest("li, p, article, div").text() || title)),
          title
        )
      );
    });
  }
  return uniqueByStory(out).slice(0, 30);
}

async function collectItacyl() {
  const html = await fetchText("https://www.itacyl.es/");
  const $ = cheerio.load(html);
  const out = [];
  $("a").each((_, el) => {
    const a = $(el);
    const title = clean(a.text());
    const href = a.attr("href") || "";
    if (!title || title.length < 32 || title.length > 180) return;
    if (!/itacyl\.es/i.test(href) && !href.startsWith("/")) return;
    if (/twitter|facebook|linkedin|aviso legal|contacto|accesibilidad|mapa web|inicio|instagram|youtube/i.test(title)) return;
    if (!/ayuda|convocatoria|proyecto|cultivo|ganader|innov|noticia|jornada|publicaci/i.test(title)) return;
    const block = clean(a.closest("li, article, div").text() || title);
    out.push(
      toItem("itacyl", "ITACyL", title, absUrl(href, "https://www.itacyl.es/"), "Novedad del ITACyL", dateIn(block), title)
    );
  });
  return uniqueByStory(out).slice(0, 15);
}

function uniqueByStory(items) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const it of items) {
    if (!it || !it.title || !it.url) continue;
    const urlKey = canonicalUrl(it.url);
    const tKey = titleKey(it.title);
    if (urlKey && seenUrl.has(urlKey)) continue;
    if (tKey.length >= 40 && seenTitle.has(tKey)) continue;
    if (urlKey) seenUrl.add(urlKey);
    if (tKey.length >= 40) seenTitle.add(tKey);
    out.push(it);
  }
  return out;
}

const JOBS = [
  {
    id: "bocyl",
    name: "BOCyL",
    run: collectBocyl,
  },
  {
    id: "bdns",
    name: "BDNS / infosubvenciones",
    run: collectBdns,
  },
  {
    id: "mapa_agricultura",
    name: "MAPA agricultura (RSS)",
    run: () =>
      collectRss("mapa_rss", "MAPA · agricultura", "https://www.mapa.gob.es/es/agricultura/noticiasrss", {
        filterAgrario: false,
      }).then((items) => items.slice(0, 25)),
  },
  {
    id: "mapa_ganaderia",
    name: "MAPA ganadería (RSS)",
    run: () =>
      collectRss("mapa_rss", "MAPA · ganadería", "https://www.mapa.gob.es/es/ganaderia/noticiasrss").then((items) =>
        items.slice(0, 20)
      ),
  },
  {
    id: "mapa_rural",
    name: "MAPA desarrollo rural (RSS)",
    run: () =>
      collectRss(
        "mapa_rss",
        "MAPA · desarrollo rural",
        "https://www.mapa.gob.es/es/desarrollo-rural/noticiasrss"
      ).then((items) => items.slice(0, 20)),
  },
  {
    id: "mapa_prensa",
    name: "MAPA sala de prensa",
    run: collectMapaPrensa,
  },
  {
    id: "fega",
    name: "FEGA noticias",
    run: collectFega,
  },
  {
    id: "pac_cyl",
    name: "PAC Castilla y León",
    run: collectPacCyl,
  },
  {
    id: "jovenes_cyl",
    name: "Jóvenes y modernización CyL",
    run: collectJovenesCyl,
  },
  {
    id: "junta_comunicacion",
    name: "Comunicación Junta CyL",
    run: collectJuntaComunicacion,
  },
  {
    id: "itacyl",
    name: "ITACyL",
    run: collectItacyl,
  },
  {
    id: "boe_agricultura",
    name: "BOE legislación agricultura",
    run: () =>
      collectRss("boe_legislacion", "BOE · agricultura", "https://www.boe.es/rss/canal_leg.php?l=l&c=101"),
  },
  {
    id: "boe_alimentacion",
    name: "BOE legislación alimentación",
    run: () =>
      collectRss("boe_legislacion", "BOE · alimentación", "https://www.boe.es/rss/canal_leg.php?l=l&c=102"),
  },
  {
    id: "boe_ayudas",
    name: "BOE ayudas",
    run: () =>
      collectRss("boe_ayudas", "BOE · ayudas", "https://www.boe.es/rss/canal.php?c=ayudas", {
        filterAgrario: true,
      }),
  },
  {
    id: "boe_seccion1",
    name: "BOE sección I",
    run: () =>
      collectRss("boe_seccion1", "BOE · sección I", "https://www.boe.es/rss/boe.php?s=1", {
        filterAgrario: true,
      }),
  },
];

export async function collectAll() {
  const reports = {};
  const all = [];
  for (const job of JOBS) {
    const started = Date.now();
    try {
      const items = await job.run();
      reports[job.id] = {
        name: job.name,
        ok: true,
        count: items.length,
        ms: Date.now() - started,
        error: null,
      };
      all.push(...items);
    } catch (err) {
      reports[job.id] = {
        name: job.name,
        ok: false,
        count: 0,
        ms: Date.now() - started,
        error: String(err.message || err),
      };
    }
  }
  return { items: uniqueByStory(all), reports };
}

export { JOBS };
