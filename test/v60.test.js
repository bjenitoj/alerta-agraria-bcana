import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

test("v6.0 Ajustes: «Guía de usuario» breve con cada pestaña y botón", () => {
  const guide = indexHtml.slice(indexHtml.indexOf('id="acc-guia"'), indexHtml.indexOf("</dl>"));
  for (const name of ["Resumen", "Herramientas", "Ajustes", "Ayudas", "Calendario PAC", "Varios", "Normativa", "Precios", "Alertas", "Favoritas", "Agricultura · Ganadería · Pesca", "★ Favorita · Compartir", "Borrar marcadas"]) {
    assert.ok(guide.includes(`<dt>${name}</dt>`), name);
  }
  for (const dd of guide.matchAll(/<dd>(.*?)<\/dd>/g)) assert.ok(dd[1].length <= 200, `breve: ${dd[1]}`);
});

test("v6.0 Alertas: «Avisos oficiales de tu zona», «Alertas (n)» y sin párrafo explicativo", () => {
  assert.match(appJs, /<p class="eyebrow">Avisos oficiales de tu zona<\/p><h2[^>]*>Alertas \(\$\{alertList\(\)\.length\}\)<\/h2><\/section>/);
  assert.doesNotMatch(appJs, /que no salen en Ayudas, Normativa ni en otra sección/);
});

test("v6.0 Precios y Normativa: sin nota «Fuente… Leídos el», sin «Toca una noticia…»; enlaces y aviso siguen", () => {
  assert.doesNotMatch(appJs, /<p class="note">Fuente: [^<]*Leídos el/);
  assert.match(appJs, /Tabla oficial de cotizaciones/);
  assert.doesNotMatch(appJs, /Toca una noticia para marcarla como leída\./);
});

test("v6.0 Calendario PAC: tarjetas AHORA (naranja) y PRÓXIMAS (verde), lista en Ahora / Próximas", () => {
  const cal = appJs.slice(appJs.indexOf("function renderPacCalendar"), appJs.indexOf("function priceSourcePicker"));
  assert.doesNotMatch(cal, /Campaña \$\{/);
  assert.doesNotMatch(cal, /pacData\.notice/);
  assert.match(cal, /pac-card pac-now"><p class="eyebrow">Ahora/);
  assert.match(cal, /upcoming\.slice\(0, 3\)/);
  assert.match(cal, /part\("Ahora", now/);
  assert.match(cal, /part\("Próximas", upcoming/);
  assert.match(css, /\.pac-now \{ background: #c25e00; \}/);
});

test("v6.8 cabecera: nombre en dos líneas, sin «Para tu explotación»; «Última consulta» sigue en dos líneas", () => {
  assert.match(indexHtml, /<strong>Alerta<\/strong>\s*<strong>Agraria<\/strong>/);
  assert.doesNotMatch(indexHtml, /Para tu explotación/);
  assert.match(appJs, /<span>Última consulta<\/span><span>/);
  assert.match(css, /\.stamp span \{ display: block; \}/);
  assert.match(css, /\.brand \.brand-name,[\s\S]{0,120}height: 48px/);
  assert.match(indexHtml, /app\.js\?v=69/);
});

test("v6.0 números de cuenta entre paréntesis en todas las pantallas (no los cuadros grandes de Alertas)", () => {
  for (const re of [
    /<span class="count">\(\$\{count\}\)<\/span>/, // pestañas
    /\$\{escapeHtml\(typeLabel\)\} <span class="count">\(\$\{total\}\)<\/span>/, // Inicio
    />Ver \(\$\{total\}\)<\/button>/,
    /<strong>\(\$\{view\.counts\[entry\.id\]\}\)<\/strong>/, // Ayudas
    /Publicado últimamente \(BOE y BOCyL\) <span class="count">\(\$\{recent\.length\}\)/,
    /Favoritas <span>\(\$\{entries\.length\}\)/,
    /badge\.textContent = `\(\$\{count > 99/,
  ]) assert.match(appJs, re);
  assert.match(appJs, /<strong>\$\{officialAlerts\(entry\.id\)\.length\}<\/strong>/, "cuadros grandes de Alertas sin paréntesis");
});

test("v6.0 un solo nombre: «Calendario PAC» (no «Pagos PAC») en Inicio", () => {
  assert.doesNotMatch(appJs, /Pagos PAC/);
  assert.match(appJs, /<span class="eyebrow">Calendario PAC<\/span>/);
});
