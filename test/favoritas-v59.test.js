import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const fnBody = (name) => { const a = appJs.indexOf(`function ${name}(`); return appJs.slice(a, appJs.indexOf("\n}\n", a)); };

test("v5.9 favoritas: copia guardada con título, fuente, enlace y fecha", () => {
  const snap = fnBody("snapshot");
  for (const f of ["title: item.title", "url: item.url", "sourceName: item.sourceName", "publishedAt: item.publishedAt", "savedAt"]) assert.ok(snap.includes(f), f);
  assert.match(fnBody("toggleFavorite"), /writeJson\(FAV_KEY, favorites\)/);
});

test("v5.9 favoritas: no caducan ni se ocultan; las cerradas llevan «Cerrada»", () => {
  const fav = fnBody("renderFavorites");
  assert.ok(!fav.includes("isLiveAid"), "no se filtran por abiertas");
  assert.match(fav, /aidCard\(fav, \{ snapshot: true \}\)/, "usa la copia si ya no sale");
  assert.match(fav, />Cerrada</);
  assert.doesNotMatch(fnBody("deleteReadItems"), /FAV_KEY|delete favorites/, "borrar no quita el registro de favoritas");
  assert.ok(!fnBody("pruneReadStore").includes("FAV_KEY"), "la limpieza de 15 días no toca favoritas");
  assert.equal((appJs.match(/removeItem\(FAV_KEY\)|favorites = \{\}/g) || []).length, 1, "solo se reinicia si el JSON está roto");
  assert.ok(!appJs.includes("filter((fav) => isLiveAid"), "el contador cuenta todas");
});
