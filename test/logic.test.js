import test from "node:test";
import assert from "node:assert/strict";
import { aidFromBdns, finalizeAid } from "../lib/aid.js";
import { composeDigest } from "../lib/digest.js";
import { compareItems, cropsIn, extractDeadline, waterOf } from "../lib/preferences.js";

const today = "2026-10-21";

test("lee un plazo en dos meses distintos", () => {
  const found = extractDeadline("El plazo de presentación de solicitudes será del 1 de febrero al 30 de abril de 2026.");
  assert.equal(found.opensAt, "2026-02-01");
  assert.equal(found.closesAt, "2026-04-30");
});

test("sin plazo de la BDNS ignora la fecha de fin", () => {
  const aid = finalizeAid(
    aidFromBdns({
      descripcion: "Ayuda de ejemplo",
      textInicio: "Sin plazo de solicitud",
      textFin: "Sin plazo de solicitud",
      fechaInicioSolicitud: "2026-01-01",
      fechaFinSolicitud: "2026-12-31",
      presupuestoTotal: 1,
      abierto: false,
    }),
    today
  );
  assert.equal(aid.closesAt, null);
  assert.equal(aid.opensAt, null);
  assert.equal(aid.status, "sin_plazo");
  assert.match(aid.amount, /Presupuesto total de la convocatoria: 1 €/);
});

test("marca secano y regadío solo si el texto lo dice", () => {
  assert.equal(waterOf("Válida en secano y en regadío."), "ambos");
  assert.equal(waterOf("Ayuda al cereal."), null);
  assert.deepEqual(cropsIn("Siembra de cereal, girasol y especies mejorantes."), ["cereal", "girasol", "mejorantes"]);
});

test("ordena antes la ayuda agraria que cierra pronto", () => {
  const aid = {
    title: "Ayuda al cereal",
    sectors: ["agricultura"],
    infoTypes: ["ayudas"],
    zone: "cyl",
    crops: ["cereal"],
    water: "secano",
    aid: { closesAt: "2026-10-28", status: "cierra_pronto" },
  };
  const news = {
    title: "Nota de pesca",
    sectors: ["pesca"],
    infoTypes: ["noticias"],
    zone: "nacional",
    crops: [],
    water: null,
    aid: {},
  };
  const prefs = { sector: "agricultura", zone: "mi-zona", water: ["secano", "regadio"], crops: ["cereal", "girasol", "mejorantes"], infoOrder: ["ayudas", "pac", "normativa", "alertas", "noticias"] };
  assert.ok(compareItems(aid, news, prefs, today) < 0);
});

test("el resumen del día siguiente solo añade ayudas nuevas", () => {
  const first = {
    id: "a",
    title: "Ayuda cereal",
    url: "https://ejemplo.test/a",
    sourceName: "BDNS",
    sectors: ["agricultura"],
    infoTypes: ["ayudas"],
    category: "ayudas_subvenciones",
    zone: "cyl",
    aid: { status: "abierta", closesAt: "2026-11-01" },
  };
  const second = { ...first, id: "b", title: "Ayuda girasol", url: "https://ejemplo.test/b" };
  const day1 = composeDigest([], [first], new Date("2026-10-20T10:00:00Z"));
  assert.equal(day1.baseline, true);
  assert.deepEqual(day1.items.map((item) => item.id), ["a"]);
  const day2 = composeDigest([day1], [first, second], new Date("2026-10-21T10:00:00Z"));
  assert.equal(day2.baseline, false);
  assert.deepEqual(day2.items.map((item) => item.id), ["b"]);
});
