import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "node:http";
import { syncAgeText } from "../lib/sync.js";
import { logSyncFailure, syncFailureText } from "../lib/sync-store.js";
import { createApp } from "../server.js";

const appJs = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const indexHtml = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

test("v7.8 el estado dice hace un momento, minutos u horas", () => {
  const now = Date.parse("2026-11-26T20:00:00.000Z");
  assert.equal(syncAgeText(now - 10000, now), "Sincronizado hace un momento");
  assert.equal(syncAgeText(now - 5 * 60000, now), "Sincronizado hace 5 min");
  assert.equal(syncAgeText(now - 3 * 3600000, now), "Sincronizado hace 3 h");
  assert.equal(syncAgeText("no-es-fecha", now), "");
});

test("v7.8 el registro de la base no incluye la cadena ni el código", () => {
  const error = new Error("fallo postgres://user:secret@db.example/app al guardar ABCD-EFGH-JKM2");
  error.code = "28P01";
  const text = syncFailureText(error);
  assert.equal(text.includes("postgres://"), false);
  assert.equal(text.includes("secret"), false);
  assert.equal(text.includes("ABCD-EFGH-JKM2"), false);
  assert.match(text, /\[url\]/);
  assert.match(text, /\[codigo\]/);
  const lines = [];
  const prev = console.error;
  console.error = (line) => lines.push(String(line));
  try { logSyncFailure(error); }
  finally { console.error = prev; }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /28P01/);
  assert.equal(lines[0].includes("secret"), false);
  assert.equal(lines[0].includes("ABCD-EFGH-JKM2"), false);
});

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("v7.8 /api/sync no se cachea y un fallo de base no es un 503", async () => {
  const secret = "postgres://user:secret@db.example/app";
  const code = "ABCD-EFGH-JKM2";
  const lines = [];
  const prev = console.error;
  console.error = (line) => lines.push(String(line));
  const broken = {
    available: true,
    async get() {
      const error = new Error(`connect ${secret} code ${code}`);
      error.code = "ECONNREFUSED";
      throw error;
    },
    async put() { return null; },
  };
  let server;
  try {
    const app = createApp({ syncStore: broken, allowSync: () => true, databaseUrl: "" });
    server = await listen(app.app);
    const port = server.address().port;
    const status = await fetch(`http://127.0.0.1:${port}/api/sync/status`);
    assert.equal(status.status, 200);
    assert.match(status.headers.get("cache-control") || "", /no-store/);
    const got = await fetch(`http://127.0.0.1:${port}/api/sync/${code}`);
    assert.equal(got.status, 500);
    assert.match(got.headers.get("cache-control") || "", /no-store/);
    const body = await got.json();
    assert.equal(body.error, "Error al sincronizar");
    assert.equal(JSON.stringify(lines).includes("secret"), false);
    assert.equal(JSON.stringify(lines).includes(code), false);
  } finally {
    console.error = prev;
    server?.close();
  }

  const off = createApp({ databaseUrl: "", allowSync: () => true });
  const down = await listen(off.app);
  const denied = await fetch(`http://127.0.0.1:${down.address().port}/api/sync/status`);
  assert.equal(denied.status, 503);
  assert.match(denied.headers.get("cache-control") || "", /no-store/);
  down.close();
});

test("v7.8 el cliente vuelve a sincronizar al reabrir y enseña el estado", () => {
  assert.match(appJs, /window\.addEventListener\("pageshow", wake\)/);
  assert.match(appJs, /window\.addEventListener\("focus", wake\)/);
  assert.match(appJs, /document\.addEventListener\("resume", wake\)/);
  assert.match(appJs, /Error al sincronizar/);
  assert.match(indexHtml, /Sincronizar ahora/);
  const refresh = appJs.slice(appJs.indexOf("async function refreshSyncStatus"), appJs.indexOf("function armSyncWake"));
  assert.match(refresh, /res\.status === 503/);
  assert.doesNotMatch(refresh, /catch[\s\S]*syncAvailable = false/);
  assert.match(indexHtml, /id="syncNow"/);
  assert.match(indexHtml, /id="syncState"/);
  assert.match(indexHtml, /id="syncRetry"/);
  assert.match(indexHtml, /app\.js\?v=85/);
});
