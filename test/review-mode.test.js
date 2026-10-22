/**
 * Cartel «En revisión» (REVIEW_MODE): activo por defecto, se apaga con REVIEW_MODE=off/0/false.
 * Mientras está activo: cartel en todas las páginas públicas, noindex y robots.txt con Disallow.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alerta-review-"));
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = "session-secret-de-prueba-32";
fs.writeFileSync(path.join(tmp, "store.json"), JSON.stringify({ items: [], archive: [], digests: [], sources: {} }));

const { createApp, reviewModeOn, REVIEW_TEXT } = await import("../server.js");
const PAGES = ["/", "/herramientas", "/fuentes", "/aviso-legal", "/privacidad", "/cookies", "/quienes-somos", "/planes"];

async function withServer(reviewMode, fn) {
  const { app } = createApp({ reviewMode, pricesLoader: async () => { throw new Error("sin red en la prueba"); } });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test("REVIEW_MODE: activo por defecto y solo se apaga con off/0/false", () => {
  assert.equal(reviewModeOn(undefined), true);
  assert.equal(reviewModeOn(""), true);
  assert.equal(reviewModeOn("on"), true);
  assert.equal(reviewModeOn("1"), true);
  for (const value of ["off", "OFF", "0", "false", " False "]) assert.equal(reviewModeOn(value), false, value);
});

test("en revisión: cartel, noindex, X-Robots-Tag y robots.txt con Disallow", async () => {
  await withServer(true, async (base) => {
    for (const page of PAGES) {
      const res = await fetch(base + page);
      assert.equal(res.status, 200, page);
      assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow", page);
      const html = await res.text();
      assert.match(html, /<meta name="robots" content="noindex, nofollow"/, page);
      assert.match(html, /class="review-banner"/, page);
      assert.match(html, /Versión en revisión\./, page);
      assert.match(html, /consulta siempre la publicación oficial/, page);
    }
    const robots = await fetch(base + "/robots.txt");
    assert.equal(robots.status, 200);
    assert.match(await robots.text(), /^Disallow: \/$/m);
    const state = await (await fetch(base + "/api/state")).json();
    assert.equal(state.reviewMode, true);
    const api = await fetch(base + "/api/review");
    assert.equal(api.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.deepEqual(await api.json(), { reviewMode: true, text: REVIEW_TEXT });
  });
});

test("REVIEW_MODE=off: sin cartel, sin noindex y robots.txt con Allow", async () => {
  await withServer(false, async (base) => {
    for (const page of PAGES) {
      const res = await fetch(base + page);
      assert.equal(res.status, 200, page);
      assert.equal(res.headers.get("x-robots-tag"), null, page);
      const html = await res.text();
      assert.doesNotMatch(html, /noindex/, page);
      assert.doesNotMatch(html, /review-banner/, page);
    }
    const robots = await (await fetch(base + "/robots.txt")).text();
    assert.match(robots, /^Allow: \/$/m);
    assert.doesNotMatch(robots, /Disallow/);
    assert.equal((await (await fetch(base + "/api/state")).json()).reviewMode, false);
    assert.deepEqual(await (await fetch(base + "/api/review")).json(), { reviewMode: false, text: null });
  });
});

test("el cartel no contiene afirmaciones sobre los datos más allá del aviso", () => {
  assert.equal(REVIEW_TEXT, "Versión en revisión. Estamos comprobando los datos; consulta siempre la publicación oficial.");
});
