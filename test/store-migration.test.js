import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "data", "store.json");
const hasFixture = fs.existsSync(fixture);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alerta-store-"));
if (hasFixture) fs.copyFileSync(fixture, path.join(tmp, "store.json"));
process.env.DATA_DIR = tmp;

// data/store.json no va en el repositorio (.gitignore): sin él, esta prueba se salta.
const skip = hasFixture ? false : "falta data/store.json (no se sube al repositorio)";

test("conserva leídas, descartadas y admite el resumen", { skip }, async () => {
  const file = path.join(tmp, "store.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const originalDismissed = [...(raw.dismissedIds || [])];
  assert.ok(originalDismissed.length > 0);
  assert.ok(Array.isArray(raw.items) && raw.items.length > 0);
  raw.items[0].read = true;
  const keptId = raw.items[0].id;
  fs.writeFileSync(file, JSON.stringify(raw));

  const storeMod = await import("../lib/store.js");
  const loaded = storeMod.getStore();
  for (const key of originalDismissed) assert.ok(loaded.dismissedIds.includes(key));
  assert.ok(Array.isArray(loaded.digests));
  const kept = loaded.items.find((item) => item.id === keptId);
  assert.ok(kept);
  assert.equal(kept.read, true);

  const digest = storeMod.updateDailyDigest(loaded.items, new Date("2026-10-21T12:00:00Z"));
  assert.equal(digest.date, "2026-10-21");
  const again = storeMod.getStore();
  assert.ok(again.digests.some((entry) => entry.date === "2026-10-21"));
  assert.equal(again.items.find((item) => item.id === keptId).read, true);
});
