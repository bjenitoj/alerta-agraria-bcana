export const CATEGORIES = [
  {
    id: "ayudas_subvenciones",
    title: "Ayudas y subvenciones",
    blurb: "Convocatorias, extractos, plazos y noticias de ayudas agrarias y ganaderas.",
  },
  {
    id: "normativa_convocatorias",
    title: "Normativa",
    blurb: "Órdenes, resoluciones y anuncios oficiales de Castilla y León que no son convocatorias de ayuda.",
  },
  {
    id: "pac_pagos",
    title: "PAC, ecorregímenes y pagos",
    blurb: "Solicitud Única, ecorregímenes, derechos y pagos del FEGA y de CyL.",
  },
  {
    id: "jovenes_modernizacion",
    title: "Jóvenes y modernización",
    blurb: "Incorporación, relevo generacional y planes de mejora de explotaciones.",
  },
  {
    id: "noticias_oficiales",
    title: "Noticias oficiales",
    blurb: "Notas de prensa del MAPA y de la Junta de Castilla y León.",
  },
  {
    id: "leyes_boe",
    title: "Leyes y reales decretos",
    blurb: "Normativa estatal y europea publicada en el BOE.",
  },
];

const AGRARIO =
  /agricult|ganader|agroaliment|desarrollo rural|pac\b|pepac|feader|feaga|fega|ecorreg|viñedo|vinedo|vitivin|agrari|cereal|ovino|vacuno|caprino|regad[ií]|secano|explotaci[oó]n agr|j[oó]venes agricult|modernizaci[oó]n|sigpac|solicitud [uú]nica|ayuda b[aá]sica|remolacha|girasol|herb[aá]ce|fitosanit|fertiliz|seguro agr|enesa|itacyl|medio rural|pol[ií]tica agr/i;

const AGRICULTURA =
  /agricult(?!ura, pesca)|cultivo|cereal|viñedo|vinedo|vitivin|herb[aá]ce|remolacha|girasol|secano|regad[ií]|fitosanit|fertiliz|siembra|cosecha|olivar|frutal|hort[ií]cola|parcela agr|superficie agr|semilla|maquinaria agr[ií]cola|concentraci[oó]n parcelaria/i;

const GANADERIA =
  /ganader|vacuno|ovino|caprino|porcino|av[ií]cola|l[aá]ctea|\bleche\b|ternero|oveja|cabra|pasto|pastoreo|c[aá]rnico|explotaci[oó]n ganad|sanidad animal|raza aut[oó]ctona|bienestar animal/i;

const JOVENES =
  /j[oó]ven(?:es)? agricult|incorporaci[oó]n|relevo generacional|primera instalaci[oó]n|modernizaci[oó]n(?: de)? explot|plan(?:es)? de mejora|titularidad compartida/i;

const PAC =
  /pol[ií]tica agr[ií]cola com[uú]n|\bpac\b|pepac|ecorreg|solicitud [uú]nica|ayuda b[aá]sica|abrs|pagos? directos?|fega|feaga|feader|derechos de ayuda|condicionalidad|sigpac/i;

const PAC_OPERATIVA =
  /ecorreg|solicitud [uú]nica|ayuda b[aá]sica|abrs|pagos? directos?|importes unitarios|circular de coordinaci[oó]n|derechos de ayuda|sigpac|condicionalidad|anticipo de la pac|monitorizaci[oó]n/i;

const AYUDAS =
  /subvenci[oó]n(?:es)?|(?:convocatoria|extracto).{0,60}(?:ayuda|subvenci)|bases reguladoras|\bayudas?\b(?! b[aá]sica)|bonificaci[oó]n|l[ií]nea de ayuda|infosubvenciones|\bbdns\b|seguro agr/i;

const LEYES = /real decreto|r\.?\s*d\.?\s*-?\s*ley|ley \d+\/\d+|orden apa\/|reglamento \(ue\)|boe-a-|doue-/i;

const PESCA_SOLO =
  /\bpesquer|\barmador(?:es)?\b|caladero|arrastrero|lonja|acuicultur|marisqueo|buque (?:pesquero|oceanogr)|campaña (?:medits|juvena)|golfo de vizcaya|\bfota pesquer|secretar[ií]a general de pesca|fondos europeos para la pesca|captura for|cuota pesquer|ieo\b|oceanograf/i;

const MONTHS = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function stripMinisterio(text = "") {
  return String(text)
    .replace(/ministerio de agricultura,?\s*pesca y alimentaci[oó]n/gi, "MAPA")
    .replace(/agricultura,?\s*pesca y alimentaci[oó]n/gi, "agricultura y alimentación");
}

