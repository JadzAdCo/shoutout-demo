"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const client = require(path.join(root, "floqr-staff-marketing-consent.js"));
const core = require("./staff-marketing-consent-core");
const {analyze, CHROME_LANGS, HELP_LANGS} = require(path.join(root, "scripts", "i18n-coverage-report.js"));

function objectLiteral(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, marker);
  let depth = 0;
  for (let i = start + marker.length; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return Function(`"use strict"; return (${source.slice(start + marker.length, i + 1)});`)();
    }
  }
  throw new Error(`Unbalanced ${marker}`);
}

function rulesBlock(rules, matchPath) {
  const start = rules.indexOf(`match ${matchPath}`);
  assert.notEqual(start, -1, matchPath);
  let depth = 0;
  for (let i = rules.indexOf("{", start + "match ".length + matchPath.length); i < rules.length; i += 1) {
    if (rules[i] === "{") depth += 1;
    if (rules[i] === "}") depth -= 1;
    if (depth === 0) return rules.slice(start, i + 1);
  }
  throw new Error(`Unclosed ${matchPath}`);
}

test("consent verbiage covers the grant, channels, private data, and withdrawal", () => {
  const text = client.ENGLISH_TEXT;
  for (const phrase of [
    "club, lounge, venue, or event team", "admins and managers", "FLOQR profile name", "your role",
    "photos and videos you have published or selected", "websites", "flyers and posters",
    "Instagram", "Facebook", "TikTok", "YouTube", "do not need to ask you again for each new use",
    "While this consent is active", "non-exclusive and royalty-free", "phone number or email address",
    "withdraw this consent at any time in My Profile", "stops new marketing use", "already printed or posted"
  ]) assert.ok(text.includes(phrase), `verbiage mentions "${phrase}"`);
  assert.match(client.EN["staffConsent.checkbox"], /^I agree/);
});

test("client and server share version, text, and hash", () => {
  assert.equal(client.VERSION, "mmc-2026-10");
  assert.equal(core.VERSION, client.VERSION);
  assert.equal(core.ENGLISH_TEXT, client.ENGLISH_TEXT);
  const hash = crypto.createHash("sha256").update(client.ENGLISH_TEXT, "utf8").digest("hex");
  assert.equal(client.TEXT_HASH, hash);
  assert.equal(core.TEXT_HASH, hash);
  assert.deepEqual(core.SOURCES, client.SOURCES);
});

test("consent block renders unticked and keeps gated buttons disabled until ticked", () => {
  const html = client.blockHtml("demo");
  assert.match(html, /<input type="checkbox" id="demoMarketingConsent" data-staff-consent-box\/>/);
  assert.doesNotMatch(html, /checked/);
  assert.match(html, /data-floqr-help-id="help-staff-marketing-consent"/);
  for (const key of client.TEXT_KEYS) assert.match(html, new RegExp(`data-i18n="${key.replace(".", "\\.")}"`));

  const listeners = {};
  const box = {checked: false, addEventListener: (type, fn) => { listeners[type] = fn; }};
  const host = {innerHTML: "", querySelector: () => box};
  const button = {disabled: false};
  const form = client.mount(host, {idPrefix: "demo", buttons: [button], help: false});
  assert.equal(button.disabled, true, "disabled before tick");
  assert.equal(form.isChecked(), false);
  box.checked = true;
  listeners.change();
  assert.equal(button.disabled, false, "enabled after tick");
  form.reset();
  assert.equal(box.checked, false);
  assert.equal(button.disabled, true, "reset unticks and disables again");
  assert.equal(client.mount(null), null);
});

