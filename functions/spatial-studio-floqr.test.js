"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const oidc = require("./floqr-oidc-core");
const grants = require("./spatial-grant-core");
const sinema = require("./sinema-scene-core");

const SECRET = "test-floqr-oidc-hmac-secret-please-rotate";
const NOW = Date.parse("2026-11-15T12:00:00.000Z");

function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  return { verifier, challenge: oidc.s256Challenge(verifier) };
}

test("auth audit: FloqR reuses Firebase Auth; no parallel signup surface", () => {
  const gate = read("floqr-auth-gate.js");
  assert.match(gate, /private pages redirect to home login/);
  assert.match(gate, /returnTo/);
  assert.match(gate, /IS_MASTER/);
  assert.doesNotMatch(gate, /createUserWithEmailAndPassword/);

  const shell = read("floqr-session-shell.js");
  assert.match(shell, /profileRequired/);
  assert.match(shell, /returnTo/);
  assert.match(shell, /redirectToLogin/);

  const cfg = read("firebase-config.js");
  assert.match(cfg, /shoutoutdemo-5b402/);

  const oidcHtml = read("floqr-oidc-authorize.html");
  assert.match(oidcHtml, /floqr-session-shell\.js/);
  assert.match(oidcHtml, /data-floqr-auth-chrome/);
  assert.match(oidcHtml, /id="oidcConsentStatus"/);
  assert.match(oidcHtml, /floqr-oidc-authorize\.js\?v=s3\.3\.020/);
  assert.doesNotMatch(oidcHtml, /data-floqr-feature=/);
  assert.doesNotMatch(oidcHtml, /Create an account|Sign up with FloqMedia|floqmedia signup/i);

  const oidcJs = read("floqr-oidc-authorize.js");
  assert.match(oidcJs, /FLOQRSessionShell/);
  assert.match(oidcJs, /popupBlocked/);
  assert.match(oidcJs, /issueFloqrOidcAuthCode/);
  assert.match(oidcJs, /setContinueBusy/);
  assert.match(oidcJs, /page\.oidc\.statusUnavailable/);
  assert.match(oidcJs, /not-found\|unimplemented\|internal/);
  assert.doesNotMatch(oidcJs, /createUserWithEmailAndPassword/);

  const sinemaHtml = read("sinema.html");
  assert.match(sinemaHtml, /data-floqr-feature="sinema"/);
  assert.match(sinemaHtml, /floqr-session-shell\.js/);
  assert.doesNotMatch(sinemaHtml, /product-parent-logo/);
});