export function isAgrario(text = "") {
  return AGRARIO.test(text);
}

export function isCastillaLeon(text = "") {
  return /castilla y le[oó]n|junta de castilla|jcyl|bocyl/i.test(text);
}

export function isPesca(text = "") {
  const cleaned = stripMinisterio(text);
  if (PESCA_SOLO.test(cleaned)) return true;
  const hasPescaWord = /\bpesca\b/i.test(cleaned);
  const hasCampo = AGRICULTURA.test(cleaned) || GANADERIA.test(cleaned) || PAC.test(cleaned);
  return hasPescaWord && !hasCampo;
}

export function topicOf(text = "") {
  const cleaned = stripMinisterio(text);
  if (isPesca(text)) return "pesca";
  const agri = AGRICULTURA.test(cleaned);
  const gan = GANADERIA.test(cleaned);
  if (agri && gan) return "ambos";
  if (gan) return "ganaderia";
  if (agri) return "agricultura";
  if (PAC.test(cleaned) || JOVENES.test(cleaned) || /desarrollo rural|agroaliment/i.test(cleaned)) {
    return "ambos";
  }
  return "ambos";
}

export function madridDateKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isAfterMadridDay(value, dayKey = madridDateKey()) {
  const key = madridDateKey(value);
  return Boolean(key && key > dayKey);
}

function clampDate(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  if (isAfterMadridDay(date)) return null;
  return date.toISOString();
}

function fromSpanishLongDate(text) {
  const m = String(text).match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (month == null) return null;
  return clampDate(new Date(Number(m[3]), month, Number(m[1]), 12, 0, 0));
}

export function parseDate(value, fallbackText = "") {
  const fromText = fromSpanishLongDate(fallbackText);
  if (fromText) return fromText;
  if (value) {
    const raw = String(value).trim();
    const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const parsed = clampDate(new Date(year, month - 1, day, 12, 0, 0));
        if (parsed) return parsed;
      }
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw) || /[A-Za-z]{3},/.test(raw) || raw.includes("T")) {
      const parsed = clampDate(new Date(raw));
      if (parsed) return parsed;
    }
    const long = fromSpanishLongDate(raw);
    if (long) return long;
  }
  return fromSpanishLongDate(fallbackText);
}

export function classify({ sourceId, title = "", summary = "", extra = "" }) {
  const blob = `${sourceId} ${title} ${summary} ${extra}`;
  const grantText = `${title} ${summary}`.replace(/https?:\/\/\S+/gi, "");

  if (JOVENES.test(blob)) return "jovenes_modernizacion";

  const esConvocatoria =
    sourceId === "bdns" ||
    sourceId === "boe_ayudas" ||
    AYUDAS.test(grantText);

  if (PAC_OPERATIVA.test(blob) && !/convocatoria|extracto de la orden|bases reguladoras|\bbdns\b/i.test(blob)) {
    return "pac_pagos";
  }
  if (esConvocatoria) return "ayudas_subvenciones";

  if (sourceId === "boe_legislacion" || sourceId === "boe_seccion1" || LEYES.test(blob)) {
    if (PAC.test(blob) && !/ley |real decreto|reglamento/i.test(title)) return "pac_pagos";
    if (sourceId.startsWith("boe") || LEYES.test(blob)) return "leyes_boe";
  }
  if (sourceId === "fega" || sourceId === "pac_cyl" || PAC.test(blob)) return "pac_pagos";
  if (sourceId === "mapa_rss" || sourceId === "mapa_prensa" || sourceId === "junta_comunicacion" || sourceId === "itacyl") {
    if (PAC.test(blob)) return "pac_pagos";
    return "noticias_oficiales";
  }
  if (sourceId === "bocyl") return "normativa_convocatorias";
  return "noticias_oficiales";
}

export function decorateItem(item) {
  if (!item) return null;
  const blob = `${item.title || ""} ${item.summary || ""} ${item.sourceName || ""}`;
  if (isPesca(blob)) return null;
  const publishedAt =
    parseDate(item.publishedAt, blob) ||
    parseDate(null, blob) ||
    item.firstSeenAt ||
    null;
  const category = classify({
    sourceId: item.sourceId,
    title: item.title,
    summary: item.summary,
  });
  if (publishedAt && isAfterMadridDay(publishedAt)) {
    return null;
  }
  return {
    ...item,
    publishedAt,
    topic: item.topic || topicOf(blob),
    category,
  };
}
