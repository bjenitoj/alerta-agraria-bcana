import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePriceSheet, PRICE_CONFIG } from "../lib/prices.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const appJs = read("public/app.js");
const indexHtml = read("public/index.html");
const between = (a, b) => appJs.slice(appJs.indexOf(a), appJs.indexOf(b, appJs.indexOf(a) + a.length));

test("v5.9 Precios: ganadería sale del mismo Excel oficial del MAPA, con sector y unidad de la hoja", () => {
  const gan = PRICE_CONFIG.productos.filter((p) => p.sector === "ganaderia");
  assert.ok(gan.length >= 10);
  assert.ok(PRICE_CONFIG.productos.every((p) => ["agricultura", "ganaderia"].includes(p.sector)));
  const rows = [
    ["SECTOR", "PRODUCTOS AGRARIOS", "", "Semana 42", "Semana 43"],
    ["", "(especificaciones)", "", "12/10-18/10", "19/10-25/10"],
    ["", "(1)", "Trigo blando (€/t)", 250, 249.72],
    ["BOVINO", "(14)", "Terneras 180-300 kg (€/100kg Canal)", 660, 668.82],
    ["", "(14)", "Corderos Peso canal (>10 y <=13) kg (€/100kg Canal)", 1240, "-"],
    ["PORCINO", "(14)", "Lechón 20 kg (unidad)", 26, 27],
  ];
  const out = parsePriceSheet(rows, PRICE_CONFIG.productos, 2026);
  const t = out.items.find((i) => i.id === "terneras");
  assert.equal(t.sector, "ganaderia");
  assert.equal(t.unit, "€/100kg Canal");
  assert.equal(t.value, 668.82);
  const c = out.items.find((i) => i.id === "cordero_13");
  assert.equal(c.value, null, "«-» en la hoja: sin precio, nunca inventado");
  assert.equal(out.items.find((i) => i.id === "trigo_blando").sector, "agricultura");
  // Productos que no están en la hoja no aparecen.
  assert.ok(!out.items.some((i) => i.id === "pollo"));
});

test("v5.9 Precios: chips de sector junto a Fuente; pesca solo con mensaje honesto y enlaces oficiales", () => {
  const field = between("function renderField", "\n}\n");
  assert.match(field, /<div class="price-bar">\$\{priceSourcePicker\(\)\}\$\{filterRow\(\)\}<\/div>/);
  const pesca = between("function pescaPrices", "\n}\n");
  assert.doesNotMatch(pesca, /euro\(|value/);
  assert.match(pesca, /no enseñamos ninguno/);
  assert.ok(PRICE_CONFIG.pesca.enlaces.every((l) => /^https:\/\/www\.mapa\.gob\.es\//.test(l.url)));
  assert.match(between("function renderMapaPrices", "\n}\n"), /priceSectorOn\(priceSectorOf\(item, "mapa"\)\)/);
  assert.match(between("function renderLonja", "\n}\n"), /priceSectorOn\(priceSectorOf\(item, "lonja"\)\)/);
});

test("v5.9 Inicio: sin cuadros Abiertas/Cierran pronto/Líneas PAC y sección «Mis preferencias»", () => {
  const board = between("function renderBoard", "\n}\n");
  assert.doesNotMatch(board, /glanceCards\(/);
  assert.match(appJs, /<p class="eyebrow">Mis preferencias<\/p>/);
  assert.doesNotMatch(appJs, /Lo que has puesto primero/);
  assert.match(between("function renderAyudas", "\n}\n"), /stat|status/i, "los cuadros siguen en Ayudas");
});

test("v5.9 Normativa: botón «Borrar leídas» como en las demás pantallas", () => {
  assert.match(between("function renderNormativa", "\n}\n"), /filterRow\(\) \+ readTools\(\)/);
  assert.match(indexHtml, /v=70/);
});

test("v5.9 Alertas: solo lo que no sale en otra sección (RD 849/2026 fuera)", () => {
  const fn = between("// v5.9: «Alertas» solo", "\nfunction priorityStrip");
  const g = {};
  new Function("g", `const itemInfoTypes = (i) => i.infoTypes || []; const inTab = (i, t) => (i.tabs || []).includes(t); const isPacAid = (i) => i.kind === "linea"; ${fn}; g.alertOnly = alertOnly;`)(g);
  const rd = { id: "rd849", infoTypes: ["ayudas", "alertas"], tabs: ["ayudas"] };
  const norma = { id: "n", infoTypes: ["normativa", "alertas"] };
  const pac = { id: "p", kind: "linea", infoTypes: ["alertas"] };
  const solo = { id: "s", infoTypes: ["alertas"] };
  assert.deepEqual(g.alertOnly([rd, norma, pac, solo]).map((i) => i.id), ["s"]);
  assert.deepEqual(g.alertOnly([rd]), []);
  assert.match(appJs, /id === "alertas" \? alertList\(items\)/);
});
