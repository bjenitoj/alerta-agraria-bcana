import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const header = indexHtml.slice(indexHtml.indexOf('<header class="top">'), indexHtml.indexOf("</header>"));
const fn = (from, to) => appJs.slice(appJs.indexOf(`function ${from}`), appJs.indexOf(`function ${to}`));

// Código real del módulo «leídas y borradas», con un localStorage de mentira.
const chunk = appJs.slice(appJs.indexOf('const READ_KEY = "alerta_leidas_v1"'), appJs.indexOf("// ── fin leídas y borradas ──"));
function load(initial = {}, favs = new Set()) {
  const ls = { ...initial };
  const api = new Function("readJson", "writeJson", "canonicalUrl", "isFavorite", "documentKeys", `${chunk}
    return { READ_KEY, READ_TTL_DAYS, pruneReadStore, loadReadStore, readKeyOf, markKeys, isReadItem, isDeletedItem, isClearedItem, setRead, deleteReadItems, undeleteKeys, restoreAllDeleted, store: () => readStore };`)(
    (key, fallback) => (key in ls ? JSON.parse(ls[key]) : fallback),
    (key, value) => { ls[key] = JSON.stringify(value); },
    (url) => (url ? String(url).replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/$/, "") : ""),
    (item) => favs.has(item.id),
    () => []);
  return { api, ls };
}
const item = (n) => ({ id: `a${n}`, title: `Pieza oficial ${n}`, url: `https://www.boe.es/diario/${n}` });
const DAY = 86400000;

