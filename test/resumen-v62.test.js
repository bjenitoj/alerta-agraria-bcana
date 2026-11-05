import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeDigest, mergeDigestLists } from "../lib/digest.js";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const days = new Function(`${appJs.slice(appJs.indexOf("function prevDay"), appJs.indexOf("/** Número para el botón «Resumen»"))}; return { prevDay, digestDays };`)();

test("v6.2 Resumen: el desplegable ofrece siempre hoy y el día anterior", () => {
  assert.equal(days.prevDay("2026-11-04"), "2026-11-03");
  assert.equal(days.prevDay("2026-03-01"), "2026-02-28");
  assert.deepEqual(days.digestDays([{ date: "2026-11-04" }], "2026-11-04"), ["2026-11-04", "2026-11-03"]);
  assert.deepEqual(days.digestDays([], "2026-11-04"), ["2026-11-04", "2026-11-03"]);
  assert.deepEqual(days.digestDays([{ date: "2026-11-04" }, { date: "2026-10-30" }], "2026-11-04"), ["2026-11-04", "2026-11-03", "2026-10-30"]);
  assert.match(appJs, /digestDays\(digests\)\s*\n?\s*\.map\(\(day\) => `<option value/);
});

test("v6.2 Resumen: día sin resumen guardado = vacío con «Ese día no hubo novedades.»", () => {
  assert.match(appJs, /\{ date, items: \[\], missing: true \}/);
  assert.match(appJs, /current\.missing \|\| !\(current\.items \|\| \[\]\)\.length \? "Ese día no hubo novedades\." : "No hay novedades que mostrar\."/);
});

test("v6.2 Resumen: fuera la frase de los filtros y el «no había un día anterior»", () => {
  assert.doesNotMatch(appJs, /pero no se ven con los filtros de ahora/);
  const first = composeDigest([], [{ id: "a", title: "Ayuda 2026", sourceId: "bdns", url: "https://x" }], new Date("2026-11-04T10:00:00Z"));
  assert.doesNotMatch(first.notice, /no había un día anterior/);
  assert.match(first.notice, /^Primer resumen guardado/);
  assert.equal(composeDigest([], [], new Date("2026-11-04T10:00:00Z")).notice, "Ese día no hubo novedades.");
});

test("v6.2 Resumen: se conservan hoy y el día anterior al guardar", () => {
  const prev = { date: "2026-11-03", items: [], updatedAt: "2026-11-03T20:00:00Z" };
  const today = composeDigest([prev], [], new Date("2026-11-04T10:00:00Z"));
  const list = mergeDigestLists([prev], [today]);
  assert.deepEqual(list.map((d) => d.date), ["2026-11-04", "2026-11-03"]);
});

test("v6.2 caché v=57", () => {
  assert.match(indexHtml, /app\.js\?v=57/);
});
