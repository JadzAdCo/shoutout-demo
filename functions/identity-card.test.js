"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const card = require("../floqr-identity-card.js");

const optedIn = (choice, attribution) => ({includeAttribution: true, attributionChoice: choice, attribution});

test("handle priority: opt-in attribution wins, attributionChoice none means nobody", () => {
  assert.deepEqual(card.resolveHandle(optedIn("instagram", "nyx.dc")), {value: "@NYX.DC", kind: "instagram", source: "attribution"});
  assert.deepEqual(card.resolveHandle(optedIn("floqrHandle", "@maya")), {value: "@MAYA", kind: "mingl", source: "attribution"});
  assert.deepEqual(card.resolveHandle(optedIn("username", "maya_b")), {value: "@MAYA_B", kind: "mingl", source: "attribution"});
  assert.deepEqual(card.resolveHandle(optedIn("displayName", "Maya B")), {value: "MAYA B", kind: "name", source: "attribution"});
  // A non-empty attribution alone counts as opted in (checkout + Club Admin approve treat it that way).
  assert.equal(card.resolveHandle({attribution: "maya"}).value, "@MAYA");
  assert.equal(card.resolveHandle({attribution: "Maya B", attributionChoice: "none"}), null);
  assert.equal(card.resolveHandle({includeAttribution: true, attribution: ""}), null);
  assert.equal(card.resolveHandle({includeAttribution: false, attribution: "", subText: "maya"}), null, "subText is ignored unless the caller allows legacy payloads");
});

test("legacy subText only for payloads without any attribution fields, never a template default line", () => {
  const legacy = {legacySubText: true, defaultSub: "CELEBRATE BIG"};
  assert.deepEqual(card.resolveHandle({subText: "@nyx"}, legacy), {value: "@NYX", kind: "auto", source: "legacySubText"});
  assert.equal(card.resolveHandle({subText: "Maya B"}, legacy).value, "MAYA B");
  assert.equal(card.resolveHandle({subText: "CELEBRATE BIG"}, legacy), null);
  assert.equal(card.resolveHandle({subText: "She said yes"}, legacy), null);
  assert.equal(card.resolveHandle({subText: "maya", attributionChoice: "none"}, legacy), null);
  assert.equal(card.resolveHandle({subText: "maya", attributionChoice: "displayName"}, legacy), null, "new payloads never fall back to subText");
  assert.equal(card.resolveHandle({subText: "maya", includeAttribution: true}, legacy), null);
});

test("email addresses and phone numbers never reach the card", () => {
  assert.equal(card.resolveHandle(optedIn("displayName", "maya@example.com")), null);
  assert.equal(card.resolveHandle(optedIn("displayName", "+1 (202) 555-0147")), null);
  assert.equal(card.resolveHandle({subText: "2025550147"}, {legacySubText: true}), null);
  assert.equal(card.resolveHandle(optedIn("instagram", "dj2025")).value, "@DJ2025", "digits inside a handle are fine");
});

test("values are cleaned and capped at 22 glyphs", () => {
  assert.equal(card.formatValue("  maya \n b ", "name"), "MAYA B");
  assert.equal(card.formatValue("@@nyx", "instagram"), "@NYX");
  assert.equal(card.formatValue("a".repeat(40), "instagram").length, 22);
  assert.equal(card.formatValue("Ana 👏 Rosa", "name"), "ANA 👏 ROSA");
});

test("phase sequence: no handle → FloqMedia only; handle → FloqMedia then FROM @handle; idle never credits", () => {
  const brand = {kind: "brand", kicker: "PRESENTED BY", value: "FLOQMEDIA"};
  assert.deepEqual(card.phases({}), [brand]);
  assert.deepEqual(card.phases({attributionChoice: "none", subText: "maya"}, {legacySubText: true}), [brand]);
  assert.deepEqual(card.phases(optedIn("instagram", "nyx"), {idle: true}), [brand]);
  assert.deepEqual(card.phases(optedIn("instagram", "nyx")), [brand, {kind: "handle", kicker: "FROM", value: "@NYX", handleKind: "instagram"}]);
  const two = card.phases(optedIn("instagram", "nyx"));
  assert.deepEqual([0, 5999, 6000, 11999, 12000, 18000].map(ms => card.phaseAt(two, ms, 6000)), [0, 0, 1, 1, 0, 1]);
  const one = card.phases({});
  assert.deepEqual([0, 6000, 12000, 20000].map(ms => card.phaseAt(one, ms, 6000)), [0, 0, 0, 0]);
});

