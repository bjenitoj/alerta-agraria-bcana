import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { absorbHideKeys, buildDeletedRows, labelFromDeletedKey, mergeSync } from "../lib/sync.js";

const appJs = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const chunk = appJs.slice(appJs.indexOf('const READ_KEY = "alerta_leidas_v1"'), appJs.indexOf("// ── fin leídas y borradas ──"));

function api() {
  const ls = {};
  return new Function("readJson", "writeJson", "canonicalUrl", "isFavorite", "documentKeys", `${chunk}
    return { setRead, isReadItem, isDeletedItem, deleteReadItems, pruneReadStore, load(store) { readStore = store; }, store: () => readStore };`)(
    () => null,
    () => {},
    (url) => String(url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
    () => false,
    () => []
  );
}

test("v7.5 desmarcar gana a una marca anterior y volver a marcar gana después", () => {
  const unmarked = mergeSync(
    { read: {}, unread: { "id:a": "2026-11-28T12:00:00.000Z" } },
    { read: { "id:a": "2026-11-28T10:00:00.000Z" } }
  );
  assert.equal(unmarked.read["id:a"], undefined);
  assert.equal(unmarked.unread["id:a"], "2026-11-28T12:00:00.000Z");
  const remarked = mergeSync(
    { read: { "id:a": "2026-11-28T13:00:00.000Z" }, unread: {} },
    unmarked
  );
  assert.equal(remarked.read["id:a"], "2026-11-28T13:00:00.000Z");
  assert.equal(remarked.unread["id:a"], undefined);
  const box = api();
  const item = { id: "a", title: "Aviso" };
  box.setRead(item, true);
  assert.equal(box.isReadItem(item), true);
  box.setRead(item, false);
  assert.equal(box.isReadItem(item), false);
  box.load({ v: 1, read: { "id:a": "2026-11-28T10:00:00.000Z" }, unread: { "id:a": "2026-11-28T12:00:00.000Z" }, deleted: {}, gone: {}, aliases: {} });
  item.read = true;
  assert.equal(box.isReadItem(item), false, "la fecha de desmarcado gana aunque la ficha siga marcada en memoria");
});

test("v7.5.1 la migración no pisa la fecha real y una noticia sale en una sola fila", () => {
  const real = "2026-11-21T09:33:43.013Z";
  const migrated = absorbHideKeys(
    { "u:pac.jcyl.es/web/es/regimenes-ayuda/ayudas-asociadas-agricultores.html": real },
    [{ key: "id:linea-1", at: real }, "r:no"],
    "2026-11-28T10:37:00.000Z"
  );
  assert.equal(migrated["u:pac.jcyl.es/web/es/regimenes-ayuda/ayudas-asociadas-agricultores.html"], real);
  assert.equal(migrated["id:linea-1"], real);
  assert.equal(migrated["r:no"], undefined);
  const rows = buildDeletedRows({
    deleted: {
      "u:pac.jcyl.es/web/es/regimenes-ayuda/ayudas-asociadas-agricultores.html": real,
      "id:linea-1": "2026-11-28T10:37:00.000Z",
    },
    groups: [{
      marks: ["u:pac.jcyl.es/web/es/regimenes-ayuda/ayudas-asociadas-agricultores.html", "id:linea-1"],
      title: "Ayuda asociada a la producción sostenible de arroz",
      source: "Junta de Castilla y León",
    }],
    now: Date.parse("2026-11-28T12:00:00.000Z"),
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Ayuda asociada a la producción sostenible de arroz");
  assert.equal(rows[0].at, real);
  const titled = labelFromDeletedKey("t:ayuda al mantenimiento de la forestacion");
  assert.match(titled.title, /Ayuda al mantenimiento/);
  const url = labelFromDeletedKey("u:pac.jcyl.es/web/es/regimenes-ayuda/ayudas-asociadas-agricultores.html");
  assert.equal(url.source, "pac.jcyl.es");
  const hidden = buildDeletedRows({
    deleted: { "id:abc123abc123abc123abc123abc123abc123abcd": "2026-11-26T10:00:00.000Z" },
    now: Date.parse("2026-11-28T12:00:00.000Z"),
  });
  assert.equal(hidden.length, 0);
});

test("v7.5 una baja de más de 15 días deja de listarse pero no reaparece", () => {
  const box = api();
  const old = new Date(Date.now() - 16 * 86400000).toISOString();
  const store = box.pruneReadStore({
    v: 1,
    read: {},
    unread: {},
    deleted: { "id:vieja": old },
    deletedInfo: { "id:vieja": { title: "Vieja", source: "BOE", at: old } },
    gone: {},
    restored: {},
    aliases: {},
  });
  assert.equal(store.deleted["id:vieja"], undefined);
  assert.equal(store.gone["id:vieja"], 1);
  assert.equal(store.deletedInfo["id:vieja"], undefined);
  box.load(store);
  assert.equal(box.isDeletedItem({ id: "vieja", url: "https://www.boe.es/vieja" }), true);
});
