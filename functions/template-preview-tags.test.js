"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function loadModules() {
  const sandbox = { URL, console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("shared-data.js"), sandbox, { filename: "shared-data.js" });
  vm.runInNewContext(read("floqr-template-preview.js"), sandbox, { filename: "floqr-template-preview.js" });
  vm.runInNewContext(read("floqr-template-tags.js"), sandbox, { filename: "floqr-template-tags.js" });
  return sandbox;
}

function venue(sandbox, id) {
  return sandbox.FLOQRScreenDatapoints.applyVenue(plain(sandbox.SHOUTOUT_CLUB_LOCATIONS[id]));
}

test("preview picks made-up text and graphics by template type", () => {
  const s = loadModules();
  const P = s.FLOQRTemplatePreview;
  const t = s.SHOUTOUT_TEMPLATES;
  const heist = venue(s, "heist-washington-dc");

  const birthday = P.sampleFor(t.birthdayMedia, heist);
  assert.equal(birthday.kind, "splitMedia");
  assert.match(birthday.extra.media, /images\/template-preview\/sample-birthday\.jpg$/);
  assert.match(P.sampleFor(t.engagementMedia, heist).extra.media, /sample-romance\.jpg$/);
  assert.match(P.sampleFor(t.christine, heist).extra.media, /sample-club-night\.jpg$/);

  const football = P.sampleFor(t.zebbiesFootballTeamIntro, heist);
  assert.equal(football.main, "HEIST FOOTBALL INTRO");
  const members = JSON.parse(football.extra.teamMembers);
  assert.equal(members.length, 4);
  members.forEach((m, i) => assert.equal(m.mediaUrl, `./images/template-preview/football-player-${i + 1}.svg`));

  assert.equal(P.sampleFor(t.heistVaultDollars, heist).main, "@FloqrStar");
  const classic = P.sampleFor(t.blackwhite, heist).main;
  assert.equal(classic, classic.toUpperCase(), "classic board sample is uppercase");
  assert.doesNotMatch(classic, /\p{Extended_Pictographic}/u, "classic board sample has no emoji");
  assert.equal(P.sampleFor(t.car, heist).main, "RIDIN' RARI");

  for (const file of ["sample-birthday.jpg", "sample-romance.jpg", "sample-club-night.jpg", "football-player-1.svg", "football-player-2.svg", "football-player-3.svg", "football-player-4.svg"]) {
    assert.ok(fs.existsSync(path.join(root, "images", "template-preview", file)), `${file} is packaged`);
  }
});

test("preview URL uses the board renderer without a cache key and only offered sizes", () => {
  const s = loadModules();
  const P = s.FLOQRTemplatePreview;
  const heist = venue(s, "heist-washington-dc");
  const url = new URL(P.previewUrl(s.SHOUTOUT_TEMPLATES.heistVaultDollars, { locationId: "heist-washington-dc", location: heist, formatId: "led-96x48", base: "https://example.test/app/index.html" }));
  assert.equal(url.pathname, "/app/display.html");
  assert.equal(url.searchParams.get("location"), "heist-washington-dc");
  assert.equal(url.searchParams.get("template"), "heistVaultDollars");
  assert.equal(url.searchParams.get("screen"), "led-96x48");
  assert.equal(url.searchParams.get("preview"), "1");
  assert.equal(url.searchParams.has("v"), false, "Display URLs never carry ?v=");
  assert.deepEqual(plain(P.formatsFor(s.SHOUTOUT_TEMPLATES.heistVaultDollars, heist)), ["led-96x48"]);
  assert.deepEqual(plain(P.formatsFor(s.SHOUTOUT_TEMPLATES.blackwhite, heist)), ["led-96x48", "led-64x32"]);
});

