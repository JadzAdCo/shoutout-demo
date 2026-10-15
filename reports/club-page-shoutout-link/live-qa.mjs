// Live QA for s3.1.43: club / event public page "Throw a ShoutOut" -> venue ad splash -> template selection.
// Headless Edge via CDP against GitHub Pages. No QA account, so: the signed-out redirect, the link href, and the sign-in
// landing are checked for real; the club page is rendered by its own loadClubProfile() (auth redirect skipped from a
// debugger pause), and the post-sign-in step calls Search's own openDirectVenueShoutout() (what continueToMainCategories
// runs after sign-in), captured from a debugger pause inside patron-app.js.
// Usage: node live-qa.mjs [baseUrl]
import {spawn} from "node:child_process";
import {writeFileSync, mkdirSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {tmpdir} from "node:os";
import {fileURLToPath} from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] || "https://jadzadco.github.io/shoutout-demo").replace(/\/$/, "");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = Number(process.env.CDP_PORT || 9361);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VENUES = [["temp-democlub-1", "aurelia"], ["zebbies-garden-washington-dc", "zebbies"], ["josephine-atlanta-ga", "josephine"]]
  .filter(([, slug]) => !process.env.QA_ONLY || new RegExp(process.env.QA_ONLY).test(slug));
const PATRON_APP_TOP_LINE = 47; // 0-based: `let pendingDirectEvent = qs("event", "");` at the top of the patron-app.js IIFE
const report = {base: BASE, at: new Date().toISOString(), cases: []};

async function cdpTarget() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, {method: "PUT"});
  const info = await res.json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) listeners.forEach(fn => fn(msg));
  };
  const send = (method, params = {}) => new Promise(ok => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({id: i, method, params})); });
  return {send, on: fn => listeners.push(fn), close: async () => { ws.close(); await fetch(`http://127.0.0.1:${PORT}/json/close/${info.id}`); }};
}

const evalJs = async (t, expr) => {
  const r = await t.send("Runtime.evaluate", {expression: expr, returnByValue: true, awaitPromise: true});
  return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? null;
};
const shot = async (t, file) => {
  const r = await t.send("Page.captureScreenshot", {format: "png"});
  writeFileSync(join(OUT, file), Buffer.from(r.result.data, "base64"));
  return file;
};
const STATE = `(() => ({
  url: location.href,
  activePage: document.querySelector('.page.active')?.id || null,
  adTitle: document.getElementById('adTitle')?.textContent?.trim() || '',
  venueHeader: !document.getElementById('splashClubLogoWrap')?.classList.contains('hidden'),
  clubTitle: document.getElementById('selectedClubTitle')?.textContent?.trim() || '',
  clubMeta: document.getElementById('selectedClubMeta')?.textContent?.trim() || '',
  templateCards: document.querySelectorAll('#templateSelectPage [data-template], #templateSelectPage .template-card').length
}))()`;

async function newPage() {
  const t = await cdpTarget();
  await t.send("Page.enable"); await t.send("Runtime.enable");
  await t.send("Emulation.setDeviceMetricsOverride", {width: 430, height: 932, deviceScaleFactor: 1, mobile: true});
  const errors = [];
  t.on(msg => { if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200)); });
  return {t, errors};
}

/* Signed out the club page redirects to sign-in (checked first). Then, for the rendered page, pause in its auth callback,
   skip the redirect, and run its own loadClubProfile(). */
async function clubPage(locationId, slug) {
  const signedOut = await newPage();
  await signedOut.t.send("Page.navigate", {url: `${BASE}/club-profile.html?location=${locationId}`});
  await sleep(8000);
  const redirect = await evalJs(signedOut.t, "location.href");
  await shot(signedOut.t, `00-club-page-${slug}-signed-out-redirect.png`);
  await signedOut.t.close();

  const {t, errors} = await newPage();
  await t.send("Debugger.enable");
  const bp = await t.send("Debugger.setBreakpointByUrl", {urlRegex: "club-profile-app\\.js", lineNumber: 365});
  let captured = false;
  t.on(async msg => {
    if (msg.method !== "Debugger.paused" || captured) return;
    captured = true;
    const frame = msg.params.callFrames[0];
    await t.send("Debugger.setVariableValue", {scopeNumber: 0, variableName: "user", newValue: {value: {uid: "qa-live-check"}}, callFrameId: frame.callFrameId});
    await t.send("Debugger.evaluateOnCallFrame", {callFrameId: frame.callFrameId, expression: "window.__qaLoad = () => loadClubProfile(); 1"});
    await t.send("Debugger.removeBreakpoint", {breakpointId: bp.result.breakpointId});
    await t.send("Debugger.resume");
  });
  await t.send("Page.navigate", {url: `${BASE}/club-profile.html?location=${locationId}`});
  await sleep(7000);
  const loadResult = await evalJs(t, "typeof window.__qaLoad === 'function' ? window.__qaLoad().then(() => 'rendered', e => 'error: ' + e.message) : 'no hook'");
  await sleep(3000);
  const info = await evalJs(t, `(() => ({
    url: location.href,
    shoutoutHref: document.getElementById('clubShoutoutLink')?.getAttribute('href') || null,
    eventHrefs: [...document.querySelectorAll('[data-event-shoutout]')].map(a => a.getAttribute('href')),
    title: document.title
  }))()`);
  const file = await shot(t, `01-club-page-${slug}.png`);
  if (info.eventHrefs?.length) {
    await evalJs(t, `document.querySelector('[data-event-shoutout]').scrollIntoView({block:'center'}); true`);
    await sleep(600);
    await shot(t, `02-club-page-${slug}-event-button.png`);
  }
  await t.close();
  return {slug, locationId, signedOutRedirect: redirect, loadResult, info, file, errors};
}

