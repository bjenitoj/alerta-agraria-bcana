import {
  DEFAULT_PREFS,
  FARM_TYPES,
  FISHING,
  INFO_TYPES,
  PREFS_STORAGE_KEY,
  SECTORS,
  WATERS,
  ZONES,
  compareItems,
  cropsForSector,
  daysUntil,
  digestSelection,
  forYou,
  itemInfoTypes,
  madridTodayKey,
  normalizePrefs,
  prefsSummary,
  sectorScope,
} from "/mod/preferences.js";
import { closesWithin, deadlineInfo, hasSourceUrl, icsHref, icsLink, isClosedAid, itemDetails, whatsappUrl, whyForYou } from "/mod/aid-view.js";

const tabsEl = document.getElementById("tabs");
const appEl = document.getElementById("app");
const sourcesEl = document.getElementById("sources");
const stampEl = document.getElementById("stamp");
const qEl = document.getElementById("q");
const onlyNewEl = document.getElementById("onlyNew");
const onlyTodayBtn = document.getElementById("onlyToday");
const refreshBtn = document.getElementById("refresh");
const readAllBtn = document.getElementById("readAll");
const clearReadBtn = document.getElementById("clearRead");
const settingsBtn = document.getElementById("settingsBtn");
const digestBtn = document.getElementById("digestBtn");
const sectorChoices = document.getElementById("sectorChoices");
const zoneChoices = document.getElementById("zoneChoices");
const sectorBlocks = document.getElementById("sectorBlocks");
const cropsTitle = document.getElementById("cropsTitle");
const infoChoices = document.getElementById("infoChoices");
const cropChoices = document.getElementById("cropChoices");
const wizard = document.getElementById("wizard");
const wizardForm = document.getElementById("wizardForm");
const wizardStep = document.getElementById("wizardStep");
const wizardTitle = document.getElementById("wizardTitle");
const wizardLead = document.getElementById("wizardLead");
const wizardBody = document.getElementById("wizardBody");
const wizardBack = document.getElementById("wizardBack");
const wizardNext = document.getElementById("wizardNext");
const wizardDefault = document.getElementById("wizardDefault");
const prefSheet = document.getElementById("prefSheet");

const PATH = location.pathname.replace(/\/$/, "") || "/";
// Botón pequeño «← Inicio» arriba de todo lo que no es Inicio.
const BACK_HOME_TAB = `<button type="button" class="back-home" data-goto="inicio">← Inicio</button>`;
const BACK_HOME_PAGE = `<nav class="back-home-wrap" aria-label="Volver"><a class="back-home back-home-page" href="/">← Inicio</a></nav>`;
const QUIET = new Set(["/fuentes", "/quienes-somos", "/aviso-legal", "/privacidad", "/cookies", "/planes", "/herramientas"]);
const PRO_PLAN_COPY = "Próximamente: plan Pro con alertas personalizadas por cultivo y zona, avisos de plazos por correo/WhatsApp, calendario de la explotación.";

let onlyToday = false;
// «/#resumen» abre directamente el Resumen del día (lo usa el botón de la cabecera desde las páginas sueltas).
let active = location.hash === "#resumen" ? "resumen" : "inicio";
let prefs = normalizePrefs(null);
let wizardIndex = 0;
let wizardFirstRun = false;
let wizardBefore = null;
let state = {
  categories: [],
  items: [],
  archive: [],
  sources: {},
  sourceCatalog: [],
  digests: [],
  lastCollectAt: null,
  collecting: false,
};
let digestDate = "";

function isAdmin() {
  return document.body.classList.contains("admin");
}

function storageGet(key) {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* el móvil puede bloquear el almacén */ }
  try { sessionStorage.setItem(key, value); } catch { /* igual que arriba */ }
}

let token = storageGet("alerta_token");
try {
  const params = new URLSearchParams(location.search);
  const entrada = params.get("entrada");
  if (entrada) {
    token = entrada;
    storageSet("alerta_token", token);
    params.delete("entrada");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  }
} catch { /* la dirección puede no tener búsqueda */ }

function cleanKey(value) {
  return String(value || "").normalize("NFKC").replace(/[\s\u200b\u200c\u200d\ufeff]/g, "");
}

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", "Bearer " + token);
  const target = token ? url + (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token) : url;
  return fetch(target, { ...options, headers, cache: "no-store" });
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function madridDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function fmtDay(value) {
  if (!value) return "No disponible";
  const key = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value).slice(0, 10) : madridDay(value);
  if (!key) return "No disponible";
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

function fmtStamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" });
}

function canonicalUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|mc_|blobheader|blobnocache)/i.test(key)) parsed.searchParams.delete(key);
    }
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    const query = parsed.searchParams.toString();
    return `${parsed.hostname.replace(/^www\./, "")}${pathname}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return String(url || "").split("#")[0].trim().toLowerCase();
  }
}

function documentKeys(url, title = "") {
  const found = new Set();
  try {
    const parsed = new URL(String(url || ""));
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const id = parsed.searchParams.get("id");
    if (host && id && id.trim().length >= 6) found.add(`d:${host}:${id.trim().toLowerCase()}`);
  } catch { /* la url puede ser relativa */ }
  const blob = `${url || ""} ${title || ""}`;
  for (const match of blob.matchAll(/\b((?:boe|doue|bocyl)[-–][a-z0-9]+(?:[-–][a-z0-9]+){2,6})\b/gi)) {
    found.add(`d:${match[1].replace(/–/g, "-").toLowerCase()}`);
  }
  const uuid = blob.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) found.add(`d:${uuid[0].toLowerCase()}`);
  return [...found];
}

function titleKey(title) {
  return String(title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function storyKeys(item) {
  const keys = [];
  if (item?.id) keys.push(item.id);
  const url = canonicalUrl(item?.url);
  const title = titleKey(item?.title);
  if (item?.kind === "linea") {
    if (url && title) keys.push(`t:${url}|${title}`);
    return keys;
  }
  if (url) keys.push(`u:${url}`);
  if (title.length >= 40) keys.push(`t:${title}`);
  for (const key of documentKeys(item?.url, item?.title)) keys.push(key);
  return keys;
}

function readSet(name) {
  try {
    return new Set(JSON.parse(localStorage.getItem(name) || "[]"));
  } catch {
    return new Set();
  }
}

function writeSet(name, values) {
  try {
    localStorage.setItem(name, JSON.stringify([...values].slice(-4000)));
  } catch { /* sin almacén local */ }
}

function absorbHidden(list) {
  const set = new Set();
  const gone = readSet("alerta_suprimidas");
  for (const key of list || []) {
    const text = String(key);
    if (/^(u|t|x|r|p|d):/.test(text)) set.add(text);
    if (/^(u|t|x|d):/.test(text)) gone.add(text);
  }
  writeSet("alerta_ocultas", set);
  writeSet("alerta_suprimidas", gone);
}

async function pushSuppressed() {
  if (!token) return;
  const hidden = [...readSet("alerta_suprimidas")].filter((key) => /^(u|t|x|d):/.test(String(key)));
  if (!hidden.length) return;
  try {
    await api("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden, archive: [], items: [] }),
    });
  } catch { /* se reintenta en la siguiente carga */ }
}

function rememberMark(item, prefix) {
  const url = canonicalUrl(item?.url);
  if (!url) return;
  const set = readSet("alerta_ocultas");
  set.add(prefix + url);
  writeSet("alerta_ocultas", set);
}

function forgetMark(item, prefix) {
  const url = canonicalUrl(item?.url);
  if (!url) return;
  const set = readSet("alerta_ocultas");
  set.delete(prefix + url);
  writeSet("alerta_ocultas", set);
}

function remember(item, bucket) {
  const set = readSet(bucket);
  for (const key of storyKeys(item)) set.add(key);
  writeSet(bucket, set);
}

function suppress(item) {
  remember(item, "alerta_suprimidas");
}

function unseen(items, bucket, options = {}) {
  const hidden = readSet(bucket);
  const gone = options.keepArchived ? new Set() : readSet("alerta_suprimidas");
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const item of items || []) {
    const keys = storyKeys(item);
    if (keys.some((key) => hidden.has(key) || gone.has(key))) continue;
    const url = canonicalUrl(item.url);
    const title = titleKey(item.title);
    if (item.kind !== "linea") {
      if (url && seenUrl.has(url)) continue;
      if (title.length >= 40 && seenTitle.has(title)) continue;
    }
    if (url) seenUrl.add(url);
    if (title.length >= 40) seenTitle.add(title);
    out.push(item);
  }
  return out;
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { prefs: normalizePrefs(DEFAULT_PREFS), saved: false };
    return { prefs: normalizePrefs(JSON.parse(raw)), saved: true };
  } catch {
    return { prefs: normalizePrefs(DEFAULT_PREFS), saved: false };
  }
}

function savePrefs(next) {
  prefs = normalizePrefs({ ...next, updatedAt: new Date().toISOString() });
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* se mantiene en memoria */ }
  askPersistentStorage();
  paintPrefsNote();
  return prefs;
}

let persistAsked = false;
/** Pide al navegador que no borre lo guardado en este dispositivo (si lo permite). */
function askPersistentStorage() {
  if (persistAsked) return;
  persistAsked = true;
  try {
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  } catch { /* no todos los navegadores lo tienen */ }
}

function isStandalone() {
  try {
    return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

function paintPrefsNote() {
  const note = document.getElementById("prefsAccountNote");
  if (!note) return;
  note.textContent = isStandalone()
    ? "Guardado solo en esta app (aparte de Safari)."
    : "Guardado solo en este dispositivo.";
}

async function loadSession() {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch("/api/sesion", { cache: "no-store", headers });
  const data = await res.json().catch(() => ({}));
  const admin = Boolean(data.admin);
  document.body.classList.toggle("admin", admin);
  if (token && !admin) {
    token = "";
    try {
      localStorage.removeItem("alerta_token");
      sessionStorage.removeItem("alerta_token");
    } catch { /* el almacén puede estar cerrado */ }
  }
  if (data.plans) state.plans = data.plans;
  paintPrefsNote();
}

/** Iconos sencillos de cada opción (solo decoración, el lector de pantalla lee la etiqueta). */
const EMOJI = {
  agricultura: "🌾", ganaderia: "🐄", pesca: "🐟", todos: "🌐",
  ayudas: "💶", pac: "🇪🇺", normativa: "📜", alertas: "⚠️", noticias: "📰",
  "mi-zona": "⭐", salamanca: "📍", cyl: "🏰", nacional: "🇪🇸",
  secano: "☀️", regadio: "💧",
  cereal: "🌾", girasol: "🌻", mejorantes: "🫘", maiz: "🌽", remolacha: "🥕", vinedo: "🍇", olivar: "🫒",
  horticolas: "🍅", vacuno: "🐄", "ovino-caprino": "🐑", porcino: "🐖", avicola: "🐔", apicultura: "🐝",
  lacteo: "🥛", peces: "🐠", moluscos: "🐚", crustaceos: "🦐", algas: "🌿",
  extensiva: "🌳", intensiva: "🏭", mixta: "🔄", autoconsumo: "🏡",
  "pesca-maritima": "🎣", marisqueo: "🦪", acuicultura: "🐟", "pesca-continental": "🏞️",
};
/** Etiquetas cortas para las tarjetas (la etiqueta completa queda para lectores de pantalla). */
const SHORT = { ayudas: "Ayudas", "mi-zona": "Salamanca y CyL", mejorantes: "Leguminosas", horticolas: "Huerta y frutales", "ovino-caprino": "Ovino y caprino" };

/** Segundo bloque del paso 2, según el sector: tierra, tipo de explotación o actividad. */
const SECTOR_BLOCKS = [
  { sector: "agricultura", title: "Tierra", list: WATERS, group: "water" },
  { sector: "ganaderia", title: "Tipo de explotación", list: FARM_TYPES, group: "farm" },
  { sector: "pesca", title: "Actividad", list: FISHING, group: "fishing" },
];
const sectorName = (id) => SECTORS.find((item) => item.id === id)?.label || "";
const sectorHead = (id, extra = "") => `<p class="sector-head"><span aria-hidden="true">${EMOJI[id]}</span> ${escapeHtml(sectorName(id))}${extra ? ` · ${escapeHtml(extra)}` : ""}</p>`;
const CROPS_TITLE = {
  agricultura: ["¿Qué cultivas?", "Cultivos"],
  ganaderia: ["¿Qué crías?", "Especies"],
  pesca: ["¿Qué pescas o crías?", "Especies"],
  todos: ["¿Qué cultivas, crías o pescas?", "Cultivos y especies"],
};
const PLACE_TITLE = { pesca: "¿Dónde trabajas?" };

/** Bloques que dependen del sector. Con «Todos», cada uno bajo su sector y más compactos. */
function sectorBlocksHtml(current) {
  const scope = sectorScope(current.sector);
  const many = current.sector === "todos";
  return SECTOR_BLOCKS.filter((block) => scope[block.sector])
    .map((block) => {
      const hint = !many && block.group !== "water" ? ' <span class="hint">Puedes marcar varios</span>' : "";
      // Con «Todos», una sola línea pequeña: «🌾 Agricultura · Tierra».
      const head = many ? sectorHead(block.sector, block.title) : `<p>${block.title}${hint}</p>`;
      return `<div class="choice-block" data-block="${block.group}">${head}<div class="tiles${many ? " tiles-compact" : ""}">${choiceButtons(block.list, current[block.group], block.group)}</div></div>`;
    })
    .join("");
}

/** Solo los cultivos o especies del sector elegido. Con «Todos», agrupados por sector. */
function cropTilesHtml(current) {
  const list = cropsForSector(current.sector).map(({ id, label, sector }) => ({ id, label, sector }));
  if (current.sector !== "todos") return `<div class="tiles tiles-compact">${choiceButtons(list, current.crops, "crops")}</div>`;
  return ["agricultura", "ganaderia", "pesca"]
    .map((sector) => `<div class="crop-group" data-sector="${sector}">${sectorHead(sector)}<div class="tiles tiles-compact">${choiceButtons(list.filter((item) => item.sector === sector), current.crops, "crops")}</div></div>`)
    .join("");
}

function choiceButtons(list, selected, group, options = {}) {
  return list
    .map((item) => {
      const on = Array.isArray(selected) ? selected.includes(item.id) : selected === item.id;
      const mark = !on ? "" : options.numbered
        ? `<span class="tile-badge num" aria-hidden="true">${selected.indexOf(item.id) + 1}</span>`
        : `<span class="tile-badge" aria-hidden="true">✓</span>`;
      const short = SHORT[item.id] || item.label;
      const aria = options.numbered && on ? `${item.label}, prioridad ${selected.indexOf(item.id) + 1}` : item.label;
      return `<button type="button" class="tile ${on ? "on" : ""}" data-group="${group}" data-id="${item.id}" aria-pressed="${on ? "true" : "false"}" aria-label="${escapeHtml(aria)}"><span class="tile-icon" aria-hidden="true">${EMOJI[item.id] || "•"}</span><span class="tile-label">${escapeHtml(short)}</span>${mark}</button>`;
    })
    .join("");
}

function svgIcon(body) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

const GLYPH = {
  agricultura: svgIcon(`<path d="M12 20V9"/><path d="M12 13c-2.2-1.2-4.2-1-6.2.2 0-3.2 1.6-5.4 6.2-6.2 4.6.8 6.2 3 6.2 6.2-2-.2-4-.4-6.2-.2z"/>`),
  ganaderia: svgIcon(`<path d="M6 16c0-3 2-5 6-5s6 2 6 5v3H6z"/><path d="M8 11 6 7M16 11l2-4"/><circle cx="9" cy="15" r=".6"/><circle cx="15" cy="15" r=".6"/>`),
  pesca: svgIcon(`<path d="M3 13c3-4 6-4 9 0s6 4 9 0c-2 4-6 6-9 6s-7-2-9-6z"/><circle cx="15" cy="12.5" r=".7"/>`),
  todos: svgIcon(`<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>`),
  ayuda: svgIcon(`<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5c.6-1 1.4-1.5 2.5-1.5 1.6 0 2.5.9 2.5 2s-.8 1.8-2.5 2-2.6.8-2.6 2 1 2 2.6 2c1.1 0 2-.5 2.5-1.4"/>`),
  pac: svgIcon(`<path d="M12 20V9"/><path d="M12 13c-2.2-1.2-4.2-1-6.2.2 0-3.2 1.6-5.4 6.2-6.2 4.6.8 6.2 3 6.2 6.2-2-.2-4-.4-6.2-.2z"/>`),
  norma: svgIcon(`<path d="M7 3.5h7l4 4V20H7z"/><path d="M14 3.5V8h4M9 12h6M9 16h6"/>`),
  alerta: svgIcon(`<path d="M12 4a5 5 0 0 1 5 5v3l1.5 2.5H5.5L7 12V9a5 5 0 0 1 5-5z"/><path d="M10 18a2 2 0 0 0 4 0"/>`),
  plazo: svgIcon(`<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/>`),
};

