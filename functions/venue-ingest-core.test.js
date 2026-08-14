"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  hashIngestSecret,
  newIngestSecret,
  secretsMatch,
  obfuscateSecret,
  opaqueAssigneeKey,
  feedUrls,
  iframeSnippet,
  buildScheduleRss
} = require("./venue-ingest-core");

test("ingest secrets hash and match without storing cleartext equality", () => {
  const secret = newIngestSecret();
  assert.match(secret, /^floq_ingest_[a-f0-9]+$/);
  const hash = hashIngestSecret(secret);
  assert.equal(hash.length, 64);
  assert.equal(secretsMatch(secret, hash), true);
  assert.equal(secretsMatch("wrong", hash), false);
  assert.equal(secretsMatch("", hash), false);
});

test("feed URLs and RSS omit draft-looking payloads", () => {
  const urls = feedUrls({locationId: "temp-democlub-1", secret: "floq_ingest_abc"});
  assert.match(urls.json, /format=json/);
  assert.match(urls.rss, /format=rss/);
  assert.match(urls.iframe, /schedule-embed\.html/);
  assert.match(iframeSnippet(urls.iframe), /<iframe/);
  const rss = buildScheduleRss({
    venueName: "Aurelia",
    feedUrl: urls.rss,
    shifts: [{id: "s1", roleLabel: "Host", assigneeName: "Priya", status: "confirmed", startsAt: "6:00 PM", endsAt: "2:00 AM"}]
  });
  assert.match(rss, /<rss/);
  assert.match(rss, /Host · Priya/);
  assert.doesNotMatch(rss, /draft/i);
  assert.equal(obfuscateSecret("floq_ingest_abcdefghijklmnop").startsWith("floq_ingest"), true);
  assert.equal(opaqueAssigneeKey("uid-1").length, 16);
  assert.notEqual(opaqueAssigneeKey("uid-1"), "uid-1");
});
