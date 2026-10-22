/**
 * Preferencias del agricultor y reglas para leer las fuentes.
 * Este archivo no depende de Node: lo usa el servidor y también el navegador.
 * Las preferencias se guardan en el navegador.
 */

export const PREFS_STORAGE_KEY = "alerta_prefs_v1";
export const PREFS_VERSION = 1;

export const SECTORS = [
  { id: "agricultura", label: "Agricultura", primary: true },
  { id: "ganaderia", label: "Ganadería" },
  { id: "pesca", label: "Pesca" },
  { id: "todos", label: "Todos" },
];

export const ZONES = [
  { id: "mi-zona", label: "Salamanca y Castilla y León", hint: "Tu zona y lo nacional que también aplica" },
  { id: "salamanca", label: "Salamanca", hint: "Solo lo que nombra a la provincia" },
  { id: "cyl", label: "Castilla y León", hint: "La comunidad, incluida Salamanca" },
  { id: "nacional", label: "España", hint: "Ámbito nacional" },
];

export const WATERS = [
  { id: "secano", label: "Secano" },
  { id: "regadio", label: "Regadío" },
];

export const INFO_TYPES = [
  { id: "ayudas", label: "Ayudas y subvenciones" },
  { id: "pac", label: "PAC" },
  { id: "normativa", label: "Normativa" },
  { id: "alertas", label: "Alertas" },
  { id: "noticias", label: "Noticias" },
];

export const CROP_RULES = [
  { id: "cereal", label: "Cereal", re: /cereal|trigo|cebada|avena|centeno|triticale/i },
  { id: "girasol", label: "Girasol", re: /girasol/i },
  { id: "mejorantes", label: "Especies mejorantes y leguminosas", re: /especies mejorantes|mejorante|leguminosa|proteaginos|alfalfa|veza|guisante|garbanzo|lenteja|\bhabas?\b/i },
  { id: "maiz", label: "Maíz", re: /ma[ií]z/i },
  { id: "remolacha", label: "Remolacha", re: /remolacha/i },
  { id: "vinedo", label: "Viñedo", re: /viñed|vined|vitivin|\buva\b/i },
  { id: "olivar", label: "Olivar", re: /olivar|aceituna|aceite de oliva/i },
  { id: "horticolas", label: "Hortícolas y frutales", re: /hort[ií]col|hortaliza|tomate|pimiento|frutal|frut[ií]cola/i },
  { id: "vacuno", label: "Vacuno", re: /vacuno|bovino|ternero|vaca nodriza|novilla/i },
  { id: "ovino-caprino", label: "Ovino y caprino", re: /ovino|caprino|oveja|cabra/i },
  { id: "porcino", label: "Porcino", re: /porcino|\bcerdo/i },
  { id: "avicola", label: "Avícola", re: /av[ií]col|gallina|pollo de engorde|avicultura/i },
  { id: "apicultura", label: "Apicultura", re: /ap[ií]col|abeja|colmena|\bmiel\b/i },
  { id: "lacteo", label: "Lácteo", re: /l[aá]cte|leche de vaca|leche de oveja|leche de cabra/i },
  { id: "pesca-maritima", label: "Pesca marítima", re: /pesquer|buque pesquero|caladero|pesca mar[ií]tima/i },
  { id: "acuicultura", label: "Acuicultura", re: /acuicult/i },
];

export const DEFAULT_PREFS = {
  version: PREFS_VERSION,
  sector: "agricultura",
  zone: "mi-zona",
  water: ["secano", "regadio"],
  crops: ["cereal", "girasol", "mejorantes"],
  infoOrder: ["ayudas", "pac", "normativa", "alertas", "noticias"],
};

const MONTHS = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export function publicSchema() {
  return {
    version: PREFS_VERSION,
    storageKey: PREFS_STORAGE_KEY,
    futureAccount: "Se guarda en el navegador, en alerta_prefs_v1.",
    defaults: DEFAULT_PREFS,
    sectors: SECTORS,
    zones: ZONES,
    waters: WATERS,
    crops: CROP_RULES.map(({ id, label }) => ({ id, label })),
    infoTypes: INFO_TYPES,
  };
}