function icon(name) {
  return `<span class="type">${GLYPH[name] || ""}</span>`;
}

function renderChoices() {
  if (!sectorChoices) return;
  sectorChoices.innerHTML = choiceButtons(SECTORS, prefs.sector, "sector");
  zoneChoices.innerHTML = choiceButtons(ZONES, prefs.zone, "zone");
  if (sectorBlocks) sectorBlocks.innerHTML = sectorBlocksHtml(prefs);
  if (infoChoices) infoChoices.innerHTML = choiceButtons(INFO_TYPES, prefs.info, "info", { numbered: true });
  cropChoices.innerHTML = cropTilesHtml(prefs);
  if (cropsTitle) cropsTitle.textContent = (CROPS_TITLE[prefs.sector] || CROPS_TITLE.todos)[1];
}

function togglePref(group, id) {
  const next = { ...prefs, water: [...prefs.water], crops: [...prefs.crops], farm: [...prefs.farm], fishing: [...prefs.fishing], info: [...prefs.info], infoOrder: [...prefs.infoOrder] };
  if (group === "sector") next.sector = id;
  if (group === "zone") next.zone = id;
  if (group === "water") {
    const has = next.water.includes(id);
    if (has && next.water.length === 1) return;
    next.water = has ? next.water.filter((item) => item !== id) : [...next.water, id];
  }
  // Al cambiar de sector, lo que ya no aplica se quita al guardar (normalizePrefs). La zona se queda.
  if (group === "farm" || group === "fishing") {
    next[group] = next[group].includes(id) ? next[group].filter((item) => item !== id) : [...next[group], id];
  }
  if (group === "crops") {
    next.crops = next.crops.includes(id) ? next.crops.filter((item) => item !== id) : [...next.crops, id];
  }
  if (group === "info") {
    // Se pueden marcar varios. El orden en que se pulsan es el orden en que salen; siempre queda al menos uno.
    const has = next.info.includes(id);
    if (has && next.info.length === 1) return;
    next.info = has ? next.info.filter((item) => item !== id) : [...next.info, id];
    next.infoOrder = [...next.info, ...next.infoOrder.filter((item) => !next.info.includes(item))];
  }
  savePrefs(next);
  renderChoices();
  render();
}

const NOTICE = "Información orientativa. Consulta siempre la publicación oficial.";
const FAV_KEY = "alerta_favoritas_v1";
const HIDE_KEY = "alerta_ocultadas_v1";
const OPEN_KEY = "alerta_solo_abiertas";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacén local, queda en esta visita */ }
}

let favorites = readJson(FAV_KEY, {});
if (!favorites || typeof favorites !== "object" || Array.isArray(favorites)) favorites = {};
let hiddenAids = new Set(readJson(HIDE_KEY, []));
let soloAbiertas = (() => {
  try { return localStorage.getItem(OPEN_KEY) !== "0"; } catch { return true; }
})();

function itemKey(item) {
  return canonicalUrl(item?.url) || String(item?.id || "");
}

function isFavorite(item) {
  return Boolean(favorites[item?.id] || Object.values(favorites).some((fav) => fav.key && fav.key === itemKey(item)));
}

function snapshot(item) {
  const aid = item.aid || {};
  return {
    id: item.id,
    key: itemKey(item),
    title: item.title,
    url: item.url,
    summary: item.summary,
    sourceName: item.sourceName,
    publishedAt: item.publishedAt,
    kind: item.kind,
    category: item.category,
    infoTypes: item.infoTypes,
    sectors: item.sectors,
    crops: item.crops,
    water: item.water,
    zone: item.zone,
    bdnsCode: item.bdnsCode,
    tramiteUrl: item.tramiteUrl,
    extra: item.extra,
    aid: {
      what: aid.what, who: aid.who, amount: aid.amount, implies: aid.implies,
      opensAt: aid.opensAt, closesAt: aid.closesAt, deadlineNote: aid.deadlineNote,
      status: aid.status, sourceOpen: aid.sourceOpen, organism: aid.organism, funds: aid.funds, maxAmount: aid.maxAmount,
    },
    savedAt: new Date().toISOString(),
  };
}

function toggleFavorite(id) {
  const item = findItem(id);
  const existing = Object.keys(favorites).find((key) => key === id || (item && favorites[key].key === itemKey(item)));
  if (existing) delete favorites[existing];
  else if (item) favorites[item.id] = snapshot(item);
  writeJson(FAV_KEY, favorites);
}

function isHidden(item) {
  return hiddenAids.has(String(item?.id)) || (canonicalUrl(item?.url) && hiddenAids.has(`u:${canonicalUrl(item.url)}`));
}

function hideAid(id) {
  const item = findItem(id);
  hiddenAids.add(String(id));
  if (item && canonicalUrl(item.url)) hiddenAids.add(`u:${canonicalUrl(item.url)}`);
  writeJson(HIDE_KEY, [...hiddenAids].slice(-2000));
}

function showHiddenAgain() {
  hiddenAids = new Set();
  writeJson(HIDE_KEY, []);
}

function findItem(id) {
  return (state.items || []).find((item) => item.id === id)
    || (state.digests || []).flatMap((entry) => entry.items || []).find((item) => item.id === id)
    || favorites[id]
    || null;
}

function field(label, value) {
  if (!value || !String(value).trim()) return "";
  return `<p><span>${escapeHtml(label)}</span> ${escapeHtml(String(value).trim())}</p>`;
}

const CHECK_OFFICIAL = "Ver en la convocatoria oficial";

function plazoText(aid) {
  if (!aid) return "La convocatoria no indica el plazo";
  if (aid.deadlineAmbiguous && !aid.closesAt && !aid.opensAt) return CHECK_OFFICIAL;
  if (aid.deadlineNote) return aid.deadlineNote;
  const parts = [];
  if (aid.opensAt) parts.push(`Abre el ${fmtDay(aid.opensAt)}`);
  if (aid.closesAt) parts.push(`Cierra el ${fmtDay(aid.closesAt)}`);
  return parts.length ? parts.join(". ") : "La convocatoria no indica el plazo";
}

const STATUS_LABEL = {
  abierta: "Abierta ahora",
  proxima: "Próxima apertura",
  cierra_pronto: "Cierra pronto",
  sin_plazo: "Sin plazo indicado",
  cerrada: "Cerrada",
};