test("records, stamps, and status priority", () => {
  const nowMs = Date.UTC(2026, 9, 8, 12);
  const accepted = client.acceptedRecord({nowMs, source: "portal-request", lang: "fr"});
  assert.deepEqual(accepted, {
    accepted: 1, version: "mmc-2026-10", textHash: client.TEXT_HASH, acceptedAtMs: nowMs,
    acceptedAtIso: "2026-10-08T12:00:00.000Z", source: "portal-request", lang: "fr", withdrawnAtMs: 0, withdrawnAtIso: ""
  });
  assert.equal(client.acceptedRecord({source: "made-up"}).source, "unknown");
  assert.deepEqual(client.withdrawnRecord({nowMs: nowMs + 1}), {accepted: 0, withdrawnAtMs: nowMs + 1, withdrawnAtIso: "2026-10-08T12:00:00.001Z"});

  const stamp = client.requestStamp(accepted);
  assert.deepEqual(stamp, {marketingMediaConsentAccepted: 1, marketingMediaConsentVersion: "mmc-2026-10", marketingMediaConsentTextHash: client.TEXT_HASH, marketingMediaConsentAtMs: nowMs});
  assert.equal(core.requestHasConsent(stamp), true);
  assert.equal(core.requestHasConsent({}), false);
  assert.deepEqual(client.designationStamp(stamp), {marketingMediaConsentAccepted: 1, marketingMediaConsentVersion: "mmc-2026-10", marketingMediaConsentAtMs: nowMs});
  assert.deepEqual(client.designationStamp({}), {});

  assert.equal(client.statusOf({marketingMediaConsent: accepted}).state, "given");
  assert.equal(client.statusOf({marketingMediaConsent: accepted}).current, true);
  const withdrawn = {marketingMediaConsent: {...accepted, ...client.withdrawnRecord({nowMs: nowMs + 5})}};
  assert.equal(client.statusOf(withdrawn, stamp).state, "withdrawn", "live withdrawal beats the opt-in snapshot");
  assert.equal(client.statusOf(withdrawn).atMs, nowMs + 5);
  assert.equal(client.statusOf({}, client.designationStamp(stamp)).state, "given", "designation stamp when no user record");
  assert.equal(client.statusOf({}).state, "none");
  assert.equal(client.isActive({marketingMediaConsent: accepted}), true);
  assert.equal(client.isActive(withdrawn), false);

  assert.match(client.adminLabel({marketingMediaConsent: accepted}), /^Marketing consent: given on /);
  assert.match(client.adminLabel(withdrawn), /^Marketing consent: withdrawn on /);
  assert.equal(client.adminLabel({}), "Marketing consent: not recorded");
  assert.match(client.patronStatusText({}), /^Not given yet/);
});

