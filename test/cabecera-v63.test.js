import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const header = html.slice(html.indexOf('<header class="top"'), html.indexOf("</header>"));
const dock = html.slice(html.indexOf('<nav class="dock'), html.indexOf("</nav>", html.indexOf('<nav class="dock')));

test("v6.3 cabecera iPad/web: símbolo arriba y nombre debajo, recuento entre paréntesis", () => {
  const wide = css.slice(css.indexOf("v6.3 revisión visual"));
  assert.match(wide, /@media \(min-width: 901px\)/);
  assert.match(wide, /\.head-btn \{[^}]*flex-direction: column/);
  assert.match(wide, /\.head-line \{[^}]*white-space: nowrap/);
  for (const name of ["Resumen", "Favoritas", "Herramientas", "Ajustes"]) {
    assert.match(header, new RegExp(`<span class="head-line"><span class="head-text">${name}</span>`));
  }
  assert.ok(header.indexOf('id="digestBtn"') < header.indexOf('id="favBtn"') && header.indexOf('id="favBtn"') < header.indexOf('id="toolsBtn"') && header.indexOf('id="toolsBtn"') < header.indexOf('id="settingsBtn"'));
  assert.match(appJs, /badge\.textContent = `\(\$\{count > 99 \? "99\+" : count\}\)`/);
  assert.match(appJs, /badge\.textContent = n \? `\(\$\{n\}\)` : ""/);
});

test("v6.3 móvil: sin estrella de cabecera y sin Inicio en la barra; el logo abre Inicio", () => {
  assert.match(css, /@media \(max-width: 900px\) \{\n  body:not\(\.public-page\):not\(\.locked\) \.top #digestBtn,\n  body:not\(\.public-page\):not\(\.locked\) \.top #favBtn,/);
  assert.doesNotMatch(dock, /data-dock-home|dock-label">Inicio</);
  assert.deepEqual([...dock.matchAll(/<span class="dock-label">([^<]+)</g)].map((m) => m[1]), ["Resumen", "Favoritas", "Herramientas", "Ajustes"]);
  const labelRule = css.match(/\.dock-label \{[^}]*\}/)?.[0] || "";
  assert.match(labelRule, /white-space: nowrap/);
  assert.doesNotMatch(labelRule, /ellipsis/);
  assert.match(html, /<a class="brand" href="\/">[\s\S]*Ir a Inicio\./);
  assert.match(appJs, /function paintBrand\(\)/);
  assert.match(appJs, /active === "inicio"\) brand\.setAttribute\("aria-current", "page"\)/);
  const click = appJs.slice(appJs.indexOf('document.querySelector(".top .brand")?.addEventListener'), appJs.indexOf('document.querySelector(".dock")'));
  assert.match(click, /active = "inicio"/);
  assert.doesNotMatch(appJs, /data-dock-home/);
  assert.doesNotMatch(appJs, /\["inicio", "Inicio"\]/);
});

test("v6.3 caché v=68", () => {
  assert.match(html, /styles\.css\?v=68/);
  assert.match(html, /app\.js\?v=68/);
});
