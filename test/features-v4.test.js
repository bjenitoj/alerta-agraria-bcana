import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { extractDeadline } from "../lib/preferences.js";
import { aidFromBdns, aidFromText } from "../lib/aid.js";
import { buildIcs, closesWithin, deadlineInfo, extractDetails, icsHref, whatsappUrl, whyForYou } from "../lib/aid-view.js";
import { pacTimeline } from "../lib/pac-calendar.js";
import { readFirstSheet } from "../lib/xlsx-lite.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alerta-v4-"));
process.env.DATA_DIR = tmp;
const { findXlsxLink, getPrices, isoWeekRange, parsePriceSheet, resetPriceCache } = await import("../lib/prices.js");

// ---------- Plazos ----------

test("extrae la fecha de cierre en los formatos de los boletines", () => {
  const cases = [
    ["El plazo de presentación de solicitudes será hasta el 30/11/2026.", null, "2026-11-30"],
    ["Plazo: las solicitudes podrán presentarse hasta el día 15 de diciembre de 2026.", null, "2026-12-15"],
    ["Fecha límite de presentación de solicitudes: 05-01-2027", null, "2027-01-05"],
    ["El plazo de presentación de solicitudes finalizará el 20 de noviembre de 2026.", null, "2026-11-20"],
    ["Plazo de presentación: del 1 al 30 de abril de 2026", "2026-04-01", "2026-04-30"],
    ["Plazo de solicitud del 15 de octubre al 4 de noviembre de 2026", "2026-10-15", "2026-11-04"],
    ["Plazo de solicitudes: 01/10/2026 al 31/10/2026", "2026-10-01", "2026-10-31"],
  ];
  for (const [text, opensAt, closesAt] of cases) {
    const result = extractDeadline(text);
    assert.equal(result.closesAt, closesAt, text);
    assert.equal(result.opensAt, opensAt, text);
  }
});

test("un plazo relativo queda como nota y no se inventa la fecha", () => {
  const result = extractDeadline("El plazo de presentación de solicitudes será de quince días hábiles contados a partir del día siguiente al de la publicación del extracto en el BOCYL.");
  assert.equal(result.closesAt, null);
  assert.match(result.deadlineNote, /quince días hábiles/);
  assert.equal(deadlineInfo(result, "2026-10-22").kind, "relative");
});

test("sin palabras de plazo no se saca fecha (p. ej. pagos de la PAC)", () => {
  const result = extractDeadline("El anticipo puede llegar hasta el 75 % antes del 30 de noviembre de 2026.");
  assert.equal(result.closesAt, null);
});

test("etiqueta Cierra en X días / Cerrada / Plazo no indicado", () => {
  const today = "2026-10-22";
  assert.equal(deadlineInfo({ closesAt: "2026-10-30" }, today).label, "Cierra en 8 días");
  assert.equal(deadlineInfo({ closesAt: "2026-10-23" }, today).label, "Cierra mañana");
  assert.equal(deadlineInfo({ closesAt: "2026-10-22" }, today).label, "Cierra hoy");
  assert.equal(deadlineInfo({ closesAt: "2026-10-01" }, today).label, "Cerrada");
  assert.equal(deadlineInfo({}, today).label, "Plazo no indicado");
  assert.equal(deadlineInfo({ opensAt: "2026-11-02", closesAt: "2026-11-30" }, today).label, "Abre en 11 días");
  assert.equal(deadlineInfo({ deadlineNote: "Sin plazo de solicitud" }, today).label, "Sin plazo de solicitud");
  assert.equal(closesWithin({ closesAt: "2026-11-05" }, today, 15), true);
  assert.equal(closesWithin({ closesAt: "2026-11-06" }, today, 15), false);
  assert.equal(closesWithin({ closesAt: "2026-10-01" }, today, 15), false);
});

// ---------- Detalles y motivos ----------

