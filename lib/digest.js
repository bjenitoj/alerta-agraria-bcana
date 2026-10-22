import { compareItems, daysUntil, DEFAULT_PREFS, madridTodayKey } from "./preferences.js";

const MAX_DAYS = 60;
const MAX_AIDS = 80;

export function isDigestAid(item) {
  if (!item) return false;
  if (item.aid?.status === "cerrada") return false;
  if (item.infoTypes?.includes("ayudas") || item.category === "ayudas_subvenciones" || item.sourceId === "bdns") return true;
  if (item.kind === "linea") {
    if (item.aid?.status === "abierta" || item.aid?.status === "proxima" || item.aid?.status === "cierra_pronto") return true;
    return /2026|2027/.test(`${item.title || ""} ${item.summary || ""}`);
  }
  return false;
}

function snapshot(item) {
  return {
    id: item.id,
    title: item.title || "",
    url: item.url || "",
    sourceName: item.sourceName || "",
    sourceId: item.sourceId || "",
    category: item.category || "",
    sectors: item.sectors || [],
    crops: item.crops || [],
    water: item.water || null,
    zone: item.zone || "nacional",
    region: item.region || "",
    infoTypes: item.infoTypes || [],
    themes: item.themes || [],
    kind: item.kind || "ayuda",
    publishedAt: item.publishedAt || null,
    aid: item.aid || null,
  };
}

export function composeDigest(previous, items, now = new Date()) {
  const date = madridTodayKey(now);
  const older = (previous || []).filter((entry) => entry && entry.date && entry.date < date);
  const today = (previous || []).find((entry) => entry && entry.date === date);
  const seen = new Set(older.flatMap((entry) => (entry.items || []).map((item) => item.id)));
  const already = new Set((today?.items || []).map((item) => item.id));
  const baseline = older.length === 0 && !today;
  const fresh = [];
  for (const item of items || []) {
    if (!item || seen.has(item.id) || already.has(item.id)) continue;
    if (!isDigestAid(item)) continue;
    fresh.push(snapshot(item));
  }
  const merged = [...(today?.items || []), ...fresh]
    .filter((item) => item && item.id)
    .slice(0, MAX_AIDS);
  merged.sort((a, b) => compareItems(a, b, DEFAULT_PREFS, date));
  let notice = "";
  if (!merged.length && baseline) notice = "Primer resumen: las fuentes no traen ayudas que mostrar.";
  else if (!merged.length) notice = "Desde el último resumen no hay ayudas ni subvenciones nuevas.";
  else if (baseline) {
    notice = "Primer resumen: no había un día anterior. Aquí están las ayudas que las fuentes muestran ahora. Mañana solo entrarán las nuevas.";
  }
  return {
    date,
    createdAt: today?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    baseline,
    empty: merged.length === 0,
    notice,
    items: merged,
  };
}

export function mergeDigestLists(local = [], remote = []) {
  const byDate = new Map();
  for (const entry of [...local, ...remote]) {
    if (!entry || !entry.date) continue;
    const prev = byDate.get(entry.date);
    if (!prev) {
      byDate.set(entry.date, entry);
      continue;
    }
    const prevStamp = prev.updatedAt || prev.createdAt || "";
    const nextStamp = entry.updatedAt || entry.createdAt || "";
    if (nextStamp > prevStamp || ((entry.items || []).length > (prev.items || []).length && nextStamp === prevStamp)) {
      byDate.set(entry.date, entry);
    }
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_DAYS);
}

export function closingSoon(item, todayKey) {
  const left = daysUntil(item?.aid?.closesAt, todayKey);
  return left != null && left >= 0 && left <= 15;
}
