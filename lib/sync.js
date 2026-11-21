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

export function mergeSync(local, remote, now = new Date()) {
  const left = local || {};
  const right = remote || {};
  const favorites = {};
  for (const source of [right.favorites, left.favorites]) {
    for (const [id, fav] of Object.entries(source || {})) {
      if (!fav || typeof fav !== "object") continue;
      const prev = favorites[id];
      if (!prev || favTime(fav) >= favTime(prev)) favorites[id] = { ...fav, id: fav.id || id };
    }
  }
  const favoriteRemoved = laterMap(left.favoriteRemoved, right.favoriteRemoved, MAX_FAVS);
  for (const [id, when] of Object.entries(favoriteRemoved)) {
    const fav = favorites[id];
    if (!fav || Date.parse(when) >= favTime(fav)) delete favorites[id];
    else delete favoriteRemoved[id];
  }
  const prefs = newerPrefs(
    left.prefs && typeof left.prefs === "object" ? left.prefs : null,
    right.prefs && typeof right.prefs === "object" ? right.prefs : null
  );
  return {
    v: 1,
    read: laterMap(left.read, right.read, MAX_MARKS),
    deleted: laterMap(left.deleted, right.deleted, MAX_MARKS),
    favorites,
    favoriteRemoved,
    prefs: prefs || null,
    updatedAt: new Date(now).toISOString(),
  };
}

export function emptySync(now = new Date()) {
  return mergeSync({}, {}, now);
}
