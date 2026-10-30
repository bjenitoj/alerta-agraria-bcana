import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEGAL_PAGES } from "../lib/legal.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const footer = indexHtml.slice(indexHtml.indexOf("<footer"), indexHtml.indexOf("</footer>"));

test("v5.6 sin lista «Estado de las fuentes» al final de las páginas", () => {
  assert.doesNotMatch(indexHtml, /Estado de las fuentes/);
  assert.doesNotMatch(indexHtml, /id="sources"/);
  assert.doesNotMatch(appJs, /renderSources|sourcesEl/);
  // La página «Fuentes oficiales» sigue con el listado completo y su estado.
  assert.match(appJs, /fetch\("\/api\/fuentes"/);
  assert.match(appJs, /STATUS_TEXT\[source\.status\]/);
});

test("v5.6 pie discreto: frase legal y enlaces a Fuentes oficiales y Aviso legal", () => {
  assert.match(footer, /class="site-foot"/);
  assert.match(footer, /Información obtenida de fuentes oficiales, con enlace y fecha en cada aviso\. Esta app no está vinculada a ningún organismo público\./);
  assert.match(footer, /<a href="\/fuentes">Fuentes oficiales<\/a>/);
  assert.match(footer, /<a href="\/aviso-legal">Aviso legal<\/a>/);
  assert.doesNotMatch(footer, /\bBC\b/, "el titular solo sale en el aviso legal");
  assert.match(css, /\.site-foot \{[^}]*font-size: 13px;[^}]*color: var\(--muted\)/);
  // No lo tapa la barra inferior del móvil.
  assert.match(css, /footer \{ padding: 8px 0 calc\(108px \+ env\(safe-area-inset-bottom\)\); \}/);
});

test("v5.6 aviso legal: condiciones de reutilización (Ley 37/2007)", () => {
  const text = LEGAL_PAGES["aviso-legal"].blocks.map((b) => b.text || "").join(" ");
  assert.match(text, /Ley 37\/2007/);
  assert.match(text, /se cita la fuente/);
  assert.match(text, /fecha de publicación o de la última actualización/);
  assert.match(text, /no está vinculada a ningún organismo público/);
});

