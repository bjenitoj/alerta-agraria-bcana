import { isSyncCode, normalizeSyncCode } from "./sync.js";
import { sanitizeSync } from "./sync-store.js";

const unavailable = { ok: false, error: "Sincronización no disponible todavía" };

function fail(res, status, error) {
  res.status(status).json({ ok: false, error });
}

/** Rutas de sincronización. No escribe el código en ningún registro. */
export function mountSyncRoutes(app, { store, allow }) {
  app.get("/api/sync/status", (req, res) => {
    if (!allow(req.ip)) return fail(res, 429, "Demasiadas peticiones");
    if (!store.available) return res.status(503).json(unavailable);
    res.json({ ok: true, available: true });
  });

  app.get("/api/sync/:codigo", async (req, res) => {
    if (!allow(req.ip)) return fail(res, 429, "Demasiadas peticiones");
    if (!store.available) return res.status(503).json(unavailable);
    const code = normalizeSyncCode(req.params.codigo);
    if (!isSyncCode(code)) return fail(res, 400, "El código no es válido");
    try {
      const payload = await store.get(code);
      res.json({ ok: true, payload });
    } catch {
      fail(res, 503, unavailable.error);
    }
  });

  app.put("/api/sync/:codigo", async (req, res) => {
    if (!allow(req.ip)) return fail(res, 429, "Demasiadas peticiones");
    if (!store.available) return res.status(503).json(unavailable);
    const code = normalizeSyncCode(req.params.codigo);
    if (!isSyncCode(code)) return fail(res, 400, "El código no es válido");
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const clean = sanitizeSync(body.payload || body);
      const current = await store.get(code);
      const base = body.baseUpdatedAt ? Date.parse(body.baseUpdatedAt) : NaN;
      if (current && Number.isFinite(base) && Date.parse(current.updatedAt) > base) {
        res.status(409).json({ ok: false, error: "Hay una copia más nueva", payload: current });
        return;
      }
      const saved = await store.put(code, clean);
      res.json({ ok: true, payload: saved });
    } catch (error) {
      fail(res, error.status || 400, error.status === 413 ? "Demasiado grande" : "No se ha podido guardar");
    }
  });
}

export { normalizeSyncCode };
