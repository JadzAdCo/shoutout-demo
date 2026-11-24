"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const headless = require("./headless-shoutout-core");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("parseShoutOutExecute pulls club + message from chat", () => {
  const decades = headless.parseShoutOutExecute(
    "throw a shoutout at Decades Nightclub, Washington, DC that says Happy birthday Maya"
  );
  assert.equal(decades.clubQuery, "decades-washington-dc");
  assert.equal(decades.message, "Happy birthday Maya");

  const quoted = headless.parseShoutOutExecute('send a shoutout at Aurelia: "We love you Priya"');
  assert.equal(quoted.clubQuery, "temp-democlub-1");
  assert.equal(quoted.message, "We love you Priya");

  const halloween = headless.parseShoutOutExecute("throw a halloween shoutout at Lima Twist that says BOO");
  assert.equal(halloween.clubQuery, "lima-twist-washington-dc");
  assert.equal(halloween.templateId, "classicHalloween");
  assert.equal(halloween.message, "BOO");
  assert.equal(
    headless.parseShoutOutExecute("throw halloween shoutout at Decades that says BOO").templateId,
    "classicHalloween"
  );
  assert.equal(
    headless.parseShoutOutExecute("compose a halloween shoutout at Aurelia that says BOO").templateId,
    "classicHalloween"
  );

  const incomplete = headless.parseShoutOutExecute("throw a shoutout");
  assert.equal(incomplete.clubQuery, "");
  assert.equal(incomplete.message, "");

  const copyClub = headless.parseShoutOutExecute(
    "throw a shoutout at Decades that says see you at Aurelia tonight"
  );
  assert.equal(copyClub.clubQuery, "decades-washington-dc");
  assert.equal(copyClub.message, "see you at Aurelia tonight");
  assert.equal(copyClub.templateId, "");

  const halloweenCopy = headless.parseShoutOutExecute(
    "throw a shoutout at Decades that says Happy Halloween"
  );
  assert.equal(halloweenCopy.clubQuery, "decades-washington-dc");
  assert.equal(halloweenCopy.templateId, "");
  assert.equal(halloweenCopy.message, "Happy Halloween");
});

test("composeShoutOutPayload defaults Traditional board and venue LED", () => {
  const venue = {
    locationName: "Decades",
    brandName: "Decades",
    city: "Washington",
    fullAddress: "1215 U St NW, Washington, DC",
    VenueSupports96x48: 1,
    VenueSupports64x48: 1,
    VenueSupports64x32: 0,
    primaryDisplayScreenFormatId: "led-64x48"
  };
  const composed = headless.composeShoutOutPayload({
    clubLocationId: "decades-washington-dc",
    venue,
    message: "Happy birthday from the whole table love you tonight"
  });
  assert.equal(composed.ok, true);
  assert.equal(composed.templateId, "blackwhite");
  assert.equal(composed.screenFormatId, "led-64x48");
  assert.equal(composed.priceCents, 0);
  assert.ok(composed.shoutout.mainText.length <= 36);
  assert.equal(composed.shoutout.headless, true);
  assert.equal(composed.shoutout.templateClassName, "classic-bw");
  assert.equal(composed.shoutout.templateName, "Traditional Black and White ShoutOut");
  assert.equal(composed.shoutout.identityRail, true);
  assert.equal(composed.shoutout.textLayoutVersion, headless.TEXT_LAYOUT_VERSION);
  assert.equal(composed.shoutout.city, "Washington");
  assert.equal(composed.shoutout.fullAddress, "1215 U St NW, Washington, DC");

  const paid = headless.composeShoutOutPayload({
    clubLocationId: "decades-washington-dc",
    venue,
    message: "BOO",
    templateId: "classicHalloween"
  });
  assert.equal(paid.ok, true);
  assert.equal(paid.priceCents, 1500);
  assert.equal(paid.templateId, "classicHalloween");
  assert.equal(paid.shoutout.templateClassName, "classic-bw classic-halloween");
  assert.equal(paid.shoutout.halloweenFinale, true);
  assert.match(paid.shoutout.backgroundUrl, /classic-halloween/);

  const halloweenCopy = headless.composeShoutOutPayload({
    venue,
    userPrompt: "throw a shoutout at Decades that says Happy Halloween"
  });
  assert.equal(halloweenCopy.ok, true);
  assert.equal(halloweenCopy.clubLocationId, "decades-washington-dc");
  assert.equal(halloweenCopy.templateId, "blackwhite");
  assert.equal(halloweenCopy.priceCents, 0);
});

