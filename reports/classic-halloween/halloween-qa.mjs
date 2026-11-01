// Classic Halloween visual QA: node reports/classic-halloween/halloween-qa.mjs [chromePath]
// Serves the repo, opens display.html preview at native LED pixels, saves board + finale stills, counts console errors.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const chrome = process.argv[2] || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 8791;
const DEBUG_PORT = 9341;
const TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".webp": "image/webp"};
const FORMATS = [
  {id: "led-96x48", w: 624, h: 312},
  {id: "led-64x48", w: 416, h: 312},
  {id: "led-64x32", w: 416, h: 208}
];
const MAIN = "HAPPY HALLOWEEN 🎃👻 NYX";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const file = path.join(root, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {"content-type": TYPES[path.extname(file)] || "application/octet-stream"});
  fs.createReadStream(file).pipe(res);
}).listen(PORT);

const profile = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "hw-qa-"));
const browser = spawn(chrome, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"], {stdio: "ignore"});

async function cdpTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find(t => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch (_) {}
    await sleep(250);
  }
  throw new Error("Chrome DevTools not reachable");
}

const ws = new WebSocket(await cdpTarget());
await new Promise(r => ws.addEventListener("open", r, {once: true}));
let seq = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map(a => a.value ?? a.description).join(" "));
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push(`${msg.params.entry.text} ${msg.params.entry.url || ""}`);
});
const send = (method, params = {}) => new Promise(resolve => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({id, method, params}));
});
await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");

async function shot(file) {
  const {result} = await send("Page.captureScreenshot", {format: "png"});
  fs.writeFileSync(path.join(here, file), Buffer.from(result.data, "base64"));
  return path.join(here, file);
}

const results = [];
for (const reduced of [false, true]) {
  await send("Emulation.setEmulatedMedia", {features: [{name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference"}]});
  for (const f of FORMATS) {
    if (reduced && f.id !== "led-96x48") continue;
    if (process.env.QA_ONLY && (reduced || f.id !== process.env.QA_ONLY)) continue;
    await send("Emulation.setDeviceMetricsOverride", {width: f.w, height: f.h, deviceScaleFactor: 2, mobile: false});
    const qs = new URLSearchParams({location: "zebbies-garden-washington-dc", template: "classicHalloween", main: MAIN, screen: f.id, attribution: "@nyx", includeAttribution: "1", attributionChoice: "instagram", preview: "1"});
    const before = errors.length;
    await send("Page.navigate", {url: `http://localhost:${PORT}/display.html?${qs}`});
    await sleep(1200);
    const tag = reduced ? `${f.id}-reduced-motion` : f.id;
    const files = [await shot(`${tag}-board-t1s.png`)];
    const probe = await send("Runtime.evaluate", {returnByValue: true, expression: `(() => {
      const c = document.getElementById("displayCanvas");
      const rows = [...document.querySelectorAll("#displayMain .classic-board-lines b")].map(b => b.textContent);
      const layers = ["#displayBackground", ".display-text-overlay", ".display-compose-slot", ".display-center"].map(sel => {
        const el = document.querySelector(sel);
        const cs = el && getComputedStyle(el);
        const r = el && el.getBoundingClientRect();
        return cs ? sel + " bg=" + cs.backgroundColor + " img=" + cs.backgroundImage.slice(-50) + " z=" + cs.zIndex + " op=" + cs.opacity + " disp=" + cs.display + " filter=" + cs.filter + " rect=" + Math.round(r.width) + "x" + Math.round(r.height) : sel + " missing";
      });
      return {classes: c.className, format: c.dataset.screenFormatId, rows, layers, finaleLayer: !!document.getElementById("displayHalloweenFinale"), card: document.getElementById("displaySub")?.textContent || ""};
    })()`});
    const started = Date.now();
    let playingAt = 0;
    while (Date.now() - started < 30000) {
      const s = await send("Runtime.evaluate", {returnByValue: true, expression: `!!document.querySelector("#displayHalloweenFinale.is-playing")`});
      if (s.result?.result?.value) { playingAt = Date.now() - started + 1200; break; }
      await sleep(100);
    }
    // Freeze every running animation at a fixed offset into the finale so stills do not depend on screenshot latency.
    const freeze = ms => send("Runtime.evaluate", {expression: `document.getAnimations().forEach(a => { a.pause(); a.currentTime = ${ms}; })`});
    await freeze(reduced ? 1500 : 1900);
    files.push(await shot(`${tag}-finale-a.png`));
    if (!reduced) {
      await freeze(3500);
      files.push(await shot(`${tag}-finale-b.png`));
    }
    await send("Runtime.evaluate", {expression: `document.getAnimations().forEach(a => a.play())`});
    const state = await send("Runtime.evaluate", {returnByValue: true, expression: `document.getElementById("displayHalloweenFinale")?.className || ""`});
    results.push({format: tag, probe: probe.result?.result?.value, finaleStartedAtMs: playingAt, finaleClassAfterShots: state.result?.result?.value, files, consoleErrors: errors.slice(before).filter(e => !/favicon\.ico/.test(e))});
  }
}

fs.writeFileSync(path.join(here, "qa-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
ws.close();
browser.kill();
server.close();
process.exit(0);
