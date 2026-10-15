// Renders preview.html with headless Edge (falls back to Chrome) over CDP.
// Outputs: preview.png (1440 wide, full page), preview-phone-390.png (mock placement at 390 CSS px, DPR 2),
// and per-concept crops concept-{a..d}.png used for legibility review.
import {spawn} from "node:child_process";
import {writeFileSync, existsSync, mkdtempSync} from "node:fs";
import {join, dirname} from "node:path";
import {tmpdir} from "node:os";
import {fileURLToPath, pathToFileURL} from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
const BIN = BROWSERS.find(p => existsSync(p));
const PORT = Number(process.env.CDP_PORT || 9361);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGE = pathToFileURL(join(OUT, "preview.html")).href;

const proc = spawn(BIN, ["--headless=new", `--remote-debugging-port=${PORT}`, "--hide-scrollbars", "--allow-file-access-from-files",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "vip-icons-"))}`, "about:blank"], {stdio: "ignore"});

async function target() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const info = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, {method: "PUT"})).json();
      const ws = new WebSocket(info.webSocketDebuggerUrl);
      await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
      let id = 0; const pending = new Map();
      ws.onmessage = m => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
      const send = (method, params = {}) => new Promise(ok => { const n = ++id; pending.set(n, ok); ws.send(JSON.stringify({id: n, method, params})); });
      return {send, close: () => ws.close()};
    } catch { await sleep(250); }
  }
  throw new Error("CDP not reachable");
}

const evalJs = async (t, expression) => (await t.send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true})).result?.result?.value;

async function load(t, url, width, dpr, mobile) {
  await t.send("Emulation.setDeviceMetricsOverride", {width, height: 900, deviceScaleFactor: dpr, mobile});
  await t.send("Page.navigate", {url});
  for (let i = 0; i < 60 && !(await evalJs(t, "window.__ready === true")); i += 1) await sleep(200);
  await sleep(300);
  const h = await evalJs(t, "Math.ceil(document.documentElement.scrollHeight)");
  await t.send("Emulation.setDeviceMetricsOverride", {width, height: h, deviceScaleFactor: dpr, mobile});
  await sleep(300);
  return h;
}

async function shot(t, file, clip) {
  const r = await t.send("Page.captureScreenshot", {format: "png", ...(clip ? {clip: {...clip, scale: 1}} : {})});
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, "base64"));
  console.log("wrote", file);
}

try {
  const t = await target();
  await t.send("Page.enable"); await t.send("Runtime.enable");
  await load(t, PAGE, 1440, 1, false);
  await shot(t, "preview.png");
  for (const k of ["a", "b", "c", "d"]) {
    const box = await evalJs(t, `(() => { const r = document.getElementById("concept-${k}").getBoundingClientRect(); return {x: 0, y: r.top + scrollY, width: 1440, height: r.height}; })()`);
    await shot(t, `concept-${k}.png`, box);
  }
  const mock = await evalJs(t, `(() => { const r = document.getElementById("mock").getBoundingClientRect(); return {x: 0, y: r.top + scrollY, width: 1440, height: r.height}; })()`);
  await shot(t, "mock-desktop.png", mock);
  await load(t, PAGE + "?view=mock", 390, 2, true);
  await shot(t, "preview-phone-390.png");
  t.close();
} finally {
  proc.kill();
}