test("OIDC public client: PKCE S256, JWT sub/iss/exp, localhost off by default", () => {
  const reg = oidc.floqmediaRegistration();
  assert.equal(reg.NEXT_PUBLIC_FLOQR_CLIENT_ID, "floqmedia-spatial-studio");
  assert.equal(reg.NEXT_PUBLIC_FLOQR_ISSUER, "https://jadzadco.github.io/shoutout-demo");
  assert.equal(reg.NEXT_PUBLIC_FLOQR_AUTHORIZE_URL, "https://jadzadco.github.io/shoutout-demo/floqr-oidc-authorize.html");
  assert.equal(reg.NEXT_PUBLIC_FLOQR_TOKEN_URL, oidc.TOKEN_URL);
  assert.equal(reg.code_challenge_method, "S256");
  assert.ok(reg.redirect_uris.every((uri) => uri.endsWith("/spatial-studio/auth/callback")));
  assert.ok(reg.redirect_uris.every((uri) => !uri.includes("localhost")));

  const { verifier, challenge } = pkce();
  const query = {
    client_id: oidc.CLIENT_ID,
    redirect_uri: "https://www.floqmedia.com/spatial-studio/auth/callback",
    response_type: "code",
    scope: "openid",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "csrf-state"
  };
  const ok = oidc.validateAuthorizeRequest(query);
  assert.equal(ok.ok, true);

  const badClient = oidc.validateAuthorizeRequest({ ...query, client_id: "other" });
  assert.equal(badClient.ok, false);
  assert.equal(badClient.redirect, false);

  const local = oidc.validateAuthorizeRequest({
    ...query,
    redirect_uri: "http://localhost:3000/spatial-studio/auth/callback"
  });
  assert.equal(local.ok, false);
  assert.equal(local.reason, "redirect_uri_denied");

  const localOk = oidc.validateAuthorizeRequest({
    ...query,
    redirect_uri: "http://localhost:3000/spatial-studio/auth/callback"
  }, { allowLocalhost: true });
  assert.equal(localOk.ok, true);

  const issued = oidc.issueAuthCode({
    ...ok,
    uid: "firebase-uid-1",
    displayName: "Pat Patron",
    email: "pat@example.com"
  }, { nowMs: NOW });
  const exchanged = oidc.exchangeAuthCode({
    grant_type: "authorization_code",
    code: issued.code,
    redirect_uri: query.redirect_uri,
    client_id: oidc.CLIENT_ID,
    code_verifier: verifier
  }, issued.record, SECRET, { nowMs: NOW, issuer: oidc.DEFAULT_ISSUER });
  assert.equal(exchanged.ok, true);
  const payload = oidc.decodeJwtPayload(exchanged.token.id_token);
  assert.equal(payload.sub, "firebase-uid-1");
  assert.equal(payload.iss, oidc.DEFAULT_ISSUER);
  assert.ok(payload.exp > payload.iat);
  assert.equal(payload.name, "Pat Patron");
  assert.equal(exchanged.token.token_type, "Bearer");

  const replay = oidc.exchangeAuthCode({
    grant_type: "authorization_code",
    code: issued.code,
    redirect_uri: query.redirect_uri,
    client_id: oidc.CLIENT_ID,
    code_verifier: verifier
  }, { ...issued.record, usedAtMs: NOW + 1 }, SECRET, { nowMs: NOW + 1 });
  assert.equal(replay.ok, false);

  const verified = oidc.verifyJwt(exchanged.token.access_token, SECRET, {
    nowMs: NOW,
    issuer: oidc.DEFAULT_ISSUER
  });
  assert.equal(verified.ok, true);
});

test("grant references only: FloqR clock, no tokens, Si-nema needs use_in_sinema", () => {
  const built = grants.buildGrantRef({
    projectId: "proj_dc_club",
    ownerFloqrSubject: "firebase-uid-1",
    destinationTenantId: "sinema-floqr",
    destinationType: "sinema",
    permissions: ["read", "use_in_sinema"],
    pinRevisionId: "rev_measured_1"
  }, { nowMs: NOW });
  assert.equal(built.ok, true);
  assert.equal(built.grant.revisionPolicy.clockOwner, "floqr-scene-save");
  assert.equal(built.grant.revisionPolicy.editableUntil, null);
  assert.equal(built.grant.revisionPolicy.pinRevisionId, "rev_measured_1");
  assert.equal(built.grant.status, "active");
  assert.ok(Date.parse(built.grant.expiresAt) - NOW === grants.GRANT_TTL_MS);

  const withToken = grants.buildGrantRef({
    projectId: "proj_dc_club",
    ownerFloqrSubject: "firebase-uid-1",
    destinationTenantId: "sinema-floqr",
    destinationType: "sinema",
    permissions: ["read", "use_in_sinema"],
    pinRevisionId: "rev_measured_1",
    access_token: "should-not-store"
  }, { nowMs: NOW });
  assert.equal(withToken.ok, false);
  assert.equal(withToken.reason, "tokens_forbidden");

  const noPerm = grants.buildGrantRef({
    projectId: "proj_dc_club",
    ownerFloqrSubject: "firebase-uid-1",
    destinationTenantId: "sinema-floqr",
    destinationType: "sinema",
    permissions: ["read"],
    pinRevisionId: "rev_measured_1"
  }, { nowMs: NOW });
  assert.equal(noPerm.ok, false);
  assert.equal(noPerm.reason, "sinema_requires_use_in_sinema");

  const otherTenant = grants.grantIsUsable(built.grant, {
    nowMs: NOW,
    destinationTenantId: "other-tenant",
    needPermission: "use_in_sinema"
  });
  assert.equal(otherTenant.ok, false);
  assert.equal(otherTenant.reason, "tenant_mismatch");

  const revoked = grants.revokeGrant(built.grant, { nowMs: NOW + 1000 });
  assert.equal(revoked.status, "revoked");
  assert.ok(revoked.cacheInvalidatedAt);
  assert.equal(grants.grantIsUsable(revoked, { nowMs: NOW + 1000 }).ok, false);

  const guest = grants.attachGuestDraft({ ...built.grant, ownerFloqrSubject: "" }, {
    ownerFloqrSubject: "firebase-uid-1",
    confirmed: false
  });
  assert.equal(guest.ok, false);
  assert.equal(guest.reason, "confirm_required");
  const attached = grants.attachGuestDraft({ ...built.grant, ownerFloqrSubject: "" }, {
    ownerFloqrSubject: "firebase-uid-1",
    confirmed: true,
    nowMs: NOW
  });
  assert.equal(attached.ok, true);
  assert.equal(attached.grant.guestAttachedConfirmed, true);
});

