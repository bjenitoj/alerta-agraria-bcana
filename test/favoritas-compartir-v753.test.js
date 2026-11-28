import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const fn = (from, to) => appJs.slice(appJs.indexOf(`function ${from}`), appJs.indexOf(`function ${to}`));

test("v7.5.3 en Favoritas, Compartir está junto a Favorita y no hay papelera", () => {
  const card = fn("aidCard", "sortedItems");
  assert.match(card, /topActions\(item, \{ trash: !options\.inFavorites \}\)/);
  const top = fn("topActions", "calendarLink");
  assert.match(top, /options\.trash === false/);
  assert.match(top, /data-share=/);
  assert.match(top, /aria-label="Compartir"/);
  assert.match(top, /whatsappUrl\(item, today, appUrl\)/);
  const favBlock = appJs.slice(appJs.indexOf("function favoriteActions"), appJs.indexOf("function milestoneRow"));
  assert.doesNotMatch(favBlock, /data-trash/);
  assert.match(favBlock, /data-fav-delete=/);
});

test("v7.5.3 compartir llama al menú del sistema en el mismo toque y, si no, a WhatsApp", () => {
  const share = fn("shareItem", "aidCard");
  assert.match(share, /^function shareItem/);
  assert.doesNotMatch(share, /async function shareItem/);
  assert.match(share, /navigator\.share\(\{ title: title, text: title, url:/);
  assert.match(share, /window\.open\(button\.dataset\.wa, "_blank", "noopener"\)/);
  assert.match(fn("findItem", "field"), /Object\.values\(favorites\)/);
});

test("v7.5.3 «Revisar borradas (N)» es un botón como «Recuperar todas» y despliega la lista", () => {
  const sheet = indexHtml.slice(indexHtml.indexOf('id="acc-leidas"'), indexHtml.indexOf('id="acc-sync"'));
  assert.match(sheet, /id="reviewDeleted" class="ghost"[^>]*>Revisar borradas \(0\)<\/button>/);
  assert.match(sheet, /id="restoreDeleted" class="ghost"/);
  assert.match(sheet, /id="deletedList" class="deleted-list" hidden/);
  assert.doesNotMatch(sheet, /<details|<summary/);
  assert.match(appJs, /Revisar borradas \(\$\{rows\.length\}\)/);
  assert.match(appJs, /list\.hidden = !open/);
  assert.match(appJs, /aria-expanded", open \? "true" : "false"/);
  assert.match(indexHtml, /app\.js\?v=85/);
  assert.match(indexHtml, /styles\.css\?v=85/);
});
