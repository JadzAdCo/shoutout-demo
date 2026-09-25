"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = relativePath => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

test("runInstantDiscoveryCrawl export and contact lift helpers exist", () => {
  const source = read("functions/ai-discovery-functions.js");
  assert.match(source, /exports\.runInstantDiscoveryCrawl\s*=\s*onCall/);
  assert.match(source, /summarizeContactLift/);
  assert.match(source, /instant-discovery-crawl/);
  const html = read("master-admin.html");
  assert.match(html, /runInstantCrawlBtn/);
  assert.match(html, /Instant Crawl Now/);
  const diagnostics = read("ai-diagnostics-service.js");
  assert.match(diagnostics, /runInstantCrawl/);
  assert.match(diagnostics, /runInstantDiscoveryCrawl/);
});

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
  assert.match(source, /venueHandleHints|scoreSocialHandle/);
  const {extractSocialHandles, listSocialSecondaryUrls, enrichVenueRecord} = require("./venue-datapoint-extract");
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

test("Gate Club Paris prefers venue Instagram over photographer credits", () => {
  const {extractSocialHandles, listSocialSecondaryUrls, enrichVenueRecord, extractPhone, extractEmail, socialHandlesFromWebsiteUrl} = require("./venue-datapoint-extract");
  const html = `
    <link rel="stylesheet" href="https://www.gateclubparis.com/wp-content/plugins/contact-form-7/includes/css/styles.css?ver=5.8.6"/>
    <a href="tel:0171253215">01 71 25 32 15</a>
    <a href="mailto:privatisation@gateclubparis.com">Contact</a>
    <a href="https://www.instagram.com/gateclubparis/"><i class="fab fa-instagram"></i> Actualités</a>
    <a href="/contact-us/">Contact Us</a>
    <a href="/about-us/">About</a>
    <a href="/#privatisation">Privatisation</a>
    <p>Photos : <a href="https://www.instagram.com/justin_prinz/">Justin Prinz</a>
       / <a href="https://www.instagram.com/mickaelllorca/">Mickael Llorca</a></p>
    <script type="application/ld+json">{"@type":"NightClub","sameAs":["https://www.instagram.com/gateclubparis/"]}</script>
  `;
  const socials = extractSocialHandles(html, {
    venueName: "Gate Club Paris",
    website: "https://www.gateclubparis.com/"
  });
  assert.equal(socials.instagram, "@gateclubparis");
  assert.notEqual(socials.instagram, "@justin_prinz");
  const secondaries = listSocialSecondaryUrls(html, "https://www.gateclubparis.com/", {venueName: "Gate Club Paris"});
  assert.ok(secondaries.every(url => !/\.css/i.test(url)), "secondary urls must exclude CSS assets");
  assert.ok(secondaries.some(url => /contact-us/i.test(url)));
  assert.ok(secondaries.some(url => /about-us/i.test(url)));
  assert.match(extractPhone(html), /0171253215|01\s*71/);
  assert.equal(extractEmail(html, {website: "https://www.gateclubparis.com/"}), "privatisation@gateclubparis.com");
  const enriched = enrichVenueRecord({
    proposedTitle: "Gate Club Paris",
    officialWebsite: "https://www.gateclubparis.com/"
  }, {html, text: "Gate Club Paris"});
  assert.equal(enriched.socialMediaHandles.instagram, "@gateclubparis");
  assert.equal(enriched.email, "privatisation@gateclubparis.com");
  assert.equal(socialHandlesFromWebsiteUrl("https://www.instagram.com/thisissanctum/").instagram, "@thisissanctum");
  assert.equal(socialHandlesFromWebsiteUrl("https://m.facebook.com/ledistrictparis/").facebook, "ledistrictparis");
});