function deadlinePill(aid) {
  const info = deadlineInfo(aid, madridTodayKey());
  const soon = info.kind === "open" && info.days != null && info.days < 15 ? " soon" : "";
  return `<span class="badge deadline dl-${escapeHtml(info.kind)}${soon}">${escapeHtml(info.label)}</span>`;
}

function daysBadge(aid) {
  const left = daysUntil(aid?.closesAt, madridTodayKey());
  if (left == null) return "";
  if (left < 0) return `<p class="days"><strong>—</strong><small>Cerrado</small></p>`;
  if (left === 0) return `<p class="days"><strong>0</strong><small>Último día</small></p>`;
  return `<p class="days"><strong>${left}</strong><small>${left === 1 ? "día" : "días"}</small></p>`;
}

function isAidLike(item) {
  return item.kind === "linea" || item.kind === "ayuda" || (item.infoTypes || []).includes("ayudas") || (item.infoTypes || []).includes("pac");
}

function whyBlock(item) {
  const why = whyForYou(item, prefs);
  const inFilters = forYou(item, prefs);
  const lines = [
    ...why.reasons.map((text) => `<li class="ok">${escapeHtml(text)}</li>`),
    ...(inFilters ? [`<li class="ok">Coincide con tus filtros (clasificación automática por palabras).</li>`] : []),
    ...why.warnings.map((text) => `<li class="warn">${escapeHtml(text)}</li>`),
  ];
  return `
    <section class="block why">
      <h4>Por qué te puede interesar</h4>
      <ul>${lines.join("")}</ul>
      <p class="note">Solo se citan palabras del texto oficial. Los requisitos los fija la convocatoria.</p>
      ${why.who ? `<p class="who"><span>Beneficiarios (texto de la convocatoria):</span> ${escapeHtml(why.who)}</p>` : ""}
    </section>`;
}

function shareButtons(item) {
  const today = madridTodayKey();
  const info = deadlineInfo(item.aid, today);
  const appUrl = location.origin && /^https?:/.test(location.origin) ? `${location.origin}/` : "";
  const fav = isFavorite(item);
  const ics = info.kind !== "closed" ? icsHref(item) : "";
  const calendar = ics
    ? `<a class="act calendar" href="${escapeHtml(ics)}" download>${icon("plazo")}Añadir al calendario</a>`
    : `<span class="act disabled" title="Sin fecha de cierre concreta">${icon("plazo")}${info.kind === "closed" ? "Plazo cerrado" : "Sin fecha para el calendario"}</span>`;
  return `
    <div class="share-row">
      <button type="button" class="act fav ${fav ? "on" : ""}" data-fav="${escapeHtml(item.id)}" aria-pressed="${fav ? "true" : "false"}">${fav ? "★ En favoritas" : "☆ Favorita"}</button>
      <a class="act whatsapp" href="${escapeHtml(whatsappUrl(item, today, appUrl))}" target="_blank" rel="noopener">${WHATSAPP_ICON}Compartir por WhatsApp</a>
      ${calendar}
      <button type="button" class="act hide" data-hide="${escapeHtml(item.id)}">Ocultar esta ayuda</button>
    </div>`;
}

const WHATSAPP_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6z"/><path d="M9.2 8.6c.3 2.6 2.3 4.9 5.2 5.6l1-1.2-1.7-.9-.8.8c-1-.4-1.9-1.3-2.3-2.3l.8-.8-.9-1.7z"/></svg>`;

function typeRow(item) {
  const bits = [];
  if ((item.infoTypes || []).includes("ayudas") || item.kind === "ayuda") bits.push(["ayuda", "Ayuda"]);
  if ((item.infoTypes || []).includes("pac") || item.category === "pac_pagos") bits.push(["pac", "PAC"]);
  if ((item.infoTypes || []).includes("normativa") || item.category === "normativa_convocatorias") bits.push(["norma", "Normativa"]);
  if ((item.themes || []).includes("alerta") || (item.infoTypes || []).includes("alertas")) bits.push(["alerta", "Alerta"]);
  // El sector solo se enseña si el texto oficial trae una palabra que lo justifique.
  const sector = (item.sectors || []).find((id) => GLYPH[id] && item.sectorEvidence && Array.isArray(item.sectorEvidence[id]) && item.sectorEvidence[id].length);
  if (sector) bits.push([sector, SECTORS.find((item) => item.id === sector)?.label || sector]);
  if (!bits.length) return "";
  return `<div class="types">${bits.map(([id, label]) => `<span class="type">${GLYPH[id] || ""}${escapeHtml(label)}</span>`).join("")}</div>`;
}

function aidCard(item, options = {}) {
  // Sin enlace a la fuente oficial no se enseña la ficha.
  if (!hasSourceUrl(item)) return "";
  const aid = item.aid || {};
  const yours = forYou(item, prefs);
  const status = STATUS_LABEL[aid.status] || "";
  const showAid = isAidLike(item);
  const details = itemDetails(item);
  const info = deadlineInfo(aid, madridTodayKey());
  const waterLine = item.water === "secano"
    ? "«secano»"
    : item.water === "regadio"
      ? "«regadío»"
      : item.water === "ambos"
        ? "«secano» y «regadío»"
        : "";
  const sourceOpenNote = aid.status === "abierta" && aid.sourceOpen === false
    ? `<p class="note">La BDNS no la marca como abierta. Las fechas salen de la ficha.</p>`
    : "";
  const tramite = item.tramiteUrl && item.tramiteUrl !== item.url
    ? `<a class="official secondary" href="${escapeHtml(item.tramiteUrl)}" target="_blank" rel="noopener">Tramitar en la sede</a>`
    : "";
  const archive = options.archive || !isAdmin()
    ? ""
    : `<label class="marker"><input type="checkbox" class="mark-archive" data-id="${escapeHtml(item.id)}" /><span>Archivar</span></label>`;
  const ghost = options.snapshot ? `<p class="note">Guardada el ${escapeHtml(fmtDay(item.savedAt))}. Ya no sale en la lista de hoy: estos datos son de cuando la guardaste.</p>` : "";
  const sourceLink = `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.sourceName || "Fuente oficial")}</a>`;
  const fromText = (key) => (details.from?.[key] === "texto" ? " (leído del texto oficial)" : details.from?.[key] === "ficha" ? " (ficha oficial)" : "");
  const maxAmount = details.maxAmount || (details.maxAmountAmbiguous ? CHECK_OFFICIAL : "");
  const amountText = aid.amount || (aid.amountAmbiguous ? CHECK_OFFICIAL : "La convocatoria no indica el importe");
  const fourBlocks = `
    <div class="blocks">
      <section class="block what">
        <h4>Qué ha salido</h4>
        <p>${escapeHtml(aid.what || item.summary || item.title || "")}</p>
        <div class="facts">
          ${field("Organismo:", details.organism ? details.organism + fromText("organism") : "")}
          ${field("Fondo:", (details.funds || []).length ? details.funds.join(", ") + fromText("funds") : "")}
          ${field("Código BDNS:", details.bdnsCode ? details.bdnsCode + fromText("bdnsCode") : "")}
          ${field("Importe máximo:", maxAmount)}
          ${field("Finalidad o tipo (según la fuente):", aid.implies)}
          ${field("Menciona:", waterLine)}
        </div>
      </section>
      ${whyBlock(item)}
      <section class="block money">
        <h4>Plazo e importe</h4>
        <p><span>Plazo:</span> ${escapeHtml(plazoText(aid))}</p>
        ${info.kind === "relative" ? `<p class="note">La fecha exacta depende de la publicación: mira la fuente oficial.</p>` : ""}
        <p><span>Importe:</span> ${escapeHtml(amountText)}</p>
        ${sourceOpenNote}
      </section>
      <section class="block source">
        <h4>Fuente oficial</h4>
        <p>${sourceLink}</p>
        <p class="origin">Publicado: ${escapeHtml(item.publishedAt ? fmtDay(item.publishedAt) : "la fuente no indica la fecha")}</p>
      </section>
    </div>`;
  return `
    <article class="card status-${escapeHtml(aid.status || "sin_plazo")} ${item.read ? "read" : "fresh"} ${yours ? "yours" : "quiet"} ${options.compact ? "compact" : ""}" data-id="${escapeHtml(item.id)}">
      <div class="card-top">
        <div class="pills">
          ${showAid || aid.closesAt ? deadlinePill(aid) : ""}
          ${yours ? `<span class="badge you">En tus filtros</span>` : `<span class="badge other">Fuera de tus filtros</span>`}
          ${status && aid.status !== "cerrada" && aid.status !== "cierra_pronto" && showAid ? `<span class="badge status-${escapeHtml(aid.status || "")}">${escapeHtml(status)}</span>` : ""}
          ${item.kind === "linea" ? `<span class="badge">Línea</span>` : ""}
          ${options.snapshot ? "" : item.read ? `<span class="badge">Leída</span>` : `<span class="badge new">Nueva</span>`}
        </div>
        ${daysBadge(aid)}
      </div>
      ${typeRow(item)}
      <h3>${escapeHtml(item.title || "Sin título")}</h3>
      ${ghost}
      ${showAid ? fourBlocks : `<p class="summary">${escapeHtml(item.summary || "")}</p><p class="origin">${icon("plazo")} Fuente oficial: ${sourceLink} · Publicado: ${escapeHtml(item.publishedAt ? fmtDay(item.publishedAt) : "la fuente no indica la fecha")}</p>`}
      ${shareButtons(item)}
      <p class="orientativo">${NOTICE}</p>
      <div class="card-actions">
        ${archive}
        <a class="official" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Abrir fuente oficial</a>
        ${tramite}
      </div>
    </article>`;
}

function sortedItems(list) {
  const today = madridTodayKey();
  return [...(list || [])].sort((a, b) => compareItems(a, b, prefs, today));
}

function inTab(item, tab) {
  if (tab === "ayudas") return item.category === "ayudas_subvenciones" || (item.infoTypes || []).includes("ayudas") || item.kind === "ayuda";
  if (tab === "pac") return item.category === "pac_pagos" || (item.infoTypes || []).includes("pac") || item.sourceId === "pac_lineas";
  if (tab === "normativa") return item.category === "normativa_convocatorias";
  if (tab === "jovenes") return item.category === "jovenes_modernizacion";
  if (tab === "noticias") return item.category === "noticias_oficiales" || (item.infoTypes || []).includes("noticias");
  return true;
}

