// Screenshots preview.html at true phone / tablet / PC viewports (CDP device emulation, no server needed) and prints
// the smallest measured tap target in the current view. Usage: node reports/vip-floorplans/shoot.mjs
import {spawn} from "node:child_process";
import {existsSync, writeFileSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const BROWSER = BROWSERS.find(existsSync);
const PORT = Number(process.env.CDP_PORT || 9351);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = pathToFileURL(join(DIR, "preview.html")).href;

const SHOTS = [
  ["preview-lima-twist-390-area.png", 390, 844, "plan=lima-twist.json&area=lima-twist-area-d"],
  ["preview-lima-twist-390-overview.png", 390, 844, "plan=lima-twist.json&area=all"],
  ["preview-lima-twist-390-book.png", 390, 844, "plan=lima-twist.json&area=lima-twist-area-c&sel=lima-twist-402&party=6"],
  ["preview-lima-twist-820.png", 820, 1000, "plan=lima-twist.json&sel=lima-twist-305"],
  ["preview-lima-twist.png", 1280, 760, "plan=lima-twist.json&sel=lima-twist-305"],
  ["preview-decades-390-area.png", 390, 844, "plan=decades.json&area=decades-north-vip"],
  ["preview-decades-390-overview.png", 390, 844, "plan=decades.json&area=all"],
  ["preview-decades-820.png", 820, 1100, "plan=decades.json&sel=decades-c3"],
  ["preview-decades.png", 1280, 900, "plan=decades.json&sel=decades-c3"]
];

async function target() {
  const info = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, {method: "PUT"})).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200));
  };
  const send = (method, params = {}) => new Promise(ok => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({id: i, method, params})); });
  return {send, errors, close: async () => { ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${info.id}`); }};
}

const PROBE = `(() => ({tap: document.body.dataset.minTapPx || "?", mode: document.body.dataset.mode || "?",
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth}))()`;

async function shoot([file, w, h, query]) {
  const t = await target();
  await t.send("Page.enable");
  await t.send("Runtime.enable");
  const phone = w <= 600;
  await t.send("Emulation.setDeviceMetricsOverride", {width: w, height: h, deviceScaleFactor: 1, mobile: phone});
  if (phone) await t.send("Emulation.setTouchEmulationEnabled", {enabled: true, maxTouchPoints: 5});
  await t.send("Page.navigate", {url: `${BASE}?${query}`});
  await sleep(2500);
  const probe = (await t.send("Runtime.evaluate", {expression: PROBE, returnByValue: true})).result.result.value;
  const shot = await t.send("Page.captureScreenshot", {format: "png"});
  writeFileSync(join(DIR, file), Buffer.from(shot.result.data, "base64"));
  await t.close();
  console.log(`${file.padEnd(38)} ${String(w).padStart(5)}px  mode=${probe.mode.padEnd(22)} minTap=${probe.tap}px  overflowX=${probe.overflowX}px` +
    (t.errors.length ? `  ERR ${t.errors[0]}` : ""));
}

if (!BROWSER) throw new Error("Chrome or Edge not found");
const profile = join(DIR, ".shoot-profile");
const browser = spawn(BROWSER, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--disable-gpu", "--allow-file-access-from-files", "about:blank"], {stdio: "ignore"});
await sleep(2500);
try {
  for (const s of SHOTS) await shoot(s);
} finally {
  browser.kill();
  await sleep(800);
  try { rmSync(profile, {recursive: true, force: true}); } catch { /* profile files may still be locked */ }
}
