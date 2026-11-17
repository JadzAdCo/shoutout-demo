"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const cards = require("./botdee-smartcard-core");
const v2 = require("./botdee-smartview-v2-core");
const smart = require("./botdee-smartview-core");

function amaraView() {
  const snap = v2.amaraMockSnapshot();
  const analysis = v2.amaraMockAnalysis();
  const volunteered = {
    uid: "mock-amara",
    viewerUid: "viewer-1",
    viewerLocale: "en",
    handle: "amaraj",
    photoUrl: snap.photoUrl,
    verified: true,
    analysis,
    datapoints: {
      location: {city: snap.city},
      music: snap.music,
      photoCount: 1
    },
    sharedDatapoints: ["music", "location", "media"]
  };
  return smart.patronSmartView({
    displayName: snap.displayName,
    volunteered,
    profileHref: "./?start=search",
    viewerMaySee: true
  });
}

test("v6 people-search intent: Who am I / Who is / generic person / unrelated", () => {
  assert.equal(cards.classifyPeopleSearchIntent("Who am I?").intent, "self");
  assert.equal(cards.classifyPeopleSearchIntent("what do you know about me").intent, "self");
  const person = cards.classifyPeopleSearchIntent("Who is Amara J.?");
  assert.equal(person.intent, "person");
  assert.match(person.needle, /Amara/i);
  assert.equal(cards.classifyPeopleSearchIntent("Do you know this person?").intent, "empty");
  assert.equal(cards.classifyPeopleSearchIntent("Who is this person?").intent, "empty");
  assert.equal(cards.classifyPeopleSearchIntent("Find Amara J.").intent, "person");
  assert.equal(cards.classifyPeopleSearchIntent("find amara").intent, "person");
  assert.equal(cards.classifyPeopleSearchIntent("Who is working tonight?").intent, "none");
  assert.equal(cards.classifyPeopleSearchIntent("book a table").intent, "none");
  assert.equal(cards.classifyPeopleSearchIntent("show me tables").intent, "none");
  assert.equal(cards.classifyPeopleSearchIntent("tell me about VIP").intent, "none");
  assert.equal(cards.classifyPeopleSearchIntent("search for events tonight").intent, "none");
  assert.equal(cards.classifyPeopleSearchIntent("find events").intent, "none");
});

test("routing: self / one / many compact / none / error; no existence leak", () => {
  const view = amaraView();
  const self = cards.routePeopleSearch({self: view});
  assert.equal(self.mode, "self");
  assert.equal(self.views[0].floqrPublicData.peopleV2.presentation, "peopleV2");
  assert.equal(self.geminiOnView, false);

  const one = cards.routePeopleSearch({matches: [view]});
  assert.equal(one.mode, "one");
  assert.equal(one.views.length, 1);
  assert.notEqual(one.views[0].floqrPublicData.peopleV2.presentation, "peopleSmartCard");

  const many = cards.routePeopleSearch({matches: [view, view, view]});
  assert.equal(many.mode, "many");
  assert.equal(many.eligibleCount, 3);
  many.views.forEach(row => {
    assert.equal(row.floqrPublicData.peopleV2.presentation, "peopleSmartCard");
    assert.equal(row.floqrPublicData.peopleV2.summary.clampLines, 4);
  });

  const none = cards.routePeopleSearch({matches: []});
  assert.equal(none.mode, "none");
  assert.equal(none.discloseExistence, false);
  assert.equal(none.views.length, 0);
  assert.equal(cards.fallbackReply("none"), "No eligible public profile matched.");

  const blocked = cards.routePeopleSearch({matches: [null, undefined]});
  assert.equal(blocked.mode, "none");

  const err = cards.routePeopleSearch({error: true, matches: [view]});
  assert.equal(err.mode, "error");
  assert.equal(err.views.length, 0);
});

test("compact card is a projection of the same peopleV2 subject, not a second summary", () => {
  const full = amaraView();
  const compact = cards.asSmartCardView(full);
  assert.equal(compact.floqrPublicData.peopleV2.subjectUid, full.floqrPublicData.peopleV2.subjectUid);
  assert.equal(compact.floqrPublicData.peopleV2.summary.text, full.floqrPublicData.peopleV2.summary.text);
  assert.equal(compact.floqrPublicData.peopleV2.displayName, full.floqrPublicData.peopleV2.displayName);
  assert.equal(compact.floqrPublicData.peopleV2.photo.url, full.floqrPublicData.peopleV2.photo.url);
});

test("live projection updates the same subject only; other cards stay put", () => {
  const a = cards.asSmartCardView(amaraView());
  const next = JSON.parse(JSON.stringify(amaraView()));
  next.floqrPublicData.peopleV2.summary.text = "Owner edited SMARTsummary.";
  const updated = cards.applyLiveProjection(a, next);
  assert.match(updated.floqrPublicData.peopleV2.summary.text, /Owner edited/);
  const other = JSON.parse(JSON.stringify(next));
  other.floqrPublicData.peopleV2.subjectUid = "someone-else";
  const ignored = cards.applyLiveProjection(a, other);
  assert.equal(ignored.floqrPublicData.peopleV2.summary.text, a.floqrPublicData.peopleV2.summary.text);
});

