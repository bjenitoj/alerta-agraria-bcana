import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cron from "node-cron";
import { collectAll } from "./lib/collect.js";
import { getPublicUrl, startPublicTunnel } from "./lib/tunnel.js";
import { createSession, hasSession, requireAuth, sessionCookie, verifyKey } from "./lib/auth.js";
import { AccountError, accountsEnabled, openAccounts, plansView } from "./lib/accounts.js";
import { CATEGORIES } from "./lib/classify.js";
import { COUNTRIES, publicSourceView, SOURCES, TERRITORIES } from "./lib/config.js";
import { LEGAL_PAGES } from "./lib/legal.js";
import { madridTodayKey, publicSchema } from "./lib/preferences.js";
import { buildIcs, hasSourceUrl, safeUrl, validDayKey } from "./lib/aid-view.js";
import { pacTimeline } from "./lib/pac-calendar.js";
import { getPrices, PRICE_CONFIG } from "./lib/prices.js";
import { getLonjaPrices, LONJA } from "./lib/lonja.js";
import { getNormativaVigente, NORMATIVA } from "./lib/normativa.js";
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
  applyShared,
  sharedKeys,
  sharedState,
  replaceCatalog,
  updateDailyDigest,
} from "./lib/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Módulos compartidos con el navegador (sin datos ni secretos).
const SHARED_MODULES = new Set(["preferences.js", "aid-view.js", "pac-calendar.js"]);

function readConfig(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "config", name), "utf8"));
}

/** Solo sale de la API lo que tiene enlace a su fuente oficial. */
function withSource(items) {
  return (Array.isArray(items) ? items : []).filter(hasSourceUrl);
}

function withSourceDigests(digests) {
  return (Array.isArray(digests) ? digests : []).map((entry) => ({ ...entry, items: withSource(entry.items) }));
}

/**
 * Fuentes que la app cita fuera de la recogida automática: calendario PAC, precios y herramientas.
 * Salen de los mismos archivos de config/ que usa cada pantalla.
 */
export function referenceSources() {
  const out = [];
  const add = (entry) => {
    if (!safeUrl(entry.url) || out.some((seen) => seen.url === entry.url)) return;
    out.push(entry);
  };
  try {
    const pac = readConfig("pac-calendario.json");
    for (const source of pac.fuentes || []) {
      add({ name: source.nombre, organism: source.organismo || "", url: source.url, usedIn: "Calendario de pagos de la PAC (fechas y citas)" });
      if (source.pdf) add({ name: `${source.nombre} (PDF)`, organism: source.organismo || "", url: source.pdf, usedIn: "Calendario de pagos de la PAC (fechas y citas)" });
    }
  } catch {}
  add({ name: PRICE_CONFIG.fuente, organism: "Ministerio de Agricultura, Pesca y Alimentación", url: PRICE_CONFIG.pagina, usedIn: "Precios (antes «Hoy en el campo»). El Excel semanal se descarga desde esta página." });
  add({ name: LONJA.fuente, organism: LONJA.organismo, url: LONJA.tabla, usedIn: "Precios (fuente «Lonja de Salamanca»). Cotizaciones de cada sesión, tal como las publica la tabla oficial." });
  // v5.8: la fuente de «Normativa en vigor» (pestaña Normativa), también en /fuentes.
  add({ name: NORMATIVA.fuente, organism: "Agencia Estatal Boletín Oficial del Estado", url: NORMATIVA.api, usedIn: "Normativa en vigor (pestaña Normativa). Normas consolidadas vigentes de agricultura, ganadería y pesca, con enlace al texto del BOE." });
  try {
    const tools = readConfig("herramientas.json");
    for (const group of tools.grupos || []) {
      for (const link of group.enlaces || []) add({ name: link.nombre, organism: link.organismo || "", url: link.url, usedIn: "Herramientas oficiales (enlace y cita)" });
    }
  } catch {}
  return out;
}
const PORT = Number(process.env.PORT || 3847);
const HOST = process.env.HOST || "0.0.0.0";

/** Modo «En revisión»: activo salvo REVIEW_MODE=off/0/false. */
export function reviewModeOn(value = process.env.REVIEW_MODE) {
  if (value == null) return true;
  return !["off", "0", "false"].includes(String(value).trim().toLowerCase());
}

