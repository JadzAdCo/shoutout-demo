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

test("social handle extraction reads footer hrefs", () => {
  const source = read("functions/venue-datapoint-extract.js");
  assert.match(source, /listSocialSecondaryUrls/);
  assert.match(source, /href\s*=\s*\["']/);
  const {extractSocialHandles, listSocialSecondaryUrls} = require("./venue-datapoint-extract");
  const html = `
    <footer>
      <a href="https://www.facebook.com/MonteCarloSBM">f</a>
      <a href="https://www.instagram.com/montecarlosbm">ig</a>
      <a href="https://x.com/MonteCarloSBM">x</a>
      <a href="https://www.tiktok.com/@montecarlosbm">tt</a>
      <a href="/fr/contact">Contact</a>
    </footer>`;
  const socials = extractSocialHandles(html);
  assert.equal(socials.instagram, "@montecarlosbm");
  assert.equal(socials.facebook, "MonteCarloSBM");
  assert.equal(socials.x, "@MonteCarloSBM");
  assert.equal(socials.tiktok, "@montecarlosbm");
  const secondaries = listSocialSecondaryUrls(html, "https://www.montecarlosbm.com/fr/restaurant-monaco/buddha-bar-monte-carlo");
  assert.ok(secondaries.some(url => /contact/i.test(url)));
});

test("discovery crawl enriches website socials and stamps collectedAt", () => {
  const source = read("functions/ai-discovery-functions.js");
  assert.match(source, /enrichRecordFromPublicWebsite/);
  assert.match(source, /applyOnboardedUpdatePolicy/);
  assert.match(source, /collectedAtIso/);
  assert.match(source, /updates-only/);
});

test("master admin discovery queue has country tabs and collected label", () => {
  const html = read("master-admin.html");
  const discovery = read("ai-discovery-service.js");
  assert.match(html, /aiDiscoveryCountryTabs/);
  assert.match(discovery, /Collected /);
  assert.match(discovery, /renderCountryTabs/);
  assert.match(discovery, /Updates only/);
});

test("discovery Firestore rules require Master Admin writes", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/aiDiscoveryQueue\/\{id\}/);
  assert.match(rules, /discoveryMode == "profile-import-draft"/);
  assert.match(rules, /allow create, update, delete: if isMasterAdmin\(\)/);
});