/** Piezas del resumen de un día, SOLO de los tipos elegidos. Sin resumen guardado devuelve null. */
function digestData(date) {
  const digests = [...(state.digests || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const current = digests.find((entry) => entry.date === date) || digests[0];
  if (!current) return null;
  const shown = (item) => hasSourceUrl(item) && !isHidden(item) && !(soloAbiertas && isClosedAid(item.aid, madridTodayKey()));
  const aids = (current.items || []).filter(hasSourceUrl);
  const aidIds = new Set(aids.map((item) => item.id));
  const others = unseen(state.items || [], "alerta_ocultas")
    .filter((item) => !aidIds.has(item.id) && hasSourceUrl(item) && madridDay(item.publishedAt) === current.date);
  const sorted = [...aids, ...others].filter(shown).sort((a, b) => compareItems(a, b, prefs, current.date));
  const groups = digestSelection(sorted, prefs).filter((group) => group.items.length);
  return { digests, current, aids, aidIds, sorted, groups, visible: groups.flatMap((group) => group.items) };
}

/** Número para el botón «Resumen» de la cabecera: lo que trae el último resumen en los tipos elegidos. */
function digestBadgeCount() {
  const data = digestData(null);
  return data ? data.visible.length : 0;
}

function paintDigestBtn() {
  if (!digestBtn) return;
  const badge = digestBtn.querySelector(".head-badge");
  const count = digestBadgeCount();
  digestBtn.classList.toggle("on", active === "resumen");
  if (badge) {
    badge.hidden = !count;
    badge.textContent = count > 99 ? "99+" : String(count);
  }
  digestBtn.setAttribute("aria-label", count ? `Resumen del día: ${count} ${count === 1 ? "novedad" : "novedades"}` : "Resumen del día");
}

function digestCard(compact) {
  const digests = [...(state.digests || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!digestDate && digests[0]) digestDate = digests[0].date;
  const data = digestData(digestDate);
  const current = data?.current;
  if (!current) {
    return `<aside class="digest"><div class="digest-head"><span class="mark">${GLYPH.plazo}</span><div><p class="eyebrow">Novedades oficiales</p><h2>Resumen del día</h2><p class="orientativo">Información orientativa. Consulta siempre la publicación oficial.</p></div></div>${closingSoonSection("")}<p class="empty">Todavía no hay resumen. Se genera solo al terminar la consulta del día.</p></aside>`;
  }
  const options = digests
    .map((entry) => `<option value="${escapeHtml(entry.date)}" ${entry.date === current.date ? "selected" : ""}>${escapeHtml(fmtDay(entry.date))}</option>`)
    .join("");
  // Ayudas nuevas del resumen (las guarda el servidor) + el resto de piezas oficiales publicadas ese día.
  // El resumen enseña SOLO los tipos de información elegidos en «Mis preferencias», en su orden.
  const { aids, aidIds, sorted, groups, visible } = data;
  const chosen = prefsSummary(prefs).info;
  const wantsAids = prefs.info.includes("ayudas");
  const wantsDeadlines = wantsAids || prefs.info.includes("pac");
  let emptyText = "";
  if (!visible.length) {
    const visibleAids = sorted.filter((item) => aidIds.has(item.id));
    if (wantsAids && aids.length && !visibleAids.length) {
      emptyText = `Este resumen tiene ${aids.length} ${aids.length === 1 ? "ayuda" : "ayudas"}, pero no se ven con los filtros de ahora (ocultas${soloAbiertas ? " o cerradas: quita «Solo abiertas»" : ""}).`;
    } else if (wantsAids && !aids.length && current.notice) {
      emptyText = current.notice;
    } else {
      emptyText = `No hay novedades de ${chosen.join(", ")} en este resumen.`;
    }
  }
  const emptyNote = emptyText ? `<p class="empty">${escapeHtml(emptyText)}</p>` : "";
  const notice = wantsAids && current.notice && aids.length ? `<p class="hint">${escapeHtml(current.notice)}</p>` : "";
  const label = (id) => INFO_TYPES.find((type) => type.id === id)?.label || id;
  let body;
  if (compact) {
    body = visible.slice(0, 4).map((item) => aidCard(item)).join("")
      + (visible.length > 4 ? `<p class="more">Hay ${visible.length} en este resumen. El resto está en la pestaña Resumen.</p>` : "");
  } else {
    body = groups
      .map((group) => `<h4 class="digest-group">${escapeHtml(label(group.id))} <span>${group.items.length}</span></h4>${group.items.map((item) => aidCard(item)).join("")}`)
      .join("");
  }
  return `
    <aside class="digest">
      <div class="digest-head">
        <span class="mark">${GLYPH.plazo}</span>
        <div>
          <p class="eyebrow">Novedades oficiales</p>
          <h2>Resumen del día</h2>
          <p class="orientativo">Información orientativa. Consulta siempre la publicación oficial.</p>
        </div>
      </div>
      <label class="history">Día
        <select id="digestDate">${options}</select>
      </label>
      <p class="hint digest-showing">Mostrando: ${escapeHtml(chosen.join(", "))} · <button type="button" class="hint-link" data-open-prefs="1">Cambiar en Ajustes › Mis preferencias</button></p>
      ${notice}
      ${wantsDeadlines ? closingSoonSection(current.date) : ""}
      <h3 class="digest-sub">Novedades de este resumen</h3>
      ${emptyNote}
      ${body}
    </aside>`;
}

/** Bloque de inicio con lo que el agricultor ha puesto primero, en su orden. Solo títulos de las fuentes. */
function priorityStrip(items) {
  const TAB_OF = { ayudas: "ayudas", pac: "pac", normativa: "normativa", noticias: "noticias" };
  const rows = prefs.info
    .map((id, index) => {
      const list = items.filter((item) => itemInfoTypes(item).includes(id));
      const typeLabel = INFO_TYPES.find((type) => type.id === id)?.label || id;
      const top = list.slice(0, 3)
        .map((item) => `<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title || "Sin título")}</a><small>${escapeHtml(item.sourceName || "Fuente oficial")}</small></li>`)
        .join("");
      const more = TAB_OF[id] ? `<button type="button" class="link-btn" data-goto="${TAB_OF[id]}">Ver ${list.length}</button>` : "";
      return `<div class="prio-row"><h3><span class="prio">${index + 1}</span>${escapeHtml(typeLabel)} <span class="count">${list.length}</span></h3>${top ? `<ul>${top}</ul>` : `<p class="empty">Nada con los criterios de ahora.</p>`}${more}</div>`;
    })
    .join("");
  return `<section class="priorities" aria-label="Lo que has puesto primero"><p class="eyebrow">Lo que has puesto primero</p>${rows}</section>`;
}

function planStrip() {
  const text = state.plans?.upcoming || PRO_PLAN_COPY;
  // Aviso discreto: letra pequeña y gris, sin caja ni negrita.
  return `<p class="plan-soon">Plan Gratis. ${escapeHtml(text)} <a href="/planes">Ver los planes</a></p>`;
}

function baseItems(options = {}) {
  const today = madridTodayKey();
  return unseen(state.items || [], "alerta_ocultas").filter((item) => {
    if (!hasSourceUrl(item)) return false;
    if (!options.keepHidden && isHidden(item)) return false;
    if (!options.keepClosed && soloAbiertas && isClosedAid(item.aid, today)) return false;
    if (onlyNewEl?.checked && item.read) return false;
    if (onlyToday && madridDay(item.publishedAt) !== madridDay(new Date())) return false;
    const q = qEl?.value.trim().toLowerCase() || "";
    if (!q) return true;
    return `${item.title} ${item.summary} ${item.sourceName} ${item.aid?.who || ""} ${item.aid?.what || ""}`.toLowerCase().includes(q);
  });
}

function filterRow() {
  const sectors = SECTORS.map((sector) => `<button type="button" class="chip ${prefs.sector === sector.id ? "on" : ""}" data-sector="${escapeHtml(sector.id)}" aria-pressed="${prefs.sector === sector.id ? "true" : "false"}">${GLYPH[sector.id] || ""}${escapeHtml(sector.label)}</button>`).join("");
  const hiddenCount = hiddenAids.size ? `<button type="button" class="chip ghost-chip" data-unhide="1">Volver a mostrar ocultas</button>` : "";
  return `
    <div class="filter-row" role="group" aria-label="Filtros rápidos">
      <button type="button" class="chip open-toggle ${soloAbiertas ? "on" : ""}" data-open-only="1" aria-pressed="${soloAbiertas ? "true" : "false"}">${soloAbiertas ? "✓ " : ""}Solo abiertas</button>
      <span class="chip-sep" aria-hidden="true"></span>
      ${sectors}
      ${hiddenCount}
    </div>`;
}

let pacData = null;
let pricesData = null;
let toolsData = null;
let pacLoading = null;
let pricesLoading = null;
let toolsLoading = null;

function ensurePac() {
  if (pacData || pacLoading) return;
  pacLoading = fetch("/api/pac-calendario", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => { pacData = data || { error: true }; })
    .catch(() => { pacData = { error: true }; })
    .finally(() => { pacLoading = null; if (!QUIET.has(PATH)) render(); });
}

function ensurePrices() {
  if (pricesData || pricesLoading) return;
  pricesLoading = fetch("/api/precios", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => { pricesData = data || { ok: false }; })
    .catch(() => { pricesData = { ok: false }; })
    .finally(() => { pricesLoading = null; if (!QUIET.has(PATH)) render(); });
}

function ensureTools(after) {
  if (toolsData) return Promise.resolve(toolsData);
  if (!toolsLoading) {
    toolsLoading = fetch("/api/herramientas", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { toolsData = data || { grupos: [] }; return toolsData; })
      .catch(() => { toolsData = { grupos: [], error: true }; return toolsData; })
      .finally(() => { toolsLoading = null; if (after) after(); });
  }
  return toolsLoading;
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function shortDay(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${Number(match[3])} ${MONTHS_SHORT[Number(match[2]) - 1]}` : "";
}

function euro(value) {
  return value == null ? "" : new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/**
 * Semana tal como la escribe la cabecera de la hoja del MAPA. Se copia literal, sin corregir:
 * en la hoja de 2026 la semana 41 figura como «05/10-1/10» (así viene en el Excel oficial).
 */
function weekText(data) {
  if (!data?.week) return "";
  return `${data.weekHeader || `Semana ${data.week}`}${data.weekLabel ? ` · ${data.weekLabel}` : ""}`;
}

function sourceAnchor(url, text) {
  return /^https?:\/\//i.test(String(url || "")) ? `<a class="src" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>` : "";
}

function fieldStrip() {
  ensurePac();
  ensurePrices();
  const next = pacData?.next;
  let pac = "";
  if (next && next.source?.url) {
    const days = next.state === "en_curso" ? next.daysToEnd : next.daysToStart;
    const big = days != null
      ? `<span class="count-big">${escapeHtml(String(days))}<small>${next.state === "en_curso" ? "días para que termine" : "días para empezar"}</small></span>`
      : "";
    pac = `<div class="strip-card pac-next">
        <span class="eyebrow">Pagos PAC ${escapeHtml(pacData.campaign || "")}</span>
        <strong>${escapeHtml(next.title)}</strong>
        ${big}
        <span>${escapeHtml(next.countdown)}</span>
        <span class="small">Fuente: ${sourceAnchor(next.source.url, next.source.nombre)}</span>
        <button type="button" class="link-btn" data-goto="calendario">Ver el calendario con las citas</button>
      </div>`;
  } else if (!next) {
    pac = `<div class="strip-card pac-next"><span class="eyebrow">Pagos PAC</span><strong>${pacData?.error ? "Calendario no disponible" : "Cargando calendario…"}</strong></div>`;
  }
  const wanted = ["trigo_blando", "cebada_pienso", "maiz", "girasol"];
  const fileUrl = pricesData?.fileUrl || "";
  const prices = pricesData?.ok && /^https?:/i.test(fileUrl)
    ? `<div class="strip-card prices">
        <span class="eyebrow">Hoy en el campo · ${escapeHtml(weekText(pricesData))}</span>
        <ul>${(pricesData.items || []).filter((item) => wanted.includes(item.id)).map((item) => `<li><span>${escapeHtml(item.sheetLabel || item.name)}</span><strong>${item.value != null ? `${euro(item.value)} ${escapeHtml(item.unit)}` : "-"}</strong>${trend(item)}</li>`).join("")}</ul>
        <span class="small">Fuente: ${sourceAnchor(fileUrl, "MAPA · Precios medios nacionales (Excel)")}</span>
        <button type="button" class="link-btn" data-goto="campo">Ver todos los precios</button>
      </div>`
    : `<div class="strip-card prices"><span class="eyebrow">Hoy en el campo</span><strong>${pricesData ? "Precios no disponibles ahora" : "Cargando precios…"}</strong>${pricesData ? `<span class="small">${sourceAnchor(pricesData.pageUrl, "Ver la tabla oficial del MAPA")}</span>` : ""}</div>`;
  return `<section class="field-strip" aria-label="Hoy en el campo">${pac}${prices}</section>`;
}

function trend(item) {
  if (item.change == null) return `<em class="trend flat">—</em>`;
  if (item.change > 0) return `<em class="trend up" title="Sube respecto a la semana ${item.previousWeek}">▲ ${euro(item.change)}</em>`;
  if (item.change < 0) return `<em class="trend down" title="Baja respecto a la semana ${item.previousWeek}">▼ ${euro(Math.abs(item.change))}</em>`;
  return `<em class="trend flat">= 0,00</em>`;
}

// Cuadros de colores de Inicio (Abiertas, Cierran pronto, Próximas, Líneas PAC). Son la ÚNICA vez que salen
// estos nombres en Inicio: al tocar uno se despliega debajo su lista (máx. 10) y «Ver todas» lleva a la lista completa.
const GLANCE = [
  { id: "abierta", label: "Abiertas", goto: "ayudas", status: "abierta" },
  { id: "cierra_pronto", label: "Cierran pronto", goto: "ayudas", status: "cierra_pronto" },
  { id: "proxima", label: "Próximas", goto: "ayudas", status: "proxima" },
  { id: "pac", label: "Líneas PAC", goto: "pac", status: "pac" },
];
const GLANCE_LIMIT = 10;
const CHEVRON = `<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
let openStat = null;
// Filtro de estado de la lista de Ayudas cuando se llega desde «Ver todas» de un cuadro.
let listStatus = null;

function isPacLine(item) {
  return item.kind === "linea" && (item.sourceId === "pac_lineas" || item.category === "pac_pagos" || (item.themes || []).includes("pac"));
}

function glanceCards(lists) {
  const cards = GLANCE.map((card) => {
    const on = openStat === card.id;
    return `<button type="button" class="stat ${card.id}${on ? " open" : ""}" data-stat="${card.id}" aria-expanded="${on ? "true" : "false"}" aria-controls="statPanel"><strong>${lists[card.id].length}</strong><span>${card.label}</span>${CHEVRON}</button>`;
  }).join("");
  const card = GLANCE.find((entry) => entry.id === openStat);
  let panel = "";
  if (card) {
    const list = lists[card.id];
    const more = list.length > GLANCE_LIMIT
      ? `<button type="button" class="link-btn" data-goto="${card.goto}" data-status="${card.status}">Ver todas (${list.length})</button>`
      : list.length ? `<button type="button" class="link-btn" data-goto="${card.goto}" data-status="${card.status}">Ver todas</button>` : "";
    panel = list.length
      ? `<div class="list">${list.slice(0, GLANCE_LIMIT).map((item) => aidCard(item)).join("")}</div>${more}`
      : `<p class="empty">No hay ninguna ahora</p>`;
  }
  return `<section class="glance-wrap" aria-label="De un vistazo">
      <div class="glance">${cards}</div>
      <div id="statPanel" class="stat-panel" role="region" aria-label="${card ? escapeHtml(card.label) : "Detalle"}"${card ? "" : " hidden"}>${panel}</div>
    </section>`;
}

function renderBoard() {
  const items = sortedItems(baseItems());
  const open = items.filter(GLANCE_MATCH.abierta);
  const next = items.filter(GLANCE_MATCH.proxima);
  const soon = items.filter(GLANCE_MATCH.cierra_pronto);
  const loose = items
    .filter((item) => {
      if (item.aid?.status !== "sin_plazo") return false;
      if (item.kind === "linea") return /2026|2027/.test(`${item.title} ${item.summary}`);
      return (item.infoTypes || []).includes("ayudas");
    })
    .slice(0, 8);
  const pacAll = items.filter(GLANCE_MATCH.pac);
  return `
    <div class="board">
      ${filterRow()}
      ${glanceCards({ abierta: open, cierra_pronto: soon, proxima: next, pac: pacAll })}
      ${priorityStrip(items)}
      ${fieldStrip()}
      ${planStrip()}
      ${loose.length ? `<section class="loose"><h2>Sin plazo concreto</h2>${loose.map((item) => aidCard(item)).join("")}</section>` : ""}
    </div>`;
}

// Mismo criterio que los cuadros de Inicio, para que «Ver todas» enseñe exactamente lo que cuenta el cuadro.
const GLANCE_MATCH = {
  // Una ayuda que cierra pronto también está abierta (lib/preferences.js statusOf: ya abrió y no ha cerrado), así que
  // cuenta en el cuadro de abiertas. Lo que no tiene estado conocido (sin_plazo) no se cuenta como abierto.
  abierta: (item) => item.kind !== "linea" && (item.aid?.status === "abierta" || item.aid?.status === "cierra_pronto"),
  cierra_pronto: (item) => item.kind !== "linea" && item.aid?.status === "cierra_pronto",
  proxima: (item) => item.kind !== "linea" && item.aid?.status === "proxima",
  pac: (item) => isPacLine(item),
};

function renderList(tab) {
  const card = listStatus ? GLANCE.find((entry) => entry.status === listStatus && entry.goto === tab) : null;
  const match = card ? GLANCE_MATCH[card.id] : null;
  const items = sortedItems(baseItems()).filter((item) => (match ? match(item) : inTab(item, tab)));
  const head = card
    ? `<p class="hint list-status">Mostrando solo: ${escapeHtml(card.label)} · <button type="button" class="hint-link" data-goto="${card.goto}">Ver todo el apartado</button></p>`
    : "";
  const body = items.length
    ? `<div class="list">${items.map((item) => aidCard(item)).join("")}</div>`
    : `<p class="empty">No hay nada en este apartado con los criterios de ahora.${soloAbiertas ? " Las cerradas no se ven: quita «Solo abiertas» para verlas." : ""}</p>`;
  return filterRow() + head + body;
}

function closingSoonList(dateKey) {
  const today = madridTodayKey();
  const seen = new Set();
  const pool = [...(state.items || []), ...((state.digests || []).find((entry) => entry.date === dateKey)?.items || [])];
  const list = [];
  for (const item of pool) {
    const key = itemKey(item);
    if (seen.has(key) || isHidden(item) || !hasSourceUrl(item)) continue;
    seen.add(key);
    if (closesWithin(item.aid, today, 15)) list.push(item);
  }
  return list.sort((a, b) => String(a.aid.closesAt).localeCompare(String(b.aid.closesAt)));
}

function closingSoonSection(dateKey) {
  const list = closingSoonList(dateKey);
  const rows = list.length
    ? `<ul class="closing">${list.map((item) => {
        const info = deadlineInfo(item.aid, madridTodayKey());
        const ics = icsHref(item);
        return `<li>
          <span class="badge deadline dl-${escapeHtml(info.kind)}">${escapeHtml(info.label)}</span>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
          <small>Cierra el ${escapeHtml(fmtDay(item.aid.closesAt))}${ics ? ` · <a href="${escapeHtml(ics)}" download>Añadir al calendario</a>` : ""}</small>
        </li>`;
      }).join("")}</ul>`
    : `<p class="empty">Ninguna ayuda de la lista cierra en menos de 15 días.</p>`;
  return `<section class="closing-soon"><h3>Plazos que cierran en menos de 15 días <span>${list.length}</span></h3>${rows}</section>`;
}

function renderFavorites() {
  const today = madridTodayKey();
  const live = new Map((state.items || []).map((item) => [itemKey(item), item]));
  const entries = Object.values(favorites).sort((a, b) => String(a.aid?.closesAt || "9999").localeCompare(String(b.aid?.closesAt || "9999")));
  const cards = entries.map((fav) => {
    const current = live.get(fav.key) || (state.items || []).find((item) => item.id === fav.id);
    return current ? aidCard(current) : aidCard(fav, { snapshot: true });
  });
  const openCount = entries.filter((fav) => !isClosedAid(fav.aid, today)).length;
  return `
    <section class="view-head">
      <p class="eyebrow">Solo en este móvil u ordenador</p>
      <h2>Mis favoritas <span>${entries.length}</span></h2>
      <p>Toca ☆ en cualquier ayuda para guardarla aquí.${entries.length ? ` ${openCount} siguen con el plazo abierto o sin fecha.` : ""}</p>
      <p class="account-note">Se guarda solo en este navegador: no hay cuenta ni se envía nada.</p>
    </section>
    ${cards.length ? `<div class="list">${cards.join("")}</div>` : `<p class="empty">Todavía no tienes favoritas.</p>`}
    <section class="hidden-box">
      <h3>Ayudas que has ocultado <span>${[...hiddenAids].filter((key) => !String(key).startsWith("u:")).length}</span></h3>
      <p>«Ocultar esta ayuda» la quita de tus listas en este navegador.</p>
      ${hiddenAids.size ? `<button type="button" class="ghost" data-unhide="1">Volver a mostrar todas</button>` : ""}
    </section>`;
}

function milestoneRow(item) {
  const date = item.state === "en_curso" ? item.to : item.fromMonthOnly ? null : item.from;
  const ics = date && item.state !== "pasado" && !(item.state !== "en_curso" && item.fromApprox) ? icsLink({ title: item.title, date, url: item.source?.url, kind: "pac" }) : "";
  const quotes = (item.quotes || [])
    .map((quote) => `<li><q>${escapeHtml(quote.text)}</q> <small>— ${sourceAnchor(quote.source.url, quote.source.nombre)}</small></li>`)
    .join("");
  return `
    <li class="milestone ${escapeHtml(item.state)}">
      <div class="when">
        <strong>${escapeHtml(item.fromMonthOnly ? item.fromText : shortDay(item.from))}</strong>
        <small>${item.to ? `al ${escapeHtml(shortDay(item.to))} ${escapeHtml(item.to.slice(0, 4))}` : ""}</small>
        ${item.fromApprox ? `<small class="orientativo">Inicio: ${escapeHtml(item.fromText)} (orientativa)</small>` : ""}
      </div>
      <div class="what">
        <h3>${escapeHtml(item.title)} <span class="badge ms-${escapeHtml(item.state)}">${item.state === "en_curso" ? "Ahora" : item.state === "pasado" ? "Terminado" : "Próximo"}</span></h3>
        <p class="countdown">${escapeHtml(item.countdown)}</p>
        <ul class="quotes">${quotes}</ul>
        ${item.note ? `<p class="note">${escapeHtml(item.note)}</p>` : ""}
        <p class="links">${sourceAnchor(item.source.url, `Fuente: ${item.source.nombre}`)}${ics ? ` · <a href="${escapeHtml(ics)}" download>Añadir al calendario</a>` : ""}</p>
      </div>
    </li>`;
}

function renderPacCalendar() {
  ensurePac();
  if (!pacData) return `<p class="empty">Cargando el calendario de la PAC…</p>`;
  if (pacData.error) return `<p class="empty">No se ha podido cargar el calendario. Consulta el <a href="https://www.fega.gob.es/es/pepac-2023-2027/ayudas-directas/informacion-campanas-pac" target="_blank" rel="noopener">FEGA</a>.</p>`;
  const next = pacData.next;
  const days = next ? (next.state === "en_curso" ? next.daysToEnd : next.daysToStart) : null;
  const big = next
    ? `<div class="countdown-hero">
        <p class="eyebrow">${next.state === "en_curso" ? "Ahora mismo" : "Lo siguiente"}</p>
        <h2>${escapeHtml(next.title)}</h2>
        ${days != null ? `<p class="count-big">${escapeHtml(String(days))}<small>${next.state === "en_curso" ? "días para que termine" : "días para empezar"}</small></p>` : ""}
        <p>${escapeHtml(next.countdown)}</p>
      </div>`
    : "";
  const notice = pacData.notice
    ? `<p>${escapeHtml(pacData.notice.context)} <q>${escapeHtml(pacData.notice.text)}</q> <small>— ${sourceAnchor(pacData.notice.source.url, pacData.notice.source.nombre)}</small></p>`
    : "";
  return `
    <section class="pac-calendar">
      <div class="view-head">
        <p class="eyebrow">Campaña ${escapeHtml(pacData.campaign)}</p>
        <h2>${escapeHtml(pacData.title)}</h2>
        ${notice}
      </div>
      ${big}
      <ol class="timeline">${(pacData.milestones || []).map(milestoneRow).join("")}</ol>
      <p class="note">Cada fecha lleva la cita literal de su fuente. «Orientativa»: la fuente no da el día exacto. Revisado el ${escapeHtml(fmtDay(pacData.updated))} en estas fuentes oficiales:</p>
      <ul class="sources-list">${(pacData.sources || []).map((source) => `<li>${sourceAnchor(source.url, source.nombre)}${source.pdf ? ` · ${sourceAnchor(source.pdf, "PDF")}` : ""}</li>`).join("")}</ul>
      <p class="orientativo">${NOTICE}</p>
    </section>`;
}

function renderField() {
  ensurePrices();
  if (!pricesData) return `<p class="empty">Cargando los precios del Ministerio…</p>`;
  const page = pricesData.pageUrl || "https://www.mapa.gob.es/es/estadistica/temas/estadisticas-agrarias/economia/precios-medios-nacionales/";
  if (!pricesData.ok || !/^https?:/i.test(String(pricesData.fileUrl || ""))) {
    return `
      <section class="view-head">
        <p class="eyebrow">Hoy en el campo</p>
        <h2>Precios de la semana</h2>
        <p>${escapeHtml(pricesData.explanation || "Ahora mismo no podemos leer los precios del Ministerio. Para no darte un dato equivocado, no enseñamos ninguno.")}</p>
        <p><a class="official" href="${escapeHtml(page)}" target="_blank" rel="noopener">Ver precios medios nacionales (MAPA)</a></p>
      </section>`;
  }
  const groups = [...new Set((pricesData.items || []).map((item) => item.group))];
  const tables = groups.map((group) => `
    <section class="price-group">
      <h3>${escapeHtml(group)}</h3>
      <table class="prices-table">
        <thead><tr><th>Producto</th><th>Precio</th><th>Variación</th></tr></thead>
        <tbody>${(pricesData.items || []).filter((item) => item.group === group).map((item) => `
          <tr>
            <th scope="row">${escapeHtml(item.sheetLabel || item.name)}</th>
            <td>${item.value != null ? `<strong>${euro(item.value)}</strong> ${escapeHtml(item.unit)}` : `<span class="muted">«-» en la tabla esta semana${item.lastValue != null ? ` (semana ${item.lastWeek}: ${euro(item.lastValue)} ${escapeHtml(item.unit)})` : ""}</span>`}</td>
            <td>${trend(item)}</td>
          </tr>`).join("")}</tbody>
      </table>
    </section>`).join("");
  return `
    <section class="field-view">
      <div class="view-head">
        <p class="eyebrow">Hoy en el campo</p>
        <h2>Precios medios nacionales</h2>
        <p><strong>${escapeHtml(weekText(pricesData))}</strong></p>
        ${pricesData.stale ? `<p class="note">No hemos podido actualizar ahora mismo. Te enseñamos la última copia buena, del ${escapeHtml(fmtStamp(pricesData.fetchedAt))}.</p>` : ""}
      </div>
      ${tables}
      <p class="note">Fuente: ${escapeHtml(pricesData.source)}. Leídos el ${escapeHtml(fmtStamp(pricesData.fetchedAt))}.</p>
      <p class="links"><a href="${escapeHtml(page)}" target="_blank" rel="noopener">Página oficial del MAPA</a> · <a href="${escapeHtml(pricesData.fileUrl)}" target="_blank" rel="noopener">Tabla oficial (Excel)</a></p>
      <p class="orientativo">${NOTICE}</p>
    </section>`;
}

function toolsHtml(data) {
  const groups = (data?.grupos || []).map((group) => {
    const links = (group.enlaces || []).filter((link) => /^https?:\/\//i.test(String(link.url || "")));
    if (!links.length) return "";
    return `
    <section class="source-group">
      <h2>${escapeHtml(group.titulo)}</h2>
      <div class="source-cards">${links.map((link) => `
        <article class="source-card tool">
          <h3>${escapeHtml(link.nombre)}</h3>
          <p class="organism">${escapeHtml(link.organismo || "")}</p>
          ${link.cita ? `<p><q>${escapeHtml(link.cita)}</q> <small>(texto de la página oficial)</small></p>` : ""}
          <p><a class="official" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">Abrir</a></p>
        </article>`).join("")}</div>
    </section>`;
  }).join("");
  return `
    <article class="prose">
      <p class="eyebrow">Herramientas oficiales</p>
      <h2>Herramientas oficiales</h2>
      <p>Enlaces a webs y apps oficiales. ${escapeHtml(data?.nota || "")}</p>
    </article>
    ${groups || `<p class="empty">No se ha podido cargar la lista. ${data?.error ? "Prueba más tarde." : ""}</p>`}
    <p class="orientativo">${NOTICE}</p>`;
}

function renderToolsTab() {
  if (!toolsData) {
    ensureTools(() => { if (!QUIET.has(PATH)) render(); });
    return `<p class="empty">Cargando herramientas…</p>`;
  }
  return toolsHtml(toolsData);
}

function renderArchive() {
  const q = qEl?.value.trim().toLowerCase() || "";
  const items = unseen(state.archive || [], "alerta_borradas", { keepArchived: true }).filter((item) => {
    if (!q) return true;
    return `${item.title} ${item.url} ${item.sourceName}`.toLowerCase().includes(q);
  });
  if (!items.length) return `<p class="empty">No hay nada archivado. El recuadro Archivar guarda el título y el enlace.</p>`;
  return items
    .map((item) => `
      <article class="card">
        <h3>${escapeHtml(item.title)}</h3>
        <p class="origin">Fuente oficial: ${escapeHtml(item.sourceName || "No disponible")} · Archivado: ${escapeHtml(fmtDay(item.archivedAt))}</p>
        <div class="card-actions">
          ${item.url ? `<a class="official" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Abrir fuente oficial</a>` : ""}
          <button type="button" class="danger delete-archived" data-id="${escapeHtml(item.id)}">Eliminar</button>
        </div>
      </article>`)
    .join("");
}

function renderDigestTab() {
  return `<div class="digest-page">${digestCard(false)}</div>`;
}

function renderTabs() {
  const items = baseItems();
  const buttons = [
    ["inicio", "Inicio"],
    ["ayudas", "Ayudas"],
    ["pac", "PAC"],
    ["calendario", "Calendario PAC"],
    ["campo", "Hoy en el campo"],
    ["favoritas", "★ Mis favoritas"],
    ["resumen", "Resumen"],
    ["normativa", "Normativa"],
    ["jovenes", "Jóvenes"],
    ["noticias", "Noticias"],
    ["herramientas", "Herramientas"],
    ["archivadas", "Archivadas"],
  ].filter(([id]) => id !== "archivadas" || isAdmin());
  const noCount = new Set(["calendario", "campo", "herramientas"]);
  tabsEl.innerHTML = buttons
    .map(([id, title]) => {
      const count = id === "inicio"
        ? items.length
        : id === "archivadas"
          ? (state.archive || []).length
          : id === "resumen"
            ? (state.digests || []).length
            : id === "favoritas"
              ? Object.keys(favorites).length
              : items.filter((item) => inTab(item, id)).length;
      const main = ["inicio", "ayudas", "pac", "resumen"].includes(id) ? "tab-main" : "tab-extra";
      return `<button class="tab ${main} ${active === id ? "active" : ""}" data-id="${id}" type="button">${title}${noCount.has(id) ? "" : `<span class="count">${count}</span>`}</button>`;
    })
    .join("");
}

function renderSources() {
  const reports = state.sources || {};
  const catalog = state.sourceCatalog || [];
  const prepared = catalog.filter((source) => source.enabled === false);
  const entries = Object.entries(reports);
  if (!entries.length && !prepared.length) {
    sourcesEl.innerHTML = "<p>Aún no hay informe de la última consulta.</p>";
    return;
  }
  const live = entries
    .map(([id, src]) => {
      const cls = src.ok ? "ok" : "err";
      const when = src.lastOkAt ? `Última lectura correcta: ${fmtStamp(src.lastOkAt)}` : "Sin lectura correcta guardada";
      const detail = src.ok ? `${src.count} piezas · ${when}` : `${src.error || "Error"} · ${when}`;
      const note = src.note ? `<small>${escapeHtml(src.note)}</small>` : "";
      return `<article class="source"><strong>${escapeHtml(src.name || id)}</strong><span class="${cls}">${escapeHtml(detail)}</span>${note}</article>`;
    })
    .join("");
  const later = prepared.length
    ? `<h3>Preparadas, aún no consultadas</h3><ul class="prepared">${prepared.map((source) => `<li>${escapeHtml(source.name)}</li>`).join("")}</ul>`
    : "";
  sourcesEl.innerHTML = live + later;
}

function render() {
  if (QUIET.has(PATH) || PATH === "/admin") return;
  stampEl.textContent = state.collecting
    ? "Consultando fuentes oficiales…"
    : state.lastCollectAt
      ? `Última consulta: ${fmtStamp(state.lastCollectAt)}`
      : "Todavía no hay consulta";
  refreshBtn.disabled = Boolean(state.collecting);
  if (clearReadBtn) clearReadBtn.hidden = active === "archivadas";
  renderChoices();
  renderTabs();
  paintDigestBtn();
  if (location.hash === "#resumen" && active !== "resumen") history.replaceState(null, "", location.pathname + location.search);
  renderSources();
  paintPrefsNote();
  document.querySelectorAll("[data-dock]").forEach((button) => {
    const on = button.dataset.dock === active;
    button.classList.toggle("on", on);
    button.setAttribute("aria-current", button.dataset.dock === active ? "page" : "false");
  });
  let html;
  if (active === "inicio") html = renderBoard();
  else if (active === "resumen") html = renderDigestTab();
  else if (active === "favoritas") html = renderFavorites();
  else if (active === "calendario") html = renderPacCalendar();
  else if (active === "campo") html = renderField();
  else if (active === "herramientas") html = renderToolsTab();
  else if (active === "archivadas") html = renderArchive();
  else html = renderList(active);
  appEl.innerHTML = active === "inicio" ? html : `${BACK_HOME_TAB}${html}`;
}

function showGate(message) {
  document.body.classList.add("locked");
  document.body.classList.remove("public-page");
  const err = document.getElementById("loginError");
  const text = message || (new URLSearchParams(location.search).get("aviso") === "clave" ? "Clave incorrecta. Tiene que verse el símbolo #." : "");
  if (text) {
    err.hidden = false;
    err.textContent = text;
  } else err.hidden = true;
}

function hideGate() {
  document.body.classList.remove("locked");
}

// Pasos cortos: un título y, como mucho, una pista de pocas palabras. Lo elegido se ve en la propia tarjeta.
const WIZARD = [
  {
    title: "¿Qué te interesa?",
    lead: "Lo elegido sale primero",
    body: () => `<div class="choice-block"><p>Sector</p><div class="tiles">${choiceButtons(SECTORS, prefs.sector, "sector")}</div></div>
      <div class="choice-block"><p>Información <span class="hint">Toca en orden de prioridad</span></p><div class="tiles">${choiceButtons(INFO_TYPES, prefs.info, "info", { numbered: true })}</div></div>`,
  },
  {
    // El segundo bloque cambia con el sector del paso 1.
    title: () => PLACE_TITLE[prefs.sector] || "¿Dónde está tu explotación?",
    lead: "",
    body: () => `<div class="choice-block"><p>Zona</p><div class="tiles${prefs.sector === "todos" ? " tiles-compact" : ""}">${choiceButtons(ZONES, prefs.zone, "zone")}</div></div>
      ${sectorBlocksHtml(prefs)}`,
  },
  {
    // Solo lo del sector elegido: cultivos, ganado o pesca.
    title: () => (CROPS_TITLE[prefs.sector] || CROPS_TITLE.todos)[0],
    lead: "Opcional",
    body: () => cropTilesHtml(prefs),
  },
];

function renderWizard() {
  const step = WIZARD[wizardIndex];
  const scroller = wizardBody;
  wizardStep.textContent = `${wizardIndex + 1} de ${WIZARD.length}`;
  document.querySelectorAll("#wizardProgress span").forEach((dot, index) => dot.classList.toggle("on", index <= wizardIndex));
  wizardTitle.textContent = typeof step.title === "function" ? step.title() : step.title;
  wizardLead.textContent = step.lead || "";
  wizardLead.hidden = !step.lead;
  const keep = scroller.scrollTop;
  const sameStep = scroller.dataset.step === String(wizardIndex);
  wizardBody.innerHTML = step.body();
  scroller.dataset.step = String(wizardIndex);
  scroller.scrollTop = sameStep ? keep : 0;
  wizardBack.hidden = wizardIndex === 0;
  wizardNext.textContent = wizardIndex === WIZARD.length - 1 ? (wizardFirstRun ? "Ver el panel" : "Guardar") : "Siguiente";
  // La primera vez se puede empezar con la configuración de partida; después, salir deja todo como estaba.
  wizardDefault.textContent = wizardFirstRun ? "Empezar con lo recomendado" : "Cancelar y dejar como estaba";
}

function openWizard(options = {}) {
  wizardFirstRun = Boolean(options.firstRun);
  wizardBefore = wizardFirstRun ? null : JSON.parse(JSON.stringify(prefs));
  wizardIndex = 0;
  setSheet(false);
  wizard.hidden = false;
  renderWizard();
}

function closeWizard() {
  wizard.hidden = true;
}

document.getElementById("openPrefs")?.addEventListener("click", () => openWizard());
wizardBack?.addEventListener("click", () => {
  wizardIndex = Math.max(0, wizardIndex - 1);
  renderWizard();
});
wizardNext?.addEventListener("click", () => {
  if (wizardIndex < WIZARD.length - 1) {
    wizardIndex += 1;
    renderWizard();
    return;
  }
  savePrefs(prefs);
  closeWizard();
  render();
});
wizardDefault?.addEventListener("click", () => {
  savePrefs(wizardFirstRun || !wizardBefore ? DEFAULT_PREFS : wizardBefore);
  closeWizard();
  render();
});
wizardForm?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-group]");
  if (!button) return;
  togglePref(button.dataset.group, button.dataset.id);
  renderWizard();
});
wizardForm?.addEventListener("submit", (event) => event.preventDefault());

document.body.addEventListener("click", (event) => {
  const button = event.target.closest("#filters [data-group], #cropsBox [data-group]");
  if (!button) return;
  togglePref(button.dataset.group, button.dataset.id);
});

function showGateError(message) {
  const err = document.getElementById("loginError");
  err.hidden = !message;
  err.textContent = message || "";
}

document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("keyInput");
  const key = cleanKey(input.value);
  showGateError("");
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    showGateError(data.error || "Clave incorrecta. Tiene que verse entera, con el símbolo #.");
    return;
  }
  token = data.token;
  storageSet("alerta_token", token);
  location.href = "/";
});

