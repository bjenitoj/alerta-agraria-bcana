import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLonjaPrices, lonjaSessions, parseLonjaTable, resetLonjaCache } from "../lib/lonja.js";
import { publicSourceView } from "../lib/config.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// Copias reales de la tabla oficial (sesión del 26/10/2026), descargadas el 28/10/2026.
const fixture = (name) => fs.readFileSync(path.join(root, "test", "fixtures", `lonja-salamanca-${name}-2026-10-26.html`), "latin1");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

test("v5.7 Lonja: fecha de sesión del selector oficial", () => {
  assert.deepEqual(lonjaSessions(fixture("cereales")).slice(0, 3), ["26/10/2026", "19/10/2026", "13/10/2026"]);
});

test("v5.7 Lonja cereales: valores literales de la tabla real (26/10/2026)", () => {
  const items = parseLonjaTable(fixture("cereales"), "Cereales");
  const by = (name) => items.find((item) => item.name === name);
  assert.equal(items.length, 18);
  assert.deepEqual({ ...by("Trigo Blando") }, { mesa: "Cereales", group: "Cereales", name: "Trigo Blando", previous: "238,00", diff: "0,00", last: "238,00", unit: "€ / t", quoted: true, value: 238, change: 0 });
  assert.equal(by("Maíz, (14º)").last, "246,00");
  assert.equal(by("Maíz, (14º)").change, -2);
  assert.equal(by("Cebada P. E. (+64)").value, 232);
  assert.equal(by("Lenteja armuña (I.G.P.) (de consumo humano)").last, "1.100,00");
  assert.equal(by("Lenteja armuña (I.G.P.) (de consumo humano)").value, 1100);
  assert.equal(by("Garbanzo Pedrosillano (de consumo humano)").change, 50);
  // «0,00» en Último = sin cotización (S. / C. en la tablilla): no hay precio ni variación inventados.
  const girasol = by("Girasol (9-2-44)");
  assert.equal(girasol.quoted, false);
  assert.equal(girasol.value, null);
  assert.equal(girasol.change, null);
});

test("v5.7 Lonja ganado: unidades y horquillas tal cual (ovino y bovino de vida)", () => {
  const ovino = parseLonjaTable(fixture("ovino"), "Ovino");
  assert.equal(ovino.find((item) => item.name === "Extra").last, "10,25");
  assert.equal(ovino.find((item) => item.name === "Extra").unit, "€ / kg vivo");
  const vida = ovino.find((item) => item.name === "Vida");
  assert.equal(vida.last, "150,00 / 175,00");
  assert.equal(vida.unit, "€ / ud.");
  assert.equal(vida.value, null, "una horquilla no se convierte en un número");
  const bovino = parseLonjaTable(fixture("bovino-vida"), "Bovino de vida");
  assert.equal(bovino.find((item) => item.name === "Extra (machos)").last, "5,82");
  assert.equal(bovino.find((item) => item.name === "Extra (hembras)").last, "5,36");
});

test("v5.7 Lonja: con caché y sin inventar si falla", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lonja-"));
  const old = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  try {
    resetLonjaCache();
    const fail = await getLonjaPrices({ loader: async () => { throw new Error("caída"); } });
    assert.equal(fail.ok, false);
    assert.deepEqual(fail.items, []);
    assert.match(fail.explanation, /no enseñamos ninguno/);
    const items = parseLonjaTable(fixture("cereales"), "Cereales");
    const good = await getLonjaPrices({ force: true, loader: async (now) => ({ ok: true, session: "26/10/2026", items, fetchedAt: now.toISOString() }) });
    assert.equal(good.ok, true);
    assert.equal(good.session, "26/10/2026");
    assert.match(good.tableUrl, /^https:\/\/www\.lasalina\.es\/Aplicaciones\/lonja\/Cotizaciones\.jsp$/);
    const stale = await getLonjaPrices({ force: true, loader: async () => { throw new Error("caída"); } });
    assert.equal(stale.ok, true);
    assert.equal(stale.stale, true);
  } finally {
    resetLonjaCache();
    if (old === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = old;
  }
});

