/** Código de sincronización y fusión de preferencias. Sin Node: lo usa el navegador. */

export const SYNC_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;
export const SYNC_MAX_BYTES = 180_000;
const MAX_MARKS = 3000;
const MAX_FAVS = 400;

export function createSyncCode(bytes = randomBytes(12)) {
  let raw = "";
  for (let i = 0; i < 12; i += 1) raw += SYNC_ALPHABET[bytes[i] % SYNC_ALPHABET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function randomBytes(n) {
  const out = new Uint8Array(n);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(out);
  else for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export function normalizeSyncCode(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length !== 12) return "";
  const code = `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`;
  return CODE_RE.test(code) ? code : "";
}

export function isSyncCode(value) {
  return CODE_RE.test(String(value || ""));
}

function iso(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

function laterMap(left, right, limit) {
  const out = {};
  const put = (key, value) => {
    const when = iso(value);
    if (!when) return;
    const id = String(key || "").slice(0, 200);
    if (!id) return;
    if (!out[id] || when >= out[id]) out[id] = when;
  };
  for (const [key, value] of Object.entries(left || {})) put(key, value);
  for (const [key, value] of Object.entries(right || {})) put(key, value);
  return Object.fromEntries(Object.entries(out).slice(-limit));
}

function newerPrefs(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return Date.parse(left.updatedAt) >= Date.parse(right.updatedAt) ? left : right;
}

function favTime(fav) {
  return Date.parse(fav?.savedAt) || 0;
}

/** Las favoritas antiguas pueden ser `true` o un objeto sin fecha. Hace falta una fecha para compararlas con la baja. */
export const FAV_EPOCH = "1970-01-01T00:00:00.000Z";

export function normalizeFavorite(id, value) {
  if (value === true) return { id: String(id), savedAt: FAV_EPOCH };
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const saved = Date.parse(value.savedAt);
  return {
    ...value,
    id: String(value.id || id),
    savedAt: Number.isFinite(saved) ? new Date(saved).toISOString() : FAV_EPOCH,
  };
}

function relatedIds(id, fav) {
  const out = new Set();
  for (const part of [id, fav?.id, fav?.key]) {
    const text = String(part || "");
    if (!text) continue;
    out.add(text);
    if (text.startsWith("id:")) out.add(text.slice(3));
    else out.add(`id:${text}`);
  }
  return out;
}

function removalTime(keys, favoriteRemoved, deleted) {
  let best = 0;
  for (const key of keys) {
    for (const raw of [favoriteRemoved[key], deleted[key]]) {
      const when = Date.parse(raw || "");
      if (Number.isFinite(when) && when > best) best = when;
    }
  }
  return best;
}

export function mergeSync(local, remote, now = new Date()) {
  const left = local || {};
  const right = remote || {};
  const favorites = {};
  for (const source of [right.favorites, left.favorites]) {
    for (const [id, raw] of Object.entries(source || {})) {
      const fav = normalizeFavorite(id, raw);
      if (!fav) continue;
      const prev = favorites[id];
      if (!prev || favTime(fav) >= favTime(prev)) favorites[id] = fav;
    }
  }
  const favoriteRemoved = laterMap(left.favoriteRemoved, right.favoriteRemoved, MAX_FAVS);
  const deleted = laterMap(left.deleted, right.deleted, MAX_MARKS);
  const aliases = {};
  for (const source of [right.aliases, left.aliases]) {
    for (const [alias, primary] of Object.entries(source || {})) {
      if (!alias || !primary) continue;
      aliases[String(alias).slice(0, 200)] = String(primary).slice(0, 200);
    }
  }
  for (const [id, fav] of Object.entries(favorites)) {
    const keys = relatedIds(id, fav);
    const removedAt = removalTime(keys, favoriteRemoved, deleted);
    if (!removedAt) continue;
    if (removedAt >= favTime(fav)) {
      delete favorites[id];
      const mark = String(fav.id || id);
      const isoWhen = new Date(removedAt).toISOString();
      if (!favoriteRemoved[mark] || isoWhen >= favoriteRemoved[mark]) favoriteRemoved[mark] = isoWhen;
    } else {
      for (const key of keys) delete favoriteRemoved[key];
    }
  }
  const prefs = newerPrefs(
    left.prefs && typeof left.prefs === "object" ? left.prefs : null,
    right.prefs && typeof right.prefs === "object" ? right.prefs : null
  );
  return {
    v: 1,
    read: laterMap(left.read, right.read, MAX_MARKS),
    deleted,
    aliases,
    favorites,
    favoriteRemoved,
    prefs: prefs || null,
    updatedAt: new Date(now).toISOString(),
  };
}

export function absorbHideKeys(deleted, keys, now = new Date()) {
  const out = { ...(deleted && typeof deleted === "object" && !Array.isArray(deleted) ? deleted : {}) };
  const stamp = now instanceof Date ? now.toISOString() : (iso(now) || new Date().toISOString());
  for (const key of keys || []) {
    const text = String(key || "").slice(0, 200);
    if (!text || text.startsWith("r:") || text.startsWith("p:")) continue;
    if (!iso(out[text])) out[text] = stamp;
  }
  return out;
}

export function emptySync(now = new Date()) {
  return mergeSync({}, {}, now);
}

/** Texto de Ajustes. `when` es un instante en ms o una fecha ISO. */
export function syncAgeText(when, now = Date.now()) {
  const time = typeof when === "number" ? when : Date.parse(when);
  if (!Number.isFinite(time)) return "";
  const mins = Math.floor(Math.max(0, now - time) / 60000);
  if (mins < 1) return "Sincronizado hace un momento";
  if (mins < 60) return `Sincronizado hace ${mins} min`;
  return `Sincronizado hace ${Math.floor(mins / 60)} h`;
}
