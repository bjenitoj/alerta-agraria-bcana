/**
 * Norma: la app no inventa nada. Todo lo que enseña sale de una fuente oficial con enlace.
 * Estas pruebas fallan si se cuela un dato sin fuente, un valor por defecto o datos de ejemplo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alerta-noinvent-"));
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = "session-secret-de-prueba-32";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { extractAmountInfo, extractDeadline, statusOf } = await import("../lib/preferences.js");
const { aidFromText, mergeAid } = await import("../lib/aid.js");
const { deadlineInfo, extractDetails, hasSourceUrl, whyForYou, buildIcs } = await import("../lib/aid-view.js");
const { pacTimeline } = await import("../lib/pac-calendar.js");
const { parsePriceSheet, positionNotes } = await import("../lib/prices.js");
const { createApp } = await import("../server.js");

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

// ---------- Sin fuente, no se publica ----------

test("la API no devuelve ninguna ayuda sin enlace a la fuente oficial", async () => {
  const day = today();
  const base = { sourceId: "bocyl", sourceName: "BOCyL", summary: "Ayudas a explotaciones agrarias de Castilla y León", publishedAt: `${day}T08:00:00.000Z`, dateSource: "meta", category: "ayudas_subvenciones", infoTypes: ["ayudas"], aid: {} };
  const items = [
    { ...base, id: "con-url", title: "Ayudas a la agricultura en Castilla y León (con enlace)", url: "https://bocyl.jcyl.es/boletines/x.pdf" },
    { ...base, id: "sin-url", title: "Ayudas a la agricultura en Castilla y León (sin enlace)", url: "" },
    { ...base, id: "url-rara", title: "Ayudas a la agricultura en Castilla y León (enlace no web)", url: "javascript:alert(1)" },
  ];
  fs.writeFileSync(path.join(tmp, "store.json"), JSON.stringify({ items, archive: [], digests: [{ date: day, items }], sources: {} }));
  const { app } = createApp({ pricesLoader: async () => { throw new Error("sin red en la prueba"); } });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/state`);
    const data = await res.json();
    assert.ok(data.items.length >= 1);
    for (const item of data.items) assert.match(item.url, /^https?:\/\//, item.id);
    assert.ok(!data.items.some((item) => item.id === "sin-url" || item.id === "url-rara"));
    for (const digest of data.digests) for (const item of digest.items) assert.match(item.url, /^https?:\/\//);
  } finally {
    server.close();
  }
  assert.equal(hasSourceUrl({ url: "" }), false);
  assert.equal(hasSourceUrl({ url: "https://www.boe.es/x" }), true);
});

test("la página de Fuentes lista también MAPA precios, el díptico del FEGA y la nota del MAPA", async () => {
  const { app } = createApp({ pricesLoader: async () => { throw new Error("sin red en la prueba"); } });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const data = await (await fetch(`http://127.0.0.1:${server.address().port}/api/fuentes`)).json();
    const urls = new Set([...(data.sources || []).map((s) => s.url), ...(data.references || []).map((s) => s.url)]);
    const pac = JSON.parse(fs.readFileSync(path.join(root, "config", "pac-calendario.json"), "utf8"));
    const prices = JSON.parse(fs.readFileSync(path.join(root, "config", "precios-mapa.json"), "utf8"));
    const tools = JSON.parse(fs.readFileSync(path.join(root, "config", "herramientas.json"), "utf8"));
    const used = [prices.pagina, ...pac.fuentes.map((s) => s.url), ...pac.fuentes.filter((s) => s.pdf).map((s) => s.pdf), ...tools.grupos.flatMap((g) => g.enlaces.map((l) => l.url))];
    for (const url of used) assert.ok(urls.has(url), `Falta en Fuentes: ${url}`);
    assert.ok([...urls].some((u) => /diptico-pac-2026/i.test(u)));
    assert.ok([...urls].some((u) => /pago-anticipado|pagos-anticipados/i.test(u)));
    assert.ok([...urls].some((u) => /precios-medios-nacionales/i.test(u)));
  } finally {
    server.close();
  }
});

// ---------- La extracción no inventa ----------

test("si falta el dato, no se inventa (plazo, importe, organismo)", () => {
  const aid = aidFromText("La Consejería informa de una jornada técnica sobre el cultivo de la vid.");
  assert.equal(aid.closesAt, null);
  assert.equal(aid.opensAt, null);
  assert.equal(aid.amount, null);
  assert.equal(aid.maxAmount, null);
  assert.equal(aid.organism, null);
  assert.deepEqual(aid.funds, []);
  assert.equal(deadlineInfo(aid, "2026-10-22").label, "Plazo no indicado");
  // Fecha sin año: no se adivina el año.
  assert.equal(extractDeadline("Plazo de solicitud: hasta el 30 de abril.").closesAt, null);
  // Fecha imposible: no se corrige.
  assert.equal(extractDeadline("Plazo de solicitud hasta el 31 de febrero de 2026.").closesAt, null);
  // Fecha sin contexto de plazo (p. ej. fecha de un pago): no es un plazo.
  assert.equal(extractDeadline("El pago se hará el 30 de noviembre de 2026.").closesAt, null);
});

test("plazo dudoso (varias fechas de cierre) → «Ver en la convocatoria oficial»", () => {
  const text = "Plazo de presentación hasta el 30 de abril de 2026 para la primera convocatoria y hasta el 30 de junio de 2026 para la segunda.";
  const deadline = extractDeadline(text);
  assert.equal(deadline.closesAt, null);
  assert.equal(deadline.ambiguous, true);
  const aid = aidFromText(text);
  assert.equal(aid.deadlineAmbiguous, true);
  assert.equal(deadlineInfo(aid, "2026-03-01").label, "Ver en la convocatoria oficial");
  // Una lectura posterior más corta no puede «rellenar» la fecha dudosa.
  const merged = mergeAid(aid, aidFromText("Plazo de presentación hasta el 30 de abril de 2026."));
  assert.equal(merged.closesAt, null);
  assert.equal(merged.deadlineAmbiguous, true);
  // Una fecha de ejecución no se confunde con el plazo de solicitud.
  const exec = extractDeadline("Plazo de solicitud: hasta el 30 de abril de 2026. Las actuaciones podrán ejecutarse hasta el 31 de diciembre de 2027.");
  assert.equal(exec.closesAt, "2026-04-30");
  assert.equal(exec.ambiguous, false);
});

test("varios importes distintos → no se elige ninguno", () => {
  const info = extractAmountInfo("Ayuda de 500 € por hectárea con un máximo de 10.000 € por explotación.");
  assert.equal(info.amount, null);
  assert.equal(info.ambiguous, true);
  const details = extractDetails("La ayuda máxima será de 3.000 € y en ningún caso no superará los 5.000 €.");
  assert.equal(details.maxAmount, null);
  assert.equal(details.maxAmountAmbiguous, true);
  const single = extractAmountInfo("Ayuda de 500 euros por beneficiario.");
  assert.equal(single.ambiguous, false);
  assert.match(single.amount, /500 euros/);
});

test("el organismo solo se toma si el texto dice que convoca, ordena o resuelve", () => {
  assert.equal(extractDetails("La Consejería de Agricultura informa de las heladas.").organism, null);
  assert.equal(extractDetails("Orden de la Consejería de Agricultura, Ganadería y Desarrollo Rural, por la que se convocan ayudas.").organism, "Consejería de Agricultura, Ganadería y Desarrollo Rural");
});

test("solo con fecha de apertura pasada no se afirma que esté abierta", () => {
  assert.notEqual(statusOf({ opensAt: "2026-01-10" }, "2026-10-22"), "abierta");
  assert.equal(statusOf({ opensAt: "2026-01-10", closesAt: "2026-12-01" }, "2026-10-22"), "abierta");
});

// ---------- «Por qué te puede interesar» ----------

test("«Por qué te puede interesar» no afirma requisitos ni da consejos", () => {
  const item = { title: "Ayudas al cereal en Salamanca", summary: "", sectors: ["agricultura"], sectorEvidence: { agricultura: ["cereal"] }, aid: { closesAt: "2026-10-25", who: "Agricultores profesionales" } };
  const why = whyForYou(item, { sector: "agricultura", zone: "mi-zona", crops: ["cereal"], water: ["secano"] });
  const all = [...why.reasons, ...why.warnings].join(" ");
  assert.doesNotMatch(all, /tu sector|aplica|cumples|puedes pedir|te corresponde|no lo dejes|vale para/i);
  for (const word of why.mentions) assert.ok(`${item.title} ${item.aid.who}`.toLowerCase().includes(word.toLowerCase()), word);
  // «secano» no aparece en el texto: no se cita.
  assert.ok(!why.mentions.includes("secano"));
  // Sector deducido sin palabra (solo por «PAC»): no se cita.
  const pac = whyForYou({ title: "Información PAC 2026", sectors: ["agricultura", "ganaderia"], sectorEvidence: {}, aid: {} }, { sector: "ganaderia" });
  assert.deepEqual(pac.mentions, []);
});

// ---------- Calendario PAC ----------

test("cada hito de la PAC lleva fuente con enlace y cita literal; los aproximados van marcados", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "config", "pac-calendario.json"), "utf8"));
  for (const hito of config.hitos) {
    assert.ok(Number.isInteger(hito.fuente) && /^https:\/\//.test(config.fuentes[hito.fuente].url), hito.id);
    assert.ok(Array.isArray(hito.citas) && hito.citas.length > 0, `${hito.id} sin citas`);
    for (const cita of hito.citas) {
      assert.ok(cita.texto && cita.texto.length > 10);
      assert.ok(/^https:\/\//.test(config.fuentes[cita.fuente].url));
    }
    const monthOnly = /^\d{4}-\d{2}$/.test(hito.desde);
    if (monthOnly) assert.equal(hito.desdeOrientativa, true, `${hito.id} debe ir marcado orientativa`);
  }
  const timeline = pacTimeline(config, "2026-10-22");
  assert.equal(timeline.milestones.length, config.hitos.length);
  for (const item of timeline.milestones) {
    assert.ok(item.source && item.quotes.length);
    if (item.fromApprox && item.state === "proximo") assert.match(item.countdown, /orientativa/);
  }
  // Un hito sin cita no se muestra.
  const broken = pacTimeline({ fuentes: config.fuentes, hitos: [{ id: "x", titulo: "x", desde: "2026-11-01", hasta: "2026-11-02", fuente: 0 }] }, "2026-10-22");
  assert.equal(broken.milestones.length, 0);
  // El .ics de la PAC no añade frases que no dicen las fuentes.
  assert.doesNotMatch(buildIcs({ title: "Anticipo", date: "2026-11-30", kind: "pac" }), /Cada comunidad aut/);
});

// ---------- Precios ----------

test("precios: sin unidad en la etiqueta oficial no hay producto (no se supone €/t)", () => {
  const rows = [
    ["", "SECTOR", "PRODUCTOS AGRARIOS", "Semana 40", "Semana 41"],
    ["", "", "", "28/09-04/10", "05/10-11/10"],
    ["CEREALES", "(1)", "Trigo blando (€/t)", 240, 249.12],
    ["", "(1)", "Cebada pienso", 230, 236.6],
    ["Posición comercial: (1) Salida de almacén cargado; (2) Granel sobre almacén agricultor/cooperativa"],
  ];
  const products = [
    { id: "trigo", nombre: "Trigo blando", grupo: "Cereales", patron: "^Trigo blando" },
    { id: "cebada", nombre: "Cebada pienso", grupo: "Cereales", patron: "^Cebada pienso" },
  ];
  const parsed = parsePriceSheet(rows, products, 2026);
  assert.deepEqual(parsed.items.map((item) => item.id), ["trigo"]);
  assert.equal(parsed.items[0].unit, "€/t");
  assert.equal(parsed.items[0].sheetLabel, "Trigo blando (€/t)");
  assert.equal(parsed.items[0].position, "Salida de almacén cargado");
  assert.equal(parsed.weekHeader, "Semana 41");
  assert.equal(parsed.weekLabel, "05/10-11/10");
  assert.equal(parsed.rangeComputed, true);
  assert.deepEqual(positionNotes(rows), { "(1)": "Salida de almacén cargado", "(2)": "Granel sobre almacén agricultor/cooperativa" });
  const src = fs.readFileSync(path.join(root, "lib", "prices.js"), "utf8");
  assert.doesNotMatch(src, /\|\|\s*"€\/t"/);
});

// ---------- Sin datos de ejemplo en producción ----------

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

test("no hay datos de ejemplo, semillas ni simulaciones en lib/, public/, config/ ni server.js", () => {
  const files = [...walk(path.join(root, "lib")), ...walk(path.join(root, "public")), ...walk(path.join(root, "config")), path.join(root, "server.js")]
    .filter((file) => /\.(js|json|html|css)$/.test(file));
  const banned = /\b(seed(?:Data|Items)?|mock(?:ed|s)?|fixtures?|fake|dummy|lorem ipsum|datos de ejemplo|ayuda de ejemplo|sampleItems|demoItems)\b/i;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, banned, path.relative(root, file));
  }
  // Ningún texto fijo de resumen inventado en la recogida.
  const collect = fs.readFileSync(path.join(root, "lib", "collect.js"), "utf8");
  assert.doesNotMatch(collect, /summary:\s*"[^"]+"/);
  const classify = fs.readFileSync(path.join(root, "lib", "classify.js"), "utf8");
  assert.doesNotMatch(classify, /\|\|\s*"Castilla y León"/);
});

test("las herramientas solo llevan cita literal, nombre, organismo y enlace oficial", () => {
  const tools = JSON.parse(fs.readFileSync(path.join(root, "config", "herramientas.json"), "utf8"));
  for (const group of tools.grupos) {
    for (const link of group.enlaces) {
      assert.match(link.url, /^https:\/\//);
      assert.ok(link.nombre && link.organismo);
      assert.equal(link.para, undefined, `${link.nombre}: «para» era una paráfrasis`);
      assert.equal(link.aviso, undefined, `${link.nombre}: «aviso» era un consejo propio`);
    }
  }
});

test("«Menciona» cita palabras completas del texto oficial, no raíces", async () => {
  const { whyForYou } = await import("../lib/aid-view.js");
  const { sectorEvidence } = await import("../lib/classify.js");
  const text = "Actividades de apoyo a la agricultura, a la ganadería y de preparación posterior a la cosecha";
  const evidence = sectorEvidence(text);
  const words = Object.values(evidence).flat();
  assert.ok(words.length > 0);
  for (const word of words) assert.match(text, new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, "u"), word);
  const result = whyForYou({ title: text, summary: "", sectorEvidence: evidence }, { sector: "agricultura", crops: [], water: [] });
  assert.ok(result.mentions.length > 0);
  for (const word of result.mentions) assert.match(text, new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, "u"), word);
});