test("saca organismo, fondo, código BDNS e importe máximo solo si están", () => {
  const found = extractDetails("Orden de la Consejería de Agricultura, Ganadería y Desarrollo Rural, por la que se convocan ayudas cofinanciadas por el FEADER. BDNS (Identif.): 812345. La ayuda no superará los 100.000 € por beneficiario.");
  assert.equal(found.organism, "Consejería de Agricultura, Ganadería y Desarrollo Rural");
  assert.deepEqual(found.funds, ["FEADER"]);
  assert.equal(found.bdnsCode, "812345");
  assert.equal(found.maxAmount, "100.000 €");
  const none = extractDetails("Nota informativa sobre la campaña de siembra.");
  assert.deepEqual(none, { organism: null, funds: [], bdnsCode: null, maxAmount: null, maxAmountAmbiguous: false });
});

test("la ficha BDNS da organismo y fondos", () => {
  const aid = aidFromBdns({
    organo: { nivel1: "CASTILLA Y LEÓN", nivel2: "CONSEJERÍA DE AGRICULTURA, GANADERÍA Y DESARROLLO RURAL", nivel3: null },
    fondos: [{ descripcion: "FEADER - Fondo Europeo Agrícola de Desarrollo Rural" }],
    mrr: false,
    fechaFinSolicitud: "2026-11-30",
  });
  assert.equal(aid.organism, "Consejería de Agricultura, Ganadería y Desarrollo Rural");
  assert.deepEqual(aid.funds, ["FEADER"]);
  assert.equal(aid.closesAt, "2026-11-30");
  const text = aidFromText("Ayuda. Plazo de presentación hasta el 30/11/2026. Financiada por el Plan de Recuperación, Next Generation EU.");
  assert.deepEqual(text.funds, ["Next Generation EU (MRR)"]);
});

test("«Por qué te puede interesar» solo cita palabras literales del texto oficial", () => {
  const item = {
    title: "Ayudas para el cultivo de cereal de secano en Salamanca",
    summary: "",
    sectors: ["agricultura"],
    sectorEvidence: { agricultura: ["cultivo"] },
    crops: ["cereal"],
    water: "secano",
    zone: "salamanca",
    aid: { closesAt: "2026-10-30" },
  };
  const why = whyForYou(item, { sector: "agricultura", zone: "mi-zona", water: ["secano"], crops: ["cereal"] });
  assert.deepEqual(why.mentions, ["cultivo", "cereal", "secano", "Salamanca"]);
  assert.equal(why.reasons[0], "Menciona: «cultivo», «cereal», «secano», «Salamanca»");
  for (const word of why.mentions) assert.ok(item.title.includes(word), word);
  assert.equal(why.match, true);
  const other = whyForYou({ title: "Ayudas a la flota pesquera", sectors: ["pesca"], aid: {} }, { sector: "agricultura" });
  assert.equal(other.match, false);
  assert.deepEqual(other.reasons, []);
  assert.ok(other.warnings.length > 0);
});

// ---------- Calendario .ics y WhatsApp ----------

test("el .ics es válido, de día completo y con aviso", () => {
  const ics = buildIcs({ title: "Ayuda al cereal; secano, girasol", date: "2026-10-30", url: "https://bocyl.jcyl.es/x", now: new Date("2026-10-22T10:00:00Z") });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(ics, /\r\nDTSTART;VALUE=DATE:20261030\r\n/);
  assert.match(ics, /\r\nDTEND;VALUE=DATE:20261031\r\n/);
  assert.match(ics, /SUMMARY:Cierra plazo: Ayuda al cereal\\; secano\\, girasol/);
  assert.match(ics, /TRIGGER:-P2D/);
  assert.match(ics, /URL:https:\/\/bocyl\.jcyl\.es\/x/);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75, line);
  const unfolded = ics.replace(/\r\n /g, "");
  assert.match(unfolded, /Información orientativa\. Consulta siempre la publicación oficial\./);
  assert.throws(() => buildIcs({ title: "x", date: "2026-02-30" }));
  const pac = buildIcs({ title: "Primer saldo", date: "2026-12-01", kind: "pac" });
  assert.match(pac, /SUMMARY:PAC: Primer saldo/);
});

