import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaSectors, addMaterias } from "../lib/normativa.js";
import { CCAA, normalizePlace } from "../lib/places.js";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const block = appJs.slice(appJs.indexOf("function normaCcaa"), appJs.indexOf("/** Recuento de Normativa"));
const plainText = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const make = (sectors, place) => new Function("CCAA", "normalizePlace", "plainText", "prefs", "normativaData", "qEl", "inSector",
  `${block}; return { normaCcaa, normaInZone, normaType, normaGroups, vigentesFiltered };`)(
  CCAA, normalizePlace, plainText, { place }, { items: NORMAS }, null,
  (item) => (item.sectors || []).some((id) => sectors.includes(id)));

const N = (id, title, extra = {}) => ({ id, title, departamento: "Ministerio de Agricultura, Pesca y Alimentación", publishedAt: extra.publishedAt || "2024-01-01", sectors: normaSectors(title, extra.materias), ...extra });
const NORMAS = [
  N("p1", "Orden APA/827/2025, por la que se publican las nuevas relaciones de zonas de producción de moluscos y otros invertebrados marinos."),
  N("p2", "Real Decreto 1044/2022, de ordenación de la flota pesquera."),
  N("p3", "Orden APA/779/2025, por la que se establece una zona de veda en los montes coralinos de Cabliers.", { materias: ["Veda de pesca"] }),
  N("g1", "Real Decreto 95/2019, por el que se establecen las condiciones de contratación en el sector lácteo."),
  N("g2", "Orden APA/1082/2026, medidas específicas de protección en relación con la lengua azul.", { publishedAt: "2026-10-10" }),
  N("a1", "Real Decreto 1338/2018, por el que se regula el potencial de producción vitícola.", { publishedAt: "2018-10-30" }),
  N("a2", "Ley 8/2015, de 15 de octubre, del Estatuto de las Mujeres Agricultoras.", { publishedAt: "2015-10-16" }),
  N("c1", "Ley 5/2025, de 23 de diciembre, de medidas fiscales y administrativas.", { publishedAt: "2025-12-24" }),
  N("m1", "Real Decreto 69/2026, bienestar de los animales mantenidos con fines agrarios y para la acuicultura.", { publishedAt: "2026-02-05" }),
  N("r1", "Ley 7/2012, de 28 de junio, de montes de Galicia y de política agrícola.", { departamento: "Comunidad Autónoma de Galicia" }),
  N("r2", "Ley 1/2014, agraria de Castilla y León.", { departamento: "Comunidad de Castilla y León" }),
  N("x1", "Acuerdo de la Conferencia Sectorial de Agricultura.", { publishedAt: "2020-01-01" }),
];
const SAL = { country: "es", ccaa: ["es-cl"], province: ["37"], comarca: [] };

test("v6.2 normaSectors: título + materias oficiales del BOE; común = todos", () => {
  assert.deepEqual(normaSectors("Orden de zonas de producción de moluscos"), ["pesca"]);
  assert.deepEqual(normaSectors("Orden por la que se establece una zona de veda", ["Veda de pesca"]), ["pesca"]);
  assert.deepEqual(normaSectors("Real Decreto del sector lácteo"), ["ganaderia"]);
  assert.deepEqual(normaSectors("Ley del Estatuto de las Mujeres Agricultoras"), ["agricultura"]);
  assert.deepEqual(normaSectors("Real Decreto 1338/2018, potencial de producción vitícola"), ["agricultura"]);
  assert.deepEqual(normaSectors("Ley de medidas fiscales y administrativas"), ["agricultura", "ganaderia", "pesca"]);
});

test("v6.2 Normativa con solo Agricultura: sin normas de pesca ni de ganadería", () => {
  const f = make(["agricultura"], SAL).vigentesFiltered("");
  const ids = f.map((n) => n.id);
  for (const id of ["p1", "p2", "p3", "g1", "g2"]) assert.ok(!ids.includes(id), id);
  for (const id of ["a1", "a2", "c1", "m1", "r2"]) assert.ok(ids.includes(id), id);
  assert.ok(f.every((n) => n.sectors.includes("agricultura")));
});

test("v6.2 Normativa: zona por departamento oficial (comunidad solo si está elegida)", () => {
  const m = make(["agricultura"], SAL);
  assert.equal(m.normaCcaa(NORMAS.find((n) => n.id === "r1")), "es-ga");
  assert.equal(m.normaCcaa(NORMAS.find((n) => n.id === "a1")), null);
  const ids = m.vigentesFiltered("").map((n) => n.id);
  assert.ok(!ids.includes("r1") && ids.includes("r2"));
  const es = make(["agricultura"], { country: "es", ccaa: [], province: [], comarca: [] }).vigentesFiltered("").map((n) => n.id);
  assert.ok(!es.includes("r1") && !es.includes("r2") && es.includes("a1"));
});