let loading = false;

/** El servidor ya pinta el cartel «En revisión»; aquí solo se mantiene en sincronía con /api/state. */
function syncReviewBanner(on) {
  const banner = document.getElementById("reviewBanner");
  if (on && !banner) {
    const div = document.createElement("div");
    div.className = "review-banner";
    div.id = "reviewBanner";
    div.setAttribute("role", "status");
    div.innerHTML = '<span class="review-dot" aria-hidden="true"></span><strong>Versión en revisión.</strong> <span>Estamos comprobando los datos; consulta siempre la publicación oficial.</span>';
    document.body.prepend(div);
  } else if (on === false && banner) banner.remove();
  document.body.dataset.review = on ? "on" : "off";
}

async function load(options = {}) {
  if (loading) return;
  loading = true;
  const y = options.keepScroll ? window.scrollY : 0;
  try {
    if (isAdmin()) await pushSuppressed();
    const res = await api("/api/state");
    if (!res.ok) throw new Error("No se pudo leer el panel");
    state = await res.json();
    state.items = applyVisitorRead(state.items);
    if (typeof state.reviewMode === "boolean") syncReviewBanner(state.reviewMode);
    if (isAdmin()) absorbHidden(state.hidden);
    render();
    if (options.keepScroll) window.scrollTo(0, y);
  } finally {
    loading = false;
  }
}