test("v5.5 leídas: se guardan solo en este dispositivo (alerta_leidas_v1) y caducan a los 15 días", () => {
  const { api, ls } = load();
  assert.equal(api.READ_KEY, "alerta_leidas_v1");
  assert.equal(api.READ_TTL_DAYS, 15);
  const a = item(1);
  assert.equal(api.isReadItem(a), false);
  api.setRead(a, true);
  assert.equal(api.isReadItem(a), true);
  assert.ok(JSON.parse(ls.alerta_leidas_v1).read["u:boe.es/diario/1"], "clave por URL oficial");
  api.setRead(a, false);
  assert.equal(api.isReadItem(a), false, "Marcar como no leída");
  const now = Date.parse("2026-10-23T10:00:00Z");
  const pruned = api.pruneReadStore({ read: { old: new Date(now - 16 * DAY).toISOString(), recent: new Date(now - 14 * DAY).toISOString(), bad: "x" }, deleted: { gone: new Date(now - 15 * DAY - 1000).toISOString() } }, now);
  assert.deepEqual(Object.keys(pruned.read), ["recent"]);
  assert.deepEqual(pruned.deleted, {});
  // nada de servidor ni cuentas en el módulo
  assert.doesNotMatch(chunk, /fetch\(|api\(|\/api\//);
});

test("v5.5 leídas: las marcas antiguas (alerta_leidas_local) se conservan", () => {
  const { api } = load({ alerta_leidas_local: JSON.stringify(["a7"]) });
  assert.equal(api.isReadItem(item(7)), true);
  assert.equal(api.isReadItem(item(8)), false);
});

test("v6.5 Borrar marcadas: quita las marcadas (también si son favoritas en las listas), Deshacer y Recuperar", () => {
  const { api } = load({}, new Set(["a3"]));
  const items = [item(1), item(2), item(3), item(4)];
  api.setRead(items[0], true);
  api.setRead(items[2], true); // favorita: sale de las listas, el registro de favoritas no se toca
  api.setRead(items[3], true);
  const keys = api.deleteReadItems(items);
  assert.equal(keys.length, 3);
  assert.deepEqual(items.map(api.isDeletedItem), [true, false, true, true]);
  assert.doesNotMatch(appJs.slice(appJs.indexOf("function deleteReadItems"), appJs.indexOf("function undeleteKeys")), /FAV_KEY|favorites\[/);
  api.undeleteKeys(keys);
  assert.deepEqual(items.map(api.isDeletedItem), [false, false, false, false]);
  api.deleteReadItems(items);
  assert.equal(api.restoreAllDeleted(), 3);
  assert.equal(items.some(api.isDeletedItem), false);
});

test("v6.5 marcar no oculta; borrar sí, en todas las pestañas, y Favoritas no filtra", () => {
  const { api } = load({}, new Set(["fav"]));
  const title = "Resolución de ayudas a la modernización de explotaciones agrarias en Castilla y León";
  const inAyudas = { id: "ayudas-1", title, url: "https://bocyl.jcyl.es/boletin/a" };
  const inResumen = { id: "resumen-9", title, url: "https://agricultura.jcyl.es/web/otra-ficha" };
  api.setRead(inAyudas, true);
  assert.equal(api.isReadItem(inAyudas), true);
  assert.equal(api.isReadItem(inResumen), true, "la misma historia queda marcada en Resumen");
  assert.equal(api.isClearedItem(inAyudas), false, "marcar no la quita");
  assert.equal(api.isClearedItem(inResumen), false);
  api.setRead(inAyudas, false);
  assert.equal(api.isReadItem(inResumen), false, "desmarcar vale para las dos");
  api.setRead(inAyudas, true);
  const favorite = { id: "fav", title: "Ayuda favorita que no debe perderse nunca jamás del todo", url: "https://www.boe.es/diario/fav" };
  api.setRead(favorite, true);
  const removed = api.deleteReadItems([inAyudas, favorite]);
  assert.deepEqual(removed, ["u:bocyl.jcyl.es/boletin/a", "u:boe.es/diario/fav"]);
  assert.equal(api.isClearedItem(inResumen), true, "borrar quita la misma historia del Resumen");
  assert.equal(api.isDeletedItem(favorite), true, "sale de las listas");
  const base = fn("baseItems", "filterRow");
  assert.match(base, /isClearedItem\(item\) \|\| isFavorite\(item\)/);
  assert.match(appJs, /function isClearedItem\(item\) \{\n  return isDeletedItem\(item\);\n\}/);
  const digest = fn("digestData", "prevDay");
  assert.match(digest, /!isClearedItem\(item\)/);
  const fav = fn("renderFavorites", "milestoneRow");
  assert.doesNotMatch(fav, /isClearedItem|isDeletedItem/);
});

test("v5.5 tarjeta: tocarla la marca, «✓ Leída», «Marcar como no leída» y el enlace oficial también marca", () => {
  const card = fn("aidCard", "renderList");
  assert.match(card, /\$\{read \? "read" : "fresh"\}/);
  assert.match(card, /readBadge\(read\)/);
  assert.match(card, /class="text-btn mark-unread" data-unread=/);
  assert.match(appJs, /<span class="badge read-badge">✓ Marcada<\/span>/);
  assert.match(appJs, />Desmarcar</);
  assert.doesNotMatch(css, /\.card\.read \{[^}]*opacity: 0\.5/);
  assert.match(css, /\.card\.read \{[^}]*inset 6px 0 0 #12704a/);
  assert.match(css, /\.card:not\(\.read\) \.mark-unread \{ display: none; \}/);
  const click = appJs.slice(appJs.indexOf('appEl.addEventListener("click", async'));
  assert.match(click, /closest\("\[data-unread\]"\)/);
  assert.match(click, /closest\("\.card a\[href\]"\)/);
  assert.match(click, /markCardRead\(card\.dataset\.id, card, true\)/);
  const mark = fn("markCardRead", "markCardReadEnd") || appJs.slice(appJs.indexOf("async function markCardRead"), appJs.indexOf("async function markCardRead") + 1200);
  assert.match(mark, /findItem\(id\)/, "también en el Resumen y en favoritas");
  assert.match(mark, /setRead\(item, read\)/);
});

test("v6.5 «Borrar marcadas (n)» grande, con icono, en listas y Resumen, con «Deshacer»", () => {
  assert.match(appJs, /Borrar marcadas \(\$\{n\}\)/);
  assert.match(appJs, /class="clear-ico"/);
  assert.match(css, /\.read-tools \.clear-read \{[^}]*min-height: 56px/);
  assert.match(css, /\.read-tools \.clear-read\[disabled\]/);
  assert.match(appJs, /filterRow\(\) \+ head \+ readTools\(\) \+ body/, "listas");
  assert.match(appJs, /filterRow\(\) \+ readTools\(\) \+ body/, "Ayudas");
  assert.match(appJs, /\$\{compact \? "" : readTools\(\)\}/, "Resumen");
  assert.match(appJs, /\$\{readTools\(\)\}<div class="list">/, "cuadros de Inicio abiertos");
  const toast = fn("showToast", "clearRead");
  assert.match(toast, /aria-live", "polite"/);
  assert.match(toast, /Deshacer/);
  assert.match(fn("clearRead", "aidCard"), /undeleteKeys\(keys\)/);
  assert.match(css, /\.toast \{[^}]*max-width: calc\(100% - 24px\)/);
});

test("v5.5 Ajustes: «Recuperar borradas (N)» (v5.6: sin «ocultas»)", () => {
  const sheet = indexHtml.slice(indexHtml.indexOf('<div id="prefSheet"'), indexHtml.indexOf('<nav class="dock'));
  assert.match(sheet, /<button type="button" id="restoreDeleted" class="ghost" disabled>Recuperar borradas \(0\)<\/button>/);
  assert.doesNotMatch(sheet, /id="restoreHidden"/);
  assert.match(sheet, /solo en este dispositivo/);
  assert.match(appJs, /Recuperar borradas \(\$\{n\}\)/);
  assert.match(appJs, /restoreAllDeleted\(\)/);
});

test("v5.8 cabecera sin «Preferencias»: se llega desde Ajustes; /#preferencias abre Ajustes con Mis preferencias desplegado", () => {
  assert.doesNotMatch(header, /id="prefsBtn"|>Preferencias</);
  assert.doesNotMatch(appJs, /prefsBtn|prefs-only/);
  assert.match(appJs, /location\.hash === "#preferencias"/);
  assert.match(appJs, /setAccordion\("prefs", Boolean\(focusPrefs/);
  assert.doesNotMatch(indexHtml, /Ir a Mis preferencias/);
});

test("caché v=65 (v6.6)", () => {
  assert.match(indexHtml, /\/app\.js\?v=65/);
  assert.doesNotMatch(indexHtml, /\?v=32/);
});