function sharedTemplates() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.runInNewContext(read("shared-data.js"), sandbox, {filename: "shared-data.js"});
  return sandbox.SHOUTOUT_TEMPLATES;
}

const HEIST_IDS = ["heistVaultNight", "heistPoliceCar", "heistInterrogation", "heistVaultDollars", "heistRedLux"];
const caught = {kind: "tagline", kicker: "CAUGHT IN A", value: "HEIST"};
const presented = {kind: "brand", kicker: "PRESENTED BY", value: "FLOQMEDIA"};
const powered = {kind: "tagline", kicker: "POWERED BY", value: "FLOQR SOCIAL OS"};

test("Heist phases: CAUGHT IN A HEIST → PRESENTED BY FloqMedia → POWERED BY FloqR Social OS → FROM @handle", () => {
  const templates = sharedTemplates();
  for (const id of HEIST_IDS) {
    const spec = templates[id].identityPhases;
    assert.ok(Array.isArray(spec), `${id} declares identityPhases`);
    const withHandle = card.phases(optedIn("instagram", "nyx.dc"), {identityPhases: spec, legacySubText: true});
    assert.deepEqual(withHandle, [caught, presented, powered, {kind: "handle", kicker: "FROM", value: "@NYX.DC", handleKind: "instagram"}], id);
    assert.deepEqual(card.phases({}, {identityPhases: spec, legacySubText: true}), [caught, presented, powered], `${id} without a handle`);
    assert.deepEqual(card.phases({attributionChoice: "none", subText: "maya"}, {identityPhases: spec, legacySubText: true}), [caught, presented, powered]);
    assert.deepEqual(card.phases(optedIn("instagram", "nyx"), {identityPhases: spec, idle: true}), [caught, presented, powered], `${id} idle never credits`);
    assert.deepEqual(card.phases(optedIn("displayName", "maya@example.com"), {identityPhases: spec}), [caught, presented, powered], "never an email");
  }
  const four = card.phases(optedIn("instagram", "nyx"), {identityPhases: templates.heistVaultNight.identityPhases});
  assert.deepEqual([1000, 7000, 13000, 19000, 25000].map(ms => card.phaseAt(four, ms, 6000)), [0, 1, 2, 3, 0]);
});

test("other templates keep the default card; bad phase specs fall back to it", () => {
  const templates = sharedTemplates();
  const heistOnly = Object.keys(templates).filter(id => templates[id].identityPhases);
  assert.deepEqual(heistOnly.sort(), [...HEIST_IDS].sort(), "only Heist opts in to custom phases today");
  const handle = {kind: "handle", kicker: "FROM", value: "@NYX", handleKind: "instagram"};
  assert.deepEqual(card.phases(optedIn("instagram", "nyx"), {identityPhases: templates.blackwhite.identityPhases}), [presented, handle]);
  for (const bad of [null, "heist", [], ["handle"], [{kicker: "X"}], [42, {}]]) {
    assert.deepEqual(card.phases(optedIn("instagram", "nyx"), {identityPhases: bad}), [presented, handle], JSON.stringify(bad));
  }
  assert.equal(card.normalizePhaseSpec(Array(10).fill("brand")).length, 6, "at most 6 phases");
});

test("Heist message window holds a full card cycle before the brand slide", () => {
  const js = read("display-app.js");
  assert.match(js, /identityPhases: template\.identityPhases \|\| null/);
  assert.match(js, /const cardSeconds = heistCard\.phaseCount \* /);
  assert.match(js, /Math\.max\(5, Number\(template\.messageDurationSeconds \|\| HEIST_MESSAGE_SECONDS\), cardSeconds\)/);
});

test("shell html escapes every patron value", () => {
  const html = card.shellHtml({kind: "handle", kicker: "FROM", value: `<img src=x onerror="alert(1)">'\``}, {shellClass: `x" onclick="y`});
  assert.ok(!/<img/i.test(html));
  assert.ok(!/onclick="y/.test(html));
  assert.match(html, /&lt;IMG|&lt;img/);
  assert.match(html, /&quot;/);
  const viaResolve = card.phases(optedIn("displayName", `</strong><script>x</script>`))[1];
  assert.ok(!card.shellHtml(viaResolve).includes("<script>"));
});

function fakeHost() {
  const classes = new Set();
  const attrs = {};
  let html = "";
  return {
    paints: [],
    classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      contains: name => classes.has(name)
    },
    setAttribute(name, value) { attrs[name] = String(value); },
    getAttribute(name) { return attrs[name] ?? null; },
    get innerHTML() { return html; },
    set innerHTML(value) { html = String(value); this.paints.push(attrs["data-identity-phase"]); },
    classes,
    attrs
  };
}

