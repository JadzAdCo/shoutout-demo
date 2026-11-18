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

  const paid = headless.composeShoutOutPayload({
    clubLocationId: "decades-washington-dc",
    venue,
    message: "BOO",
    templateId: "classicHalloween"
  });
  assert.equal(paid.ok, true);
  assert.equal(paid.priceCents, 1500);
  assert.equal(paid.templateId, "classicHalloween");

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

test("startShoutOutCheckout and FloqR callable accept flat club + message", () => {
  const tools = read("functions/bot-dee-tools.js");
  assert.match(tools, /composeShoutOutPayload/);
  assert.match(tools, /submitFreeHeadlessShoutOut/);
  assert.match(tools, /args\?\.mainText \|\| args\?\.message/);
  assert.match(tools, /does not submit as a free board/);
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

  const pay = read("payment-service.js");
  assert.match(pay, /createHeadlessShoutOutCheckout/);
  assert.match(pay, /startHeadlessShoutOut/);
});