function applyVisitorRead(items) {
  if (isAdmin()) return items || [];
  const seen = readSet("alerta_leidas_local");
  return (items || []).map((item) => (seen.has(item.id) ? { ...item, read: true } : { ...item, read: false }));
}

async function refresh() {
  if (!isAdmin()) return;
  refreshBtn.disabled = true;
  stampEl.textContent = "Consultando fuentes oficiales…";
  const res = await api("/api/refresh", { method: "POST" });
  if (res.status === 401) {
    token = "";
    document.body.classList.remove("admin");
    try {
      localStorage.removeItem("alerta_token");
      sessionStorage.removeItem("alerta_token");
    } catch { /* sigue la consulta pública */ }
    stampEl.textContent = "La clave de administración ha caducado.";
    refreshBtn.disabled = false;
    render();
    return;
  }
  const data = await res.json();
  if (data.ok === false) {
    stampEl.textContent = `Error: ${data.error}`;
    refreshBtn.disabled = false;
    return;
  }
  state = { ...state, ...data };
  absorbHidden(data.hidden);
  render();
}

tabsEl.addEventListener("click", (event) => {
  const button = event.target.closest(".tab");
  if (!button) return;
  active = button.dataset.id;
  listStatus = null;
  setSheet(false);
  render();
});

// Ajustes: un solo panel con el tema (Claro / Oscuro / Automático) y, debajo,
// «Mis preferencias». Se abre con el botón del engranaje de la cabecera.
function setSheet(open, focusPrefs = false) {
  if (!prefSheet) return;
  prefSheet.hidden = !open;
  settingsBtn?.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    paintThemeChoice();
    const target = focusPrefs ? document.getElementById("prefsSection") : null;
    if (target && !document.body.classList.contains("public-page")) target.scrollIntoView({ block: "start" });
    else prefSheet.querySelector(".sheet-card")?.scrollTo(0, 0);
  }
}