export const REVIEW_TEXT = "Versión en revisión. Estamos comprobando los datos; consulta siempre la publicación oficial.";

const REVIEW_BANNER =
  `<div class="review-banner" id="reviewBanner" role="status"><span class="review-dot" aria-hidden="true"></span>` +
  `<strong>Versión en revisión.</strong> <span>Estamos comprobando los datos; consulta siempre la publicación oficial.</span></div>`;

/** index.html con el estado de revisión ya pintado en el servidor (meta robots + cartel). */
export function renderIndexHtml(html, reviewOn) {
  if (!reviewOn) return html;
  return html
    .replace("<head>", '<head>\n  <meta name="robots" content="noindex, nofollow" />')
    .replace(/<body([^>]*)>/, (_m, attrs) => `<body${attrs} data-review="on">\n  ${REVIEW_BANNER}`);
}

export function createApp(options = {}) {
  const reviewOn = options.reviewMode != null ? Boolean(options.reviewMode) : reviewModeOn();
  const accountsOn = options.accountsEnabled != null ? Boolean(options.accountsEnabled) : accountsEnabled();
  const accounts = accountsOn ? options.accounts || openAccounts() : null;
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
if (reviewOn) {
  app.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
}
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain; charset=utf-8");
  res.send(reviewOn ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n");
});
app.get("/api/review", (_req, res) => {
  res.json({ reviewMode: reviewOn, text: reviewOn ? REVIEW_TEXT : null });
});
const indexPath = path.join(__dirname, "public", "index.html");
function sendIndex(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.type("text/html; charset=utf-8");
  res.send(renderIndexHtml(fs.readFileSync(indexPath, "utf8"), reviewOn));
}
app.get(["/", "/index.html"], sendIndex);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));
app.get(/^\/mod\/([a-z-]+\.js)$/, (req, res) => {
  const name = req.params[0];
  if (!SHARED_MODULES.has(name)) {
    res.status(404).type("text/plain; charset=utf-8").send("No encontrado");
    return;
  }
  res.type("application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "lib", name));
});

app.use(
  express.static(path.join(__dirname, "public"), {
    etag: false,
    lastModified: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-store");
    },
  })
);

function keyCandidates(raw) {
  const text = String(raw || "").normalize("NFKC");
  return [...new Set([text, ...text.split(/\r?\n/)].map((part) => part.replace(/[\s\u200b\u200c\u200d\ufeff]/g, "")).filter(Boolean))];
}

function secureRequest(req) {
  return Boolean(req.secure || req.headers["x-forwarded-proto"] === "https");
}

function loginOk(req, res) {
  const token = createSession();
  res.setHeader("Set-Cookie", sessionCookie(token, secureRequest(req)));
  return token;
}

app.post("/entrar", (req, res) => {
  const key = String((req.body && req.body.key) || "");
  if (!keyCandidates(key).some((candidate) => verifyKey(candidate))) {
    res.redirect(303, "/admin?aviso=clave");
    return;
  }
  const token = loginOk(req, res);
  res.redirect(303, "/?entrada=" + encodeURIComponent(token));
});

app.get("/api/fuentes", (_req, res) => {
  const store = getStore();
  res.json({ ...publicSourceView(store.sources || {}, store.lastCollectAt), references: referenceSources() });
});

const publicPages = accounts
  ? "fuentes|quienes-somos|aviso-legal|privacidad|cookies|herramientas|registro|entrar|planes|admin"
  : "fuentes|quienes-somos|aviso-legal|privacidad|cookies|herramientas|planes|admin";
app.get(new RegExp(`^\\/(${publicPages})\\/?$`), sendIndex);
if (!accounts) {
  app.get(/^\/(registro|entrar)\/?$/, (_req, res) => {
    res.status(404).type("text/plain; charset=utf-8").send("Las cuentas no están activas.");
  });
}

app.get("/api/pac-calendario", (_req, res) => {
  try {
    res.json(pacTimeline(readConfig("pac-calendario.json"), madridTodayKey()));
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer el calendario de la PAC" });
  }
});

app.get("/api/herramientas", (_req, res) => {
  try {
    res.json(readConfig("herramientas.json"));
  } catch {
    res.status(500).json({ error: "No se pudo leer la lista de herramientas" });
  }
});

