import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL_FILE = path.join(__dirname, "..", "data", "public-url.json");

let publicUrl = readSavedUrl();

function readSavedUrl() {
  try {
    const data = JSON.parse(fs.readFileSync(URL_FILE, "utf8"));
    return data.url || null;
  } catch {
    return null;
  }
}

function findCloudflared() {
  const extra = [
    process.env.CLOUDFLARED,
    path.join(process.env.ProgramFiles || "C:\\Program Files", "cloudflared", "cloudflared.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "cloudflared", "cloudflared.exe"),
    path.join(os.homedir(), "AppData", "Local", "cloudflared", "cloudflared.exe"),
  ].filter(Boolean);
  for (const candidate of extra) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "cloudflared";
}

function writeLinkFiles(url) {
  const text = [
    "Alerta Agraria Castilla y Leon",
    url,
    "",
    "Abre este enlace en el PC, iPhone o iPad, con Wi-Fi o con datos.",
    "El ordenador tiene que estar encendido y la aplicacion en marcha.",
    "En Safari: Compartir > Anadir a pantalla de inicio.",
    "No compartas este enlace: quien lo tenga puede ver y borrar noticias.",
    "",
  ].join("\n");
  const targets = [
    path.join(__dirname, "..", "Enlace iPhone iPad.txt"),
    path.join(os.homedir(), "Desktop", "Enlace iPhone iPad.txt"),
    path.join(os.homedir(), "OneDrive", "Desktop", "Enlace iPhone iPad.txt"),
  ];
  for (const folder of [
    path.join(os.homedir(), "iCloudDrive"),
    path.join(os.homedir(), "iCloud Drive"),
  ]) {
    if (fs.existsSync(folder)) targets.push(path.join(folder, "Enlace iPhone iPad.txt"));
  }
  for (const file of targets) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text, "utf8");
    } catch {
      /* ignore */
    }
  }
}

function saveUrl(url) {
  publicUrl = url;
  fs.mkdirSync(path.dirname(URL_FILE), { recursive: true });
  fs.writeFileSync(URL_FILE, JSON.stringify({ url, savedAt: new Date().toISOString() }, null, 2), "utf8");
  writeLinkFiles(url);
  console.log("[alerta] Enlace de internet: " + url);
}

export function getPublicUrl() {
  return publicUrl || readSavedUrl();
}

export function startPublicTunnel(port) {
  const bin = findCloudflared();
  const child = spawn(bin, ["tunnel", "--url", "http://127.0.0.1:" + port, "--no-autoupdate"], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const look = (buf) => {
    const match = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match) saveUrl(match[0]);
  };
  child.stdout.on("data", look);
  child.stderr.on("data", look);
  child.on("error", (err) => {
    console.error("[alerta] No se pudo abrir el enlace de internet:", err.message);
  });
  child.on("exit", (code) => {
    if (code) console.error("[alerta] El tunel se cerro (" + code + ")");
  });
  return child;
}