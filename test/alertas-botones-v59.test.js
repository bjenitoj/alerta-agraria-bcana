import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

test("v5.9 Alertas: 4 botones grandes por tipo, con el estilo de Ayudas", () => {
  const block = appJs.slice(appJs.indexOf("const ALERT_TYPE_BUTTONS"), appJs.indexOf("let alertType"));
  const ids = [...block.matchAll(/id: "(\w+)", label: "([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(ids, ["aemet:Tiempo", "plagas:Plagas", "rasve:Sanidad animal", "incendios:Incendios"]);
  assert.match(appJs, /class="stat status-box alert-type-\$\{entry\.id\}/);
  assert.match(appJs, /<strong>\$\{officialAlerts\(entry\.id\)\.length\}<\/strong>/, "cuenta = la misma que la lista");
  assert.match(css, /status-boxes\.alert-types \{ grid-template-columns: repeat\(4/);
});

test("v5.9 Alertas: por defecto todas; tocar filtra y volver a tocar quita el filtro", () => {
  assert.match(appJs, /let alertType = "";/);
  assert.match(appJs, /filter\(\(group\) => !alertType \|\| group\.id === alertType\)/);
  assert.match(appJs, /alertType = next && next !== alertType \? next : "";/);
  assert.match(appJs, />Alertas \(\$\{alertList\(\)\.length\}\)<\/h2>/, "cabecera = chip = Inicio");
});

test("v5.9: tras tocar un botón grande, el cartel «En revisión» no tapa la fila de arriba (Alertas y Ayudas)", () => {
  assert.match(appJs, /function bannerBottom\(\)/);
  assert.match(appJs, /revealBelowBanner\("\.alert-types"\)/);
  assert.match(appJs, /revealBelowBanner\("\.status-boxes"\)/);
});