test("v5.6 cada pieza lleva fuente y fecha (también en «Lo que has puesto primero» y la tarjeta PAC de Inicio)", () => {
  assert.match(appJs, /class="official src-btn" href="\$\{escapeHtml\(item\.url\)\}" target="_blank"/);
  assert.match(appJs, /const published = item\.publishedAt \? `<p class="origin pub">Publicado: \$\{escapeHtml\(fmtDay\(item\.publishedAt\)\)\}<\/p>` : "";/);
  assert.match(appJs, /item\.sourceName \|\| "Fuente oficial"\)\}\$\{item\.publishedAt \? ` · \$\{escapeHtml\(fmtDay\(item\.publishedAt\)\)\}` : ""\}/);
  assert.doesNotMatch(appJs, /la fuente no indica la fecha/);
  assert.match(appJs, /Revisado el \$\{escapeHtml\(fmtDay\(pacData\.updated\)\)\}` : ""/);
});

test("v5.6 sin botón «← Inicio»: se vuelve tocando «Alerta Agraria» y con la barra inferior", () => {
  assert.doesNotMatch(appJs, /← Inicio|BACK_HOME/);
  assert.doesNotMatch(css, /\.back-home/);
  assert.match(indexHtml, /<a class="brand" href="\/">/);
  assert.match(appJs, /document\.querySelector\("\.top \.brand"\)\?\.addEventListener\("click"/);
  // v5.8: en el móvil se vuelve a Inicio con el logo (la barra ya no lleva «Inicio»).
  assert.doesNotMatch(indexHtml, /data-dock="inicio"/);
  assert.match(indexHtml, /styles\.css\?v=49/);
  assert.match(indexHtml, /app\.js\?v=49/);
});

const card = appJs.slice(appJs.indexOf("function aidCard"), appJs.indexOf("function sortedItems"));

test("v5.6 ficha: sin chips «Plazo no indicado», «Fuera de tus filtros», «Sin plazo indicado», «Línea», «Ayuda» ni sector", () => {
  assert.match(appJs, /if \(info\.kind === "none"\) return "";/);
  assert.doesNotMatch(card, /Fuera de tus filtros|En tus filtros|>Línea</);
  assert.match(card, /aid\.status === "abierta" && showAid/, "solo estados con plazo real (v5.6: sin «Próxima apertura»)");
  assert.match(card, /readBadge\(read\)/, "se mantiene «Nueva»");
  const types = appJs.slice(appJs.indexOf("function typeRow"), appJs.indexOf("function readBadge"));
  assert.doesNotMatch(types, /"Ayuda"|sectorEvidence/);
  assert.match(types, /"PAC"/);
});

test("v5.6 ficha: título en mayúsculas y sin «Por qué te puede interesar»", () => {
  assert.match(css, /\.card h3 \{ text-transform: uppercase;/);
  assert.doesNotMatch(appJs, /whyBlock|Por qué te puede interesar/);
});

test("v5.6 ficha: Favorita y Compartir arriba; abajo sin WhatsApp, calendario vacío, Ocultar ni «Abrir fuente oficial»", () => {
  assert.match(card, /<div class="top-right">\$\{daysBadge\(aid\)\}\$\{topActions\(item\)\}<\/div>/);
  const top = appJs.slice(appJs.indexOf("function topActions"), appJs.indexOf("function calendarLink"));
  assert.match(top, /data-fav=/);
  assert.match(top, /data-share=/);
  assert.match(appJs, /navigator\.share\(\{ title:/);
  assert.match(appJs, /window\.open\(button\.dataset\.wa, "_blank", "noopener"\)/);
  assert.doesNotMatch(appJs, /shareButtons|Sin fecha para el calendario|Ocultar esta ayuda|Compartir por WhatsApp/);
  assert.doesNotMatch(card, /Abrir fuente oficial/);
  assert.match(card, /\$\{calendarLink\(item\)\}/, "calendario pequeño solo con fecha real");
  assert.match(appJs, /const ics = info\.kind !== "closed" \? icsHref\(item\) : "";\n  return ics \?/);
  assert.match(card, /class="text-btn mark-unread"/);
});

test("v5.6/v5.8 cabecera: Resumen, Herramientas y Ajustes (v5.8 sin Preferencias); Herramientas fuera de las pestañas", () => {
  const header = indexHtml.slice(indexHtml.indexOf('<header class="top"'), indexHtml.indexOf("</header>"));
  const order = ["digestBtn", "toolsBtn", "settingsBtn"].map((id) => header.indexOf(`id="${id}"`));
  assert.ok(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1])), "orden");
  assert.match(header, /id="toolsBtn"[^>]*aria-label="Herramientas oficiales"><svg viewBox="0 0 24 24"/);
  assert.doesNotMatch(appJs, /\["herramientas", "Herramientas"\]/);
  const dock = indexHtml.slice(indexHtml.indexOf('<nav class="dock'));
  // v5.8: en el móvil la barra lleva un botón que abre la misma Herramientas de la cabecera (no una pestaña propia).
  assert.doesNotMatch(dock.slice(0, dock.indexOf("</nav>")), /data-dock="herramientas"/);
  assert.match(appJs, /location\.href = "\/herramientas"/);
});

test("v5.6 sin «Ocultar» en ningún sitio; lo ocultado antes vuelve a verse; «Borrar leídas» sigue", () => {
  assert.doesNotMatch(appJs, /data-hide|data-unhide|hideAid|showHiddenAgain|hiddenAids|isHidden\(/);
  assert.doesNotMatch(indexHtml, /restoreHidden|ocultas/i);
  assert.match(appJs, /localStorage\.removeItem\(OLD_HIDE_KEY\)/);
  assert.match(appJs, /const OLD_HIDE_KEY = "alerta_ocultadas_v1";/);
  // Las listas de ocultas/suprimidas de la administración no afectan al público.
  assert.match(appJs, /const hidden = admin \? readSet\(bucket\) : new Set\(\);/);
  assert.match(appJs, /options\.keepArchived \|\| !admin \? new Set\(\) : readSet\("alerta_suprimidas"\)/);
  assert.match(appJs, /data-clear-read="1"/);
  assert.match(indexHtml, /id="restoreDeleted"/);
});

test("v5.6 Inicio compacto: sin pestaña «Resumen» (queda el botón de cabecera); pestañas, chips y cuadros más pequeños", () => {
  const tabs = appJs.slice(appJs.indexOf("function renderTabs"), appJs.indexOf("function render()"));
  assert.doesNotMatch(tabs, /\["resumen", "Resumen"\]/);
  assert.match(indexHtml, /id="digestBtn"/);
  assert.match(css, /\.tabs \.tab \{ min-height: 38px;/);
  assert.match(css, /\.board \.filter-row \.chip \{ min-height: 36px;/);
  assert.match(css, /\.glance \.stat strong \{ font-size: 24px; \}/);
});

test("v5.6 solo abiertas siempre: sin «Solo abiertas», sin «Próximas», sin «Todos»; sectores de selección múltiple", () => {
  assert.doesNotMatch(appJs, /soloAbiertas|data-open-only|Solo abiertas<\/button>/);
  const live = appJs.slice(appJs.indexOf("function isLiveAid"), appJs.indexOf("const SECTOR_CHIPS_KEY"));
  assert.match(live, /aid\?\.status === "cerrada" \|\| aid\?\.status === "proxima"/);
  assert.match(live, /kind !== "closed" && kind !== "upcoming"/);
  const base = appJs.slice(appJs.indexOf("function baseItems"), appJs.indexOf("function filterRow"));
  // v5.7: solo las ayudas pasan por isLiveAid; Normativa y lo demás sale siempre.
  assert.match(base, /if \(!options\.allStatus && !shownByStatus\(item, today\)\) return false;/);
  assert.match(appJs, /inSector\(item\) && shownByStatus\(item\);/, "Resumen");
  assert.match(appJs, /isLiveAid\(item\.aid, today\) && closesWithin/, "plazos que cierran");
  assert.match(appJs, /return isLiveAid\(\(current \|\| fav\)\.aid, today\);/, "favoritas");
  // v5.7: «Próximas» vuelve solo como chip de la pestaña Ayudas; en Inicio no hay cuadro de próximas.
  assert.doesNotMatch(appJs.slice(appJs.indexOf("const GLANCE = ["), appJs.indexOf("const GLANCE_LIMIT")), /proxima/);
  const row = appJs.slice(appJs.indexOf("function filterRow"), appJs.indexOf("let pacData"));
  assert.match(row, /CHIP_SECTORS\.map/);
  assert.match(appJs, /const CHIP_SECTORS = SECTORS\.filter\(\(sector\) => sector\.id !== "todos"\);/);
  assert.match(appJs, /const SECTOR_CHIPS_KEY = "alerta_sectores_v1";/);
  assert.match(css, /\.glance \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
});

test("v5.6 /fuentes: estado de las fuentes discreto y «Preparadas» en un desplegable cerrado con su número", async () => {
  const fn = appJs.slice(appJs.indexOf("function sourceStatusList"), appJs.indexOf("async function renderPlans"));
  const escapeHtml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const list = new Function("escapeHtml", "fmtStamp", `${fn}; return sourceStatusList;`)(escapeHtml, () => "28 oct 2026, 22:21");
  const html = list([
    { name: "BOE alimentación", status: "ok", count: 3, lastOkAt: "x" },
    { name: "BDNS", status: "error", error: "Tiempo de espera agotado" },
    { name: "RASVE", status: "preparada" }, { name: "DOG", status: "preparada" },
  ]);
  assert.match(html, /<span class="src-name">BOE alimentación<\/span> <span class="src-meta">3 piezas · Última lectura correcta: 28 oct 2026, 22:21/, "espacio entre nombre y número");
  assert.match(html, /<span class="src-err">Tiempo de espera agotado<\/span>/);
  assert.match(html, /<details class="src-prepared"><summary>Preparadas, aún no consultadas \(2\)<\/summary>/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.doesNotMatch(html, /source-card/);
  assert.match(css, /\.src-status \{ margin: 14px 0 18px; font-size: 13px;/);
  const { publicSourceView } = await import("../lib/config.js");
  assert.ok("count" in publicSourceView({}).sources[0]);
});