test("template roles: Administrator reads, writes and deletes; Manager reads and writes", () => {
  const s = loadModules();
  const T = s.FLOQRTemplateTags;
  assert.equal(T.roleFor({ isClubAdmin: true }).key, "administrator");
  assert.equal(T.roleFor({ roleDoc: { role: "manager", status: "active" } }).key, "manager");
  assert.equal(T.roleFor({ roleDoc: { role: "manager", status: "revoked" } }).key, "");
  assert.equal(T.roleFromPermissions(["manageTemplates", "administerTemplates"]), "administrator");
  assert.equal(T.roleFromPermissions(["manageTemplates"]), "manager");
  assert.equal(T.roleFromPermissions(["postAds"]), "");

  const admin = T.ROLES.administrator;
  const manager = T.ROLES.manager;
  assert.deepEqual([admin.canRead, admin.canWrite, admin.canDelete], [true, true, true]);
  assert.deepEqual([manager.canRead, manager.canWrite, manager.canDelete], [true, true, false]);

  const tags = T.addTag([], "  game   night ", manager);
  assert.deepEqual(plain(tags), ["game night"]);
  assert.deepEqual(plain(T.addTag(tags, "Game Night", manager)), ["game night"], "duplicate ignored");
  assert.throws(() => T.removeTag(tags, "game night", manager), /not-allowed/);
  assert.deepEqual(plain(T.removeTag(tags, "GAME NIGHT", admin)), []);
  assert.throws(() => T.addTag([], "x", T.NO_ROLE), /not-allowed/);
  assert.equal(T.normalizeTag("<b>vip</b>"), "bvip/b");
  assert.equal(T.tagDocId("heist-washington-dc", "heistVaultDollars"), "heist-washington-dc__heistVaultDollars");
  assert.equal(T.roleDocId("heist-washington-dc", "u1"), "heist-washington-dc_u1");
});

test("template tags cover every template offered at the venue", () => {
  const s = loadModules();
  const ids = s.FLOQRTemplateTags.templatesForVenue("heist-washington-dc", venue(s, "heist-washington-dc")).map((t) => t.id);
  assert.ok(ids.includes("blackwhite"));
  assert.ok(ids.includes("heistVaultDollars"));
  assert.ok(ids.includes("zebbiesFootballTeamIntro"));
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
});

test("Firestore rules enforce the template roles", () => {
  const rules = read("firestore.rules");
  const tagsBlock = rules.slice(rules.indexOf("match /venueTemplateTags/{tagId}"), rules.indexOf("match /venueTemplateTags/{tagId}") + 900);
  assert.match(tagsBlock, /allow read: if true;/);
  assert.match(tagsBlock, /allow create: if validVenueTemplateTags\(tagId\)\s*&& canManageTemplates/);
  assert.match(tagsBlock, /canManageTemplates\(resource\.data\.clubLocationId\) && request\.resource\.data\.tags\.hasAll\(resource\.data\.tags\)/);
  assert.match(tagsBlock, /allow delete: if signedIn\(\) && canAdministerTemplates/);
  const rolesBlock = rules.slice(rules.indexOf("match /venueTemplateRoles/{roleId}"), rules.indexOf("match /venueTemplateTags/{tagId}"));
  assert.match(rolesBlock, /request\.resource\.data\.role in \["administrator", "manager"\]/);
  assert.match(rolesBlock, /isClubManager\(request\.resource\.data\.clubLocationId\)/);
  assert.match(rules, /function canAdministerTemplates\(clubId\) \{\s*return isClubManager\(clubId\) \|\| hasTemplateRole\(clubId, \["administrator"\]\);/);
  assert.match(rules, /FLOQR FIRESTORE RULES VERSION: s3\.1\.11-template-rbac/);
});

test("Preview button, tag search and role assignment are wired", () => {
  const app = read("patron-app.js");
  assert.match(app, /data-template-preview="\$\{esc\(template\.id\)\}"/);
  assert.match(app, /window\.FLOQRTemplatePreview\?\.open\(template/);
  assert.match(app, /\$\{venueTagsFor\(t\)\.join\(" "\)\}/);
  const index = read("index.html");
  assert.ok(index.indexOf("floqr-template-preview.js") < index.indexOf("patron-app.js"));
  assert.ok(index.indexOf("floqr-template-tags.js") < index.indexOf("patron-app.js"));
  const rep = read("admin-rep-extension.js");
  assert.match(rep, /\["administerTemplates", /);
  assert.match(rep, /\["manageTemplates", /);
  assert.match(rep, /collection\("venueTemplateRoles"\)/);
  assert.match(rep, /type: "templateRole"/);
  const page = read("template-tags.html");
  assert.match(page, /floqr-session-shell\.js/);
  assert.ok(page.indexOf("firebase-config.js") < page.indexOf("floqr-session-shell.js"));
  assert.match(read("patron-portal-app.js"), /template-tags\\\.html/);
});
