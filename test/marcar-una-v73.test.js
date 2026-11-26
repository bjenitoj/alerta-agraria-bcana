import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const chunk = appJs.slice(appJs.indexOf('const READ_KEY = "alerta_leidas_v1"'), appJs.indexOf("// ── fin leídas y borradas ──"));

function load() {
  const ls = {};
  const api = new Function("readJson", "writeJson", "canonicalUrl", "isFavorite", "documentKeys", `${chunk}
    return { setRead, isReadItem, isDeletedItem, markKeys, readKeyOf, deleteReadItems };`)(
    (key, fallback) => (key in ls ? JSON.parse(ls[key]) : fallback),
    (key, value) => { ls[key] = JSON.stringify(value); },
    (url) => String(url || ""),
    () => false,
    () => ["d:bocyl-d-1"]
  );
  return api;
}

test("v7.3 tocar una tarjeta no marca las que comparten enlace o título", () => {
  const api = load();
  const url = "https://pac.jcyl.es/web/es/regimenes-ayuda/ayudas-asociadas-agricultores.html";
  const a = { id: "linea-1", title: "Ayuda asociada a la producción sostenible de arroz en Castilla y León", url };
  const b = { id: "linea-2", title: "Ayuda asociada a los productores de frutos secos en Castilla y León", url };
  api.setRead(a, true);
  assert.deepEqual(api.markKeys(a), ["id:linea-1"]);
  assert.equal(api.isReadItem(a), true);
  assert.equal(api.isReadItem(b), false);
  api.deleteReadItems([a]);
  assert.equal(api.isDeletedItem(a), true);
  assert.equal(api.isDeletedItem(b), false);
});

test("v7.3 papelera junto a Favorita y Compartir, y el toque no marca la tarjeta", () => {
  assert.match(appJs, /class="act mini trash" data-trash=/);
  assert.match(appJs, /aria-label="Borrar"/);
  assert.match(appJs, /function trashCard\(id\)/);
  const click = appJs.slice(appJs.indexOf('appEl.addEventListener("click", async'));
  const trashAt = click.indexOf('closest("[data-trash]")');
  const cardAt = click.indexOf('closest(".card")');
  assert.ok(trashAt > 0 && trashAt < cardAt, "la papelera se atiende antes de marcar la tarjeta");
  assert.match(click, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(appJs.slice(appJs.indexOf("function favoriteActions"), appJs.indexOf("function milestoneRow")), /data-trash/);
  assert.match(css, /\.act\.mini\.trash \{[^}]*min-width: 44px/);
  assert.match(indexHtml, /styles\.css\?v=78/);
  assert.match(css, /@media \(max-width: 900px\) \{[\s\S]*\.stamp \{\s*display: block;/);
});
