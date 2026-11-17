import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { decorateItem } from "../lib/classify.js";
import { zoneForSource } from "../lib/zones.js";
import { pickBdnsRows } from "../lib/collect.js";
import { SOURCES } from "../lib/config.js";

const today = new Date().toISOString();

function kept(partial) {
  return decorateItem({
    sourceId: "bocyl",
    sourceName: "BOCyL",
    title: "Orden de ayudas a la ganadería",
    url: "https://bocyl.jcyl.es/ejemplo",
    summary: "Convocatoria de ayudas",
    publishedAt: today,
    dateSource: "meta",
    ...partial,
  });
}

test("v7.1 una fuente de la Junta no sale como nacional", () => {
  assert.equal(zoneForSource("ayudas_ganaderia", "https://agriculturaganaderia.jcyl.es/web/es/ayudas.html", "nacional"), "cyl");
  assert.equal(zoneForSource("jovenes_cyl", "https://tramitacastillayleon.jcyl.es/web/jcyl/Tramita", "nacional"), "cyl");
  assert.equal(zoneForSource("itacyl", "https://www.itacyl.es/", "nacional"), "cyl");
  assert.equal(zoneForSource("pac_lineas", "https://pac.jcyl.es/", "nacional"), "cyl");
  const item = kept({ sourceId: "ayudas_ganaderia", url: "https://agriculturaganaderia.jcyl.es/web/es/ayudas.html", title: "Ayudas a la ganadería" });
  assert.equal(item.zone, "cyl");
  assert.notEqual(item.zone, "nacional");
});

test("v7.1 si el texto nombra una provincia de esa comunidad, manda la provincia", () => {
  const salamanca = kept({ title: "Ayuda al vacuno en Salamanca" });
  assert.equal(salamanca.zone, "salamanca");
  const leon = kept({ title: "Ayuda en León, Castilla y León" });
  assert.equal(leon.zone, "24");
  const sevilla = kept({
    sourceId: "boja",
    sourceName: "BOJA",
    url: "https://www.juntadeandalucia.es/boja/ejemplo",
    title: "Ayudas al olivar en Sevilla",
  });
  assert.equal(sevilla.zone, "41");
  const andalucia = kept({
    sourceId: "boja",
    sourceName: "BOJA",
    url: "https://www.juntadeandalucia.es/boja/ejemplo",
    title: "Ayudas al olivar",
    summary: "Junta de Andalucía",
  });
  assert.equal(andalucia.zone, "es-an");
});

test("v7.1 los boletines que responden están activos y el DOE usa la sección con piezas", () => {
  const on = ["boja", "dog", "doe", "bocm", "bopv", "boib", "boc_canarias", "govern_cat"];
  for (const id of on) {
    const source = SOURCES.find((item) => item.id === id);
    assert.equal(source.enabled, true, id);
    assert.equal(source.kind, "rss", id);
  }
  assert.match(SOURCES.find((item) => item.id === "doe").feed, /seccion=3/);
});

test("v7.1 la lista solo enseña la zona elegida y las de encima", () => {
  const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /placeAllows/);
  assert.match(app.slice(app.indexOf("function baseItems"), app.indexOf("function filterRow")), /if \(!inPlace\(item\)\) return false;/);
});

test("v7.1 la BDNS no deja que una comunidad se quede el cupo", () => {
  const salamanca = Array.from({ length: 20 }, (_, i) => ({ id: `sa-${i}` }));
  const cyl = Array.from({ length: 4 }, (_, i) => ({ id: `cl-${i}` }));
  const picked = pickBdnsRows([salamanca, cyl], 6);
  assert.equal(picked.filter((row) => String(row.id).startsWith("cl-")).length, 3);
  assert.equal(picked.length, 6);
});
