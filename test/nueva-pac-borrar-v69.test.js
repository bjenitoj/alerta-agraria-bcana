import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const fn = (from, to) => appJs.slice(appJs.indexOf(`function ${from}`), appJs.indexOf(`function ${to}`));

test("v6.9 Nueva PAC: «Borrar marcadas (n)» arriba de las noticias y el recuento las incluye", () => {
  const view = fn("renderNuevaPac", "renderAlertas");
  assert.match(view, /\$\{readTools\(\)\}/);
  const toolsAt = view.indexOf("${readTools()}");
  const listAt = view.indexOf("Últimas noticias");
  assert.ok(toolsAt > 0 && toolsAt < listAt, "el botón queda antes de la lista");
  const pool = fn("readPool", "deletableReadCount");
  assert.match(pool, /nuevaPacData\?\.news/);
  assert.match(fn("deletableReadCount", "CLEAR_ICON"), /isReadItem\(item\) && !isDeletedItem\(item\)/);
  assert.match(fn("visibleNuevaPacNews", "renderNuevaPac"), /!isFavorite\(item\) && !isClearedItem\(item\)/);
});

test("v6.9 Nueva PAC: tocar o abrir solo marca, con el mismo aspecto, y no la borra", () => {
  const view = fn("renderNuevaPac", "renderAlertas");
  assert.match(view, /class="np-news-item\$\{read \? " read" : ""\}" data-id=/);
  assert.match(view, /readBadge\(read\)/);
  assert.match(view, /data-unread="\$\{escapeHtml\(item\.id\)\}">Desmarcar/);
  assert.match(view, /data-fav="\$\{escapeHtml\(item\.id\)\}"/);
  assert.match(css, /\.np-news-item\.read \{[^}]*inset 6px 0 0 #12704a/);
  assert.match(css, /\.np-news-item:not\(\.read\) \.mark-unread \{ display: none; \}/);
  const click = appJs.slice(appJs.indexOf('appEl.addEventListener("click", async'));
  assert.match(click, /closest\("\.np-news-item a\[href\]"\)/);
  assert.match(click, /markCardRead\(row\.dataset\.id, row, true\)/);
  assert.match(click, /closest\("\.np-news-item"\)/);
  assert.match(click, /markCardRead\(news\.dataset\.id, news\)/);
  const mark = appJs.slice(appJs.indexOf("async function markCardRead"), appJs.indexOf('appEl.addEventListener("change"'));
  assert.match(mark, /setRead\(item, read\)/);
  assert.doesNotMatch(mark, /deleteReadItems|buryItem/);
});

test("v6.9 favorita de Nueva PAC: sale de la pestaña y en Favoritas se quita, borra o comparte", () => {
  const fav = fn("renderFavorites", "milestoneRow");
  assert.match(fav, /nuevaPacData\?\.news/);
  assert.match(fav, /inFavorites: true/);
  assert.match(fn("favoriteActions", "renderFavorites"), />Quitar de favoritas</);
  assert.match(fn("favoriteActions", "renderFavorites"), /data-fav-delete=/);
  assert.match(fn("favoriteActions", "renderFavorites"), /data-share=/);
  assert.doesNotMatch(fn("deleteReadItems", "undeleteKeys"), /FAV_KEY|delete favorites/);
  assert.match(indexHtml, /app\.js\?v=70/);
  assert.match(indexHtml, /styles\.css\?v=70/);
});
