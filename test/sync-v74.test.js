import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createSyncCode, isSyncCode, mergeSync, normalizeSyncCode, SYNC_ALPHABET } from "../lib/sync.js";
import { allowSyncRequest, memorySyncStore } from "../lib/sync-store.js";
import { createApp } from "../server.js";

test("v7.4 el código tiene 12 signos, sin ambiguos, y unos 60 bits", () => {
  const code = createSyncCode();
  assert.equal(isSyncCode(code), true);
  assert.equal(normalizeSyncCode(`  ${code.toLowerCase()}  `), code);
  assert.equal(normalizeSyncCode("OOOO-IIII-LLLL"), "");
  const signs = code.replace(/-/g, "");
  assert.equal(signs.length, 12);
  assert.ok([...signs].every((sign) => SYNC_ALPHABET.includes(sign)));
  assert.ok(Math.log2(SYNC_ALPHABET.length ** 12) >= 60);
  const many = new Set(Array.from({ length: 20 }, () => createSyncCode()));
  assert.equal(many.size, 20);
});

test("v7.4 la fusión une marcas y una favorita quitada no vuelve", () => {
  const local = {
    read: { "id:a": "2026-11-21T10:00:00.000Z" },
    deleted: { "id:b": "2026-11-21T11:00:00.000Z" },
    favorites: { uno: { id: "uno", url: "https://www.boe.es/a", title: "A", savedAt: "2026-11-21T09:00:00.000Z" } },
    favoriteRemoved: {},
    prefs: { updatedAt: "2026-11-21T08:00:00.000Z", place: { ccaa: ["es-cl"] } },
  };
  const remote = {
    read: { "id:c": "2026-11-21T10:30:00.000Z" },
    deleted: {},
    favorites: {
      uno: { id: "uno", url: "https://www.boe.es/a", title: "A", savedAt: "2026-11-21T08:00:00.000Z" },
      dos: { id: "dos", url: "https://www.boe.es/b", title: "B", savedAt: "2026-11-21T07:00:00.000Z" },
    },
    favoriteRemoved: { dos: "2026-11-21T12:00:00.000Z" },
    prefs: { updatedAt: "2026-11-21T12:00:00.000Z", place: { ccaa: ["es-an"] } },
  };
  const merged = mergeSync(local, remote, new Date("2026-11-21T13:00:00.000Z"));
  assert.equal(merged.read["id:a"], local.read["id:a"]);
  assert.equal(merged.read["id:c"], remote.read["id:c"]);
  assert.equal(merged.deleted["id:b"], local.deleted["id:b"]);
  assert.ok(merged.favorites.uno);
  assert.equal(merged.favorites.dos, undefined);
  assert.equal(merged.prefs.place.ccaa[0], "es-an");
});

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("v7.4 sincronizar guarda y lee el JSON, y sin base responde 503", async () => {
  const store = memorySyncStore();
  const on = createApp({ syncStore: store, allowSync: () => true, databaseUrl: "" });
  const server = await listen(on.app);
  const port = server.address().port;
  const code = createSyncCode();
  const payload = mergeSync({ deleted: { "id:noticia": "2026-11-21T10:00:00.000Z" } }, {});
  const put = await fetch(`http://127.0.0.1:${port}/api/sync/${code}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  assert.equal(put.status, 200);
  const got = await (await fetch(`http://127.0.0.1:${port}/api/sync/${code}`)).json();
  assert.equal(got.payload.deleted["id:noticia"], payload.deleted["id:noticia"]);
  const bad = await fetch(`http://127.0.0.1:${port}/api/sync/no-vale`);
  assert.equal(bad.status, 400);
  server.close();

  const off = createApp({ databaseUrl: "", allowSync: () => true });
  const down = await listen(off.app);
  const status = await fetch(`http://127.0.0.1:${down.address().port}/api/sync/status`);
  assert.equal(status.status, 503);
  const body = await status.json();
  assert.match(body.error, /no disponible/);
  down.close();
});

test("v7.4 el límite por IP no mira el código", () => {
  const ip = `prueba-${Date.now()}`;
  for (let i = 0; i < 40; i += 1) assert.equal(allowSyncRequest(ip, 1_000 + i), true);
  assert.equal(allowSyncRequest(ip, 1_000 + 41), false);
});
