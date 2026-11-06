import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isNuevaPacText,
  filterNuevaPacItems,
  buildStages,
  buildDocuments,
  foldDocumentsIntoNews,
  parseAgriNewsLinks,
  classifyNuevaPacType,
  miniSummaryFromOfficial,
  extractOfficialPage,
  enrichNewsItem,
  NUEVA_PAC_HUB,
  NUEVA_PAC_TYPES,
} from "../lib/nueva-pac.js";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");

test("v6.3: filtro Nueva PAC incluye reforma post-2027 y excluye convocatorias actuales", () => {
  assert.equal(isNuevaPacText("La PAC después de 2027 en el próximo presupuesto de la UE"), true);
  assert.equal(isNuevaPacText("Questions and answers on the CAP post-2027 proposal"), true);
  assert.equal(isNuevaPacText("Propuesta del marco financiero plurianual 2028-2034"), true);
  assert.equal(isNuevaPacText("Convocatoria de ayuda-2026-PEPAC COMUNITAT VALENCIANA-1463"), false);
  assert.equal(isNuevaPacText("IMCAP 2027: Subvenciones para acercar la PAC a los ciudadanos"), false);
  assert.equal(isNuevaPacText("Circular de coordinación 31/2026 Procedimiento PEPAC"), false);
  const kept = filterNuevaPacItems([
    { title: "CAP post-2027 proposal explained", url: "https://example/a", summary: "" },
    { title: "Convocatoria de ayuda PEPAC 2026", url: "https://example/b", summary: "" },
  ]);
  assert.equal(kept.length, 1);
});

