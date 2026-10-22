/**
 * Cuentas opcionales, apagadas por defecto (accountsEnabled).
 * El almacén expone read() y write(data). Hoy sería un JSON en data/.
 * Para pasar a una base de datos, sustituye solo esa capa y deja el resto igual.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePrefs } from "./preferences.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ACCOUNT_COOKIE = "alerta_cuenta";
export const PLAN_GRATIS = "gratis";

/**
 * Interruptor de cuentas. Apagado si ACCOUNTS_ENABLED no está definida
 * o no vale true, 1, yes o si. Así no se guardan datos de terceros.
 * Para reactivarlo más adelante, con base de datos, pon ACCOUNTS_ENABLED=true.
 */
export function accountsEnabled(env = process.env) {
  const value = String(env.ACCOUNTS_ENABLED ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "si" || value === "sí";
}

export const PRO_PLAN_COPY =
  "Próximamente: plan Pro con alertas personalizadas por cultivo y zona, avisos de plazos por correo/WhatsApp, calendario de la explotación.";

export function plansView() {
  return {
    defaultPlan: PLAN_GRATIS,
    proAvailable: false,
    upcoming: PRO_PLAN_COPY,
  };
}

/**
 * Punto de ampliación del plan.
 * El alta deja a todo el mundo en "gratis".
 * El plan Pro no se cobra ni se activa: no hay pasarela de pago.
 */
export function assignPlan(user, plan) {
  if (plan !== PLAN_GRATIS) {
    throw new AccountError(409, "El plan Pro todavía no está disponible.");
  }
  user.plan = PLAN_GRATIS;
  return user;
}

export class AccountError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createFileStore(file) {
  return {
    read() {
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        if (!data || !Array.isArray(data.users)) return { users: [] };
        return data;
      } catch {
        return { users: [] };
      }
    },
    write(data) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, file);
    },
  };
}

function resolveSecret(env, file) {
  const fromEnv = String(env.SESSION_SECRET || "");
  if (fromEnv.length >= 16) return fromEnv;
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    if (saved && String(saved.secret || "").length >= 16) return String(saved.secret);
  } catch {
    /* se crea debajo */
  }
  const secret = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ secret }, null, 2));
  return secret;
}

export function openAccounts(env = process.env) {
  const dir = env.DATA_DIR || path.join(__dirname, "..", "data");
  return createAccounts(createFileStore(path.join(dir, "cuentas.json")), {
    secret: resolveSecret(env, path.join(dir, "session.json")),
  });
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
}

export function hashPassword(password, salt = crypto.randomBytes(16)) {
  const params = { N: 16384, r: 8, p: 1 };
  const hash = crypto.scryptSync(String(password), salt, 32, params);
  return {
    salt: salt.toString("hex"),
    hash: hash.toString("hex"),
    n: params.N,
    r: params.r,
    p: params.p,
  };
}

export function verifyPassword(password, record) {
  if (!record || !record.salt || !record.hash) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(record.salt, "hex");
    expected = Buffer.from(record.hash, "hex");
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;
  const got = crypto.scryptSync(String(password), salt, expected.length, {
    N: record.n || 16384,
    r: record.r || 8,
    p: record.p || 1,
  });
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(got, expected);
}

function sign(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan || PLAN_GRATIS,
    prefs: normalizePrefs(user.prefs),
    createdAt: user.createdAt,
  };
}

export function createAccounts(store, { secret }) {
  function issue(user) {
    const payload = Buffer.from(
      JSON.stringify({ sub: user.id, exp: Date.now() + 30 * 24 * 60 * 60 * 1000, v: 1 })
    ).toString("base64url");
    return `${payload}.${sign(secret, payload)}`;
  }

  function userFromToken(token) {
    const parts = String(token || "").split(".");
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = sign(secret, payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    let data;
    try {
      data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      return null;
    }
    if (!data || Number(data.exp) <= Date.now() || !data.sub) return null;
    const user = store.read().users.find((item) => item.id === data.sub);
    return user || null;
  }

  return {
    register({ email, password, prefs }) {
      const normalized = normalizeEmail(email);
      if (!validEmail(normalized)) throw new AccountError(400, "Escribe un correo válido.");
      if (typeof password !== "string" || password.length < 8 || password.length > 200) {
        throw new AccountError(400, "La contraseña necesita al menos 8 caracteres.");
      }
      const data = store.read();
      if (data.users.some((item) => item.email === normalized)) {
        throw new AccountError(409, "Ese correo ya tiene cuenta.");
      }
      const now = new Date().toISOString();
      const user = {
        id: crypto.randomBytes(16).toString("hex"),
        email: normalized,
        password: hashPassword(password),
        plan: PLAN_GRATIS,
        prefs: normalizePrefs(prefs),
        createdAt: now,
        updatedAt: now,
      };
      assignPlan(user, PLAN_GRATIS);
      data.users.push(user);
      store.write(data);
      return { token: issue(user), user: publicUser(user) };
    },

    authenticate({ email, password }) {
      const normalized = normalizeEmail(email);
      const user = store.read().users.find((item) => item.email === normalized);
      if (!user || !verifyPassword(password, user.password)) {
        throw new AccountError(401, "Correo o contraseña incorrectos.");
      }
      return { token: issue(user), user: publicUser(user) };
    },

    userFromRequest(req) {
      const raw = req.headers.cookie || "";
      const match = raw
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(ACCOUNT_COOKIE + "="));
      if (!match) return null;
      const token = decodeURIComponent(match.slice(ACCOUNT_COOKIE.length + 1));
      const user = userFromToken(token);
      return user ? publicUser(user) : null;
    },

    savePreferences(userId, prefs) {
      const data = store.read();
      const user = data.users.find((item) => item.id === userId);
      if (!user) throw new AccountError(401, "La sesión no es válida.");
      user.prefs = normalizePrefs(prefs);
      user.updatedAt = new Date().toISOString();
      store.write(data);
      return publicUser(user);
    },

    cookie(token, secure = false) {
      return (
        ACCOUNT_COOKIE +
        "=" +
        token +
        "; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000" +
        (secure ? "; Secure" : "")
      );
    },

    clearCookie(secure = false) {
      return (
        ACCOUNT_COOKIE +
        "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" +
        (secure ? "; Secure" : "")
      );
    },
  };
}
