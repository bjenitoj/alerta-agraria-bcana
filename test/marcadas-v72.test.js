import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

test("v7.2 la ficha marcada es gris por defecto y la opción B apaga el texto", () => {
  assert.match(html, /document\.body\.classList\.add\("marked-a"\)/);
  assert.match(css, /\.card\.read,\s*\n\.np-news-item\.read,\s*\nbody\.marked-a \.card\.read,\s*\nbody\.marked-a \.np-news-item\.read \{[^}]*background: #D6D6D6;[^}]*border: 1px solid #B5B5B5/);
  assert.match(css, /\.card\.read \.block,\s*\nbody\.marked-a \.card\.read \.block \{[^}]*background: #E2E2E2/);
  assert.match(css, /body\.marked-b \.card\.read h3,\s*\nbody\.marked-b \.card\.read h3 a,[\s\S]*color: #8a8a8a/);
  assert.match(css, /\.badge\.read-badge \{ background: #12704a/);
  assert.match(html, /styles\.css\?v=74/);
  assert.match(html, /app\.js\?v=74/);
  const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /function currentSectionItems\(\)/);
  assert.match(app.slice(app.indexOf("function deletableReadCount"), app.indexOf("function currentSectionItems")), /currentSectionItems\(\)\.filter/);
  assert.match(app.slice(app.indexOf("function clearRead"), app.indexOf("function shareItem")), /deleteReadItems\(shown\)/);
});