test("v6.3: etapas — propuesta hecha el 16/07/2025 y negociación actual; cada una con enlace oficial", () => {
  const stages = buildStages(new Date("2026-11-05T12:00:00Z"));
  assert.equal(stages.find((s) => s.id === "propuesta").status, "hecho");
  assert.equal(stages.find((s) => s.id === "negociacion").status, "actual");
  assert.equal(stages.find((s) => s.id === "acuerdo").status, "pendiente");
  for (const stage of stages) {
    assert.match(stage.sourceUrl, /^https:\/\//);
    assert.ok(stage.sourceLabel);
  }
  assert.equal(stages.find((s) => s.id === "propuesta").sourceUrl.includes("ip_25_1847"), true);
  assert.equal(stages.find((s) => s.id === "negociacion").sourceUrl, NUEVA_PAC_HUB);
});

test("v6.3: documentos oficiales con URL https y hub PAC post-2027", () => {
  const docs = buildDocuments();
  assert.ok(docs.length >= 4);
  assert.ok(docs.some((d) => d.url === NUEVA_PAC_HUB));
  for (const doc of docs) assert.match(doc.url, /^https:\/\//);
});

test("v6.5: los documentos no se listan aparte; lo que no está en una noticia se engancha o entra como noticia sin resumen inventado", () => {
  const news = [
    { title: "La propuesta de la PAC 2028-2034 explicada: una ayuda a la renta más justa", url: "https://agriculture.ec.europa.eu/media/news/cap-2028-2034-proposal-explained-fairer-better-targeted-income-support-farmers-2025-11-10_es", sourceUrl: NUEVA_PAC_HUB, summary: "Texto oficial de la noticia." },
    { title: "Preguntas y respuestas sobre la propuesta de la PAC posterior a 2027", url: "https://agriculture.ec.europa.eu/media/news/questions-and-answers-cap-post-2027-proposal-2025-07-23_es", sourceUrl: NUEVA_PAC_HUB },
    { title: "Reforma de la PAC 2028-2034", url: "https://www.mapa.gob.es/es/pac/reforma-pac-2028-2034", sourceUrl: "https://www.mapa.gob.es/es/pac/reforma-pac-2028-2034" },
    { title: "MFP 2028-2034: el Consejo acuerda su posición negociadora", url: "https://www.consilium.europa.eu/es/press/press-releases/2026/10/26/mff-2028-2034-council-secures-negotiating-position-for-a-strong-and-future-oriented-common-agricultural-policy/", sourceUrl: "https://www.consilium.europa.eu/es/press/press-releases/" },
  ];
  const out = foldDocumentsIntoNews(news, buildDocuments());
  const urls = out.map((item) => item.url);
  assert.equal(urls.filter((url) => url.includes("questions-and-answers")).length, 1);
  assert.equal(urls.filter((url) => url.includes("reforma-pac-2028-2034")).length, 1);
  assert.equal(urls.filter((url) => url.includes("consilium.europa.eu")).length, 1);
  assert.ok(!urls.some((url) => url === NUEVA_PAC_HUB), "el hub ya es la fuente de las noticias");
  const press = out.find((item) => item.url.includes("ip_25_1847"));
  assert.ok(press);
  assert.equal(press.summary, "");
  assert.ok(press.related.some((rel) => rel.url.includes("eu-budget-2028-2034")));
  const explained = out.find((item) => item.url.includes("cap-2028-2034-proposal-explained"));
  assert.ok(explained.related.some((rel) => rel.url.includes("common-agricultural-policy")));
  assert.ok(explained.related.some((rel) => rel.url.includes("52025PC0560")));
  const ocm = out.find((item) => item.url.includes("52025PC0553"));
  assert.ok(ocm);
  assert.equal(ocm.summary, "");
  assert.equal(ocm.type, "Propuesta");
  const fn = appJs.slice(appJs.indexOf("function renderNuevaPac"), appJs.indexOf("function renderAlertas"));
  assert.doesNotMatch(fn, /Documentos oficiales/);
  assert.doesNotMatch(fn, /Fuentes oficiales previstas que ahora no responden/);
  assert.match(fn, /Solo fuentes oficiales\. Las convocatorias y pagos de la PAC en vigor siguen en Ayudas y en Calendario PAC\./);
  assert.match(fn, /Documento oficial:/);
  assert.match(fn, /Últimas noticias <span class="count">\(\$\{news\.length\}\)/);
});

test("v6.3: el parser de noticias DG AGRI saca enlaces /media/news/", () => {
  const html = `<a href="/media/news/questions-and-answers-cap-post-2027-proposal-2025-07-23_es">Preguntas y respuestas sobre la propuesta de la PAC posterior a 2027</a>
  <a href="/media/news/imcap-2027-eu-co-funding-grants-bring-cap-closer-citizens-2026-10-22_es">IMCAP 2027: Subvenciones para acercar la PAC a los ciudadanos</a>`;
  const raw = parseAgriNewsLinks(html);
  assert.equal(raw.length, 2);
  const kept = filterNuevaPacItems(raw);
  assert.equal(kept.length, 1);
  assert.match(kept[0].url, /cap-post-2027/);
  assert.equal(kept[0].date, "2025-07-23");
});

test("v6.3: pestaña Nueva PAC en la app, API y caché v=66", () => {
  assert.match(appJs, /\["nueva-pac", "Nueva PAC"\]/);
  assert.match(appJs, /function renderNuevaPac/);
  assert.match(appJs, /En qué punto está/);
  assert.match(appJs, /\/api\/nueva-pac/);
  assert.match(server, /\/api\/nueva-pac/);
  assert.match(server, /getNuevaPac/);
  assert.match(css, /\.np-stage/);
  assert.match(indexHtml, /app\.js\?v=66/);
  assert.match(indexHtml, /styles\.css\?v=66/);
});


test("v6.3: tipos Norma/Propuesta/Avance/Postura/Documento y resumen solo del texto oficial", async () => {
  assert.deepEqual(NUEVA_PAC_TYPES, ["Norma", "Propuesta", "Avance", "Postura", "Consulta", "Documento", "Otro"]);
  assert.equal(classifyNuevaPacType({ title: "Preguntas y respuestas sobre la propuesta de la PAC posterior a 2027", url: "https://agriculture.ec.europa.eu/media/news/x" }), "Documento");
  assert.equal(classifyNuevaPacType({ title: "Propuesta de Reglamento COM(2025) 560", url: "https://commission.europa.eu/publications/common-agricultural-policy_en" }), "Propuesta");
  assert.equal(classifyNuevaPacType({ title: "El Consejo acuerda su posición negociadora", url: "https://www.consilium.europa.eu/es/press/press-releases/2026/10/26/mff" }), "Avance");
  assert.equal(classifyNuevaPacType({ title: "Reforma de la PAC 2028-2034", url: "https://www.mapa.gob.es/es/pac/reforma-pac-2028-2034" }), "Postura");
  const sum = miniSummaryFromOfficial("Primera frase oficial del texto. Segunda frase también oficial. Tercera sobra.");
  assert.match(sum, /Primera frase oficial/);
  assert.match(sum, /Segunda frase también oficial/);
  assert.doesNotMatch(sum, /Tercera sobra/);
  const page = extractOfficialPage('<meta property="og:title" content="Título oficial"/><meta property="og:description" content="Descripción oficial de la página. Otra frase."/><time datetime="2025-07-16">16 de julio de 2025</time>');
  assert.equal(page.title, "Título oficial");
  assert.equal(page.date, "2025-07-16");
  assert.match(page.description, /Descripción oficial/);
  const summaries = {};
  const once = await enrichNewsItem(
    { title: "T", url: "https://example.test/a", summary: "Resumen oficial uno. Resumen oficial dos." },
    { name: "Fuente X", url: "https://example.test/" },
    summaries,
    async () => { throw new Error("no fetch"); }
  );
  assert.equal(once.type, "Otro");
  assert.equal(once.sourceUrl, "https://example.test/");
  assert.match(once.summary, /Resumen oficial uno/);
  assert.equal(summaries["https://example.test/a"], once.summary);
  const twice = await enrichNewsItem(
    { title: "T", url: "https://example.test/a", summary: "OTRO TEXTO QUE NO DEBE USARSE" },
    { name: "Fuente X", url: "https://example.test/" },
    summaries,
    async () => ({ text: "<html></html>" })
  );
  assert.equal(twice.summary, once.summary, "el resumen cacheado no se regenera");
});

test("v6.3: la ficha de noticia pinta tipo, fuente con enlace y resumen", () => {
  assert.match(appJs, /np-type/);
  assert.match(appJs, /np-summary/);
  assert.match(appJs, /Fuente: \$\{sourceLink\}/);
  assert.match(appJs, /item\.sourceUrl/);
});


test("v6.3: Favoritas entre Resumen y Herramientas, título sin «Mis»", () => {
  const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(indexHtml, /id="digestBtn"[\s\S]*id="favBtn"[\s\S]*id="toolsBtn"/);
  assert.match(indexHtml, /data-dock-proxy="digestBtn"[\s\S]*data-dock-proxy="favBtn"[\s\S]*data-dock-proxy="toolsBtn"/);
  assert.match(indexHtml, /<dt>Resumen<\/dt>[\s\S]*<dt>Favoritas<\/dt>[\s\S]*<dt>Herramientas<\/dt>/);
  assert.doesNotMatch(indexHtml, /Mis favoritas/);
  assert.match(appJs, /<h2>Favoritas <span>\(\$\{entries\.length\}\)<\/span><\/h2>/);
  assert.match(appJs, /function homeFavorites/);
  assert.match(appJs, /\$\{homeFavorites\(\)\}/);
  assert.match(appJs, /fieldStrip\(\)\}[\s\S]*homeFavorites\(\)[\s\S]*planStrip\(\)/);
  assert.match(indexHtml, /app\.js\?v=66/);
});