test("Buddha-Bar Monte-Carlo brand page supplies venue email", () => {
  const {enrichVenueRecord, extractPhone} = require("./venue-datapoint-extract");
  const sbm = `
    <a href="https://www.instagram.com/montecarlosbm">ig</a>
    <a href="https://www.facebook.com/MonteCarloSBM">fb</a>
    <p>+377 98 06 19 19</p>
    <a href="https://www.buddhabar.com/en/restaurants/buddha-bar-monte-carlo/">Brand</a>
  `;
  const brand = `
    <a href="mailto:buddhabarmontecarlo@sbm.mc">mail</a>
    <p>Tel : +377 98 06 19 19</p>
  `;
  let rec = enrichVenueRecord({
    proposedTitle: "Buddha-Bar Monte-Carlo",
    officialWebsite: "https://www.montecarlosbm.com/fr/restaurant-monaco/buddha-bar-monte-carlo"
  }, {html: sbm, text: "Buddha-Bar Monte-Carlo"});
  rec = enrichVenueRecord(rec, {html: brand, text: "Buddha-Bar Monte-Carlo"});
  assert.equal(rec.email, "buddhabarmontecarlo@sbm.mc");
  assert.match(extractPhone(sbm + brand), /\+377/);
  assert.ok(rec.socialMediaHandles.instagram || rec.socialMediaHandles.facebook);
});

test("aggregator listing prefers official brand domain contacts", () => {
  const {
    isAggregatorWebsite,
    listSocialSecondaryUrls,
    listOfficialBrandUrls,
    enrichVenueRecord,
    extractWhatsAppPhone,
    extractPhone
  } = require("./venue-datapoint-extract");
  assert.equal(isAggregatorWebsite("https://www.privateaser.com/lieu/674-charlotte-club"), true);
  assert.equal(isAggregatorWebsite("https://charlotte-club.fr/"), false);
  const privateaserHtml = `
    <a href="https://www.instagram.com/charlotteclubparis/">ig</a>
    <a href="https://www.facebook.com/privateaser">fb platform</a>
    <a href="mailto:contact@privateaser.com">mail</a>
    <a href="https://www.privateaser.com/reservation-bar/top-bars-team-building-paris">booking</a>
    <a href="https://charlotte-club.fr/">Official site</a>
  `;
  const secondaries = listSocialSecondaryUrls(privateaserHtml, "https://www.privateaser.com/lieu/674-charlotte-club", {
    venueName: "Charlotte Bar/Club Paris"
  });
  assert.ok(secondaries[0] && /charlotte-club\.fr/i.test(secondaries[0]), `brand domain should rank first, got ${secondaries[0]}`);
  assert.deepEqual(listOfficialBrandUrls(privateaserHtml, "https://www.privateaser.com/lieu/674-charlotte-club", {
    venueName: "Charlotte Bar/Club Paris"
  }).slice(0, 1), ["https://charlotte-club.fr/"]);

  let rec = enrichVenueRecord({
    proposedTitle: "Charlotte Bar/Club Paris",
    officialWebsite: "https://www.privateaser.com/lieu/674-charlotte-club"
  }, {html: privateaserHtml});
  assert.equal(rec.socialMediaHandles.instagram, "@charlotteclubparis");
  assert.equal(rec.socialMediaHandles.facebook, "privateaser");
  const brandHtml = `
    <a href="https://instagram.com/charlotteclubparis?igshid=YmMyMTA2M2Y=" aria-label="Instagram"></a>
    <a href="https://www.facebook.com/CharlotteBarBastille" aria-label="Facebook"></a>
    <p>E-mail: contactcharlotte.bar@gmail.com</p>
    <p>Tél: 09 74 64 01 36</p>
  `;
  rec = enrichVenueRecord(rec, {html: brandHtml, text: "Charlotte Club"});
  assert.equal(rec.socialMediaHandles.facebook, "CharlotteBarBastille");
  assert.equal(rec.email, "contactcharlotte.bar@gmail.com");

  const nua = `<a href="http://wa.me/33648100403">WhatsApp</a><a href="mailto:nuaparisevent@gmail.com">mail</a>`;
  assert.equal(extractWhatsAppPhone(nua), "+33648100403");
  assert.equal(extractPhone(nua), "+33648100403");
});

test("discovery crawl enriches website socials and stamps collectedAt", () => {
  const source = read("functions/ai-discovery-functions.js");
  assert.match(source, /enrichRecordFromPublicWebsite/);
  assert.match(source, /needsSecondaryContactCrawl/);
  assert.match(source, /listOfficialBrandUrls|looksLikeAggregatorContact/);
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
