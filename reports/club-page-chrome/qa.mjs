// Club public page chrome QA (Back, no Copy link, FloqR icons, Site chrome) in headless Chrome with a stubbed signed-in Firebase.
// Usage (repo root): node reports/club-page-chrome/qa.mjs before|after
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, statSync} from "node:fs";
import {join, dirname, extname, normalize} from "node:path";
import {tmpdir} from "node:os";
import {fileURLToPath} from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const PHASE = process.argv[2] === "before" ? "before" : "after";
const OUT = join(HERE, PHASE);
const BROWSER = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
const CDP_PORT = 9300 + Math.floor(Math.random() * 400), HTTP_PORT = 8700 + Math.floor(Math.random() * 90);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"};

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  let file = join(ROOT, path);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, {"Content-Type": TYPES[extname(file)] || "application/octet-stream"});
  res.end(readFileSync(file));
}).listen(HTTP_PORT, "127.0.0.1");
const BASE = `http://127.0.0.1:${HTTP_PORT}/`;

const FIREBASE_STUB = `(function(){
  var user={uid:"qa-patron",email:"qa@floqr-demo.com",displayName:"QA Patron",photoURL:"",emailVerified:true,providerData:[],
    getIdToken:function(){return Promise.resolve("qa")},getIdTokenResult:function(){return Promise.resolve({claims:{}})}};
  var docs={"users/qa-patron":{profileCompleted:true,IsPatron:1,displayName:"QA Patron"}};
  function snap(path,id){var d=docs[path];return {exists:!!d,id:id,data:function(){return d},get:function(k){return d&&d[k]}}}
  function qsnap(rows){var list=rows.map(function(r){return {id:r.id,exists:true,data:function(){return r}}});return {docs:list,size:list.length,empty:!list.length,forEach:function(f){list.forEach(f)}}}
  function coll(name){var q={where:function(){return q},orderBy:function(){return q},limit:function(){return q},startAfter:function(){return q},
    get:function(){return Promise.resolve(qsnap((window.__QA_QUERIES||{})[name]||[]))},onSnapshot:function(cb){setTimeout(function(){cb(qsnap([]))},0);return function(){}},
    add:function(){return Promise.resolve({id:"qa"})},
    doc:function(id){var p=name+"/"+id;return {id:id,path:p,collection:function(n){return coll(p+"/"+n)},get:function(){return Promise.resolve(snap(p,id))},
      set:function(){return Promise.resolve()},update:function(){return Promise.resolve()},delete:function(){return Promise.resolve()},
      onSnapshot:function(cb){setTimeout(function(){cb(snap(p,id))},0);return function(){}}}}};return q}
  var fs={collection:coll,settings:function(){},enablePersistence:function(){return Promise.resolve()},batch:function(){return {set:function(){},update:function(){},delete:function(){},commit:function(){return Promise.resolve()}}}};
  var auth={currentUser:user,languageCode:null,useDeviceLanguage:function(){},setPersistence:function(){return Promise.resolve()},signOut:function(){return Promise.resolve()},
    getRedirectResult:function(){return Promise.resolve({user:null})},
    onAuthStateChanged:function(cb){setTimeout(function(){cb(user)},30);return function(){}},onIdTokenChanged:function(cb){setTimeout(function(){cb(user)},30);return function(){}}};
  var fsFn=function(){return fs};fsFn.FieldValue={serverTimestamp:function(){return null},arrayUnion:function(){return null},arrayRemove:function(){return null},increment:function(){return null},delete:function(){return null}};
  fsFn.Timestamp={now:function(){return {toDate:function(){return new Date()},seconds:Date.now()/1000}}};
  var authFn=function(){return auth};var Prov=function(){this.addScope=function(){};this.setCustomParameters=function(){}};
  authFn.GoogleAuthProvider=Prov;authFn.OAuthProvider=Prov;authFn.FacebookAuthProvider=Prov;authFn.Auth={Persistence:{LOCAL:"local",SESSION:"session",NONE:"none"}};
  var app={name:"[DEFAULT]",options:{},auth:authFn,firestore:fsFn,functions:function(){return {httpsCallable:function(){return function(){return Promise.resolve({data:{}})}}}}};
  window.firebase={apps:[],initializeApp:function(){if(!this.apps.length)this.apps.push(app);return app},app:function(){return app},auth:authFn,firestore:fsFn,
    functions:function(){return app.functions()},appCheck:function(){return {activate:function(){}}}};
})();`;

