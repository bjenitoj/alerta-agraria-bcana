import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alerta-acceso-"));
const salt = crypto.randomBytes(16);
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = "session-secret-de-prueba-32";
process.env.ACCESS_SALT = salt.toString("hex");
process.env.ACCESS_HASH = crypto.scryptSync("Clave#Admin1", salt, 32).toString("hex");

const { createApp } = await import("../server.js");

function cookieHeader(res) {
  const lines = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return lines.map((line) => line.split(";")[0]).join("; ");
}

async function listen() {
  const { app } = createApp();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test("la consulta es pública y la administración pide la clave", async (t) => {
  const { server, base } = await listen();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const state = await fetch(base + "/api/state");
  assert.equal(state.status, 200);
  const body = await state.json();
  assert.equal(body.admin, false);
  assert.match(body.plans.upcoming, /plan Pro/);
  assert.equal(JSON.stringify(body).includes("ACCESS_HASH"), false);

  const fuentes = await fetch(base + "/api/fuentes");
  assert.equal(fuentes.status, 200);

  const legal = await fetch(base + "/api/legal");
  const pages = await legal.json();
  const aviso = JSON.stringify(pages.pages["aviso-legal"]);
  assert.match(aviso, /titular de este sitio es BC\./);
  assert.match(aviso, /gestind26@gmail\.com/);
  assert.doesNotMatch(aviso, /\[[A-ZÁÉÍÓÚÑ ]+\]|\bNIF\b/);

  for (const pathName of ["/api/refresh", "/api/sync", "/api/purge-read", "/api/delete-all"]) {
    const denied = await fetch(base + pathName, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(denied.status, 401, pathName);
  }

  const wrong = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "no-vale" }),
  });
  assert.equal(wrong.status, 401);

  const login = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "Clave#Admin1" }),
  });
  assert.equal(login.status, 200);
  const adminCookie = cookieHeader(login);
  assert.match(adminCookie, /alerta_sesion=/);
  assert.match(login.headers.getSetCookie().join(";"), /HttpOnly/);

  const allowed = await fetch(base + "/api/purge-read", {
    method: "POST",
    headers: { Cookie: adminCookie },
  });
  assert.equal(allowed.status, 200);

  const session = await fetch(base + "/api/sesion", { headers: { Cookie: adminCookie } });
  const sessionBody = await session.json();
  assert.equal(sessionBody.admin, true);
  assert.equal(sessionBody.accounts, false);
  assert.equal(sessionBody.cuenta, null);
});

test("con las cuentas apagadas esas rutas no existen", async (t) => {
  assert.equal(process.env.ACCOUNTS_ENABLED, undefined);
  const { server, base } = await listen();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  for (const pathName of ["/api/cuenta/registro", "/api/cuenta/entrar", "/api/cuenta/salir"]) {
    const denied = await fetch(base + pathName, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "olivo@campo.test", password: "semilla-segura" }),
    });
    assert.equal(denied.status, 404, pathName);
  }
  const prefs = await fetch(base + "/api/cuenta/preferencias", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefs: { sector: "pesca" } }),
  });
  assert.equal(prefs.status, 404);
  const page = await fetch(base + "/registro");
  assert.equal(page.status, 404);
  const who = await fetch(base + "/api/sesion");
  const whoBody = await who.json();
  assert.equal(whoBody.accounts, false);
  assert.equal(whoBody.cuenta, null);
  const legal = await fetch(base + "/api/legal");
  const pages = await legal.json();
  const privacy = JSON.stringify(pages.pages.privacidad);
  assert.match(privacy, /no recoge datos personales/);
  assert.match(privacy, /alerta_prefs_v1/);
  const aviso = JSON.stringify(pages.pages["aviso-legal"]);
  assert.match(aviso, /orientativa/);
  assert.match(aviso, /No sustituye/);
});

test("rutas nuevas: calendario PAC, herramientas y .ics sin estado", async (t) => {
  const { server, base } = await listen();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const pac = await fetch(base + "/api/pac-calendario");
  assert.equal(pac.status, 200);
  const pacBody = await pac.json();
  assert.ok(pacBody.milestones.some((item) => item.id === "anticipo"));

  const tools = await fetch(base + "/api/herramientas");
  const toolsBody = await tools.json();
  const urls = toolsBody.grupos.flatMap((group) => group.enlaces.map((link) => link.url));
  assert.ok(urls.includes("https://sigpac.mapa.gob.es/fega/visor/"));
  assert.ok(urls.every((url) => url.startsWith("https://")));

  const page = await fetch(base + "/herramientas");
  assert.equal(page.status, 200);

  const ics = await fetch(base + "/calendario.ics?titulo=Ayuda%20prueba&fecha=2026-11-30&enlace=https%3A%2F%2Fbocyl.jcyl.es%2Fx");
  assert.equal(ics.status, 200);
  assert.match(ics.headers.get("content-type"), /text\/calendar/);
  assert.match(await ics.text(), /DTSTART;VALUE=DATE:20261130/);
  assert.equal((await fetch(base + "/calendario.ics?fecha=2026-02-30")).status, 400);
  assert.equal((await fetch(base + "/calendario.ics?fecha=2026-11-30&enlace=javascript:alert(1)")).status, 400);

  assert.equal((await fetch(base + "/mod/aid-view.js")).status, 200);
  assert.equal((await fetch(base + "/mod/net.js")).status, 404);
  assert.equal((await fetch(base + "/mod/auth.js")).status, 404);
});
