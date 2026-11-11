import test from "node:test";
import assert from "node:assert/strict";
import { zoneOf } from "../lib/classify.js";
import { placeAllows } from "../lib/places.js";

const place = (ccaa = [], province = [], comarca = []) => ({ country: "es", ccaa, province, comarca });
const SAL = place(["es-cl"], ["37"], ["3704"]);
const SEV = place(["es-an"], ["41"]);
const AND = place(["es-an"]);
const GAL = place(["es-ga"], ["15"]);

test("v7.0 zoneOf: provincia antes que comunidad, y los alias de CyL se mantienen", () => {
  assert.equal(zoneOf("Ayuda en Salamanca"), "salamanca");
  assert.equal(zoneOf("Junta de Castilla y León. BOCyL"), "cyl");
  assert.equal(zoneOf("Ayuda en León, Castilla y León"), "24");
  assert.equal(zoneOf("Convocatoria en Sevilla, Andalucía"), "41");
  assert.equal(zoneOf("Consejería de Agricultura de Andalucía"), "es-an");
  assert.equal(zoneOf("Xunta de Galicia. Ayuda al viñedo"), "es-ga");
  assert.equal(zoneOf("Provincia de Lugo"), "27");
  assert.equal(zoneOf("Generalitat Valenciana"), "es-vc");
  assert.equal(zoneOf("Ayudas en la provincia de Valencia"), "46");
  assert.equal(zoneOf("Comunidad de Madrid"), "es-md");
  assert.equal(zoneOf("cultivo de granada en secano"), "nacional");
  assert.equal(zoneOf("Ayuda en Granada"), "18");
  assert.equal(zoneOf("Las Palmas. Plagas"), "35");
  assert.equal(zoneOf("Real Decreto del MAPA"), "nacional");
});

test("v7.0 placeAllows: de abajo arriba, sin provincias hermanas", () => {
  assert.equal(placeAllows("nacional", SAL), true);
  assert.equal(placeAllows("cyl", SAL), true);
  assert.equal(placeAllows("salamanca", SAL), true);
  assert.equal(placeAllows("37", SAL), true);
  assert.equal(placeAllows("49", SAL), false);
  assert.equal(placeAllows("41", SEV), true);
  assert.equal(placeAllows("es-an", SEV), true);
  assert.equal(placeAllows("29", SEV), false, "Málaga no sale a quien eligió Sevilla");
  assert.equal(placeAllows("41", AND), false, "la provincia no sale si solo se eligió la comunidad");
  assert.equal(placeAllows("es-an", AND), true);
  assert.equal(placeAllows("es-ga", SEV), false);
  assert.equal(placeAllows("15", GAL), true);
  assert.equal(placeAllows("27", GAL), false);
  assert.equal(placeAllows("salamanca", place()), false);
});
