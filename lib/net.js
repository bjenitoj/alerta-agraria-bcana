import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fnmtPath = path.join(__dirname, "..", "certs", "fnmt-raiz-servidores-seguros-g2r.pem");
const extraCa = fs.readFileSync(fnmtPath, "utf8");

const agent = new https.Agent({
  ca: [...tls.rootCertificates, extraCa],
  keepAlive: true,
  minVersion: "TLSv1.2",
});

export const USER_AGENT = "AlertaAgrariaCyL/1.0 (consulta personal de novedades agrarias oficiales)";

function requestOnce(url, { method, headers, body, timeout }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request(
      target,
      {
        method,
        agent,
        headers,
        timeout,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            buf: Buffer.concat(chunks),
            finalUrl: target.href,
          });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Tiempo de espera agotado")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function fetchBuffer(url, options = {}) {
  const method = options.method || "GET";
  const timeout = options.timeout || 25000;
  let current = url;
  let currentMethod = method;
  let body = options.body;
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "identity",
    ...(options.headers || {}),
  };
  for (let hop = 0; hop < 6; hop += 1) {
    const res = await requestOnce(current, { method: currentMethod, headers, body, timeout });
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      current = new URL(res.headers.location, current).href;
      currentMethod = "GET";
      body = undefined;
      continue;
    }
    if (res.status >= 400) {
      const error = new Error(`HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return { buf: res.buf, ct: String(res.headers["content-type"] || ""), finalUrl: current };
  }
  throw new Error("Demasiadas redirecciones");
}

export async function fetchText(url, options = {}) {
  const { buf, ct, finalUrl } = await fetchBuffer(url, options);
  const text = /iso-8859-1|latin-1/i.test(ct) || /boe\.es\/rss/i.test(url) ? buf.toString("latin1") : buf.toString("utf8");
  return { text, ct, finalUrl };
}

export async function fetchJson(url, options = {}) {
  const { text } = await fetchText(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  if (text.trim().startsWith("<")) throw new Error("La API devolvió HTML en lugar de JSON");
  return JSON.parse(text);
}
