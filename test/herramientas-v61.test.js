import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePlace } from "../lib/places.js";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const tools = JSON.parse(readFileSync(new URL("../config/herramientas.json", import.meta.url), "utf8"));
const toolsHtml = new Function("escapeHtml", "NOTICE", "document", "normalizePlace", `${appJs.slice(appJs.indexOf("const TOOL_ICONS"), appJs.indexOf("function closeToolPops"))}; return toolsHtml;`)(
  (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"), "Información orientativa.", {}, normalizePlace);
const SAL = { country: "es", ccaa: ["es-cl"], province: ["37"], comarca: [] };
const html = toolsHtml(tools, SAL);

test("v6.1 Herramientas: sin eyebrow y párrafo corto", () => {
  assert.doesNotMatch(html, /<p class="eyebrow">Herramientas oficiales/);
  assert.match(html, /<\/span><\/h2>\s*<p>Enlaces a webs y apps oficiales\.<\/p>/);
  assert.doesNotMatch(html, /Cada herramienta lleva su nombre/);
});

test("v6.1 Herramientas: cuadrícula de iconos con enlace oficial, «i» y ventana con ✕", () => {
  const all = tools.grupos.flatMap((g) => g.enlaces);
  assert.equal((html.match(/class="tool-link"/g) || []).length, all.length);
  assert.equal((html.match(/class="tool-i"/g) || []).length, all.length + 1);
  for (const link of all) {
    assert.ok(link.corto && link.icono, link.nombre);
    assert.ok(html.includes(`href="${link.url}" target="_blank" rel="noopener" aria-label="${link.nombre.replace(/&/g, "&amp;")} (abre la web oficial)"`), link.nombre);
  }
  assert.match(html, /<svg class="tool-icon"/);
  assert.match(html, /role="dialog"[^>]*hidden>\s*<button type="button" class="tool-pop-close" data-tool-close aria-label="Cerrar">✕/);
  assert.match(appJs, /!event\.target\.closest\("\.tool-pop"\)\) closeToolPops\(\)/, "se cierra al tocar fuera");
});

test("v6.1 SIGPAC CyL: cita recortada con «…», sin «La siguiente lista» ni «(texto de la página oficial)»", () => {
  assert.match(html, /<q>…muestra los municipios cuyo catastro renovado se ha incorporado al SIGPAC<\/q>/);
  assert.doesNotMatch(html, /La siguiente lista/);
  assert.doesNotMatch(appJs, /texto de la página oficial/);
});

test("v6.1 Calendario PAC: AHORA y PRÓXIMAS centrados; caché v=65", () => {
  assert.match(css, /\.pac-card > \.eyebrow \{ text-align: center; \}/);
  assert.match(indexHtml, /app\.js\?v=65/);
});

test("v6.1 «i» circular con margen y ✕ visible con zona táctil de 36px", () => {
  assert.match(css, /\.tool-i \{[^}]*top: 6px; right: 6px;[^}]*width: 22px; height: 22px;[^}]*aspect-ratio: 1; flex-shrink: 0; border-radius: 50%/);
  assert.match(css, /\.tool-i::before \{[^}]*inset: -11px/);
  assert.match(css, /\.tool-pop-close \{[^}]*width: 36px; height: 36px;[^}]*color: #1b2a22; font-size: 20px/);
});

test("v6.1 Herramientas por zona: ámbito en cada herramienta según su organismo", () => {
  const all = tools.grupos.flatMap((g) => g.enlaces);
  for (const link of all) {
    assert.ok(["nacional", "ccaa", "provincia", "comarca"].includes(link.ambito), link.nombre);
    if (/FEGA|Ministerio|BOE|Sistema Nacional/.test(link.organismo)) assert.equal(link.ambito, "nacional", link.nombre);
    if (/Junta de Castilla y León/.test(link.organismo)) assert.deepEqual([link.ambito, link.ccaa], ["ccaa", "es-cl"], link.nombre);
  }
});

test("v6.1 Herramientas por zona: Salamanca ve todas; solo España ve solo nacionales, aviso y sin secciones vacías", () => {
  const all = tools.grupos.flatMap((g) => g.enlaces);
  const nat = all.filter((l) => l.ambito === "nacional");
  assert.equal((html.match(/class="tool-link"/g) || []).length, all.length);
  assert.doesNotMatch(html, /alert-guide/);
  assert.match(html, /<h2 class="tools-title">Herramientas oficiales <span class="tool-tile tools-zone">\s*<button type="button" class="tool-i" data-tool-info="tool-pop-zona"/);
  assert.match(html, /id="tool-pop-zona" role="dialog"[^>]*hidden>[\s\S]*data-tool-close[\s\S]*Las nacionales salen siempre[\s\S]*ves todas las herramientas que te corresponden \(10\)[\s\S]*data-open-prefs="zona"/);
  const es = toolsHtml(tools, { country: "es", ccaa: [], province: [], comarca: [] });
  assert.equal((es.match(/class="tool-link"/g) || []).length, nat.length);
  assert.doesNotMatch(es, /SIGPAC en Castilla y León|BOCYL|Sativum/);
  assert.doesNotMatch(es, /alert-guide/);
  assert.match(es, /id="tool-pop-zona"[\s\S]*Solo tienes marcado «España»[\s\S]*\(\d+\) quedan ocultas[\s\S]*data-open-prefs="zona"/);
  assert.doesNotMatch(es, /<h3>Datos del campo<\/h3>/, "sección sin herramientas visibles no sale");
  const and = toolsHtml(tools, { country: "es", ccaa: ["es-an"], province: [], comarca: [] });
  assert.equal((and.match(/class="tool-link"/g) || []).length, nat.length);
  assert.match(and, /Las herramientas de otras zonas \(\d+\) no se muestran/);
});
