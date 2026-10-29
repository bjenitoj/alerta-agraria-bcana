import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PREFS,
  PREFS_STORAGE_KEY,
  compareItems,
  digestSelection,
  forYou,
  infoRank,
  infoSection,
  normalizePrefs,
  prefsSummary,
} from "../lib/preferences.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = "2026-10-23";
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

const aidAgri = { id: "a", title: "Ayuda cereal", sectors: ["agricultura"], infoTypes: ["ayudas"], zone: "cyl", aid: { closesAt: "2026-10-30" } };
const aidGan = { id: "g", title: "Ayuda vacuno", sectors: ["ganaderia"], infoTypes: ["ayudas"], zone: "cyl", aid: { closesAt: "2026-12-30" } };
const norma = { id: "n", title: "Orden de normativa", sectors: ["agricultura"], category: "normativa_convocatorias", infoTypes: ["normativa"], zone: "cyl" };
const news = { id: "x", title: "Noticia", sectors: ["agricultura"], category: "noticias_oficiales", infoTypes: ["noticias"], zone: "nacional" };
const pac = { id: "p", title: "Línea PAC", sectors: ["agricultura"], sourceId: "pac_lineas", kind: "linea", zone: "cyl" };

test("la clave del navegador no cambia: las preferencias guardadas se conservan", () => {
  assert.equal(PREFS_STORAGE_KEY, "alerta_prefs_v1");
  const old = { version: 1, sector: "ganaderia", zone: "cyl", water: ["secano"], crops: ["vacuno"], infoOrder: ["normativa", "ayudas", "pac", "alertas", "noticias"] };
  const prefs = normalizePrefs(old);
  assert.equal(prefs.sector, "ganaderia");
  assert.equal(prefs.zone, "cyl");
  assert.deepEqual(prefs.crops, ["vacuno"]);
  assert.deepEqual(prefs.farm, [], "campo nuevo con valor neutro");
  assert.deepEqual(prefs.info, ["normativa"], "lo que eligió con la versión anterior era el primero");
  assert.equal(prefs.infoOrder[0], "normativa");
});

test("se pueden elegir varios tipos de información, en orden, y siempre queda uno", () => {
  // v5.7: «noticias» ya no es un tipo; si venía guardado se ignora.
  const prefs = normalizePrefs({ info: ["pac", "noticias", "normativa", "pac", "inventado"] });
  assert.deepEqual(prefs.info, ["pac", "normativa"]);
  assert.deepEqual(prefs.infoOrder.slice(0, 2), ["pac", "normativa"]);
  assert.equal(prefs.infoOrder.length, 4, "el resto de tipos sigue en la lista");
  assert.deepEqual(normalizePrefs({ info: [] }).info, DEFAULT_PREFS.info);
});

test("el sector elegido pasa delante: con Ganadería, la ganadería va antes que la agricultura", () => {
  const gan = normalizePrefs({ sector: "ganaderia", info: ["ayudas"] });
  const sorted = [aidAgri, aidGan].sort((a, b) => compareItems(a, b, gan, today));
  assert.equal(sorted[0].id, "g", "aunque la de agricultura cierre antes");
  const agri = normalizePrefs({ sector: "agricultura", info: ["ayudas"] });
  assert.equal([aidGan, aidAgri].sort((a, b) => compareItems(a, b, agri, today))[0].id, "a");
});

test("ordena por los tipos elegidos sin quitar ninguno", () => {
  const prefs = normalizePrefs({ sector: "agricultura", info: ["normativa", "pac"] });
  const list = [news, aidAgri, pac, norma];
  const sorted = [...list].sort((a, b) => compareItems(a, b, prefs, today));
  assert.equal(sorted.length, list.length, "no se oculta nada");
  assert.deepEqual(sorted.map((item) => item.id).slice(0, 2), ["n", "p"]);
  assert.equal(infoRank(norma, prefs), 0);
  assert.equal(infoRank(pac, prefs), 1);
  assert.equal(infoRank(news, prefs), 2);
  assert.equal(infoSection(aidAgri, prefs), "ayudas");
  assert.equal(infoSection(pac, prefs), "pac");
});

test("«En tus filtros» usa todos los tipos elegidos", () => {
  const prefs = normalizePrefs({ sector: "agricultura", zone: "mi-zona", crops: [], info: ["alertas", "normativa"] });
  assert.deepEqual(prefs.info, ["alertas", "normativa"]);
  assert.equal(forYou(norma, prefs), true);
  assert.equal(forYou(aidAgri, prefs), false);
});

test("el resumen de preferencias dice exactamente lo elegido, sin zona ni tierra por defecto", () => {
  const prefs = normalizePrefs({ sector: "ganaderia", zone: "cyl", water: ["regadio"], crops: [], info: ["pac", "ayudas"] });
  const text = prefsSummary(prefs);
  assert.deepEqual(text.info, ["PAC", "Ayudas y subvenciones"]);
  assert.match(text.bar, /^Ganadería · Castilla y León · sin especie concreta/);
  assert.doesNotMatch(text.bar, /Salamanca|secano|regadío/, "la tierra no aplica a ganadería");
  assert.equal(text.infoLead, undefined, "ya no hay frase larga bajo los tipos");
});