test("composer-only templates stay on composeHref", () => {
  const row = headless.composeShoutOutPayload({
    clubLocationId: "temp-democlub-1",
    venue: {locationName: "Aurelia", templates: ["zebbiesFootballTeamIntro"]},
    message: "Go team",
    templateId: "zebbiesFootballTeamIntro"
  });
  assert.equal(row.ok, false);
  assert.equal(row.composerOnly, true);
  assert.match(row.composeHref, /location=temp-democlub-1/);
});

test("missing club or message is a needs list, not a checkout", () => {
  const missing = headless.composeShoutOutPayload({message: "Hi"});
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.missing, ["club"]);
  const both = headless.composeShoutOutPayload({});
  assert.ok(both.missing.includes("club"));
  assert.ok(both.missing.includes("message"));
});

test("context fills Traditional club and shoutout text without a magic sentence", () => {
  const filled = headless.fillFromConversation([
    {role: "user", text: "happy birthday Maya"},
    {role: "assistant", text: "Nice — I can throw that as a ShoutOut."},
    {role: "user", text: "we are going to Aurelia tonight"}
  ], "throw a shoutout");
  assert.equal(filled.clubQuery, "temp-democlub-1");
  assert.equal(filled.message, "happy birthday Maya");
  const draft = headless.mergeInteractiveDraft({}, filled, {freshThrow: false});
  assert.deepEqual(headless.interactiveNeeds(draft), []);
  assert.equal(headless.missingAsk(headless.interactiveNeeds(draft)).includes("throw it"), true);
});

test("ask only the next missing required field", () => {
  const missingClub = headless.mergeInteractiveDraft({}, {message: "Happy birthday Maya"});
  assert.deepEqual(headless.interactiveNeeds(missingClub), ["club"]);
  assert.equal(headless.missingAsk(["club", "message"]), "Which venue should this ShoutOut play on?");
  const missingCopy = headless.mergeInteractiveDraft({}, {clubQuery: "temp-democlub-1"});
  assert.deepEqual(headless.interactiveNeeds(missingCopy), ["message"]);
  assert.match(headless.missingAsk(["message"]), /shoutout text|sign/i);
  assert.doesNotMatch(headless.missingAsk(["message"]), /LED copy/i);
});

test("template-specific jersey, Heist name, and Football Intro fields", () => {
  const jersey = headless.mergeInteractiveDraft({}, {
    clubQuery: "heist-washington-dc",
    templateId: "soccerJersey",
    jerseyTeamId: "soccerMorocco",
    jerseyName: "NYX"
  });
  assert.deepEqual(headless.inputsForDraft(jersey).required, ["club", "jerseyTeamId", "jerseyName", "jerseyNumber"]);
  assert.deepEqual(headless.interactiveNeeds(jersey), ["jerseyNumber"]);
  assert.match(headless.missingAsk(headless.interactiveNeeds(jersey)), /number/i);

  const heist = headless.mergeInteractiveDraft({}, {
    clubQuery: "heist-washington-dc",
    templateId: "heistVaultDollars",
    playerName: "@Maya"
  });
  assert.deepEqual(headless.interactiveNeeds(heist), []);
  assert.deepEqual(headless.inputsForDraft(heist).required, ["club", "playerName"]);

  const football = headless.composeShoutOutPayload({
    clubLocationId: "temp-democlub-1",
    venue: {locationName: "Aurelia", templates: ["zebbiesFootballTeamIntro"]},
    message: "Go team",
    templateId: "zebbiesFootballTeamIntro"
  });
  assert.equal(football.ok, false);
  assert.ok(football.missing.includes("teamPhotos"));
  assert.equal(football.composerOnly, true);

  const parsedJersey = headless.parseShoutOutExecute(
    "throw a jersey shoutout at Heist name NYX number 99 Morocco"
  );
  assert.equal(parsedJersey.templateId, "soccerJersey");
  assert.equal(parsedJersey.jerseyTeamId, "soccerMorocco");
  assert.equal(parsedJersey.jerseyName, "NYX");
  assert.equal(parsedJersey.jerseyNumber, "99");
});

