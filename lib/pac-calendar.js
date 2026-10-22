/**
 * Calendario de pagos de la PAC con cuenta atrás.
 * Las fechas y las citas literales se editan en config/pac-calendario.json. Este archivo solo calcula.
 * Cada fecha lleva su fuente y su cita. Si la fuente no da el día exacto («en el mes de mayo»),
 * la fecha va con precisión de mes, marcada «orientativa», y no se cuentan días hasta ella.
 * No depende de Node: lo usan el servidor y el navegador (/mod/pac-calendar.js).
 */
function dayNumber(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

/** «2027-05» → primer día del mes (solo para saber si ya ha empezado). */
function monthStart(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})$/);
  return match ? dayNumber(`${match[1]}-${match[2]}-01`) : null;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function shortDay(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
  const month = String(key || "").match(/^(\d{4})-(\d{2})$/);
  return month ? `${MONTH_NAMES[Number(month[2]) - 1]} de ${month[1]}` : "";
}

function plural(count) {
  return count === 1 ? "1 día" : `${count} días`;
}

function sourceAt(sources, index) {
  const source = Number.isInteger(index) ? sources[index] : null;
  return source && /^https?:\/\//i.test(String(source.url || "")) ? source : null;
}

/** Estado de cada hito respecto a hoy: pasado, en_curso o proximo, con su cuenta atrás. */
export function pacTimeline(config, todayKey) {
  const today = dayNumber(todayKey);
  const sources = Array.isArray(config?.fuentes) ? config.fuentes : [];
  const milestones = (Array.isArray(config?.hitos) ? config.hitos : [])
    .map((hito) => {
      const source = sourceAt(sources, hito.fuente);
      const quotes = (Array.isArray(hito.citas) ? hito.citas : [])
        .map((cita) => ({ text: String(cita.texto || "").trim(), source: sourceAt(sources, cita.fuente) }))
        .filter((cita) => cita.text && cita.source);
      // Sin fuente con enlace o sin cita literal, el hito no se muestra.
      if (!source || !quotes.length) return null;
      const monthOnly = /^\d{4}-\d{2}$/.test(String(hito.desde || ""));
      const start = monthOnly ? monthStart(hito.desde) : dayNumber(hito.desde);
      const end = dayNumber(hito.hasta);
      const approx = Boolean(hito.desdeOrientativa || hito.desdeAproximado || monthOnly);
      let state = "proximo";
      if (end != null && today > end) state = "pasado";
      else if (start != null && today >= start) state = "en_curso";
      const toStart = start == null || monthOnly ? null : start - today;
      const toEnd = end == null ? null : end - today;
      let countdown = "";
      if (state === "pasado") countdown = "Terminado";
      else if (state === "en_curso") {
        countdown = toEnd == null ? "En curso" : toEnd === 0 ? "Último día hoy" : `Quedan ${plural(toEnd)} (hasta el ${shortDay(hito.hasta)})`;
      } else if (monthOnly || approx) {
        countdown = `Empieza: ${hito.desdeTexto || shortDay(hito.desde)} (orientativa)`;
      } else {
        countdown = toStart === 1 ? "Empieza mañana" : `Empieza en ${plural(toStart)}`;
      }
      return {
        id: hito.id,
        title: hito.titulo,
        from: hito.desde,
        fromText: hito.desdeTexto || shortDay(hito.desde),
        to: hito.hasta || null,
        fromApprox: approx,
        fromMonthOnly: monthOnly,
        note: hito.nota || "",
        quotes,
        source,
        state,
        daysToStart: toStart,
        daysToEnd: toEnd,
        countdown,
      };
    })
    .filter(Boolean);
  const next = milestones.find((item) => item.state === "en_curso") || milestones.find((item) => item.state === "proximo") || null;
  const aviso = config?.aviso && typeof config.aviso === "object" ? config.aviso : null;
  const avisoSource = aviso ? sourceAt(sources, aviso.fuente) : null;
  return {
    campaign: config?.campana || "",
    title: config?.titulo || "Calendario de pagos de la PAC",
    notice: aviso && avisoSource ? { text: aviso.texto, context: aviso.contexto || "", source: avisoSource } : null,
    updated: config?.actualizado || "",
    sources: sources.filter((source) => /^https?:\/\//i.test(String(source.url || ""))),
    milestones,
    next,
  };
}