/* Opens the ShoutOut link signed out, then runs the post-sign-in step from inside patron-app.js. */
async function shoutoutLink(href, slug) {
  const {t, errors} = await newPage();
  await t.send("Debugger.enable");
  const bp = await t.send("Debugger.setBreakpointByUrl", {urlRegex: "patron-app\\.js", lineNumber: PATRON_APP_TOP_LINE});
  let captured = false;
  t.on(async msg => {
    if (msg.method !== "Debugger.paused" || captured) return;
    captured = true;
    const frame = msg.params.callFrames[0].callFrameId;
    await t.send("Debugger.evaluateOnCallFrame", {callFrameId: frame,
      expression: "window.__qaDirect = () => openDirectVenueShoutout(); window.__qaVars = () => ({selectedLocationId, pendingDirectLocation, pendingDirectEvent}); 1"});
    await t.send("Debugger.removeBreakpoint", {breakpointId: bp.result.breakpointId});
    await t.send("Debugger.resume");
  });
  const url = new URL(href, `${BASE}/club-profile.html`).toString();
  await t.send("Page.navigate", {url});
  await sleep(10000);
  const signedOut = await evalJs(t, STATE);
  const welcome = await shot(t, `03-${slug}-signed-out-sign-in.png`);
  const hook = await evalJs(t, "typeof window.__qaDirect");
  let splash = null, template = null, files = {};
  if (hook === "function") {
    await evalJs(t, "(window.__qaDirect(), true)");
    for (let i = 0; i < 40; i += 1) {
      await sleep(250);
      splash = await evalJs(t, STATE);
      if (splash.activePage === "adSplashPage") break;
    }
    await sleep(1200);
    splash = await evalJs(t, STATE);
    files.splash = await shot(t, `04-${slug}-venue-ad-splash.png`);
    for (let i = 0; i < 24; i += 1) {
      await sleep(500);
      const s = await evalJs(t, STATE);
      if (s.activePage === "templateSelectPage") break;
    }
    await sleep(1500);
    template = await evalJs(t, STATE);
    template.vars = await evalJs(t, "window.__qaVars()");
    files.template = await shot(t, `05-${slug}-template-selection.png`);
    await sleep(8000);
    template.after8s = await evalJs(t, STATE);
  }
  await t.close();
  return {slug, href, url, signedOut, welcome, hook, splash, template, files, errors};
}

const profile = join(tmpdir(), `floqr-qa-edge-${Date.now()}`);
mkdirSync(profile, {recursive: true});
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run",
  "--disable-extensions", "--window-size=430,932", "about:blank"], {stdio: "ignore"});
try {
  await sleep(3000);
  for (const [id, slug] of VENUES) {
    const club = await clubPage(id, slug);
    report.cases.push({kind: "club-page", ...club});
    if (club.info?.shoutoutHref) report.cases.push({kind: "club-link", ...(await shoutoutLink(club.info.shoutoutHref, `${slug}-club`))});
    const eventHref = club.info?.eventHrefs?.[0];
    if (eventHref) report.cases.push({kind: "event-link", ...(await shoutoutLink(eventHref, `${slug}-event`))});
  }
} finally {
  edge.kill();
  writeFileSync(join(OUT, `live-qa-report${process.env.QA_ONLY ? `-${process.env.QA_ONLY}` : ""}.json`), JSON.stringify(report, null, 2));
  await sleep(1000);
  try { rmSync(profile, {recursive: true, force: true}); } catch (_) {}
}
console.log(JSON.stringify(report.cases.map(c => ({kind: c.kind, slug: c.slug,
  href: c.info?.shoutoutHref || c.href, eventHrefs: c.info?.eventHrefs?.slice(0, 2), redirect: c.signedOutRedirect, load: c.loadResult,
  landedOn: c.info?.url || c.signedOut?.url,
  signedOutPage: c.signedOut?.activePage, hook: c.hook,
  splash: c.splash && {page: c.splash.activePage, adTitle: c.splash.adTitle, venueHeader: c.splash.venueHeader},
  template: c.template && {page: c.template.activePage, club: c.template.clubTitle, meta: c.template.clubMeta, after8s: c.template.after8s?.activePage},
  errors: c.errors?.length})), null, 2));
