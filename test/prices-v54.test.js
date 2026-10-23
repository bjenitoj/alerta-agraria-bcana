import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePriceSheet } from "../lib/prices.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const field = appJs.slice(appJs.indexOf("function renderField"), appJs.indexOf("function toolsHtml"));

// Cabecera real de la hoja precios_medios_nacionales_2026-s36.xlsx (MAPA), fila de semanas y fila de fechas,
// copiada tal cual (consultada el 23/10/2026): la semana 41 figura como «05/10-1/10».
const REAL_ROWS = [
  ["", "SECTOR", "PRODUCTOS AGRARIOS", "Semana 38", "Semana 39", "Semana 40", "Semana 41", "Semana 42"],
  ["", "", "", "14/09- 20/09", "21/09- 27/09", "28/09-04/10", "05/10-1/10", ""],
  ["CEREALES", "(1)", "Trigo blando (€/t)", 245.1, 246.2, 247.97, 249.12, "-"],
  ["Posición comercial: (1) Salida de almacén cargado o entregado al transformador después de intermediario"],
];
const PRODUCTS = [{ id: "trigo_blando", nombre: "Trigo blando", grupo: "Cereales", patron: "^Trigo blando" }];

test("v5.4: la semana sale tal cual de la cabecera oficial, sin cortar ni corregir", () => {
  const parsed = parsePriceSheet(REAL_ROWS, PRODUCTS, 2026);
  assert.equal(parsed.week, 41, "última columna con precio");
  assert.equal(parsed.weekHeader, "Semana 41");
  assert.equal(parsed.weekLabel, "05/10-1/10", "literal del Excel oficial; no se inventa «11/10»");
  assert.equal(parsed.items[0].value, 249.12);
  assert.equal(parsed.items[0].change, 1.15);
  // la columna de fechas es la de la misma semana (no la de al lado)
  const week40 = parsePriceSheet(REAL_ROWS.map((row, index) => (index === 2 ? row.slice(0, 6) : row)), PRODUCTS, 2026);
  assert.equal(week40.weekLabel, "28/09-04/10");
});

test("v5.4: cabecera de precios corta: solo la semana, en negrita", () => {
  assert.doesNotMatch(appJs, /Última columna con precios en la tabla oficial/);
  assert.doesNotMatch(appJs, /texto literal de la cabecera/);
  assert.match(field, /<p><strong>\$\{escapeHtml\(weekText\(pricesData\)\)\}<\/strong><\/p>/);
});

test("v5.4: tablas de precios sin «Posición comercial» y con «Variación»", () => {
  assert.doesNotMatch(appJs, /Producto \(tal como figura en la tabla\)/);
  assert.doesNotMatch(appJs, /Frente a la semana anterior publicada/);
  assert.doesNotMatch(field, /Posición comercial/);
  assert.doesNotMatch(field, /positionRef/, "sin la llamada (n) junto al producto");
  assert.match(field, /<th>Producto<\/th><th>Precio<\/th><th>Variación<\/th>/);
  assert.match(field, /Tabla oficial \(Excel\)/, "se mantiene el enlace a la fuente oficial");
  assert.match(field, /Página oficial del MAPA/);
  assert.match(indexHtml, /app\.js\?v=32/);
  assert.match(indexHtml, /styles\.css\?v=32/);
  assert.match(appJs, /Versión en revisión/, "se mantiene el cartel «En revisión»");
});
