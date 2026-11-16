import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const wide = css.slice(css.indexOf("/* v6.5 · iPad y web: Ajustes"));

test("v6.5 Ajustes en iPad y web: debajo de la cabecera y más grande", () => {
  assert.match(wide, /@media \(min-width: 901px\)/);
  assert.match(wide, /\.pref-sheet \{[^}]*top: var\(--chrome-h, 156px\)/);
  assert.match(wide, /\.pref-sheet \{[^}]*padding: 12px 8px 16px/);
  assert.match(wide, /\.pref-sheet \.sheet-card \{[^}]*width: 100%/);
  assert.match(wide, /\.pref-sheet \.sheet-card \{[^}]*height: auto/);
  assert.match(wide, /\.pref-sheet \.sheet-card \{[^}]*max-height: calc\(100dvh - var\(--chrome-h, 156px\) - 28px\)/);
  assert.match(wide, /\.pref-sheet \.sheet-head \{[^}]*position: sticky/);
  assert.match(appJs, /--chrome-h/);
  assert.match(appJs, /top\.getBoundingClientRect\(\)\.bottom/);
  assert.match(html, /styles\.css\?v=71/);
  assert.match(html, /app\.js\?v=71/);
});

test("v6.5 el asistente también baja en pantallas anchas; el móvil no usa ese top", () => {
  assert.match(wide, /\.wizard, body\[data-review="on"\] \.wizard \{[^}]*padding-top: calc\(var\(--chrome-h, 156px\) \+ 12px\)/);
  const mobile = css.slice(css.indexOf(".pref-sheet {"), css.indexOf(".sheet-card {"));
  assert.match(mobile, /align-items: end/);
  assert.doesNotMatch(mobile, /--chrome-h/);
});
