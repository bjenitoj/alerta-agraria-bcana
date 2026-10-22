import { extractDetails } from "./aid-view.js";
import { cropsIn, extractAmountInfo, extractDeadline, extractImplies, extractWho, statusOf, waterOf } from "./preferences.js";

const euro = new Intl.NumberFormat("es-ES");

export function emptyAid() {
  return {
    what: null,
    who: null,
    amount: null,
    implies: null,
    opensAt: null,
    closesAt: null,
    deadlineNote: null,
    deadlineAmbiguous: false,
    amountAmbiguous: false,
    sourceOpen: null,
    organism: null,
    funds: [],
    maxAmount: null,
    maxAmountAmbiguous: false,
    status: "sin_plazo",
  };
}

function clean(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value || null;
}

function dayKey(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function aidFromText(text) {
  const raw = String(text || "");
  const deadline = extractDeadline(raw);
  const details = extractDetails(raw);
  const amount = extractAmountInfo(raw);
  return {
    what: null,
    who: extractWho(raw),
    amount: amount.amount,
    amountAmbiguous: amount.ambiguous,
    implies: extractImplies(raw),
    opensAt: deadline.opensAt,
    closesAt: deadline.closesAt,
    deadlineNote: deadline.deadlineNote,
    deadlineAmbiguous: deadline.ambiguous,
    sourceOpen: null,
    organism: details.organism,
    funds: details.funds,
    maxAmount: details.maxAmount,
    maxAmountAmbiguous: details.maxAmountAmbiguous,
  };
}

const SMALL_WORDS = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "para", "a"]);

/** «CONSEJERÍA DE AGRICULTURA» → «Consejería de Agricultura» (la BDNS escribe en mayúsculas). */
export function tidyName(value) {
  const text = clean(value);
  if (!text) return null;
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .split(" ")
    .map((word, index) => (index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ")
    .replace(/\b(Cyl|Pac|Feaga|Feader|Fempa|Bdns)\b/g, (word) => (word === "Cyl" ? "CyL" : word.toUpperCase()));
}

function bdnsFunds(detail) {
  const funds = (detail.fondos || []).map((item) => clean(item?.descripcion)).filter(Boolean);
  const labels = extractDetails(funds.join(". ")).funds;
  const out = labels.length ? labels : funds.map(tidyName);
  if (detail.mrr === true && !out.includes("Next Generation EU (MRR)")) out.push("Next Generation EU (MRR)");
  return [...new Set(out)].slice(0, 4);
}

export function aidFromBdns(detail) {
  if (!detail || typeof detail !== "object") return emptyAid();
  const who = (detail.tiposBeneficiarios || [])
    .map((item) => clean(item?.descripcion))
    .filter(Boolean)
    .join("; ");
  const instruments = (detail.instrumentos || [])
    .map((item) => clean(item?.descripcion))
    .filter(Boolean);
  const implies = [
    clean(detail.tipoConvocatoria),
    clean(detail.descripcionFinalidad),
    instruments.join(", ") || null,
    clean(detail.reglamento?.descripcion),
  ]
    .filter(Boolean)
    .join(" · ");
  const noDeadline = /sin plazo/i.test(`${detail.textInicio || ""} ${detail.textFin || ""}`);
  const total = Number(detail.presupuestoTotal);
  const amount =
    Number.isFinite(total) && total > 0
      ? `Presupuesto total de la convocatoria: ${euro.format(total)} €`
      : null;
  return {
    what: clean(detail.descripcion),
    who: who || null,
    amount,
    implies: implies || null,
    opensAt: noDeadline ? null : dayKey(detail.fechaInicioSolicitud),
    closesAt: noDeadline ? null : dayKey(detail.fechaFinSolicitud),
    deadlineNote: noDeadline ? "Sin plazo de solicitud" : null,
    deadlineAmbiguous: false,
    amountAmbiguous: false,
    sourceOpen: detail.abierto === true ? true : detail.abierto === false ? false : null,
    organism: tidyName(detail.organo?.nivel3 || detail.organo?.nivel2 || detail.organo?.nivel1),
    funds: bdnsFunds(detail),
    maxAmount: null,
    maxAmountAmbiguous: false,
  };
}

function prefer(primary, fallback) {
  return primary != null && primary !== "" ? primary : fallback ?? null;
}

/**
 * Une dos lecturas de la misma ayuda; manda la primera (la más estructurada).
 * Si la primera ya vio dudas en el plazo o el importe y no tiene dato propio,
 * no se rellena con la segunda: se queda en «Ver en la convocatoria oficial».
 */
export function mergeAid(base, extra) {
  const left = base || {};
  const right = extra || {};
  const leftDeadline = Boolean(left.closesAt || left.opensAt || left.deadlineNote);
  const deadlineAmbiguous = leftDeadline ? false : Boolean(left.deadlineAmbiguous || right.deadlineAmbiguous);
  const amountAmbiguous = left.amount ? false : Boolean(left.amountAmbiguous || right.amountAmbiguous);
  const maxAmountAmbiguous = left.maxAmount ? false : Boolean(left.maxAmountAmbiguous || right.maxAmountAmbiguous);
  return {
    what: prefer(left.what, right.what),
    who: prefer(left.who, right.who),
    amount: amountAmbiguous ? null : prefer(left.amount, right.amount),
    amountAmbiguous,
    implies: prefer(left.implies, right.implies),
    opensAt: deadlineAmbiguous ? null : prefer(left.opensAt, right.opensAt),
    closesAt: deadlineAmbiguous ? null : prefer(left.closesAt, right.closesAt),
    deadlineNote: deadlineAmbiguous ? null : prefer(left.deadlineNote, right.deadlineNote),
    deadlineAmbiguous,
    sourceOpen: left.sourceOpen != null ? left.sourceOpen : right.sourceOpen ?? null,
    organism: prefer(left.organism, right.organism),
    funds: Array.isArray(left.funds) && left.funds.length ? left.funds : Array.isArray(right.funds) ? right.funds : [],
    maxAmount: maxAmountAmbiguous ? null : prefer(left.maxAmount, right.maxAmount),
    maxAmountAmbiguous,
  };
}

export function finalizeAid(partial, todayKey) {
  const aid = { ...emptyAid(), ...(partial || {}) };
  aid.status = statusOf(aid, todayKey);
  return aid;
}

export function farmSignals(text) {
  return {
    crops: cropsIn(text),
    water: waterOf(text),
  };
}