test("redact strips identity; pagination is 4 per page", () => {
  const compact = cards.asSmartCardView(amaraView());
  const redacted = cards.redactView(compact);
  assert.equal(redacted.floqrPublicData.peopleV2.displayName, "");
  assert.equal(redacted.floqrPublicData.peopleV2.redacted, true);
  const rows = Array.from({length: 9}, (_, i) => ({id: i}));
  const page1 = cards.paginate(rows, 1);
  assert.equal(page1.rows.length, 4);
  assert.equal(page1.hasMore, true);
  assert.equal(cards.paginate(rows, 3).rows.length, 1);
});

test("editorial provenance: patron_edit vs gemini; stamp publicWithinFloqr", () => {
  const gemini = cards.stampDiscoverable({sourceAuthoredBy: "gemini", revision: 2, sourceLocale: "en"}, true);
  assert.equal(gemini.publicWithinFloqr, 1);
  assert.equal(gemini.summary_source, "gemini");
  const owner = cards.stampDiscoverable({sourceAuthoredBy: "owner", revision: 4, sourceLocale: "fr", updatedAtMs: 9}, false);
  assert.equal(owner.publicWithinFloqr, 0);
  assert.equal(owner.summary_source, "patron_edit");
  assert.equal(owner.summary_version, 4);
  assert.equal(owner.summary_locale, "fr");
});

test("owner-authored analysis is not regenerated by public-field hash change", () => {
  const snap = v2.amaraMockSnapshot();
  const doc = v2.applyOwnerSave(v2.emptyAnalysis("u1", snap), {
    summary: "Patron authored SMARTsummary.",
    sourceLocale: "en",
    editorUid: "u1"
  });
  assert.equal(doc.sourceAuthoredBy, "owner");
  const nextSnap = {...snap, music: ["Techno"]};
  assert.equal(v2.shouldRegenerate(doc, nextSnap), false);
  assert.equal(v2.shouldFlagConflict(doc, nextSnap), true);
});

test("private/blocked getPeopleSmartView path returns empty views (no name leak)", () => {
  const src = fs.readFileSync(path.join(__dirname, "botdee-smartview-v2-functions.js"), "utf8");
  assert.match(src, /hidden: true, geminiOnView: false/);
  assert.doesNotMatch(src, /viewerMaySee: false/);
  const cardSrc = fs.readFileSync(path.join(__dirname, "botdee-smartcard-functions.js"), "utf8");
  assert.match(cardSrc, /geminiOnView: false/);
  assert.doesNotMatch(cardSrc, /generateContent/);
  assert.doesNotMatch(cardSrc, /GoogleGenAI/);
});

test("executeBotSession attaches people search before Gemini and skips mock catalog", () => {
  const src = fs.readFileSync(path.join(__dirname, "bot-dee-functions.js"), "utf8");
  assert.match(src, /attachPeopleSearch/);
  assert.match(src, /people-smartcard/);
  assert.match(src, /!outcome\.smartViews/);
});

test("index exports searchPeopleSmartCards; rules allow publicWithinFloqr listen", () => {
  const index = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  assert.match(index, /searchPeopleSmartCards/);
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
  const blockStart = rules.indexOf("match /usercharacter_analysis/{uid}");
  assert.ok(blockStart > 0);
  const block = rules.slice(blockStart, blockStart + 500);
  assert.match(block, /publicWithinFloqr == 1/);
  assert.match(block, /allow write: if false/);
  assert.match(rules, /function pairIsBlocked/);
});

test("client compact cards inherit Site Chrome tokens; no hardcoded Tiffany; no display ?v=", () => {
  const client = fs.readFileSync(path.join(__dirname, "..", "botdee-smartview.js"), "utf8");
  assert.match(client, /renderCompactPeopleCard/);
  assert.match(client, /peopleSmartCard/);
  assert.match(client, /usercharacter_analysis/);
  assert.match(client, /getPeopleSmartView/);
  assert.match(client, /data-subject-uid="\$\{esc\(uid\)\}"/);
  assert.match(client, /userBlocks/);
  assert.match(client, /__floqrLiveToken/);
  assert.match(client, /let sawReadable = false/);
  assert.match(client, /if \(!sawReadable\) return;/);
  assert.match(client, /if \(!snap.exists\)/);
  const css = fs.readFileSync(path.join(__dirname, "..", "botdee-smartview.css"), "utf8");
  assert.match(css, /\.botdee-sc-card/);
  assert.match(css, /var\(--accent/);
  assert.match(css, /-webkit-line-clamp: 4/);
  assert.doesNotMatch(css, /#20d9d8/);
  assert.doesNotMatch(client, /display\.html\?location=[^"' ]+[?&]v=/);
});

test("diagnostics never log the private query text", () => {
  const src = fs.readFileSync(path.join(__dirname, "botdee-smartcard-functions.js"), "utf8");
  assert.match(src, /summaryTextLogged: false/);
  assert.match(src, /kind: "people_smartcard_search"/);
  assert.doesNotMatch(src, /diagnosticEvent\(\{[^}]*query/);
});

test("chrome keys botdee.sc.* exist in all 11 languages", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "floqr-i18n.js"), "utf8");
  const keys = [
    "botdee.sc.selfView",
    "botdee.sc.oneResult",
    "botdee.sc.selectPerson",
    "botdee.sc.none",
    "botdee.sc.searchFailed",
    "botdee.sc.moreResults",
    "botdee.sc.openSmartView",
    "botdee.sc.summaryPending"
  ];
  keys.forEach(key => {
    const hits = src.split(`"${key}"`).length - 1;
    assert.ok(hits >= 11, `${key} in ${hits} packs`);
  });
});