test("Si-nema pins revision and 48h clock from original FloqR save", () => {
  const built = grants.buildGrantRef({
    projectId: "proj_dc_club",
    ownerFloqrSubject: "firebase-uid-1",
    destinationTenantId: "sinema-floqr",
    destinationType: "sinema",
    permissions: ["read", "edit", "use_in_sinema"],
    pinRevisionId: "rev_measured_1"
  }, { nowMs: NOW });
  const loaded = sinema.virtualSetFromGrant(built.grant, { nowMs: NOW });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.virtualSet.pinRevisionId, "rev_measured_1");
  assert.equal(loaded.virtualSet.geometryCopied, false);
  assert.equal(loaded.virtualSet.geometryPreservation, "not_exact");
  assert.equal(loaded.virtualSet.worldAxes.z, "north");
  assert.equal(loaded.virtualSet.worldAxes.planY, "north");

  const pin = sinema.resolvePinnedRevision(built.grant, ["rev_measured_1", "rev_newer_2"]);
  assert.equal(pin.pinRevisionId, "rev_measured_1");
  assert.equal(pin.usedLatest, false);
  assert.deepEqual(pin.ignoredNewerRevisionIds, ["rev_newer_2"]);

  const created = sinema.createScene(built.grant, { notes: "set" }, { nowMs: NOW });
  const first = sinema.saveScene(created.scene, { notes: "first" }, { nowMs: NOW });
  assert.equal(first.ok, true);
  assert.equal(first.firstSave, true);
  assert.equal(first.scene.originalSavedAtMs, NOW);
  assert.equal(first.scene.editableUntilMs, NOW + sinema.EDIT_WINDOW_MS);

  const later = NOW + 60 * 60 * 1000;
  const second = sinema.saveScene(first.scene, { notes: "later" }, { nowMs: later });
  assert.equal(second.ok, true);
  assert.equal(second.scene.originalSavedAtMs, NOW);
  assert.equal(second.scene.editableUntilMs, first.scene.editableUntilMs);

  const closed = sinema.saveScene(second.scene, { notes: "too late" }, { nowMs: NOW + sinema.EDIT_WINDOW_MS + 1 });
  assert.equal(closed.ok, false);
  assert.equal(closed.reason, "edit_window_closed");

  const exceptional = sinema.saveScene(second.scene, { notes: "late" }, {
    nowMs: NOW + sinema.EDIT_WINDOW_MS + 1,
    exceptional: { authorized: true, reason: "owner-approved late edit", authorizedByUid: "master-1" }
  });
  assert.equal(exceptional.ok, true);
  assert.equal(exceptional.scene.originalSavedAtMs, NOW);

  const bump = sinema.saveScene(first.scene, { pinRevisionId: "rev_newer_2" }, { nowMs: later });
  assert.equal(bump.ok, false);
  assert.equal(bump.reason, "pin_revision_locked");
});

