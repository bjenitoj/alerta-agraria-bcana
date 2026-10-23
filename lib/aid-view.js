/**
 * Lectura de cada ayuda para mostrarla: plazo, detalles, motivos, calendario y WhatsApp.
 * No depende de Node: lo usan el servidor y el navegador (/mod/aid-view.js).
 * No guarda nada ni usa datos personales.
 */
import { CROP_RULES, FARM_TYPES, FISHING, daysUntil, normalizePrefs, sectorScope } from "./preferences.js";

const NOTICE = "Información orientativa. Consulta siempre la publicación oficial.";

function pad(number) {
  return String(number).padStart(2, "0");
}

export function fmtDayKey(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/**
 * Etiqueta de plazo de una ayuda.
 * kind: closed | today | open | upcoming | relative | none | no_deadline
 */
export function deadlineInfo(aid, todayKey) {
  const info = { kind: "none", days: null, label: "Plazo no indicado", closesAt: null, opensAt: null, note: null };
  if (!aid) return info;
  info.closesAt = aid.closesAt || null;
  info.opensAt = aid.opensAt || null;
  if (aid.deadlineNote && /sin plazo/i.test(aid.deadlineNote)) {
    return { ...info, kind: "no_deadline", label: "Sin plazo de solicitud", note: aid.deadlineNote };
  }
  if (aid.deadlineAmbiguous && !aid.closesAt && !aid.opensAt) {
    return { ...info, kind: "check_official", label: "Ver en la convocatoria oficial" };
  }
  const toOpen = aid.opensAt ? daysUntil(aid.opensAt, todayKey) : null;
  const left = aid.closesAt ? daysUntil(aid.closesAt, todayKey) : null;
  if (left != null) {
    if (left < 0) return { ...info, kind: "closed", days: left, label: "Cerrada" };
    if (toOpen != null && toOpen > 0) {
      return { ...info, kind: "upcoming", days: left, label: toOpen === 1 ? "Abre mañana" : `Abre en ${toOpen} días` };
    }
    if (left === 0) return { ...info, kind: "today", days: 0, label: "Cierra hoy" };
    return { ...info, kind: "open", days: left, label: left === 1 ? "Cierra mañana" : `Cierra en ${left} días` };
  }
  if (toOpen != null && toOpen > 0) {
    return { ...info, kind: "upcoming", label: toOpen === 1 ? "Abre mañana" : `Abre en ${toOpen} días` };
  }
  if (aid.deadlineNote) return { ...info, kind: "relative", label: "Plazo relativo", note: aid.deadlineNote };
  return info;
}

export function isClosedAid(aid, todayKey) {
  return deadlineInfo(aid, todayKey).kind === "closed";
}

/** Cierra entre hoy y dentro de menos de `limit` días (por defecto, menos de 15). */
export function closesWithin(aid, todayKey, limit = 15) {
  const info = deadlineInfo(aid, todayKey);
  return (info.kind === "open" || info.kind === "today") && info.days != null && info.days < limit;
}

const WORD = "(?:[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü.@-]+)";
const LINK = "(?:de|del|la|las|los|y|e|para|el)";
const NAME = `${WORD}(?:(?:,\\s|\\s)(?:${WORD}|${LINK}))*`;
const ORGANISM_RE = new RegExp(
  `(?:Consejer[ií]a|Ministerio|Direcci[oó]n General|Secretar[ií]a General|Diputaci[oó]n Provincial|Diputaci[oó]n|Ayuntamiento|Instituto|Fondo Espa[nñ]ol de Garant[ií]a Agraria|Organismo Pagador)\\s(?:${LINK}\\s)?${NAME}`,
  "g"
);
/** Solo se toma como organismo convocante si justo antes el texto dice que convoca, resuelve u ordena. */
const CONVENING_RE = /(?:resoluci[oó]n|orden|acuerdo|extracto|convoca(?:n|da|do|toria)?|decreto|aprobad[ao]s? por|dictad[ao] por)\b[^.]{0,40}$/i;

function trimName(text) {
  let value = String(text || "").replace(/\s+/g, " ").trim();
  value = value.replace(/(?:,|\s)+(?:de|del|la|las|los|y|e|para|el)$/i, "").replace(/,$/, "").trim();
  return value.length > 120 ? `${value.slice(0, 117)}…` : value;
}

const FUND_RULES = [
  ["FEADER", /\bFEADER\b|Fondo Europeo Agr[ií]cola de Desarrollo Rural/i],
  ["FEAGA", /\bFEAGA\b|Fondo Europeo Agr[ií]cola de Garant[ií]a/i],
  ["FEMPA", /\bFEMPA\b|Fondo Europeo Mar[ií]timo, de Pesca y de Acuicultura/i],
  ["FEDER", /\bFEDER\b/i],
  ["PEPAC", /\bPEPAC\b|Plan Estrat[eé]gico de la PAC/i],
  ["Next Generation EU (MRR)", /Next ?Generation|Mecanismo de Recuperaci[oó]n y Resiliencia|\bPRTR\b/i],
];

const AMOUNT = "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?)\\s*(?:€|euros)";
const MAX_RULES = [
  new RegExp(`(?:importe|cuant[ií]a|ayuda|subvenci[oó]n)\\s+m[aá]xim[ao][^.€]{0,80}?${AMOUNT}`, "i"),
  new RegExp(`no\\s+(?:podr[aá]\\s+)?superar[aá]?\\s+(?:los|las|el importe de|la cantidad de)?\\s*${AMOUNT}`, "i"),
  new RegExp(`(?:con|hasta)\\s+un\\s+m[aá]ximo\\s+de\\s+${AMOUNT}`, "i"),
  new RegExp(`l[ií]mite\\s+(?:m[aá]ximo\\s+)?de\\s+${AMOUNT}`, "i"),
];

/**
 * Organismo, fondo, código BDNS e importe máximo, solo si el texto los dice.
 * Si hay varios importes máximos distintos no se elige ninguno (maxAmountAmbiguous).
 */
export function extractDetails(text) {
  const raw = String(text || "").replace(/\s+/g, " ");
  let organism = null;
  for (const match of raw.matchAll(ORGANISM_RE)) {
    if (CONVENING_RE.test(raw.slice(Math.max(0, match.index - 60), match.index))) {
      organism = trimName(match[0]);
      break;
    }
  }
  const funds = FUND_RULES.filter(([, re]) => re.test(raw)).map(([label]) => label);
  const bdns = raw.match(/\bBDNS\b[^0-9]{0,20}(\d{5,7})\b/i);
  const maxValues = new Set();
  for (const re of MAX_RULES) {
    for (const found of raw.matchAll(new RegExp(re.source, "gi"))) maxValues.add(found[1]);
  }
  const maxAmountAmbiguous = maxValues.size > 1;
  return {
    organism,
    funds,
    bdnsCode: bdns ? bdns[1] : null,
    maxAmount: maxValues.size === 1 ? `${[...maxValues][0]} €` : null,
    maxAmountAmbiguous,
  };
}

/**
 * Une lo que trae la ficha (aid, bdnsCode) con lo que se puede leer del texto oficial.
 * `from` dice de dónde sale cada dato: «ficha» (campo estructurado de la fuente) o «texto» (leído del texto publicado).
 */
export function itemDetails(item) {
  const aid = item?.aid || {};
  const text = extractDetails(`${item?.title || ""}. ${item?.summary || ""}. ${aid.what || ""}. ${aid.amount || ""}`);
  const structuredFunds = Array.isArray(aid.funds) && aid.funds.length;
  const maxAmbiguous = !aid.maxAmount && Boolean(aid.maxAmountAmbiguous || text.maxAmountAmbiguous);
  return {
    organism: aid.organism || text.organism || null,
    funds: (structuredFunds ? aid.funds : text.funds) || [],
    bdnsCode: item?.bdnsCode || aid.bdnsCode || text.bdnsCode || null,
    maxAmount: maxAmbiguous ? null : aid.maxAmount || text.maxAmount || null,
    maxAmountAmbiguous: maxAmbiguous,
    from: {
      organism: aid.organism ? "ficha" : text.organism ? "texto" : null,
      funds: structuredFunds ? "ficha" : text.funds.length ? "texto" : null,
      bdnsCode: item?.bdnsCode || aid.bdnsCode ? "ficha" : text.bdnsCode ? "texto" : null,
    },
  };
}

/** Solo se publica lo que tiene enlace a la fuente oficial (http/https). */
export function hasSourceUrl(item) {
  return Boolean(safeUrl(item?.url));
}

const ZONE_WORDS = {
  salamanca: /\bSalamanca\b/i,
  cyl: /Castilla y Le[oó]n|\bCyL\b/i,
};

function literalWords(re, text, limit = 3) {
  const out = [];
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const source = String(text || "");
  const letter = /[\p{L}\p{N}]/u;
  for (const match of source.matchAll(new RegExp(re.source, flags))) {
    // Amplía la coincidencia a la palabra completa del texto oficial (p. ej. «agricult» → «agricultura»).
    let start = match.index;
    let end = match.index + String(match[0] || "").length;
    while (start > 0 && letter.test(source[start - 1])) start -= 1;
    while (end < source.length && letter.test(source[end])) end += 1;
    const word = source.slice(start, end).trim();
    if (word && !out.some((seen) => seen.toLowerCase() === word.toLowerCase())) out.push(word);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Por qué puede interesar: solo coincidencias verificables.
 * Cita las palabras que aparecen literalmente en el título, resumen, objeto o beneficiarios oficiales
 * y que corresponden a los filtros guardados en este navegador. No dice que se cumplan requisitos.
 */
export function whyForYou(item, prefsInput) {
  const prefs = normalizePrefs(prefsInput);
  const aid = item?.aid || {};
  const text = [item?.title, item?.summary, aid.what, aid.who].filter(Boolean).join(" \n ");
  const mentions = [];
  const push = (words) => {
    for (const word of words) if (!mentions.some((seen) => seen.toLowerCase() === word.toLowerCase())) mentions.push(word);
  };
  if (prefs.sector !== "todos") {
    const evidence = item?.sectorEvidence?.[prefs.sector];
    if (Array.isArray(evidence)) push(evidence.filter((word) => text.toLowerCase().includes(String(word).toLowerCase())).slice(0, 2));
  }
  for (const id of prefs.crops) {
    const rule = CROP_RULES.find((entry) => entry.id === id);
    if (rule) push(literalWords(rule.re, text, 2));
  }
  for (const id of [...prefs.farm, ...prefs.fishing]) {
    const rule = [...FARM_TYPES, ...FISHING].find((entry) => entry.id === id);
    if (rule) push(literalWords(rule.re, text, 1));
  }
  for (const water of sectorScope(prefs.sector).agricultura ? prefs.water : []) {
    if (water === "secano") push(literalWords(/\bsecano\b/i, text, 1));
    if (water === "regadio") push(literalWords(/\bregad[ií]o\b/i, text, 1));
  }
  const zones = prefs.zone === "mi-zona" ? ["salamanca", "cyl"] : prefs.zone === "cyl" ? ["cyl", "salamanca"] : ZONE_WORDS[prefs.zone] ? [prefs.zone] : [];
  for (const zone of zones) push(literalWords(ZONE_WORDS[zone], text, 1));
  const who = aid.who ? String(aid.who).replace(/\s+/g, " ").trim() : "";
  return {
    match: mentions.length > 0,
    mentions,
    reasons: mentions.length ? [`Menciona: ${mentions.map((word) => `«${word}»`).join(", ")}`] : [],
    warnings: mentions.length ? [] : ["El texto oficial no menciona ninguna palabra de tus filtros."],
    who: who ? (who.length > 200 ? `${who.slice(0, 199)}…` : who) : null,
  };
}

function icsEscape(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function utf8Length(text) {
  let size = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    size += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return size;
}

function foldLine(line) {
  const out = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const width = utf8Length(char);
    const limit = out.length ? 74 : 75;
    if (size + width > limit) {
      out.push(current);
      current = char;
      size = width;
    } else {
      current += char;
      size += width;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

function compactDay(key) {
  return String(key).replace(/-/g, "");
}

function nextDay(key) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function stampOf(now) {
  const date = now instanceof Date ? now : new Date(now || Date.now());
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function simpleHash(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16);
}

export function validDayKey(value) {
  const key = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key;
}

export function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

/** Archivo .ics de día completo con la fecha de cierre y aviso 2 días antes. */
export function buildIcs({ title, date, url, now = new Date(), alarmDays = 2, kind = "plazo" }) {
  if (!validDayKey(date)) throw new Error("Fecha no válida");
  const name = String(title || "Ayuda").replace(/\s+/g, " ").trim().slice(0, 200) || "Ayuda";
  const link = safeUrl(url);
  const pac = kind === "pac";
  const summary = pac ? `PAC: ${name}` : `Cierra plazo: ${name}`;
  const description = [
    pac
      ? `Fecha del calendario de pagos de la PAC: ${fmtDayKey(date)}.`
      : `Último día del plazo según la fuente oficial: ${fmtDayKey(date)}.`,
    link ? `Fuente oficial: ${link}` : "",
    NOTICE,
  ]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alerta Agraria//Plazos de ayudas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${simpleHash(`${name}|${date}|${link}`)}-${compactDay(date)}@alerta-agraria`,
    `DTSTAMP:${stampOf(now)}`,
    `DTSTART;VALUE=DATE:${compactDay(date)}`,
    `DTEND;VALUE=DATE:${nextDay(date)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    link ? `URL:${link}` : "",
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `TRIGGER:-P${Math.max(0, Number(alarmDays) || 0)}D`,
    `DESCRIPTION:${icsEscape(summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** Ruta del servidor que devuelve el .ics (sin estado). */
export function icsHref(item) {
  return icsLink({ title: item?.title, date: item?.aid?.closesAt, url: item?.url });
}

export function icsLink({ title, date, url, kind }) {
  if (!validDayKey(date)) return "";
  const params = new URLSearchParams({ titulo: String(title || "Ayuda").slice(0, 200), fecha: date });
  const link = safeUrl(url);
  if (link) params.set("enlace", link);
  if (kind === "pac") params.set("tipo", "pac");
  return `/calendario.ics?${params.toString()}`;
}

/** Enlace de WhatsApp con el texto de la ayuda y la fuente oficial. */
export function whatsappUrl(item, todayKey, appUrl = "") {
  const deadline = deadlineInfo(item?.aid, todayKey);
  const lines = [String(item?.title || "Ayuda").replace(/\s+/g, " ").trim()];
  if (deadline.closesAt && deadline.kind !== "closed") lines.push(`${deadline.label} (cierra el ${fmtDayKey(deadline.closesAt)}).`);
  else if (deadline.kind === "closed") lines.push("Plazo cerrado.");
  const link = safeUrl(item?.url);
  if (link) lines.push(`Fuente oficial: ${link}`);
  if (appUrl) lines.push(`Visto en Alerta Agraria: ${appUrl}`);
  lines.push(NOTICE);
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}