test("history kit words do not force a jersey template onto a Traditional throw", () => {
  const filled = headless.fillFromConversation([
    {role: "user", text: "Spain is playing tonight"},
    {role: "user", text: "we are going to Aurelia"},
    {role: "user", text: "happy birthday Maya"}
  ], "throw a shoutout");
  assert.notEqual(filled.templateId, "soccerJersey");
  assert.equal(filled.jerseyTeamId, "");
  assert.equal(filled.clubQuery, "temp-democlub-1");
  assert.equal(filled.message, "happy birthday Maya");
  const draft = headless.mergeInteractiveDraft({}, filled, {freshThrow: false});
  assert.deepEqual(headless.interactiveNeeds(draft), []);
});

test("follow-up fills the asked collectableInput slot", () => {
  const jersey = headless.mergeInteractiveDraft({}, {
    clubQuery: "heist-washington-dc",
    templateId: "soccerJersey",
    jerseyTeamId: "soccerMorocco",
    jerseyName: "NYX"
  });
  assert.deepEqual(headless.interactiveNeeds(jersey), ["jerseyNumber"]);
  const parsed = headless.parseShoutOutExecute("99");
  headless.applyBareInteractiveReply(jersey, parsed, "99");
  assert.equal(parsed.jerseyNumber, "99");
  const next = headless.mergeInteractiveDraft(jersey, parsed, {freshThrow: false});
  assert.deepEqual(headless.interactiveNeeds(next), []);

  const kitAsk = headless.mergeInteractiveDraft({}, {
    clubQuery: "heist-washington-dc",
    templateId: "soccerJersey"
  });
  const kit = headless.parseShoutOutExecute("Morocco");
  headless.applyBareInteractiveReply(kitAsk, kit, "Morocco");
  assert.equal(kit.jerseyTeamId, "soccerMorocco");
});

test("venue prompt Heist fills the club, not Locked Up", () => {
  const draft = headless.mergeInteractiveDraft({}, {
    message: "Happy birthday Maya"
  });
  assert.deepEqual(headless.interactiveNeeds(draft), ["club"]);
  const prompt = "Heist";
  const parsed = headless.parseShoutOutExecute(prompt);
  const fromThread = headless.fillFromConversation([], prompt);
  headless.applyBareInteractiveReply(draft, parsed, prompt);
  assert.equal(parsed.clubQuery, "heist-washington-dc");
  assert.equal(parsed.templateId || "", "");
  assert.equal(parsed.dropStandaloneTemplate, true);
  assert.notEqual(fromThread.templateId, "heistVaultNight");
  const filled = headless.combineHeadlessFill(parsed, {
    ...fromThread,
    templateId: "heistVaultNight"
  });
  assert.equal(filled.templateId || "", "");
  const next = headless.mergeInteractiveDraft(draft, filled, {freshThrow: false});
  assert.equal(next.clubQuery, "heist-washington-dc");
  assert.notEqual(next.templateId, "heistVaultNight");
  assert.deepEqual(headless.interactiveNeeds(next), []);
});

test("template switch does not fill the new overlay's first slot", () => {
  const draft = headless.mergeInteractiveDraft({}, headless.parseShoutOutExecute(
    "throw a shoutout at Decades that says Happy birthday Maya"
  ));
  assert.deepEqual(headless.interactiveNeeds(draft), []);
  const parsed = headless.parseShoutOutExecute("jersey");
  assert.equal(parsed.templateId, "soccerJersey");
  const jerseyRow = headless.catalogShapeFor("soccerJersey");
  headless.applyBareInteractiveReply(draft, parsed, "jersey", jerseyRow);
  assert.equal(parsed.jerseyTeamId || "", "");
  const next = headless.mergeInteractiveDraft(draft, parsed, {freshThrow: false});
  assert.equal(next.templateId, "soccerJersey");
  assert.equal(next.jerseyTeamId || "", "");
  assert.ok(headless.interactiveNeeds(next).includes("jerseyTeamId"));
});