test("regression: ShoutOut display URLs, VIP floor viewer, no Search tile for Si-nema", () => {
  const display = read("display.html");
  assert.match(display, /display\.html\?location=<id> only/);
  assert.doesNotMatch(display, /\?screen=/);
  const display2 = read("display2.html");
  assert.match(display2, /display2\.html\?location=<id> only — never add \?v=/);

  const viewer = read("vip-floor-viewer.js");
  assert.match(viewer, /const DEMO_STATES/);
  assert.match(viewer, /const isPhone = \(\) => phoneMq\.matches/);
  assert.doesNotMatch(viewer, /spatial-studio|sinemaScenes|floqmedia-spatial-project/);

  const vip = read("vip.html");
  assert.match(vip, /data-floqr-feature="vipReservations"/);
  assert.match(vip, /vip-floor-viewer\.js/);

  const index = read("index.html");
  assert.doesNotMatch(index, /sinemaBtnCard|data-feature-key="sinema"/);
  assert.match(index, /id="shoutoutBtnCard"/);
  assert.match(index, /id="vipReservBtnCard"/);

  const rules = read("firestore.rules");
  assert.doesNotMatch(rules, /spatialGrantRefs|oidcAuthCodes|sinemaScenes/);
  const storage = read("storage.rules");
  assert.doesNotMatch(storage, /spatialGrantRefs|sinemaScenes|floqmedia-spatial/);
});

test("production rules stay unpublished; OIDC Functions deploy is the Continue path", () => {
  const draft = read("docs/spatial-studio-floqr-rules-draft.md");
  assert.match(draft, /NOT APPLIED/);
  const wiring = read("docs/FEATURE-WIRING.md");
  assert.match(wiring, /Si-nema/);
  assert.match(wiring, /firebase-deploy-spatial/);
  assert.match(wiring, /firestore\.rules/);
  const workflow = read(".github/workflows/functions-ci.yml");
  assert.match(workflow, /firebase-deploy-spatial/);
  assert.match(workflow, /firebase-deploy-features/);
  assert.match(workflow, /setFeatureServiceFlags/);
  assert.match(workflow, /Ensure FLOQR_OIDC_JWT_SECRET/);
  assert.ok(workflow.includes('if echo "$COMMIT_MSG" | grep -q \'\\[firebase-deploy-spatial\\]\''), "spatial tag is an independent if");
  assert.ok(workflow.includes('if echo "$COMMIT_MSG" | grep -q \'\\[firebase-deploy-features\\]\''), "features tag is an independent if");
  assert.ok(!workflow.includes('elif echo "$COMMIT_MSG" | grep -q \'\\[firebase-deploy-spatial\\]\''), "spatial is not elif-chained");
  assert.match(workflow, /issueFloqrOidcAuthCode/);
  const oidc = read("functions/floqr-oidc-functions.js");
  const grant = read("functions/spatial-grant-functions.js");
  assert.match(oidc, /invoker:\s*"public"/);
  assert.match(grant, /invoker:\s*"public"/);
  assert.match(oidc, /defineSecret\("FLOQR_OIDC_JWT_SECRET"\)/);
  assert.match(grant, /defineSecret\("FLOQR_OIDC_JWT_SECRET"\)/);
  assert.match(oidc, /secrets:\s*\[FLOQR_OIDC_JWT_SECRET\]/);
  assert.match(grant, /secrets:\s*\[FLOQR_OIDC_JWT_SECRET\]/);
});
