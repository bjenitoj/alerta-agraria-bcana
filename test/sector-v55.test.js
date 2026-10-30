import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SECTORS } from "../lib/preferences.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const between = (a, b) => appJs.slice(appJs.indexOf(a), appJs.indexOf(b, appJs.indexOf(a) + a.length));
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Código real: inSector, cuadros (GLANCE … glanceCards) y GLANCE_MATCH.
const inSectorSrc = between("function inSector(", "function baseItems");
const glanceSrc = between("const GLANCE = [", "function renderBoard");
const matchSrc = between("const GLANCE_MATCH = {", "function renderList");
// v5.6: selección múltiple. «todos» = ningún chip marcado; también se admite una lista.
function load(sector) {
  const chosen = Array.isArray(sector) ? sector : sector === "todos" ? [] : [sector];
  const CHIP_SECTORS = SECTORS.filter((entry) => entry.id !== "todos");
  return new Function("SECTORS", "CHIP_SECTORS", "currentSectors", "aidCard", "escapeHtml", "readTools",
    `function isPacLine(item) { return item.kind === "linea"; }
function isPacAid(item) { return item.kind === "linea" || item.sourceId === "pac_lineas"; }
function inTab() { return true; }
function aidStatusOf(item) { const s = item?.aid?.status; return s === "cerrada" || s === "proxima" || s === "cierra_pronto" ? s : "abierta"; }
function matchesAidStatus(item, chip) { const s = aidStatusOf(item); return chip === "abierta" ? s === "abierta" || s === "cierra_pronto" : s === chip; }
${inSectorSrc}; ${glanceSrc}; ${matchSrc}; return { inSector, glanceCards, GLANCE, GLANCE_MATCH, open: (v) => { openStat = v; } };`)(
    SECTORS, CHIP_SECTORS, () => chosen, (item) => `<article class="card" data-id="${esc(item.id)}"></article>`, esc, () => "");
}

// Piezas de prueba con la clasificación que ya trae cada una (`sectors`). Una sin sector conocido.
const aid = (id, status, sectors) => ({ id, sectors, url: `https://www.boe.es/${id}`, aid: { status } });
const line = (id, sectors) => ({ id, sectors, kind: "linea", sourceId: "pac_lineas", url: `https://www.jcyl.es/${id}` });
const ITEMS = [
  aid("a1", "abierta", ["agricultura"]),
  aid("a2", "cierra_pronto", ["agricultura", "ganaderia"]),
  aid("a3", "abierta", ["ganaderia"]),
  aid("a4", "proxima", ["pesca"]),
  aid("a5", "abierta", []),
  line("l1", ["agricultura"]),
  line("l2", ["ganaderia"]),
  line("l3", ["agricultura", "ganaderia"]),
];

function counts(sector) {
  const g = load(sector);
  const items = ITEMS.filter((item) => g.inSector(item));
  const lists = Object.fromEntries(g.GLANCE.map((card) => [card.id, items.filter(g.GLANCE_MATCH[card.id])]));
  return { g, lists, n: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])) };
}

test("v5.5 sector: los cuadros de Inicio cambian con Agricultura / Ganadería / Pesca / Todos", () => {
  assert.deepEqual(counts("agricultura").n, { abierta: 2, cierra_pronto: 1, pac: 2 });
  assert.deepEqual(counts("ganaderia").n, { abierta: 2, cierra_pronto: 1, pac: 2 });
  assert.deepEqual(counts("pesca").n, { abierta: 0, cierra_pronto: 0, pac: 0 });
  assert.deepEqual(counts("todos").n, { abierta: 4, cierra_pronto: 1, pac: 3 });
  // v5.6: varios sectores = la suma (sin repetir); ninguno = todo
  assert.deepEqual(counts(["agricultura", "ganaderia"]).n, { abierta: 3, cierra_pronto: 1, pac: 3 });
  assert.deepEqual(counts(["agricultura", "ganaderia"]).lists.abierta.map((i) => i.id), ["a1", "a2", "a3"]);
  // a1 solo agricultura, a3 solo ganadería: mismas cifras pero piezas distintas
  assert.deepEqual(counts("agricultura").lists.abierta.map((i) => i.id), ["a1", "a2"]);
  assert.deepEqual(counts("ganaderia").lists.abierta.map((i) => i.id), ["a2", "a3"]);
});

test("v5.5 sector: lo que no tiene sector conocido solo sale en «Todos» (no se deduce nada)", () => {
  for (const sector of ["agricultura", "ganaderia", "pesca"]) assert.equal(load(sector).inSector(ITEMS[4]), false);
  assert.equal(load("todos").inSector(ITEMS[4]), true);
});

test("v5.5 sector: el número del cuadro = piezas del cuadro abierto = «Ver todas (N)»", () => {
  for (const sector of ["agricultura", "ganaderia", "pesca", "todos"]) {
    const { g, lists } = counts(sector);
    for (const card of g.GLANCE) {
      g.open(card.id);
      const html = g.glanceCards(lists);
      const n = lists[card.id].length;
      assert.match(html, new RegExp(`data-stat="${card.id}"[^>]*><strong>${n}</strong>`));
      const panel = html.slice(html.indexOf('id="statPanel"'));
      assert.equal((panel.match(/<article class="card"/g) || []).length, Math.min(n, 10));
      if (n) assert.match(panel, new RegExp(`data-status="${card.status}">Ver todas \\(${n}\\)</button>`));
      else assert.match(panel, /No hay ninguna ahora/);
    }
  }
});

test("v5.5 sector: listas, pestañas, «Ver todas», Resumen y plazos usan el mismo filtro", () => {
  const base = between("function baseItems", "function filterRow");
  assert.match(base, /if \(!inSector\(item\)\) return false;/);
  // cuadros y listas salen de baseItems() con el mismo criterio por cuadro (GLANCE_MATCH)
  assert.match(between("function renderBoard", "const GLANCE_MATCH"), /sortedItems\(baseItems\(\)\)/);
  const list = between("function renderList", "function closingSoonList");
  assert.match(list, /baseItems\(\)\.filter\(\(item\) => \(match \? match\(item\) : inTab\(item, tab\)\)\)/);
  assert.match(between("function aidPool", "function ayudasView"), /baseItems\(\{ allStatus: true \}\)/);
  assert.match(between("function renderBoard", "const GLANCE_MATCH"), /aidPool\("otras"\)/, "v5.8: Inicio usa el mismo cálculo que Ayudas");
  assert.match(between("function renderTabs", "function "), /const items = baseItems\(\);/);
  assert.match(between("function paintDigestBtn", "function "), /digestBadgeCount\(\)/, "Resumen (botón de cabecera) cuenta piezas, no días");
  assert.match(between("function digestData", "function digestBadgeCount"), /inSector\(item\)/);
  assert.match(between("function closingSoonList", "function closingSoonSection"), /!inSector\(item\)/);
  // el chip cambia el sector y vuelve a pintar todo
  const chip = appJs.slice(appJs.indexOf('const sectorChip = event.target.closest("[data-sector-chip]")'), appJs.indexOf('const sectorChip = event.target.closest("[data-sector-chip]")') + 400);
  assert.match(chip, /saveChosenSectors\(now\.includes\(id\) \? now\.filter\(\(entry\) => entry !== id\) : \[\.\.\.now, id\]\);\s*render\(\);/);
});