test("ready-state no cancels the ShoutOut", () => {
  const draft = headless.mergeInteractiveDraft({}, headless.parseShoutOutExecute(
    "throw a shoutout at Decades that says Happy birthday Maya"
  ));
  assert.deepEqual(headless.interactiveNeeds(draft), []);
  const noReady = headless.parseShoutOutExecute("no");
  headless.applyBareInteractiveReply(draft, noReady, "no");
  assert.equal(noReady.cancel, true);
  assert.equal(noReady.confirmSubmit, false);
});

test("catalog patron input families match headless lists", () => {
  const inputs = require("./shoutout-template-inputs");
  const shared = read("shared-data.js");
  assert.match(shared, /FLOQRTemplatePatronInputs/);
  assert.match(shared, /patronInputs/);
  assert.match(shared, /collectableInput1/);
  assert.deepEqual(inputs.forTemplate({id: "blackwhite"}).required, ["club", "message"]);
  assert.deepEqual(inputs.forTemplate({id: "soccerJersey", jerseyNameField: true}).required, [
    "club", "jerseyTeamId", "jerseyName", "jerseyNumber"
  ]);
  assert.deepEqual(inputs.forTemplate({id: "ballersAlert", requiresFacePhoto: true}).required, [
    "club", "facePhoto", "playerName"
  ]);
  assert.deepEqual(inputs.forTemplate({id: "zebbiesFootballTeamIntro", layout: "football-team-intro"}).required, [
    "club", "teamPhotos"
  ]);
  assert.deepEqual(inputs.forTemplate({id: "heistVaultDollars", nameOnly: true}).required, ["club", "playerName"]);
  assert.deepEqual(inputs.forTemplate({id: "birthdayMedia", supportsMedia: true}).required, [
    "club", "message", "media"
  ]);
});

test("templates stamp numbered collectableInput1..N keys", () => {
  const inputs = require("./shoutout-template-inputs");
  const expected = {
    blackwhite: 3,
    birthdayMedia: 4,
    soccerJersey: 6,
    heistVaultDollars: 3,
    ballersAlert: 5,
    zebbiesFootballTeamIntro: 4
  };
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.blackwhite.collectableInputCount, 3);
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.blackwhite.collectableInput1.fieldId, "club");
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.blackwhite.collectableInput1.required, 1);
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.blackwhite.collectableInput2.fieldId, "message");
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.blackwhite.collectableInput3.fieldId, "handle");
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.blackwhite.collectableInput3.required, 0);
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.birthdayMedia.collectableInputCount, 4);
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.soccerJersey.collectableInputCount, 6);
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.heistVaultDollars.collectableInputCount, 3);
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.ballersAlert.collectableInputCount, 5);
  assert.equal(headless.HEADLESS_TEXT_TEMPLATES.zebbiesFootballTeamIntro.collectableInputCount, 4);
  Object.entries(expected).forEach(([id, n]) => {
    const row = inputs.stampTemplate({
      id,
      ...(headless.HEADLESS_TEXT_TEMPLATES[id] || {})
    });
    assert.equal(row.collectableInputCount, n, `${id} N`);
    for (let i = 1; i <= n; i++) {
      const slot = row[`collectableInput${i}`];
      assert.ok(slot && slot.fieldId, `${id} collectableInput${i}`);
      assert.ok(slot.required === 0 || slot.required === 1, `${id} slot ${i} required 0|1`);
      assert.ok(String(slot.prompt || "").length > 8, `${id} slot ${i} prompt`);
    }
  });
});

