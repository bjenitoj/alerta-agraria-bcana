import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as places from "../lib/places.js";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const code = appJs.slice(appJs.indexOf("const PRICE_SOURCES = ["), appJs.indexOf("let priceSource = effectivePriceSource();"));
const make = (choice) => new Function("normalizePlace", "provinceOf", "comarcaOf", "ccaaOf", "escapeHtml", "titleCase", "localStorage", "prefs",
  `const PRICE_SOURCE_KEY = "k"; ${code}; return { priceSourcesFor, effectivePriceSource, priceLevelNote };`)(
  places.normalizePlace, places.provinceOf, places.comarcaOf, places.ccaaOf, (t) => String(t), (t) => t,
  { getItem: () => choice }, {});
const SAL = { ccaa: ["es-cl"], province: ["37"] };
const LEDESMA = { ccaa: ["es-cl"], province: ["37"], comarca: ["3702"] };
const ZAM = { ccaa: ["es-cl"], province: ["49"] };
const SALZAM = { ccaa: ["es-cl"], province: ["37", "49"] };

test("v5.9 Precios por zona: Salamanca → Lonja (provincia); MAPA siempre", () => {
  const f = make(null);
  assert.deepEqual(f.priceSourcesFor(SAL).map((s) => s.id), ["mapa", "lonja"]);
  assert.equal(f.effectivePriceSource(SAL), "lonja");
  assert.match(f.priceLevelNote(SAL), /Precios de la Lonja de Salamanca \(provincia\)/);
  assert.match(f.priceLevelNote(LEDESMA), /No hay precios propios de la comarca LEDESMA: se usan los de Lonja de Salamanca/);
});

test("v5.9 Precios por zona: Zamora / CyL / España → MAPA nacional, con aviso", () => {
  const f = make("lonja");
  assert.deepEqual(f.priceSourcesFor(ZAM).map((s) => s.id), ["mapa"], "la Lonja de Salamanca no se ofrece a Zamora");
  assert.equal(f.effectivePriceSource(ZAM), "mapa");
  assert.match(f.priceLevelNote(ZAM), /nacionales.*No hay precios oficiales propios que podamos leer de Zamora; ahí valen los nacionales del MAPA/);
  assert.match(f.priceLevelNote({ ccaa: ["es-cl"] }), /de Castilla y León;/);
  assert.doesNotMatch(f.priceLevelNote({}), /No hay/);
  assert.match(f.priceLevelNote({}), /nacionales del Ministerio \(MAPA\), para toda España/);
  assert.equal(make("mapa").effectivePriceSource(SAL), "mapa", "si eliges MAPA, se respeta");
});

test("v5.9 Precios con 2 provincias: se ofrecen todas las fuentes con su nivel y elige el usuario", () => {
  const f = make(null);
  assert.deepEqual(f.priceSourcesFor(SALZAM).map((s) => s.id), ["mapa", "lonja"]);
  assert.equal(f.effectivePriceSource(SALZAM), "lonja", "por defecto la más concreta");
  assert.match(f.priceLevelNote(SALZAM), /Hay más de una fuente para tu zona: elige en «Fuente»\..*de Zamora/);
  assert.match(appJs, /function priceSourceLabel\(source\)[\s\S]*?PRICE_LEVEL_TEXT\[source\.level\]/);
});
