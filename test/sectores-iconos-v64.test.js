import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const glyphs = appJs.slice(appJs.indexOf("const GLYPH = {"), appJs.indexOf("EMOJI.agricultura"));

test("v6.4 sectores: SVG propios de espiga, vaca y pez, sin emoji", () => {
  for (const id of ["agricultura", "ganaderia", "pesca"]) {
    assert.match(glyphs, new RegExp(`${id}: sectorIcon\\("${id}"`));
    assert.match(appJs, new RegExp(`EMOJI\\.${id} = GLYPH\\.${id}`));
  }
  assert.match(glyphs, /class="accent"/);
  assert.doesNotMatch(glyphs, /🌾|🐄|🐟/);
  const emoji = appJs.slice(appJs.indexOf("const EMOJI = {"), appJs.indexOf("const SHORT"));
  assert.doesNotMatch(emoji, /agricultura: "🌾"|ganaderia: "🐄"|pesca: "🐟"/);
});

test("v6.4 sectores: mismo trazo, borde fino y acento cálido", () => {
  assert.match(css, /\.sector-ico \{[^}]*stroke-width: 1\.8/);
  assert.match(css, /\.sector-ico \{[^}]*stroke-linecap: round/);
  assert.match(css, /\.sector-ico\.s-ganaderia \{ --accent: #c86b45; \}/);
  assert.match(css, /\.sector-ico\.s-pesca \{ --accent: #e07a4c; \}/);
  assert.match(css, /\.sector-ico \.accent \{ fill: var\(--accent\)/);
  const border = css.slice(css.indexOf("/* Iconos con borde fino"));
  assert.ok(border.includes(".sector-ico"));
  assert.match(html, /styles\.css\?v=61/);
  assert.match(html, /app\.js\?v=61/);
});
