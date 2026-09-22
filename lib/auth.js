import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, "..", "data", "auth.json");
const COOKIE = "alerta_sesion";
const sessions = new Map();

function loadAuth() {
  if (process.env.ACCESS_SALT && process.env.ACCESS_HASH) {
    return { salt: process.env.ACCESS_SALT, hash: process.env.ACCESS_HASH };
  }
  return JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
}

export function verifyKey(key) {
  const auth = loadAuth();
  const salt = Buffer.from(auth.salt, "hex");
  const expected = Buffer.from(auth.hash, "hex");
  const got = crypto.scryptSync(String(key || ""), salt, 32);
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(got, expected);
}

export function createSession() {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now() + 30 * 24 * 60 * 60 * 1000);
  return token;
}

export function hasSession(req) {
  const raw = req.headers.cookie || "";
  const match = raw.split(";").map((p) => p.trim()).find((p) => p.startsWith(COOKIE + "="));
  if (!match) return false;
  const token = match.slice(COOKIE.length + 1);
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function sessionCookie(token, secure = false) {
  return (
    COOKIE +
    "=" +
    token +
    "; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000" +
    (secure ? "; Secure" : "")
  );
}

export function requireAuth(req, res, next) {
  if (hasSession(req)) return next();
  res.status(401).json({ ok: false, error: "clave" });
}