test("enlaces de calendario y WhatsApp", () => {
  const item = { title: "Ayuda jóvenes", url: "https://www.infosubvenciones.es/x?a=1", aid: { closesAt: "2026-11-05" } };
  const href = icsHref(item);
  assert.match(href, /^\/calendario\.ics\?/);
  assert.match(href, /fecha=2026-11-05/);
  assert.equal(icsHref({ title: "x", aid: {} }), "");
  const wa = whatsappUrl(item, "2026-10-22", "https://ejemplo.test/");
  assert.ok(wa.startsWith("https://wa.me/?text="));
  const text = decodeURIComponent(wa.split("text=")[1]);
  assert.match(text, /Ayuda jóvenes/);
  assert.match(text, /Cierra en 14 días \(cierra el 05\/11\/2026\)/);
  assert.match(text, /Fuente oficial: https:\/\/www\.infosubvenciones\.es\/x\?a=1/);
  assert.match(text, /Información orientativa/);
});

// ---------- Calendario de la PAC ----------

const pacConfig = JSON.parse(fs.readFileSync(path.join(root, "config", "pac-calendario.json"), "utf8"));

test("calendario PAC 2026 con fechas verificadas y fuentes", () => {
  const byId = Object.fromEntries(pacConfig.hitos.map((hito) => [hito.id, hito]));
  assert.equal(byId.anticipo.desde, "2026-10-16");
  assert.equal(byId.anticipo.hasta, "2026-11-30");
  assert.equal(byId.saldo.desde, "2026-12-01");
  assert.equal(byId.final.desde, "2027-05");
  assert.equal(byId.final.hasta, "2027-06-30");
  assert.equal(byId.residual.hasta, "2027-10-15");
  assert.ok(pacConfig.fuentes.every((source) => /^https:\/\/www\.(mapa|fega|lamoncloa)\.gob\.es\//.test(source.url)));
});

test("cuenta atrás de la PAC según el día", () => {
  const during = pacTimeline(pacConfig, "2026-10-22");
  assert.equal(during.next.id, "anticipo");
  assert.equal(during.next.state, "en_curso");
  assert.equal(during.next.daysToEnd, 39);
  assert.match(during.next.countdown, /Quedan 39 días/);
  const before = pacTimeline(pacConfig, "2026-10-10");
  assert.equal(before.next.id, "anticipo");
  assert.equal(before.next.countdown, "Empieza en 6 días");
  const december = pacTimeline(pacConfig, "2026-12-01");
  assert.equal(december.milestones.find((item) => item.id === "anticipo").state, "pasado");
  assert.equal(december.next.id, "saldo");
  // El pago completo solo tiene mes («en el mes de mayo»): no se cuentan días hasta un día inventado.
  const april = pacTimeline(pacConfig, "2027-04-20");
  const final = april.milestones.find((item) => item.id === "final");
  assert.equal(final.state, "proximo");
  assert.equal(final.daysToStart, null);
  assert.equal(final.countdown, "Empieza: mayo de 2027 (orientativa)");
  const may = pacTimeline(pacConfig, "2027-05-01");
  assert.equal(may.milestones.find((item) => item.id === "final").state, "en_curso");
  const after = pacTimeline(pacConfig, "2027-11-01");
  assert.equal(after.next, null);
});

// ---------- Precios del MAPA ----------

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text, "utf8");
    const data = zlib.deflateRawSync(raw);
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(raw), 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(raw), 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

const strings = ["Semana 40", "Semana 41", "28/09-04/10", "05/10-11/10", "Trigo blando (€/t)", "Maíz grano (€/t) ", "Garbanzos (€/t)", "-"];
const sst = `<sst>${strings.map((text) => `<si><t>${text.replace(/&/g, "&amp;")}</t></si>`).join("")}</sst>`;
const sheet = `<worksheet><sheetData>
<row r="7"><c r="C7" t="inlineStr"><is><t>Producto</t></is></c><c r="D7" t="s"><v>0</v></c><c r="E7" t="s"><v>1</v></c></row>
<row r="8"><c r="D8" t="s"><v>2</v></c><c r="E8" t="s"><v>3</v></c></row>
<row r="9"><c r="C9" t="s"><v>4</v></c><c r="D9"><v>247.97</v></c><c r="E9"><v>249.123</v></c></row>
<row r="13"><c r="C13" t="s"><v>5</v></c><c r="D13"><v>254.27</v></c><c r="E13"><v>253.44</v></c></row>
<row r="43"><c r="C43" t="s"><v>6</v></c><c r="D43"><v>780</v></c><c r="E43" t="s"><v>7</v></c></row>
</sheetData></worksheet>`;
const xlsx = makeZip({ "xl/sharedStrings.xml": sst, "xl/worksheets/sheet1.xml": sheet });

test("lee el Excel del MAPA y saca la última semana sin inventar precios", () => {
  const rows = readFirstSheet(xlsx);
  const products = [
    { id: "trigo_blando", nombre: "Trigo blando", grupo: "Cereales", patron: "^Trigo blando" },
    { id: "maiz", nombre: "Maíz grano", grupo: "Cereales", patron: "^Ma[ií]z grano" },
    { id: "garbanzos", nombre: "Garbanzos", grupo: "Leguminosas", patron: "^Garbanzos" },
    { id: "lentejas", nombre: "Lentejas", grupo: "Leguminosas", patron: "^Lentejas" },
  ];
  const data = parsePriceSheet(rows, products, 2026);
  assert.equal(data.week, 41);
  assert.equal(data.from, "2026-10-05");
  assert.equal(data.to, "2026-10-11");
  const trigo = data.items.find((item) => item.id === "trigo_blando");
  assert.equal(trigo.value, 249.12);
  assert.equal(trigo.change, 1.15);
  assert.equal(trigo.unit, "€/t");
  const garbanzos = data.items.find((item) => item.id === "garbanzos");
  assert.equal(garbanzos.value, null);
  assert.equal(garbanzos.lastValue, 780);
  assert.equal(data.items.some((item) => item.id === "lentejas"), false);
});

test("semanas ISO y enlace del Excel", () => {
  assert.deepEqual(isoWeekRange(2026, 1), { from: "2025-12-29", to: "2026-01-04" });
  const html = '<a href="/dam/mapa/x/precios_medios_nacionales_2025-s52.xlsx">2025</a><a href="/dam/mapa/x/precios_medios_nacionales_2026-s36.xlsx">2026</a>';
  assert.equal(findXlsxLink(html, "https://www.mapa.gob.es/es/a/", 2026), "https://www.mapa.gob.es/dam/mapa/x/precios_medios_nacionales_2026-s36.xlsx");
});

test("los precios usan caché y aguantan si el MAPA falla", async () => {
  resetPriceCache();
  const now = new Date("2026-10-22T08:00:00Z");
  let calls = 0;
  const good = async () => { calls += 1; return { ok: true, week: 41, items: [{ id: "trigo_blando", value: 249.12 }], fetchedAt: now.toISOString() }; };
  const first = await getPrices({ now, loader: good });
  assert.equal(first.ok, true);
  assert.equal(first.stale, false);
  await getPrices({ now: new Date(now.getTime() + 3600000), loader: good });
  assert.equal(calls, 1);
  assert.ok(fs.existsSync(path.join(tmp, "precios-cache.json")));
  const broken = async () => { throw new Error("HTTP 503"); };
  const later = await getPrices({ now: new Date(now.getTime() + 13 * 3600000), loader: broken });
  assert.equal(later.ok, true);
  assert.equal(later.stale, true);
  assert.equal(later.items[0].value, 249.12);
  resetPriceCache();
  fs.rmSync(path.join(tmp, "precios-cache.json"));
  const nothing = await getPrices({ now, loader: broken });
  assert.equal(nothing.ok, false);
  assert.deepEqual(nothing.items, []);
  assert.match(nothing.pageUrl, /mapa\.gob\.es/);
  assert.ok(nothing.explanation);
});
