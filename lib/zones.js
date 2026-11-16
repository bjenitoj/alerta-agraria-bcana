// v7.0 · Zona de una pieza en toda España.
// Prioridad: provincia (código INE, o el alias «salamanca») > comunidad > nacional.
// «cyl» sigue siendo el alias de Castilla y León cuando el texto no nombra una provincia.
// No se inventa ninguna comarca: solo nombres de provincia, de comunidad y siglas de boletín.

const MASKS = [
  /castilla y le[oó]n/gi,
  /castilla[-\s]la mancha/gi,
  /comunidad de madrid/gi,
  /comunidad valenciana|comunitat valenciana|generalitat valenciana/gi,
  /regi[oó]n de murcia/gi,
  /principado de asturias/gi,
];

/** Provincias. El id «salamanca» se conserva: es el alias histórico de la 37. Granada solo con mayúscula (la fruta no). */
const PROVINCES = [
  { id: "38", re: /\bSanta Cruz de Tenerife\b/i },
  { id: "35", re: /\bLas Palmas\b/i },
  { id: "15", re: /\bA Coruña\b|\bLa Coruña\b|\bCoruña\b/i },
  { id: "03", re: /\bAlicante\b|\bAlacant\b/i },
  { id: "12", re: /\bCastell[oó]n\b|\bCastelló\b/i },
  { id: "46", re: /\bValencia\b|\bValència\b/i },
  { id: "salamanca", re: /\bSalamanca\b/i },
  { id: "24", re: /\bLe[oó]n\b/i },
  { id: "09", re: /\bBurgos\b/i },
  { id: "34", re: /\bPalencia\b/i },
  { id: "40", re: /\bSegovia\b/i },
  { id: "42", re: /\bSoria\b/i },
  { id: "47", re: /\bValladolid\b/i },
  { id: "49", re: /\bZamora\b/i },
  { id: "05", re: /\b[ÁA]vila\b/i },
  { id: "04", re: /\bAlmer[ií]a\b/i },
  { id: "11", re: /\bC[aá]diz\b/i },
  { id: "14", re: /\bC[oó]rdoba\b/i },
  { id: "18", re: /\bGranada\b/ },
  { id: "21", re: /\bHuelva\b/i },
  { id: "23", re: /\bJa[eé]n\b/i },
  { id: "29", re: /\bM[aá]laga\b/i },
  { id: "41", re: /\bSevilla\b/i },
  { id: "22", re: /\bHuesca\b/i },
  { id: "44", re: /\bTeruel\b/i },
  { id: "50", re: /\bZaragoza\b/i },
  { id: "02", re: /\bAlbacete\b/i },
  { id: "13", re: /\bCiudad Real\b/i },
  { id: "16", re: /\bCuenca\b/i },
  { id: "19", re: /\bGuadalajara\b/i },
  { id: "45", re: /\bToledo\b/i },
  { id: "08", re: /\bBarcelona\b/i },
  { id: "17", re: /\bGirona\b|\bGerona\b/i },
  { id: "25", re: /\bLleida\b|\bL[eé]rida\b/i },
  { id: "43", re: /\bTarragona\b/i },
  { id: "06", re: /\bBadajoz\b/i },
  { id: "10", re: /\bC[aá]ceres\b/i },
  { id: "27", re: /\bLugo\b/i },
  { id: "32", re: /\bOurense\b|\bOrense\b/i },
  { id: "36", re: /\bPontevedra\b/i },
  { id: "01", re: /\b[ÁA]lava\b|\bAraba\b/i },
  { id: "48", re: /\bBizkaia\b|\bVizcaya\b/i },
  { id: "20", re: /\bGipuzkoa\b|\bGuip[uú]zcoa\b/i },
  { id: "28", re: /\bMadrid\b/i },
];

const COMMUNITIES = [
  { id: "es-an", re: /andaluc[ií]a|\bBOJA\b/i },
  { id: "es-ar", re: /\barag[oó]n\b/i },
  { id: "es-as", re: /\basturias\b|\bBOPA\b/i },
  { id: "es-ib", re: /\bbaleares\b|\billes balears\b|\bBOIB\b/i },
  { id: "es-cn", re: /\bcanarias\b/i },
  { id: "es-cb", re: /\bcantabria\b/i },
  { id: "es-cm", re: /castilla[-\s]la mancha|\bDOCM\b/i },
  { id: "es-ct", re: /catalu[nñ]a|catalunya|generalitat de catal|\bDOGC\b/i },
  { id: "es-vc", re: /comunidad valenciana|comunitat valenciana|generalitat valenciana|\bDOGV\b|\bDOCV\b/i },
  { id: "es-ex", re: /\bextremadura\b/i },
  { id: "es-ga", re: /\bgalicia\b|xunta de galicia/i },
  { id: "es-md", re: /comunidad de madrid|\bBOCM\b/i },
  { id: "es-mc", re: /regi[oó]n de murcia|\bmurcia\b|\bBORM\b/i },
  { id: "es-nc", re: /\bnavarra\b|nafarroa/i },
  { id: "es-pv", re: /pa[ií]s vasco|\beuskadi\b|\bBOPV\b/i },
  { id: "es-ri", re: /\bla rioja\b/i },
  { id: "es-ce", re: /\bceuta\b|\bBOCCE\b/i },
  { id: "es-ml", re: /\bmelilla\b|\bBOME\b/i },
];

function masked(text) {
  let out = String(text || "");
  for (const re of MASKS) out = out.replace(re, " ");
  return out;
}

/** @returns {"salamanca"|string} código INE, alias salamanca, id de CCAA, «cyl» o «nacional». */
export function zoneOfSpain(text = "") {
  const original = String(text || "");
  const body = masked(original);
  for (const rule of PROVINCES) {
    const source = rule.id === "18" ? body : body;
    if (rule.re.test(rule.id === "18" ? original.replace(/castilla y le[oó]n/gi, " ") : source)) return rule.id;
  }
  if (/castilla y le[oó]n|junta de castilla|\bjcyl\b|\bbocyl\b/i.test(original)) return "cyl";
  for (const rule of COMMUNITIES) if (rule.re.test(original)) return rule.id;
  return "nacional";
}

export const ZONE_ALIAS = { cyl: "es-cl", salamanca: "37", "es-cl-sa": "37" };

export function canonicalZone(zone) {
  return ZONE_ALIAS[zone] || zone || "nacional";
}