const pricesLoader = options.pricesLoader;
app.get("/api/precios", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await getPrices(pricesLoader ? { loader: pricesLoader } : {}));
});

// v5.7: normas en vigor (BOE, legislación consolidada). Solo lectura de la API oficial; en vigor según `vigencia_agotada`.
const normativaLoader = options.normativaLoader;
app.get("/api/normativa/vigente", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(await getNormativaVigente(normativaLoader ? { loader: normativaLoader } : {}));
});

// v5.7: cotizaciones de la Lonja de Salamanca (tabla oficial de la Diputación).
const lonjaLoader = options.lonjaLoader;
app.get("/api/precios/lonja", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await getLonjaPrices(lonjaLoader ? { loader: lonjaLoader } : {}));
});

// Calendario sin estado: todo viene en la URL y no se guarda nada.
app.get("/calendario.ics", (req, res) => {
  const fecha = String(req.query.fecha || "");
  const titulo = String(req.query.titulo || "").slice(0, 200);
  const enlace = String(req.query.enlace || "");
  if (!validDayKey(fecha)) {
    res.status(400).type("text/plain; charset=utf-8").send("Falta una fecha válida (AAAA-MM-DD).");
    return;
  }
  if (enlace && (enlace.length > 500 || !safeUrl(enlace))) {
    res.status(400).type("text/plain; charset=utf-8").send("El enlace no es válido.");
    return;
  }
  const kind = req.query.tipo === "pac" ? "pac" : "plazo";
  const ics = buildIcs({ title: titulo || "Ayuda", date: fecha, url: enlace, kind });
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="plazo-${fecha}.ics"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(ics);
});

app.get("/api/legal", (_req, res) => {
  res.json({ pages: LEGAL_PAGES });
});

app.get("/api/planes", (_req, res) => {
  res.json(plansView());
});

function accountResult(req, res, result) {
  res.setHeader("Set-Cookie", accounts.cookie(result.token, secureRequest(req)));
  res.json({ ok: true, cuenta: result.user, plans: plansView() });
}

function accountsMissing(_req, res) {
  res.status(404).json({ ok: false, error: "Las cuentas no están activas." });
}

if (accounts) {
  app.post("/api/cuenta/registro", (req, res) => {
    try {
      const body = req.body || {};
      accountResult(req, res, accounts.register({ email: body.email, password: body.password, prefs: body.prefs }));
    } catch (err) {
      const status = err instanceof AccountError ? err.status : 500;
      res.status(status).json({ ok: false, error: err.message || "No se pudo crear la cuenta" });
    }
  });

  app.post("/api/cuenta/entrar", (req, res) => {
    try {
      const body = req.body || {};
      accountResult(req, res, accounts.authenticate({ email: body.email, password: body.password }));
    } catch (err) {
      const status = err instanceof AccountError ? err.status : 500;
      res.status(status).json({ ok: false, error: err.message || "No se pudo entrar" });
    }
  });

  app.post("/api/cuenta/salir", (req, res) => {
    res.setHeader("Set-Cookie", accounts.clearCookie(secureRequest(req)));
    res.json({ ok: true });
  });

  app.put("/api/cuenta/preferencias", (req, res) => {
    const cuenta = accounts.userFromRequest(req);
    if (!cuenta) {
      res.status(401).json({ ok: false, error: "Entra con tu cuenta para guardar las preferencias." });
      return;
    }
    try {
      const prefs = (req.body && req.body.prefs) || req.body || {};
      const user = accounts.savePreferences(cuenta.id, prefs);
      res.json({ ok: true, cuenta: user });
    } catch (err) {
      const status = err instanceof AccountError ? err.status : 500;
      res.status(status).json({ ok: false, error: err.message || "No se guardaron las preferencias" });
    }
  });
} else {
  app.post("/api/cuenta/registro", accountsMissing);
  app.post("/api/cuenta/entrar", accountsMissing);
  app.post("/api/cuenta/salir", accountsMissing);
  app.put("/api/cuenta/preferencias", accountsMissing);
}

app.get("/api/sesion", (req, res) => {
  res.json({
    admin: hasSession(req),
    accounts: Boolean(accounts),
    cuenta: accounts ? accounts.userFromRequest(req) : null,
    plans: plansView(),
  });
});

