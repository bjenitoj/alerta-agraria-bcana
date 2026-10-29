import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const LABELS = ["Abiertas", "Cierran pronto", "Líneas PAC"]; // v5.6: sin «Próximas»

// Se carga el código real de los cuadros (GLANCE … glanceCards) con dos ayudantes mínimos.
const chunk = appJs.slice(appJs.indexOf("const GLANCE = ["), appJs.indexOf("function renderBoard"));
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const load = () => new Function("aidCard", "escapeHtml", "readTools", `${chunk}; return { glanceCards, open: (v) => { openStat = v; } };`)(
  (item) => `<article class="card"><a href="${esc(item.url)}">${esc(item.title)}</a></article>`, esc, () => "");
const item = (n) => ({ id: `a${n}`, title: `Ayuda oficial ${n}`, url: `https://www.boe.es/${n}` });

test("v5.4 Inicio: los nombres de los cuadros solo salen en los cuadros de colores", () => {
  const board = appJs.slice(appJs.indexOf("function renderBoard"), appJs.indexOf("function renderBoard") + 2500);
  const body = board.slice(0, board.indexOf("\n}\n"));
  assert.doesNotMatch(body, /column\(|Abiertas ahora|pac-block|<h2>PAC/);
  assert.doesNotMatch(appJs, /function column\(/);
  for (const label of LABELS) {
    const chips = appJs.slice(appJs.indexOf("const AID_STATUS_CHIPS"), appJs.indexOf("const AID_STATUS_KEY"));
    const groups = appJs.slice(appJs.indexOf("const AID_GROUPS"), appJs.indexOf("const AID_GROUP_KEY"));
    const outside = appJs.replace(chunk, "").replace(chips, "").replace(groups, ""); // v5.7: chips de estado de Ayudas
    assert.doesNotMatch(outside, new RegExp(`[>«"]${label}[<»"]`), `«${label}» fuera de los cuadros`);
  }
  assert.match(body, /glanceCards\(\{ abierta: open, cierra_pronto: soon, pac: pacAll \}\)/);
});

test("v5.4 cuadros: botones con aria-expanded/aria-controls, cuenta real y flecha", () => {
  const g = load();
  const html = g.glanceCards({ abierta: [item(1), item(2)], cierra_pronto: [], pac: [item(3)] });
  const buttons = html.match(/<button type="button" class="stat [^"]+" data-stat="[^"]+" aria-expanded="false" aria-controls="statPanel">/g) || [];
  assert.equal(buttons.length, 3);
  assert.doesNotMatch(html, /data-stat="proxima"/);
  for (const label of LABELS) assert.match(html, new RegExp(`<span>${label}</span>`));
  assert.match(html, /data-stat="abierta"[^>]*><strong>2<\/strong>/);
  assert.match(html, /data-stat="cierra_pronto"[^>]*><strong>0<\/strong>/);
  assert.match(html, /data-stat="pac"[^>]*><strong>1<\/strong>/);
  assert.match(html, /class="chev"/);
  assert.match(html, /<div id="statPanel" class="stat-panel" role="region" aria-label="Detalle" hidden><\/div>/, "cerrado por defecto");
});

test("v5.4 cuadro abierto: lista de piezas oficiales (máx. 10) y «Ver todas»", () => {
  const g = load();
  const many = Array.from({ length: 13 }, (_, i) => item(i + 1));
  g.open("abierta");
  const html = g.glanceCards({ abierta: many, cierra_pronto: [], pac: [] });
  assert.match(html, /data-stat="abierta" aria-expanded="true"/);
  assert.match(html, /data-stat="pac" aria-expanded="false"/, "solo uno abierto");
  const panel = html.slice(html.indexOf('id="statPanel"'));
  assert.doesNotMatch(panel.slice(0, 120), / hidden>/);
  assert.equal((panel.match(/<article class="card">/g) || []).length, 10);
  assert.match(panel, /href="https:\/\/www\.boe\.es\/1"/);
  assert.match(panel, /data-goto="ayudas" data-status="abierta">Ver todas \(13\)</);
});

test("v5.4 cuadro vacío: «No hay ninguna ahora»", () => {
  const g = load();
  g.open("pac");
  const html = g.glanceCards({ abierta: [], cierra_pronto: [], pac: [] });
  assert.match(html, /aria-label="Líneas PAC">\s*<p class="empty">No hay ninguna ahora<\/p>/);
  assert.doesNotMatch(html, /Ver todas/);
});

test("v5.4 tocar un cuadro lo abre y tocarlo otra vez lo cierra; «Ver todas» usa el mismo criterio", () => {
  const click = appJs.slice(appJs.indexOf('const stat = event.target.closest("[data-stat]")'), appJs.indexOf('const fav = event.target.closest("[data-fav]")'));
  assert.match(click, /openStat = openStat === stat\.dataset\.stat \? null : stat\.dataset\.stat/);
  assert.match(click, /render\(\)/);
  assert.match(click, /focus\(\{ preventScroll: true \}\)/);
  assert.match(appJs, /listStatus = go\.dataset\.status \|\| null/);
  const list = appJs.slice(appJs.indexOf("function renderList"), appJs.indexOf("function closingSoonList"));
  assert.match(list, /GLANCE_MATCH\[card\.id\]/);
  assert.match(css, /button\.stat\[aria-expanded="true"\] \.chev \{ transform: rotate\(180deg\)/);
  assert.match(css, /@keyframes statOpen/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("v5.4 cuadros coherentes: «Cierran pronto» ⊆ «Abiertas»; sin estado conocido no cuenta como abierta", () => {
  const block = appJs.slice(appJs.indexOf("const GLANCE_MATCH = {"), appJs.indexOf("function renderList"));
  const match = new Function(`function isPacLine(item) { return item.kind === "linea"; }\n${block}; return GLANCE_MATCH;`)();
  const today = [
    { id: "1", aid: { status: "abierta" } },
    { id: "2", aid: { status: "cierra_pronto" } },
    { id: "3", aid: { status: "cierra_pronto" } },
    { id: "4", aid: { status: "proxima" } },
    { id: "5", aid: { status: "sin_plazo" } },
    { id: "6", aid: { status: "cerrada" } },
    { id: "7" },
    { id: "8", kind: "linea", aid: { status: "abierta" } },
  ];
  const open = today.filter(match.abierta).map((i) => i.id);
  const soon = today.filter(match.cierra_pronto).map((i) => i.id);
  assert.deepEqual(open, ["1", "2", "3"]);
  assert.deepEqual(soon, ["2", "3"]);
  for (const id of soon) assert.ok(open.includes(id), "toda ayuda que cierra pronto está abierta");
  assert.equal(match.proxima, undefined, "v5.6: sin cuadro «Próximas»");
  assert.ok(!open.includes("4") && !open.includes("5") && !open.includes("7"), "próximas y sin estado no cuentan como abiertas");
});
