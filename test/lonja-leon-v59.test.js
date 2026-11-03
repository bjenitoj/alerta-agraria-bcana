import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as places from "../lib/places.js";
import { getLeonPrices, leonLatestPosts, leonNumber, parseLeonTable, resetLeonCache, LONJA_LEON } from "../lib/lonja-leon.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fx = (name) => fs.readFileSync(path.join(dir, "fixtures", name), "utf8");
const mesa = (slug) => LONJA_LEON.mesas.find((m) => m.slug === slug);

test("v5.9 Lonja de León: cereales del 29/10/2026 tal como vienen, sin «S/C»", () => {
  const items = parseLeonTable(fx("lonja-leon-cereal-2026-10-29.html"), mesa("cereal"), "2026-10-29");
  assert.deepEqual(items.map((i) => [i.name, i.last, i.prev, i.change]), [
    ["Trigo Pienso", "228,00", "230,00", -2], ["Cebada", "222,00", "224,00", -2], ["Triticale", "218,00", "220,00", -2],
    ["Centeno", "197,00", "197,00", 0], ["Avena", "202,00", "202,00", 0],
  ]);
  assert.ok(items.every((i) => i.unit === "€/t" && i.sector === "agricultura" && i.date === "2026-10-29"));
  assert.ok(!items.some((i) => /ma[ií]z/i.test(i.name)), "Maíz S/C se deja fuera");
});

test("v5.9 Lonja de León: vacuno es ganadería, con unidad y subgrupo de la tabla", () => {
  const items = parseLeonTable(fx("lonja-leon-vacuno-2026-10-29.html"), mesa("carne-de-vacuno"), "2026-10-29");
  assert.ok(items.length > 5 && items.every((i) => i.sector === "ganaderia"));
  const frisones = items.find((i) => i.name === "Frisones");
  assert.equal(frisones.unit, "€/Unidad");
  assert.equal(frisones.last, "100,00");
  const canal = items.find((i) => i.unit === "€/Kg. Canal" && i.name === "O");
  assert.match(canal.group, /Hembras 180-200 kg/);
  assert.equal(canal.change, -0.05);
  assert.equal(leonNumber("1.100,00"), 1100);
  assert.equal(leonNumber("S/C*"), null);
});

test("v5.9 Lonja de León: última entrada de cada mesa en la página de cotizaciones", () => {
  const posts = leonLatestPosts(fx("lonja-leon-cotizaciones-2026-10-29.html"));
  const patata = posts.find((p) => p.slug === "patata");
  assert.equal(patata.date, "2026-10-29", "de dos sesiones de patata se toma la última");
  assert.equal(posts.find((p) => p.slug === "cereal").url, "https://www.lonjadeleon.es/lonja-cereal-29-10-2026/");
});

test("v5.9 Lonja de León: si falla y no hay copia, no hay precios; con copia, la última buena", async () => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "leon-"));
  resetLeonCache();
  const bad = await getLeonPrices({ force: true, loader: async () => { throw new Error("caída"); } });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.items, []);
  const items = parseLeonTable(fx("lonja-leon-cereal-2026-10-29.html"), mesa("cereal"), "2026-10-29");
  const good = await getLeonPrices({ force: true, loader: async (now) => ({ ok: true, session: "2026-10-29", items, links: [], fetchedAt: now.toISOString() }) });
  assert.equal(good.ok, true);
  const stale = await getLeonPrices({ force: true, loader: async () => { throw new Error("caída"); } });
  assert.equal(stale.stale, true);
  assert.equal(stale.items.length, 5);
  resetLeonCache();
  delete process.env.DATA_DIR;
});

const appJs = fs.readFileSync(path.join(dir, "..", "public", "app.js"), "utf8");
const serverJs = fs.readFileSync(path.join(dir, "..", "server.js"), "utf8");

test("v5.9 Lonja de León: fuente provincial de León en Precios y en /fuentes", () => {
  assert.match(appJs, /id: "lonja-leon", label: "Lonja de León", level: "provincia", ccaa: "es-cl", province: "24"/);
  assert.match(appJs, /priceSource === "lonja-leon" \? renderLeonPrices\(\)/);
  assert.match(serverJs, /app\.get\("\/api\/precios\/lonja-leon"/);
  assert.match(serverJs, /add\(\{ name: LONJA_LEON\.fuente/);
});

// Guía cuando la zona oculta avisos.
const code = appJs.slice(appJs.indexOf("const CYL_PROVINCES"), appJs.indexOf("function officialAlerts"));
const BUTTONS = [{ id: "aemet", label: "Tiempo" }, { id: "plagas", label: "Plagas" }, { id: "rasve", label: "Sanidad animal" }, { id: "incendios", label: "Incendios" }];
const { alertLimits, alertGuide } = new Function("normalizePlace", "provinceOf", "ccaaOf", "prefs", "ALERT_TYPE_BUTTONS", "escapeHtml",
  `${code}; return { alertLimits, alertGuide };`)(places.normalizePlace, places.provinceOf, places.ccaaOf, {}, BUTTONS, (s) => String(s));
const P = (ccaa = [], province = [], comarca = []) => ({ country: "es", ccaa, province, comarca });

test("v5.9 guía: solo Castilla y León → Tiempo y Sanidad animal piden provincia, con botón a Mis preferencias › Zona", () => {
  const l = alertLimits(P(["es-cl"]));
  assert.deepEqual(Object.keys(l.hidden).sort(), ["aemet", "rasve"]);
  assert.equal(l.hidden.aemet, "Marca tu provincia");
  assert.match(l.message, /Los avisos de Tiempo y Sanidad animal se publican por provincia\. Marca tu provincia en Mis preferencias para verlos\./);
  assert.match(alertGuide(l), /data-open-prefs="zona" data-zone-level="province"/);
});

test("v5.9 guía: solo España → todas ocultas, pide comunidad y provincia", () => {
  const l = alertLimits(P());
  assert.deepEqual(Object.keys(l.hidden).sort(), ["aemet", "incendios", "plagas", "rasve"]);
  assert.match(l.message, /Solo tienes marcado «España»/);
  assert.equal(l.level, "ccaa");
});

test("v5.9 guía: con provincia de Castilla y León no sale nada", () => {
  for (const place of [P(["es-cl"], ["37"]), P(["es-cl"], ["24"], ["2401"].filter(Boolean))]) {
    const l = alertLimits(place);
    assert.equal(l.message, "");
    assert.equal(alertGuide(l), "");
  }
});

test("v5.9 guía: botones con la pista en vez de 0 y aviso en la pantalla Alertas", () => {
  assert.match(appJs, /limits\.hidden\[entry\.id\]\s*\? `<strong class="alert-hint-mark"/);
  assert.match(appJs, /alertGuide\(limits\) \+\s*alertTypeButtons\(\)/);
  assert.match(appJs, /openPlaceBoxes\.add\(level\)/);
});