async function target() {
  const info = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, {method: "PUT"})).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  let id = 0;
  const pending = new Map(), errors = [];
  const send = (method, params = {}) => new Promise(ok => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({id: i, method, params})); });
  ws.onmessage = m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === "Fetch.requestPaused") {
      const url = msg.params.request.url;
      const body = /firebase-app-compat/.test(url) ? FIREBASE_STUB : "/* stub */";
      const type = /fonts\.googleapis/.test(url) ? "text/css" : "text/javascript";
      send("Fetch.fulfillRequest", {requestId: msg.params.requestId, responseCode: 200, responseHeaders: [{name: "Content-Type", value: type}], body: Buffer.from(body).toString("base64")});
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails?.exception?.description?.slice(0, 200) || "exception");
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(String(msg.params.args?.[0]?.value || "console.error").slice(0, 200));
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push(`${msg.params.entry.text} ${msg.params.entry.url || ""}`.slice(0, 200));
  };
  const evaluate = async expression => (await send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true})).result?.result?.value;
  return {send, evaluate, errors, close: async () => { ws.close(); await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${info.id}`); }};
}

const PROBE = `(() => {
  const vis = el => !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== "none" && !el.closest(".hidden");
  const back = document.getElementById("floqrGlobalBack");
  const brand = document.querySelector("#clubProfileBrandLink img");
  return {
    loaded: !document.getElementById("clubProfileContent")?.classList.contains("hidden"),
    chrome: document.documentElement.getAttribute("data-floqr-chrome") || "(none)",
    backVisible: vis(back), backHref: back?.getAttribute("href"), backText: back?.textContent.trim(),
    copyLink: !!document.getElementById("clubProfileShareBtn") || /copy link/i.test(document.body.innerText),
    brandSrc: brand?.getAttribute("src"), favicon: document.querySelector("link[rel=icon]")?.getAttribute("href") || null,
    shoutout: document.getElementById("clubShoutoutLink")?.getAttribute("href"),
    bodyBg: getComputedStyle(document.body).backgroundColor + " " + getComputedStyle(document.body).backgroundImage.slice(0, 40),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
})()`;

const CLUBS = {aurelia: "temp-democlub-1", zebbies: "zebbies-garden-washington-dc"};
const SHOTS = [
  {club: "aurelia", w: 1280, h: 900}, {club: "aurelia", w: 390, h: 844},
  {club: "zebbies", w: 1280, h: 900}, {club: "zebbies", w: 390, h: 844}
];
if (PHASE === "after") SHOTS.push(
  {club: "aurelia", w: 820, h: 1180},
  {club: "aurelia", w: 1280, h: 900, chrome: 3}, {club: "aurelia", w: 390, h: 844, chrome: 3},
  {club: "zebbies", w: 820, h: 1180, chrome: 5},
  {club: "aurelia", w: 1280, h: 900, chrome: 3, scroll: "#clubProfileQuickFacts"},
  {club: "aurelia", w: 390, h: 844, scroll: "#clubEventsSection"}
);

async function shoot(spec) {
  const t = await target();
  for (const d of ["Page.enable", "Runtime.enable", "Log.enable"]) await t.send(d);
  await t.send("Fetch.enable", {patterns: [{urlPattern: "*gstatic.com/firebasejs/*"}, {urlPattern: "*fonts.googleapis.com/*"}]});
  const phone = spec.w <= 600;
  await t.send("Emulation.setDeviceMetricsOverride", {width: spec.w, height: spec.h, deviceScaleFactor: phone ? 2 : 1, mobile: phone});
  const id = CLUBS[spec.club];
  const events = [{id: `qa-evt-${spec.club}`, eventName: spec.club === "aurelia" ? "Aurelia Fridays" : "Garden Saturdays", eventDate: "2026-12-12", eventTime: "10 PM", locationId: id, artists: ["DJ Nova", "DJ Kilo"]}];
  await t.send("Page.addScriptToEvaluateOnNewDocument", {source: `window.__QA_QUERIES=${JSON.stringify({events})};try{localStorage.setItem("floqr.isSiteChrome","${spec.chrome ?? 0}")}catch(_){}`});
  await t.send("Page.navigate", {url: `${BASE}club-profile.html?location=${id}`});
  for (let i = 0; i < 60 && !(await t.evaluate(`!document.getElementById("clubProfileContent")?.classList.contains("hidden")`)); i++) await sleep(250);
  await sleep(1200);
  if (spec.scroll) { await t.evaluate(`document.querySelector(${JSON.stringify(spec.scroll)})?.scrollIntoView({block: "start"})`); await sleep(500); }
  const probe = await t.evaluate(PROBE);
  const name = `${spec.club}-${spec.w}${spec.chrome != null ? `-chrome${spec.chrome}` : ""}${spec.scroll ? "-scrolled" : ""}.png`;
  const shot = await t.send("Page.captureScreenshot", {format: "png"});
  writeFileSync(join(OUT, name), Buffer.from(shot.result.data, "base64"));
  await t.close();
  console.log(`${name.padEnd(30)} errors=${t.errors.length} ${JSON.stringify(probe)}${t.errors[0] ? "\n   " + t.errors.join("\n   ") : ""}`);
  return t.errors.length;
}

if (!BROWSER) throw new Error("Chrome or Edge not found");
mkdirSync(OUT, {recursive: true});
const profile = join(tmpdir(), `club-chrome-qa-${process.pid}`);
mkdirSync(profile, {recursive: true});
const browser = spawn(BROWSER, ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], {stdio: "ignore"});
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
  try { rmSync(profile, {recursive: true, force: true}); } catch { /* locked */ }
}
console.log(`phase=${PHASE} total console errors: ${total}`);
process.exit(total ? 1 : 0);
