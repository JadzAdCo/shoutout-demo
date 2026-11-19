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

test("bare yes answers the current step and does not mint", () => {
  const draft = headless.mergeInteractiveDraft({}, headless.parseShoutOutExecute(
    "throw a shoutout at Decades that says Happy birthday Maya"
  ));
  const yes = headless.parseShoutOutExecute("yes");
  headless.applyBareInteractiveReply(draft, yes, "yes");
  assert.equal(yes.confirmSubmit, false);
  assert.equal(yes.templateId, "blackwhite");
  const afterTemplate = headless.mergeInteractiveDraft(draft, yes);
  assert.equal(afterTemplate.templateChosen, true);
  const handleYes = headless.parseShoutOutExecute("yes");
  headless.applyBareInteractiveReply(afterTemplate, handleYes, "ok");
  assert.equal(handleYes.handleDecision, "include");
  assert.equal(handleYes.confirmSubmit, false);
  assert.equal(headless.isInteractiveFollowUp("no", afterTemplate), true);
  const noHandle = headless.parseShoutOutExecute("no");
  headless.applyBareInteractiveReply(afterTemplate, noHandle, "no");
  assert.equal(noHandle.handleDecision, "skip");
  assert.equal(noHandle.confirmSubmit, false);
  const ready = headless.mergeInteractiveDraft(afterTemplate, {
    mediaDecision: "none",
    handleDecision: "include",
    attribution: "@Maya"
  });
  assert.deepEqual(headless.interactiveNeeds(ready), []);
  const noReady = headless.parseShoutOutExecute("no");
  headless.applyBareInteractiveReply(ready, noReady, "no");
  assert.equal(noReady.confirmSubmit, false);
});

test("a new throw does not keep leftover extras", () => {
  const first = headless.mergeInteractiveDraft({}, headless.parseShoutOutExecute(
    "throw a halloween shoutout at Decades that says BOO with my handle"
  ));
  assert.equal(first.templateId, "classicHalloween");
  assert.equal(first.handleDecision, "include");
  const second = headless.mergeInteractiveDraft(first, headless.parseShoutOutExecute(
    "throw a shoutout at Aurelia that says We love you Priya"
  ));
  assert.equal(second.clubQuery, "temp-democlub-1");
  assert.equal(second.message, "We love you Priya");
  assert.equal(second.templateId, "");
  assert.equal(second.templateChosen, false);
  assert.equal(second.handleDecision, "");
  assert.deepEqual(headless.interactiveNeeds(second).sort(), ["handle", "media", "template"]);
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

test("ShoutOut SMARTpreview paints a draft preview without submitting", () => {
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
  assert.deepEqual(view.previewLines, ["HAPPY BIRTHDAY", "MAYA"]);
  assert.equal(view.boardSkin, "traditional");
  assert.equal(view.currentStep, "template");
});

test("ShoutOut SMARTpreview LED replica is not an iframe of display.html", () => {
  const client = read("botdee-smartview.js");
  const css = read("botdee-smartview.css");
  assert.match(client, /botdee-so-board/);
  assert.match(client, /botdee-so-step/);
  assert.match(client, /dockShoutOutPreview/);
  assert.match(client, /ShoutOut SMARTpreview/);
  assert.match(css, /data-skin="halloween"/);
  const cardFn = client.slice(client.indexOf("function renderShoutOutCard"), client.indexOf("function bindShoutOutCard"));
  assert.doesNotMatch(cardFn, /<iframe/);
  const chat = read("bot-dee-chat.js");
  assert.match(chat, /applyShoutOutPreviewFromViews/);
  const page = read("botdee.html");
  assert.match(page, /id="botDeeShoutOutPreviewDock"/);
  const session = read("functions/bot-dee-functions.js");
  assert.match(session, /shoutOutPreview: "closed"/);
  assert.match(session, /applyBareInteractiveReply/);
  assert.doesNotMatch(session, /parsed\.confirmSubmit = true/);
  assert.match(session, /isBareNegative\(userPrompt\)/);
  const tryFn = session.slice(session.indexOf("async function tryHeadlessShoutOut"), session.indexOf("function localSession"));
  assert.ok(tryFn.indexOf("isBareNegative") < tryFn.indexOf("startShoutOutCheckout"));
  assert.match(session, /result\?\.ok && \(result\.checkoutUrl \|\| result\.shoutoutId\)/);
  const chatStart = chat.indexOf("function startNewChat");
  const chatRestore = chat.indexOf("function restoreTurns");
  assert.match(chat.slice(chatStart, chatStart + 400), /clearShoutOutPreviewDock/);
  assert.match(chat.slice(chatRestore, chatRestore + 400), /clearShoutOutPreviewDock/);
});

test("Master Admin SMARTpreview mocks match packaged catalog", () => {
  const file = path.join(root, "botdee-smartpreview-mock.json");
  assert.ok(fs.existsSync(file), "commit botdee-smartpreview-mock.json");
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(payload.views, shout.mockCatalog());
  assert.equal(payload.views.length, 5);
  assert.equal(payload.views[0].kind, "botDeeShoutOut");
  assert.doesNotMatch(JSON.stringify(payload.views), /[?&]v=/);
  const master = read("master-admin.html");
  assert.match(master, /data-botdee-page="smartpreview"/);
  assert.match(master, /id="botDeeMasterSmartPreviewDemo"/);
  assert.match(master, /id="botDeeMasterLoadSmartPreview"/);
  assert.match(read("master-admin-app.js"), /botDeeMasterSmartPreviewDemo/);
  assert.match(read("master-feature-services.js"), /loadSmartPreviewDemos/);
  assert.match(read("botdee-upgrade-ui.js"), /botdee-smartpreview-mock\.json/);
  assert.doesNotMatch(read("functions/headless-shoutout-core.js"), /botdee-smartpreview-mock/);
});

test("BOT DEE session collects extras before mint; FloqR callable stays one-shot", () => {
  const session = read("functions/bot-dee-functions.js");
  assert.match(session, /interactiveNeeds/);
  assert.match(session, /buildShoutOutSmartView/);
  assert.match(session, /persistHeadlessShoutOutDraft/);
  assert.match(session, /isInteractiveFollowUp/);
  const commerce = read("functions/commerce-functions.js");
  assert.doesNotMatch(commerce, /interactiveNeeds/);
  assert.match(commerce, /notifyClubPendingHeadlessShoutOut/);
  assert.match(commerce, /headlessClubInboxAt/);
  assert.doesNotMatch(commerce, /fulfillmentStatus === "submitted-for-club-approval"/);
  const client = read("botdee-smartview.js");
  assert.match(client, /botDeeShoutOut/);
  assert.match(client, /renderShoutOutCard/);
  assert.match(client, /mode === "draft" \|\| mode === "ready"/);
});
