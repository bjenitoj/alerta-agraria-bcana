import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isNotApplicableAid } from "../lib/classify.js";

const fuera = [
  "CONVENIO DE COLABORACIÓN ENTRE LA SOCIEDAD MUNICIPAL DE TURISMO, COMERCIO Y PROMOCIÓN ECONÓMICA DE SALAMANCA, S.A.U., Y LA EXCMA. DIPUTACIÓN PROVINCIAL DE SALAMANCA PARA LA COLABORACIÓN EN LA PROMOCIÓN DE LA FERIA DEL SECTOR AGROPECUARIO",
  "ANUNCIO de la Dirección General de Política Agraria Comunitaria, por el que se da publicidad a la relación de beneficiarios incluidos en la Resolución de 5 de octubre de 2026, por la que se acuerda la concesión de los pagos directos",
  "ANUNCIO de la Dirección General de la Industria y la Cadena Agroalimentarias, por el que se da publicidad a la relación de beneficiarios con Resolución de la Dirección General",
  "Real Decreto 922/2026, de 28 de octubre, por el que se establecen las normas reguladoras de la concesión directa de anticipos reembolsables en la forma de préstamos a la empresa Navantia, SA, SME",
  "ORDEN AGR/1095/2026, de 20 de octubre, por la que se conceden los premios a la excelencia del alumnado",
  "El Gobierno distribuye entre las comunidades autónomas fondos agrarios por 69,2 millones de euros",
  "Publicada una nueva relación provisional de las ayudas extraordinarias para compensar la pérdida de renta de las explotaciones agrarias",
  "ANUNCIO del Servicio Territorial de Agricultura de Ávila, relativo a la convocatoria de asamblea única para la elección de los miembros",
  "Corrección de errores de la Orden por la que se conceden las subvenciones a las cooperativas",
  "Resolución de concesión de las ayudas a la apicultura 2026",
];
const dentro = [
  "EXTRACTO de la Orden de 30 de junio de 2025, por la que se convocan ayudas a la modernización de explotaciones agrarias",
  "Orden por la que se establecen las bases reguladoras y convocatoria de subvenciones para la incorporación de jóvenes agricultores",
  "Corrección de errores de la Orden por la que se convocan ayudas a la ganadería extensiva",
  "Real Decreto 849/2026, por el que se regula la concesión directa de ayudas para apoyar a titulares de pólizas de seguros agrarios",
  "Ayuda básica a la renta para la sostenibilidad.",
  "Ayudas de incorporación",
];

test("v5.8 Ayudas: fuera convenios, listas de beneficiarios, concesiones ya dadas o nominativas", () => {
  for (const title of fuera) assert.equal(isNotApplicableAid(title), true, title);
});

test("v5.8 Ayudas: las convocatorias reales y las líneas PAC se quedan", () => {
  for (const title of dentro) assert.equal(isNotApplicableAid(title), false, title);
});

test("v5.8 el filtro va en el almacén: un solo cálculo para Ayudas, cuadros de Inicio y números", () => {
  const store = fs.readFileSync(new URL("../lib/store.js", import.meta.url), "utf8");
  assert.match(store, /\(item\.kind === "ayuda" \|\| item\.kind === "linea"\) && isNotApplicableAid\(item\.title\)\) return false/);
});
