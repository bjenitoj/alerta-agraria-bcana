import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "normativa-"));
const { classify, isNormaTitle } = await import("../lib/classify.js");
const { parseConsolidada, getNormativaVigente, resetNormativaCache, NORMATIVA_QUERY, normaSectors } = await import("../lib/normativa.js");
// Copia real de la API de legislación consolidada del BOE, descargada el 29/10/2026 (40 normas).
const fixture = JSON.parse(fs.readFileSync(path.join(root, "test", "fixtures", "boe-consolidada-agraria-2026-10-29.json"), "utf8"));
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");

test("Normativa y Ayudas no se mezclan: una ayuda o convocatoria nunca es Normativa", () => {
  // Títulos reales de BOE/BOCyL (octubre 2026).
  assert.equal(classify({ sourceId: "boe_ganaderia", title: "Orden APA/1082/2026, de 7 de octubre, por la que se establecen medidas específicas de protección" }), "normativa_convocatorias");
  assert.equal(classify({ sourceId: "bocyl", title: "ORDEN AGR/1047/2026, de 7 de octubre, por la que se aprueba el «Plan de obras de la construcción de varias balsas»" }), "normativa_convocatorias");
  assert.equal(classify({ sourceId: "boe_agricultura", title: "Reglamento de Ejecución (UE) 2026/2340 de la Comisión, de 22 de octubre de 2026" }), "normativa_convocatorias");
  assert.equal(classify({ sourceId: "bocyl", title: "ORDEN AGR/1095/2026, de 20 de octubre, por la que se conceden los premios a la excelencia" }), "ayudas_subvenciones");
  assert.equal(classify({ sourceId: "boe_agricultura", title: "Real Decreto 849/2026, de 21 de octubre, por el que se regula la concesión directa de una subvención" }), "ayudas_subvenciones");
  assert.equal(classify({ sourceId: "bocyl", title: "ANUNCIO del Servicio Territorial de Agricultura, Ganadería y Desarrollo Rural de Ávila, relación de beneficiarios" }), "ayudas_subvenciones");
  assert.equal(classify({ sourceId: "bocyl", title: "ORDEN AGR/1/2026, por la que se convocan ayudas a la apicultura" }), "ayudas_subvenciones");
  // Un anuncio que no es norma ni ayuda no va a Normativa.
  assert.notEqual(classify({ sourceId: "bocyl", title: "ANUNCIO del Servicio Territorial de Agricultura de Soria, información pública" }), "normativa_convocatorias");
  for (const title of ["Ley 30/2006", "Real Decreto 1/2026", "Decreto 5/2026", "Orden APA/1/2026", "RESOLUCIÓN de 1 de octubre", "Reglamento (UE) 2026/1"]) assert.ok(isNormaTitle(title), title);
  assert.ok(!isNormaTitle("ANUNCIO de la Dirección General"));
  // En la app, la pestaña Normativa excluye además cualquier pieza de ayudas.
  assert.match(appJs, /if \(tab === "normativa"\) return item\.category === "normativa_convocatorias" && !isAidItem\(item\);/);
});

