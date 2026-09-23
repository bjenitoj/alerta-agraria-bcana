const tabsEl = document.getElementById("tabs");
const feedEl = document.getElementById("feed");
const summaryEl = document.getElementById("summary");
const sourcesEl = document.getElementById("sources");
const stampEl = document.getElementById("stamp");
const qEl = document.getElementById("q");
const onlyNewEl = document.getElementById("onlyNew");
const onlyCylEl = document.getElementById("onlyCyl");
const sectorEl = document.getElementById("sector");
const refreshBtn = document.getElementById("refresh");
const readAllBtn = document.getElementById("readAll");
const clearReadBtn = document.getElementById("clearRead");

let state = { categories: [], items: [], archive: [], sources: {}, lastCollectAt: null, collecting: false };
let active = "todas";
function storageGet(key) {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
  try { sessionStorage.setItem(key, value); } catch {}
}

let token = storageGet("alerta_token");
try {
  const params = new URLSearchParams(location.search);
  const entrada = params.get("entrada");
  if (entrada) {
    token = entrada;
    document.body.classList.remove("locked");
    storageSet("alerta_token", token);
    params.delete("entrada");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  }
} catch {}

function cleanKey(value) {
  return String(value || "").normalize("NFKC").replace(/[\s\u200b\u200c\u200d\ufeff]/g, "");
}

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", "Bearer " + token);
  const target = token ? url + (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token) : url;
  return fetch(target, { ...options, headers, cache: "no-store" });
}

function fmtDate(value) {
  if (!value) return "Fecha no indicada";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  });
}

function madridDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function isAfterToday(item) {
  const when = item?.publishedAt;
  if (!when) return true;
  return madridDay(when) > madridDay(new Date());
}

function canonicalUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    parsed.hash = "";
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.hostname.replace(/^www\./, "")}${pathname}${parsed.search}`.toLowerCase();
  } catch {
    return String(url || "").split("#")[0].trim().toLowerCase();
  }
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
  const url = canonicalUrl(item?.url);
  const title = titleKey(item?.title);
  if (url) keys.push(`u:${url}`);
  if (title.length >= 40) keys.push(`t:${title}`);
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
    localStorage.setItem(name, JSON.stringify([...values].slice(-2000)));
  } catch {}
}

function remember(item, bucket) {
  const set = readSet(bucket);
  for (const key of storyKeys(item)) set.add(key);
  writeSet(bucket, set);
}

function isRecent(item) {
  const when = item?.publishedAt;
  if (!when) return false;
  const parsed = new Date(when);
  if (Number.isNaN(parsed.getTime())) return false;
  if (item.dateSource !== "meta" && parsed.getMilliseconds() !== 0) return false;
  const day = madridDay(when);
  const today = madridDay(new Date());
  if (!day || day > today) return false;
  const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000;
  return age <= 15;
}

function unseen(items, bucket) {
  const hidden = readSet(bucket);
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const item of items || []) {
    const keys = storyKeys(item);
    if (keys.some((key) => hidden.has(key))) continue;
    const url = canonicalUrl(item.url);
    const title = titleKey(item.title);
    if (url && seenUrl.has(url)) continue;
    if (title.length >= 40 && seenTitle.has(title)) continue;
    if (url) seenUrl.add(url);
    if (title.length >= 40) seenTitle.add(title);
    out.push(item);
  }
  return out;
}

function isNew(item) {
  return !item.read;
}

function matchesSector(item) {
  const topic = item.topic || "ambos";
  if (topic === "pesca") return false;
  const sector = sectorEl.value;
  if (sector === "agricultura") return topic === "agricultura" || topic === "ambos";
  if (sector === "ganaderia") return topic === "ganaderia" || topic === "ambos";
  return topic === "agricultura" || topic === "ganaderia" || topic === "ambos";
}

function visibleItems() {
  return unseen(
    (state.items || []).filter((item) => item.topic !== "pesca" && matchesSector(item) && isRecent(item)),
    "alerta_ocultas"
  );
}

function matchingItems() {
  const q = qEl.value.trim().toLowerCase();
  return visibleItems().filter((item) => {
    if (onlyNewEl.checked && !isNew(item)) return false;
    if (onlyCylEl.checked && item.region !== "Castilla y León") return false;
    if (!q) return true;
    return `${item.title} ${item.summary} ${item.sourceName}`.toLowerCase().includes(q);
  });
}

function filtered() {
  return matchingItems().filter((item) => active === "todas" || item.category === active);
}

function filteredArchive() {
  const q = qEl.value.trim().toLowerCase();
  return unseen(state.archive || [], "alerta_borradas").filter((item) => {
    if (!q) return true;
    return `${item.title} ${item.url} ${item.sourceName}`.toLowerCase().includes(q);
  });
}

function counts() {
  const items = matchingItems();
  const map = { todas: items.length };
  for (const cat of state.categories) {
    map[cat.id] = items.filter((it) => it.category === cat.id).length;
  }
  return map;
}

function renderTabs() {
  const c = counts();
  const buttons = [
    { id: "todas", title: "Todas", count: c.todas || 0 },
    ...state.categories.map((tab) => ({ ...tab, count: c[tab.id] || 0 })),
    { id: "archivadas", title: "Archivadas", count: filteredArchive().length },
  ];
  tabsEl.innerHTML = buttons
    .map(
      (tab) => `
      <button class="tab ${tab.id === "archivadas" ? "mailbox" : ""} ${active === tab.id ? "active" : ""}" data-id="${tab.id}" type="button">
        ${tab.title}<span class="count">${tab.count}</span>
      </button>`
    )
    .join("");
}

function renderSummary() {
  if (active === "todas") {
    summaryEl.hidden = true;
    summaryEl.innerHTML = "";
    return;
  }
  summaryEl.hidden = false;
  if (active === "archivadas") {
    const n = (state.archive || []).length;
    summaryEl.innerHTML = `<h2>Archivadas</h2><p>Aquí quedan el título y el enlace de cada noticia que archives. Hay <strong>${n}</strong> archivadas. Puedes eliminar cada una o borrarlas todas.</p>`;
    return;
  }
  const unread = visibleItems().filter(isNew).length;
  const cat = state.categories.find((c) => c.id === active);
  summaryEl.innerHTML = `<h2>${cat.title}</h2><p>${cat.blurb} Hay <strong>${unread}</strong> sin tocar. Toca una noticia para marcarla como leída; usa Archivar para guardarla en Archivadas.</p>`;
}

function renderFeed() {
  if (active === "archivadas") {
    const items = filteredArchive();
    if (!items.length) {
      feedEl.innerHTML = `<div class="empty">No hay noticias archivadas. Pulsa Archivar en una noticia para guardar aquí su título y su enlace.</div>`;
      return;
    }
    feedEl.innerHTML = items
      .map(
        (item) => `
        <article class="card archived" data-id="${escapeHtml(item.id)}">
          <div class="meta">
            <span class="badge">Archivada</span>
            ${item.sourceName ? `<span class="badge">${escapeHtml(item.sourceName)}</span>` : ""}
            <span>${fmtDate(item.archivedAt)}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <div class="card-actions">
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a>
            <button type="button" class="danger delete-archived" data-id="${escapeHtml(item.id)}">Eliminar</button>
          </div>
        </article>`
      )
      .join("");
    return;
  }

  const items = filtered();
  if (!items.length) {
      feedEl.innerHTML = `<div class="empty">No hay noticias publicadas en los últimos 15 días con estos filtros. Pulsa «Actualizar ahora».</div>`;
    return;
  }
  feedEl.innerHTML = items
    .map((item) => {
      const nuevo = isNew(item) ? `<span class="badge new">Nueva</span>` : "";
      const cyl = item.region === "Castilla y León" ? `<span class="badge cyl">CyL</span>` : "";
      const ayuda =
        item.category === "ayudas_subvenciones" ? `<span class="badge ayuda">Ayuda</span>` : "";
      const topicLabel =
        item.topic === "agricultura"
          ? `<span class="badge agri">Agricultura</span>`
          : item.topic === "ganaderia"
            ? `<span class="badge gan">Ganadería</span>`
            : "";
      return `
        <article class="card ${item.read ? "read" : "new"}" data-id="${item.id}">
          <div class="meta">
            <span class="badge">${item.sourceName}</span>
            ${cyl}${ayuda}${topicLabel}${nuevo}
            <span>${fmtDate(item.publishedAt)}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary || "")}</p>
          <div class="card-actions">
            <label class="marker">
              <input type="checkbox" class="mark-archive" data-id="${item.id}" />
              <span class="tick" aria-hidden="true"></span>
              Archivar
            </label>
            <a href="${item.url}" target="_blank" rel="noopener">Abrir fuente oficial</a>
          </div>
        </article>`;
    })
    .join("");
}

function renderSources() {
  const entries = Object.entries(state.sources || {});
  if (!entries.length) {
    sourcesEl.innerHTML = "<p>Aún no hay informe de fuentes.</p>";
    return;
  }
  sourcesEl.innerHTML = entries
    .map(([id, src]) => {
      const cls = src.ok ? "ok" : "err";
      const detail = src.ok ? `${src.count} novedades · ${src.ms} ms` : src.error;
      return `<article class="source"><strong>${src.name || id}</strong><span class="${cls}">${detail}</span></article>`;
    })
    .join("");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  stampEl.textContent = state.collecting
    ? "Consultando fuentes oficiales…"
    : state.lastCollectAt
      ? `Última consulta: ${fmtDate(state.lastCollectAt)}`
      : "Todavía no hay consulta";
  refreshBtn.disabled = Boolean(state.collecting);
  if (clearReadBtn) clearReadBtn.hidden = active === "archivadas";
  renderTabs();
  renderSummary();
  renderFeed();
  renderSources();
}

function showGate(message) {
  document.body.classList.add("locked");
  const err = document.getElementById("loginError");
  const text =
    message ||
    (new URLSearchParams(location.search).get("aviso") === "clave"
      ? "Clave incorrecta. Tiene que verse el símbolo #."
      : "");
  if (text) {
    err.hidden = false;
    err.textContent = text;
  } else {
    err.hidden = true;
  }
}

function hideGate() {
  document.body.classList.remove("locked");
}

async function load() {
  const res = await api("/api/state");
  if (res.status === 401) {
    showGate();
    throw new Error("clave");
  }
  state = await res.json();
  if (!active) active = "todas";
  hideGate();
  render();
}

async function refresh() {
  refreshBtn.disabled = true;
  stampEl.textContent = "Consultando fuentes oficiales…";
  const res = await api("/api/refresh", { method: "POST" });
  const data = await res.json();
  if (data.ok === false) {
    stampEl.textContent = `Error: ${data.error}`;
    refreshBtn.disabled = false;
    return;
  }
  state = { ...state, ...data };
  render();
  if (data.added > 0 && typeof Notification === "function" && Notification.permission === "granted") {
    new Notification("Alerta Agraria CyL", {
      body: `Hay ${data.added} novedades nuevas.`,
    });
  }
}

tabsEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".tab");
  if (!btn) return;
  active = btn.dataset.id;
  render();
});

async function archiveById(id) {
  const item = (state.items || []).find((it) => it.id === id);
  if (item) remember(item, "alerta_ocultas");
  const res = await api(`/api/items/${id}/archive`, { method: "POST" });
  const data = await res.json();
  if (!data.ok) return;
  state.items = (state.items || []).filter((it) => it.id !== id);
  if (Array.isArray(data.archive)) state.archive = data.archive;
  render();
}

async function markCardRead(id, card) {
  const item = (state.items || []).find((it) => it.id === id);
  if (!item || item.read) return;
  item.read = true;
  if (card) {
    card.classList.add("read");
    card.classList.remove("new");
    card.querySelector(".badge.new")?.remove();
  }
  renderTabs();
  renderSummary();
  if (onlyNewEl.checked) renderFeed();
  await api(`/api/items/${id}/read`, { method: "POST" });
}

feedEl.addEventListener("change", async (ev) => {
  const box = ev.target.closest(".mark-archive");
  if (!box) return;
  box.disabled = true;
  ev.stopPropagation();
  await archiveById(box.dataset.id);
});

async function deleteArchivedById(id) {
  const item = (state.archive || []).find((it) => it.id === id);
  if (item) {
    remember(item, "alerta_ocultas");
    remember(item, "alerta_borradas");
  }
  const res = await api(`/api/archive/${id}/delete`, { method: "POST" });
  const data = await res.json();
  if (!data.ok) return;
  state.archive = Array.isArray(data.archive)
    ? data.archive
    : (state.archive || []).filter((it) => it.id !== id);
  render();
}

feedEl.addEventListener("click", async (ev) => {
  const del = ev.target.closest(".delete-archived");
  if (del) {
    ev.preventDefault();
    del.disabled = true;
    await deleteArchivedById(del.dataset.id);
    return;
  }
  if (active === "archivadas") return;
  if (ev.target.closest(".marker")) return;
  const card = ev.target.closest(".card");
  if (!card) return;
  await markCardRead(card.dataset.id, card);
});

function purgeReadOnClose() {
  for (const item of state.items || []) {
    if (item.read) remember(item, "alerta_ocultas");
  }
  api("/api/purge-read", {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

window.addEventListener("pagehide", purgeReadOnClose);
window.addEventListener("beforeunload", purgeReadOnClose);

qEl.addEventListener("input", render);
onlyNewEl.addEventListener("change", render);
onlyCylEl.addEventListener("change", render);
sectorEl.addEventListener("change", render);
refreshBtn.addEventListener("click", refresh);
clearReadBtn.addEventListener("click", async () => {
  const read = (state.items || []).filter((item) => item.read);
  for (const item of read) remember(item, "alerta_ocultas");
  const res = await api("/api/purge-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = await res.json();
  if (data.items) state.items = data.items;
  else state.items = (state.items || []).filter((item) => !item.read);
  render();
});

readAllBtn.addEventListener("click", async () => {
  const target = active === "archivadas" ? "archive" : "items";
  const batch = target === "archive" ? state.archive : state.items;
  for (const item of batch || []) {
    remember(item, "alerta_ocultas");
    if (target === "archive") remember(item, "alerta_borradas");
  }
  const res = await api("/api/delete-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  const data = await res.json();
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
      box.innerHTML = `Enlace para PC, iPhone o iPad, con cualquier Wi‑Fi o datos: <a href="${data.internet}">${data.internet}</a>. El ordenador tiene que estar encendido. En Safari: Compartir → Añadir a pantalla de inicio.`;
      return;
    }
    const urls = data.lan || [];
    box.textContent = urls.length
      ? `Todavía se está creando el enlace de internet. Mientras tanto, en la misma Wi‑Fi: ${urls.join(" · ")}`
      : "Se está creando el enlace para usarla fuera de casa…";
    setTimeout(() => showAccess().catch(() => {}), 3000);
  } catch {
    setTimeout(() => showAccess().catch(() => {}), 3000);
  }
}

async function boot() {
  await load();
  showAccess();
  if (state.collecting) {
    setTimeout(() => boot().catch(() => {}), 4000);
    return;
  }
  await refresh();
}

boot().catch((err) => {
  if (err.message === "clave") return;
  stampEl.textContent = `No se pudo cargar el panel: ${err.message}`;
});
