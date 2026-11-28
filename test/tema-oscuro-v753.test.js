import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeSync } from "../lib/sync.js";

const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

function lin(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
function contrast(a, b) {
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
}

test("v7.5.3 el oscuro tiene contraste de texto y el QR sigue en blanco", () => {
  const dark = css.slice(css.indexOf("html.theme-dark:root:root"));
  const variable = (name) => {
    const found = dark.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(found, name);
    return found[1];
  };
  const pairs = [
    [variable("--ink"), variable("--bg"), "texto sobre el fondo"],
    [variable("--ink"), variable("--card"), "texto sobre la tarjeta"],
    [variable("--muted"), variable("--card"), "texto secundario"],
    [variable("--green"), variable("--card"), "verde"],
    [variable("--link"), variable("--card"), "enlace"],
    [variable("--btn-ink"), variable("--btn"), "botón"],
    ["#f6e3ad", "#3a2e12", "cartel En revisión"],
    ["#e8e8e8", "#2a332e", "tarjeta marcada"],
    ["#e4e4e4", "#2a332e", "botones de la marcada"],
    ["#111111", "#ffffff", "QR"],
  ];
  for (const [ink, bg, label] of pairs) {
    assert.ok(contrast(ink, bg) >= 4.5, `${label}: ${contrast(ink, bg).toFixed(2)}`);
  }
  assert.match(dark, /html\.theme-dark \.sync-qr,\s*html\.theme-dark \.sync-qr svg \{ background: #fff; color: #111; \}/);
  assert.match(dark, /html\.theme-dark \.review-banner \{[^}]*background: #3a2e12;/);
  assert.match(dark, /html\.theme-dark \.card\.read[\s\S]*background: #2a332e;/);
});

test("v7.5.3 el tema se aplica al momento, se guarda y viaja con la vista", () => {
  const theme = appJs.slice(appJs.indexOf("function paintTheme"), appJs.indexOf("async function archiveById"));
  assert.match(theme, /classList\.toggle\("theme-dark", dark\)/);
  assert.match(theme, /localStorage\.setItem\("alerta_theme", theme\)/);
  assert.match(theme, /meta\.content = dark \? "#101812" : "#1b4332"/);
  assert.match(theme, /bar\.content = dark \? "black" : "default"/);
  assert.match(theme, /if \(!options\.silent\) touchView\(\)/);
  assert.match(appJs, /theme: savedTheme\(\)/);
  assert.match(appJs, /paintTheme\(view\.theme, \{ silent: true \}\)/);
  assert.match(html, /classList\.add\("theme-dark"\)/);
  assert.match(html, /apple-mobile-web-app-status-bar-style/);
  const merged = mergeSync(
    { view: { theme: "light", updatedAt: "2026-11-28T10:00:00.000Z" } },
    { view: { theme: "dark", sectors: ["ganaderia"], updatedAt: "2026-11-28T12:00:00.000Z" } }
  );
  assert.equal(merged.view.theme, "dark");
  assert.deepEqual(merged.view.sectors, ["ganaderia"]);
});