test("normas en vigor: lo dice el BOE (vigencia_agotada), sin ayudas, con enlace oficial y por fecha", () => {
  assert.match(NORMATIVA_QUERY, /departamento@codigo:3120/);
  assert.match(NORMATIVA_QUERY, /vigencia_agotada:N/);
  const items = parseConsolidada(fixture);
  assert.ok(items.length >= 20);
  for (const item of items) {
    assert.match(item.url, /^https:\/\/www\.boe\.es\//);
    assert.match(item.id, /^BOE-A-\d{4}-\d+$/);
    assert.doesNotMatch(item.title, /ayuda|subvenci|convocatori/i);
  }
  const dates = items.map((item) => item.publishedAt);
  assert.deepEqual(dates, [...dates].sort().reverse(), "reciente arriba");
  assert.ok(items.some((item) => item.id === "BOE-A-2026-21319"), "Orden APA/1082/2026");
  // Una norma que el BOE marque como derogada/agotada (copia de prueba con el campo cambiado) se quita; sin el campo, no se da por vigente.
  const row = fixture.data[0];
  assert.equal(parseConsolidada({ data: [{ ...row, vigencia_agotada: "S" }] }).length, 0);
  assert.equal(parseConsolidada({ data: [{ ...row, vigencia_agotada: undefined }] }).length, 0);
  assert.equal(parseConsolidada({ data: [{ ...row, titulo: "Real Decreto 1/2026, por el que se establecen las bases reguladoras de las ayudas" }] }).length, 0);
  assert.deepEqual(normaSectors("Orden por la que se regula la pesca de arrastre"), ["pesca"]);
  assert.deepEqual(normaSectors("Real Decreto sobre sanidad animal en explotaciones de ovino"), ["ganaderia"]);
});

test("normas en vigor: caché y, si el BOE falla, la última copia buena; sin copia, ok:false y nada inventado", async () => {
  resetNormativaCache();
  const now = new Date("2026-10-29T20:00:00Z");
  const good = await getNormativaVigente({ force: true, now, loader: async () => ({ ok: true, fetchedAt: now.toISOString(), items: parseConsolidada(fixture) }) });
  assert.equal(good.ok, true);
  const stale = await getNormativaVigente({ force: true, now, loader: async () => { throw new Error("caído"); } });
  assert.equal(stale.ok, true);
  assert.equal(stale.stale, true);
  fs.rmSync(path.join(process.env.DATA_DIR, "normativa-cache.json"), { force: true });
  resetNormativaCache();
  const none = await getNormativaVigente({ force: true, now, loader: async () => { throw new Error("caído"); } });
  assert.equal(none.ok, false);
  assert.deepEqual(none.items, []);
});

test("pestaña Normativa: sin estados, por fecha, chips de sector, en vigor desde /api/normativa/vigente", () => {
  assert.match(serverJs, /app\.get\("\/api\/normativa\/vigente"/);
  const fn = appJs.slice(appJs.indexOf("function renderNormativa"), appJs.indexOf("function renderList"));
  assert.match(fn, /filterRow\(\)/);
  assert.match(fn, /inSector\(norma\)/);
  assert.match(fn, /Normas en vigor \(BOE\)/);
  assert.doesNotMatch(fn, /isLiveAid|aidStatusOf|abierta|cerrada/);
  assert.match(appJs, /tab === "normativa" \? byPublication\(filtered\)/);
  assert.match(appJs, /fetch\("\/api\/normativa\/vigente"/);
});

test("v5.7 Ayudas: elegir «Ayudas PAC» u «Otras ayudas», cuadros de estado grandes; sin pestaña PAC; mismos números", async () => {
  const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
  assert.match(appJs, /const AID_GROUP_KEY = "alerta_ayudas_grupo_v1";/);
  assert.match(appJs, /return \(aidGroup = "pac"\);/, "por defecto, Ayudas PAC");
  assert.match(appJs, /if \(active === "pac"\) \{ active = "ayudas"; saveAidGroup\("pac"\); \}/, "pestaña PAC antigua → Ayudas PAC");
  assert.match(appJs, /\{ id: "pac", label: "Líneas PAC", goto: "ayudas", status: "pac" \}/);
  assert.match(appJs, /listStatus === "pac"\) \{ saveAidGroup\("pac"\);/);
  // Un solo grupo a la vez (no dos bloques apilados).
  const view = appJs.slice(appJs.indexOf("function aidPool"), appJs.indexOf("function renderAyudas")); // v5.8: aidPool compartido con Inicio
  assert.match(view, /group === "pac" \? isPacAid\(item\) : !isPacAid\(item\)/);
  assert.match(view, /aidStatusOf\(item, today\) !== "cerrada"/);
  // El número de la pestaña sale de la misma vista que los cuadros y la lista.
  assert.match(appJs, /id === "ayudas"\s*\? ayudasView\(\)\.items\.length/);
  const render = appJs.slice(appJs.indexOf("function renderAyudas"), appJs.indexOf("function byPublication"));
  assert.match(render, /view\.counts\[entry\.id\]/);
  assert.match(render, /view\.items\.map/);
  assert.doesNotMatch(render, /class="chip/);
  assert.match(css, /\.glance\.status-boxes \.status-box\.proxima \{ border-top-color: var\(--next\); \}/);
  assert.match(css, /\.glance\.status-boxes \.status-box\.on \{/);
  assert.match(css, /@media \(max-width: 420px\) \{\s*\.glance\.status-boxes/);
  assert.doesNotMatch(indexHtml, /data-dock="pac"/);
  assert.doesNotMatch(indexHtml, /data-dock="/, "v5.8: la barra de abajo ya no lleva apartados");
  assert.match(indexHtml, /\?v=49/);
});

test("v5.7 listados de la Junta: ni portadas genéricas ni trozos sueltos de una página son ayudas", async () => {
  const { isGenericAidPage } = await import("../lib/classify.js");
  const { linkItems } = await import("../lib/collect.js");
  assert.ok(isGenericAidPage("AYUDAS, SOLICITUDES Y NORMATIVA"));
  assert.ok(isGenericAidPage("Gestión electrónica de procedimientos y ayudas"));
  assert.ok(isGenericAidPage("Ayudas para actividades ganaderas"));
  assert.ok(!isGenericAidPage("Ayudas FEADER a entidades para realizar acciones formativas e informativas"));
  assert.ok(!isGenericAidPage("Ayudas de incorporación"));
  // Copia real de la página oficial (29/10/2026).
  const pageUrl = "https://agriculturaganaderia.jcyl.es/web/es/desarrollo-rural/ayudas-incorporacion.html";
  const html = fs.readFileSync(path.join(root, "test", "fixtures", "jcyl-ayudas-incorporacion-2026-10-29.html"), "utf8");
  const items = linkItems(html, pageUrl, "jovenes_cyl", "Desarrollo rural CyL");
  const titles = items.map((item) => item.title);
  assert.ok(titles.includes("Ayudas de incorporación"), "la ayuda de la página, una vez");
  assert.ok(!titles.some((title) => /^Comenzar a aplicar el plan empresarial/i.test(title)), "un requisito no es una ayuda");
  assert.ok(!titles.some((title) => /^Tener entre 18 y 40 años/i.test(title)));
  assert.ok(titles.some((title) => /^EXTRACTO de la Orden/i.test(title)), "la convocatoria real sigue");
  assert.ok(items.length <= 6);
});

test("v5.7 girar: el manifest permite cualquier orientación y nada la bloquea", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "public", "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.orientation, "any");
  assert.equal(manifest.display, "standalone");
  const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
  assert.match(indexHtml, /viewport-fit=cover/);
  assert.doesNotMatch(indexHtml + appJs, /screen\.orientation\.lock|lockOrientation/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  assert.match(css, /env\(safe-area-inset-left, 0px\)/);
  assert.match(css, /overflow-x: clip/);
  assert.match(indexHtml, /\?v=49/);
});
