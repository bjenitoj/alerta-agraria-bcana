import { fileURLToPath } from "node:url";
import { canonicalUrl, decorateItem, isAfterMadridDay, isPesca, isRecentPublication, titleKey } from "./classify.js";
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
  store.items = (store.items || []).filter((item) => {
    if (!item || seen.has(item.id) || isBlocked(dismissed, item)) return false;
    const when = item.publishedAt || item.firstSeenAt;
    if (when && isAfterMadridDay(when)) {
      dismissed.add(item.id);
      return false;
    }
    return true;
  });
  store.dismissedIds = [...dismissed].slice(-MAX_DISMISSED);
  return store;
}

export function makeId(sourceId, url, title) {
  const key = canonicalUrl(url) || titleKey(title) || `${sourceId}|${title}`;
  return crypto.createHash("sha1").update(key).digest("hex");
}

function storyKeys(item) {
  if (!item) return [];
  const keys = [];
  if (item.id) keys.push(item.id);
  const url = canonicalUrl(item.url);
  const title = titleKey(item.title);
  if (url) keys.push(`u:${url}`);
  if (title.length >= 40) keys.push(`t:${title}`);
  return keys;
}

function addDismissedKey(store, key) {
  if (!key) return;
  const set = new Set((store.dismissedIds || []).filter(Boolean));
  set.add(key);
  store.dismissedIds = [...set].slice(-MAX_DISMISSED);
}

function dismiss(store, item) {
  const set = new Set((store.dismissedIds || []).filter(Boolean));
  for (const key of storyKeys(item)) set.add(key);
  store.dismissedIds = [...set].slice(-MAX_DISMISSED);
}

function isSharedKey(key) {
  const text = String(key);
  return text.startsWith("u:") || text.startsWith("t:") || text.startsWith("x:") || text.startsWith("r:");
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
  const store = ensureArchive(loadRaw());
  return {
    hidden: sharedKeys(store),
    archive: store.archive || [],
  };
}

export function applyShared({ hidden = [], archive = [] } = {}) {
  const store = ensureArchive(loadRaw());
  const set = new Set(store.dismissedIds || []);
  for (const key of hidden) if (key && isSharedKey(key)) set.add(String(key));
  const gone = keysWithPrefix(set, "x:");
  const readUrls = keysWithPrefix(set, "r:");
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
    if (item && readUrls.has(canonicalUrl(item.url))) item.read = true;
  }
  store.dismissedIds = [...set].slice(-MAX_DISMISSED);
  const blocked = new Set(store.dismissedIds);
  store.items = (store.items || []).filter((item) => item && !isBlocked(blocked, item));
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

export function getStore() {
  const store = ensureArchive(loadRaw());
  store.items = dedupeRecent((store.items || []).map(decorateItem).filter(Boolean));
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
  item.read = true;
  item.readAt = new Date().toISOString();
  const url = canonicalUrl(item.url);
  if (url) addDismissedKey(store, `r:${url}`);
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
    if (!incoming || isPesca(`${incoming.title} ${incoming.summary}`)) continue;
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
      });
      continue;
    }
    byId.set(normalized.id, { ...normalized, dateSource: "meta", firstSeenAt: now, read: false });
    added += 1;
  }

  store.items = dedupeRecent([...byId.values()].map(decorateItem).filter(Boolean));
  store.lastCollectAt = now;
  store.collecting = false;
  store.sources = sourceReports;
  save(store);
  return { store, added };
}

export function setCollecting(value) {
  const store = loadRaw();
  store.collecting = value;
  save(store);
  return store;
}
