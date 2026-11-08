import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const header = html.slice(html.indexOf('<header class="top"'), html.indexOf("</header>"));
const APP = "https://alerta-agraria-bcana.onrender.com/";

test("v6.8 cabecera: compartir la app junto al nombre, icono de flecha y verde de WhatsApp", () => {
  const row = header.slice(header.indexOf('<div class="brand-row"'), header.indexOf('<div class="top-tools">'));
  assert.match(row, /<a class="brand" href="\/">/);
  assert.match(row, /<strong>Alerta<\/strong>/);
  assert.match(row, /<strong>Agraria<\/strong>/);
  assert.doesNotMatch(row, /Para tu explotación/);
  const btn = row.match(/<a id="shareApp" class="share-app" href="([^"]+)"[^>]*>/);
  assert.ok(btn, "falta el botón");
  assert.match(row, /aria-label="Compartir la app"/);
  assert.match(row, /title="Compartir la app"/);
  assert.match(row, /target="_blank"/);
  assert.match(row, /<path d="M12 15V3"\/>/);
  assert.doesNotMatch(row, /M4\.5 19\.5|whatsapp/i, "no es el logotipo de WhatsApp");
  const text = decodeURIComponent(new URL(btn[1]).searchParams.get("text"));
  assert.match(text, /^Alerta Agraria: ayudas, PAC y avisos oficiales del campo\.\n/);
  assert.equal(text.trim().split("\n").at(-1), APP);
  assert.equal((text.match(/alerta-agraria-bcana\.onrender\.com/g) || []).length, 1);
  assert.doesNotMatch(text, /preferenc|alerta_prefs|localhost|\/ayudas|\/favoritas/i);
  assert.match(css, /\.share-app \{[^}]*background: #25D366/);
  assert.match(css, /\.share-app svg \{[^}]*stroke: #fff/);
  assert.match(css, /\.brand-row \{[^}]*display: flex/);
});

test("v6.8 el compartir de cada ficha sigue igual y la caché es v=69", () => {
  assert.match(appJs, /data-share="\$\{escapeHtml\(item\.id\)\}"/);
  assert.match(appJs, /whatsappUrl\(item, today, appUrl\)/);
  assert.doesNotMatch(appJs, /shareApp|alerta-agraria-bcana\.onrender\.com/);
  assert.match(html, /styles\.css\?v=69/);
  assert.match(html, /app\.js\?v=69/);
  const guide = html.slice(html.indexOf('id="acc-guia"'), html.indexOf("</dl>"));
  assert.match(guide, /<dt>Compartir la app<\/dt><dd>El botón verde junto al nombre abre WhatsApp/);
});
