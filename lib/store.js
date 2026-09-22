import { fileURLToPath } from "node:url";
import { decorateItem, isAfterMadridDay, isPesca } from "./classify.js";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const MAX_ITEMS = 600;
const KEEP_DAYS = 45;

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
    if (!item || seen.has(item.id) || dismissed.has(item.id)) return false;
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
  return crypto.createHash("sha1").update(`${sourceId}|${url}|${title}`).digest("hex");
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
  store.items = (store.items || []).map(decorateItem).filter(Boolean);
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
  if (entry?.id && !store.dismissedIds.includes(entry.id)) {
    store.dismissedIds.push(entry.id);
    if (store.dismissedIds.length > MAX_DISMISSED) {
      store.dismissedIds = store.dismissedIds.slice(-MAX_DISMISSED);
    }
  }
  save(store);
  return entry;
}

export function deleteAllArchived() {
  const store = ensureArchive(loadRaw());
  const dismissed = new Set(store.dismissedIds.filter(Boolean));
  for (const entry of store.archive) {
    if (entry?.id) dismissed.add(entry.id);
  }
  store.archive = [];
  store.dismissedIds = [...dismissed].slice(-MAX_DISMISSED);
  save(store);
  return store;
}

export function deleteAllItems() {
  const store = ensureArchive(loadRaw());
  const dismissed = new Set(store.dismissedIds.filter(Boolean));
  for (const item of store.items) {
    if (item?.id) dismissed.add(item.id);
  }
  store.items = [];
  store.dismissedIds = [...dismissed].slice(-MAX_DISMISSED);
  save(store);
  return store;
}

export function purgeRead() {
  const store = ensureArchive(loadRaw());
  const dismissed = new Set(store.dismissedIds.filter(Boolean));
  const keep = [];
  for (const item of store.items) {
    if (item && item.read) {
      dismissed.add(item.id);
    } else if (item) {
      keep.push(item);
    }
  }
  store.items = keep;
  store.dismissedIds = [...dismissed].slice(-MAX_DISMISSED);
  save(store);
  return store;
}

export function upsertItems(newItems, sourceReports) {
  const store = ensureArchive(loadRaw());
  const archivedIds = new Set(store.archive.map((it) => it.id));
  const dismissedIds = new Set((store.dismissedIds || []).filter(Boolean));
  const byId = new Map(store.items.map((it) => [it.id, it]));
  const now = new Date().toISOString();
  let added = 0;

  for (const incoming of newItems) {
    if (!incoming || isPesca(`${incoming.title} ${incoming.summary}`)) continue;
    const normalized = decorateItem(incoming);
    if (!normalized) continue;
    if (archivedIds.has(normalized.id) || dismissedIds.has(normalized.id)) continue;
    if (normalized.publishedAt && isAfterMadridDay(normalized.publishedAt)) continue;
    const prev = byId.get(normalized.id);
    if (prev) {
      Object.assign(prev, {
        title: incoming.title,
        summary: incoming.summary,
        url: incoming.url,
        publishedAt: normalized.publishedAt || prev.publishedAt,
        category: incoming.category,
        sourceId: incoming.sourceId,
        sourceName: incoming.sourceName,
        topic: normalized.topic,
        region: normalized.region,
      });
      continue;
    }
    byId.set(normalized.id, { ...normalized, firstSeenAt: now, read: false });
    added += 1;
  }

  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  let items = [...byId.values()]
    .map(decorateItem)
    .filter(Boolean)
    .filter((it) => {
      const when = it.publishedAt || it.firstSeenAt || now;
      if (isAfterMadridDay(when)) return false;
      const t = Date.parse(when);
      if (Number.isNaN(t)) return true;
      return t >= cutoff;
    });
  items.sort(
    (a, b) =>
      Date.parse(b.publishedAt || b.firstSeenAt) - Date.parse(a.publishedAt || a.firstSeenAt)
  );
  if (items.length > MAX_ITEMS) items = items.slice(0, MAX_ITEMS);

  store.items = items;
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
