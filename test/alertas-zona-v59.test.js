import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as places from "../lib/places.js";
import { normalizePrefs, forYou, placeLabel } from "../lib/preferences.js";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const code = appJs.slice(appJs.indexOf("const CYL_PROVINCES"), appJs.indexOf("function officialAlerts"));
const { alertInZone } = new Function("normalizePlace", "provinceOf", "ccaaOf", "prefs", `${code}; return { alertInZone };`)(places.normalizePlace, places.provinceOf, places.ccaaOf, {});
const P = (ccaa = [], province = [], comarca = []) => ({ country: "es", ccaa, province, comarca });
const SAL = P(["es-cl"], ["37"]);
const SAL2 = P(["es-cl"], ["37"], ["3703", "3704"]); // Salamanca + Peñaranda de Bracamonte
const ZAM = P(["es-cl"], ["49"]);
const SALZAM = P(["es-cl"], ["37", "49"]);
const CYL = P(["es-cl"]);
const ES = P();

test("v5.9 comarcas oficiales del MAPA: 349, Salamanca con sus 8", () => {
  const all = places.CCAA.flatMap((c) => c.provinces.flatMap((p) => p.comarcas));
  assert.equal(all.length, 349);
  assert.deepEqual(places.provinceOf("37").comarcas.map((c) => c.id), ["3701", "3702", "3703", "3704", "3705", "3706", "3707", "3708"]);
  assert.ok(all.every((c) => /^\d{4}$/.test(c.id) && places.provinceOf(c.id.slice(0, 2))));
  assert.match(places.PLACES_SOURCE.url, /observatorioregadio\.gob\.es/);
});

test("v5.9 zona múltiple: validada de arriba abajo; migración de lo guardado", () => {
  assert.deepEqual(places.normalizePlace({ ccaa: ["es-cl"], province: ["08", "37"], comarca: ["3702", "4901"] }), P(["es-cl"], ["37"], ["3702"]), "sin padres elegidos no vale");
  assert.deepEqual(places.normalizePlace({ ccaa: "es-cl", province: "37", comarca: "3702" }), P(["es-cl"], ["37"], ["3702"]), "valores sueltos → listas de 1");
  assert.deepEqual(normalizePrefs({}).place, SAL, "por defecto España › CyL › Salamanca");
  assert.deepEqual(normalizePrefs({ zone: "mi-zona" }).place, SAL);
  assert.deepEqual(normalizePrefs({ zone: "salamanca" }).place, SAL);
  assert.deepEqual(normalizePrefs({ zone: "cyl" }).place, CYL);
  assert.deepEqual(normalizePrefs({ zone: "nacional" }).place, ES);
  assert.deepEqual(normalizePrefs({ zone: "cyl", place: SAL2 }).place, SAL2, "el lugar nuevo manda");
  assert.equal(placeLabel(SAL2), "Salamanca (SALAMANCA, PEÑARANDA DE BRACAMONTE)");
  assert.equal(placeLabel(SALZAM), "Salamanca · Zamora");
});

test("v5.9 de abajo arriba en Ayudas/Normativa; nunca zonas hermanas ni lo de debajo", () => {
  const item = (zone) => ({ zone, sectors: ["agricultura"], infoTypes: ["ayudas"], kind: "ayuda" });
  const p = (place) => normalizePrefs({ sector: "agricultura", info: ["ayudas"], place });
  for (const z of ["nacional", "cyl", "salamanca"]) assert.equal(forYou(item(z), p(SAL2)), true, z);
  assert.equal(forYou(item("salamanca"), p(ZAM)), false, "hermana no elegida");
  assert.equal(forYou(item("cyl"), p(ZAM)), true);
  assert.equal(forYou(item("salamanca"), p(CYL)), false, "lo de debajo de la comunidad no sale si no se elige");
  assert.equal(forYou(item("cyl"), p(P(["es-ex"]))), false);
  assert.equal(forYou(item("salamanca"), p(ES)), false, "solo España = solo lo nacional");
  assert.equal(forYou(item("cyl"), p(ES)), false);
  assert.equal(forYou(item("nacional"), p(ES)), true);
});

test("v5.9 Alertas de abajo arriba", () => {
  for (const place of [SAL, SAL2]) {
    assert.equal(alertInZone({ title: "Aviso amarillo. Temperaturas mínimas. Sanabria" }, "aemet", place), false);
    assert.equal(alertInZone({ title: "Aviso amarillo. Nieblas. Meseta de Salamanca" }, "aemet", place), true, "comarca → su provincia");
    assert.equal(alertInZone({ title: "Detección de pulguilla en colzas" }, "plagas", place), true, "CyL entera cuenta para Salamanca");
    assert.equal(alertInZone({ title: "Topillo en Valladolid y Palencia" }, "plagas", place), false);
    assert.equal(alertInZone({ title: "RESOLUCIÓN época de peligro" }, "incendios", place), true);
    assert.equal(alertInZone({ title: "Peste porcina africana · Molins de Rei, BARCELONA, CATALUÑA" }, "rasve", place), false);
    assert.equal(alertInZone({ title: "Lengua azul · Ledesma, SALAMANCA, CASTILLA Y LEÓN" }, "rasve", place), true);
  }
  assert.equal(alertInZone({ title: "Aviso. Sanabria" }, "aemet", SALZAM), true, "dos provincias: las dos");
  assert.equal(alertInZone({ title: "Aviso. Sanabria" }, "aemet", CYL), false, "lo de una provincia no sale si solo se eligió la comunidad");
  assert.equal(alertInZone({ title: "Lengua azul · Toro, ZAMORA, CASTILLA Y LEÓN" }, "rasve", SAL), false);
  assert.equal(alertInZone({ title: "Lengua azul · Toro, ZAMORA, CASTILLA Y LEÓN" }, "rasve", SALZAM), true);
  assert.equal(alertInZone({ title: "West Nile · Ayamonte, HUELVA, ANDALUCÍA" }, "rasve", ES), false);
  assert.equal(alertInZone({ title: "RESOLUCIÓN" }, "incendios", ES), false, "solo España: nada de una comunidad");
});

test("v5.9 Alertas: mismo filtro en chip, Inicio y botones; Zona con casillas (iPhone/iPad)", () => {
  assert.match(appJs, /flatMap\(\(group\) => \(group\.items \|\| \[\]\)\.filter\(\(alert\) => alertInZone\(alert, group\.id\)\)\)/);
  assert.match(appJs, /<strong>\$\{officialAlerts\(entry\.id\)\.length\}<\/strong>/);
  assert.match(appJs, /alertList\(items\)\.length/);
  for (const level of ["ccaa", "province", "comarca"]) assert.match(appJs, new RegExp(`box\\("${level}"`));
  assert.match(appJs, /<details class="place-field place-multi"/);
  assert.match(appJs, /type="checkbox" data-place-level=/);
  assert.ok(!/<select[^>]*multiple/.test(appJs), "sin <select multiple>");
  assert.ok(!appJs.includes("choiceButtons(ZONES"), "ya no hay botones de zona");
});