settingsBtn?.addEventListener("click", () => setSheet(prefSheet?.hidden));
// Botón «Resumen» de la cabecera: abre la vista completa del Resumen del día.
digestBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  if (QUIET.has(PATH) || PATH === "/admin" || document.body.classList.contains("public-page")) {
    location.href = "/#resumen";
    return;
  }
  active = "resumen";
  setSheet(false);
  render();
  window.scrollTo(0, 0);
});
document.getElementById("closeSheet")?.addEventListener("click", () => setSheet(false));
prefSheet?.addEventListener("click", (event) => {
  if (event.target === prefSheet) setSheet(false);
});
document.querySelector(".dock")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-dock]");
  if (!button) return;
  active = button.dataset.dock;
  listStatus = null;
  setSheet(false);
  render();
  window.scrollTo(0, 0);
});

function effectiveTheme() {
  if (document.documentElement.dataset.theme === "dark" || document.documentElement.dataset.theme === "light") {
    return document.documentElement.dataset.theme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// El tema se guarda igual que antes (localStorage «alerta_theme»: light/dark).
// «Automático» borra lo guardado y sigue el modo del sistema.
function savedTheme() {
  try {
    const saved = localStorage.getItem("alerta_theme");
    return saved === "light" || saved === "dark" ? saved : "auto";
  } catch { return "auto"; }
}

function paintThemeChoice(choice = savedTheme()) {
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const on = button.dataset.themeChoice === choice;
    button.classList.toggle("on", on);
    button.setAttribute("aria-checked", on ? "true" : "false");
  });
}

function paintTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("alerta_theme", theme); } catch { /* el tema queda en esta visita */ }
  } else {
    delete document.documentElement.dataset.theme;
    try { localStorage.removeItem("alerta_theme"); } catch { /* sigue el sistema */ }
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = effectiveTheme() === "dark" ? "#101812" : "#1b4332";
  paintThemeChoice(theme === "light" || theme === "dark" ? theme : "auto");
}

document.querySelector(".settings-theme")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme-choice]");
  if (button) paintTheme(button.dataset.themeChoice);
});
paintThemeChoice();

async function archiveById(id) {
  if (!isAdmin()) return;
  const item = (state.items || []).find((it) => it.id === id);
  if (item) remember(item, "alerta_ocultas");
  const res = await api(`/api/items/${encodeURIComponent(id)}/archive`, { method: "POST" });
  const data = await res.json();
  if (!data.ok) return;
  state.items = (state.items || []).filter((it) => it.id !== id);
  if (Array.isArray(data.archive)) state.archive = data.archive;
  render();
}

async function markCardRead(id, card) {
  const item = (state.items || []).find((it) => it.id === id);
  if (!item) return;
  item.read = !item.read;
  if (!isAdmin()) {
    const set = readSet("alerta_leidas_local");
    if (item.read) set.add(item.id);
    else set.delete(item.id);
    writeSet("alerta_leidas_local", set);
    if (card) {
      card.classList.toggle("read", item.read);
      card.classList.toggle("fresh", !item.read);
    }
    if (onlyNewEl?.checked) render();
    return;
  }
  if (item.read) {
    rememberMark(item, "r:");
    forgetMark(item, "p:");
  } else {
    forgetMark(item, "r:");
    rememberMark(item, "p:");
  }
  if (card) {
    card.classList.toggle("read", item.read);
    card.classList.toggle("fresh", !item.read);
  }
  await api(`/api/items/${encodeURIComponent(id)}/read`, { method: "POST" });
  if (onlyNewEl.checked) render();
}

appEl.addEventListener("change", async (event) => {
  const box = event.target.closest(".mark-archive");
  if (!box) return;
  box.disabled = true;
  event.stopPropagation();
  await archiveById(box.dataset.id);
});

appEl.addEventListener("change", (event) => {
  if (event.target.id !== "digestDate") return;
  digestDate = event.target.value;
  render();
});

async function deleteArchivedById(id) {
  if (!isAdmin()) return;
  const item = (state.archive || []).find((it) => it.id === id);
  if (item) {
    remember(item, "alerta_ocultas");
    remember(item, "alerta_borradas");
    suppress(item);
    rememberMark(item, "x:");
  }
  const res = await api(`/api/archive/${encodeURIComponent(id)}/delete`, { method: "POST" });
  const data = await res.json();
  if (!data.ok) return;
  if (data.hidden) absorbHidden(data.hidden);
  state.archive = Array.isArray(data.archive) ? data.archive : (state.archive || []).filter((it) => it.id !== id);
  render();
}

