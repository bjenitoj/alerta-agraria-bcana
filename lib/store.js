import { fileURLToPath } from "node:url";
import { canonicalUrl, decorateItem, documentKeys, isAfterMadridDay, isGenericAidPage, isRecentPublication, titleKey } from "./classify.js";
import { composeDigest, mergeDigestLists } from "./digest.js";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const MAX_ITEMS = 200;

const MAX_ARCHIVE = 2000;
const MAX_DISMISSED = 4000;

function emptyStore() {
  return {
    items: [],
    archive: [],
    dismissedIds: [],
    readScheme: "touch-archive",
    digests: [],
    sources: {},
    lastCollectAt: null,
    lastOpenedAt: null,
    collecting: false,
  };
}

function toArchiveEntry(item, archivedAt = new Date().toISOString()) {
  return {
    id: item.id,
    title: item.title || "",
    url: item.url || "",
    sourceName: item.sourceName || "",
    archivedAt,
  };
}

function ensureArchive(store) {
  if (!Array.isArray(store.archive)) store.archive = [];
  if (!Array.isArray(store.dismissedIds)) store.dismissedIds = [];
  if (!Array.isArray(store.digests)) store.digests = [];
  if (store.readScheme !== "touch-archive") {
    for (const item of store.items || []) {
      if (item) item.read = false;
    }
    store.readScheme = "touch-archive";
  }
  const seen = new Set();
  store.archive = store.archive.filter((entry) => {
    if (!entry || !entry.id || seen.has(entry.id)) return false;
    seen.add(entry.id);
    entry.title = entry.title || "";
    entry.url = entry.url || "";
    entry.sourceName = entry.sourceName || "";
    entry.archivedAt = entry.archivedAt || new Date().toISOString();
    return true;
  });
  const dismissed = new Set(store.dismissedIds.filter(Boolean));
  for (const key of [...dismissed]) {
    const text = String(key);
    if (!text.startsWith("u:")) continue;
    for (const doc of documentKeys(`https://${text.slice(2)}`, "")) dismissed.add(doc);
  }
  for (const entry of store.archive) {
    for (const key of storyKeys(entry)) dismissed.add(key);
  }
  store.items = (store.items || []).filter((item) => {
    if (!item || seen.has(item.id) || isBlocked(dismissed, item)) return false;
    // v5.7: portadas genéricas de ayudas guardadas antes («Ayudas, solicitudes y normativa»…) fuera.
    if (item.kind === "linea" && isGenericAidPage(item.title)) return false;
    const when = item.publishedAt || item.firstSeenAt;
    if (when && isAfterMadridDay(when)) {
      dismissed.add(item.id);
      return false;
    }
    return true;
  });
  store.dismissedIds = trimDismissed(dismissed);
  return store;
}

export function makeId(sourceId, url, title) {
  const key = canonicalUrl(url) || titleKey(title) || `${sourceId}|${title}`;
  return crypto.createHash("sha1").update(key).digest("hex");
}

export function makeLineId(sourceId, url, title) {
  const key = `${sourceId}|${canonicalUrl(url)}|${titleKey(title)}`;
  return crypto.createHash("sha1").update(key).digest("hex");
}

function storyKeys(item) {
  if (!item) return [];
  const keys = [];
  if (item.id) keys.push(item.id);
  const url = canonicalUrl(item.url);
  const title = titleKey(item.title);
  if (item.kind === "linea") {
    if (url && title) keys.push(`t:${url}|${title}`);
    return keys;
  }
  if (url) keys.push(`u:${url}`);
  if (title.length >= 40) keys.push(`t:${title}`);
  for (const key of documentKeys(item.url, item.title)) keys.push(key);
  return keys;
}

function trimDismissed(keys) {
  const list = [...keys].filter(Boolean).map(String);
  const tombstone = list.filter((key) => /^(u:|t:|x:|d:)/.test(key));
  const other = list.filter((key) => !/^(u:|t:|x:|d:)/.test(key));
  const kept = tombstone.slice(-MAX_DISMISSED);
  const room = Math.max(0, MAX_DISMISSED - kept.length);
  return [...other.slice(-room), ...kept];
}

function addDismissedKey(store, key) {
  if (!key) return;
  const set = new Set((store.dismissedIds || []).filter(Boolean));
  set.add(key);
  store.dismissedIds = trimDismissed(set);
}

function dismiss(store, item) {
  const set = new Set((store.dismissedIds || []).filter(Boolean));
  for (const key of storyKeys(item)) set.add(key);
  store.dismissedIds = trimDismissed(set);
}

