"use strict";

// Markup-injection guard for board / preview renders (s3.1.39). Design notes: .cursor/rules/design-notes-board-fit.mdc
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const safe = require("../floqr-safe-render.js");

const PROBE = "x><b id=floqrprobe>PROBE</b><i ";
const PAYLOADS = [
  PROBE,
  'x"><b id=floqrprobe>P</b>',
  "x') ; background:red; x:url('",
  "x\"); } </style><b id=floqrprobe>P</b><style>",
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "x\n<b id=floqrprobe>P</b>",
  "data:text/html,<b id=floqrprobe>P</b>",
  "data:image/svg+xml,<svg onload=alert(1)>",
  "//evil.example/x.png",
  "https://x.example/a.png\"><b id=floqrprobe>P</b>",
  "https://x.example/a.png'onerror='alert(1)",
  "https://x.example/a(1).png) , url(javascript:alert(1)"
];

const ALLOWED_TAGS = new Set(["section", "div", "span", "strong", "small", "b", "i", "img", "video", "article", "header", "em", "br", "p", "button"]);
const ALLOWED_ATTRS = new Set([
  "class", "style", "aria-label", "aria-hidden", "data-theme", "data-media-url", "data-initials", "alt", "src",
  "autoplay", "muted", "loop", "playsinline", "type", "data-preview-format", "data-line-count", "data-line", "decoding"
]);

function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (m, code) => {
    const named = {amp: "&", lt: "<", gt: ">", quot: '"', apos: "'"}[code.toLowerCase()];
    if (named) return named;
    const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return String.fromCodePoint(n);
  });
}

