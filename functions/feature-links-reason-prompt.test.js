/**
 * s3.1.30: derived feature link datapoints, one linkState rule for every feature link surface,
 * Features & Services table labels, and the shared reason prompt.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const core = require("./feature-services-core");

const ROOT = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

function loadClientModule(extraWindow = {}) {
  const doc = {readyState: "complete", body: {dataset: {}}, addEventListener() {}};
  const sandbox = {window: {...extraWindow}, document: doc, console, setTimeout, clearTimeout};
  sandbox.window.document = doc;
  sandbox.window.FLOQRFeatureGates = extraWindow.FLOQRFeatureGates || sandbox.window.FLOQRFeatureGates;
  vm.runInNewContext(read("floqr-feature-services.js"), sandbox);
  return sandbox.window.FLOQRFeatureServices;
}

const plain = value => JSON.parse(JSON.stringify(value));

test("server derives enableFeatureLink / enableBetaFeatureLink from the two flags", () => {
  const cases = [
    [{IsFeatureEnabled: 0, IsTestFeature: 0}, {enableFeatureLink: 0, enableBetaFeatureLink: 0}],
    [{IsFeatureEnabled: 0, IsTestFeature: 1}, {enableFeatureLink: 0, enableBetaFeatureLink: 0}],
    [{IsFeatureEnabled: 1, IsTestFeature: 1}, {enableFeatureLink: 1, enableBetaFeatureLink: 1}],
    [{IsFeatureEnabled: 1, IsTestFeature: 0}, {enableFeatureLink: 1, enableBetaFeatureLink: 0}],
    [{IsFeatureEnabled: "1", IsTestFeature: true}, {enableFeatureLink: 1, enableBetaFeatureLink: 1}],
    [null, {enableFeatureLink: 0, enableBetaFeatureLink: 0}]
  ];
  cases.forEach(([flags, want]) => assert.deepEqual(core.featureLinkFields(flags), want, JSON.stringify(flags)));
  const row = core.normalizeFeature("bartr", {IsFeatureEnabled: 1, IsTestFeature: 1, enableFeatureLink: 0, enableBetaFeatureLink: 0});
  assert.equal(row.enableFeatureLink, 1, "normalizeFeature ignores stored link fields and re-derives them");
  assert.equal(row.enableBetaFeatureLink, 1);
});

test("linkFieldsDrifted flags missing or mismatched link fields only", () => {
  assert.equal(core.linkFieldsDrifted({IsFeatureEnabled: 1, IsTestFeature: 0}), true, "missing fields");
  assert.equal(core.linkFieldsDrifted({IsFeatureEnabled: 1, IsTestFeature: 0, enableFeatureLink: 1, enableBetaFeatureLink: 1}), true);
  assert.equal(core.linkFieldsDrifted({IsFeatureEnabled: 1, IsTestFeature: 0, enableFeatureLink: 1, enableBetaFeatureLink: 0}), false);
  assert.equal(core.linkFieldsDrifted({IsFeatureEnabled: 0, IsTestFeature: 1, enableFeatureLink: 0, enableBetaFeatureLink: 0}), false);
});

test("link fields are written only by the server, in the same transaction as the flags", () => {
  const fns = read("functions/feature-services-functions.js");
  assert.match(fns, /\.\.\.core\.featureLinkFields\(feature\)/, "seeded docs carry the link fields");
  assert.match(fns, /const after = \{\.\.\.flags, \.\.\.core\.featureLinkFields\(flags\), revision: before\.revision \+ 1\}/);
  assert.match(fns, /core\.linkFieldsDrifted\(snap\.data\(\)\)/, "seed backfills drifted docs");
  assert.match(fns, /linkFieldsBackfilledAtMs/);
  assert.match(fns, /feature\.links_backfilled/);
  const rules = read("firestore.rules");
  const block = rules.match(/match \/featureServices\/\{[^}]+\}\s*\{([\s\S]*?)\}/);
  assert.ok(block, "featureServices rules block");
  assert.match(block[1], /allow write: if false/, "featureServices stays Functions-write-only");
});

test("client derives link fields when a stored doc predates s3.1.30", () => {
  const client = loadClientModule();
  const legacy = client.normalize("mingl", {IsFeatureEnabled: 1, IsTestFeature: 1});
  assert.equal(legacy.enableFeatureLink, 1);
  assert.equal(legacy.enableBetaFeatureLink, 1);
  assert.equal(legacy.linkFieldsDrifted, true);
  const fresh = client.normalize("mingl", {IsFeatureEnabled: 1, IsTestFeature: 0, enableFeatureLink: 1, enableBetaFeatureLink: 0});
  assert.equal(fresh.linkFieldsDrifted, false);
  assert.deepEqual(plain(client.deriveLinkFields({IsFeatureEnabled: 1, IsTestFeature: 1})), core.featureLinkFields({IsFeatureEnabled: 1, IsTestFeature: 1}));
});

test("linkState matrix: off / test granted / test non-tester / test master / live", () => {
  const client = loadClientModule();
  const rows = {
    off: {mingl: client.normalize("mingl", {IsFeatureEnabled: 0, IsTestFeature: 1})},
    test: {mingl: client.normalize("mingl", {IsFeatureEnabled: 1, IsTestFeature: 1})},
    live: {mingl: client.normalize("mingl", {IsFeatureEnabled: 1, IsTestFeature: 0})}
  };
  const who = {
    granted: {isMasterAdmin: false, isBetaTester: true, betaFeatures: {mingl: 1}},
    patron: {isMasterAdmin: false, isBetaTester: false, betaFeatures: {}},
    master: {isMasterAdmin: true, isBetaTester: false, betaFeatures: {}}
  };
  const link = (state, viewer, surface) => {
    const out = client.linkState("mingl", {surface, who: who[viewer], rows: rows[state]});
    return {show: out.show, beta: out.beta};
  };
  for (const surface of ["link", "search"]) {
    for (const viewer of Object.keys(who)) {
      assert.deepEqual(link("off", viewer, surface), {show: false, beta: false}, `off ${viewer} ${surface}`);
      assert.deepEqual(link("live", viewer, surface), {show: true, beta: false}, `live ${viewer} ${surface}`);
    }
    assert.deepEqual(link("test", "granted", surface), {show: true, beta: true}, `granted ${surface}`);
    assert.deepEqual(link("test", "patron", surface), {show: false, beta: false}, `patron ${surface}`);
  }
  assert.deepEqual(link("test", "master", "link"), {show: true, beta: true}, "Master Admin profile menu shows test features as Beta");
  assert.deepEqual(link("test", "master", "search"), {show: true, beta: true}, "Master Admin Search shows test features as Beta for QA");

  const stale = {mingl: {...rows.off.mingl, enableFeatureLink: 1, enableBetaFeatureLink: 1}};
  assert.equal(client.linkState("mingl", {who: who.granted, rows: stale}).show, false, "a stale link field never opens an off feature");
  const legacy = {mingl: {key: "mingl", IsFeatureEnabled: 1, IsTestFeature: 1}};
  assert.equal(client.linkState("mingl", {who: who.granted, rows: legacy}).beta, true, "missing fields derive from the flags");
  const driftedStoredOff = client.normalize("mingl", {IsFeatureEnabled: 1, IsTestFeature: 1, enableFeatureLink: 0, enableBetaFeatureLink: 0});
  assert.equal(driftedStoredOff.enableFeatureLink, 1, "client re-derives link fields like the server");
  assert.equal(client.linkState("mingl", {surface: "search", who: who.granted, rows: {mingl: driftedStoredOff}}).show, true, "stored enableFeatureLink=0 must not hide an enabled test tile");
  assert.equal(client.linkState("nope", {who: who.master, rows: {}}).show, false);
});

test("Search applySearchUi unhides Mingl for a granted tester even when the legacy patron gate is off", async () => {
  const classList = (initial = ["hidden"]) => {
    const set = new Set(initial);
    return {
      toggle(name, on) { if (on) set.add(name); else set.delete(name); },
      contains(name) { return set.has(name); }
    };
  };
  const minglEl = {id: "minglBtnCard", tagName: "BUTTON", classList: classList(), dataset: {}, setAttribute() {}, disabled: true};
  const vipEl = {id: "vipReservBtnCard", tagName: "A", classList: classList(), dataset: {}, setAttribute() {}, disabled: false};
  const doc = {
    getElementById(id) {
      if (id === "minglBtnCard") return minglEl;
      if (id === "vipReservBtnCard") return vipEl;
      return null;
    }
  };
  const extra = {
    FLOQRFeatureGates: {
      patronMayUse: () => false,
      isMasterAdminEmail: () => false,
      isSuperAdmin: () => false
    }
  };
  const client = loadClientModule(extra);
  const featureDocs = {
    mingl: {IsFeatureEnabled: 1, IsTestFeature: 1, enableFeatureLink: 0, enableBetaFeatureLink: 0},
    vipReservations: {IsFeatureEnabled: 1, IsTestFeature: 1, enableFeatureLink: 1, enableBetaFeatureLink: 1},
    botDee: {IsFeatureEnabled: 1, IsTestFeature: 1, enableFeatureLink: 1, enableBetaFeatureLink: 1},
    sinema: {IsFeatureEnabled: 1, IsTestFeature: 1, enableFeatureLink: 1, enableBetaFeatureLink: 1}
  };
  const db = {
    collection(name) {
      if (name === "featureServices") {
        return {
          get: async () => ({
            forEach(fn) {
              Object.entries(featureDocs).forEach(([id, data]) => fn({id, data: () => data}));
            }
          })
        };
      }
      if (name === "betaTesters") {
        return {
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({IsBetaTester: 1, status: "active", features: {mingl: 1, vipReservations: 1, botDee: 1, sinema: 1}})
            })
          })
        };
      }
      const missing = {exists: false, data() { return {}; }};
      return {get: async () => ({forEach() {}}), doc: () => ({get: async () => missing})};
    }
  };
  await client.load({db, user: {uid: "lorna-signed-in", email: "lorna@gmail.com"}, profile: {}});
  client.applySearchUi(doc);
  assert.equal(minglEl.classList.contains("hidden"), false, "Mingl tile unhides for the signed-in uid grant");
  assert.equal(minglEl.disabled, false);
  assert.equal(vipEl.classList.contains("hidden"), false, "VIP still shows (empty patronGate)");
});

test("applyFeatureLinks unhides data-floqr-feature-link=mingl on the profile menu when the legacy patron gate is off", async () => {
  const classList = (initial = ["hidden"]) => {
    const set = new Set(initial);
    return {
      toggle(name, on) { if (on) set.add(name); else set.delete(name); },
      contains(name) { return set.has(name); },
      add(name) { set.add(name); },
      remove(name) { set.delete(name); }
    };
  };
  const minglLink = {
    dataset: {floqrFeatureLink: "mingl"},
    classList: classList(),
    hidden: true,
    querySelector() { return null; },
    appendChild() {},
    setAttribute() {}
  };
  const styleEl = {id: "floqrFeatureLinkStyles", textContent: ""};
  const doc = {
    getElementById(id) { return id === "floqrFeatureLinkStyles" ? styleEl : null; },
    createElement() { return {id: "", textContent: "", className: ""}; },
    head: {appendChild() {}}
  };
  const scope = {
    ownerDocument: doc,
    querySelectorAll(sel) {
      return String(sel).includes("data-floqr-feature-link") ? [minglLink] : [];
    }
  };
  const client = loadClientModule({
    FLOQRFeatureGates: {
      patronMayUse: () => false,
      isMasterAdminEmail: () => false,
      isSuperAdmin: () => false
    }
  });
  const db = {
    collection(name) {
      if (name === "featureServices") {
        return {
          get: async () => ({
            forEach(fn) {
              fn({id: "mingl", data: () => ({IsFeatureEnabled: 1, IsTestFeature: 1, enableFeatureLink: 0})});
            }
          })
        };
      }
      if (name === "betaTesters") {
        return {
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({IsBetaTester: 1, status: "active", features: {mingl: 1}})
            })
          })
        };
      }
      return {get: async () => ({forEach() {}}), doc: () => ({get: async () => ({exists: false, data() { return {}; }})})};
    }
  };
  await client.load({db, user: {uid: "lorna-signed-in", email: "lorna@gmail.com"}, profile: {}});
  const out = client.applyFeatureLinks(scope);
  assert.equal(minglLink.classList.contains("hidden"), false, "avatar menu Mingl link unhides for the signed-in uid grant");
  assert.equal(minglLink.hidden, false);
  assert.equal(out[0]?.visible, true);
});

test("Search tile visibility is per signed-in betaTesters uid, not another Lorna account", async () => {
  const classList = (initial = ["hidden"]) => {
    const set = new Set(initial);
    return {
      toggle(name, on) { if (on) set.add(name); else set.delete(name); },
      contains(name) { return set.has(name); }
    };
  };
  const minglEl = {id: "minglBtnCard", tagName: "BUTTON", classList: classList(), dataset: {}, setAttribute() {}, disabled: true};
  const doc = {getElementById(id) { return id === "minglBtnCard" ? minglEl : null; }};
  const client = loadClientModule({
    FLOQRFeatureGates: {
      patronMayUse: () => true,
      isMasterAdminEmail: () => false,
      isSuperAdmin: () => false
    }
  });
  const db = {
    collection(name) {
      if (name === "featureServices") {
        return {
          get: async () => ({
            forEach(fn) {
              fn({id: "mingl", data: () => ({IsFeatureEnabled: 1, IsTestFeature: 1})});
            }
          })
        };
      }
      if (name === "betaTesters") {
        return {
          doc: uid => ({
            get: async () => uid === "lorna-ms"
              ? {exists: true, data: () => ({IsBetaTester: 1, status: "active", features: {botDee: 1, vipReservations: 1, sinema: 1}})}
              : {exists: true, data: () => ({IsBetaTester: 1, status: "active", features: {mingl: 1}})}
          })
        };
      }
      return {get: async () => ({forEach() {}}), doc: () => ({get: async () => ({exists: false})})};
    }
  };
  await client.load({db, user: {uid: "lorna-ms", email: "mslorna@gmail.com"}, profile: {}});
  client.applySearchUi(doc);
  assert.equal(minglEl.classList.contains("hidden"), true, "Mingl stays hidden when the signed-in uid has no mingl grant");
  await client.load({db, user: {uid: "lorna-gmail", email: "lorna@gmail.com"}, profile: {}});
  client.applySearchUi(doc);
  assert.equal(minglEl.classList.contains("hidden"), false, "the other Lorna uid with mingl:1 does see the tile");
});

test("every feature link surface goes through linkState", () => {
  const guard = read("floqr-feature-services.js");
  assert.match(guard, /linkState\(base\.key, \{surface: "search"\}\)/, "Search tiles use linkState with search semantics");
  assert.match(guard, /stateOf\(features\[canonicalizeFeatureKey\(base\.key\)\]\) === "test"\) return true/, "test tiles skip the legacy patronFeatureGates AND");
  assert.match(guard, /function featureLinkAllowed\(/, "Search tiles and profile links share one F&S helper");
  assert.match(guard, /function applyFeatureLinks\(/);
  assert.match(guard, /root\.FLOQRTabGates|gates\.apply\(/, "hidden via FLOQRTabGates");
  assert.match(guard, /cat\.betaPill/);

  const menu = read("global-profile-status.js");
  assert.match(menu, /data-floqr-feature-link="\$\{esc\(key\)\}"/);
  ["mingl", "bartr", "rydr", "floqCast", "botDee"].forEach(key => {
    assert.match(menu, new RegExp(`featureLink\\("${key}"`), `profile menu link for ${key}`);
  });
  assert.match(menu, /fs\.applyFeatureLinks\(dropdown\)/);

  const app = read("patron-app.js");
  assert.match(app, /data-patron-menu="chats" data-floqr-feature-link="mingl"/);
  assert.match(app, /chats\.dataset\.floqrFeatureLink = "mingl"/);
  assert.match(app, /fs\.applyFeatureLinks\(host\)/);

  const portal = read("patron-portal.html");
  assert.match(portal, /data-panel="portalBartrStore" data-floqr-feature-link="bartr" data-floqr-feature-panel="#portalBartrStore"/);
  assert.match(portal, /data-panel="portalMinglFriends" data-floqr-feature-link="mingl"/);
  assert.match(portal, /data-floqr-feature-link="mingl" href="\.\/mingl-chat\.html/);
  assert.match(portal, /data-floqr-feature-link="bartr" href="\.\/commerce\.html/);
  assert.match(portal, /floqr-feature-services\.js\?v=s3\.\d+\.\d+/);
  assert.match(read("patron-portal-app.js"), /fs\.applyFeatureLinks\(/);

  const floqai = read("intent-search.js");
  assert.match(floqai, /fs\.linkState\(intent\.featureKey\)\.show/);
  assert.match(floqai, /linkState\?\.\(intent\.featureKey\)\.beta/);
  ["mingl", "bartr", "rydr", "floqCast"].forEach(key => assert.match(floqai, new RegExp(`featureKey: "${key}"`), key));
});

test("Features & Services table: plain-language headers, Revision N, link inside the Feature cell", () => {
  const html = read("master-admin.html");
  const table = html.match(/<table class="admin-table feature-flags-table">[\s\S]*?<\/table>/);
  assert.ok(table, "feature flags table");
  assert.match(table[0], /<th[^>]*title="[^"]*IsFeatureEnabled[^"]*"[^>]*>Enable Feature<\/th>/);
  assert.match(table[0], /<th[^>]*title="[^"]*IsTestFeature[^"]*"[^>]*>Enable Beta Feature<\/th>/);
  assert.doesNotMatch(table[0], /Master Admin link/);
  const app = read("master-feature-services.js");
  assert.match(app, /title="Number of saved changes to this feature">Revision \$\{/);
  assert.doesNotMatch(app, />r\$\{/);
  assert.match(app, /Off — set Enable Feature to 1 to open it\./);
  assert.match(app, /function featureCell\(/);
  const css = read("admin.css");
  assert.match(css, /\.feature-flags-table \.feature-flag-toggle\{display:inline-flex/, "checkbox and 0/1 stay on one line");
  assert.match(css, /\.feature-save-cell button\{white-space:nowrap\}/);
  assert.match(css, /@media \(max-width:900px\)\{\s*\.feature-flags-wrap/, "tablet/phone cards");
});

test("reason is asked after Save in the shared prompt — no standing input, no window.prompt", () => {
  const html = read("master-admin.html");
  assert.doesNotMatch(html, /id="featureServicesReason"|id="featurePromotionReason"/);
  assert.match(html, /floqr-reason-prompt\.js\?v=s3\.\d+\.\d+/);
  assert.match(html, /floqr-reason-prompt\.css\?v=s3\.\d+\.\d+/);
  const app = read("master-feature-services.js");
  assert.match(app, /FLOQRReasonPrompt/);
  assert.doesNotMatch(app, /(root|window)\.prompt\(|[^.\w]prompt\(/);
  ["setFeatureServiceFlags", "setBetaTesterFeatures", "revokeBetaTester", "logFeatureCodePromotion"].forEach(name => {
    assert.match(app, new RegExp(name), name);
  });
  assert.ok((app.match(/await askReason\(/g) || []).length >= 4, "row Save, tester features, revoke, promotion");

  const prompt = read("floqr-reason-prompt.js");
  assert.match(prompt, /root\.FLOQRReasonPrompt = /);
  assert.match(prompt, /role", "dialog"|role="dialog"/);
  assert.match(prompt, /aria-modal/);
  assert.match(prompt, /"Escape"/);
  assert.match(prompt, /"Tab"/);
  assert.match(prompt, /minLength/);
  assert.match(read("floqr-reason-prompt.css"), /@media \(max-width: ?600px\)/);
});

test("reason prompt copy exists in every chrome language", () => {
  const i18n = read("floqr-i18n.js");
  ["reason.title", "reason.label", "reason.help", "reason.changing", "reason.placeholder", "reason.counter", "reason.save", "reason.cancel"].forEach(key => {
    const hits = i18n.split(`"${key}":`).length - 1;
    assert.equal(hits, 11, `${key} in all 11 packs`);
  });
});

test("help and rules document the s3.1.30 contract", () => {
  const repo = read("botdee-help-repository.js");
  const master = read("functions/help-verbiage-master-source.json");
  assert.doesNotMatch(repo, /Enable Beta Feature \(IsTestFeature\)/);
  assert.match(master, /Enable Beta Feature \(IsTestFeature\)/);
  assert.match(master, /"enable beta feature"/);
  const rule = read(".cursor/rules/reason-prompt-on-save.mdc");
  assert.match(rule, /alwaysApply: true/);
  assert.match(rule, /FLOQRReasonPrompt/);
  assert.match(rule, /bottom sheet/);
  assert.match(read(".cursor/rules/design-notes-feature-services.mdc"), /enableBetaFeatureLink/);
});