function loadLoop() {
  const timers = [];
  const sandbox = {
    setInterval: (fn, ms) => { timers.push({fn, ms, live: true}); return timers.length; },
    clearInterval: id => { if (timers[id - 1]) timers[id - 1].live = false; },
    requestAnimationFrame: fn => fn()
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("floqr-frame-loop.js"), sandbox, {filename: "floqr-frame-loop.js"});
  vm.runInContext(read("floqr-identity-card.js"), sandbox, {filename: "floqr-identity-card.js"});
  const tick = () => timers.filter(t => t.live).forEach(t => t.fn());
  return {sandbox, timers, tick};
}

test("mount: handle alternates every 6s on FLOQRFrameLoop and the card is never empty", () => {
  const {sandbox, timers, tick} = loadLoop();
  const host = fakeHost();
  host.classList.add("hidden", "classic-bw-sub-hidden");
  sandbox.FLOQRIdentityCard.mount(host, {data: optedIn("instagram", "nyx"), hostClass: "classic-bw-identity"});
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 6000, "hold comes from FLOQRFrameLoop.HOLD_MS");
  assert.ok(!host.classes.has("hidden") && !host.classes.has("classic-bw-sub-hidden"));
  assert.ok(host.classes.has("classic-bw-identity") && host.classes.has("floqr-identity-card"));
  for (let i = 0; i < 5; i += 1) {
    assert.match(host.innerHTML, /classic-identity-shell/);
    tick();
  }
  assert.deepEqual(host.paints, ["brand", "handle", "brand", "handle", "brand", "handle"]);
  assert.match(host.innerHTML, /<small>FROM<\/small><strong>@NYX<\/strong>/);
  assert.equal(host.getAttribute("aria-label"), "FROM @NYX");
  sandbox.FLOQRIdentityCard.stop();
  assert.equal(timers[0].live, false);
});

test("mount: no handle paints PRESENTED BY FloqMedia once and starts no timer", () => {
  const {sandbox, timers} = loadLoop();
  const host = fakeHost();
  sandbox.FLOQRIdentityCard.mount(host, {data: {}});
  assert.equal(timers.length, 0);
  assert.deepEqual(host.paints, ["brand"]);
  assert.match(host.innerHTML, /<small>PRESENTED BY<\/small><strong>FLOQMEDIA<\/strong>/);
  assert.ok(host.classes.has("uses-brand-fallback"));
});

test("mount: Heist cycles 4 phases with a handle, 3 without, on one FrameLoop timer", () => {
  const spec = sharedTemplates().heistVaultNight.identityPhases;
  const {sandbox, timers, tick} = loadLoop();
  const host = fakeHost();
  const mounted = sandbox.FLOQRIdentityCard.mount(host, {data: optedIn("instagram", "nyx"), identityPhases: spec, shellClass: "heist-identity-shell"});
  assert.equal(mounted.phases.length, 4);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 6000);
  const seen = [host.innerHTML];
  for (let i = 0; i < 4; i += 1) { tick(); seen.push(host.innerHTML); }
  assert.deepEqual(host.paints, ["tagline", "brand", "tagline", "handle", "tagline"]);
  assert.match(seen[0], /<small>CAUGHT IN A<\/small><strong>HEIST<\/strong>/);
  assert.match(seen[1], /<small>PRESENTED BY<\/small><strong>FLOQMEDIA<\/strong>/);
  assert.match(seen[2], /<small>POWERED BY<\/small><strong>FLOQR SOCIAL OS<\/strong>/);
  assert.match(seen[3], /<small>FROM<\/small><strong>@NYX<\/strong>/);
  assert.ok(seen.every(html => /heist-identity-shell/.test(html)));
  assert.ok(!host.classes.has("has-attribution"), "back on CAUGHT IN A HEIST after the handle");

  const {sandbox: s2, timers: t2, tick: tick2} = loadLoop();
  const bare = fakeHost();
  assert.equal(s2.FLOQRIdentityCard.mount(bare, {data: {}, identityPhases: spec}).phases.length, 3);
  for (let i = 0; i < 3; i += 1) tick2();
  assert.equal(t2.length, 1);
  assert.deepEqual(bare.paints, ["tagline", "brand", "tagline", "tagline"]);
});