test("server validates input, refuses stale copy, and builds the evidence record", () => {
  const good = {action: "accept", version: core.VERSION, textHash: core.TEXT_HASH, source: "role-request", lang: "de", clubLocationIds: ["club-a", "club-a", "bad id!", "club_b"]};
  const parsed = core.normalizeInput(good);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, {action: "accept", source: "role-request", lang: "de", clubLocationIds: ["club-a", "club_b"]});
  assert.equal(core.normalizeInput({...good, version: "mmc-2020-01"}).ok, false);
  assert.equal(core.normalizeInput({...good, textHash: "0".repeat(64)}).ok, false);
  assert.equal(core.normalizeInput({...good, source: "elsewhere"}).ok, false);
  assert.equal(core.normalizeInput({...good, action: "grant"}).ok, false);
  assert.equal(core.normalizeInput({...good, clubLocationIds: Array.from({length: 51}, (_, i) => `c${i}`)}).ok, false);
  assert.deepEqual(core.normalizeInput({action: "withdraw"}), {ok: true, value: {action: "withdraw"}});

  const nowMs = Date.UTC(2026, 9, 8);
  const patch = core.userConsentPatch(parsed.value, nowMs, "log1");
  assert.equal(patch.accepted, 1);
  assert.equal(patch.version, core.VERSION);
  assert.equal(patch.textHash, core.TEXT_HASH);
  assert.equal(patch.acceptedAtMs, nowMs);
  assert.equal(patch.serverRecordedAtMs, nowMs);
  assert.equal(patch.lastLogId, "log1");
  const out = core.userConsentPatch({action: "withdraw"}, nowMs, "log2");
  assert.deepEqual(out, {accepted: 0, withdrawnAtMs: nowMs, withdrawnAtIso: "2026-10-08T00:00:00.000Z", serverRecordedAtMs: nowMs, lastLogId: "log2"});

  const log = core.logRecord({uid: "u1", email: "a@b.c", value: parsed.value, nowMs, ip: "203.0.113.9", userAgent: "UA"});
  assert.equal(log.englishText, core.ENGLISH_TEXT);
  assert.equal(log.textHash, core.TEXT_HASH);
  assert.equal(JSON.stringify(log).includes("203.0.113.9"), false, "raw IP is never stored");
  assert.equal(log.sourceIpHash.length, 32);

  let row = {};
  for (let i = 0; i < core.THROTTLE_MAX; i += 1) {
    const step = core.throttleStep(row, nowMs);
    assert.equal(step.allowed, true);
    row = step.next;
  }
  assert.equal(core.throttleStep(row, nowMs).allowed, false);
  assert.equal(core.throttleStep(row, nowMs + core.THROTTLE_WINDOW_MS + 1).allowed, true);

  const fnSrc = fs.readFileSync(path.join(__dirname, "staff-marketing-consent-functions.js"), "utf8");
  assert.match(fnSrc, /exports\.recordStaffMarketingConsent = onCall\(/);
  assert.match(fnSrc, /if \(!request\.auth\) throw new HttpsError\("unauthenticated"/);
  assert.match(fnSrc, /if \(!parsed\.ok\) throw new HttpsError\("invalid-argument"/);
  assert.match(fnSrc, /resource-exhausted/);
});

test("Firestore rules refuse opt-in without consent", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /function hasStaffMarketingConsent\(data\)/);
  assert.match(rules, /function optInRequestHasConsent\(\)/);
  const users = rulesBlock(rules, "/users/{userId}");
  assert.match(users, /allow create:[\s\S]*!createsServiceMemberWithoutConsent\(\)/);
  assert.match(users, /allow update:[\s\S]*!startsServiceMembershipWithoutConsent\(\)/);
  assert.match(rules, /function startsServiceMembershipWithoutConsent\(\) \{[\s\S]*?!isServiceMemberFlag\(resource\.data\)/, "only the 0 → 1 transition needs consent");
  assert.match(rulesBlock(rules, "/workerAssociationRequests/{id}"), /allow create: if signedIn\(\) && optInRequestHasConsent\(\);/);
  const roles = rulesBlock(rules, "/roleRequests/{id}");
  assert.match(roles, /allow create: if signedIn\(\)[\s\S]*masterAdminAssignment[\s\S]*optInRequestHasConsent\(\)/);
  assert.doesNotMatch(roles, /allow create, read/);
});

test("every opt-in path requires the ticked box before writing", () => {
  const portal = read("patron-portal-app.js");
  const elect = portal.slice(portal.indexOf("async function electBecomeServiceMember"), portal.indexOf("async function submitServiceMemberRequest"));
  assert.ok(elect.indexOf('takeStaffConsent("elect"') > 0 && elect.indexOf('takeStaffConsent("elect"') < elect.indexOf('collection("users")'), "elect checks consent before the users write");
  assert.match(elect, /marketingMediaConsent: consent/);

  const submit = portal.slice(portal.indexOf("async function submitServiceMemberRequest"), portal.indexOf("async function loadServiceMemberAdmin"));
  assert.ok(submit.indexOf('takeStaffConsent("request"') > 0 && submit.indexOf('takeStaffConsent("request"') < submit.indexOf('collection("roleRequests")'), "request checks consent before any request doc");
  assert.match(submit, /\.\.\.staffConsentApi\(\)\.requestStamp\(consent\)/);
  assert.match(submit, /marketingMediaConsent: consent/);
  assert.match(portal, /function takeStaffConsent\([\s\S]*?if \(!api \|\| !form\?\.isChecked\(\)\)/, "fails closed when the module or tick is missing");
  assert.match(portal, /designationStamp\?\.\(request\)/, "Review & elect approve copies the stamp");
  assert.match(portal, /bind\("staffConsentWithdrawBtn", withdrawStaffConsent\)/);
  assert.match(portal, /window\.confirm\(staffConsentText\("withdrawConfirm"\)\)/);

  const role = read("role-request-app.js");
  const roleSubmit = role.slice(role.indexOf("async function submitRoleRequest"));
  assert.ok(roleSubmit.indexOf("consentForm?.isChecked()") > 0 && roleSubmit.indexOf("consentForm?.isChecked()") < roleSubmit.indexOf('collection("roleRequests")'));
  assert.match(roleSubmit, /\.\.\.consentApi\(\)\.requestStamp\(consent\)/);
  assert.match(roleSubmit, /marketingMediaConsent: consent/);

  const admin = read("admin-app.js");
  assert.match(admin, /FLOQRStaffMarketingConsent\?\.designationStamp\?\.\(row\.request\)/, "Club Admin approve copies the stamp");
  assert.match(admin, /staffConsentLabel\(uid\)/, "Employee roster shows consent");
  assert.match(admin, /staffConsentLabel\(row\.uid\)/, "Featured staff rows show consent");
  assert.match(admin, /function featuredStaffConsentPayload\(featured\)/, "photo attestation workflow unchanged");

  for (const [page, app, mounts] of [
    ["patron-portal.html", "patron-portal-app.js", ["becomeSmConsentMount", "smRequestConsentMount", "staffConsentGiveMount", "staffConsentManageCard"]],
    ["role-request.html", "role-request-app.js", ["roleConsentMount"]],
    ["admin.html", "admin-app.js", []]
  ]) {
    const html = read(page);
    const lib = html.indexOf("floqr-staff-marketing-consent.js");
    assert.ok(lib > 0 && lib < html.indexOf(`./${app}`), `${page} loads the consent module before ${app}`);
    for (const id of mounts) assert.match(html, new RegExp(`id="${id}"`), `${page} has #${id}`);
  }
  const roleHtml = read("role-request.html");
  assert.ok(roleHtml.indexOf("help-attach.js") < roleHtml.indexOf("helper-popouts.js"), "help-attach loads before helper-popouts");
});

test("i18n: 20 staffConsent keys in all 11 packs, brands untranslated, help in every source", () => {
  const CHROME = objectLiteral(read("floqr-i18n.js"), "const CHROME = ");
  const keys = Object.keys(client.EN);
  assert.equal(keys.length, 20);
  for (const key of keys) assert.equal(CHROME.en[key], client.EN[key], `en ${key} matches the module`);
  for (const lang of CHROME_LANGS) {
    for (const key of keys) assert.ok(String(CHROME[lang][key] || "").trim(), `${lang} ${key}`);
    for (const brand of ["Instagram", "Facebook", "TikTok", "YouTube"]) assert.ok(CHROME[lang]["staffConsent.p2"].includes(brand), `${lang} keeps ${brand}`);
    assert.ok(CHROME[lang]["staffConsent.statusGiven"].includes("{date}"), `${lang} keeps {date}`);
    if (lang !== "en") assert.notEqual(CHROME[lang]["staffConsent.p1"], client.EN["staffConsent.p1"], `${lang} is translated`);
  }
  assert.equal(analyze().ok, true);

  const id = client.HELP.id;
  const helpSrc = read("floqr-i18n-help.js");
  const packs = objectLiteral(helpSrc, "const packs = ");
  for (const lang of HELP_LANGS) {
    assert.ok(packs[lang][id]?.title && packs[lang][id]?.body, `help ${lang}`);
    assert.ok(packs[lang][id].body.includes("TikTok"), `help ${lang} keeps brands`);
  }
  assert.equal(JSON.parse(read("scripts/_help-en.json"))[id].body, client.HELP.body);
  const repo = read("floqai-help-repository.js");
  const entry = repo.slice(repo.indexOf(`id: "${id}"`), repo.indexOf("page:", repo.indexOf(`id: "${id}"`)));
  assert.ok(entry.includes(JSON.stringify(client.HELP.body)), "repository body matches");
  assert.match(entry, /audiences: \["patron", "serviceMember", "venueAdmin"\]/);
  assert.match(read("patron-portal.html"), /data-floqr-help-id="help-staff-marketing-consent"/);
});
