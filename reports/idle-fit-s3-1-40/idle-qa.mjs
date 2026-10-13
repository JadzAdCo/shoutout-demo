// Idle board QA: headless Chrome via CDP. Renders the idle payload (status default, idleCta) on display.html and
// display2.html at every native board size + a 1920x1080 Xibo viewport, measures fit, writes PNGs + results JSON.
// Usage: node idle-qa.mjs <label> <baseUrl> [caseFilterRegex]
//   label "after"  base http://127.0.0.1:8765          (local workspace)
//   label "live"   base https://jadzadco.github.io/shoutout-demo
import {spawn} from "node:child_process";
import {writeFileSync, mkdirSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const LABEL = process.argv[2] || "after";
const BASE = (process.argv[3] || "http://127.0.0.1:8765").replace(/\/$/, "");
const ONLY = process.argv[4] ? new RegExp(process.argv[4]) : null;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = Number(process.env.CDP_PORT || 9341);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SIZES = {"64x32": [416, 208], "64x48": [416, 312], "96x48": [624, 312], "xibo1080": [1920, 1080]};
const VENUES = [
  ["default", "", "Club"],
  ["zebbies", "zebbies-garden-washington-dc", "Zebbies Garden DC"],
  ["heist", "heist-washington-dc", "Heist Washington DC"],
  ["aurelia", "temp-democlub-1", "Aurelia (Demo Club)"]
];

const MEASURE = `(() => {
  const host = document.querySelector('.classic-board-lines');
  const rows = host ? [...host.children].map(b => {
    const run = b.querySelector(':scope > .board-fit-run');
    const rr = run && run.getBoundingClientRect();
    return {text: b.textContent, fontPx: parseFloat(getComputedStyle(b).fontSize), runW: run && Math.round(run.offsetWidth), runH: run && Math.round(run.offsetHeight),
      rect: rr && {x: Math.round(rr.x), y: Math.round(rr.y), w: Math.round(rr.width), h: Math.round(rr.height)}};
  }) : [];
  const main = document.querySelector('#displayMain');
  const mr = main && main.getBoundingClientRect();
  const hr = host && host.getBoundingClientRect();
  const sup = [...document.querySelectorAll('.suprstar-idle-line, .suprstar-idle-note')].map(el => {
    const r = el.getBoundingClientRect();
    return {text: el.textContent, fontPx: parseFloat(getComputedStyle(el).fontSize), scrollW: el.scrollWidth, clientW: el.clientWidth, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right)};
  });
  const canvas = document.querySelector('#displayCanvas');
  const fontSizes = [...new Set(rows.map(r => r.fontPx))];
  const safe = mr && {x0: mr.x + mr.width * 0.04, x1: mr.right - mr.width * 0.04, y0: mr.y + mr.height * 0.06, y1: mr.bottom - mr.height * 0.06};
  const insideSafe = !!safe && rows.every(r => r.rect && r.rect.x >= safe.x0 - 1 && r.rect.x + r.rect.w <= safe.x1 + 1 && r.rect.y >= safe.y0 - 1 && r.rect.y + r.rect.h <= safe.y1 + 1);
  return {viewport: innerWidth + 'x' + innerHeight, canvasClass: canvas && canvas.className, format: canvas && canvas.getAttribute('data-screen-format-id'),
    idleClass: !!(canvas && canvas.classList.contains('classic-bw-idle')), text: rows.map(r => r.text).join(' / '), rows, fontSizes,
    uniform: fontSizes.length === 1, insideSafe, idleFitPx: host && host.getAttribute('data-idle-fit-px'),
    main: mr && {w: Math.round(mr.width), h: Math.round(mr.height)}, host: hr && {w: Math.round(hr.width), h: Math.round(hr.height)}, suprstar: sup,
    boardFitLoaded: !!window.FLOQRBoardFit, idleFitApi: !!(window.FLOQRBoardFit && window.FLOQRBoardFit.pickIdleRows)};
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

const injectIdle = name => `(() => { window.renderShoutOutDisplay({locationName: ${JSON.stringify(name)}, mainText: ${JSON.stringify("Use ShoutOut @ " + name)}, subText: '', template: 'blackwhite', status: 'default', idleCta: true}); return true; })()`;

async function runCase(c) {
  const [w, h] = SIZES[c.size];
  const t = await cdpTarget();
  await t.send("Page.enable"); await t.send("Runtime.enable");
  await t.send("Emulation.setDeviceMetricsOverride", {width: w, height: h, deviceScaleFactor: 1, mobile: false});
  await t.send("Page.navigate", {url: c.url});
  await sleep(7000);
  await evalJs(t, injectIdle(c.venueName));
  await sleep(2500);
  const measure = await evalJs(t, MEASURE);
  const r = await t.send("Page.captureScreenshot", {format: "png"});
  const file = `${LABEL}-${c.name}.png`;
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, "base64"));
  const errors = t.events.filter(e => e.method === "Runtime.exceptionThrown").map(e => e.params.exceptionDetails?.exception?.description?.slice(0, 200));
  await t.close();
  return {name: c.name, url: c.url, size: c.size, venue: c.venueName, file, measure, errors};
}

const cases = [];
for (const page of ["display", "display2"]) {
  for (const [label, id, venueName] of VENUES) {
    for (const size of Object.keys(SIZES)) {
      const params = new URLSearchParams();
      if (id) params.set("location", id);
      params.set("preview", "1");
      if (size !== "xibo1080") params.set("screen", `led-${size}`);
      cases.push({name: `${page}-${label}-${size}`, url: `${BASE}/${page}.html?${params}`, size, venueName});
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
      const m = res.measure || {};
      console.log(`${c.name.padEnd(28)} ${m.text || (m.suprstar || []).map(s => s.text).join(" / ")} | px ${JSON.stringify(m.fontSizes)} uniform=${m.uniform} safe=${m.insideSafe}`);
    } catch (e) { results.push({name: c.name, error: String(e)}); console.log("fail", c.name, e); }
  }
} finally {
  writeFileSync(join(OUT, `results-${LABEL}${ONLY ? "-" + process.argv[4].replace(/\W+/g, "_") : ""}.json`), JSON.stringify(results, null, 2));
  chrome.kill();
}