test("mount: re-mounting replaces the running cycle (one card timer at a time)", () => {
  const {sandbox, timers} = loadLoop();
  const host = fakeHost();
  sandbox.FLOQRIdentityCard.mount(host, {data: optedIn("instagram", "nyx")});
  sandbox.FLOQRIdentityCard.mount(host, {data: optedIn("instagram", "maya")});
  assert.equal(timers.filter(t => t.live).length, 1);
});

test("CSS: the FloqR card has no animation that reaches opacity 0", () => {
  const css = read("display.css");
  assert.doesNotMatch(css, /classicIdentityShellBurst|heistIdentityShellBurst/, "burst-away keyframes are retired");
  const keyframes = name => (css.match(new RegExp(`@keyframes ${name}\\{([\\s\\S]*?)\\n\\}`)) || [])[1] || "";
  ["floqrIdentityCardIn", "floqrIdentityCardPulse", "nflFloqrCardPulse"].forEach(name => {
    const body = keyframes(name);
    assert.ok(body, `${name} defined`);
    const opacities = [...body.matchAll(/opacity:([\d.]+)/g)].map(m => Number(m[1]));
    assert.ok(opacities.length && Math.min(...opacities) >= 0.5, `${name} keeps the card readable (${opacities})`);
  });
  const shellRules = [...css.matchAll(/([^{}]*(?:classic-identity-shell|heist-identity-shell)[^{}]*)\{([^}]*)\}/g)];
  shellRules.forEach(([, selector, body]) => {
    const anim = (body.match(/animation:([^;]+)/) || [])[1];
    if (!anim || /none/.test(anim)) return;
    assert.match(anim, /floqrIdentityCard(In|Pulse)|nflFloqrCardPulse/, `${selector.trim()} uses a never-fading card animation`);
  });
});

test("display-app uses the shared card everywhere and starts no card interval of its own", () => {
  const js = read("display-app.js");
  assert.doesNotMatch(js, /__floqrCardCycleTimer|__floqrHeistIdentityTimer/);
  assert.doesNotMatch(js, /classic-bw-sub-hidden"\);\s*byId\("displaySub"\)\.removeAttribute\("aria-label"\);\s*byId\("displaySub"\)\.innerHTML = "";\s*\} else \{\s*byId\("displaySub"\)\.classList\.add\("classic-bw-identity"/,
    "classic live ShoutOuts no longer hide the card when there is no handle");
  const mounts = js.match(/mountFloqrCard\(/g) || [];
  assert.ok(mounts.length >= 6, `classic, Heist, jersey, Christine and split media mount the shared card (${mounts.length})`);
  assert.match(js, /mountFloqrCard\(byId\("displaySub"\), \{data, idle: isIdleCta, hostClass: "classic-bw-identity"\}\)/);
  assert.match(js, /legacySubText: true,\s*defaultSub: template\.defaultSub/);
  const frameLoop = read("floqr-frame-loop.js");
  assert.match(frameLoop, /function cycle\(name, options = \{\}\)/);
  for (const page of ["display.html", "display2.html"]) {
    const html = read(page);
    const cardAt = html.indexOf("floqr-identity-card.js?v=");
    assert.ok(cardAt > 0, `${page} loads floqr-identity-card.js`);
    assert.ok(cardAt < html.indexOf("display-app.js?v="), `${page} loads the card before display-app.js`);
    assert.ok(html.indexOf("floqr-frame-loop.js?v=") < html.indexOf("display-app.js?v="));
  }
});

test("composer stamps the FloqR card opt-in on every template and the preview URL carries the choice", () => {
  const app = read("patron-app.js");
  assert.match(app, /function floqrCardAttributionFields\(\)/);
  assert.match(app, /if \(!isSoccerJerseyTemplate\(\)\) return floqrCardAttributionFields\(\);/);
  assert.match(app, /attributionChoice: includeAttribution && attribution \? [^:]+ : "none"/);
  assert.match(app, /url\.searchParams\.set\("attributionChoice", payload\.attributionChoice\)/);
});
