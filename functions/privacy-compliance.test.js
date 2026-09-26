"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function loadModule(rel, extras = {}) {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  const sandbox = {
    window: {},
    globalThis: {},
    navigator: extras.navigator || {},
    localStorage: {
      _data: {},
      getItem(key) { return this._data[key] || null; },
      setItem(key, value) { this._data[key] = String(value); }
    },
    console,
    Date,
    Array,
    String,
    Number,
    Object,
    Set,
    ...extras
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox;
}

test("FLOQRCanonical prefers www.floqr.com production origin", () => {
  const sandbox = loadModule("floqr-canonical.js", {
    location: {origin: "https://jadzadco.github.io", href: "https://jadzadco.github.io/shoutout-demo/"}
  });
  assert.equal(sandbox.FLOQRCanonical.PRODUCTION_ORIGIN, "https://www.floqr.com");
  assert.equal(sandbox.FLOQRCanonical.privacyPolicyCanonicalUrl(), "https://www.floqr.com/privacy.html");
  assert.equal(sandbox.FLOQRCanonical.doNotSellCanonicalUrl(), "https://www.floqr.com/privacy.html#do-not-sell");
  assert.match(sandbox.FLOQRCanonical.privacyPolicyUrl("s3.0.103"), /privacy\.html\?v=s3\.0\.103/);
});

test("FLOQRPrivacyPrefs blocks personalized ads for DNS / GPC / sharing false", () => {
  const sandbox = loadModule("floqr-privacy-prefs.js");
  const prefs = sandbox.FLOQRPrivacyPrefs;
  assert.equal(prefs.allowsPersonalizedAds({}), true);
  assert.equal(prefs.allowsPersonalizedAds({doNotSellOrShare: true}), false);
  assert.equal(prefs.allowsPersonalizedAds({dataSharingConsent: false}), false);
  assert.equal(prefs.allowsPersonalizedAds({dataSharingConsent: "no"}), false);
  assert.equal(prefs.allowsMarketing({marketingConsent: false}), false);
  assert.equal(prefs.allowsMarketing({}), true);
  assert.equal(prefs.allowsMarketing({}, {enforceOptIn: true}), false);
  assert.equal(prefs.allowsMarketing({marketingConsent: true}, {enforceOptIn: true}), true);
});

test("FLOQRPrivacyPrefs GPC detection stamps Do Not Sell patch", () => {
  const sandbox = loadModule("floqr-privacy-prefs.js", {
    navigator: {globalPrivacyControl: true}
  });
  const prefs = sandbox.FLOQRPrivacyPrefs;
  assert.equal(prefs.detectGpc(), true);
  assert.equal(prefs.allowsPersonalizedAds({}), false);
  const patch = prefs.patchFromGpc({});
  assert.equal(patch.doNotSellOrShare, true);
  assert.ok(patch.gpcAppliedAt);
});

test("FLOQRConsentMode denied defaults and updates from prefs", () => {
  const calls = [];
  const sandbox = loadModule("floqr-consent-mode.js", {
    gtag(...args) { calls.push(args); },
    FLOQRPrivacyPrefs: {
      truthy(v) { return v === true || v === 1; },
      allowsPersonalizedAds(profile) { return !profile.doNotSellOrShare; }
    }
  });
  assert.equal(sandbox.FLOQRConsentMode.applyDeniedDefaults(), true);
  assert.equal(calls[0][0], "consent");
  assert.equal(calls[0][1], "default");
  assert.equal(calls[0][2].ad_storage, "denied");
  assert.equal(sandbox.FLOQRConsentMode.updateFromPrefs({analyticsConsent: true, doNotSellOrShare: true}), true);
  const update = calls.find((c) => c[1] === "update");
  assert.equal(update[2].analytics_storage, "granted");
  assert.equal(update[2].ad_personalization, "denied");
});

test("ad scoreCampaign demotes targeted ads when personalized ads blocked", () => {
  const prefsCode = fs.readFileSync(path.join(root, "floqr-privacy-prefs.js"), "utf8");
  const adsCode = fs.readFileSync(path.join(root, "ad-campaigns.js"), "utf8");
  const sandbox = {
    window: {},
    globalThis: {},
    navigator: {},
    localStorage: {
      _data: {},
      getItem(key) { return this._data[key] || null; },
      setItem(key, value) { this._data[key] = String(value); }
    },
    document: {getElementById() { return null; }},
    firebase: undefined,
    Date,
    Array,
    String,
    Number,
    Object,
    Set,
    CSS: {escape: (s) => String(s).replace(/"/g, '\\"')}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(prefsCode, sandbox);
  vm.runInNewContext(adsCode, sandbox);
  const api = sandbox.FLOQRAdCampaigns;
  const campaign = {
    id: "t1",
    status: "live",
    targetMode: "targeted",
    targetTags: "Washington DC",
    slots: ["default"],
    weight: 10,
    isHouseFallback: false
  };
  const profile = {city: "Washington DC", doNotSellOrShare: true};
  assert.ok(api.scoreCampaign(campaign, profile, "default") <= -999);
  assert.ok(api.scoreCampaign(campaign, {city: "Washington DC"}, "default") > -999);
});

test("privacy DSAR module exports callables and portal wires them", () => {
  const dsar = fs.readFileSync(path.join(root, "functions/privacy-dsar-functions.js"), "utf8");
  const index = fs.readFileSync(path.join(root, "functions/index.js"), "utf8");
  const portal = fs.readFileSync(path.join(root, "patron-portal-app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "patron-portal.html"), "utf8");
  const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
  const policy = fs.readFileSync(path.join(root, "privacy.html"), "utf8");
  assert.match(dsar, /exports\.exportPatronData/);
  assert.match(dsar, /exports\.requestPatronDelete/);
  assert.match(dsar, /exports\.fulfillPatronDelete/);
  assert.match(index, /privacy-dsar-functions/);
  assert.match(portal, /exportPatronData/);
  assert.match(portal, /requestPatronDelete/);
  assert.match(portal, /doNotSellOrShare/);
  assert.match(portal, /applyGpcOnLoad/);
  assert.match(html, /id="privacyDoNotSell"/);
  assert.match(html, /floqr-privacy-prefs\.js\?v=s3\.0\.103/);
  assert.match(html, /privacy\.html/);
  assert.match(rules, /s3\.0\.103-privacy-consents-owner/);
  assert.match(rules, /resource\.data\.uid == request\.auth\.uid/);
  assert.match(policy, /www\.floqr\.com/);
  assert.match(policy, /id="do-not-sell"/);
});

test("marketing broadcast honors marketingConsent and doNotSellOrShare", () => {
  const src = fs.readFileSync(path.join(root, "functions/marketing-campaign-functions.js"), "utf8");
  assert.match(src, /marketingConsent/);
  assert.match(src, /doNotSellOrShare/);
  assert.match(src, /No eligible recipients after marketing consent/);
});
