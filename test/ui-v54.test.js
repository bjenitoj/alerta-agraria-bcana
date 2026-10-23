import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const header = indexHtml.slice(indexHtml.indexOf('<header class="top"'), indexHtml.indexOf("</header>"));
const dock = indexHtml.slice(indexHtml.indexOf('<nav class="dock'), indexHtml.indexOf("</nav>", indexHtml.indexOf('<nav class="dock')));
const fn = (name, next) => appJs.slice(appJs.indexOf(`function ${name}`), appJs.indexOf(`function ${next}`));

test("v5.4 cabecera: solo «Resumen» y el engranaje «Ajustes»; sin Oscuro ni barra de preferencias", () => {
  assert.doesNotMatch(indexHtml, /themeToggle/);
  assert.doesNotMatch(appJs, /themeToggle/);
  assert.doesNotMatch(indexHtml, /id="prefsBar"/);
  assert.doesNotMatch(appJs, /prefsBar/);
  assert.doesNotMatch(header, />\s*Oscuro\s*</);
  assert.doesNotMatch(header, /Mis preferencias/);
  const buttons = header.match(/<button[^>]*>/g) || [];
  const visible = buttons.filter((b) => !/admin-only/.test(b));
  assert.equal(visible.length, 2, "solo dos botones para el público");
  assert.match(header, /<button id="digestBtn"[^>]*aria-label="Resumen del día"/);
  assert.match(header, /<button id="settingsBtn"[^>]*aria-label="Ajustes"[^>]*aria-controls="prefSheet"/);
  // iconos SVG de trazo (no emoji) y texto visible en pantallas anchas
  const settings = header.slice(header.indexOf('id="settingsBtn"'));
  assert.match(settings, /<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"\/><path d="M19\.4 15/);
  assert.match(settings, /<span class="head-text">Ajustes<\/span>/);
  const digest = header.slice(header.indexOf('id="digestBtn"'), header.indexOf('id="settingsBtn"'));
  assert.match(digest, /<svg viewBox="0 0 24 24"/);
  assert.match(digest, /<span class="head-text">Resumen<\/span>/);
  assert.match(digest, /class="head-badge" hidden/);
  assert.doesNotMatch(header, /[\u2699\u{1F4F0}\u{1F5DE}]/u, "sin emojis");
  // en móvil estrecho solo el icono (texto oculto de forma accesible)
  const narrow = css.slice(css.indexOf("@media (max-width: 560px) {\n  .head-text"));
  assert.match(narrow, /\.head-text \{ position: absolute; width: 1px/);
  assert.match(css, /\.head-btn svg \{[^}]*fill: none; stroke: currentColor; stroke-width: 1\.8/);
});

test("v5.4 Ajustes: tema Claro/Oscuro/Automático con la misma persistencia y «Mis preferencias» dentro", () => {
  const sheet = indexHtml.slice(indexHtml.indexOf('<div id="prefSheet"'), indexHtml.indexOf('<nav class="dock'));
  assert.match(sheet, /<h2 id="sheetTitle">Ajustes<\/h2>/);
  for (const id of ["light", "dark", "auto"]) assert.match(sheet, new RegExp(`data-theme-choice="${id}"`));
  assert.match(sheet, />Claro</);
  assert.match(sheet, />Oscuro</);
  assert.match(sheet, />Automático</);
  assert.match(sheet, /class="settings-prefs private" id="prefsSection"/);
  assert.match(sheet, /Mis preferencias/);
  assert.match(sheet, /id="filters"/);
  assert.ok(sheet.indexOf("settings-theme") < sheet.indexOf("prefsSection"), "el tema va arriba");
  const theme = appJs.slice(appJs.indexOf("function savedTheme"), appJs.indexOf("async function archiveById"));
  assert.match(theme, /localStorage\.setItem\("alerta_theme", theme\)/);
  assert.match(theme, /localStorage\.removeItem\("alerta_theme"\)/, "Automático vuelve a seguir el sistema");
  assert.match(theme, /aria-checked/);
  assert.match(appJs, /settingsBtn\?\.addEventListener\("click", \(\) => setSheet\(prefSheet\?\.hidden\)\)/);
  // el panel se puede abrir también en las páginas sueltas (solo el tema; las preferencias son .private)
  assert.match(indexHtml, /<div id="prefSheet" class="pref-sheet" hidden>/);
});

test("v5.4 Resumen: botón de cabecera, fuera del cuerpo de Inicio y contador solo real", () => {
  const boardBody = appJs.slice(appJs.indexOf("function renderBoard"), appJs.indexOf("function", appJs.indexOf("function renderBoard") + 20));
  assert.doesNotMatch(boardBody, /digestCard\(/, "Inicio ya no lleva el bloque del resumen");
  const click = appJs.slice(appJs.indexOf("digestBtn?.addEventListener"), appJs.indexOf("document.getElementById(\"closeSheet\")"));
  assert.match(click, /active = "resumen"/);
  assert.match(click, /location\.href = "\/#resumen"/);
  assert.match(appJs, /let active = location\.hash === "#resumen" \? "resumen" : "inicio"/);
  const badge = fn("digestBadgeCount", "paintDigestBtn");
  assert.match(badge, /data\.visible\.length/, "cuenta lo que se ve en el resumen (tipos elegidos)");
  const paint = fn("paintDigestBtn", "digestCard");
  assert.match(paint, /badge\.hidden = !count/, "sin novedades no hay número");
  const data = fn("digestData", "digestBadgeCount");
  assert.match(data, /digestSelection\(/);
  assert.match(data, /hasSourceUrl/);
  assert.match(appJs, /Cambiar en Ajustes › Mis preferencias/);
});

test("v5.4 barra de abajo: Inicio, Ayudas, PAC y Precios (sin Resumen ni Preferencias)", () => {
  const tabs = [...dock.matchAll(/data-dock="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ["inicio", "ayudas", "pac", "campo"]);
  assert.match(dock, /Precios/);
  assert.match(css, /\.dock \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
});

test("v5.4 «← Inicio» en todas las vistas que no son Inicio y en las páginas sueltas", () => {
  assert.match(appJs, /const BACK_HOME_TAB = `<button type="button" class="back-home" data-goto="inicio">← Inicio<\/button>`/);
  assert.match(appJs, /appEl\.innerHTML = active === "inicio" \? html : `\$\{BACK_HOME_TAB\}\$\{html\}`/);
  const pub = appJs.slice(appJs.indexOf("async function renderPublic"));
  assert.match(pub.slice(0, 600), /insertAdjacentHTML\("beforebegin", BACK_HOME_PAGE\)/, "antes de cualquier página suelta");
  assert.match(appJs, /<a class="back-home back-home-page" href="\/">← Inicio<\/a>/);
  for (const page of ["/fuentes", "/herramientas", "/aviso-legal", "/privacidad", "/cookies", "/quienes-somos", "/planes"]) {
    assert.match(appJs, new RegExp(`"${page}"`), page);
  }
  assert.match(css, /\.back-home \{/);
});

test("v5.4 texto sobre cuentas/planes: pequeño, gris, sin caja ni negrita", () => {
  const strip = fn("planStrip", "baseItems");
  assert.match(strip, /<p class="plan-soon">/);
  assert.doesNotMatch(strip, /<h2>|<section/);
  assert.match(appJs, /<p class="account-note">Todavía no se contrata ni se cobra\.<\/p>/);
  assert.match(appJs, /<p class="account-note">Se guarda solo en este navegador: no hay cuenta ni se envía nada\.<\/p>/);
  const rule = css.slice(css.indexOf(".plan-soon, .account-note {"), css.indexOf("}", css.indexOf(".plan-soon, .account-note {")));
  assert.match(rule, /color: var\(--muted\)/);
  assert.match(rule, /font-size: 14px/);
  assert.match(rule, /font-weight: 400/);
  assert.match(rule, /border: 0/);
  assert.match(rule, /background: none/);
  assert.match(rule, /box-shadow: none/);
});
