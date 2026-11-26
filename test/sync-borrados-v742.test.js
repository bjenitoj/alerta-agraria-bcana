import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "node:http";
import { createSyncCode, mergeSync } from "../lib/sync.js";
import { memorySyncStore } from "../lib/sync-store.js";
import { createApp } from "../server.js";

const appJs = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const chunk = appJs.slice(appJs.indexOf('const READ_KEY = "alerta_leidas_v1"'), appJs.indexOf("// ── fin leídas y borradas ──"));

function readApi() {
  const ls = {};
  return new Function("readJson", "writeJson", "canonicalUrl", "isFavorite", "documentKeys", `${chunk}
    return { deleteReadItems, isDeletedItem, plant(deleted) { readStore.deleted = deleted; } };`)(
    (key, fallback) => (key in ls ? JSON.parse(ls[key]) : fallback),
    (key, value) => { ls[key] = JSON.stringify(value); },
    (url) => String(url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/$/, ""),
    () => false,
    () => ["d:compartido"]
  );
}

test("v7.4.2 el borrado de una tarjeta no se lleva la que solo comparte enlace", () => {
  const api = readApi();
  const url = "https://pac.jcyl.es/web/es/regimenes-ayuda/ayudas-asociadas-agricultores.html";
  const a = { id: "alerta-1", read: true, title: "Alerta de viento en Salamanca para explotaciones de secano", url };
  const b = { id: "alerta-2", title: "Alerta de lluvia en Salamanca para explotaciones de secano", url };
  api.deleteReadItems([a]);
  assert.equal(api.isDeletedItem(a), true);
  assert.equal(api.isDeletedItem(b), false, "otra tarjeta, aunque el enlace coincida, sigue");
});

test("v7.4.2 una baja guardada solo con el id pelado también oculta la tarjeta", () => {
  const api = readApi();
  api.plant({ abc123: "2026-11-26T18:00:00.000Z" });
  assert.equal(api.isDeletedItem({ id: "abc123", url: "https://www.otra.es/distinta" }), true);
  assert.equal(api.isDeletedItem({ id: "otra", url: "https://www.otra.es/distinta" }), false);
});

test("v7.4.2 el móvil no pisa los borrados nuevos de la tablet", () => {
  const tablet = { deleted: { "id:nueva": "2026-11-26T21:30:00.000Z", nueva: "2026-11-26T21:30:00.000Z" } };
  const servidor = { deleted: { "id:vieja": "2026-11-26T07:01:00.000Z" }, updatedAt: "2026-11-26T21:00:00.000Z" };
  const subida = mergeSync(tablet, servidor);
  assert.equal(subida.deleted["id:nueva"], "2026-11-26T21:30:00.000Z");
  assert.equal(subida.deleted["id:vieja"], "2026-11-26T07:01:00.000Z");
  const movil = mergeSync({ deleted: {} }, subida);
  assert.equal(movil.deleted["id:nueva"], "2026-11-26T21:30:00.000Z");
  assert.equal(movil.deleted.nueva, "2026-11-26T21:30:00.000Z");
});

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

test("v7.4.2 el endpoint guarda el borrado y el otro cliente no lo borra", async () => {
  const app = createApp({ syncStore: memorySyncStore(), allowSync: () => true, databaseUrl: "" });
  const server = await listen(app.app);
  const port = server.address().port;
  const code = createSyncCode();
  const when = "2026-11-26T18:40:00.000Z";
  const base = `http://127.0.0.1:${port}/api/sync/${code}`;
  const putA = await fetch(base, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: { v: 1, deleted: { "id:alerta-resumen": when, "alerta-resumen": when }, read: {}, favorites: {}, favoriteRemoved: {} } }),
  });
  assert.equal(putA.status, 200);
  const stored = await (await fetch(base)).json();
  assert.equal(stored.payload.deleted["id:alerta-resumen"], when);
  const phone = mergeSync({ deleted: {}, favorites: {} }, stored.payload);
  const putB = await fetch(base, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: phone, baseUpdatedAt: stored.payload.updatedAt }),
  });
  assert.equal(putB.status, 200);
  const again = await (await fetch(base)).json();
  assert.equal(again.payload.deleted["id:alerta-resumen"], when);
  assert.equal(again.payload.deleted["alerta-resumen"], when);
  server.close();
});

test("v7.4.2 un sync en curso no se traga el borrado siguiente", () => {
  const pull = appJs.slice(appJs.indexOf("async function pullPushSync"), appJs.indexOf("async function paintQr"));
  assert.match(pull, /syncQueued = true/);
  assert.match(pull, /mergeSync\(localSyncDoc\(\), merged\)/);
  assert.match(appJs.slice(appJs.indexOf("function applySyncDoc"), appJs.indexOf("function scheduleSync")), /render\(\)/);
  assert.match(appJs.slice(appJs.indexOf("function deletionKeys"), appJs.indexOf("function hasMark")), /id:\$\{item\.id\}/);
});
