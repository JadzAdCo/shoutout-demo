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
  assert.match(html, /ai-discovery-service\.js\?v=(?:s)?\d+\.\d+\.\d+/);
  assert.match(html, /ai-diagnostics-service\.js\?v=(?:s)?\d+\.\d+\.\d+/);
  assert.match(html, /pool party/);
  assert.match(html, /day club/);
  assert.match(html, /rooftop lounge/);
});

test("runManualCrawl tries runFloqrDiscoveryCrawl callable and fails loud without placeholders", () => {
  const diagnostics = read("ai-diagnostics-service.js");
  assert.match(diagnostics, /runFloqrDiscoveryCrawl/);
  assert.match(diagnostics, /No placeholder review cards were created/);
  assert.match(diagnostics, /Ticketmaster \(later\)/);
  assert.match(diagnostics, /buildManualCrawlCandidates/);
  assert.doesNotMatch(diagnostics, /Local fallback:.*structured review record/);
});

test("discovery review UX is form-first with Needs research", () => {
  const discovery = read("ai-discovery-service.js");
  const html = read("master-admin.html");
  assert.match(discovery, /Needs research/);
  assert.match(discovery, /Advanced: source snapshot/);
  assert.match(discovery, /Advanced: what FLOQR understood/);
  assert.match(discovery, /markNeedsResearch/);
  assert.match(html, /aiDiscoveryCriteriaWeights/);
  assert.match(html, /Prepare Club Admin imports/);
  assert.match(html, /crawl-extract-steps/);
  assert.match(html, /design-notes-ai-discovery-crawl\.mdc/);
});

test("discovery Firestore rules require Master Admin writes", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/aiDiscoveryQueue\/\{id\}/);
  assert.match(rules, /discoveryMode == "profile-import-draft"/);
  assert.match(rules, /allow create, update, delete: if isMasterAdmin\(\)/);
});
