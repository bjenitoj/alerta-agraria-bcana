import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAemet, parsePlagas, parseRasve, parseIncendios, ALERT_SOURCES } from "../lib/alerts.js";
import { referenceSources } from "../server.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJs = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
const now = new Date("2026-11-03T12:00:00Z");

test("v5.9 Alertas: AEMET lee los avisos del RSS público (sin clave) y salta el «Estado completo»", () => {
  const xml = `<rss><channel><item><title>Estado completo de avisos para Castilla y León</title><pubDate>2026-11-03T10:06:23+00:00</pubDate></item>
    <item><title>Aviso. Nivel amarillo. Temperaturas mínimas. Sanabria</title><description>Aviso de temperatura mínima</description><pubDate>2026-11-03T10:06:23+00:00</pubDate></item></channel></rss>`;
  const out = parseAemet(xml);
  assert.equal(out.length, 1);
  assert.equal(out[0].level, "amarillo");
  assert.equal(out[0].date, "2026-11-03");
  assert.match(out[0].url, /^https:\/\/www\.aemet\.es\//);
  assert.ok(ALERT_SOURCES.every((s) => !/api_key|opendata/i.test(s.feed)), "sin API de AEMET ni clave");
});

test("v5.9 Alertas: ITACyL plagas, RASVE e incendios con fecha y enlace oficial; lo viejo no sale", () => {
  const plagas = parsePlagas(`<a href="/-/252345-176?redirect=%2F">23 octubre de 2026 DETECCIÓN DE PULGUILLA EN COLZAS</a><a href="/-/1">26 agosto de 2026 VIEJO</a><a href="/x">Cereales</a>`, now);
  assert.deepEqual(plagas.map((p) => [p.date, p.title, p.url]), [["2026-10-23", "Detección de pulguilla en colzas", "https://plagas.itacyl.es/-/252345-176"]]);
  const rasve = parseRasve(`<h2>Listado de los 15 últimos focos</h2><table><tr><th>Foco</th><th>Enfermedad</th><th>Fecha de confirmación</th><th>CCAA</th><th>Provincia</th><th>Municipio</th></tr>
    <tr><td>2026/67</td><td>Peste porcina africana</td><td>27/10/2026</td><td>CATALUÑA</td><td>BARCELONA</td><td>Sant Quirze</td></tr>
    <tr><td>2026/1</td><td>Lengua azul</td><td>01/08/2026</td><td>CASTILLA Y LEÓN</td><td>SALAMANCA</td><td>X</td></tr></table>`, now);
  assert.equal(rasve.length, 1);
  assert.match(rasve[0].title, /^Peste porcina africana · Sant Quirze, BARCELONA, CATALUÑA$/);
  assert.throws(() => parseRasve("<html>cambiada</html>", now), /no trae la tabla/);
  const inc = parseIncendios(`<a href="https://bocyl.jcyl.es/b.pdf">RESOLUCIÓN de 27 de octubre de 2026, de la Dirección General, por la que se prolonga la declaración de época de peligro medio de incendios forestales</a><a href="/a.pdf">RESOLUCIÓN de 1 de septiembre de 2026, … alerta por peligro</a>`, now);
  assert.equal(inc.length, 1);
  assert.equal(inc[0].url, "https://bocyl.jcyl.es/b.pdf");
  assert.ok(referenceSources().some((s) => /RASVE/.test(s.name)), "/fuentes cita las fuentes de Alertas");
});

test("v5.9 Alertas: chip después de Precios, pantalla por fuente, sin repetir lo de otras secciones", () => {
  assert.match(appJs, /\["campo", "Precios"\],\n    \["alertas", "Alertas"\],\n    \["favoritas"/);
  assert.match(appJs, /alertas: tabIcon\(/);
  assert.match(appJs, /id === "alertas"\n\s+\? alertList\(items\)\.length/);
  assert.match(appJs, /else if \(active === "alertas"\) html = renderAlertas\(\);/);
  const fa = appJs.slice(appJs.indexOf("function officialAlerts"), appJs.indexOf("function alertList"));
  assert.match(fa, /filter\(inOtherSection\)/);
  assert.match(fa, /!urls\.has\(normUrl\(alert\.url\)\)/);
  assert.match(appJs, /Fuente oficial: <a href="\$\{escapeHtml\(group\.url\)\}"/);
  assert.match(appJs, /Ahora mismo no podemos leer esta fuente/);
});