app.post("/api/login", (req, res) => {
  const key = String((req.body && req.body.key) || "");
  if (!keyCandidates(key).some((candidate) => verifyKey(candidate))) {
    res.status(401).json({ ok: false, error: "Clave incorrecta. Tiene que verse entera, con el símbolo #." });
    return;
  }
  const token = loginOk(req, res);
  res.json({ ok: true, token });
});

let collecting = false;
let syncing = false;
let syncQueued = false;
const PHONE_URL = "https://alerta-agraria-bcana.onrender.com";

function readAccessKey() {
  const files = [
    path.join(__dirname, "Clave de entrada.txt"),
    "C:\\Users\\bcana\\Desktop\\Clave de entrada Alerta Agraria.txt",
  ];
  for (const file of files) {
    try {
      const line = fs
        .readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((part) => part.trim())
        .find((part) => part.includes("#") && part.length <= 20);
      if (line) return line;
    } catch {
      /* el archivo puede no estar */
    }
  }
  return "";
}

async function syncWithPhone() {
  if (process.env.RENDER) return;
  const key = readAccessKey();
  if (!key) throw new Error("No encuentro la clave de entrada");
  const loginRes = await fetch(PHONE_URL + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) throw new Error(loginData.error || "No se pudo entrar");
  const headers = {
    Authorization: "Bearer " + loginData.token,
    "Content-Type": "application/json",
  };
  const estado = await fetch(PHONE_URL + "/api/state", { headers });
  const remoto = await readBody(estado);
  if (!estado.ok) throw new Error(remoto.error || "No se pudo leer el movil");
  applyShared({
    hidden: Array.isArray(remoto.hidden) ? remoto.hidden : [],
    archive: Array.isArray(remoto.archive) ? remoto.archive : [],
    items: Array.isArray(remoto.items) ? remoto.items : [],
    digests: Array.isArray(remoto.digests) ? remoto.digests : [],
  });
  const local = sharedState();
  const res = await fetch(PHONE_URL + "/api/sync", {
    method: "POST",
    headers,
    body: JSON.stringify(local),
  });
  const data = await readBody(res);
  if (!res.ok || data.ok === false) throw new Error(data.error || "No se copiaron los cambios");
  console.log("[alerta] Sincronizado con el movil");
}

function shareWithPhone() {
  if (process.env.RENDER) return;
  if (collecting || syncing) {
    syncQueued = true;
    return;
  }
  syncing = true;
  syncWithPhone()
    .catch((err) => console.error("[alerta] No se pudo sincronizar:", err.message))
    .finally(() => {
      syncing = false;
      if (!syncQueued) return;
      syncQueued = false;
      shareWithPhone();
    });
}

async function runCollect(reason = "manual") {
  if (collecting) return { skipped: true, reason: "already-running" };
  collecting = true;
  setCollecting(true);
  console.log(`[alerta] Recogida iniciada (${reason})`);
  try {
    const { items, catalogs, reports } = await collectAll();
    const { added } = upsertItems(items, reports);
    for (const catalog of catalogs || []) replaceCatalog(catalog.sourceId, catalog.items);
    const visible = getStore();
    updateDailyDigest(visible.items);
    console.log(`[alerta] Recogida lista: ${items.length} ítems, ${added} nuevos. Resumen del día actualizado.`);
    return { skipped: false, added, total: visible.items.length, reports };
  } catch (err) {
    setCollecting(false);
    console.error("[alerta] Recogida fallida", err);
    throw err;
  } finally {
    collecting = false;
    shareWithPhone();
  }
}

app.get("/api/access", requireAuth, (_req, res) => {
  res.json({
    local: `http://localhost:${PORT}`,
    lan: lanUrls(),
    internet: getPublicUrl(),
  });
});

function hiddenKeys(store) {
  return sharedKeys(store);
}

app.get("/api/state", (req, res) => {
  const admin = hasSession(req);
  const store = markOpened();
  const items = admin
    ? store.items
    : (store.items || []).map((item) => ({ ...item, read: false, readAt: "" }));
  res.json({
    categories: CATEGORIES,
    lastCollectAt: store.lastCollectAt,
    collecting: collecting || store.collecting,
    sources: store.sources || {},
    items: withSource(items),
    archive: admin ? store.archive || [] : [],
    hidden: admin ? hiddenKeys(store) : [],
    digests: withSourceDigests(store.digests),
    preferenceSchema: publicSchema(),
    countries: COUNTRIES,
    territories: TERRITORIES,
    sourceCatalog: SOURCES,
    plans: plansView(),
    reviewMode: reviewOn,
    admin,
  });
});

