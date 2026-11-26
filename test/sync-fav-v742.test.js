import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { FAV_EPOCH, mergeSync } from "../lib/sync.js";

const appJs = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const fav = (id, savedAt) => ({ id, url: "https://www.boe.es/diario/" + id, title: "Ayuda " + id, savedAt });

test("v7.4.2 A quita la favorita y B sincroniza con la antigua: no vuelve en ninguno", () => {
  const removedAt = "2026-11-26T12:00:00.000Z";
  const deviceA = { favorites: {}, favoriteRemoved: { n1: removedAt }, deleted: {} };
  const deviceB = { favorites: { n1: fav("n1", "2026-11-26T10:00:00.000Z") }, favoriteRemoved: {}, deleted: {} };
  const onA = mergeSync(deviceA, deviceB);
  const onB = mergeSync(deviceB, onA);
  assert.equal(onA.favorites.n1, undefined);
  assert.equal(onB.favorites.n1, undefined);
  assert.equal(onA.favoriteRemoved.n1, removedAt);
  assert.equal(onB.favoriteRemoved.n1, removedAt);
});

test("v7.4.2 volver a marcar la favorita después de quitarla gana", () => {
  const deviceA = { favorites: { n1: fav("n1", "2026-11-26T13:00:00.000Z") }, favoriteRemoved: {} };
  const deviceB = { favorites: {}, favoriteRemoved: { n1: "2026-11-26T12:00:00.000Z" } };
  const merged = mergeSync(deviceA, deviceB);
  assert.equal(merged.favorites.n1.savedAt, "2026-11-26T13:00:00.000Z");
  assert.equal(merged.favoriteRemoved.n1, undefined);
});

test("v7.4.2 borrar una favorita no la trae de vuelta el otro aparato", () => {
  const deviceA = {
    favorites: {},
    favoriteRemoved: { n1: "2026-11-26T12:00:00.000Z" },
    deleted: { "id:n1": "2026-11-26T12:00:00.000Z" },
  };
  const deviceB = { favorites: { n1: fav("n1", "2026-11-26T10:00:00.000Z") }, favoriteRemoved: {}, deleted: {} };
  const merged = mergeSync(deviceA, deviceB);
  assert.equal(merged.favorites.n1, undefined);
  assert.equal(merged.deleted["id:n1"], "2026-11-26T12:00:00.000Z");
  const back = mergeSync(deviceB, merged);
  assert.equal(back.favorites.n1, undefined);
});

test("v7.4.2 una favorita true o sin fecha se puede comparar y pierde ante la baja", () => {
  const kept = mergeSync({ favorites: { vieja: true } }, {});
  assert.equal(kept.favorites.vieja.savedAt, FAV_EPOCH);
  const removed = mergeSync(
    { favorites: { vieja: true, suelta: { id: "suelta", url: "https://www.boe.es/suelta", title: "Suelta" } } },
    { favoriteRemoved: { vieja: "2026-11-26T12:00:00.000Z", suelta: "2026-11-26T12:00:00.000Z" } }
  );
  assert.equal(removed.favorites.vieja, undefined);
  assert.equal(removed.favorites.suelta, undefined);
});

test("v7.4.2 quitar, borrar y borrar marcadas dejan la baja de la favorita", () => {
  const toggle = appJs.slice(appJs.indexOf("function toggleFavorite"), appJs.indexOf("function findItem"));
  assert.match(toggle, /forgetFavorite\(id, item, now\)/);
  const trash = appJs.slice(appJs.indexOf("function trashCard"), appJs.indexOf("async function markCardRead"));
  assert.match(trash, /forgetFavorite\(id, item\)/);
  const bulk = appJs.slice(appJs.indexOf("function deleteReadItems"), appJs.indexOf("function undeleteKeys"));
  assert.match(bulk, /forgetFavorite\(item\.id, item, now\)/);
  const click = appJs.slice(appJs.indexOf('closest("[data-fav-delete]")'), appJs.indexOf('closest("[data-share]")'));
  assert.match(click, /forgetFavorite\(id, item\)/);
});