test("Firestore overlay slots drive follow-up fill and composer-only", () => {
  const overlay = {
    id: "blackwhite",
    collectableInputCount: 3,
    collectableInput1: {fieldId: "club", required: 1, prompt: "Which venue?"},
    collectableInput2: {fieldId: "message", required: 1, prompt: "What should the sign say?"},
    collectableInput3: {fieldId: "jerseyNumber", required: 1, prompt: "What number goes on the jersey?"}
  };
  const draft = headless.mergeInteractiveDraft({}, {
    clubQuery: "temp-democlub-1",
    message: "Happy birthday Maya",
    templateId: "blackwhite"
  });
  assert.deepEqual(headless.interactiveNeeds(draft), []);
  assert.deepEqual(headless.interactiveNeeds(draft, overlay), ["jerseyNumber"]);
  assert.equal(headless.isInteractiveFollowUp("99", draft), false);
  assert.equal(headless.isInteractiveFollowUp("99", draft, overlay), true);
  const parsed = headless.parseShoutOutExecute("99");
  headless.applyBareInteractiveReply(draft, parsed, "99");
  assert.equal(parsed.jerseyNumber || "", "");
  headless.applyBareInteractiveReply(draft, parsed, "99", overlay);
  assert.equal(parsed.jerseyNumber, "99");

  assert.equal(headless.isComposerOnlyTemplate("blackwhite"), false);
  assert.equal(headless.isComposerOnlyTemplate("blackwhite", {
    id: "blackwhite",
    collectableInputCount: 1,
    collectableInput1: {fieldId: "media", required: 1, prompt: "Add a photo?"}
  }), true);
  assert.equal(headless.isComposerOnlyTemplate("birthdayMedia"), true);
  assert.equal(headless.isComposerOnlyTemplate("birthdayMedia", {
    id: "birthdayMedia",
    collectableInputCount: 2,
    collectableInput1: {fieldId: "club", required: 1, prompt: "Which venue?"},
    collectableInput2: {fieldId: "message", required: 1, prompt: "What should the sign say?"}
  }), false);
});

test("headless iterates collectableInput1..N instead of a family table", () => {
  const custom = {
    id: "customBoard",
    className: "classic-bw",
    collectableInputCount: 2,
    collectableInput1: {fieldId: "club", required: 1, prompt: "Which venue?"},
    collectableInput2: {fieldId: "jerseyNumber", required: 1, prompt: "What number goes on the jersey?"}
  };
  const filled = headless.mergeInteractiveDraft({}, {
    clubQuery: "temp-democlub-1",
    message: "Happy birthday Maya",
    templateId: "blackwhite"
  });
  assert.deepEqual(headless.interactiveNeeds(filled), []);
  assert.deepEqual(headless.interactiveNeeds(filled, custom), ["jerseyNumber"]);
  assert.equal(headless.missingAsk(["jerseyNumber"], custom), "What number goes on the jersey?");
  const numbered = headless.mergeInteractiveDraft(filled, {jerseyNumber: "99"});
  assert.deepEqual(headless.interactiveNeeds(numbered, custom), []);
  assert.doesNotMatch(headless.missingAsk(headless.interactiveNeeds(numbered, custom), custom), /LED copy/i);
});

test("Firestore/catalog collectableInput parity for seed templates", () => {
  const inputs = require("./shoutout-template-inputs");
  const vm = require("node:vm");
  const sandbox = {window: {}};
  sandbox.window = sandbox;
  vm.runInNewContext(read("shared-data.js"), sandbox, {filename: "shared-data.js"});
  const ids = [
    "blackwhite",
    "birthdayMedia",
    "soccerJersey",
    "heistVaultDollars",
    "ballersAlert",
    "zebbiesFootballTeamIntro"
  ];
  const expectedN = {blackwhite: 3, birthdayMedia: 4, soccerJersey: 6, heistVaultDollars: 3, ballersAlert: 5, zebbiesFootballTeamIntro: 4};
  ids.forEach(id => {
    const catalog = sandbox.SHOUTOUT_TEMPLATES[id];
    assert.ok(catalog, id);
    assert.equal(catalog.collectableInputCount, expectedN[id], `${id} catalog N`);
    const server = inputs.stampTemplate(JSON.parse(JSON.stringify({...catalog, id})));
    assert.equal(server.collectableInputCount, catalog.collectableInputCount);
    for (let i = 1; i <= expectedN[id]; i++) {
      assert.equal(catalog[`collectableInput${i}`].fieldId, server[`collectableInput${i}`].fieldId, `${id} ${i}`);
      assert.equal(catalog[`collectableInput${i}`].required, server[`collectableInput${i}`].required, `${id} ${i} required`);
    }
    const headlessRow = headless.HEADLESS_TEXT_TEMPLATES[id];
    if (headlessRow) {
      assert.equal(headlessRow.collectableInputCount, catalog.collectableInputCount, `${id} headless N`);
      for (let i = 1; i <= expectedN[id]; i++) {
        assert.equal(headlessRow[`collectableInput${i}`].fieldId, catalog[`collectableInput${i}`].fieldId);
      }
    }
  });
});

