import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const fn = (from, to) => appJs.slice(appJs.indexOf(`function ${from}`), appJs.indexOf(`function ${to}`));

test("v6.6 una favorita sale de las listas, del resumen y de los plazos, y el recuento de Favoritas sube", () => {
  const base = fn("baseItems", "filterRow");
  assert.match(base, /isClearedItem\(item\) \|\| isFavorite\(item\)/);
  assert.match(fn("digestData", "prevDay"), /!isFavorite\(item\)/);
  assert.match(fn("closingSoonList", "closingSoonSection"), /isFavorite\(item\)/);
  assert.match(fn("officialAlerts", "alertList"), /!isFavorite\(alert\) && !isClearedItem\(alert\)/);
  assert.match(fn("visibleNuevaPacNews", "renderNuevaPac"), /!isFavorite\(item\) && !isClearedItem\(item\)/);
  assert.match(appJs, /visibleNuevaPacNews\(\)\.length/);
  const fav = fn("renderFavorites", "milestoneRow");
  assert.match(fav, /inFavorites: true/);
  assert.doesNotMatch(fav, /isClearedItem|isDeletedItem/);
});

test("v6.6 aviso «Guardada en Favoritas» con Deshacer, y al quitar vuelve salvo que esté borrada", () => {
  const click = appJs.slice(appJs.indexOf('const fav = event.target.closest("[data-fav]")'));
  assert.match(click, /showToast\(was \? "Quitada de Favoritas" : "Guardada en Favoritas"/);
  assert.match(click, /toggleFavorite\(id\)/);
  assert.match(fn("baseItems", "filterRow"), /isClearedItem\(item\) \|\| isFavorite\(item\)/);
  assert.match(indexHtml, /Quitar · Borrar · Compartir/);
});

test("v6.6 en Favoritas: Quitar de favoritas, Borrar (también del resto, con Deshacer) y Compartir", () => {
  const actions = fn("favoriteActions", "renderFavorites");
  assert.match(actions, />Quitar de favoritas</);
  assert.match(actions, /data-fav-delete=/);
  assert.match(actions, />Borrar</);
  assert.match(actions, /data-share=/);
  assert.match(actions, /class="act-label">Compartir</);
  assert.match(fn("aidCard", "sortedItems"), /options\.inFavorites \? favoriteActions\(item\)/);
  const bury = fn("buryItem", "isLiveAid");
  assert.match(bury, /isDeletedItem\(item\)\) return \[\]/);
  assert.match(bury, /readStore\.deleted\[key\] = now/);
  const click = appJs.slice(appJs.indexOf('const favDelete = event.target.closest("[data-fav-delete]")'), appJs.indexOf('const share = event.target.closest("[data-share]")'));
  assert.match(click, /delete favorites\[existing\]/);
  assert.match(click, /buryItem\(item \|\| snap\)/);
  assert.match(click, /showToast\("Borrada"/);
  assert.match(click, /favorites\[snap\.id\] = snap/);
  assert.match(click, /undeleteKeys\(keys\)/);
  assert.doesNotMatch(fn("deleteReadItems", "undeleteKeys"), /FAV_KEY|delete favorites/);
  assert.match(css, /\.fav-actions \{ display: grid/);
  assert.match(css, /\.fav-actions \.fav-delete/);
  assert.match(css, /\.fav-actions \.act\.share/);
  assert.match(indexHtml, /app\.js\?v=65/);
  assert.match(indexHtml, /styles\.css\?v=65/);
});
