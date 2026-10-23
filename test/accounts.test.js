import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LEGAL_OWNER, LEGAL_PAGES } from "../lib/legal.js";
import {
  PRO_PLAN_COPY,
  accountsEnabled,
  assignPlan,
  createAccounts,
  createFileStore,
  hashPassword,
  openAccounts,
  verifyPassword,
} from "../lib/accounts.js";

test("las cuentas están apagadas si no se pide lo contrario", () => {
  assert.equal(accountsEnabled({}), false);
  assert.equal(accountsEnabled({ ACCOUNTS_ENABLED: "" }), false);
  assert.equal(accountsEnabled({ ACCOUNTS_ENABLED: "false" }), false);
  assert.equal(accountsEnabled({ ACCOUNTS_ENABLED: "true" }), true);
});

test("el plan Pro está anunciado y todavía no se activa", () => {
  assert.equal(
    PRO_PLAN_COPY,
    "Próximamente: plan Pro con alertas personalizadas por cultivo y zona, avisos de plazos por correo/WhatsApp, calendario de la explotación."
  );
  const user = { plan: "gratis" };
  assert.throws(() => assignPlan(user, "pro"), /todavía no está disponible/);
  assert.equal(user.plan, "gratis");
  assignPlan(user, "gratis");
  assert.equal(user.plan, "gratis");
});

test("la contraseña se guarda como hash scrypt y las preferencias vuelven con la cuenta", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alerta-cuentas-"));
  const accounts = openAccounts({ DATA_DIR: dir, SESSION_SECRET: "secreto-de-prueba-largo" });
  const created = accounts.register({
    email: "Ana@Campo.test",
    password: "semilla-segura",
    prefs: { sector: "ganaderia", zone: "salamanca", water: ["secano"], crops: ["vacuno"], infoOrder: ["pac", "ayudas"] },
  });
  assert.equal(created.user.plan, "gratis");
  assert.equal(created.user.email, "ana@campo.test");
  assert.equal(created.user.prefs.sector, "ganaderia");
  assert.equal(created.user.prefs.zone, "salamanca");
  assert.equal(created.user.password, undefined);

  const raw = fs.readFileSync(path.join(dir, "cuentas.json"), "utf8");
  assert.equal(raw.includes("semilla-segura"), false);
  assert.match(raw, /"hash":/);
  const stored = JSON.parse(raw).users[0];
  assert.equal(verifyPassword("semilla-segura", stored.password), true);
  assert.equal(verifyPassword("otra-clave", stored.password), false);
  assert.equal(verifyPassword("semilla-segura", hashPassword("distinta")), false);

  assert.throws(() => accounts.register({ email: "ana@campo.test", password: "semilla-segura" }), /ya tiene cuenta/);
  assert.throws(() => accounts.authenticate({ email: "ana@campo.test", password: "mal-mal-mal" }), /incorrectos/);
  const session = accounts.authenticate({ email: "ana@campo.test", password: "semilla-segura" });
  const saved = accounts.savePreferences(session.user.id, { sector: "pesca", zone: "nacional", crops: ["acuicultura"] });
  assert.equal(saved.prefs.sector, "pesca");
  // v5.3: «Acuicultura» pasa de los cultivos a la actividad de pesca; se conserva al migrar.
  assert.equal(saved.prefs.fishing.includes("acuicultura"), true);
  assert.match(accounts.cookie(session.token, true), /HttpOnly/);
  assert.match(accounts.cookie(session.token, true), /alerta_cuenta=/);
});

test("las páginas legales llevan titular y contacto, sin marcadores ni NIF", () => {
  for (const [id, page] of Object.entries(LEGAL_PAGES)) {
    const text = JSON.stringify(page);
    assert.doesNotMatch(text, /\[[A-ZÁÉÍÓÚÑ ]+\]/, page.title);
    assert.doesNotMatch(text, /\bNIF\b/, page.title);
    assert.ok(text.includes(LEGAL_OWNER.email), page.title);
    // El nombre del titular solo en Aviso legal y Privacidad.
    const named = text.includes(`${LEGAL_OWNER.name}.`) || text.includes(`es ${LEGAL_OWNER.name}`);
    assert.equal(named, id === "aviso-legal" || id === "privacidad", page.title);
  }
});

test("el almacén se puede sustituir sin cambiar el registro", () => {
  const memory = { data: { users: [] } };
  const store = {
    read: () => memory.data,
    write: (data) => {
      memory.data = data;
    },
  };
  assert.equal(typeof createFileStore, "function");
  const accounts = createAccounts(store, { secret: "otro-secreto-de-prueba" });
  const created = accounts.register({ email: "uno@campo.test", password: "ochochars" });
  assert.equal(memory.data.users.length, 1);
  assert.equal(created.user.plan, "gratis");
});