appEl.addEventListener("click", (event) => {
  const stat = event.target.closest("[data-stat]");
  if (stat) {
    event.preventDefault();
    openStat = openStat === stat.dataset.stat ? null : stat.dataset.stat;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    appEl.querySelector(`[data-stat="${stat.dataset.stat}"]`)?.focus({ preventScroll: true });
    return;
  }
  const fav = event.target.closest("[data-fav]");
  if (fav) {
    event.preventDefault();
    toggleFavorite(fav.dataset.fav);
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    return;
  }
  const hide = event.target.closest("[data-hide]");
  if (hide) {
    event.preventDefault();
    hideAid(hide.dataset.hide);
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    return;
  }
  if (event.target.closest("[data-unhide]")) {
    showHiddenAgain();
    render();
    return;
  }
  if (event.target.closest("[data-open-only]")) {
    soloAbiertas = !soloAbiertas;
    try { localStorage.setItem(OPEN_KEY, soloAbiertas ? "1" : "0"); } catch { /* queda en esta visita */ }
    render();
    return;
  }
  const sector = event.target.closest("[data-sector]");
  if (sector) {
    savePrefs({ ...prefs, sector: sector.dataset.sector });
    render();
    return;
  }
  if (event.target.closest("[data-open-prefs]")) {
    event.preventDefault();
    setSheet(true, true);
    render();
    return;
  }
  const go = event.target.closest("[data-goto]");
  if (go) {
    event.preventDefault();
    active = go.dataset.goto;
    listStatus = go.dataset.status || null;
    render();
    window.scrollTo(0, 0);
  }
});

appEl.addEventListener("click", async (event) => {
  if (event.target.closest("a, button, input, label, select")) {
    const del = event.target.closest(".delete-archived");
    if (del) {
      event.preventDefault();
      del.disabled = true;
      await deleteArchivedById(del.dataset.id);
    }
    return;
  }
  const card = event.target.closest(".card");
  if (!card || active === "archivadas") return;
  await markCardRead(card.dataset.id, card);
});

function purgeReadOnClose() {
  if (!token) return;
  for (const item of state.items || []) {
    if (item.read) {
      remember(item, "alerta_ocultas");
      suppress(item);
    }
  }
  api("/api/purge-read", {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

window.addEventListener("pagehide", purgeReadOnClose);

onlyTodayBtn?.addEventListener("click", () => {
  onlyToday = !onlyToday;
  onlyTodayBtn.classList.toggle("active", onlyToday);
  onlyTodayBtn.setAttribute("aria-pressed", onlyToday ? "true" : "false");
  render();
});
qEl?.addEventListener("input", render);
onlyNewEl?.addEventListener("change", render);
refreshBtn?.addEventListener("click", refresh);
clearReadBtn?.addEventListener("click", async () => {
  if (!isAdmin()) return;
  for (const item of (state.items || []).filter((entry) => entry.read)) {
    remember(item, "alerta_ocultas");
    suppress(item);
  }
  const res = await api("/api/purge-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const data = await res.json();
  if (data.hidden) absorbHidden(data.hidden);
  if (data.items) state.items = data.items;
  render();
});
readAllBtn?.addEventListener("click", async () => {
  if (!isAdmin()) return;
  const target = active === "archivadas" ? "archive" : "items";
  const batch = target === "archive" ? state.archive : state.items;
  for (const item of batch || []) {
    remember(item, "alerta_ocultas");
    suppress(item);
    if (target === "archive") {
      remember(item, "alerta_borradas");
      rememberMark(item, "x:");
    }
  }
  const res = await api("/api/delete-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  const data = await res.json();
  if (data.hidden) absorbHidden(data.hidden);
  if (data.items) state.items = data.items;
  if (data.archive) state.archive = data.archive;
  render();
});

async function showAccess() {
  try {
    const res = await api("/api/access");
    const data = await res.json();
    const box = document.getElementById("mobileAccess");
    if (!box) return;
    if (data.internet) {
      box.innerHTML = `Enlace para el móvil, con Wi‑Fi o datos: <a href="${escapeHtml(data.internet)}">${escapeHtml(data.internet)}</a>. El ordenador tiene que estar encendido.`;
      return;
    }
    const urls = data.lan || [];
    box.textContent = urls.length
      ? `En la misma Wi‑Fi: ${urls.join(" · ")}`
      : "Se está preparando el enlace para usarla fuera de casa.";
  } catch { /* el acceso local no es imprescindible */ }
}

function freshCollect(iso) {
  const when = Date.parse(iso || "");
  return Number.isFinite(when) && Date.now() - when < 120000;
}

async function boot() {
  const stored = loadPrefs();
  prefs = stored.prefs;
  await loadSession();
  await load();
  if (isAdmin()) showAccess();
  // El asistente solo sale la primera vez en este dispositivo. Después se cambia en «Mis preferencias».
  if (!stored.saved) openWizard({ firstRun: true });
  if (state.collecting) {
    setTimeout(() => boot().catch(() => {}), 4000);
    return;
  }
  if (isAdmin() && !freshCollect(state.lastCollectAt)) await refresh();
}

const STATUS_TEXT = {
  ok: "Última consulta correcta",
  error: "La última consulta falló",
  pendiente: "Activada, pendiente de la primera consulta",
  preparada: "Preparada, aún no se consulta",
  sin_canal: "Sin canal automático",
};

async function renderPlans() {
  document.title = "Planes · Alerta Agraria";
  const res = await fetch("/api/planes", { cache: "no-store" });
  const plans = await res.json().catch(() => ({}));
  appEl.innerHTML = `
    <article class="prose">
      <p class="eyebrow">Planes</p>
      <h2>Plan Gratis</h2>
      <p>La consulta de ayudas, PAC, resumen del día y fuentes es abierta.</p>
      <h2>Plan Pro</h2>
      <p>${escapeHtml(plans.upcoming || PRO_PLAN_COPY)}</p>
      <p class="account-note">Todavía no se contrata ni se cobra.</p>
    </article>`;
}

async function renderLegal() {
  const id = PATH.slice(1);
  appEl.innerHTML = `<p class="empty">Cargando…</p>`;
  const res = await fetch("/api/legal", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  const page = data.pages && data.pages[id];
  if (!res.ok || !page) {
    appEl.innerHTML = `<p class="empty">Esta página no está.</p>`;
    return;
  }
  document.title = `${page.title} · Alerta Agraria`;
  const blocks = (page.blocks || [])
    .map((block) => {
      if (block.type === "ul") {
        return `<ul class="legal-list">${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
      }
      return `<p>${escapeHtml(block.text || "")}</p>`;
    })
    .join("");
  appEl.innerHTML = `<article class="prose"><p class="eyebrow">Información legal</p><h2>${escapeHtml(page.title)}</h2>${blocks}</article>`;
}

async function renderPublic() {
  document.body.classList.add("public-page");
  document.body.classList.remove("locked");
  // Estas páginas no tienen barra de pestañas: «← Inicio» arriba, siempre visible.
  if (!document.querySelector(".back-home-page")) appEl.insertAdjacentHTML("beforebegin", BACK_HOME_PAGE);
  const stored = loadPrefs();
  prefs = stored.prefs;
  await loadSession();
  if (PATH === "/quienes-somos") {
    document.title = "Quiénes somos · Alerta Agraria";
    appEl.innerHTML = `
      <article class="prose">
        <p class="eyebrow">Quiénes somos</p>
        <h2>Hecha por agricultores, para agricultores</h2>
        <p>Alerta Agraria está hecha por agricultores, para agricultores.</p>
        <p>Sirve para consultar en un mismo sitio las ayudas, la PAC y las novedades oficiales del campo, la ganadería y la pesca.</p>
      </article>`;
    return;
  }
  if (PATH === "/aviso-legal" || PATH === "/privacidad" || PATH === "/cookies") {
    await renderLegal();
    return;
  }
  if (PATH === "/planes") {
    await renderPlans();
    return;
  }
  if (PATH === "/herramientas") {
    document.title = "Herramientas oficiales · Alerta Agraria";
    appEl.innerHTML = `<p class="empty">Cargando herramientas…</p>`;
    appEl.innerHTML = toolsHtml(await ensureTools());
    return;
  }
  document.title = "Fuentes oficiales · Alerta Agraria";
  appEl.innerHTML = `<p class="empty">Cargando el listado de fuentes…</p>`;
  try {
    const res = await fetch("/api/fuentes", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo leer el listado");
    const data = await res.json();
    const groups = (data.groups || [])
      .map((group) => {
        const sources = (data.sources || []).filter((source) => source.group === group.id);
        if (!sources.length) return "";
        const cards = sources
          .map((source) => {
            const when = source.lastOkAt ? fmtStamp(source.lastOkAt) : "Sin una consulta correcta registrada";
            const extra = source.note ? `<p>${escapeHtml(source.note)}</p>` : "";
            const fail = source.error ? `<p class="note">${escapeHtml(source.error)}</p>` : "";
            const reuse = source.reuse ? `<p class="reuse">${escapeHtml(source.reuse)}</p>` : "";
            return `
              <article class="source-card">
                <h3>${escapeHtml(source.name)}</h3>
                <p class="organism">${escapeHtml(source.organism || "")}</p>
                <p>${escapeHtml(source.covers || "")}</p>
                <p><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">Sitio oficial</a></p>
                <p class="status ${escapeHtml(source.status)}">${escapeHtml(STATUS_TEXT[source.status] || source.status)}${source.status === "ok" || source.lastOkAt ? `: ${escapeHtml(when)}` : ""}</p>
                ${extra}${fail}${reuse}
              </article>`;
          })
          .join("");
        return `<section class="source-group"><h2>${escapeHtml(group.title)}</h2><div class="source-cards">${cards}</div></section>`;
      })
      .join("");
    const refs = (data.references || []).filter((ref) => /^https?:\/\//i.test(String(ref.url || "")));
    const refCards = refs
      .map((ref) => `
              <article class="source-card">
                <h3>${escapeHtml(ref.name)}</h3>
                <p class="organism">${escapeHtml(ref.organism || "")}</p>
                <p>Se usa en: ${escapeHtml(ref.usedIn || "")}</p>
                <p><a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener">Sitio oficial</a></p>
                <p class="status sin_canal">Fuente citada en la app</p>
              </article>`)
      .join("");
    const refGroup = refCards ? `<section class="source-group"><h2>Calendario PAC, precios y herramientas</h2><div class="source-cards">${refCards}</div></section>` : "";
    appEl.innerHTML = `
      <article class="prose">
        <p class="eyebrow">Fuentes consultadas</p>
        <h2>Fuentes oficiales</h2>
        <p>${escapeHtml(data.methodology || "")}</p>
        <p>Si un dato no viene en la publicación, no se enseña. Esta pantalla sale de la misma lista que usa la recogida automática y de los archivos del calendario PAC, los precios y las herramientas.</p>
      </article>
      ${groups || `<p class="empty">No hay fuentes en la configuración.</p>`}
      ${refGroup}`;
  } catch (error) {
    appEl.innerHTML = `<p class="empty">No se ha podido cargar el listado de fuentes. ${escapeHtml(error.message || "")}</p>`;
  }
}

if (PATH === "/admin") {
  const aviso = new URLSearchParams(location.search).get("aviso");
  if (aviso === "clave") showGateError("Clave incorrecta. Tiene que verse el símbolo #.");
} else if (QUIET.has(PATH)) {
  renderPublic().catch((error) => {
    appEl.innerHTML = `<p class="empty">No se pudo abrir la página. ${escapeHtml(error.message || "")}</p>`;
  });
} else {
  boot().catch((error) => {
    stampEl.textContent = `No se pudo cargar el panel: ${error.message}`;
  });
  setInterval(() => {
    if (document.body.classList.contains("locked")) return;
    load({ keepScroll: true }).catch(() => {});
  }, 30000);
}