function isSharedKey(key) {
  const text = String(key);
  return text.startsWith("u:") || text.startsWith("t:") || text.startsWith("x:") || text.startsWith("r:") || text.startsWith("p:") || text.startsWith("d:");
}

function removeDismissedKey(store, key) {
  if (!key) return;
  store.dismissedIds = (store.dismissedIds || []).filter((item) => item !== key);
}

function keysWithPrefix(keys, prefix) {
  const out = new Set();
  for (const key of keys) {
    const text = String(key);
    if (text.startsWith(prefix)) out.add(text.slice(prefix.length));
  }
  return out;
}

function isBlocked(blocked, item) {
  return storyKeys(item).some((key) => blocked.has(key));
}

export function sharedKeys(store) {
  return (store.dismissedIds || []).filter(isSharedKey);
}

export function sharedState() {
  const store = getStore();
  return {
    hidden: sharedKeys(store),
    archive: store.archive || [],
    items: (store.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      summary: item.summary || "",
      sourceId: item.sourceId || "",
      sourceName: item.sourceName || "",
      publishedAt: item.publishedAt,
      dateSource: "meta",
      category: item.category,
      topic: item.topic,
      region: item.region,
      zone: item.zone || "",
      sectors: item.sectors || [],
      crops: item.crops || [],
      water: item.water || null,
      themes: item.themes || [],
      infoTypes: item.infoTypes || [],
      kind: item.kind || "",
      aid: item.aid || null,
      read: Boolean(item.read),
      readAt: item.readAt || "",
    })),
    digests: store.digests || [],
  };
}

function mergeItems(store, items, set) {
  const byUrl = new Map();
  for (const item of store.items || []) {
    const url = canonicalUrl(item && item.url);
    if (url) byUrl.set(url, item);
  }
  for (const incoming of items || []) {
    const url = canonicalUrl(incoming && incoming.url);
    if (!incoming || !url || !incoming.publishedAt || isBlocked(set, incoming)) continue;
    const readAt = incoming.readAt || "";
    let current = byUrl.get(url);
    if (!current) {
      current = {
        ...incoming,
        id: incoming.id || makeId("sync", incoming.url, incoming.title || ""),
        dateSource: incoming.dateSource || "meta",
        read: Boolean(incoming.read),
        readAt,
        firstSeenAt: incoming.firstSeenAt || new Date().toISOString(),
      };
      store.items.push(current);
      byUrl.set(url, current);
    } else if (readAt && readAt > (current.readAt || "")) {
      current.read = Boolean(incoming.read);
      current.readAt = readAt;
    }
    if (incoming.aid) current.aid = { ...(current.aid || {}), ...incoming.aid };
    for (const field of ["zone", "sectors", "crops", "water", "themes", "infoTypes", "kind", "category"]) {
      if (incoming[field] != null && incoming[field] !== "") current[field] = incoming[field];
    }
    if (current.read) {
      set.add(`r:${url}`);
      set.delete(`p:${url}`);
    } else if (readAt) {
      set.delete(`r:${url}`);
      set.add(`p:${url}`);
    }
  }
}

export function applyShared({ hidden = [], archive = [], items = [], digests = [] } = {}) {
  const store = ensureArchive(loadRaw());
  const set = new Set(store.dismissedIds || []);
  for (const key of hidden) if (key && isSharedKey(key)) set.add(String(key));
  mergeItems(store, items, set);
  const gone = keysWithPrefix(set, "x:");
  const readUrls = keysWithPrefix(set, "r:");
  const pendingUrls = keysWithPrefix(set, "p:");
  store.archive = store.archive.filter((entry) => !gone.has(canonicalUrl(entry.url)));
  const seen = new Set(store.archive.map((entry) => canonicalUrl(entry.url)));
  for (const entry of archive) {
    const urlKey = canonicalUrl(entry && entry.url);
    if (!entry || !urlKey || seen.has(urlKey) || gone.has(urlKey)) continue;
    store.archive.unshift({
      id: entry.id || makeId("sync", entry.url, entry.title || ""),
      title: entry.title || "",
      url: entry.url,
      sourceName: entry.sourceName || "",
      archivedAt: entry.archivedAt || new Date().toISOString(),
    });
    for (const key of storyKeys(entry)) set.add(key);
    seen.add(urlKey);
  }
  for (const item of store.items || []) {
    if (!item) continue;
    const url = canonicalUrl(item.url);
    if (pendingUrls.has(url)) item.read = false;
    else if (readUrls.has(url)) item.read = true;
  }
  store.dismissedIds = trimDismissed(set);
  const blocked = new Set(store.dismissedIds);
  store.items = (store.items || []).filter((item) => item && !isBlocked(blocked, item));
  store.digests = mergeDigestLists(store.digests || [], digests);
  save(store);
  return getStore();
}