export function madridTodayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function normalizePrefs(input) {
  const raw = input && typeof input === "object" ? input : {};
  const sector = SECTORS.some((item) => item.id === raw.sector) ? raw.sector : DEFAULT_PREFS.sector;
  const zone = ZONES.some((item) => item.id === raw.zone) ? raw.zone : DEFAULT_PREFS.zone;
  const water = Array.isArray(raw.water) ? raw.water.filter((id) => WATERS.some((item) => item.id === id)) : [];
  const crops = Array.isArray(raw.crops) ? raw.crops.filter((id) => CROP_RULES.some((item) => item.id === id)) : [];
  const seen = new Set();
  const infoOrder = [];
  for (const id of Array.isArray(raw.infoOrder) ? raw.infoOrder : []) {
    if (INFO_TYPES.some((item) => item.id === id) && !seen.has(id)) {
      infoOrder.push(id);
      seen.add(id);
    }
  }
  for (const item of INFO_TYPES) {
    if (!seen.has(item.id)) infoOrder.push(item.id);
  }
  return {
    version: PREFS_VERSION,
    sector,
    zone,
    water: water.length ? water : [...DEFAULT_PREFS.water],
    crops,
    infoOrder,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function isoDay(year, month, day) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function monthOf(name) {
  return MONTHS[String(name || "").toLowerCase()] || 0;
}

function isRealDay(year, month, day) {
  if (!year || year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function realDay(year, month, day) {
  return isRealDay(year, month, day) ? isoDay(year, month, day) : null;
}

/** Palabras que dicen que una fecha es del plazo de solicitud (y no, por ejemplo, de ejecución o de gasto). */
const DEADLINE_CONTEXT = /plazo|solicitud|presentaci[oó]n|presentar|fecha l[ií]mite|inscripci[oó]n/i;
const EXECUTION_CONTEXT = /ejecuci[oó]n|ejecutar|justificaci[oó]n|justificar|gastos?|realizad[oa]s?|vigencia|periodo de (?:compromiso|mantenimiento)|actuaciones/i;

function contextOk(raw, index, length) {
  const before = raw.slice(Math.max(0, index - 160), index);
  const own = raw.slice(index, index + length);
  if (DEADLINE_CONTEXT.test(own)) return true;
  const hits = [...before.matchAll(new RegExp(DEADLINE_CONTEXT.source, "gi"))];
  if (!hits.length) return false;
  // Si entre la palabra «plazo/solicitud» y la fecha se habla de ejecución, justificación o gastos,
  // la fecha no es del plazo de solicitud.
  const tail = before.slice(hits[hits.length - 1].index);
  return !EXECUTION_CONTEXT.test(tail);
}

/**
 * Plazo de solicitud, solo si el texto lo dice sin dudas.
 * Si aparecen varias fechas de cierre distintas, o falta el año de una fecha, no se elige ninguna:
 * se marca `ambiguous` y la app pide mirar la convocatoria oficial.
 */
export function extractDeadline(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  const empty = { opensAt: null, closesAt: null, deadlineNote: null, ambiguous: false };
  if (/sin plazo de solicitud/i.test(raw)) {
    return { ...empty, deadlineNote: "Sin plazo de solicitud" };
  }
  if (!DEADLINE_CONTEXT.test(raw)) return empty;

  const MONTH_NAME = "([a-záéíóúñ]+)";
  const MONTH_DATE = `(\\d{1,2})\\s+de\\s+${MONTH_NAME}\\s+de(?:l)?\\s+(\\d{4})`;
  const NUM_DATE = "(\\d{1,2})[\\/\\-.](\\d{1,2})[\\/\\-.](\\d{4})";
  const CLOSE_WORDS =
    "(?:hasta el|hasta|finaliza(?:r[aá])? el|terminar[aá] el|termina el|concluir[aá] el|antes del|fecha l[ií]mite(?: de presentaci[oó]n)?(?: de solicitudes)?(?: ser[aá])?(?: el)?:?|fin del plazo(?: ser[aá])?(?: el)?:?)";
  const candidates = [];
  let doubtful = false;
  const add = (match, opensAt, closesAt) => {
    if (!contextOk(raw, match.index, match[0].length)) return;
    if (!opensAt && !closesAt) {
      doubtful = true;
      return;
    }
    candidates.push({ opensAt, closesAt });
  };

  for (const m of raw.matchAll(new RegExp(`del\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+${MONTH_NAME}\\s+de\\s+(\\d{4})`, "gi"))) {
    const month = monthOf(m[3]);
    add(m, realDay(Number(m[4]), month, Number(m[1])), realDay(Number(m[4]), month, Number(m[2])));
  }
  for (const m of raw.matchAll(new RegExp(`del\\s+(\\d{1,2})\\s+de\\s+${MONTH_NAME}\\s+al\\s+(\\d{1,2})\\s+de\\s+${MONTH_NAME}\\s+de\\s+(\\d{4})`, "gi"))) {
    const year = Number(m[5]);
    const openMonth = monthOf(m[2]);
    const closeMonth = monthOf(m[4]);
    // Sin año de apertura y con cambio de año («del 15 de diciembre al 15 de enero de 2027»): dudoso.
    if (openMonth > closeMonth) {
      if (contextOk(raw, m.index, m[0].length)) doubtful = true;
      continue;
    }
    add(m, realDay(year, openMonth, Number(m[1])), realDay(year, closeMonth, Number(m[3])));
  }
  for (const m of raw.matchAll(new RegExp(`desde el\\s+${MONTH_DATE}\\s+hasta el\\s+${MONTH_DATE}`, "gi"))) {
    add(m, realDay(Number(m[3]), monthOf(m[2]), Number(m[1])), realDay(Number(m[6]), monthOf(m[5]), Number(m[4])));
  }
  for (const m of raw.matchAll(new RegExp(`entre el\\s+(\\d{1,2})\\s+de\\s+${MONTH_NAME}\\s+(?:de\\s+(\\d{4})\\s+)?y el\\s+${MONTH_DATE}`, "gi"))) {
    const closeYear = Number(m[6]);
    const openMonth = monthOf(m[2]);
    const closeMonth = monthOf(m[5]);
    if (!m[3] && openMonth > closeMonth) {
      if (contextOk(raw, m.index, m[0].length)) doubtful = true;
      continue;
    }
    const openYear = m[3] ? Number(m[3]) : closeYear;
    add(m, realDay(openYear, openMonth, Number(m[1])), realDay(closeYear, closeMonth, Number(m[4])));
  }
  for (const m of raw.matchAll(new RegExp(`${NUM_DATE}\\s*(?:al|a|hasta|-)\\s*${NUM_DATE}`, "g"))) {
    add(m, realDay(Number(m[3]), Number(m[2]), Number(m[1])), realDay(Number(m[6]), Number(m[5]), Number(m[4])));
  }
  for (const m of raw.matchAll(new RegExp(`${CLOSE_WORDS}\\s+(?:el\\s+)?(?:d[ií]a\\s+)?${MONTH_DATE}`, "gi"))) {
    add(m, null, realDay(Number(m[3]), monthOf(m[2]), Number(m[1])));
  }
  for (const m of raw.matchAll(new RegExp(`${CLOSE_WORDS}\\s+(?:el\\s+)?(?:d[ií]a\\s+)?${NUM_DATE}`, "gi"))) {
    add(m, null, realDay(Number(m[3]), Number(m[2]), Number(m[1])));
  }
  for (const m of raw.matchAll(new RegExp(`desde el\\s+(?:d[ií]a\\s+)?${MONTH_DATE}`, "gi"))) {
    add(m, realDay(Number(m[3]), monthOf(m[2]), Number(m[1])), null);
  }
  // Fecha de cierre con día y mes pero sin año («hasta el 30 de abril»): no se adivina el año.
  for (const m of raw.matchAll(new RegExp(`${CLOSE_WORDS}\\s+(?:el\\s+)?(?:d[ií]a\\s+)?(\\d{1,2})\\s+de\\s+${MONTH_NAME}(?!\\s+de(?:l)?\\s+\\d{4})`, "gi"))) {
    if (monthOf(m[2]) && contextOk(raw, m.index, m[0].length)) doubtful = true;
  }

  const closes = [...new Set(candidates.map((c) => c.closesAt).filter(Boolean))];
  const opens = [...new Set(candidates.map((c) => c.opensAt).filter(Boolean))];
  if (closes.length > 1 || (doubtful && closes.length === 0 && opens.length === 0) || (doubtful && closes.length >= 1)) {
    if (closes.length > 1 || doubtful) return { ...empty, ambiguous: true };
  }
  const closesAt = closes.length === 1 ? closes[0] : null;
  const opensAt = opens.length === 1 && (!closesAt || opens[0] <= closesAt) ? opens[0] : null;
  let deadlineNote = null;
  if (!closesAt) {
    const relative = raw.match(
      /plazo de (?:presentaci[oó]n(?: de (?:las )?solicitudes)? )?(?:ser[aá] de )?(?:(\d{1,3})|(un|uno|dos|tres|cinco|diez|quince|veinte|treinta)) (d[ií]as|mes(?:es)?)(?: (h[aá]biles|naturales))?[^.;]{0,120}/i
    );
    if (relative) {
      const note = relative[0].replace(/\s+/g, " ").trim();
      deadlineNote = note.charAt(0).toUpperCase() + note.slice(1);
      if (deadlineNote.length > 170) deadlineNote = `${deadlineNote.slice(0, 167)}…`;
    }
  }
  return { opensAt, closesAt, deadlineNote, ambiguous: false };
}

export function extractWho(text) {
  const match = String(text || "").match(
    /(?:podr[aá]n ser beneficiarios|podr[aá]n recibir ayuda|beneficiarios?|s[oó]lo podr[aá]n recibir|agricultores (?:activos )?que|ganaderos que|titulares de explotaciones)[^.]{8,220}/i
  );
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

const EURO_RE = /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)\s*(?:€|euros)/gi;

/** Importes en euros distintos que aparecen en el texto (normalizados). */
export function euroAmountsIn(text) {
  const raw = String(text || "").replace(/\s+/g, " ");
  return [...new Set([...raw.matchAll(EURO_RE)].map((m) => m[1].replace(/\./g, "").replace(",", ".")).map(Number).filter((n) => Number.isFinite(n) && n > 0))];
}

/** Importe literal del texto. Si hay varios importes distintos, no se elige: `ambiguous`. */
export function extractAmountInfo(text) {
  const raw = String(text || "").replace(/\s+/g, " ");
  const amounts = euroAmountsIn(raw);
  if (amounts.length > 1) return { amount: null, ambiguous: true };
  const euros = raw.match(/[^.]{0,90}\d[\d.]*(?:,\d+)?\s*(?:€|euros)/i);
  if (euros) return { amount: euros[0].trim(), ambiguous: false };
  const pago = raw.match(/pago anual por (?:hect[aá]rea|animal|cabeza|colmena)[^.]{0,100}/i);
  return { amount: pago ? pago[0].trim() : null, ambiguous: false };
}

export function extractAmount(text) {
  return extractAmountInfo(text).amount;
}

export function extractImplies(text) {
  const match = String(text || "").match(
    /(?:el objeto de esta ayuda es|el objetivo de esta ayuda es|contribuye a|para hacer frente a)[^.]{8,220}/i
  );
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

export function waterOf(text) {
  const raw = String(text || "");
  const secano = /\bsecano\b/i.test(raw);
  const regadio = /\bregad[ií]o\b/i.test(raw);
  if (secano && regadio) return "ambos";
  if (secano) return "secano";
  if (regadio) return "regadio";
  return null;
}

export function cropsIn(text) {
  const raw = String(text || "");
  return CROP_RULES.filter((rule) => rule.re.test(raw)).map((rule) => rule.id);
}

export function daysUntil(value, todayKey) {
  if (!value || !todayKey) return null;
  const key = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !/^\d{4}-\d{2}-\d{2}$/.test(todayKey)) return null;
  const close = Date.parse(`${key}T00:00:00Z`);
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  if (Number.isNaN(close) || Number.isNaN(today)) return null;
  return Math.round((close - today) / 86400000);
}

export function statusOf(aid, todayKey) {
  if (!aid) return "sin_plazo";
  if (aid.deadlineNote && /sin plazo/i.test(aid.deadlineNote)) return "sin_plazo";
  const openDays = aid.opensAt ? daysUntil(aid.opensAt, todayKey) : null;
  const closeDays = aid.closesAt ? daysUntil(aid.closesAt, todayKey) : null;
  if (openDays != null && openDays > 0) return "proxima";
  if (closeDays != null && closeDays < 0) return "cerrada";
  if (closeDays != null && closeDays <= 15) return "cierra_pronto";
  if (closeDays != null) return "abierta";
  // Solo con fecha de apertura pasada no sabemos si sigue abierta: no se afirma.
  if (aid.sourceOpen === true) return "abierta";
  return "sin_plazo";
}

export function inZone(zone, pref) {
  if (pref === "mi-zona") return zone === "salamanca" || zone === "cyl" || zone === "nacional";
  if (pref === "cyl") return zone === "cyl" || zone === "salamanca";
  if (pref === "salamanca") return zone === "salamanca";
  if (pref === "nacional") return zone === "nacional";
  return true;
}

export function forYou(item, prefs) {
  const preferences = normalizePrefs(prefs);
  const sectors = item?.sectors || [];
  const sectorOk = preferences.sector === "todos" || sectors.includes(preferences.sector);
  const waterOk = !item?.water || item.water === "ambos" || preferences.water.includes(item.water);
  const crops = item?.crops || [];
  const cropsOk = !crops.length || !preferences.crops.length || crops.some((id) => preferences.crops.includes(id));
  const zoneOk = inZone(item?.zone || "nacional", preferences.zone);
  const top = preferences.infoOrder.slice(0, 2);
  const infoOk = (item?.infoTypes || []).some((id) => top.includes(id));
  return Boolean(sectorOk && waterOk && cropsOk && zoneOk && infoOk);
}

export function matchScore(item, prefs, todayKey) {
  const preferences = normalizePrefs(prefs);
  const kinds = item?.infoTypes || [];
  let info = 0;
  preferences.infoOrder.forEach((id, index) => {
    if (kinds.includes(id)) info = Math.max(info, (preferences.infoOrder.length - index) * 100);
  });
  const sectors = item?.sectors || [];
  const sector = preferences.sector === "todos" ? 30 : sectors.includes(preferences.sector) ? 80 : 0;
  let zone = 0;
  const itemZone = item?.zone || "nacional";
  if (preferences.zone === "mi-zona") {
    zone = itemZone === "salamanca" ? 50 : itemZone === "cyl" ? 40 : itemZone === "nacional" ? 20 : 0;
  } else if (inZone(itemZone, preferences.zone)) zone = 40;
  const water = !item?.water ? 4 : item.water === "ambos" || preferences.water.includes(item.water) ? 25 : 0;
  const hits = (item?.crops || []).filter((id) => preferences.crops.includes(id)).length;
  const crops = hits ? 15 + hits * 12 : item?.crops?.length ? 0 : 4;
  const left = daysUntil(item?.aid?.closesAt, todayKey);
  const soon = left != null && left >= 0 && left <= 15 ? 70 : 0;
  return info + sector + zone + water + crops + soon;
}

export function digestGroup(item, prefs, todayKey) {
  const preferences = normalizePrefs(prefs);
  const sectors = item?.sectors || [];
  const soon = (() => {
    const left = daysUntil(item?.aid?.closesAt, todayKey);
    return left != null && left >= 0 && left <= 15;
  })();
  const preferred = preferences.sector === "todos" || sectors.includes(preferences.sector);
  const agri = sectors.includes("agricultura");
  if (preferred && soon) return 0;
  if (agri && soon) return 1;
  if (preferred) return 2;
  if (agri) return 3;
  if (soon) return 4;
  return 5;
}

export function compareItems(a, b, prefs, todayKey) {
  const group = digestGroup(a, prefs, todayKey) - digestGroup(b, prefs, todayKey);
  if (group) return group;
  const score = matchScore(b, prefs, todayKey) - matchScore(a, prefs, todayKey);
  if (score) return score;
  const closeA = a?.aid?.closesAt || "9999-99-99";
  const closeB = b?.aid?.closesAt || "9999-99-99";
  if (closeA !== closeB) return closeA < closeB ? -1 : 1;
  return String(a?.title || "").localeCompare(String(b?.title || ""), "es");
}
