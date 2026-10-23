import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CROP_RULES,
  DEFAULT_PREFS,
  FARM_TYPES,
  FISHING,
  PREFS_STORAGE_KEY,
  activityHits,
  compareItems,
  cropsForSector,
  matchScore,
  normalizePrefs,
  sectorScope,
} from "../lib/preferences.js";
import { whyForYou } from "../lib/aid-view.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const today = "2026-10-23";
const ids = (list) => list.map((item) => item.id);

test("v5.3: cada sector tiene su segundo bloque en el paso 2", () => {
  assert.deepEqual(sectorScope("agricultura"), { agricultura: true, ganaderia: false, pesca: false });
  assert.deepEqual(sectorScope("ganaderia"), { agricultura: false, ganaderia: true, pesca: false });
  assert.deepEqual(sectorScope("pesca"), { agricultura: false, ganaderia: false, pesca: true });
  assert.deepEqual(sectorScope("todos"), { agricultura: true, ganaderia: true, pesca: true });
  assert.deepEqual(ids(FARM_TYPES), ["extensiva", "intensiva", "mixta", "autoconsumo"]);
  assert.deepEqual(ids(FISHING), ["pesca-maritima", "marisqueo", "acuicultura", "pesca-continental"]);
  const blocks = appJs.slice(appJs.indexOf("const SECTOR_BLOCKS"), appJs.indexOf("const sectorName"));
  assert.match(blocks, /"agricultura", title: "Tierra", list: WATERS/);
  assert.match(blocks, /"ganaderia", title: "Tipo de explotación", list: FARM_TYPES/);
  assert.match(blocks, /"pesca", title: "Actividad", list: FISHING/);
  assert.match(appJs, /sectorBlocksHtml\(prefs\)/, "el paso 2 usa los bloques del sector");
  assert.match(indexHtml, /id="sectorBlocks"/, "Mis preferencias enseña los mismos bloques");
  assert.doesNotMatch(indexHtml, /id="waterChoices"/);
});

