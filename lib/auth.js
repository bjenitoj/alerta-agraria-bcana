import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, "..", "data", "auth.json");
const COOKIE = "alerta_sesion";

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

function sign(payload) {
  return crypto.createHmac("sha256", loadAuth().hash).update(payload).digest("base64url");
}

export function createSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString("base64url");
  return payload + "." + sign(payload);
}

function tokenFrom(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  if (req.query && req.query.token) return String(req.query.token);
  const raw = req.headers.cookie || "";
  const match = raw.split(";").map((p) => p.trim()).find((p) => p.startsWith(COOKIE + "="));
  return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : "";
}

export function hasSession(req) {
  const token = tokenFrom(req);
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(data.exp) > Date.now();
  } catch {
    return false;
  }
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