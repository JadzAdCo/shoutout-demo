// Read-only display audit: headless Chrome via CDP (no puppeteer). Writes screenshots + results.json here.
import {spawn} from "node:child_process";
import {writeFileSync, mkdirSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = "https://jadzadco.github.io/shoutout-demo/display.html";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SIZES = {
  "96x48": [624, 312], "64x48": [416, 312], "64x32": [416, 208], "xibo1080": [1920, 1080]
};

const MEASURE = `(() => {
  const q = s => document.querySelector(s);
  const canvas = q('#displayCanvas');
  const rows = [...document.querySelectorAll('.classic-board-lines > b, .text-overlay-lines > b, #displayMain.display-message-lines > span')].map(b => {
    const run = b.querySelector(':scope > .board-fit-run');
    return {text: b.textContent, rowClientW: b.clientWidth, rowScrollW: b.scrollWidth, runW: run ? run.offsetWidth : null,
      safeW: Math.round(b.clientWidth * 0.92), computedFont: getComputedStyle(b).fontSize, inlineFont: b.style.fontSize || '',
      fitSize: b.style.getPropertyValue('--fit-size'), overflows: b.scrollWidth > b.clientWidth + 1,
      outsideSafe: run ? run.offsetWidth > b.clientWidth * 0.92 + 1 : null};
  });
  const sub = q('#displaySub');
  const shell = sub && sub.querySelector('.classic-identity-shell');
  const strong = shell && shell.querySelector('strong');
  const rail = q('#displayIdentityRail');
  let identity = null;
  if (shell) {
    const cs = getComputedStyle(shell); const r = shell.getBoundingClientRect();
    identity = {subClass: sub.className, ariaLabel: sub.getAttribute('aria-label'), text: shell.textContent,
      opacity: cs.opacity, transform: cs.transform, display: getComputedStyle(sub).display, visibility: cs.visibility,
      rect: {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)},
      inViewport: r.bottom <= innerHeight + 1 && r.top >= -1 && r.left >= -1 && r.right <= innerWidth + 1,
      strongClientW: strong && strong.clientWidth, strongScrollW: strong && strong.scrollWidth,
      animations: shell.getAnimations().map(a => ({name: a.animationName, currentTimeMs: Math.round(a.currentTime), durationMs: a.effect.getComputedTiming().duration, progress: +(a.effect.getComputedTiming().progress || 0).toFixed(3)}))};
  }
  return {href: location.href, title: document.title, bodyClass: document.body.className, canvasClass: canvas && canvas.className,
    formatAttr: canvas && canvas.getAttribute('data-screen-format-id'),
    canvasDataAttrs: canvas && [...canvas.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).join(' '), is: canvas && ['96x48','64x48','64x32'].map(k => k + '=' + canvas.getAttribute('data-is-' + k)).join(','),
    viewport: innerWidth + 'x' + innerHeight, mainText: q('#displayMain') && q('#displayMain').textContent.slice(0, 120),
    denied: !!(canvas && canvas.classList.contains('display-access-denied')), rows, identity,
    railClass: rail && rail.className, railAria: rail && rail.getAttribute('aria-label'),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    boardFitLoaded: !!window.FLOQRBoardFit, accessIp: window.__FLOQR_DISPLAY_CLIENT_IP || ''};
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

async function evalJs(t, expr) {
  const r = await t.send("Runtime.evaluate", {expression: expr, returnByValue: true, awaitPromise: true});
  return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r;
}

async function shot(t, file) {
  const r = await t.send("Page.captureScreenshot", {format: "png"});
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, "base64"));
  return file;
}

async function runCase(c) {
  const [w, h] = SIZES[c.size];
  const t = await cdpTarget();
  await t.send("Page.enable"); await t.send("Runtime.enable"); await t.send("Log.enable");
  await t.send("Emulation.setDeviceMetricsOverride", {width: w, height: h, deviceScaleFactor: 1, mobile: false});
  await t.send("Page.navigate", {url: c.url});
  await sleep(c.wait || 9000);
  const out = {name: c.name, url: c.url, size: c.size};
  if (c.inject) {
    out.beforeInject = await evalJs(t, MEASURE);
    out.injectResult = await evalJs(t, c.inject);
    await sleep(1500);
  }
  out.measure = await evalJs(t, MEASURE);
  out.shot1 = await shot(t, `${c.name}.png`);
  if (c.secondShotAfterMs) {
    await sleep(c.secondShotAfterMs);
    out.measure2 = await evalJs(t, MEASURE);
    out.shot2 = await shot(t, `${c.name}-later.png`);
  }
  out.console = t.events.filter(e => e.method === "Runtime.consoleAPICalled" && /warn|error/.test(e.params.type))
    .map(e => e.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 300)).slice(0, 8);
  await t.close();
  return out;
}

// Re-render the exact idle payload (defaultClubDisplayPayload shape) locally in the tab; nothing is written anywhere.
const injectIdle = name => `(() => {
  window.renderShoutOutDisplay({locationName: ${JSON.stringify(name)}, mainText: ${JSON.stringify("Use ShoutOut @ " + name)}, subText: '', template: 'blackwhite', status: 'default', idleCta: true});
  return ${JSON.stringify(name)}; })()`;

const cases = [];
// Phase A — real Xibo URLs (Display Security path), venue native size + 1080p.
for (const [name, q, size] of [
  ["live-default", "", "96x48"], ["live-default", "", "64x48"], ["live-default", "", "xibo1080"],
  ["live-zebbies", "?location=zebbies-garden-washington-dc", "96x48"], ["live-zebbies", "?location=zebbies-garden-washington-dc", "64x48"], ["live-zebbies", "?location=zebbies-garden-washington-dc", "xibo1080"],
  ["live-heist", "?location=heist-washington-dc", "96x48"],
  ["live-aurelia", "?location=temp-democlub-1", "64x48"], ["live-aurelia", "?location=temp-democlub-1", "96x48"], ["live-aurelia", "?location=temp-democlub-1", "xibo1080"]
]) cases.push({name: `${name}-${size}`, url: BASE + q, size, secondShotAfterMs: 8000});

// Phase B — preview path (skips Display Security) + local idle re-render, every native size.
for (const [id, label, venueName] of [["zebbies-garden-washington-dc", "zebbies", "Zebbies Garden DC"], ["heist-washington-dc", "heist", "Heist Washington DC"], ["temp-democlub-1", "aurelia", "Aurelia (Demo Club)"]]) {
  for (const size of ["96x48", "64x48", "64x32", "xibo1080"]) {
    const screen = size === "xibo1080" ? "" : `&screen=led-${size}`;
    cases.push({name: `preview-idle-${label}-${size}`, url: `${BASE}?location=${id}&preview=1${screen}`, size, inject: injectIdle(venueName), secondShotAfterMs: 8000});
  }
}
// Phase C — the audit's original "first line clipped" input, 1080p Xibo viewport, 96x48 board.
cases.push({name: "preview-idle-zebbies-fullname-1080-96", url: `${BASE}?location=zebbies-garden-washington-dc&preview=1&screen=led-96x48`, size: "xibo1080", inject: injectIdle("Zebbies Garden DC")});

mkdirSync(OUT, {recursive: true});
const profile = join(OUT, ".chrome-profile");
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--disable-gpu", "about:blank"], {stdio: "ignore"});
await sleep(2500);
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const results = [];
try {
  for (const c of cases) {
    if (only && !only.test(c.name)) continue;
    try { results.push(await runCase(c)); console.log("done", c.name); }
    catch (e) { results.push({name: c.name, error: String(e)}); console.log("fail", c.name, e); }
  }
} finally {
  writeFileSync(join(OUT, `results${only ? "-" + process.argv[2].replace(/\W+/g, "_") : ""}.json`), JSON.stringify(results, null, 2));
  chrome.kill();
}
