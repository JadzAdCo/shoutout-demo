"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const seed = require("./bartr-seed-core");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function bracedBlock(source, startToken) {
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `missing ${startToken}`);
  let depth = 0;
  for (let i = source.indexOf("{", start + startToken.length); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unclosed ${startToken}`);
}

function callableBody(source, name) {
  const start = source.indexOf(`exports.${name} = onCall(`);
  assert.ok(start >= 0, `missing callable ${name}`);
  const end = source.indexOf("\nexports.", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

test("no public onRequest seed writer remains in Functions", () => {
  const files = fs.readdirSync(__dirname).filter(file => file.endsWith(".js") && !file.endsWith(".test.js"));
  const httpExports = [];
  files.forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    for (const match of source.matchAll(/exports\.(\w+)\s*=\s*onRequest\(/g)) httpExports.push(match[1]);
  });
  assert.ok(httpExports.length > 0, "scan found the webhook exports");
  assert.deepEqual(httpExports.filter(name => /seed/i.test(name)), []);
  assert.doesNotMatch(read("functions/commerce-functions.js"), /seedLucyCobraBartrCatalogHttp/);
});

test("no client page or script calls the removed HTTP seed URL", () => {
  const clientFiles = fs.readdirSync(root).filter(file => /\.(html|js)$/.test(file));
  clientFiles.forEach(file => {
    assert.doesNotMatch(read(file), /seedLucyCobraBartrCatalogHttp/, `${file} still references the HTTP seed`);
  });
});

test("seedLucyCobraBartrCatalog requires Master Admin + SOS2FA + reason and writes a chained audit", () => {
  const body = callableBody(read("functions/commerce-functions.js"), "seedLucyCobraBartrCatalog");
  assert.match(body, /audit\.assertAdmin\(request, "bartr\.seed"\)/);
  assert.match(body, /validateReason\(request\.data\?\.reason\)/);
  assert.match(body, /writeChainedAudit\(audit\.auditRecord\(request, \{\s*eventType: "bartr\.catalog_seeded"/);
  assert.match(body, /sessionId,/);
  assert.ok(body.indexOf("assertAdmin") < body.indexOf("db.collection"), "gate runs before any read or write");
  assert.match(body, /batch\.create\(/, "products are created, never overwritten");
  assert.doesNotMatch(body, /\.update\(|commerceEnabled: true,/);
  assert.match(body, /missingProfilePatch\(/);

  const helpers = read("functions/feature-services-functions.js");
  const assertAdmin = bracedBlock(helpers, "async function assertAdmin(");
  assert.match(assertAdmin, /assertSos2faSession\(request\)/);
  assert.match(assertAdmin, /eventType: `\$\{eventType\}\.denied`/);
  assert.match(assertAdmin, /writeUnchainedAudit\(/);
  const sos2fa = bracedBlock(read("functions/sos2fa-functions.js"), "async function assertSos2faSession(");
  assert.match(sos2fa, /assertSuperAdmin\(request\)/);
  assert.match(sos2fa, /expiresAtMs/);
});

test("seed page sends the SOS2FA session and a reason through the callable", () => {
  const page = read("seed-v29-09-14.html");
  assert.match(page, /httpsCallable\("seedLucyCobraBartrCatalog"\)/);
  assert.match(page, /reason, sos2faSessionId/);
  assert.match(page, /sos2fa\.js\?v=/);
  assert.match(page, /FLOQRSessionShell\.bind\(/);
  assert.doesNotMatch(page, /signInWithPopup|cloudfunctions\.net/);
});

test("catalog seed is missing-only: existing profile values and products are kept", () => {
  assert.equal(seed.LUCY_COBRA_CATALOG.length, 20);
  assert.equal(new Set(seed.LUCY_COBRA_CATALOG.map(item => item.seedKey)).size, 20);

  const defaults = seed.sellerProfileDefaults({displayName: "Lucy", email: "lucy@example.com"});
  const patch = seed.missingProfilePatch({
    commerceEnabled: false,
    commerceStoreName: "Lucy's Own Shop",
    commerceRefundPolicy: "",
    country: "France"
  }, defaults);
  assert.deepEqual(Object.keys(patch).sort(), ["commerceContact", "commerceRefundPolicy", "publicProfileVisibility"]);
  assert.equal(patch.commerceContact, "lucy@example.com");

  const none = seed.missingProfilePatch({...defaults}, defaults);
  assert.deepEqual(none, {});
  assert.equal("commerceContact" in seed.missingProfilePatch({}, seed.sellerProfileDefaults({})), false);

  const first = seed.LUCY_COBRA_CATALOG[0];
  const second = seed.LUCY_COBRA_CATALOG[1];
  const toCreate = seed.productsToCreate(seed.LUCY_COBRA_CATALOG, [
    {name: first.name.toUpperCase(), priceCents: 1},
    {name: "Renamed by the seller", seedKey: second.seedKey}
  ]);
  assert.equal(toCreate.length, 18);
  assert.ok(!toCreate.includes(first) && !toCreate.includes(second));
  assert.deepEqual(seed.productsToCreate(seed.LUCY_COBRA_CATALOG, seed.LUCY_COBRA_CATALOG), []);

  const doc = seed.productDoc(first, 0, {sellerUid: "u1", storeName: "S", contact: "c@example.com"});
  assert.equal(doc.seedKey, first.seedKey);
  assert.equal(doc.seededBy, "seedLucyCobraBartrCatalog");
  assert.match(doc.imageUrl, /^data:image\/svg\+xml/);
});

test("storage.rules: clubMedia writes and deletes need Master Admin or a Club Admin of that club", () => {
  const storage = read("storage.rules");
  const block = bracedBlock(storage, "match /clubMedia/{clubLocationId}/{allPaths=**}");
  assert.match(block, /allow read: if true;/, "Display / Search keep public reads");
  assert.match(block, /allow create, update: if isClubMediaManager\(clubLocationId\)/);
  assert.match(block, /allow delete: if isClubMediaManager\(clubLocationId\);/);
  assert.match(block, /request\.resource\.size < 60 \* 1024 \* 1024/);
  assert.match(block, /contentType\.matches\('image\/\.\*'\)/);
  assert.match(block, /contentType\.matches\('video\/\.\*'\)/);
  assert.doesNotMatch(block, /allow (create, update|delete): if request\.auth != null\s*(;|\n\s*&&)/);

  const manager = bracedBlock(storage, "function isClubMediaManager(");
  assert.match(manager, /isStorageMasterAdmin\(\)/);
  assert.match(manager, /isClubLocationAdmin\(clubId\)/);
  assert.match(manager, /hasActiveClubAdminAssignment\(clubId\)/);
  const location = bracedBlock(storage, "function isClubLocationAdmin(");
  ["adminUids", "masterAdminUids", "adminEmails"].forEach(field => assert.match(location, new RegExp(`"${field}"`)));
  const assignment = bracedBlock(storage, "function hasActiveClubAdminAssignment(");
  assert.match(assignment, /clubAdminAssignments\/\$\(clubId \+ "_" \+ request\.auth\.uid\)/);
  assert.match(assignment, /== "active"/);

  const docPaths = new Set([...storage.matchAll(/firestore\.(?:get|exists)\(\/databases\/\(default\)\/documents\/(\w+)\//g)].map(m => m[1]));
  assert.deepEqual([...docPaths].sort(), ["clubAdminAssignments", "clubLocations"], "Storage rules may read at most 2 Firestore docs");

  const emails = text => [...bracedBlock(text, "function " + (text === storage ? "isStorageMasterAdmin(" : "isMasterAdmin("))
    .matchAll(/"([^"]+@[^"]+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(emails(storage), emails(read("firestore.rules")), "Master Admin list matches firestore.rules");
});

test("Club Admin uploads use clubMedia/{locationId}/... so the club id is the first path segment", () => {
  const admin = read("admin-app.js");
  const paths = [...admin.matchAll(/`clubMedia\/\$\{(\w+)\}\//g)].map(m => m[1]);
  assert.ok(paths.length >= 3);
  assert.deepEqual([...new Set(paths)], ["locationId"]);
  assert.match(read("admin-marketing.js"), /`clubMedia\/\$\{locationId\}\/marketing`/);
});
