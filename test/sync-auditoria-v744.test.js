import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createSyncCode, mergeSync } from "../lib/sync.js";
import { memorySyncStore } from "../lib/sync-store.js";
import { createApp } from "../server.js";

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const fav = (id, savedAt) => ({ id, url: "https://www.boe.es/" + id, title: "Ficha " + id, savedAt });

async function world() {
  const app = createApp({ syncStore: memorySyncStore(), allowSync: () => true, databaseUrl: "" });
  const server = await listen(app.app);
  const port = server.address().port;
  const code = createSyncCode();
  const url = `http://127.0.0.1:${port}/api/sync/${code}`;
  async function push(local, base = "") {
    const remote = await (await fetch(url)).json();
    let merged = mergeSync(local, remote.payload || {});
    let put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: merged, baseUpdatedAt: base || remote.payload?.updatedAt || "" }),
    });
    if (put.status === 409) {
      const again = await put.json();
      merged = mergeSync(local, again.payload || {});
      put = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: merged, baseUpdatedAt: again.payload?.updatedAt || "" }),
      });
    }
    assert.equal(put.status, 200);
    return put.json();
  }
  async function pull(local) {
    const remote = await (await fetch(url)).json();
    return mergeSync(local, remote.payload || {});
  }
  return { server, push, pull };
}

test("v7.4.4 dos aparatos: borrar, marcar, favorita y recuperar", async () => {
  const w = await world();
  try {
    const a1 = await w.push({
      deleted: { "id:ayuda": "2026-11-26T10:00:00.000Z", "u:pac.jcyl.es/ayuda": "2026-11-26T10:00:00.000Z" },
      read: { "id:gris": "2026-11-26T10:05:00.000Z" },
      favorites: { uno: fav("uno", "2026-11-26T10:06:00.000Z") },
    });
    const onB = await w.pull({});
    assert.equal(onB.deleted["id:ayuda"], "2026-11-26T10:00:00.000Z");
    assert.equal(onB.read["id:gris"], "2026-11-26T10:05:00.000Z");
    assert.ok(onB.favorites.uno);
    const back = { ...onB, restored: { "id:ayuda": "2026-11-26T12:00:00.000Z", "u:pac.jcyl.es/ayuda": "2026-11-26T12:00:00.000Z" }, deleted: {} };
    await w.push(back);
    const onA = await w.pull({ deleted: { "id:ayuda": "2026-11-26T10:00:00.000Z", "u:pac.jcyl.es/ayuda": "2026-11-26T10:00:00.000Z" }, favorites: { uno: fav("uno", "2026-11-26T10:06:00.000Z") } });
    assert.equal(onA.deleted["id:ayuda"], undefined);
    assert.equal(onA.favorites.uno.id, "uno");
  } finally { w.server.close(); }
});

test("v7.4.4 unirse con datos locales no pierde ni las bajas ni las favoritas", async () => {
  const w = await world();
  try {
    await w.push({ deleted: { "id:resumen": "2026-11-26T09:00:00.000Z" }, favorites: { a: fav("a", "2026-11-26T09:00:00.000Z") } });
    const joined = await w.pull({
      deleted: { "id:ayudas": "2026-11-26T11:00:00.000Z" },
      favorites: { b: fav("b", "2026-11-26T11:00:00.000Z") },
      favoriteRemoved: {},
    });
    assert.equal(joined.deleted["id:resumen"], "2026-11-26T09:00:00.000Z");
    assert.equal(joined.deleted["id:ayudas"], "2026-11-26T11:00:00.000Z");
    assert.ok(joined.favorites.a);
    assert.ok(joined.favorites.b);
  } finally { w.server.close(); }
});

test("v7.4.4 sin conexión la baja local sigue y al volver se sube", async () => {
  const local = { deleted: { "id:offline": "2026-11-26T15:00:00.000Z" }, favorites: {} };
  const after = mergeSync(local, { deleted: { "id:vieja": "2026-11-26T07:01:00.000Z" } });
  assert.equal(after.deleted["id:offline"], "2026-11-26T15:00:00.000Z");
  assert.equal(after.deleted["id:vieja"], "2026-11-26T07:01:00.000Z");
  const w = await world();
  try {
    const saved = await w.push(after);
    assert.equal(saved.payload.deleted["id:offline"], "2026-11-26T15:00:00.000Z");
  } finally { w.server.close(); }
});

test("v7.4.4 dos escrituras a la vez no se pisan", async () => {
  const w = await world();
  try {
    const first = await w.push({ read: { "id:a": "2026-11-26T10:00:00.000Z" } });
    const base = first.payload.updatedAt;
    const second = await fetch(w.server.address ? `http://127.0.0.1:${w.server.address().port}/api/sync/no` : "");
    assert.equal(second.status, 400);
    const again = await w.push({ deleted: { "id:b": "2026-11-26T11:00:00.000Z" } }, base);
    assert.equal(again.payload.read["id:a"], "2026-11-26T10:00:00.000Z");
    assert.equal(again.payload.deleted["id:b"], "2026-11-26T11:00:00.000Z");
  } finally { w.server.close(); }
});

test("v7.4.4 la vista (sectores, Ayudas PAC, precios) viaja y gana la más nueva", async () => {
  const older = { view: { sectors: ["agricultura"], aidGroup: "pac", aidStatus: "abierta", priceSource: "mapa", updatedAt: "2026-11-26T10:00:00.000Z" } };
  const newer = { view: { sectors: ["ganaderia"], aidGroup: "otras", aidStatus: "cierra_pronto", priceSource: "lonja", updatedAt: "2026-11-26T12:00:00.000Z" } };
  const merged = mergeSync(older, newer);
  assert.deepEqual(merged.view.sectors, ["ganaderia"]);
  assert.equal(merged.view.aidGroup, "otras");
  assert.equal(merged.view.priceSource, "lonja");
  const w = await world();
  try {
    const saved = await w.push(newer);
    assert.equal(saved.payload.view.aidStatus, "cierra_pronto");
    const seen = await w.pull(older);
    assert.equal(seen.view.aidGroup, "otras");
  } finally { w.server.close(); }
});

test("v7.4.4 quitar favorita y volver a marcarla, con datos antiguos u:", async () => {
  const removed = mergeSync(
    { favorites: {}, favoriteRemoved: { n1: "2026-11-26T12:00:00.000Z" } },
    { favorites: { n1: fav("n1", "2026-11-26T08:00:00.000Z") } }
  );
  assert.equal(removed.favorites.n1, undefined);
  const again = mergeSync(
    { favorites: { n1: fav("n1", "2026-11-26T13:00:00.000Z") } },
    removed
  );
  assert.equal(again.favorites.n1.savedAt, "2026-11-26T13:00:00.000Z");
  const old = mergeSync({}, { deleted: { "u:pac.jcyl.es/web/es/regimenes-ayuda/ayudas-asociadas-agricultores.html": "2026-11-21T09:33:43.013Z" } });
  assert.equal(old.deleted["u:pac.jcyl.es/web/es/regimenes-ayuda/ayudas-asociadas-agricultores.html"], "2026-11-21T09:33:43.013Z");
});