test("v5.7 Precios: desplegable de fuente (MAPA por defecto, recuerda la elección) y Lonja en Fuentes oficiales", () => {
  assert.match(appJs, /const PRICE_SOURCE_KEY = "alerta_precios_fuente";/);
  assert.match(appJs, /localStorage\.getItem\(PRICE_SOURCE_KEY\) === "lonja" \? "lonja" : "mapa"/);
  assert.match(appJs, /\{ id: "mapa", label: "Ministerio \(MAPA\)" \},\s*\{ id: "lonja", label: "Lonja de Salamanca" \}/);
  assert.match(appJs, /localStorage\.setItem\(PRICE_SOURCE_KEY, priceSource\)/);
  assert.match(appJs, /<thead><tr><th>Producto<\/th><th>Precio<\/th><th>Variación<\/th><\/tr><\/thead>/);
  assert.match(appJs, /Sesión del \$\{escapeHtml\(lonjaData\.session/);
  assert.match(serverJs, /app\.get\("\/api\/precios\/lonja"/);
  const lonja = publicSourceView({}).sources.find((source) => source.id === "lonja_salamanca");
  assert.equal(lonja.status, "precios", "ya no sale en «Preparadas, aún no consultadas»");
  assert.match(indexHtml, /\?v=44/);
});

test("v5.7 sin pestañas «Jóvenes» ni «Noticias»; «noticias» fuera de Mis preferencias; valores viejos no rompen", async () => {
  const { INFO_TYPES, DEFAULT_PREFS, normalizePrefs, itemInfoTypes } = await import("../lib/preferences.js");
  const tabs = appJs.slice(appJs.indexOf("function renderTabs"), appJs.indexOf("function render()"));
  assert.doesNotMatch(tabs, /\["jovenes"|\["noticias"/);
  assert.match(tabs, /\["ayudas", "Ayudas"\]/);
  assert.doesNotMatch(tabs, /\["pac", "PAC"\]/, "v5.7: PAC está dentro de Ayudas");
  assert.doesNotMatch(appJs, /tab === "jovenes"|tab === "noticias"|noticias: "noticias"/);
  assert.match(appJs, /if \(active === "jovenes" \|\| active === "noticias"\) active = "inicio";/);
  assert.ok(!INFO_TYPES.some((type) => type.id === "noticias"));
  assert.ok(!DEFAULT_PREFS.infoOrder.includes("noticias"));
  const old = normalizePrefs({ info: ["noticias"], infoOrder: ["noticias", "pac"] });
  assert.deepEqual(old.info, DEFAULT_PREFS.info, "solo «noticias» guardado → por defecto");
  assert.ok(!old.infoOrder.includes("noticias"));
  // Una pieza de Ayudas sigue en Ayudas aunque también fuera noticia.
  assert.deepEqual(itemInfoTypes({ category: "noticias_oficiales", infoTypes: ["ayudas", "noticias"] }), ["ayudas"]);
  assert.deepEqual(itemInfoTypes({ category: "jovenes_modernizacion", kind: "ayuda", infoTypes: ["noticias"] }), ["ayudas"]);
  assert.match(indexHtml, /\?v=44/);
});

test("v5.7 «solo abiertas» solo para ayudas; Normativa siempre y por fecha; Ayudas con bloques y chips de estado", () => {
  assert.match(appJs, /function shownByStatus\(item, today = madridTodayKey\(\)\) \{\s*return !isAidItem\(item\) \|\| isLiveAid\(item\.aid, today\);/);
  assert.match(appJs, /if \(!options\.allStatus && !shownByStatus\(item, today\)\) return false;/);
  assert.doesNotMatch(appJs.slice(appJs.indexOf("function baseItems")), /^\s*if \(!isLiveAid\(item\.aid, today\)\) return false;/m);
  assert.match(appJs, /tab === "normativa" \? byPublication\(filtered\)/);
  assert.doesNotMatch(appJs, /label: "Cerradas"/, "lo cerrado no se enseña nunca");
  assert.match(appJs, /filter\(\(item\) => aidStatusOf\(item, today\) !== "cerrada"\)/);
  for (const label of ["Abiertas", "Cierran pronto", "Próximas"]) assert.match(appJs, new RegExp(`label: "${label}"`));
  assert.match(appJs, /const AID_STATUS_KEY = "alerta_ayudas_estado_v1";/);
  assert.match(appJs, /return \(aidStatusChip = "abierta"\);/, "por defecto, Abiertas");
  assert.match(appJs, /\{ id: "pac", label: "Ayudas PAC" \},\s*\{ id: "otras", label: "Otras ayudas" \},/);
  assert.match(appJs, /if \(tab === "ayudas"\) return renderAyudas\(\);/);
  assert.match(appJs, /class="glance status-boxes"/);
  assert.match(indexHtml, /\?v=44/);
});