export function dedupeRecent(items) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const sorted = [...(items || [])].filter(Boolean).sort(
    (a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0)
  );
  const out = [];
  for (const item of sorted) {
    if (item.dateSource !== "meta" || !isRecentPublication(item.publishedAt)) continue;
    const url = canonicalUrl(item.url);
    const title = titleKey(item.title);
    if (url && seenUrl.has(url)) continue;
    if (title.length >= 40 && seenTitle.has(title)) continue;
    if (url) seenUrl.add(url);
    if (title.length >= 40) seenTitle.add(title);
    out.push(item);
  }
  return out.slice(0, MAX_ITEMS);
}

function loadRaw() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch {
    return emptyStore();
  }
}

function save(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function isPinnedAid(item) {
  const status = item?.aid?.status;
  return status === "abierta" || status === "proxima" || status === "cierra_pronto";
}

export function combineItems(items) {
  const decorated = (items || []).map((item) => decorateItem(item)).filter(Boolean);
  const pinned = [];
  const rest = [];
  for (const item of decorated) {
    if (item.kind === "linea" || isPinnedAid(item)) pinned.push(item);
    else rest.push(item);
  }
  const out = [];
  const seen = new Set();
  const seenUrl = new Set();
  const seenTitle = new Set();
  for (const item of [...pinned, ...dedupeRecent(rest)]) {
    if (!item || seen.has(item.id)) continue;
    const url = canonicalUrl(item.url);
    const title = titleKey(item.title);
    if (item.kind !== "linea") {
      if (url && seenUrl.has(url)) continue;
      if (title.length >= 40 && seenTitle.has(title)) continue;
    }
    seen.add(item.id);
    if (url) seenUrl.add(url);
    if (title.length >= 40) seenTitle.add(title);
    out.push(item);
  }
  const lines = out.filter((item) => item.kind === "linea");
  const open = out.filter((item) => item.kind !== "linea" && isPinnedAid(item));
  const news = out.filter((item) => item.kind !== "linea" && !isPinnedAid(item));
  return [...lines, ...open, ...news].slice(0, 500);
}

export function getStore() {
  const store = ensureArchive(loadRaw());
  store.items = combineItems(store.items || []);
  return store;
}

export function markOpened() {
  const store = ensureArchive(loadRaw());
  store.lastOpenedAt = new Date().toISOString();
  save(store);
  return getStore();
}

export function archiveItem(id) {
  const store = ensureArchive(loadRaw());
  const idx = store.items.findIndex((it) => it.id === id);
  if (idx === -1) {
    const existing = store.archive.find((it) => it.id === id);
    return existing || null;
  }
  const [item] = store.items.splice(idx, 1);
  const entry = toArchiveEntry(item);
  store.archive.unshift(entry);
  dismiss(store, item);
  if (store.archive.length > MAX_ARCHIVE) {
    store.archive = store.archive.slice(0, MAX_ARCHIVE);
  }
  save(store);
  return entry;
}

export function archiveAll() {
  const store = ensureArchive(loadRaw());
  const now = new Date().toISOString();
  const existing = new Set(store.archive.map((it) => it.id));
  for (const item of store.items) {
    if (!item || existing.has(item.id)) continue;
    store.archive.unshift(toArchiveEntry(item, now));
    dismiss(store, item);
    existing.add(item.id);
  }
  store.items = [];
  if (store.archive.length > MAX_ARCHIVE) {
    store.archive = store.archive.slice(0, MAX_ARCHIVE);
  }
  save(store);
  return store;
}

export function markRead(id) {
  const store = ensureArchive(loadRaw());
  const item = store.items.find((it) => it.id === id);
  if (!item) return null;
  const url = canonicalUrl(item.url);
  if (item.read) {
    item.read = false;
    item.readAt = null;
    if (url) {
      removeDismissedKey(store, `r:${url}`);
      addDismissedKey(store, `p:${url}`);
    }
  } else {
    item.read = true;
    item.readAt = new Date().toISOString();
    if (url) {
      removeDismissedKey(store, `p:${url}`);
      addDismissedKey(store, `r:${url}`);
    }
  }
  save(store);
  return item;
}

export function markAllRead() {
  return archiveAll();
}

export function deleteArchived(id) {
  const store = ensureArchive(loadRaw());
  const idx = store.archive.findIndex((it) => it.id === id);
  if (idx === -1) return null;
  const [entry] = store.archive.splice(idx, 1);
  dismiss(store, entry);
  const url = canonicalUrl(entry.url);
  if (url) addDismissedKey(store, `x:${url}`);
  save(store);
  return entry;
}

export function deleteAllArchived() {
  const store = ensureArchive(loadRaw());
  for (const entry of store.archive) {
    dismiss(store, entry);
    const url = canonicalUrl(entry.url);
    if (url) addDismissedKey(store, `x:${url}`);
  }
  store.archive = [];
  save(store);
  return store;
}

export function deleteAllItems() {
  const store = ensureArchive(loadRaw());
  for (const item of store.items) dismiss(store, item);
  store.items = [];
  save(store);
  return store;
}

export function purgeRead() {
  const store = ensureArchive(loadRaw());
  const keep = [];
  for (const item of store.items) {
    if (item && item.read) dismiss(store, item);
    else if (item) keep.push(item);
  }
  store.items = keep;
  save(store);
  return store;
}

export function upsertItems(newItems, sourceReports) {
  const store = ensureArchive(loadRaw());
  const blocked = new Set((store.dismissedIds || []).filter(Boolean));
  for (const entry of store.archive) {
    for (const key of storyKeys(entry)) blocked.add(key);
  }
  const byId = new Map(store.items.map((it) => [it.id, it]));
  const now = new Date().toISOString();
  let added = 0;

  for (const incoming of newItems) {
    if (!incoming) continue;
    const normalized = decorateItem(incoming);
    if (!normalized) continue;
    if (isBlocked(blocked, normalized)) continue;
    if (normalized.publishedAt && isAfterMadridDay(normalized.publishedAt)) continue;
    const prev = byId.get(normalized.id);
    if (prev) {
      Object.assign(prev, {
        title: incoming.title,
        summary: incoming.summary,
        url: incoming.url,
        publishedAt: normalized.publishedAt || prev.publishedAt,
        dateSource: "meta",
        category: incoming.category,
        sourceId: incoming.sourceId,
        sourceName: incoming.sourceName,
        topic: normalized.topic,
        region: normalized.region,
        zone: normalized.zone,
        sectors: normalized.sectors,
        crops: normalized.crops,
        water: normalized.water,
        themes: normalized.themes,
        infoTypes: normalized.infoTypes,
        aid: normalized.aid,
        kind: normalized.kind,
      });
      continue;
    }
    byId.set(normalized.id, { ...normalized, dateSource: normalized.dateSource || "meta", firstSeenAt: now, read: false });
    added += 1;
  }

  store.items = combineItems([...byId.values()]);
  store.lastCollectAt = now;
  store.collecting = false;
  const previous = store.sources || {};
  const next = {};
  for (const [id, report] of Object.entries(sourceReports || {})) {
    const prior = previous[id] || {};
    next[id] = {
      ...report,
      lastOkAt: report && report.ok ? now : prior.lastOkAt || null,
    };
  }
  store.sources = next;
  save(store);
  return { store, added };
}

export function replaceCatalog(sourceId, incoming) {
  const store = ensureArchive(loadRaw());
  const blocked = new Set((store.dismissedIds || []).filter(Boolean));
  const keep = [];
  const prevById = new Map();
  for (const item of store.items || []) {
    if (item && item.kind === "linea" && item.sourceId === sourceId) prevById.set(item.id, item);
    else if (item) keep.push(item);
  }
  const now = new Date().toISOString();
  for (const item of incoming || []) {
    if (!item || isBlocked(blocked, item)) continue;
    const prev = prevById.get(item.id);
    keep.push({
      ...item,
      kind: "linea",
      read: prev ? Boolean(prev.read) : Boolean(item.read),
      readAt: prev?.readAt || item.readAt || null,
      firstSeenAt: prev?.firstSeenAt || item.firstSeenAt || now,
    });
  }
  store.items = keep;
  save(store);
  return store;
}

export function updateDailyDigest(items, now = new Date()) {
  const store = ensureArchive(loadRaw());
  const next = composeDigest(store.digests || [], items, now);
  store.digests = mergeDigestLists(
    (store.digests || []).filter((entry) => entry.date !== next.date),
    [next]
  );
  save(store);
  return next;
}

export function setCollecting(value) {
  const store = loadRaw();
  store.collecting = value;
  save(store);
  return store;
}
