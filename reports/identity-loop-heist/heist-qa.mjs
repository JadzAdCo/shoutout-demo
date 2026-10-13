// Heist FloqR card QA: headless Chrome via CDP. For display.html + display2.html at 64x32 / 64x48 / 96x48, renders a
// Heist (Locked Up) ShoutOut with and without an opted-in @handle, screenshots at t≈1s / 7s / 13s / 19s, and samples the
// card every 500ms through the message window (before the HEIST brand slide) to prove every phase plays and the card
// never disappears.
// Usage: node heist-qa.mjs <label> <baseUrl> [caseFilterRegex]   (serve the repo with ../idle-fit-s3-1-40/serve.mjs)
import {spawn} from "node:child_process";
import {writeFileSync, mkdirSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const LABEL = process.argv[2] || "after";
const BASE = (process.argv[3] || "http://127.0.0.1:8765").replace(/\/$/, "");
const ONLY = process.argv[4] ? new RegExp(process.argv[4]) : null;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = Number(process.env.CDP_PORT || 9344);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = {"64x32": [416, 208], "64x48": [416, 312], "96x48": [624, 312]};
const VENUE = ["heist-washington-dc", "Heist Washington DC"];
const SHOTS = {2: "t1s", 14: "t7s", 26: "t13s", 38: "t19s"};
const LAST_SAMPLE = 47; // 23.5s: the 4-phase message window is 24s, then the HEIST brand slide

const base = size => ({locationName: VENUE[1], mainText: "CAUGHT RED HANDED", subText: "", template: "heistVaultNight", status: "preview", screenFormatId: `led-${size}`});
const SCENARIOS = {
  handle: size => ({...base(size), includeAttribution: true, attribution: "nyx.dc", attributionChoice: "instagram"}),
  nohandle: size => ({...base(size), includeAttribution: false, attribution: "", attributionChoice: "none"})
};

const SAMPLE = `(() => {
  const host = document.querySelector('.floqr-identity-card');
  const shell = host && host.querySelector('.classic-identity-shell');
  if (!host || !shell) return {present: false};
  let opacity = 1, el = shell, hidden = false;
  while (el && el.nodeType === 1) {
    const cs = getComputedStyle(el);
    opacity *= Number(cs.opacity);
    if (cs.display === 'none' || cs.visibility === 'hidden') hidden = true;
    el = el.parentElement;
  }
  const r = shell.getBoundingClientRect();
  return {present: true, opacity: Math.round(opacity * 1000) / 1000, hidden, w: Math.round(r.width), h: Math.round(r.height),
    phase: host.getAttribute('data-identity-phase'), phases: host.getAttribute('data-identity-phases'),
    text: shell.textContent.replace(/\\s+/g, ' ').trim()};
})()`;

async function cdpTarget() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, {method: "PUT"});
  const info = await res.json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  let id = 0; const pending = new Map(); const events = [];
  ws.onmessage = m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise(ok => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({id: i, method, params})); });
  return {send, events, close: async () => { ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${info.id}`); }};
}

const evalJs = async (t, expr) => {
  const r = await t.send("Runtime.evaluate", {expression: expr, returnByValue: true, awaitPromise: true});
  return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r;
};

async function shot(t, file) {
  const r = await t.send("Page.captureScreenshot", {format: "png"});
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, "base64"));
  return file;
}

async function runCase(c) {
  const [w, h] = SIZES[c.size];
  const t = await cdpTarget();
  await t.send("Page.enable"); await t.send("Runtime.enable");
  await t.send("Emulation.setDeviceMetricsOverride", {width: w, height: h, deviceScaleFactor: 1, mobile: false});
  await t.send("Page.navigate", {url: c.url});
  await sleep(7000);
  await evalJs(t, `(() => { window.renderShoutOutDisplay(${JSON.stringify(SCENARIOS[c.scenario](c.size))}); return true; })()`);
  const start = Date.now();
  const samples = [];
  const files = [];
  for (let i = 0; i <= LAST_SAMPLE; i += 1) {
    const due = start + i * 500;
    if (due > Date.now()) await sleep(due - Date.now());
    if (Date.now() - start > (LAST_SAMPLE * 500) + 100) break;
    const s = await evalJs(t, SAMPLE);
    samples.push({t: Math.round((Date.now() - start) / 100) / 10, ...s});
    if (SHOTS[i]) files.push(await shot(t, `${LABEL}-${c.name}-${SHOTS[i]}.png`));
  }
  const errors = t.events.filter(e => e.method === "Runtime.exceptionThrown").map(e => e.params.exceptionDetails?.exception?.description?.slice(0, 200));
  await t.close();
  const present = samples.filter(s => s.present);
  const minOpacity = present.length ? Math.min(...present.map(s => s.opacity)) : null;
  const order = present.map(s => s.text).filter((text, i, all) => i === 0 || text !== all[i - 1]);
  return {name: c.name, url: c.url, files, present: present.length, of: samples.length, minOpacity,
    everHidden: present.some(s => s.hidden), declaredPhases: present[0]?.phases ?? null, order,
    atShots: Object.keys(SHOTS).map(i => `${samples[i]?.t}s:${samples[i]?.text ?? "none"}`), errors,
    samples: samples.map(s => `${s.t}s ${s.present ? `${s.opacity} ${s.text}` : "none"}`)};
}

const cases = [];
for (const page of ["display", "display2"]) {
  for (const scenario of Object.keys(SCENARIOS)) {
    for (const size of Object.keys(SIZES)) {
      const params = new URLSearchParams({location: VENUE[0], preview: "1", screen: `led-${size}`});
      cases.push({name: `${page}-${scenario}-${size}`, url: `${BASE}/${page}.html?${params}`, size, scenario});
    }
  }
}

mkdirSync(OUT, {recursive: true});
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(OUT, `.chrome-profile-${LABEL}`)}`,
  "--no-first-run", "--hide-scrollbars", "--disable-gpu", "about:blank"], {stdio: "ignore"});
await sleep(2500);
const results = [];
try {
  for (const c of cases) {
    if (ONLY && !ONLY.test(c.name)) continue;
    try {
      const res = await runCase(c);
      results.push(res);
      console.log(`${c.name.padEnd(26)} present ${res.present}/${res.of} minOpacity=${res.minOpacity} hidden=${res.everHidden} phases=${res.declaredPhases} order=${JSON.stringify(res.order)}${res.errors.length ? " ERR " + res.errors[0] : ""}`);
    } catch (e) { results.push({name: c.name, error: String(e)}); console.log("fail", c.name, e); }
  }
} finally {
  writeFileSync(join(OUT, `results-${LABEL}.json`), JSON.stringify(results, null, 2));
  chrome.kill();
}