async function readBody(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Respuesta invalida del movil");
  }
}

app.post("/api/sync", requireAuth, (req, res) => {
  const body = req.body || {};
  const store = applyShared({
    hidden: Array.isArray(body.hidden) ? body.hidden : [],
    archive: Array.isArray(body.archive) ? body.archive : [],
    items: Array.isArray(body.items) ? body.items : [],
    digests: Array.isArray(body.digests) ? body.digests : [],
  });
  res.json({
    ok: true,
    items: withSource(store.items),
    archive: store.archive || [],
    hidden: hiddenKeys(store),
    digests: withSourceDigests(store.digests),
  });
});

app.post("/api/refresh", requireAuth, async (_req, res) => {
  try {
    const result = await runCollect("botón");
    const store = getStore();
    res.json({
      ok: true,
      ...result,
      lastCollectAt: store.lastCollectAt,
      items: withSource(store.items),
      archive: store.archive || [],
      sources: store.sources,
      categories: CATEGORIES,
      hidden: hiddenKeys(store),
      digests: withSourceDigests(store.digests),
      preferenceSchema: publicSchema(),
      countries: COUNTRIES,
      territories: TERRITORIES,
      sourceCatalog: SOURCES,
      plans: plansView(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/items/:id/read", requireAuth, (req, res) => {
  const item = markRead(req.params.id);
  shareWithPhone();
  res.json({ ok: Boolean(item), item });
});

app.post("/api/items/:id/archive", requireAuth, (req, res) => {
  const item = archiveItem(req.params.id);
  const store = getStore();
  shareWithPhone();
  res.json({ ok: Boolean(item), item, archive: store.archive, items: store.items });
});

app.post("/api/read-all", requireAuth, (_req, res) => {
  const store = archiveAll();
  res.json({ ok: true, archive: store.archive, items: store.items });
});

app.post("/api/archive/:id/delete", requireAuth, (req, res) => {
  const item = deleteArchived(req.params.id);
  const store = getStore();
  shareWithPhone();
  res.json({ ok: Boolean(item), item, archive: store.archive, hidden: hiddenKeys(store) });
});

app.post("/api/delete-all", requireAuth, (req, res) => {
  const target = req.body && req.body.target === "archive" ? "archive" : "items";
  const store = target === "archive" ? deleteAllArchived() : deleteAllItems();
  shareWithPhone();
  res.json({ ok: true, items: store.items, archive: store.archive, hidden: hiddenKeys(store) });
});

app.post("/api/purge-read", requireAuth, (_req, res) => {
  const store = purgeRead();
  shareWithPhone();
  res.json({ ok: true, items: store.items, hidden: hiddenKeys(store) });
});

  return { app, lanUrls, runCollect, shareWithPhone };
}

const runtime = createApp();

function start() {
  cron.schedule(
    "0 7 * * *",
    () => {
      runtime.runCollect("cron-diario-07:00").catch((err) => console.error(err));
    },
    { timezone: "Europe/Madrid" }
  );

  cron.schedule(
    "0 */6 * * *",
    () => {
      runtime.runCollect("cron-6h").catch((err) => console.error(err));
    },
    { timezone: "Europe/Madrid" }
  );

  const hosted = Boolean(process.env.RENDER || process.env.RAILWAY_ENVIRONMENT);
  runtime.app.listen(PORT, HOST, () => {
    console.log(`Alerta Agraria CyL en http://localhost:${PORT}`);
    for (const url of runtime.lanUrls()) console.log(`Móvil (misma Wi-Fi): ${url}`);
    if (!hosted) {
      try {
        startPublicTunnel(PORT);
      } catch (err) {
        console.error("[alerta] Tunel no disponible:", err.message);
      }
      setInterval(runtime.shareWithPhone, 30000);
    }
    runtime.runCollect("arranque").catch((err) => console.error(err));
    getPrices().catch(() => {});
  });
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) start();
