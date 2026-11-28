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

function newerView(left, right) {
  const l = left && typeof left === "object" ? left : null;
  const r = right && typeof right === "object" ? right : null;
  if (!l) return r;
  if (!r) return l;
  const lt = Date.parse(l.updatedAt);
  const rt = Date.parse(r.updatedAt);
  if (!Number.isFinite(lt)) return Number.isFinite(rt) ? r : l;
  if (!Number.isFinite(rt)) return l;
  return lt >= rt ? l : r;
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
  const restored = laterMap(left.restored, right.restored, MAX_MARKS);
  for (const [key, when] of Object.entries(restored)) {
    if (!deleted[key] || when >= deleted[key]) delete deleted[key];
    else delete restored[key];
  }
  const read = laterMap(left.read, right.read, MAX_MARKS);
  const unread = laterMap(left.unread, right.unread, MAX_MARKS);
  for (const [key, when] of Object.entries(unread)) {
    if (!read[key] || when >= read[key]) delete read[key];
    else delete unread[key];
  }
  const gone = {};
  for (const source of [right.gone, left.gone]) {
    for (const key of Object.keys(source || {})) if (key) gone[String(key).slice(0, 200)] = 1;
  }
  const deletedInfo = {};
  for (const source of [right.deletedInfo, left.deletedInfo]) {
    for (const [key, value] of Object.entries(source || {})) {
      if (!value || typeof value !== "object" || !deleted[key]) continue;
      const prev = deletedInfo[key];
      if (!prev || String(value.at || "") >= String(prev.at || "")) {
        deletedInfo[key] = {
          title: String(value.title || "").slice(0, 350),
          source: String(value.source || "").slice(0, 120),
          at: value.at || deleted[key],
        };
      }
    }
  }
  for (const [alias, primary] of Object.entries(aliases)) {
    if (!deleted[primary] && !deleted[alias]) delete aliases[alias];
  }
  const prefs = newerPrefs(
    left.prefs && typeof left.prefs === "object" ? left.prefs : null,
    right.prefs && typeof right.prefs === "object" ? right.prefs : null
  );
  return {
    v: 1,
    read,
    unread,
    deleted,
    deletedInfo,
    gone,
    restored,
    aliases,
    favorites,
    favoriteRemoved,
    prefs: prefs || null,
    view: newerView(left.view, right.view),
    updatedAt: new Date(now).toISOString(),
  };
}

export function absorbHideKeys(deleted, keys, now = new Date()) {
  const out = { ...(deleted && typeof deleted === "object" && !Array.isArray(deleted) ? deleted : {}) };
  const stamp = now instanceof Date ? now.toISOString() : (iso(now) || new Date().toISOString());
  for (const entry of keys || []) {
    const text = String(entry?.key || entry || "").slice(0, 200);
    const given = entry && typeof entry === "object" ? entry.at : "";
    if (!text || text.startsWith("r:") || text.startsWith("p:")) continue;
    if (!iso(out[text])) out[text] = iso(given) || stamp;
  }
  return out;
}

/** Texto legible de una clave antigua, cuando la noticia ya no está en ninguna fuente. */
export function labelFromDeletedKey(key) {
  const text = String(key || "");
  const cut = text.indexOf(":");
  const kind = cut === -1 ? "" : text.slice(0, cut);
  const rest = cut === -1 ? text : text.slice(cut + 1);
  if (kind === "t") {
    const title = (rest.includes("|") ? rest.slice(rest.lastIndexOf("|") + 1) : rest).replace(/\s+/g, " ").trim();
    if (title.length < 8) return null;
    return { title: title.charAt(0).toUpperCase() + title.slice(1), source: "" };
  }
  if (kind === "u") {
    const slash = rest.indexOf("/");
    const host = (slash === -1 ? rest : rest.slice(0, slash)).trim();
    const path = slash === -1 ? "" : rest.slice(slash);
    if (!host) return null;
    return { title: path && path !== "/" ? path : host, source: host };
  }
  if (kind === "d") {
    const title = rest.trim();
    if (!title) return null;
    return { title, source: "Documento" };
  }
  return null;
}

/** Hora en que la v7.5 copió bajas antiguas sin fecha. No es una fecha de borrado. */
export const MIGRATION_STAMP = "2026-11-28T10:37:47";

function isMigrationStamp(when) {
  return String(when || "").startsWith(MIGRATION_STAMP);
}

/** Una fila por noticia, solo si hay título real. La fecha es la más antigua que no sea la de la migración. */
export function buildDeletedRows({ deleted = {}, aliases = {}, info = {}, groups = [], now = Date.now(), days = 15 } = {}) {
  const limit = now - days * 86400000;
  const live = Object.keys(deleted).filter((key) => {
    const time = Date.parse(deleted[key]);
    return Number.isFinite(time) && time >= limit;
  });
  const parent = new Map();
  const find = (key) => {
    if (!parent.has(key)) parent.set(key, key);
    if (parent.get(key) !== key) parent.set(key, find(parent.get(key)));
    return parent.get(key);
  };
  const unite = (left, right) => {
    if (!left || !right) return;
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(b, a);
  };
  for (const key of live) find(key);
  for (const key of live) {
    if (key.startsWith("id:")) unite(key, key.slice(3));
    else if (!key.includes(":")) unite(`id:${key}`, key);
  }
  for (const [alias, primary] of Object.entries(aliases || {})) {
    if (live.includes(alias) || live.includes(String(primary))) unite(alias, String(primary));
  }
  for (const group of groups) {
    const marks = (group.marks || []).filter((key) => live.includes(key));
    for (let i = 1; i < marks.length; i += 1) unite(marks[0], marks[i]);
  }
  const buckets = new Map();
  for (const key of live) {
    const root = find(key);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root).push(key);
  }
  const rows = [];
  for (const keys of buckets.values()) {
    const realDates = keys.map((key) => deleted[key]).filter((when) => !isMigrationStamp(when));
    const group = groups.find((entry) => (entry.marks || []).some((key) => keys.includes(key)));
    const stored = keys.map((key) => info[key]).find((row) => row && String(row.title || "").trim());
    const title = String(stored?.title || group?.title || "").trim();
    if (!title) continue;
    const source = String(stored?.source || group?.source || "").trim();
    const approximate = realDates.length === 0;
    const at = approximate ? "" : realDates.slice().sort()[0];
    const key = keys.find((item) => item.startsWith("id:")) || keys[0];
    rows.push({ key, keys, title, source, at, approximate });
  }
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return rows;
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
