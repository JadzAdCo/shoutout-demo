"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const manifest = require("./botdee-upgrade-manifest");
const execution = require("./botdee-execution");
const memory = require("./botdee-memory");
const smart = require("./botdee-smartview-core");
const research = require("./botdee-research");
const actions = require("./botdee-actions");
const bot = require("./bot-dee-core");
const threads = require("./bot-dee-thread");

test("Phase 1 audit: existing executeBotSession path, idle 300s, Mingl isolation", () => {
  assert.equal(bot.DEFAULT_IDLE_SECONDS, 300);
  assert.equal(bot.normalizeBotDeeSettings(null).conversationIdleSeconds, 300);
  assert.match(read("functions/bot-dee-functions.js"), /exports\.executeBotSession/);
  assert.match(read("functions/bot-dee-functions.js"), /assertFeatureAccess\(request\.auth, "botDee"/);
  assert.match(read("functions/bot-dee-thread.js"), /botDeeThreads/);
  assert.match(read("firestore.rules"), /match \/botDeeThreads\/\{threadId\}/);
  assert.match(read("firestore.rules"), /match \/messages\/\{id\}/);
  assert.doesNotMatch(read("functions/bot-dee-thread.js"), /minglConnections|collection\("messages"\)/);
  assert.match(read("botdee.html"), /data-floqr-feature="botDee"/);
  assert.match(read("botdee.html"), /floqr-session-shell\.js/);
  assert.doesNotMatch(read("botdee.html"), /LangChain|LangGraph|Cloud SQL|Redis/);
  const now = 1_700_000_000_000;
  assert.equal(bot.isThreadIdle(now - 299_000, 300, now), false);
  assert.equal(bot.isThreadIdle(now - 300_000, 300, now), true);
});

test("Phase 1 threat model helpers: thread id is owner uid, foreign ids ignored", () => {
  assert.equal(bot.coerceThreadId("someone-else", "uid-a"), "uid-a");
  assert.equal(bot.threadIdForUid("uid-a"), "uid-a");
  const settings = {durableThreads: 1, conversationIdleSeconds: 300};
  const snap = threads.snapshotToState({
    exists: true,
    data: () => ({uid: "uid-a", turns: [{role: "user", text: "secret"}], lastMessageAtMs: Date.now(), conversationEpoch: 1})
  }, "uid-a", settings, Date.now());
  assert.equal(snap.threadId, "uid-a");
});

test("capability manifest never claims deploy or leaks secrets", () => {
  const m = manifest.buildManifest();
  assert.equal(m.deployedClaim, false);
  assert.equal(m.secretsExposed, false);
  assert.equal(m.specVersion, "1.2");
  assert.ok(m.phases.some(p => p.id === 5 && p.implemented));
  assert.ok(m.providers.every(p => p.mode === "mock_only"));
  const patron = manifest.describeForRole("patron");
  assert.match(patron.reply, /BOT DEE/);
  assert.equal(patron.manifest, null);
  const master = manifest.describeForRole("master");
  assert.match(master.reply, /not-deployed|not production-deployed/i);
  assert.match(master.reply, /mock-only/i);
  assert.doesNotMatch(master.reply, /GEMINI_API_KEY|sk_|AIza/);
  assert.equal(m.tokenWindow.maxInputTokensVerified, null);
});

test("version prompt covers deployed / changed / limitations / integrations", () => {
  assert.equal(bot.isVersionPrompt("what version are you running?"), true);
  assert.equal(bot.isVersionPrompt("what is deployed?"), true);
  assert.equal(bot.isVersionPrompt("what changed?"), true);
  assert.equal(bot.isVersionPrompt("what limitations?"), true);
  assert.equal(bot.isVersionPrompt("which integrations are approved?"), true);
});

test("Phase 2 execution: idempotent receipts, leases independent of chat idle", () => {
  const key = execution.stableIdempotencyKey({ownerUid: "u1", toolName: "createVipHold", args: {hold: 1}});
  assert.equal(key.length, 32);
  const doc = execution.checkpointDoc({
    ownerUid: "u1",
    threadId: "u1",
    toolName: "createVipHold",
    args: {night: "2026-11-14"},
    nowMs: 1000
  });
  assert.equal(doc.approvalState, "required");
  assert.equal(doc.state, "awaiting_approval");
  const first = execution.applyReceipt(doc, "succeeded", {ok: true}, 2000);
  assert.equal(first.duplicate, false);
  const second = execution.applyReceipt(first, "executing", {ok: true}, 3000);
  assert.equal(second.duplicate, true);
  assert.equal(second.state, "succeeded");
  const lease = execution.newLease("u1", "u1", 1000, 5000);
  assert.equal(execution.leaseExpired(lease, 4000), false);
  assert.equal(execution.leaseExpired(lease, 6000), true);
  const ctx = execution.buildModelContext({
    turns: Array.from({length: 20}, (_, i) => ({role: "user", text: `t${i}`})),
    summary: "earlier restaurants",
    memories: [{value: "likes Nigerian food"}],
    budget: {maxTurns: 12}
  });
  assert.equal(ctx.recentTurns.length, 12);
  assert.match(ctx.budget.note, /Not server RAM/);
});

test("Phase 3 memory: default opt-out; idle ends session not archive", () => {
  const consent = memory.normalizeConsent({});
  assert.equal(consent.archive, 0);
  assert.equal(consent.memory, 0);
  assert.equal(consent.publicProfileEnrichment, 0);
  assert.equal(memory.consentAllows(consent, "archive"), false);
  const opted = memory.normalizeConsent({archive: 1, memory: 1});
  const idle = memory.idleEndsActiveNotArchive({idleEnded: true, consent: opted});
  assert.equal(idle.activeSessionEnded, true);
  assert.equal(idle.archiveRetained, true);
  const mem = memory.memoryRecord({
    value: "Prefers Cameroonian food",
    explicitOrInferred: "explicit",
    approved: 1,
    nowMs: 1000,
    expiresAtMs: 5000
  });
  assert.equal(memory.authorizedMemories([mem], opted, 2000).length, 1);
  assert.equal(memory.authorizedMemories([mem], opted, 6000).length, 0);
  assert.equal(memory.authorizedMemories([mem], consent, 2000).length, 0);
  const exported = memory.exportPayload({uid: "u1", consent: opted, archive: [], memories: [mem]});
  assert.equal(exported.minglIncluded, false);
  assert.equal(exported.ipIncluded, false);
  const del = memory.deletionPlan({archive: 0, memory: 0});
  assert.equal(del.stopRetrieval, true);
});

test("Phase 5 SmartViews: ten kinds, venue canonical page, patron research disabled", () => {
  const schema = smart.loadSchema();
  assert.equal(schema.additionalProperties, false);
  const catalog = smart.mockCatalog();
  const kinds = new Set(catalog.map(row => row.kind));
  smart.KINDS.forEach(kind => assert.ok(kinds.has(kind), kind));
  catalog.forEach(row => {
    const errors = smart.validatePayload(row);
    assert.deepEqual(errors, [], JSON.stringify({kind: row.kind, errors}));
  });
  const venue = catalog.find(row => row.kind === "venue");
  assert.equal(venue.canonicalFloqrPageId, "temp-democlub-1");
  assert.ok(venue.actions.some(a => a.href === "./club-profile.html?location=temp-democlub-1"));
  assert.doesNotMatch(venue.actions[0].href, /[?&]v=/);
  const restaurant = catalog.find(row => row.kind === "restaurant");
  const providers = restaurant.ratings.map(r => r.provider);
  assert.deepEqual(new Set(providers).size, providers.length);
  assert.equal(restaurant.floqrPublicData.menuIframeAllowed, false);
  const car = catalog.find(row => row.kind === "vehicle");
  assert.equal(car.floqrPublicData.nhtsa.status, "missing");
  const patron = catalog.find(row => row.kind === "patron");
  assert.equal(patron.publicWebResearch.enabled, false);
  assert.ok(patron.floqrPublicData.cuisines.includes("Nigerian"));
  assert.ok(patron.floqrPublicData.cuisines.includes("Japanese"));
  assert.ok(!patron.floqrPublicData.cuisines.includes("jollof"));
  assert.equal(smart.cuisinePipelineMeta().perViewInference, false);
  const hidden = smart.patronSmartView({
    displayName: "Hidden",
    volunteered: {datapoints: {food: ["Nigerian"]}},
    viewerMaySee: false
  });
  assert.deepEqual(hidden.floqrPublicData, {});
});

test("Phase 4 research: mock only, votes are not consent, name is not identity", () => {
  assert.equal(research.mayCallProvider(research.gateMatrix(), "google_places"), false);
  assert.equal(research.canonicalProviderId("ticketmaster"), "ticketmaster_discovery");
  assert.ok(research.gateMatrix().some(row => row.id === "ticketmaster_discovery"));
  assert.ok(research.gateMatrix().some(row => row.id === "ticketmaster_partner"));
  assert.ok(research.gateMatrix().every(row => row.mode === "mock_only" && row.liveVendorHttp === false));
  const search = research.mockGroundedSearch({query: "Ada Lovelace", subjectType: "person"});
  assert.equal(search.scrapedAiMode, false);
  assert.equal(search.identityMatched, false);
  const vote = research.feedbackRecord({uid: "u1", evidenceId: "e1", vote: "relevant"});
  assert.equal(vote.isNotConsent, true);
  assert.equal(vote.publishesGlobally, false);
  const ident = research.identityAssociation({name: "Jane Doe", extraSignals: {}});
  assert.equal(ident.mayAttachToNamedPerson, false);
  const dispute = research.disputeRecord({uid: "u1", evidenceId: "e1", reason: "not me"});
  assert.equal(dispute.profileUnchanged, true);
  assert.equal(dispute.thirdPartyRemovalPromised, false);
  assert.match(research.MASTER_ADMIN_GATE_PROMPT, /mock interface/);
});

test("Phase 6 actions: existing FLOQR tools, no card data, mock partners", () => {
  const vip = actions.actionPlan({kind: "vip_hold", userApproved: true});
  assert.equal(vip.path, "existing_floqr_tool");
  assert.equal(vip.pciCardInFloqr, false);
  const hotel = actions.actionPlan({kind: "hotel_referral", providerId: "hotels_flights", userApproved: true});
  assert.equal(hotel.path, "mock_only");
  assert.equal(hotel.bookingGuarantee, false);
  const denied = actions.confirmPayload({uid: "u1", kind: "vip_hold", userApproved: false});
  assert.equal(denied.ok, false);
});

test("later-fill provider slots stay mock without enabled+secret+evidence", () => {
  const slots = require("./botdee-provider-slots");
  const empty = slots.normalizeSlot({id: "google_places"}, {}, 1_000);
  assert.equal(empty.enabled, 0);
  assert.equal(empty.secretPresent, 0);
  assert.equal(empty.slotReady, false);
  assert.equal(empty.mode, "mock_only");
  assert.equal(empty.httpAllowed, false);
  const filled = slots.normalizeSlot({
    id: "yelp",
    enabled: 1,
    legalEvidenceRef: "counsel-memo-yelp-1",
    expiresAtMs: 2_000
  }, {BOTDEE_YELP_API_KEY: "present-not-echoed"}, 1_000);
  assert.equal(filled.slotReady, true);
  assert.equal(filled.secretPresent, 1);
  assert.equal(filled.mode, "mock_only");
  const expired = slots.normalizeSlot({
    id: "eventbrite",
    enabled: 1,
    legalEvidenceRef: "eb-1",
    expiresAtMs: 500
  }, {BOTDEE_EVENTBRITE_API_KEY: "x"}, 1_000);
  assert.equal(expired.slotReady, false);
  assert.equal(expired.expired, true);
  const unknown = slots.normalizeSlot({id: "not_a_vendor"}, {}, 1_000);
  assert.equal(unknown.known, false);
  assert.equal(unknown.mode, "mock_only");
  const rejected = slots.sanitizeSlotWrite({enabled: 1, apiKey: "paste-me"}, "google_places");
  assert.equal(rejected.ok, false);
  const mock = slots.runMockAdapter({
    providerId: "gemini_grounding",
    query: "clubs",
    slot: filled
  });
  assert.equal(mock.httpCalled, false);
  assert.equal(mock.mode, "mock_only");
  assert.equal(slots.FILL_IDS.includes("ticketmaster_discovery"), true);
  assert.equal(slots.FILL_IDS.includes("ticketmaster_partner"), true);
  assert.doesNotMatch(read("functions/botdee-provider-slots.js"), /\bfetch\s*\(|axios|https\.request|www\.googleapis\.com|api\.yelp\.com|app\.ticketmaster\.com|www\.eventbriteapi\.com/);
  assert.doesNotMatch(read("functions/botdee-research.js"), /\bfetch\s*\(|axios|https\.request/);
});

test("wiring: new callables exported and rules classified collections exist", () => {
  const index = read("functions/index.js");
  assert.match(index, /getBotDeeCapabilityManifest/);
  assert.match(index, /setBotDeeConsent/);
  assert.match(index, /exportBotDeeData/);
  assert.match(index, /getBotDeeLegalGates/);
  assert.match(index, /getBotDeeProviderSlots/);
  assert.match(index, /listBotDeeProviderSlots/);
  assert.match(index, /setBotDeeProviderSlot/);
  assert.match(read("functions/botdee-upgrade-functions.js"), /invoker:\s*"public"/);
  const rules = read("firestore.rules");
  assert.match(rules, /match \/botDeeThreads\/\{threadId\}/);
  assert.match(rules, /match \/archive\/\{messageId\}/);
  assert.match(rules, /match \/memories\/\{memoryId\}/);
  assert.match(rules, /match \/botDeeLegalGates\/\{providerId\}/);
  assert.match(rules, /match \/botDeeProviderSlots\/\{providerId\}/);
  assert.match(rules, /match \/botDeeCapabilityManifest\/\{docId\}/);
  assert.match(read("functions/data-classification-core.js"), /botDeeThreads\/archive/);
  assert.match(read("functions/data-classification-core.js"), /botDeeLegalGates/);
  assert.match(read("functions/data-classification-core.js"), /botDeeProviderSlots/);
  assert.doesNotMatch(read("functions/botdee-upgrade-functions.js"), /request\.rawRequest\.ip|clientIp/);
  assert.match(read("master-admin.html"), /id="botDeeLegalSave"/);
  assert.match(read("master-admin.html"), /id="botDeeSlotSave"/);
  assert.match(read("master-feature-services.js"), /setBotDeeLegalGate/);
  assert.match(read("master-feature-services.js"), /listBotDeeProviderSlots/);
  assert.match(read("master-feature-services.js"), /setBotDeeProviderSlot/);
  assert.match(read("botdee.html"), /id="botDeeMemoryPanel"/);
  assert.match(read("botdee.html"), /id="botDeeSettingsBubble"/);
  assert.match(read("botdee.html"), /id="botDeeMemoryPopout"/);
  assert.match(read("botdee.html"), /id="botDeeMemoryClose"/);
  assert.match(read("botdee.html"), /botdee-composer-below/);
  const botdeeHtml = read("botdee.html");
  assert.ok(
    botdeeHtml.indexOf('id="botDeeSettingsBubble"') < botdeeHtml.indexOf('id="botDeeMemoryPanel"'),
    "Settings bubble precedes the memory panel"
  );
  assert.ok(
    botdeeHtml.indexOf('id="botDeeMemoryPopout"') < botdeeHtml.indexOf('id="botDeeMemoryPanel"')
      && botdeeHtml.indexOf('id="botDeeMemoryPanel"') < botdeeHtml.indexOf('id="botDeeLibraryPanel"'),
    "memory panel lives in the popout, not as an inline card above the library"
  );
  assert.match(read("botdee.html"), /floqr-session-shell\.js/);
  assert.doesNotMatch(read("botdee.html"), /help-popout/);
  assert.match(read("botdee-upgrade-ui.js"), /function closeMemoryPopout/);
  assert.match(read("botdee-upgrade-ui.js"), /closeMemoryPopout\(\)/);
  assert.match(read("bot-dee-chat.css"), /\.botdee-settings-bubble/);
  assert.match(read("bot-dee-chat.css"), /\.botdee-memory-popout-x/);
  assert.match(read("bot-dee-chat.css"), /#botDeeChatForm \+ #botDeeMemoryPanel/);
  assert.match(botdeeHtml, /id="botDeeMemoryPopout"[^>]*\bhidden\b/);
  assert.ok(
    botdeeHtml.indexOf("</form>") < botdeeHtml.indexOf('id="botDeeSettingsBubble"')
      && botdeeHtml.indexOf('id="botDeeSettingsBubble"') < botdeeHtml.indexOf('id="botDeeMemoryPopout"'),
    "Settings bubble sits under the composer; memory panel is not the next card"
  );
});

test("hasUsedBotDee is integer 0|1 on botDeeThreads and every BOT DEE gate returns it", () => {
  assert.equal(memory.normalizeHasUsedBotDee(1), 1);
  assert.equal(memory.normalizeHasUsedBotDee("1"), 1);
  assert.equal(memory.normalizeHasUsedBotDee(true), 0);
  assert.equal(memory.normalizeHasUsedBotDee(false), 0);
  assert.equal(memory.normalizeHasUsedBotDee(0), 0);
  assert.equal(memory.normalizeHasUsedBotDee("0"), 0);
  assert.equal(memory.hasUsedFromThread({}), 0);
  assert.equal(memory.hasUsedFromThread({turns: [{role: "user"}]}), 1);
  assert.equal(memory.hasUsedFromThread({eventCount: 2}), 1);
  assert.equal(memory.hasUsedFromThread({hasUsedBotDee: 0, turns: [{role: "user"}]}), 0);
  assert.equal(threads.emptyState({durableThreads: 1, conversationIdleSeconds: 300}).hasUsedBotDee, 0);
  assert.match(read("functions/bot-dee-functions.js"), /hasUsedBotDee: 1/);
  assert.match(read("functions/bot-dee-functions.js"), /hasUsedBotDee: state\.hasUsedBotDee === 1 \? 1 : 0/);
  assert.match(read("functions/botdee-upgrade-functions.js"), /hasUsedBotDee: memory\.hasUsedFromThread/);
  assert.match(read("functions/data-classification-functions.js"), /hasUsedBotDee: hasUsedBotDee === 1 \? 1 : 0/);
  assert.match(read("botdee-access.js"), /function requireUsage/);
  assert.match(read("floqr-feature-services.js"), /requireUsage/);
  assert.match(read("botdee.html"), /id="botDeeSettingsFirstUse"/);
  assert.match(read("floqr-i18n.js"), /botdee\.settingsFirstUse/);
  assert.match(read("functions/data-classification-core.js"), /botDeeThreads", "hasUsedBotDee"/);
  assert.match(read("firestore.rules"), /hasUsedBotDee 0\|1/);
});
