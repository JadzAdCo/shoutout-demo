"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = relativePath => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

test("runFloqrDiscoveryCrawl export exists in ai-discovery-functions", () => {
  const source = read("functions/ai-discovery-functions.js");
  assert.match(source, /exports\.runFloqrDiscoveryCrawl\s*=\s*onCall/);
  assert.match(source, /ticketmaster:\s*"later"/);
  assert.match(source, /discoverPlacesForCriteria/);
  assert.match(source, /classifyDiscoveryRecord/);
});

test("requiredDatapoints include artistsOrDjs or DJ in ai-discovery-service", () => {
  const source = read("ai-discovery-service.js");
  assert.match(source, /artistsOrDjs/);
  assert.match(source, /DJ\(s\)\/Artist\(s\)/);
  assert.match(source, /promoters/);
  assert.match(source, /sourceConfirmationsHtml/);
});

test("master-admin refined discovery search UI copy", () => {
  const html = read("master-admin.html");
  assert.match(html, /Refined Discovery Search/);
  assert.match(html, /Run Discovery Crawl/);
  assert.match(html, /Ticketmaster confirmation: later/);
  assert.match(html, /ai-discovery-service\.js\?v=\d+\.\d+\.\d+/);
  assert.match(html, /ai-diagnostics-service\.js\?v=\d+\.\d+\.\d+/);
  assert.match(html, /pool party/);
  assert.match(html, /day club/);
  assert.match(html, /rooftop lounge/);
});

test("runManualCrawl tries runFloqrDiscoveryCrawl callable with fallback", () => {
  const diagnostics = read("ai-diagnostics-service.js");
  assert.match(diagnostics, /runFloqrDiscoveryCrawl/);
  assert.match(diagnostics, /buildManualCrawlCandidates/);
  assert.match(diagnostics, /Ticketmaster \(later\)/);
});
