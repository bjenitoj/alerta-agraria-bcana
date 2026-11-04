import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

test("v6.2 estilo «Con color» es el diseño por defecto, sin interruptor ?estilo", () => {
  assert.doesNotMatch(html, /estilo/i);
  assert.doesNotMatch(appJs, /estilo-\d|alerta_estilo/);
  assert.doesNotMatch(css, /\.estilo-\d/);
  assert.match(css, /--green: #12704a/);
  assert.match(css, /\.tab\.active, \.chip\.on[^{]*\{[^}]*linear-gradient\(135deg, #12704a, #1f9a62\)/);
  assert.match(css, /\.top \{ position: sticky; top: var\(--rb-h, 0px\)/);
  assert.match(appJs, /function measureReviewBanner/);
  assert.match(html, /styles\.css\?v=54/);
  assert.match(html, /app\.js\?v=54/);
});

test("v6.2 estilo: siempre en claro, también con el sistema en oscuro", () => {
  const force = css.slice(css.lastIndexOf(":root:root:root {"));
  assert.match(force, /color-scheme: light/);
  assert.match(css, /:root\[data-theme="dark"\] \.review-banner \{ background: linear-gradient\(90deg, #fbeec8, #f6e3ad\)/);
});

test("v6.2 estilo: iconos con borde fino en chips, barra, Herramientas, Alertas y Normativa", () => {
  const i = css.indexOf("/* Iconos con borde fino");
  assert.ok(i > 0);
  const block = css.slice(i);
  for (const sel of [".tab-icon", ".chip svg", ".dock svg", ".tool-icon", ".norma-ico", ".head-btn svg"]) assert.ok(block.includes(sel), sel);
  assert.match(block, /border: 1px solid color-mix\(in srgb, currentColor 60%, #0b3d26\)/);
  assert.match(block, /background: color-mix\(in srgb, currentColor 10%, #ffffff\)/);
  assert.match(block, /\.tab\.active \.tab-icon[^{]*\{[^}]*border-color: rgba\(255, 255, 255, \.75\)/);
});
