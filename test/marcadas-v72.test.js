import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

test("v7.2 la ficha marcada es gris por defecto y la opción B apaga el texto", () => {
  assert.match(html, /document\.body\.classList\.add\("marked-a"\)/);
  assert.match(css, /\.card\.read,\s*\n\.np-news-item\.read,\s*\nbody\.marked-a \.card\.read,\s*\nbody\.marked-a \.np-news-item\.read \{[^}]*background: #ECECEC;[^}]*border: 1px solid #b5b5b5/);
  assert.match(css, /body\.marked-b \.card\.read h3,\s*\nbody\.marked-b \.card\.read h3 a,[\s\S]*color: #8a8a8a/);
  assert.match(css, /\.badge\.read-badge \{ background: #12704a/);
  assert.match(html, /styles\.css\?v=73/);
  assert.match(html, /app\.js\?v=73/);
});
