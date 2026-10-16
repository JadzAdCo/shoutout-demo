// Verifies the Aurelia 3D demo in headless Chrome/Edge (CDP device emulation, SwiftShader WebGL) and writes screenshots.
// Usage (repo root): node reports/vip-aurelia-demo/tools/shoot.mjs
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, statSync} from "node:fs";
import {join, dirname, extname, normalize} from "node:path";
import {tmpdir} from "node:os";
import {fileURLToPath} from "node:url";

const DEMO = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(DEMO, "..", "..");
const OUT = join(DEMO, "screenshots");
const BROWSER = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
const CDP_PORT = Number(process.env.CDP_PORT || (9300 + Math.floor(Math.random() * 400))), HTTP_PORT = Number(process.env.HTTP_PORT || 8797);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPES = {".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png"};

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  let file = join(ROOT, path);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, {"Content-Type": TYPES[extname(file)] || "application/octet-stream"});
  res.end(readFileSync(file));
}).listen(HTTP_PORT, "127.0.0.1");
const URL_BASE = `http://127.0.0.1:${HTTP_PORT}/reports/vip-aurelia-demo/`;

async function target() {
  const info = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, {method: "PUT"})).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  let id = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200) || "exception");
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(String(msg.params.args?.[0]?.value || "console.error").slice(0, 200));
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push(`${msg.params.entry.text} ${msg.params.entry.url || ""}`.slice(0, 200));
  };
  const send = (method, params = {}) => new Promise(ok => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({id: i, method, params})); });
  const evaluate = async expression => (await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true})).result?.result?.value;
  return {send, evaluate, errors, close: async () => { ws.close(); await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${info.id}`); }};
}

const PROBE = `(() => {
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !el.closest("[hidden]"); };
  const ctl = [...document.querySelectorAll("button, .joystick")].filter(vis).map(el => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height); });
  const a = window.__aurelia || {};
  return {has3d: !!a.has3d, frames: a.scene ? a.scene.frames : 0, appErrors: (a.errors || []).length,
    minTap: ctl.length ? Math.round(Math.min(...ctl)) : null, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    sheet: !document.querySelector("#sheet").hidden, view: [...document.querySelectorAll(".views [aria-pressed=true]")].map(b => b.id).join(",")};
})()`;

const SHOTS = [
  {file: "3d-overview-1280.png", w: 1280, h: 800, steps: []},
  {file: "3d-area-vip-820.png", w: 820, h: 1100, steps: ["__aurelia.goArea('aurelia-area-c')"], wait: 2500},
  {file: "walk-1280.png", w: 1280, h: 800, steps: ["__aurelia.setView('walk')", "__aurelia.scene.nudgeWalk(1.6,'w')"], wait: 3000},
  {file: "sheet-1280.png", w: 1280, h: 800, steps: ["__aurelia.select('aurelia-b2')", "document.querySelector('#partyPlus').click()", "document.querySelector('#partyPlus').click()"], wait: 2500},
  {file: "held-1280.png", w: 1280, h: 800, steps: ["__aurelia.select('aurelia-v3')", "document.querySelector('#holdBtn').click()"], wait: 2500},
  {file: "2d-1280.png", w: 1280, h: 800, steps: ["__aurelia.setView('2d')", "__aurelia.select('aurelia-r3')"], wait: 1200},
  {file: "3d-overview-390.png", w: 390, h: 844, steps: []},
  {file: "sheet-390.png", w: 390, h: 844, steps: ["__aurelia.select('aurelia-aurelia-suite')", "document.querySelector('#partyPlus').click()"], wait: 2500},
  {file: "walk-390.png", w: 390, h: 844, steps: ["__aurelia.setView('walk')", "__aurelia.scene.setJoystick(0,-1)"], wait: 2200},
  {file: "2d-area-390.png", w: 390, h: 844, steps: ["__aurelia.setView('2d')", "__aurelia.goArea('aurelia-area-a')"], wait: 1200},
  {file: "list-390.png", w: 390, h: 844, steps: ["__aurelia.toggleList(true)"], wait: 800}
];

async function shoot(spec) {
  const t = await target();
  for (const d of ["Page.enable", "Runtime.enable", "Log.enable"]) await t.send(d);
  const phone = spec.w <= 600;
  await t.send("Emulation.setDeviceMetricsOverride", {width: spec.w, height: spec.h, deviceScaleFactor: phone ? 2 : 1, mobile: phone});
  if (phone) await t.send("Emulation.setTouchEmulationEnabled", {enabled: true, maxTouchPoints: 5});
  await t.send("Page.navigate", {url: URL_BASE});
  for (let i = 0; i < 60 && !(await t.evaluate("!!(window.__aurelia && window.__aurelia.ready)")); i++) await sleep(250);
  await sleep(2500);
  for (const step of spec.steps) { await t.evaluate(step); await sleep(300); }
  await sleep(spec.wait || 0);
  const probe = await t.evaluate(PROBE);
  const shot = await t.send("Page.captureScreenshot", {format: "png"});
  writeFileSync(join(OUT, spec.file), Buffer.from(shot.result.data, "base64"));
  await t.close();
  const errs = t.errors.length + (probe?.appErrors || 0);
  console.log(`${spec.file.padEnd(24)} ${String(spec.w).padStart(4)}px 3d=${probe?.has3d} frames=${probe?.frames} view=${probe?.view} sheet=${probe?.sheet} minTap=${probe?.minTap}px overflowX=${probe?.overflowX} errors=${errs}${t.errors[0] ? "  " + t.errors[0] : ""}`);
  return errs;
}

if (!BROWSER) throw new Error("Chrome or Edge not found");
mkdirSync(OUT, {recursive: true});
const profile = join(tmpdir(), `aurelia-shoot-${process.pid}-${CDP_PORT}`);
mkdirSync(profile, {recursive: true});
console.log(`browser=${BROWSER}\ncdp=127.0.0.1:${CDP_PORT}\nhttp=${URL_BASE}`);
const browser = spawn(BROWSER, ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, "--no-first-run",
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "about:blank"], {stdio: "ignore"});
for (let i = 0; i < 40; i++) {
  try { await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); break; } catch { await sleep(250); }
  if (i === 39) throw new Error(`Chrome CDP did not open on ${CDP_PORT}`);
}
let total = 0;
try {
  for (const s of SHOTS) total += await shoot(s);
} finally {
  browser.kill();
  server.close();
  await sleep(800);
  try { rmSync(profile, {recursive: true, force: true}); } catch { /* profile may still be locked */ }
}
console.log(`total console/app errors: ${total}`);
process.exit(total ? 1 : 0);
