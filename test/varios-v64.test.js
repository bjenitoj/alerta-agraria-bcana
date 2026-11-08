import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const tabs = appJs.slice(appJs.indexOf("function renderTabs"), appJs.indexOf("function render()"));
const varios = appJs.slice(appJs.indexOf("// v6.4 · Varios"), appJs.indexOf("function renderList"));
const guide = indexHtml.slice(indexHtml.indexOf('id="acc-guia"'), indexHtml.indexOf("</dl>"));
const dock = indexHtml.slice(indexHtml.indexOf('<nav class="dock'), indexHtml.indexOf("</nav>", indexHtml.indexOf('<nav class="dock')));

test("v6.4 chips: un solo «Varios (n)» en el sitio de Normativa y Alertas", () => {
  const list = tabs.slice(tabs.indexOf("const buttons"), tabs.indexOf("].filter"));
  const ids = [...list.matchAll(/\["([a-z-]+)", "([^"]+)"\]/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(ids.filter(([id]) => id !== "archivadas"), [
    ["ayudas", "Ayudas"],
    ["calendario", "Calendario PAC"],
    ["nueva-pac", "Nueva PAC"],
    ["campo", "Precios"],
    ["varios", "Varios"],
  ]);
  assert.match(tabs, /id === "varios"\s*\n\s*\? variosCount\(items\)/);
  assert.match(tabs, /<span class="count">\(\$\{count\}\)<\/span>/);
  assert.match(appJs, /varios: tabIcon\(/);
  assert.doesNotMatch(dock, /Normativa|Alertas/);
});

test("v6.4 al abrir Varios: dos tarjetas Normativa (n) y Alertas (n)", () => {
  assert.match(varios, /<h2>Varios \(\$\{variosCount\(items\)\}\)<\/h2>/);
  assert.match(varios, /class="varios-card" data-varios="\$\{id\}"/);
  assert.match(varios, /\["normativa", "Normativa", normativaCount\(items\)/);
  assert.match(varios, /\["alertas", "Alertas", alertList\(items\)\.length/);
  assert.match(varios, /\$\{label\} <span class="count">\(\$\{count\}\)<\/span>/);
  assert.match(css, /\.varios-chooser \{ display: grid; grid-template-columns: 1fr 1fr;/);
  assert.match(css, /@media \(max-width: 700px\) \{\n  \.varios-chooser \{ grid-template-columns: 1fr; \}/);
});

test("v6.4 dentro: control segmentado y las pantallas de siempre", () => {
  assert.match(varios, /class="seg varios-seg"/);
  assert.match(varios, /aria-label="Normativa o Alertas"/);
  assert.match(varios, /if \(variosPane === "alertas"\) return variosSwitch\(\) \+ renderAlertas\(\);/);
  assert.match(varios, /return variosSwitch\(\) \+ renderNormativa\(recent\);/);
  const norma = appJs.slice(appJs.indexOf("function renderNormativa"), appJs.indexOf("// v6.4 · Varios"));
  assert.match(norma, /filterRow\(\)/);
  assert.match(norma, /normaGroupsHtml\(normaGroups\(vigentes\)\)/);
  assert.match(norma, /Publicado últimamente \(BOE y BOCyL\) <span class="count">/);
  const alertas = appJs.slice(appJs.indexOf("function renderAlertas"), appJs.indexOf("function priorityStrip"));
  assert.match(alertas, /filterRow\(\)/);
  assert.match(alertas, /alertTypeButtons\(\)/);
  assert.match(alertas, />Alertas \(\$\{alertList\(\)\.length\}\)<\/h2>/);
});

test("v6.4 navegación: el chip abre el selector; las tarjetas y los «Ver» entran en la pantalla", () => {
  const tabClick = appJs.slice(appJs.indexOf('tabsEl.addEventListener("click"'), appJs.indexOf("// v5.8 · Ajustes"));
  assert.match(tabClick, /if \(button\.dataset\.id === "varios"\) variosPane = null;/);
  const click = appJs.slice(appJs.indexOf('const variosBtn = event.target.closest("[data-varios]")'), appJs.indexOf('const go = event.target.closest("[data-goto]")'));
  assert.match(click, /if \(next === "normativa" \|\| next === "alertas"\)/);
  assert.match(click, /active = "varios";\s*variosPane = next;/);
  assert.match(appJs, /if \(active === "normativa" \|\| active === "alertas"\) \{\s*variosPane = active;\s*active = "varios";/);
  assert.match(appJs, /const TAB_OF = \{ ayudas: "ayudas", pac: "ayudas", normativa: "normativa", alertas: "alertas" \}/);
});

test("v6.4 guía y caché v=68", () => {
  assert.match(guide, /<dt>Varios<\/dt><dd>Una sola pestaña: elige Normativa o Alertas\.<\/dd>/);
  assert.match(guide, /<dt>Normativa<\/dt><dd>Dentro de Varios:/);
  assert.match(guide, /<dt>Alertas<\/dt><dd>Dentro de Varios:/);
  assert.match(indexHtml, /styles\.css\?v=68/);
  assert.match(indexHtml, /app\.js\?v=68/);
});

test("v6.4 sin chips de categorías en Resumen, Favoritas, Herramientas y Ajustes", () => {
  const fn = appJs.slice(appJs.indexOf("function paintCategoryTabs"), appJs.indexOf("function render("));
  assert.match(fn, /const sheetOpen = Boolean\(prefSheet && !prefSheet\.hidden\);/);
  assert.match(fn, /tabsEl\.hidden = NO_CATEGORY_TABS\.has\(active\) \|\| sheetOpen;/);
  assert.match(appJs, /const NO_CATEGORY_TABS = new Set\(\["resumen", "favoritas", "herramientas"\]\);/);
  const render = appJs.slice(appJs.indexOf("function render()"), appJs.indexOf("function showGate"));
  assert.match(render, /paintCategoryTabs\(\);/);
  const sheet = appJs.slice(appJs.indexOf("function setSheet"), appJs.indexOf("settingsBtn?.addEventListener"));
  assert.match(sheet, /prefSheet\.hidden = !open;/);
  assert.match(sheet, /paintCategoryTabs\(\);/);
  assert.match(css, /\.tabs\[hidden\] \{ display: none; \}/);
});
