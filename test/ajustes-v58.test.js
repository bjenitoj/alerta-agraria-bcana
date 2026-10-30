import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { referenceSources } from "../server.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const indexHtml = read("public/index.html");
const appJs = read("public/app.js");
const css = read("public/styles.css");
const tabs = appJs.slice(appJs.indexOf("function renderTabs"), appJs.indexOf("function render()"));

test("v5.8 chips: sin Inicio; orden Ayudas, Calendario PAC, Normativa, Precios, Mis favoritas; Precios con el icono de abajo", () => {
  assert.doesNotMatch(tabs, /\["inicio", "Inicio"\]/);
  assert.doesNotMatch(tabs, /Hoy en el campo"\]/);
  const list = tabs.slice(tabs.indexOf("const buttons"), tabs.indexOf("].filter"));
  const ids = [...list.matchAll(/\["(\w+)", /g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((id) => id !== "archivadas"), ["ayudas", "calendario", "normativa", "campo", "favoritas"]);
  assert.match(tabs, /\["campo", "Precios"\]/);
  assert.match(appJs, /campo: PRICES_ICON,/);
  const dockSvg = '<path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M15 7h3v3"/>'; // el icono que tenía «Precios» en la barra
  assert.ok(appJs.includes(`const PRICES_ICON = tabIcon(\`${dockSvg}\`);`));
  assert.match(css, /\.tabs \.tab \{ display: inline-flex; align-items: center; text-transform: uppercase;/);
  assert.match(tabs, /\["favoritas", "Mis favoritas"\]/, "estrella como icono, no como texto");
});

test("v5.8 móvil: los mismos 5 chips que en la web, solo icono, con nombre accesible", () => {
  assert.match(tabs, /const main = "tab-extra";/);
  assert.doesNotMatch(tabs, /"tab-main"/);
  for (const id of ["ayudas", "calendario", "normativa", "campo", "favoritas"]) assert.match(appJs, new RegExp(`\\n  ${id}: (?:tabIcon|PRICES_ICON)`));
  assert.match(tabs, /aria-label="\$\{title\}" title="\$\{title\}"/);
  assert.match(tabs, /<span class="tab-label">\$\{title\}<\/span>/);
  const mobile = css.slice(css.indexOf("/* v5.8 · Móvil (≤ 900 px): los 5 chips"));
  assert.match(mobile, /\.tabs \.tab \.tab-label \{ position: absolute; width: 1px;/);
  assert.match(mobile, /grid-template-columns: repeat\(auto-fit, minmax\(0, 1fr\)\)/);
});

test("v5.8 cuadros de Inicio sin mayúsculas forzadas", () => {
  assert.doesNotMatch(css, /\.stat[^{]*\{[^}]*text-transform: uppercase/);
});

test("v5.8 Ajustes: desplegables Mis preferencias, Tema, Leídas y borradas; sin «Todos»", () => {
  const sheet = indexHtml.slice(indexHtml.indexOf('<div id="prefSheet"'), indexHtml.indexOf('<nav class="tabs'));
  const keys = [...sheet.matchAll(/data-acc="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys, ["prefs", "tema", "leidas"]);
  assert.equal((sheet.match(/class="acc-panel"[^>]* hidden>/g) || []).length, 3, "cerrados al abrir");
  assert.match(sheet, /<span class="acc-title">Leídas y borradas<\/span><span class="acc-note">Se guardan 15 días/);
  assert.match(sheet, /Recuperar borradas/);
  assert.doesNotMatch(sheet, /Ir a Mis preferencias/);
  assert.match(css, /\.acc-text \{ display: flex; flex-wrap: wrap;/);
  assert.match(appJs, /sectorChoices\.innerHTML = choiceButtons\(CHIP_SECTORS, currentSectors\(\), "sector"\)/);
  assert.doesNotMatch(appJs, /choiceButtons\(SECTORS,/);
});

test("v5.8 /fuentes incluye el BOE (legislación consolidada) y caché v=49", () => {
  const boe = referenceSources().find((s) => s.url === "https://www.boe.es/datosabiertos/api/legislacion-consolidada");
  assert.ok(boe);
  assert.match(boe.usedIn, /Normativa en vigor/);
  assert.match(indexHtml, /app\.js\?v=49/);
});

test("v5.8 móvil: Resumen (con número), Herramientas y Ajustes en la barra de abajo; la cabecera los oculta solo ≤ 900 px", () => {
  const dock = indexHtml.slice(indexHtml.indexOf('<nav class="dock'), indexHtml.indexOf("</nav>", indexHtml.indexOf('<nav class="dock')));
  const order = [...dock.matchAll(/data-dock(?:-proxy)?="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ["digestBtn", "toolsBtn", "settingsBtn"]);
  assert.ok(dock.indexOf('data-dock-home="1" data-dock-on="inicio"') < dock.indexOf("digestBtn"), "Inicio primero");
  assert.match(dock, /class="dock-badge" hidden/);
  assert.match(appJs, /document\.getElementById\(proxy\.dataset\.dockProxy\)\?\.click\(\)/);
  assert.match(appJs, /dockBadge\.hidden = badge\.hidden/);
  assert.match(css, /@media \(max-width: 900px\) \{\n  body:not\(\.public-page\):not\(\.locked\) \.top #digestBtn/);
  assert.match(css, /@media \(min-width: 901px\) \{\n  \.dock \{ display: none; \}/);
  assert.match(appJs, /document\.querySelector\("\.top \.brand"\)\?\.addEventListener\("click"/, "el logo lleva a Inicio");
});

test("v5.8 móvil: chips con texto pequeño bajo el icono y barra Inicio · Resumen · Herramientas · Ajustes", () => {
  assert.match(tabs, /<span class="tab-short" aria-hidden="true">\$\{TAB_SHORT\[id\] \|\| title\}<\/span>/);
  assert.match(appJs, /const TAB_SHORT = \{ calendario: "Calendario", favoritas: "Favoritas" \};/);
  assert.match(css, /\.tabs \.tab \.tab-short \{ display: none; \}/);
  const dock = indexHtml.slice(indexHtml.indexOf('<nav class="dock'), indexHtml.indexOf("</nav>", indexHtml.indexOf('<nav class="dock')));
  assert.deepEqual([...dock.matchAll(/<span class="dock-label">([^<]+)</g)].map((m) => m[1]), ["Inicio", "Resumen", "Herramientas", "Ajustes"]);
  assert.match(css, /\.dock \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(appJs, /event\.target\.closest\("\[data-dock-home\]"\)\) document\.querySelector\("\.top \.brand"\)\?\.click\(\)/);
});

test("v5.8 Inicio: «Ayudas y subvenciones» = Otras ayudas y «PAC» = Ayudas PAC, sin piezas repetidas", () => {
  const prio = appJs.slice(appJs.indexOf("function priorityStrip"), appJs.indexOf("function planStrip"));
  assert.match(prio, /const list = id === "ayudas" \? aidPool\("otras"\) : id === "pac" \? aidPool\("pac"\)/);
  assert.match(prio, /const AID_GROUP_OF = \{ ayudas: "otras", pac: "pac" \};/);
  // aidPool separa con isPacAid / !isPacAid: ninguna pieza puede estar en los dos.
  const pool = appJs.slice(appJs.indexOf("function aidPool"), appJs.indexOf("function ayudasView"));
  assert.match(pool, /group === "pac" \? isPacAid\(item\) : !isPacAid\(item\)/);
  const items = [{ id: "l", kind: "linea" }, { id: "a", kind: "ayuda" }, { id: "p", kind: "ayuda", category: "pac_pagos" }];
  const isPacAid = (item) => item.kind === "linea" || item.category === "pac_pagos";
  const pac = items.filter(isPacAid).map((i) => i.id);
  const otras = items.filter((i) => !isPacAid(i)).map((i) => i.id);
  assert.deepEqual(pac, ["l", "p"]);
  assert.deepEqual(otras, ["a"]);
  assert.ok(!pac.some((id) => otras.includes(id)));
  assert.match(appJs, /if \(active === "ayudas" && go\.dataset\.aidGroupGoto\) saveAidGroup\(go\.dataset\.aidGroupGoto\);/);
});
