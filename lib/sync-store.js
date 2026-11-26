import { SYNC_MAX_BYTES, isSyncCode, mergeSync } from "./sync.js";

const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_HITS = 40;

export function allowSyncRequest(ip, now = Date.now()) {
  const key = String(ip || "desconocida");
  const recent = (hits.get(key) || []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_HITS) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [name, list] of hits) if (!list.length || now - list[list.length - 1] > WINDOW_MS) hits.delete(name);
  }
  return true;
}

const MAX_FAVS = 400;

export function memorySyncStore() {
  const rows = new Map();
  return {
    available: true,
    async get(code) {
      return rows.get(code) || null;
    },
    async put(code, doc) {
      const saved = { ...doc, updatedAt: new Date().toISOString() };
      rows.set(code, saved);
      return saved;
    },
  };
}

export function unavailableSyncStore() {
  return { available: false, async get() { return null; }, async put() { return null; } };
}

export function postgresSyncStore(databaseUrl) {
  let pool;
  let ready;
  async function db() {
    if (!pool) {
      const { default: pg } = await import("pg");
      pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
    }
    if (!ready) {
      ready = pool.query(`CREATE TABLE IF NOT EXISTS alerta_sync (
        code text PRIMARY KEY,
        doc jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`).catch((error) => {
        ready = null;
        throw error;
      });
    }
    await ready;
    return pool;
  }
  return {
    available: true,
    async get(code) {
      const result = await (await db()).query("SELECT doc FROM alerta_sync WHERE code = $1", [code]);
      return result.rows[0]?.doc || null;
    },
    async put(code, doc) {
      const saved = { ...doc, updatedAt: new Date().toISOString() };
      await (await db()).query(
        `INSERT INTO alerta_sync (code, doc, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (code) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
        [code, JSON.stringify(saved)]
      );
      return saved;
    },
  };
}

export function openSyncStore(databaseUrl = process.env.DATABASE_URL) {
  return databaseUrl ? postgresSyncStore(databaseUrl) : unavailableSyncStore();
}

function clipText(value, max) {
  return String(value || "").slice(0, max);
}

function cleanFavorite(id, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const url = clipText(value.url, 500);
  if (!/^https?:\/\//i.test(url)) return null;
  const savedAt = Date.parse(value.savedAt);
  if (!Number.isFinite(savedAt)) return null;
  return {
    id: clipText(value.id || id, 80),
    key: clipText(value.key, 200),
    title: clipText(value.title, 350),
    url,
    summary: clipText(value.summary, 400),
    sourceName: clipText(value.sourceName, 120),
    publishedAt: value.publishedAt || null,
    kind: clipText(value.kind, 20),
    category: clipText(value.category, 40),
    zone: clipText(value.zone, 20),
    savedAt: new Date(savedAt).toISOString(),
  };
}

/** Deja solo preferencias pequeñas. El código no se mira aquí. */
export function sanitizeSync(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const merged = mergeSync({
    read: source.read,
    deleted: source.deleted,
    favorites: {},
    favoriteRemoved: source.favoriteRemoved,
    prefs: source.prefs && typeof source.prefs === "object" ? source.prefs : null,
  }, {});
  const favorites = {};
  for (const [id, value] of Object.entries(source.favorites || {})) {
    if (Object.keys(favorites).length >= MAX_FAVS) break;
    const fav = cleanFavorite(id, value);
    if (fav) favorites[fav.id || id] = fav;
  }
  merged.favorites = favorites;
  for (const id of Object.keys(merged.favoriteRemoved)) {
    const fav = merged.favorites[id];
    if (fav && Date.parse(fav.savedAt) > Date.parse(merged.favoriteRemoved[id])) delete merged.favoriteRemoved[id];
    else delete merged.favorites[id];
  }
  const raw = JSON.stringify(merged);
  if (raw.length > SYNC_MAX_BYTES) {
    const error = new Error("Demasiado grande");
    error.status = 413;
    throw error;
  }
  return merged;
}

export function syncUnavailable() {
  const error = new Error("Sincronización no disponible todavía");
  error.status = 503;
  return error;
}

export { isSyncCode };
