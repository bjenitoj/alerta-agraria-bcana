import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cron from "node-cron";
import { collectAll } from "./lib/collect.js";
import { getPublicUrl, startPublicTunnel } from "./lib/tunnel.js";
import { createSession, requireAuth, sessionCookie, verifyKey } from "./lib/auth.js";
import { CATEGORIES } from "./lib/classify.js";
import {
  getStore,
  upsertItems,
  setCollecting,
  markOpened,
  archiveItem,
  archiveAll,
  markRead,
  purgeRead,
  deleteArchived,
  deleteAllArchived,
  deleteAllItems,
} from "./lib/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3847);
const HOST = process.env.HOST || "0.0.0.0";
const app = express();

function lanUrls() {
  const urls = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets || []) {
      if (net.family !== "IPv4" || net.internal) continue;
      urls.push(`http://${net.address}:${PORT}`);
    }
  }
  return urls;
}

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const loginAttempts = new Map();
function tooManyTries(ip) {
  const now = Date.now();
  const list = (loginAttempts.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  loginAttempts.set(ip, list);
  return list.length >= 8;
}

app.post("/api/login", (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "local";
  if (tooManyTries(ip)) {
    res.status(429).json({ ok: false, error: "Demasiados intentos. Espera unos minutos." });
    return;
  }
  const key = String((req.body && req.body.key) || "");
  if (!verifyKey(key)) {
    loginAttempts.set(ip, [...(loginAttempts.get(ip) || []), Date.now()]);
    res.status(401).json({ ok: false, error: "Clave incorrecta." });
    return;
  }
  loginAttempts.delete(ip);
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.setHeader("Set-Cookie", sessionCookie(createSession(), secure));
  res.json({ ok: true });
});

app.use("/api", (req, res, next) => {
  if (req.path === "/login") return next();
  return requireAuth(req, res, next);
});

let collecting = false;

async function runCollect(reason = "manual") {
  if (collecting) return { skipped: true, reason: "already-running" };
  collecting = true;
  setCollecting(true);
  console.log(`[alerta] Recogida iniciada (${reason})`);
  try {
    const { items, reports } = await collectAll();
    const { store, added } = upsertItems(items, reports);
    console.log(`[alerta] Recogida lista: ${items.length} ítems, ${added} nuevos`);
    return { skipped: false, added, total: store.items.length, reports };
  } catch (err) {
    setCollecting(false);
    console.error("[alerta] Recogida fallida", err);
    throw err;
  } finally {
    collecting = false;
  }
}

app.get("/api/access", (_req, res) => {
  res.json({
    local: `http://localhost:${PORT}`,
    lan: lanUrls(),
    internet: getPublicUrl(),
  });
});

app.get("/api/state", (_req, res) => {
  const store = markOpened();
  res.json({
    categories: CATEGORIES,
    lastCollectAt: store.lastCollectAt,
    collecting: collecting || store.collecting,
    sources: store.sources || {},
    items: store.items,
    archive: store.archive || [],
  });
});

app.post("/api/refresh", async (_req, res) => {
  try {
    const result = await runCollect("botón");
    const store = getStore();
    res.json({
      ok: true,
      ...result,
      lastCollectAt: store.lastCollectAt,
      items: store.items,
      archive: store.archive || [],
      sources: store.sources,
      categories: CATEGORIES,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/items/:id/read", (req, res) => {
  const item = markRead(req.params.id);
  res.json({ ok: Boolean(item), item });
});

app.post("/api/items/:id/archive", (req, res) => {
  const item = archiveItem(req.params.id);
  const store = getStore();
  res.json({ ok: Boolean(item), item, archive: store.archive, items: store.items });
});

app.post("/api/read-all", (_req, res) => {
  const store = archiveAll();
  res.json({ ok: true, archive: store.archive, items: store.items });
});

app.post("/api/archive/:id/delete", (req, res) => {
  const item = deleteArchived(req.params.id);
  const store = getStore();
  res.json({ ok: Boolean(item), item, archive: store.archive });
});

app.post("/api/delete-all", (req, res) => {
  const target = req.body && req.body.target === "archive" ? "archive" : "items";
  const store = target === "archive" ? deleteAllArchived() : deleteAllItems();
  res.json({ ok: true, items: store.items, archive: store.archive });
});

app.post("/api/purge-read", (_req, res) => {
  const store = purgeRead();
  res.json({ ok: true, items: store.items });
});

cron.schedule(
  "0 7 * * *",
  () => {
    runCollect("cron-diario-07:00").catch((err) => console.error(err));
  },
  { timezone: "Europe/Madrid" }
);

cron.schedule(
  "0 */6 * * *",
  () => {
    runCollect("cron-6h").catch((err) => console.error(err));
  },
  { timezone: "Europe/Madrid" }
);

const hosted = Boolean(process.env.FLY_APP_NAME || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT);
app.listen(PORT, HOST, () => {
  console.log(`Alerta Agraria CyL en http://localhost:${PORT}`);
  for (const url of lanUrls()) console.log(`Móvil (misma Wi-Fi): ${url}`);
  if (!hosted) startPublicTunnel(PORT);
  runCollect("arranque").catch((err) => console.error(err));
});