test("v5.3: el paso 3 solo enseña lo del sector elegido; con Todos, todo agrupado", () => {
  const sectorsOf = (sector) => [...new Set(cropsForSector(sector).map((rule) => rule.sector))];
  assert.deepEqual(sectorsOf("agricultura"), ["agricultura"]);
  assert.deepEqual(sectorsOf("ganaderia"), ["ganaderia"]);
  assert.deepEqual(sectorsOf("pesca"), ["pesca"]);
  assert.equal(cropsForSector("todos").length, CROP_RULES.length);
  assert.ok(ids(cropsForSector("ganaderia")).includes("vacuno"));
  assert.ok(!ids(cropsForSector("ganaderia")).includes("cereal"));
  assert.deepEqual(ids(cropsForSector("pesca")), ["peces", "moluscos", "crustaceos", "algas"]);
  for (const title of ["¿Qué cultivas?", "¿Qué crías?", "¿Qué pescas o crías?"]) assert.ok(appJs.includes(title), title);
  assert.match(appJs, /crop-group" data-sector=/, "con Todos, agrupado por sector");
});

test("v5.3: al cambiar de sector se quita lo que ya no aplica, pero la zona se queda", () => {
  const agri = normalizePrefs({ sector: "agricultura", zone: "salamanca", water: ["regadio"], crops: ["cereal", "maiz"], farm: ["extensiva"], fishing: ["marisqueo"] });
  assert.deepEqual(agri.crops, ["cereal", "maiz"]);
  assert.deepEqual(agri.farm, []);
  assert.deepEqual(agri.fishing, []);
  const gan = normalizePrefs({ ...agri, sector: "ganaderia", farm: ["extensiva"] });
  assert.equal(gan.zone, "salamanca", "la zona no se borra");
  assert.deepEqual(gan.crops, [], "los cultivos no se quedan escondidos");
  assert.deepEqual(gan.farm, ["extensiva"]);
  const pesca = normalizePrefs({ ...gan, sector: "pesca", crops: [...gan.crops, "vacuno", "moluscos"], fishing: ["marisqueo"] });
  assert.equal(pesca.zone, "salamanca");
  assert.deepEqual(pesca.crops, ["moluscos"]);
  assert.deepEqual(pesca.farm, []);
  assert.deepEqual(pesca.fishing, ["marisqueo"]);
  const todos = normalizePrefs({ sector: "todos", crops: ["cereal", "vacuno", "algas"], farm: ["mixta"], fishing: ["acuicultura"], water: ["secano"] });
  assert.deepEqual(todos.crops, ["cereal", "vacuno", "algas"]);
  assert.deepEqual(todos.farm, ["mixta"]);
  assert.deepEqual(todos.fishing, ["acuicultura"]);
  assert.deepEqual(todos.water, ["secano"]);
  assert.match(appJs, /farm: \[\.\.\.prefs\.farm\], fishing: \[\.\.\.prefs\.fishing\]/);
});

test("v5.3: la tierra elegida en agricultura no cambia el orden si el sector es otro", () => {
  const item = { id: "s", title: "Ayuda en secano", sectors: ["ganaderia"], water: "secano", infoTypes: ["ayudas"], zone: "cyl" };
  const gan = { sector: "ganaderia", zone: "cyl", water: ["regadio"] };
  const ganSecano = { sector: "ganaderia", zone: "cyl", water: ["secano"] };
  assert.equal(matchScore(item, gan, today), matchScore(item, ganSecano, today));
});

test("v5.3: migración segura de preferencias guardadas antes", () => {
  assert.equal(PREFS_STORAGE_KEY, "alerta_prefs_v1");
  const v2 = normalizePrefs({ version: 2, sector: "agricultura", zone: "cyl", water: ["secano"], crops: ["cereal"], info: ["pac"] });
  assert.equal(v2.version, 3);
  assert.deepEqual(v2.water, ["secano"]);
  assert.deepEqual(v2.crops, ["cereal"]);
  assert.deepEqual(v2.farm, []);
  assert.deepEqual(v2.fishing, []);
  assert.deepEqual(v2.info, ["pac"]);
  // «Pesca marítima» y «Acuicultura» antes eran cultivos: pasan a «Actividad».
  const oldPesca = normalizePrefs({ version: 2, sector: "pesca", zone: "nacional", crops: ["pesca-maritima", "acuicultura"] });
  assert.deepEqual(oldPesca.fishing, ["pesca-maritima", "acuicultura"]);
  assert.deepEqual(oldPesca.crops, []);
  assert.deepEqual(normalizePrefs({ farm: ["inventado"], fishing: "x" }).farm, []);
  assert.deepEqual(DEFAULT_PREFS.farm, []);
  assert.deepEqual(DEFAULT_PREFS.fishing, []);
  assert.match(indexHtml, /app\.js\?v=32/);
  assert.match(indexHtml, /styles\.css\?v=32/);
});

test("v5.3: tipo de explotación y actividad solo cuentan si la palabra sale tal cual en el texto oficial", () => {
  const ext = { id: "e", title: "Ayudas a la ganadería extensiva de vacuno", sectors: ["ganaderia"], infoTypes: ["ayudas"], zone: "cyl" };
  const plain = { id: "p", title: "Ayudas a la ganadería de vacuno", sectors: ["ganaderia"], infoTypes: ["ayudas"], zone: "cyl" };
  const prefs = { sector: "ganaderia", zone: "cyl", farm: ["extensiva"], info: ["ayudas"] };
  assert.equal(activityHits(ext, prefs), 1);
  assert.equal(activityHits(plain, prefs), 0, "no se deduce nada si no lo dice");
  assert.ok(compareItems(ext, plain, prefs, today) < 0, "lo que lo dice tal cual va antes");
  assert.equal(compareItems(ext, plain, { ...prefs, farm: [] }, today) > 0, true, "sin elegir, orden normal (por título)");
  const autoSolar = { title: "Instalaciones de autoconsumo fotovoltaico" };
  assert.equal(activityHits(autoSolar, { sector: "ganaderia", farm: ["autoconsumo"] }), 0, "autoconsumo eléctrico no cuenta");
  assert.equal(activityHits({ title: "Explotaciones de autoconsumo de porcino" }, { sector: "ganaderia", farm: ["autoconsumo"] }), 1);
  const mar = { title: "Ayudas al marisqueo a pie" };
  assert.equal(activityHits(mar, { sector: "pesca", fishing: ["marisqueo"] }), 1);
  assert.equal(activityHits(mar, { sector: "agricultura", fishing: ["marisqueo"] }), 0, "fuera de su sector no cuenta");
  const why = whyForYou({ title: "Ayudas a la ganadería extensiva", sectors: ["ganaderia"] }, prefs);
  assert.ok(why.mentions.includes("extensiva"));
});