/** Tokenizes rendered HTML the way a browser would split tags/attributes and fails on any injected element or attribute. */
function assertNoInjection(html, label) {
  const tag = /<\s*([a-zA-Z][\w-]*)([^>]*)>/g;
  let match;
  while ((match = tag.exec(html))) {
    const name = match[1].toLowerCase();
    assert.ok(ALLOWED_TAGS.has(name), `${label}: unexpected <${name}> in\n${html}`);
    const attrs = /([^\s"'=<>\/`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let attr;
    while ((attr = attrs.exec(match[2]))) {
      const attrName = attr[1].toLowerCase();
      assert.ok(ALLOWED_ATTRS.has(attrName), `${label}: unexpected attribute ${attrName} on <${name}> in\n${html}`);
      const value = decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? "");
      assert.ok(!/floqrprobe/i.test(attrName), `${label}: probe attribute`);
      if (attrName === "style") assertSafeCss(value, `${label} style`);
      if (attrName === "src" || attrName === "data-media-url") {
        assert.ok(!/^\s*(javascript|data:text|vbscript)/i.test(value), `${label}: unsafe ${attrName} ${value}`);
      }
    }
  }
}

function assertSafeCss(value, label) {
  assert.ok(!/[<>]/.test(value), `${label}: angle bracket in CSS ${value}`);
  const urls = value.match(/url\(/gi) || [];
  const quoted = value.match(/url\("[^"()'\\\s<>]*"\)/g) || [];
  assert.equal(urls.length, quoted.length, `${label}: url() not in the safe quoted form: ${value}`);
  quoted.forEach(token => assert.match(token, /^url\("(https?:\/\/|(\.\/)?images\/|blob:https?:\/\/|data:image\/(png|jpe?g|gif|webp|avif);base64,)/i, `${label}: url scheme ${token}`));
  assert.ok(!/javascript:|expression\(/i.test(value.replace(/url\("[^"]*"\)/g, "")), `${label}: script in CSS ${value}`);
}

test("escapeHtml escapes every HTML-significant character", () => {
  assert.equal(safe.escapeHtml(`<a href="x" title='y'>&\``), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&#96;");
  assert.equal(safe.escapeHtml(null), "");
});

test("safeUrl allows http(s), images/ paths and opt-in blob / raster data only", () => {
  assert.equal(safe.safeUrl("https://firebasestorage.googleapis.com/v0/b/x/o/a%2Fb.jpg?alt=media&token=1"), "https://firebasestorage.googleapis.com/v0/b/x/o/a%2Fb.jpg?alt=media&token=1");
  assert.equal(safe.safeUrl("./images/heist/vault-night.png"), "./images/heist/vault-night.png");
  assert.equal(safe.safeUrl("images/aurelia/shiloh-cat-background.jpg"), "images/aurelia/shiloh-cat-background.jpg");
  assert.equal(safe.safeUrl("https://x.example/a b<c>\"d"), "https://x.example/a%20b%3Cc%3E%22d");
  ["", "javascript:alert(1)", " javascript:alert(1)", "vbscript:x", "data:text/html,x", "data:image/svg+xml,<svg>",
    "//evil.example/x.png", "/images/x.png", "../images/x.png", "images/../secret", "https://u:p@x.example/a.png",
    "https://x.example/a\n.png", "ftp://x.example/a.png", "x><b id=floqrprobe>", "blob:https://x.example/abc"
  ].forEach(value => assert.equal(safe.safeUrl(value), "", JSON.stringify(value)));
  assert.equal(safe.safeUrl("blob:https://x.example/0a1b-2c3d", {allowBlob: true}), "blob:https://x.example/0a1b-2c3d");
  assert.equal(safe.safeUrl("data:image/png;base64,iVBORw0KGgo=", {allowDataImage: true}), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(safe.safeUrl("data:image/svg+xml;base64,PHN2Zz4=", {allowDataImage: true}), "");
});

test("cssUrl percent-encodes quotes, parens, backslashes, angle brackets and spaces", () => {
  assert.equal(safe.cssUrl("./images/a.png"), 'url("./images/a.png")');
  assert.equal(safe.cssUrl("https://x.example/a(1)'b.png"), 'url("https://x.example/a%281%29%27b.png")');
  PAYLOADS.forEach(payload => {
    const css = safe.cssUrl(payload);
    if (css) assertSafeCss(css, JSON.stringify(payload));
    assert.ok(!css.includes("<") && !css.includes("\n"), JSON.stringify(payload));
  });
  assert.equal(safe.cssUrl(PROBE), "");
  assert.equal(safe.cssUrl("javascript:alert(1)"), "");
});

test("safeColor / safeGradient only pass plain CSS values", () => {
  ["#fff", "#dfff5a", "#11223344", "rgba(0, 0, 0, .5)", "hsl(120 50% 50%)", "transparent"].forEach(v => assert.equal(safe.safeColor(v), v));
  ['#fff" onload="x', "red;background:url(x)", "url(x)", "expression(alert(1))", "#12", "</style>"].forEach(v => assert.equal(safe.safeColor(v, "#000"), "#000", v));
  const g = "linear-gradient(135deg,#050505,#1b1b1b 32%,#e41616 33%,#111 58%,#e41616 74%,#060606)";
  assert.equal(safe.safeGradient(g), g);
  ["linear-gradient(red, url(x))", "linear-gradient(red);background:url(x)", "linear-gradient(red", "radial-gradient(red,blue)",
    "linear-gradient(var(--x),red)", "linear-gradient(red,blue))("].forEach(v => assert.equal(safe.safeGradient(v), "", v));
  assert.equal(safe.styleAttr(['a:"b"', "", "c:<d>"]), "a:&quot;b&quot;;c:&lt;d&gt;");
});

function loadShared() {
  const sandbox = {location: {origin: "https://example.test", href: "https://example.test/", pathname: "/"}, URL, URLSearchParams};
  sandbox.window = sandbox;
  vm.runInNewContext(read("floqr-temp-qa-showcase.js"), sandbox, {filename: "floqr-temp-qa-showcase.js"});
  vm.runInNewContext(read("shared-data.js"), sandbox, {filename: "shared-data.js"});
  return sandbox;
}

test("every packaged template background still passes safeUrl", () => {
  const sandbox = loadShared();
  vm.runInNewContext(read("national-teams-data.js"), sandbox, {filename: "national-teams-data.js"});
  vm.runInNewContext(read("jersey-catalog.js"), sandbox, {filename: "jersey-catalog.js"});
  const urls = Object.values(sandbox.SHOUTOUT_TEMPLATES || {})
    .flatMap(t => [t.defaultBackgroundUrl, t.defaultFrameOverlayUrl])
    .filter(Boolean);
  assert.ok(urls.length > 5, "packaged backgrounds found");
  urls.forEach(url => assert.ok(safe.safeUrl(url), `packaged background rejected: ${url}`));
});

// Minimal DOM: captures every innerHTML write and every style value display-app.js sets.
function makeDom() {
  const htmlWrites = [];
  const cssWrites = [];
  const els = new Map();
  const makeStyle = owner => new Proxy({
    setProperty(name, value) { cssWrites.push({owner, name, value: String(value)}); },
    removeProperty() {},
    getPropertyValue() { return ""; }
  }, {
    set(target, name, value) { target[name] = value; if (value) cssWrites.push({owner, name: String(name), value: String(value)}); return true; }
  });
  const makeEl = (key, tag = "div") => {
    let html = "";
    const attrs = {};
    const el = {
      key, tagName: tag.toUpperCase(), id: key, className: "", textContent: "", dataset: {}, style: makeStyle(key),
      classList: {add() {}, remove() {}, toggle() {}, contains() { return false; }},
      get innerHTML() { return html; },
      set innerHTML(value) { html = String(value); htmlWrites.push({key, html}); },
      setAttribute(name, value) { attrs[name] = String(value); },
      getAttribute(name) { return name in attrs ? attrs[name] : null; },
      removeAttribute(name) { delete attrs[name]; },
      querySelector: () => makeEl(`${key}>q`),
      querySelectorAll: () => [],
      appendChild: child => child, insertBefore: child => child, remove() {}, replaceWith() {},
      addEventListener() {}, removeEventListener() {}, closest: () => null, focus() {},
      clientWidth: 0, clientHeight: 0, offsetHeight: 0, offsetWidth: 0, scrollWidth: 0, scrollHeight: 0,
      parentElement: null, firstChild: null, children: []
    };
    return el;
  };
  const get = key => { if (!els.has(key)) els.set(key, makeEl(key)); return els.get(key); };
  const document = {
    getElementById: get,
    querySelector: sel => get(sel),
    querySelectorAll: () => [],
    createElement: tag => makeEl(`new-${tag}`, tag),
    addEventListener() {},
    body: get("body"),
    documentElement: get("html"),
    title: ""
  };
  return {document, htmlWrites, cssWrites, get};
}

function loadDisplay({identity = false} = {}) {
  const dom = makeDom();
  const noop = () => 0;
  const db = {
    enablePersistence: () => Promise.resolve(),
    collection: () => ({doc: () => ({get: async () => ({exists: false}), onSnapshot: noop}), get: async () => ({forEach() {}})})
  };
  const sandbox = {
    URL, URLSearchParams, console, Promise,
    location: {origin: "https://example.test", href: "https://example.test/display.html?location=zebbies-garden-washington-dc", pathname: "/display.html", hostname: "example.test"},
    navigator: {userAgent: "test", language: "en"},
    document: dom.document,
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop, cancelAnimationFrame: noop,
    firebaseConfig: {},
    firebase: {initializeApp() {}, firestore: () => db, app: () => ({functions: () => ({httpsCallable: () => async () => ({data: {}})})}), functions: {}}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ["floqr-temp-qa-showcase.js", "shared-data.js", "floqr-safe-render.js", "floqr-board-fit.js"].forEach(file => vm.runInContext(read(file), sandbox, {filename: file}));
  if (identity) vm.runInContext(read("floqr-identity.js"), sandbox, {filename: "floqr-identity.js"});
  vm.runInContext(read("display-app.js"), sandbox, {filename: "display-app.js"});
  assert.equal(typeof sandbox.renderShoutOutDisplay, "function");
  return {render: payload => sandbox.renderShoutOutDisplay(payload), dom, sandbox};
}

function assertRenderClean(dom, label) {
  assert.ok(dom.htmlWrites.length, `${label}: something rendered`);
  dom.htmlWrites.forEach(write => assertNoInjection(write.html, `${label} [${write.key}]`));
  dom.cssWrites.forEach(write => assertSafeCss(write.value, `${label} css ${write.owner}.${write.name}`));
}

test("Football Intro: backgroundUrl / theme / player media payloads never inject markup (live probe URL)", () => {
  PAYLOADS.forEach(payload => {
    for (const identity of [false, true]) {
      const {render, dom} = loadDisplay({identity});
      render({
        template: "zebbiesFootballTeamIntro", status: "preview", screenFormatId: "led-96x48",
        mainText: payload, subText: payload, backgroundUrl: payload, backgroundColor: payload, themeAccent: payload,
        colorTheme: payload, stadiumMessage: payload, brandName: payload,
        teamMembers: [1, 2, 3, 4].map(() => ({name: payload, position: payload, mediaUrl: payload}))
      });
      const stage = dom.htmlWrites.find(write => write.html.includes("football-intro-stage"));
      assert.ok(stage, "football stage rendered");
      assertRenderClean(dom, `football ${JSON.stringify(payload)} identity=${identity}`);
      if (!safe.cssUrl(payload)) assert.ok(!stage.html.includes("background-image"), `rejected URL must not reach the stage: ${JSON.stringify(payload)}`);
    }
  });
});

test("Football Intro: a real Storage background still renders as a quoted, escaped url()", () => {
  const {render, dom} = loadDisplay({identity: true});
  render({template: "zebbiesFootballTeamIntro", status: "preview", screenFormatId: "led-96x48",
    backgroundUrl: "https://firebasestorage.googleapis.com/v0/b/b/o/a%2Fb.jpg?alt=media&token=t"});
  const stage = dom.htmlWrites.find(write => write.html.includes("football-intro-stage")).html;
  assert.match(stage, /background-image:url\(&quot;https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/b\/o\/a%2Fb\.jpg\?alt=media&amp;token=t&quot;\)/);
  assertRenderClean(dom, "football storage url");
});

test("split media, text, background layer and jersey colors stay escaped for every payload", () => {
  PAYLOADS.forEach(payload => {
    const cases = [
      {template: "neon", templateSupportsMedia: true, mediaUrl: payload, mediaType: "image"},
      {template: "neon", templateSupportsMedia: true, mediaUrl: payload, mediaType: "video"},
      {template: "neon", backgroundUrl: payload, backgroundGradient: payload, backgroundColor: payload, frameOverlayUrl: payload},
      {template: "blackwhite", attribution: payload, includeAttribution: true},
      {template: "soccerMorocco", jerseyPrimary: payload, jerseySecondary: payload, jerseyAccent: payload, backgroundUrl: payload, jerseyTeamLabel: payload}
    ];
    cases.forEach(extra => {
      const {render, dom} = loadDisplay({identity: true});
      render({status: "preview", screenFormatId: "led-96x48", mainText: payload, subText: payload, ...extra});
      assertRenderClean(dom, `${extra.template} ${JSON.stringify(payload)}`);
    });
  });
});

test("template preview size buttons escape Firestore screen format ids", () => {
  const dom = makeDom();
  const sandbox = {document: dom.document, URL, location: {href: "https://example.test/index.html"}};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("floqr-safe-render.js"), sandbox);
  vm.runInContext(read("floqr-template-preview.js"), sandbox);
  sandbox.FLOQRTemplatePreview.open({id: "neon", name: "Neon", screenFormatIds: [PROBE, 'led-x"><b id=floqrprobe>']}, {locationId: "z"});
  const sizes = dom.htmlWrites.find(write => write.html.includes("data-preview-format"));
  assert.ok(sizes, "size buttons rendered");
  assertNoInjection(sizes.html, "template preview sizes");
});

test("patron composer jersey mini preview uses the safe css url", () => {
  const src = read("patron-app.js");
  const start = src.indexOf("  function jerseyMiniPreview(template)");
  const end = src.indexOf("\n  function ", start + 10);
  assert.ok(start > 0 && end > start);
  const sandbox = {window: {FLOQRSafeRender: safe}};
  vm.runInNewContext(`const esc = ${safe.escapeHtml.toString()}; const HTML_ESCAPES = ${JSON.stringify({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;"})};
    ${src.slice(start, end)}\nthis.preview = jerseyMiniPreview;`, sandbox);
  PAYLOADS.forEach(payload => {
    const html = sandbox.preview({sport: "soccer", defaultBackgroundUrl: payload, defaultMain: payload, defaultSub: payload});
    assertNoInjection(html, `jersey mini preview ${JSON.stringify(payload)}`);
  });
  assert.match(sandbox.preview({sport: "soccer", defaultBackgroundUrl: "./images/soccer/a.png"}), /background-image:url\(&quot;\.\/images\/soccer\/a\.png&quot;\)/);
  assert.match(src, /footballBackgroundUrl"\)\?\.value\) \|\| ""/);
});

test("Club Admin approve vets patron render fields before the public board doc", () => {
  const admin = read("admin-app.js");
  const approve = admin.slice(admin.indexOf("  async function approve(id, item)"), admin.indexOf("  async function resetDisplayToClubDefault"));
  assert.match(approve, /resolvedBackgroundUrl = boardUrl\(item\.backgroundUrl\) \|\| boardUrl\(packaged\.defaultBackgroundUrl\)/);
  assert.match(approve, /mediaUrl: boardUrl\(item\.mediaUrl\)/);
  assert.match(approve, /teamMembers: boardTeamMembers\(item\.teamMembers\)/);
  assert.match(approve, /backgroundGradient: window\.FLOQRSafeRender\?\.safeGradient\(item\.backgroundGradient\)/);
  assert.match(approve, /jerseyPrimary: boardColor\(/);
  assert.match(admin, /href="\$\{esc\(displayUrl\(item\)\)\}"/);
});

function rulesRegex(name) {
  const rules = read("firestore.rules");
  const fn = rules.slice(rules.indexOf(`function ${name}(`));
  const literal = fn.match(/\.matches\('((?:[^'\\]|\\.)*)'\)/)[1];
  return new RegExp(literal.replace(/\\(.)/g, "$1").replace(/\\x60/g, "`"));
}

test("Firestore rules reject unsafe render URLs / colors on patron shoutouts and liveContent", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /FLOQR FIRESTORE RULES VERSION: s3\.1\.39-board-render-fields/);
  const live = rules.slice(rules.indexOf("match /liveContent/{id}"), rules.indexOf("match /displayDevices/"));
  assert.match(live, /allow create, update: if \(isMasterAdmin\(\) \|\| isClubManager\(id\)\) && validBoardRenderFields\(request\.resource\.data\);/);
  ["function validPatronShoutoutCreate", "function validFreePatronShoutoutCreate", "function isOwnerShoutoutEdit"].forEach(fn => {
    const body = rules.slice(rules.indexOf(fn), rules.indexOf("}", rules.indexOf(fn)));
    assert.match(body, /validBoardRenderFields\(request\.resource\.data\)/, fn);
  });
  const url = rulesRegex("boardUrlOk");
  ["https://firebasestorage.googleapis.com/v0/b/x/o/shoutouts%2Fu%2F1-a_b.jpg?alt=media&token=abc-1", "./images/heist/vault-night.png", "images/aurelia/shiloh-cat-background.jpg"]
    .forEach(v => assert.ok(url.test(v), v));
  [PROBE, 'https://x/a"><b>', "https://x/a b", "javascript:alert(1)", "data:image/png;base64,AAA", "//evil/x", "https://x/a'b", "https://x/a\\b"]
    .forEach(v => assert.ok(!url.test(v), v));
  const color = rulesRegex("boardColorOk");
  ["#dfff5a", "#111", "rgba(0, 0, 0, .5)", "white"].forEach(v => assert.ok(color.test(v), v));
  ['#fff"><b>', "red;x:y", "url(x)"].forEach(v => assert.ok(!color.test(v), v));
});

test("display pages load the safe render helper first; dead renderers are gone", () => {
  ["display.html", "display2.html"].forEach(page => {
    const html = read(page);
    const helper = html.indexOf("floqr-safe-render.js?v=");
    assert.ok(helper > 0 && helper < html.indexOf("display-app.js?v="), page);
    assert.doesNotMatch(html, /display2?\.html\?location=[^"'\s<>]*[?&](v|screen)=/);
  });
  const index = read("index.html");
  assert.ok(index.indexOf("floqr-safe-render.js?v=") > 0 && index.indexOf("floqr-safe-render.js?v=") < index.indexOf("floqr-template-preview.js?v="));
  const admin = read("admin.html");
  assert.ok(admin.indexOf("floqr-safe-render.js?v=") > 0 && admin.indexOf("floqr-safe-render.js?v=") < admin.indexOf("admin-app.js?v="));
  const display = read("display-app.js");
  assert.doesNotMatch(display, /jadzRenderDisplayMedia/);
  assert.doesNotMatch(display, /replace\(\/"\/g, "%22"\)/);
  assert.match(display, /const backgroundCss = safeRender\.cssUrl\(data\.backgroundUrl\);/);
  assert.match(display, /style="\$\{stageStyle\}"/);
  assert.match(display, /const stageStyle = safeRender\.styleAttr\(\[/);
});