test("startShoutOutCheckout and FloqR callable accept flat club + message", () => {
  const tools = read("functions/bot-dee-tools.js");
  assert.match(tools, /composeShoutOutPayload/);
  assert.match(tools, /submitFreeHeadlessShoutOut/);
  assert.match(tools, /notifyClubPendingHeadlessShoutOut/);
  assert.match(tools, /panel=panelQueue/);
  assert.doesNotMatch(tools, /tab=queue/);
  assert.match(tools, /pendingShoutout_\$\{uid\}_\$\{id\}/);
  assert.match(tools, /\.set\(note, \{merge: true\}\)/);
  assert.match(tools, /args\?\.mainText/);
  assert.match(tools, /args\?\.message/);
  assert.match(tools, /args\?\.playerName/);
  assert.match(tools, /args\?\.jerseyName/);
  assert.match(tools, /does not submit as a free board/);
  assert.match(tools, /userPrompt/);
  const adminApp = read("admin-app.js");
  assert.match(adminApp, /templateClassName: packaged\.className \|\| item\.templateClassName/);
  const portal = read("patron-portal-app.js");
  assert.match(portal, /type === "pendingshoutout"/);
  const chat = read("bot-dee-chat.js");
  assert.match(chat, /"shoutout-pending": "botdee.link.shoutoutPending"/);
  assert.doesNotMatch(tools, /existing\.priceCents \|\| payload\.priceCents/);
  assert.doesNotMatch(tools, /needs clubLocationId and shoutout payload/);

  const commerce = read("functions/commerce-functions.js");
  assert.match(commerce, /exports\.createHeadlessShoutOutCheckout/);
  assert.match(commerce, /startShoutOutCheckout/);

  const index = read("functions/index.js");
  assert.match(index, /require\("\.\/commerce-functions"\)/);

  const workflow = read(".github/workflows/functions-ci.yml");
  assert.match(workflow, /createHeadlessShoutOutCheckout/);

  const schema = read("functions/bot-dee-core.js");
  assert.match(schema, /message\/mainText/);
  assert.match(schema, /default Traditional blackwhite/);

  const session = read("functions/bot-dee-functions.js");
  assert.match(session, /tryHeadlessShoutOut/);
  assert.match(session, /isShoutOutExecutePrompt\(userPrompt\)/);
  assert.match(session, /fillFromConversation/);
  assert.match(session, /combineHeadlessFill\(parsed, fromThread\)/);
  assert.match(session, /applyBareInteractiveReply\(previousDraft, parsed, userPrompt, askedRow\)/);
  assert.match(session, /isInteractiveFollowUp\(userPrompt, previousShoutDraft, previousShoutRow\)/);
  assert.match(session, /loadTemplateCollectableRow\(previousShoutDraft\.templateId\)/);
  assert.match(session, /previousDraft\.templateId \|\| headless\.DEFAULT_TEMPLATE_ID/);
  assert.doesNotMatch(session, /previousDraft\?\.templateId \|\| parsed\.templateId/);
  assert.match(read("functions/headless-shoutout-core.js"), /isBareTemplateSwitch/);

  const pay = read("payment-service.js");
  assert.match(pay, /createHeadlessShoutOutCheckout/);
  assert.match(pay, /startHeadlessShoutOut/);
});