test("v6.2 Normativa: grupos por tipo, en orden de rango, recientes arriba, solo los que tienen normas", () => {
  const m = make(["agricultura", "ganaderia", "pesca"], SAL);
  assert.equal(m.normaType({ title: "Reglamento de Ejecución (UE) 2023/1234 de la Comisión" }), "reglamento-ue");
  assert.equal(m.normaType({ title: "Directiva (UE) 2019/1152" }), "directiva-ue");
  assert.equal(m.normaType({ title: "Real Decreto-ley 4/2024, de 26 de junio" }), "rdl");
  assert.equal(m.normaType({ title: "Decreto 12/2020, de la Junta" }), "decreto");
  assert.equal(m.normaType({ title: "Resolución de 3 de marzo" }), "resolucion");
  assert.equal(m.normaType({ title: "Acuerdo de la Conferencia Sectorial" }), "otras");
  const groups = m.normaGroups(m.vigentesFiltered(""));
  assert.deepEqual(groups.map((g) => g.label), ["Leyes", "Reales Decretos", "Órdenes", "Otras"]);
  const leyes = groups[0].items.map((n) => n.publishedAt);
  assert.deepEqual(leyes, [...leyes].sort().reverse());
  assert.match(appJs, /<summary class="norma-band">\$\{normaIcon\(group\.id\)\}<span class="norma-band-name">\$\{escapeHtml\(group\.label\)\}<\/span> <span class="count">\(\$\{group\.items\.length\}\)<\/span>/);
});

test("v6.2 Normativa: recuento del chip y de Inicio con el filtro", () => {
  assert.match(appJs, /id === "normativa"\s*\n\s*\? normativaCount\(items\)/);
  assert.match(appJs, /const total = id === "normativa" \? normativaCount\(items\) : list\.length;/);
});

test("v6.2 addMaterias: lee las materias del BOE una vez y reutiliza las guardadas", async () => {
  let calls = 0;
  const items = [{ id: "A", title: "Orden por la que se establece una zona de veda" }, { id: "B", title: "Orden X" }];
  await addMaterias(items, [{ id: "B", materias: ["Viticultura"] }], async () => { calls++; return { data: [{ materias: [{ materia: { texto: "Veda de pesca" } }] }] }; });
  assert.equal(calls, 1);
  assert.deepEqual(items[0].sectors, ["pesca"]);
  assert.deepEqual(items[1].sectors, ["agricultura"]);
});

test("v6.2 normaSectors: el nombre del Ministerio de Agricultura, Pesca y Alimentación no hace la norma de pesca", () => {
  assert.deepEqual(normaSectors("Orden APA/1206/2020, Sistema Archivístico del Ministerio de Agricultura, Pesca y Alimentación."), ["agricultura", "ganaderia", "pesca"]);
  assert.deepEqual(normaSectors("Real Decreto del sector vitivinícola", ["Ministerio de Agricultura Pesca y Alimentación"]), ["agricultura"]);
});

test("v6.2 Normativa: banda plegable por tipo con su icono y su color; la primera abierta; sin variantes", () => {
  const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(appJs, /<details class="norma-fold t-\$\{group\.id\}"\$\{index === 0 \? " open" : ""\}>/);
  for (const id of ["reglamento-ue", "directiva-ue", "ley", "rdl", "rd", "orden", "decreto", "resolucion", "otras"]) assert.ok(appJs.includes(id === "reglamento-ue" || id === "directiva-ue" ? `"${id}": ` : `${id}: `), id);
  assert.match(css, /\.t-ley \{ --tc: #1b4332;/);
  assert.match(css, /\.t-rdl, \.t-rd \{ --tc: #9a3412;/);
  assert.match(css, /\.t-orden \{ --tc: #b45309;/);
  assert.match(css, /\.norma-band \{[^}]*background: linear-gradient\(90deg, var\(--tbg\)[^}]*color: var\(--tc\)/, "difuminada: tinte suave y texto del color del tipo");
  assert.doesNotMatch(css, /\.norma-band \{[^}]*background: var\(--tc\)/);
  assert.match(css, /\.norma-fold:not\(\[open\]\) \.norma-chev/);
  assert.doesNotMatch(appJs, /NORMA_VISTA|normas=|norma-pill|norma-tag/);
  assert.doesNotMatch(css, /norma-pill|norma-tag|norma-vista/);
});

test("v6.2: producción ganadera con «Seguro Agrario Combinado» es solo Ganadería; lo compartido sigue en Agricultura", () => {
  assert.deepEqual(normaSectors("Orden PRE/1459/2005, por la que se aprueba la norma general de peritación de los daños ocasionados sobre las producciones ganaderas, amparados por el Seguro Agrario Combinado.", ["Seguros agrarios combinados"]), ["ganaderia"]);
  assert.deepEqual(normaSectors("Orden PRE/1425/2014, por la que se aprueba la norma sectorial de peritación de daños ocasionados en las producciones ganaderas con registro individual", ["Seguros del campo"]), ["ganaderia"]);
  for (const t of [
    "Ley 1/2025, de 8 de enero, del Fondo Agrario y Ganadero.",
    "Real Decreto 66/2010, sobre la aplicación de los pagos directos a la agricultura y a la ganadería.",
    "Real Decreto 1054/2022, Sistema de información de explotaciones agrícolas y ganaderas",
    "Orden de peritación de daños en producciones agrícolas amparados por el Seguro Agrario Combinado",
  ]) assert.ok(normaSectors(t, []).includes("agricultura"), t);
});
