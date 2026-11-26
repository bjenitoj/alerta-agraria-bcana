import { isSyncCode, normalizeSyncCode } from "./sync.js";
import { logSyncFailure, sanitizeSync } from "./sync-store.js";

const unavailable = { ok: false, error: "Sincronización no disponible todavía" };

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function fail(res, status, error) {
  send(res, status, { ok: false, error });
}

function dbError(res, error) {
  logSyncFailure(error);
  send(res, 500, { ok: false, error: "Error al sincronizar" });
}

/** Rutas de sincronización. No escribe el código en ningún registro. */
export function mountSyncRoutes(app, { store, allow }) {
  app.get("/api/sync/status", (req, res) => {
    if (!allow(req.ip)) return fail(res, 429, "Demasiadas peticiones");
    if (!store.available) return fail(res, 503, unavailable.error);
    send(res, 200, { ok: true, available: true });
  });

  app.get("/api/sync/:codigo", async (req, res) => {
    if (!allow(req.ip)) return fail(res, 429, "Demasiadas peticiones");
    if (!store.available) return fail(res, 503, unavailable.error);
    const code = normalizeSyncCode(req.params.codigo);
    if (!isSyncCode(code)) return fail(res, 400, "El código no es válido");
    try {
      const payload = await store.get(code);
      send(res, 200, { ok: true, payload });
    } catch (error) {
      dbError(res, error);
    }
  });

  app.put("/api/sync/:codigo", async (req, res) => {
    if (!allow(req.ip)) return fail(res, 429, "Demasiadas peticiones");
    if (!store.available) return fail(res, 503, unavailable.error);
    const code = normalizeSyncCode(req.params.codigo);
    if (!isSyncCode(code)) return fail(res, 400, "El código no es válido");
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const clean = sanitizeSync(body.payload || body);
      const current = await store.get(code);
      const base = body.baseUpdatedAt ? Date.parse(body.baseUpdatedAt) : NaN;
      if (current && Number.isFinite(base) && Date.parse(current.updatedAt) > base) {
        send(res, 409, { ok: false, error: "Hay una copia más nueva", payload: current });
        return;
      }
      const saved = await store.put(code, clean);
      send(res, 200, { ok: true, payload: saved });
    } catch (error) {
      if (error.status === 413) { fail(res, 413, "Demasiado grande"); return; }
      dbError(res, error);
    }
  });
}

export { normalizeSyncCode };
