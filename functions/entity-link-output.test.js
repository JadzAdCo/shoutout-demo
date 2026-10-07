"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadShowcase() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("floqr-temp-qa-showcase.js"), sandbox, { filename: "floqr-temp-qa-showcase.js" });
  return sandbox.FLOQRTempQaShowcase;
}

test("Entity Management venue links open a copyable output panel instead of navigating", () => {
  const src = read("entity-management.js");
  for (const label of ["Open Club Admin", "Display 1", "Display 2", "Public profile", "Xibo Diag"]) {
    assert.ok(src.includes(`label: "${label}"`), `${label} link output entry`);
  }
  assert.match(src, /data-entity-link="\$\{esc\(kind\)\}"/);
  assert.match(src, /id="entityLinkOutput"/);
  assert.match(src, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(src, /<a class="buttonlike" href="\$\{esc\((adminUrl|displayUrl|display2Url|profileUrl)\)\}"/);
});

test("Xibo Diag links use display-error.html per board with no cache-bust", () => {
  const src = read("entity-management.js");
  assert.match(src, /new URL\("\.\/display-error\.html", window\.location\.href\)/);
  assert.match(src, /searchParams\.set\("reason", "xibo_page_load_error"\)/);
  assert.match(src, /xiboDiagUrl\(id, 1\)/);
  assert.match(src, /xiboDiagUrl\(id, 2\)/);
  const fn = src.slice(src.indexOf("function xiboDiagUrl"), src.indexOf("function clubLinkOutputs"));
  assert.doesNotMatch(fn, /"v"|appVersion/);
});

test("Application access switch explains itself and the link panel is responsive", () => {
  const src = read("entity-management.js");
  assert.match(src, /Allow application access/);
  assert.match(src, /Club Admin is locked, the venue is hidden from Search/);
  const css = read("admin.css");
  assert.match(css, /\.entity-link-output\{/);
  assert.match(css, /@media\(max-width:1024px\)\{\s*\.entity-link-buttons/);
  assert.match(css, /@media\(max-width:560px\)\{\s*\.entity-link-buttons\{display:grid;grid-template-columns:1fr 1fr/);
});

test("tel: and mailto: links stay links without underline on every styles.css page", () => {
  const css = read("styles.css");
  assert.match(css, /a\[href\^="tel:"\],a\[href\^="mailto:"\]\{text-decoration:none!important\}/);
  const profile = read("club-profile-app.js");
  assert.match(profile, /href="tel:\$\{esc\(phone\)\}"/);
  assert.match(profile, /href="mailto:\$\{esc\(email\)\}"/);
});

test("club profile labels the FloqR handle as the Mingl handle", () => {
  assert.match(read("club-profile-app.js"), /club-mingl-handle" title="Mingl handle">Mingl <small>/);
});

test("Papi's ClubTech 64x48 busboy and Maya VIP room photos are wired and shipped", () => {
  const club = loadShowcase().clubRecord(1, true);
  const titles = club.publicGallery.map(item => item.title);
  assert.ok(titles.includes("BusBoy - Papi's ClubTech Led 64x48 Mobile display"));
  assert.ok(!titles.includes("Busboy — DonPapi LED wall"));
  for (const file of ["busboy-papis-clubtech-64x48.jpg", "club-aurelia-vip-maya-guests.jpg", "club-aurelia-vip-maya-busboy-64x48.jpg"]) {
    assert.ok(club.publicGallery.some(item => String(item.mediaUrl).endsWith(`/images/temp-qa/${file}`)), `${file} in gallery`);
    assert.ok(fs.existsSync(path.join(root, "images", "temp-qa", file)), `${file} exists`);
  }
  const busboy = club.featuredStaff.find(person => person.publicProfileType === "busBoy");
  assert.ok(busboy, "busboy staff card");
  assert.doesNotMatch(JSON.stringify(busboy), /busboy-papis-clubtech/);
});

test("club profile page has no mojibake punctuation", () => {
  const html = read("club-profile.html");
  assert.doesNotMatch(html, /â€|Ã—/);
  assert.match(html, /Tonight&rsquo;s network/);
});