test("v5.2: la frase «Por este orden…» ya no sale en ningún sitio", () => {
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
  const lib = fs.readFileSync(path.join(root, "lib", "preferences.js"), "utf8");
  for (const source of [appJs, indexHtml, lib]) {
    assert.doesNotMatch(source, /Por este orden/);
    assert.doesNotMatch(source, /El Resumen del día solo enseña/);
    assert.doesNotMatch(source, /lo demás va detrás/);
    assert.doesNotMatch(source, /queda delante\. El resto sigue/);
    assert.doesNotMatch(source, /Puedes marcar varios\. El número es el orden/);
  }
  assert.doesNotMatch(appJs, /wizard-info-note/);
  assert.doesNotMatch(css, /wizard-info-note/);
});

test("v5.2: asistente sencillo con tarjetas, progreso y botones siempre visibles", () => {
  assert.match(indexHtml, /id="wizardProgress"/);
  assert.match(indexHtml, /class="wizard-foot"/);
  assert.match(appJs, /Toca en orden de prioridad/);
  assert.match(appJs, /class="tile /);
  assert.match(appJs, /tile-badge num/, "los tipos de información llevan su número de orden");
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
  const foot = css.slice(css.indexOf(".wizard-foot {"));
  assert.match(foot, /position: sticky/);
  assert.match(foot, /safe-area-inset-bottom/);
  // un título corto y, como mucho, una pista de pocas palabras por paso
  const wizard = appJs.slice(appJs.indexOf("const WIZARD = ["), appJs.indexOf("function renderWizard"));
  for (const [, lead] of wizard.matchAll(/lead: "([^"]*)"/g)) assert.ok(lead.split(/\s+/).filter(Boolean).length <= 5, lead);
});

test("el asistente no tiene textos fijos de sector o zona", () => {
  assert.doesNotMatch(appJs, /La agricultura queda delante/);
  assert.doesNotMatch(appJs, /Salamanca y Castilla y León, con secano y regadío/);
  assert.doesNotMatch(appJs, /Cereal, girasol y especies mejorantes vienen marcados/);
  assert.match(appJs, /openWizard\(\{ firstRun: true \}\)/, "solo se abre solo la primera vez");
  assert.match(appJs, /Cancelar y dejar como estaba/, "repasarlo después no borra lo elegido");
});

test("«Mis preferencias» incluye los tipos de información y la versión de caché sube", () => {
  assert.match(indexHtml, /id="infoChoices"/);
  assert.match(indexHtml, /Mis preferencias/);
  assert.match(indexHtml, /app\.js\?v=44/);
  assert.match(indexHtml, /styles\.css\?v=44/);
});

test("el resumen del día enseña solo los tipos elegidos, en su orden", () => {
  const all = [news, aidAgri, pac, norma];
  const groups = digestSelection(all, { info: ["ayudas", "pac"] });
  assert.deepEqual(groups.map((group) => group.id), ["ayudas", "pac"]);
  assert.deepEqual(groups.flatMap((group) => group.items.map((item) => item.id)), ["a", "p"]);
  const withNorma = digestSelection(all, { info: ["normativa", "ayudas"] });
  assert.deepEqual(withNorma.map((group) => [group.id, group.items.map((item) => item.id)]), [["normativa", ["n"]], ["ayudas", ["a"]]]);
  const fallback = digestSelection(all, { info: [] });
  assert.deepEqual(fallback.map((group) => group.id), ["ayudas", "pac"], "sin nada elegido, Ayudas y PAC");
  // una pieza con dos tipos va una sola vez, en el primero elegido
  const both = { id: "b", title: "Ayuda PAC", infoTypes: ["ayudas", "pac"], url: "https://x" };
  const once = digestSelection([both], { info: ["pac", "ayudas"] });
  assert.deepEqual(once.map((group) => group.items.length), [1, 0]);
  // no se inventa ni se cambia nada: las piezas son las mismas
  assert.equal(groups[0].items[0], aidAgri);
});

test("el resumen usa la selección y dice qué se está mostrando", () => {
  const body = appJs.slice(appJs.indexOf("function digestData"), appJs.indexOf("function priorityStrip"));
  assert.match(body, /digestSelection\(/);
  assert.match(body, /Mostrando: /);
  assert.match(body, /Cambiar en Mis preferencias/);
  assert.match(body, /data-open-prefs/);
  assert.match(body, /hasSourceUrl/, "solo piezas con enlace oficial");
});

test("los textos de ayuda son discretos (clase hint)", () => {
  assert.match(indexHtml, /id="wizardLead" class="hint"/);
  assert.match(indexHtml, /id="prefsAccountNote" class="hint"/);
  const css = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
  const rule = css.slice(css.indexOf(".hint, .choice-block p .hint"));
  assert.match(rule, /font-weight: 400/);
  assert.match(rule, /color: var\(--muted\)/);
  assert.match(rule, /background: none/);
});
