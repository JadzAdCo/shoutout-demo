"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const headless = require("./headless-shoutout-core");
const shout = require("./botdee-shoutout-smartview");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("core does not import SMARTview; SMARTview is optional preview", () => {
  const core = read("functions/headless-shoutout-core.js");
  assert.doesNotMatch(core, /botdee-shoutout-smartview/);
  assert.doesNotMatch(core, /botDeeShoutOut/);
  const commerce = read("functions/commerce-functions.js");
  assert.match(commerce, /startShoutOutCheckout/);
  assert.doesNotMatch(commerce, /botdee-shoutout-smartview/);
  const smart = read("functions/botdee-shoutout-smartview.js");
  assert.match(smart, /headless-shoutout-core/);
  assert.match(smart, /never require this module/);
});

test("interactive draft asks for template, handle, and media", () => {
  const parsed = headless.parseShoutOutExecute(
    "throw a shoutout at Decades that says Happy birthday Maya"
  );
  const draft = headless.mergeInteractiveDraft({}, parsed);
  assert.equal(draft.clubQuery, "decades-washington-dc");
  assert.equal(draft.message, "Happy birthday Maya");
  assert.equal(draft.templateChosen, false);
  assert.deepEqual(headless.interactiveNeeds(draft).sort(), ["handle", "media", "template"]);
  assert.equal(headless.isInteractiveFollowUp("Traditional", draft), true);
  assert.equal(headless.isInteractiveFollowUp("include my handle", draft), true);
  assert.equal(headless.isInteractiveFollowUp("text only", draft), true);
  assert.equal(headless.isInteractiveFollowUp("throw it", draft), true);
  assert.equal(headless.isInteractiveFollowUp("hello", draft), false);
});

test("one-shot extras complete the interactive draft", () => {
  const parsed = headless.parseShoutOutExecute(
    "throw a traditional shoutout at Decades that says Happy birthday Maya with my handle text only"
  );
  const draft = headless.mergeInteractiveDraft({}, parsed);
  assert.equal(draft.templateId, "blackwhite");
  assert.equal(draft.templateChosen, true);
  assert.equal(draft.handleDecision, "include");
  assert.equal(draft.mediaDecision, "none");
  assert.ok(headless.interactiveNeeds(draft).includes("handle"));
  const withHandle = headless.mergeInteractiveDraft(draft, {attribution: "@Maya"});
  assert.equal(withHandle.attribution, "@Maya");
  assert.deepEqual(headless.interactiveNeeds(withHandle), []);
});

test("throw it skips remaining extras; photo asks compose", () => {
  const base = headless.mergeInteractiveDraft({}, headless.parseShoutOutExecute(
    "throw a shoutout at Aurelia that says We love you Priya"
  ));
  const skipped = headless.mergeInteractiveDraft(base, {skipExtras: true});
  assert.deepEqual(headless.interactiveNeeds(skipped), []);
  const photo = headless.mergeInteractiveDraft(base, headless.parseShoutOutExecute("with a photo"));
  assert.equal(photo.mediaDecision, "compose");
  assert.ok(headless.interactiveNeeds(photo).includes("compose"));
});

test("API compose still defaults Traditional without SMARTview", () => {
  const composed = headless.composeShoutOutPayload({
    clubLocationId: "decades-washington-dc",
    venue: {locationName: "Decades", VenueSupports96x48: 1},
    message: "Hello from the table"
  });
  assert.equal(composed.ok, true);
  assert.equal(composed.templateId, "blackwhite");
  assert.equal(composed.shoutout.includeAttribution, false);
  assert.equal(composed.shoutout.mediaUrl, "");
});

test("API compose honors handle + halloween from the payload", () => {
  const composed = headless.composeShoutOutPayload({
    clubLocationId: "decades-washington-dc",
    venue: {locationName: "Decades"},
    message: "BOO",
    templateId: "classicHalloween",
    includeAttribution: true,
    attribution: "DonPapi"
  });
  assert.equal(composed.priceCents, 1500);
  assert.equal(composed.shoutout.includeAttribution, true);
  assert.equal(composed.shoutout.attribution, "@DonPapi");
});

test("ShoutOut SMARTview paints a draft preview without submitting", () => {
  const draft = headless.mergeInteractiveDraft({}, headless.parseShoutOutExecute(
    "throw a shoutout at Decades that says Happy birthday Maya"
  ));
  const view = shout.buildShoutOutSmartView({draft, nowMs: Date.parse("2026-11-19T12:00:00.000Z")});
  assert.equal(view.kind, "botDeeShoutOut");
  assert.equal(view.schemaVersion, shout.SCHEMA_VERSION);
  assert.equal(view.mode, "draft");
  assert.ok(view.needs.includes("template"));
  assert.match(view.previewHref, /^\.\/display\.html\?/);
  assert.match(view.previewHref, /preview=1/);
  assert.doesNotMatch(view.previewHref, /[?&]v=/);
  assert.ok(view.templates.some(row => row.id === "blackwhite"));
});

test("BOT DEE session collects extras before mint; FloqR callable stays one-shot", () => {
  const session = read("functions/bot-dee-functions.js");
  assert.match(session, /interactiveNeeds/);
  assert.match(session, /buildShoutOutSmartView/);
  assert.match(session, /persistHeadlessShoutOutDraft/);
  assert.match(session, /isInteractiveFollowUp/);
  const commerce = read("functions/commerce-functions.js");
  assert.doesNotMatch(commerce, /interactiveNeeds/);
  const client = read("botdee-smartview.js");
  assert.match(client, /botDeeShoutOut/);
  assert.match(client, /renderShoutOutCard/);
});
