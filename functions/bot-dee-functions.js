/* BOT DEE — executeBotSession callable (Auth + botDee gate + classification → Gemini + tools).
   Tools: contextualSearch + VIP / ShoutOut / FloqCAST / checkout (each re-validates role).
   Durable threads: getBotDeeThread + persist under botDeeThreads/{uid}.
   Master Admin: setBotDeeSettings (idle pause) under SOS2FA.
   s3.3.047: Mingl session invites + shared tab.
   s3.3.063: Place SMARTview attachVenueSearch SMARTbackground stamp. */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {GoogleGenAI, FunctionCallingConfigMode} = require("@google/genai");
const core = require("./data-classification-core");
const bot = require("./bot-dee-core");
const prefs = require("./botdee-personalization");
const threads = require("./bot-dee-thread");
const memory = require("./botdee-memory");
const smart = require("./botdee-smartview-core");
const peopleCards = require("./botdee-smartcard-functions");
const execution = require("./botdee-execution");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");
const {__botDeeHelpers} = require("./data-classification-functions");
const {assertSos2faSession} = require("./sos2fa-functions");
const {isServerAdminAuth} = require("./admin-trust");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const {FieldValue} = admin.firestore;

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

const CALL_OPTS = {
  region: "us-central1",
  timeoutSeconds: 90,
  memory: "512MiB",
  secrets: [GEMINI_API_KEY, STRIPE_SECRET_KEY]
};

const ADMIN_CALL_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};
const BOT_DEE_SETTINGS_DOC = "botDeeSettings/default";
const REASON_MIN = 8;

function asHttps(error) {
  if (error instanceof HttpsError) return error;
  if (error?.code === "invalid-argument") return new HttpsError("invalid-argument", error.message);
  if (error?.code === "failed-precondition") return new HttpsError("failed-precondition", error.message);
  console.error("BOT DEE session failed", error?.message || error);
  return new HttpsError("internal", "BOT DEE could not complete that request. Try again.");
}

function geminiKey() {
  // Gen2 binds secrets as process.env[KEY] — prefer that (defineSecret.value()
  // can disagree with Secret Manager on some revisions).
  const fromEnv = String(process.env.GEMINI_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
  try {
    return String(GEMINI_API_KEY.value() || "").trim();
  } catch (_) {
    return "";
  }
}

function functionResponsePart(call, result) {
  return {
    functionResponse: {
      name: call.name,
      id: call.id,
      response: result && typeof result === "object" ? result : {ok: false, error: "empty_tool_result"}
    }
  };
}

async function loadAllowedFeatures(auth) {
  const fsCore = require("./feature-services-core");
  const viewer = await audit.viewerFor(auth);
  const snaps = await Promise.all(fsCore.FEATURE_KEYS.map(key => audit.loadFeature(key)));
  const keys = [];
  const labels = [];
  const featureFlags = {};
  snaps.forEach(feature => {
    if (!feature?.key) return;
    featureFlags[feature.key] = {
      IsFeatureEnabled: feature.IsFeatureEnabled,
      IsTestFeature: feature.IsTestFeature
    };
    if (fsCore.canAccessFeature(feature, viewer)) {
      keys.push(feature.key);
      labels.push(feature.label || feature.key);
    }
  });
  return {keys, labels, viewer, featureFlags};
}

async function runGeminiSession({apiKey, role, history, userPrompt, session, uiLanguage, allowedFeatures, personalization, modelContext}) {
  const lang = bot.normalizeUiLanguage(uiLanguage || session?.uiLanguage);
  const allowed = allowedFeatures || session?.allowedFeatures || null;
  const ai = new GoogleGenAI({apiKey});
  const contents = modelContext
    ? bot.contextToContents(modelContext, userPrompt)
    : bot.historyToContents(history, userPrompt);
  const tools = [{
    functionDeclarations: bot.toolDeclarations(allowed, {
      omitContextualSearch: bot.omitContextualSearchForPrompt(userPrompt, allowed)
    })
  }];
  let lastSearch = null;
  const actionLinks = [];
  const mediaItems = [];
  let rounds = 0;

  while (rounds < bot.MAX_TOOL_ROUNDS) {
    rounds += 1;
    const response = await ai.models.generateContent({
      model: bot.TEXT_MODEL,
      contents,
      config: {
        systemInstruction: bot.systemInstruction(role, lang, allowed, personalization),
        tools,
        // AUTO must NOT set allowedFunctionNames — Gemini 400s with
        // "Please set allowed_function_names only when function calling mode is ANY"
        // and every turn silently fell back to contextualSearch.
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO
          }
        },
        temperature: 0.4
      }
    });

    const calls = response.functionCalls || [];
    if (!calls.length) {
      const text = bot.extractText(response);
      const throwPack = bot.isShoutOutExecutePrompt(userPrompt)
        && !bot.hasShoutOutActionLink(actionLinks)
        ? bot.shoutOutExecuteFallback(lang, allowed)
        : null;
      const replyRaw = text
        || (throwPack ? throwPack.reply : bot.formatSearchFallback(lastSearch, lang, allowed));
      const resultCards = throwPack && !text
        ? [...throwPack.results, ...actionLinks]
        : [
          ...(throwPack ? [] : bot.resultsForClient(lastSearch, lang)),
          ...actionLinks
        ];
      return {
        reply: prefs.appendActionHistory(
          bot.sanitizeFeatureMentions(bot.redactPrivilegeReply(replyRaw), allowed),
          actionLinks
        ),
        results: resultCards,
        media: mediaItems.slice(0, 8),
        provider: "gemini",
        model: bot.TEXT_MODEL,
        toolRounds: rounds - (text ? 1 : 0),
        uiLanguage: lang
      };
    }

    const modelContent = response.candidates?.[0]?.content || {
      role: "model",
      parts: calls.map(call => ({functionCall: call}))
    };
    contents.push(modelContent);

    const responseParts = [];
    for (const call of calls) {
      const args = call.args && typeof call.args === "object" ? call.args : {};
      const result = await bot.runTool(call.name, args, session);
      if (session?.userId && execution.isConsequentialTool(call.name)) {
        try {
          await threads.writeExecutionReceipt(session.userId, call.name, args, result, Date.now());
        } catch (err) {
          console.warn("BOT DEE execution receipt failed", err?.message || err);
        }
      }
      if (call.name === "contextualSearch") lastSearch = result;
      bot.linksFromToolResult(result, lang).forEach(link => actionLinks.push(link));
      bot.mediaFromToolResult(result).forEach(item => {
        if (!mediaItems.some(existing => existing.url === item.url)) mediaItems.push(item);
      });
      responseParts.push(functionResponsePart(
        call,
        bot.stripPrivilegeFromToolResult(bot.stripMediaFromToolResult(result))
      ));
    }
    contents.push({role: "user", parts: responseParts});
  }

  const throwPack = bot.isShoutOutExecutePrompt(userPrompt)
    && !bot.hasShoutOutActionLink(actionLinks)
    ? bot.shoutOutExecuteFallback(lang, allowed)
    : null;
  const truncatedCards = throwPack
    ? [...throwPack.results, ...actionLinks]
    : [...bot.resultsForClient(lastSearch, lang), ...actionLinks];
  return {
    reply: prefs.appendActionHistory(
      bot.sanitizeFeatureMentions(
        bot.redactPrivilegeReply(throwPack ? throwPack.reply : bot.formatSearchFallback(lastSearch, lang, allowed)),
        allowed
      ),
      actionLinks
    ),
    results: truncatedCards,
    media: mediaItems.slice(0, 8),
    provider: "gemini",
    model: bot.TEXT_MODEL,
    toolRounds: rounds,
    truncated: true,
    uiLanguage: lang
  };
}

function shoutOutSmartOutcome(reply, lang, extra = {}) {
  const links = Array.isArray(extra.results) ? extra.results : [];
  return {
    reply,
    results: links,
    provider: extra.provider || "headless-shoutout",
    model: extra.model || "startShoutOutCheckout",
    toolRounds: extra.toolRounds == null ? 1 : extra.toolRounds,
    uiLanguage: lang,
    smartViews: Array.isArray(extra.smartViews) ? extra.smartViews : [],
    shoutOutPreview: extra.shoutOutPreview || ""
  };
}

async function tryHeadlessShoutOut(userPrompt, session, uiLanguage, allowedFeatures, previousDraft, conversationTurns, previousTemplateRow) {
  const lang = bot.normalizeUiLanguage(uiLanguage);
  const allowed = allowedFeatures || null;
  const headless = require("./headless-shoutout-core");
  const shoutView = require("./botdee-shoutout-smartview");
  const threads = require("./bot-dee-thread");
  const tools = require("./bot-dee-tools");
  const uid = session?.userId || session?.request?.auth?.uid || "";
  const parsed = headless.parseShoutOutExecute(userPrompt);
  const fromThread = headless.fillFromConversation(conversationTurns, userPrompt);
  const askedTemplateId = previousDraft
    ? (previousDraft.templateId || headless.DEFAULT_TEMPLATE_ID)
    : (parsed.templateId || fromThread.templateId);
  const askedResolved = askedTemplateId || headless.DEFAULT_TEMPLATE_ID;
  const askedRow = previousTemplateRow
    && (previousTemplateRow.id === askedResolved || previousTemplateRow.templateId === askedResolved)
    ? previousTemplateRow
    : await tools.loadTemplateCollectableRow(askedTemplateId);
  headless.applyBareInteractiveReply(previousDraft, parsed, userPrompt, askedRow);
  if ((parsed.cancel || fromThread.cancel) && previousDraft) {
    try { await threads.persistHeadlessShoutOutDraft(uid, null); } catch (_) {}
    return shoutOutSmartOutcome("Cancelled — that ShoutOut was not sent.", lang, {
      model: "headless-draft",
      toolRounds: 0,
      smartViews: [],
      shoutOutPreview: "closed"
    });
  }
  const filled = {
    ...fromThread,
    ...parsed,
    clubQuery: parsed.clubQuery || fromThread.clubQuery,
    message: parsed.message || fromThread.message,
    templateId: parsed.templateId || fromThread.templateId,
    jerseyTeamId: parsed.jerseyTeamId || fromThread.jerseyTeamId,
    jerseyName: parsed.jerseyName || fromThread.jerseyName,
    jerseyNumber: parsed.jerseyNumber || fromThread.jerseyNumber,
    playerName: parsed.playerName || fromThread.playerName
  };
  const merged = headless.mergeInteractiveDraft(previousDraft, filled, {
    freshThrow: !!(parsed.clubQuery && parsed.message)
  });
  const mergedId = merged.templateId || headless.DEFAULT_TEMPLATE_ID;
  const templateRow = askedRow && (askedRow.id === mergedId || askedRow.templateId === mergedId)
    ? askedRow
    : await tools.loadTemplateCollectableRow(merged.templateId);
  const earlyNeeds = headless.interactiveNeeds(merged, templateRow);
  if (!merged.clubQuery) {
    try { await threads.persistHeadlessShoutOutDraft(uid, merged); } catch (_) {}
    const view = shoutView.buildShoutOutSmartView({
      draft: merged,
      needs: earlyNeeds.length ? earlyNeeds : ["club"],
      venueName: "",
      mode: "draft",
      templateRow
    });
    return shoutOutSmartOutcome(headless.missingAsk(["club"], templateRow), lang, {
      model: "headless-draft",
      toolRounds: 0,
      smartViews: [view]
    });
  }
  try {
    merged.clubQuery = await tools.requireClubLocationId(merged.clubQuery);
  } catch (error) {
    try { await threads.persistHeadlessShoutOutDraft(uid, merged); } catch (_) {}
    const fallback = bot.shoutOutExecuteFallback(lang, allowed);
    return shoutOutSmartOutcome(error.message || fallback.reply, lang, {
      results: fallback.results,
      model: "headless-draft",
      toolRounds: 0,
      smartViews: [shoutView.buildShoutOutSmartView({draft: merged, needs: ["club"], mode: "draft"})]
    });
  }
  const confirm = parsed.confirmSubmit === true || merged.skipExtras === true;
  if (confirm) merged.skipExtras = true;
  if (merged.handleDecision === "include" && !merged.attribution) {
    try {
      merged.attribution = await tools.loadPatronShoutOutAttribution(uid);
    } catch (_) {}
  }
  const needs = headless.interactiveNeeds(merged, templateRow);
  const viewBase = {
    draft: merged,
    needs,
    venueName: merged.clubQuery,
    templateRow
  };
  if (needs.includes("compose") || merged.mediaDecision === "compose") {
    try { await threads.persistHeadlessShoutOutDraft(uid, merged); } catch (_) {}
    const view = shoutView.buildShoutOutSmartView({...viewBase, mode: "draft"});
    const fallback = bot.shoutOutExecuteFallback(lang, allowed);
    return shoutOutSmartOutcome(headless.missingAsk(["compose"], templateRow), lang, {
      results: fallback.results,
      model: "headless-draft",
      toolRounds: 0,
      smartViews: [view]
    });
  }
  if (needs.length) {
    try { await threads.persistHeadlessShoutOutDraft(uid, merged); } catch (_) {}
    const view = shoutView.buildShoutOutSmartView({...viewBase, mode: "draft"});
    return shoutOutSmartOutcome(headless.missingAsk(needs, templateRow), lang, {
      model: "headless-draft",
      toolRounds: 0,
      smartViews: [view]
    });
  }
  const priorNeeds = previousDraft ? headless.interactiveNeeds(previousDraft, templateRow) : [];
  if (headless.isBareNegative(userPrompt) && parsed.confirmSubmit !== true && previousDraft && !priorNeeds.length) {
    try { await threads.persistHeadlessShoutOutDraft(uid, null); } catch (_) {}
    return shoutOutSmartOutcome("Cancelled — that ShoutOut was not sent.", lang, {
      model: "headless-draft",
      toolRounds: 0,
      smartViews: [],
      shoutOutPreview: "closed"
    });
  }
  if (!confirm) {
    try { await threads.persistHeadlessShoutOutDraft(uid, merged); } catch (_) {}
    const view = shoutView.buildShoutOutSmartView({...viewBase, mode: "ready", needs: []});
    return shoutOutSmartOutcome(
      "ShoutOut SMARTpreview is ready. Reply throw it to send, or cancel the shoutout.",
      lang,
      {model: "headless-draft", toolRounds: 0, smartViews: [view]}
    );
  }
  const result = await tools.startShoutOutCheckout({
    locationName: merged.clubQuery,
    clubLocationId: merged.clubQuery,
    mainText: merged.message || merged.playerName || merged.jerseyName,
    templateId: merged.templateId || headless.DEFAULT_TEMPLATE_ID,
    screenFormatId: merged.screenFormatId,
    includeAttribution: merged.handleDecision === "include",
    attribution: merged.attribution,
    mediaUrl: merged.mediaUrl || merged.facePhotoUrl,
    jerseyTeamId: merged.jerseyTeamId,
    jerseyName: merged.jerseyName,
    jerseyNumber: merged.jerseyNumber,
    playerName: merged.playerName,
    facePhotoUrl: merged.facePhotoUrl,
    userPrompt,
    returnBase: session?.request?.data?.returnBase
  }, session.request);
  const links = bot.linksFromToolResult(result, lang);
  if (result?.ok && (result.checkoutUrl || result.shoutoutId)) {
    try { await threads.persistHeadlessShoutOutDraft(uid, null); } catch (_) {}
  } else {
    try { await threads.persistHeadlessShoutOutDraft(uid, merged); } catch (_) {}
  }
  if (result?.ok && result.checkoutUrl) {
    const view = shoutView.buildShoutOutSmartView({
      ...viewBase,
      mode: "checkout",
      needs: [],
      venueName: result.venueName || merged.clubQuery,
      checkoutUrl: result.checkoutUrl
    });
    return shoutOutSmartOutcome(
      `Your ShoutOut at ${result.venueName || result.clubLocationId} is ready to pay. Open the secure Stripe link — I never take card numbers.`,
      lang,
      {results: links, smartViews: [view]}
    );
  }
  if (result?.ok && result.shoutoutId) {
    const view = shoutView.buildShoutOutSmartView({
      ...viewBase,
      mode: "submitted",
      needs: [],
      venueName: result.venueName || merged.clubQuery,
      shoutoutId: result.shoutoutId,
      portalHref: result.portalHref
    });
    return shoutOutSmartOutcome(
      `Your ShoutOut is in for club approval at ${result.venueName || result.clubLocationId}. It will play after the venue accepts it.`,
      lang,
      {results: links, smartViews: [view]}
    );
  }
  const fallback = bot.shoutOutExecuteFallback(lang, allowed);
  const view = shoutView.buildShoutOutSmartView({...viewBase, mode: "draft"});
  return shoutOutSmartOutcome(result?.error || fallback.reply, lang, {
    results: links.length ? links : fallback.results,
    smartViews: [view],
    model: "headless-draft"
  });
}

function vipSmartOutcome(reply, lang, extra = {}) {
  return {
    reply,
    results: extra.results || [],
    provider: extra.provider || "headless-vip",
    model: extra.model || "headless-vip",
    toolRounds: extra.toolRounds == null ? 1 : extra.toolRounds,
    uiLanguage: lang,
    smartViews: extra.smartViews || [],
    geminiOnView: false
  };
}

function joinFailureOutcome(error, lang) {
  const map = {
    not_found: ["botdee.room.joinFailed", "That BOT DEE invite isn't available. Ask your Mingl friend to send a new one."],
    closed: ["botdee.room.joinClosed", "That BOT DEE session has ended."],
    full: ["botdee.room.joinFull", "That BOT DEE session is full (host plus 7 guests)."],
    missing_join: ["botdee.room.joinFailed", "That BOT DEE invite isn't available. Ask your Mingl friend to send a new one."],
    wrong_account: ["botdee.room.wrongAccount", "Sign in as the Mingl friend this BOT DEE invite was sent to."],
    expired: ["botdee.room.expired", "That BOT DEE invite expired. Ask your Mingl friend to send a new one."],
    revoked: ["botdee.room.revoked", "That BOT DEE invite was revoked."],
    used: ["botdee.room.used", "That BOT DEE invite was already used."],
    not_friend: ["botdee.room.notFriend", "BOT DEE session invites are Mingl friends only."]
  };
  const pair = map[error] || map.not_found;
  return {
    reply: pair[1],
    results: [],
    provider: "local-room-smartview",
    model: "roomJoinFailed",
    toolRounds: 0,
    uiLanguage: lang,
    smartViews: [],
    replyKey: pair[0],
    geminiOnView: false
  };
}

function isPrivateBotDeeOutcome(outcome) {
  if (!outcome) return false;
  const provider = String(outcome.provider || "");
  const model = String(outcome.model || "");
  if (provider === "headless-vip" || provider === "headless-shoutout") return true;
  if (provider === "people-smartcard") return true;
  if (model === "roomJoinFailed") return true;
  if (Array.isArray(outcome.smartViews) && outcome.smartViews.some(row => row && (row.kind === "botDeeVip" || row.kind === "botDeeShoutOut"))) {
    return true;
  }
  return false;
}

async function tryHeadlessVip(userPrompt, session, uiLanguage, allowedFeatures, previousDraft) {
  const lang = bot.normalizeUiLanguage(uiLanguage);
  const allowed = allowedFeatures || null;
  const headless = require("./headless-vip-core");
  const vipView = require("./botdee-vip-smartview");
  const threadsMod = require("./bot-dee-thread");
  const tools = require("./bot-dee-tools");
  const uid = session?.userId || session?.request?.auth?.uid || "";
  const parsed = headless.parseVipExecute(userPrompt);
  if (parsed.cancel && previousDraft) {
    const cancelHoldId = String(previousDraft.holdId || "").trim();
    if (cancelHoldId) {
      const released = await tools.releaseVipHold({holdId: cancelHoldId}, session.request);
      const holdGone = !!(released?.ok || released?.code === "not-found");
      if (!holdGone) {
        const kept = headless.clipInteractiveDraft({...previousDraft, holdId: cancelHoldId});
        const stillVenue = headless.clubDisplayName(kept.clubQuery) || kept.clubQuery;
        try { await threadsMod.persistHeadlessVipDraft(uid, kept); } catch (_) {}
        const view = vipView.buildVipSmartView({
          draft: kept,
          needs: [],
          venueName: stillVenue,
          mode: "hold"
        });
        const table = kept.sectionLabel || kept.sectionId || "that table";
        return vipSmartOutcome(
          released?.error
            ? `VIP reserV is still holding ${table}. ${released.error} Finish I agree, or try cancel again.`
            : `VIP reserV is still holding ${table}. Finish I agree, or try cancel again.`,
          lang,
          {model: "headless-draft", toolRounds: 1, smartViews: [view]}
        );
      }
    }
    try { await threadsMod.persistHeadlessVipDraft(uid, null); } catch (_) {}
    const cancelledTable = previousDraft.sectionLabel || previousDraft.sectionId || "";
    const cancelledVenue = headless.clubDisplayName(previousDraft.clubQuery) || previousDraft.clubQuery || "";
    const cancelledView = vipView.buildVipSmartView({
      draft: {clubQuery: previousDraft.clubQuery || ""},
      needs: [],
      venueName: cancelledVenue,
      mode: "cancelled"
    });
    return vipSmartOutcome(
      cancelHoldId
        ? `Cancelled — the VIP reserV hold${cancelledTable ? ` on ${cancelledTable}` : ""} was released.`
        : "Cancelled — that VIP reserV hold was not created.",
      lang,
      {model: "headless-draft", toolRounds: cancelHoldId ? 1 : 0, smartViews: [cancelledView]}
    );
  }
  let merged = headless.mergeInteractiveDraft(previousDraft, parsed);
  if (headless.isOverviewPrompt(userPrompt)) {
    merged.sectionId = "";
    merged.sectionLabel = "";
    merged.sectionQuery = "";
    merged.matches = [];
  } else if (parsed.sectionQuery) {
    merged = headless.applySectionMatch(merged, parsed.sectionQuery).draft;
  } else if (
    !parsed.confirmHold
    && !parsed.acceptTerms
    && !parsed.cancel
    && !parsed.night
    && !parsed.partySize
    && headless.isFloorNavPrompt(userPrompt, merged)
  ) {
    merged = headless.applySectionMatch(merged, userPrompt).draft;
  }
  if (headless.isBareAffirmative(userPrompt) && merged.matches.length === 1 && !merged.sectionId) {
    merged.sectionId = merged.matches[0].id;
    merged.sectionLabel = merged.matches[0].label;
  }
  const priorHoldId = String(previousDraft?.holdId || "").trim();
  merged = headless.detachStaleHold(previousDraft, merged);
  if (priorHoldId && priorHoldId !== merged.holdId) {
    const released = await tools.releaseVipHold({holdId: priorHoldId}, session.request);
    const holdGone = !!(released?.ok || released?.code === "not-found");
    if (!holdGone) {
      merged = headless.clipInteractiveDraft({...previousDraft, holdId: priorHoldId});
      const stillVenue = headless.clubDisplayName(merged.clubQuery) || merged.clubQuery;
      try { await threadsMod.persistHeadlessVipDraft(uid, merged); } catch (_) {}
      const view = vipView.buildVipSmartView({
        draft: merged,
        needs: [],
        venueName: stillVenue,
        mode: "hold"
      });
      const table = merged.sectionLabel || merged.sectionId || "that table";
      return vipSmartOutcome(
        released?.error
          ? `VIP reserV is still holding ${table}. ${released.error} Finish I agree, or say cancel, before picking another.`
          : `VIP reserV is still holding ${table}. Finish I agree, or say cancel, before picking another.`,
        lang,
        {model: "headless-draft", toolRounds: 1, smartViews: [view]}
      );
    }
  }
  try {
    if (merged.clubQuery) merged.clubQuery = await tools.requireClubLocationId(merged.clubQuery);
  } catch (error) {
    const fallback = bot.vipExecuteFallback(lang, allowed);
    return vipSmartOutcome(error.message || fallback.reply, lang, {
      results: fallback.results,
      model: "headless-draft",
      toolRounds: 0
    });
  }
  const needs = headless.interactiveNeeds(merged);
  const venueName = headless.clubDisplayName(merged.clubQuery) || merged.clubQuery;
  const viewBase = {draft: merged, needs, venueName};
  if (needs.length) {
    try { await threadsMod.persistHeadlessVipDraft(uid, merged); } catch (_) {}
    const view = vipView.buildVipSmartView({...viewBase, mode: "draft"});
    return vipSmartOutcome(headless.missingAsk(needs, merged), lang, {
      model: "headless-draft",
      toolRounds: 0,
      smartViews: [view]
    });
  }
  const repeatingTable = !!(previousDraft && previousDraft.sectionId
    && previousDraft.sectionId === merged.sectionId
    && headless.isRepeatSelectedSection(userPrompt, merged));
  const wantsHold = parsed.confirmHold || headless.isBareAffirmative(userPrompt) || repeatingTable;
  const wantsTerms = parsed.acceptTerms || headless.isAcceptTermsPrompt(userPrompt);
  if (!merged.holdId && !wantsHold && !wantsTerms) {
    try { await threadsMod.persistHeadlessVipDraft(uid, merged); } catch (_) {}
    const view = vipView.buildVipSmartView({...viewBase, mode: "ready"});
    return vipSmartOutcome(
      `VIP reserV at ${venueName}: ${merged.sectionLabel || merged.sectionId} on ${merged.night} for ${merged.partySize}. Tap Hold it to reserve 30 minutes, or pick another table.`,
      lang,
      {model: "headless-draft", toolRounds: 0, smartViews: [view]}
    );
  }
  let holdLinks = [];
  if (!merged.holdId) {
    const hold = await tools.createVipHold({
      clubLocationId: merged.clubQuery,
      night: merged.night,
      sectionId: merged.sectionId,
      partySize: merged.partySize
    }, session.request);
    if (!hold?.ok) {
      try { await threadsMod.persistHeadlessVipDraft(uid, merged); } catch (_) {}
      const view = vipView.buildVipSmartView({
        ...viewBase,
        mode: "draft",
        draft: {...merged, matches: hold?.sections || merged.matches}
      });
      return vipSmartOutcome(hold?.error || "That table could not be held. Pick another section.", lang, {
        model: "headless-draft",
        toolRounds: 1,
        smartViews: [view]
      });
    }
    merged.holdId = hold.holdId || hold.hold?.holdId || "";
    holdLinks = bot.linksFromToolResult(hold, lang);
  }
  if (merged.holdId && wantsTerms) {
    try {
      const consent = await tools.recordVipConsent({holdId: merged.holdId, checks: {terms: true}}, session.request);
      merged.consentId = consent.consentId || "";
      if (merged.consentId) {
        const checkout = await tools.createVipCheckout({
          holdId: merged.holdId,
          consentId: merged.consentId,
          returnBase: session?.request?.data?.returnBase
        }, session.request);
        const links = bot.linksFromToolResult(checkout, lang);
        try { await threadsMod.persistHeadlessVipDraft(uid, null); } catch (_) {}
        const view = vipView.buildVipSmartView({
          ...viewBase,
          mode: "checkout",
          checkoutUrl: checkout.checkoutUrl || "",
          passHref: checkout.passHref || ""
        });
        return vipSmartOutcome(
          checkout.checkoutUrl
            ? "VIP reserV is ready to pay. Open the secure link — I never take card numbers."
            : (checkout.message || "VIP reserV hold is confirmed. Check your pass in My Profile."),
          lang,
          {results: links, smartViews: [view]}
        );
      }
    } catch (error) {
      console.warn("BOT DEE VIP consent/checkout failed", error?.message || error);
    }
  }
  try { await threadsMod.persistHeadlessVipDraft(uid, merged); } catch (_) {}
  const view = vipView.buildVipSmartView({...viewBase, mode: "hold", draft: merged});
  return vipSmartOutcome(
    `Held ${merged.sectionLabel || merged.sectionId} at ${venueName} for 30 minutes. Tap I agree to accept VIP Terms, then pay if a deposit is required.`,
    lang,
    {results: holdLinks, smartViews: [view]}
  );
}

function localSession(role, userPrompt, {active, uiLanguage, allowedFeatures, featureFlags, personalization, roomSmartViewDeclined, functionsReachable, geminiConfigured} = {}) {
  const lang = bot.normalizeUiLanguage(uiLanguage);
  const allowed = allowedFeatures || null;
  const isActive = !!active;
  if (bot.isPrivilegeAskPrompt(userPrompt)) {
    return {
      reply: bot.privilegeRefuseReply(),
      results: [],
      provider: "local-privacy",
      model: "privilege-guard",
      toolRounds: 0,
      uiLanguage: lang
    };
  }
  if (bot.isAckPrompt(userPrompt)) {
    return {
      reply: bot.ackReply(role, userPrompt),
      results: [],
      provider: "local-chitchat",
      model: "ack",
      toolRounds: 0,
      uiLanguage: lang
    };
  }
  if (bot.isMoodPrompt(userPrompt)) {
    return {
      reply: bot.moodReply(),
      results: [],
      provider: "local-chitchat",
      model: "mood",
      toolRounds: 0,
      uiLanguage: lang
    };
  }
  if (bot.isChitchatPrompt(userPrompt)) {
    return {
      reply: isActive ? bot.stillHereReply() : bot.chitchatReply(role, allowed, personalization),
      results: [],
      provider: "local-chitchat",
      model: isActive ? "still-here" : "chitchat",
      toolRounds: 0,
      uiLanguage: lang
    };
  }
  if (bot.isIdentityPrompt(userPrompt)) {
    return {
      reply: bot.identityReply(),
      results: [],
      provider: "local-identity",
      model: "identity",
      toolRounds: 0,
      uiLanguage: lang
    };
  }
  if (bot.isVersionPrompt(userPrompt)) {
    const versionView = require("./botdee-version-smartview").buildVersionSmartView({
      role,
      sessionPath: "local-version",
      functionsReachable: functionsReachable !== false,
      geminiConfigured: geminiConfigured === true
    });
    return {
      reply: bot.versionReply(role, userPrompt),
      results: [],
      provider: "local-version",
      model: "version",
      toolRounds: 0,
      uiLanguage: lang,
      smartViews: [versionView]
    };
  }
  if (bot.isFeaturesSmartViewPrompt(userPrompt)) {
    const features = require("./features-smartview-core");
    const catalog = require("./features-smartview/catalog.json");
    const canAccessKeys = {};
    (Array.isArray(allowed) ? allowed : []).forEach(key => { canAccessKeys[key] = true; });
    const pack = features.buildSmartView(catalog, userPrompt, {role, canAccessKeys, featureFlags: featureFlags || {}});
    return {
      reply: pack.reply,
      results: [],
      provider: pack.provider,
      model: pack.model,
      toolRounds: 0,
      uiLanguage: lang,
      smartViews: pack.smartViews,
      replyKey: pack.replyKey
    };
  }
  if (bot.isPrivacyPrompt(userPrompt)) {
    return {
      reply: bot.privacyReply(),
      results: [],
      provider: "local-help",
      model: "privacy",
      toolRounds: 0,
      uiLanguage: lang
    };
  }
  if (bot.isHelpPrompt(userPrompt)) {
    return {
      reply: bot.helpReply(),
      results: [],
      provider: "local-help",
      model: "help",
      toolRounds: 0,
      uiLanguage: lang
    };
  }
  if (bot.isShoutOutExecutePrompt(userPrompt)) {
    const pack = bot.shoutOutExecuteFallback(lang, allowed);
    return {
      reply: pack.reply,
      results: pack.results,
      provider: pack.provider,
      model: pack.model,
      toolRounds: 0,
      uiLanguage: lang
    };
  }
  if (bot.isVipExecutePrompt(userPrompt)) {
    const pack = bot.vipExecuteFallback(lang, allowed);
    return {
      reply: pack.reply,
      results: pack.results,
      provider: pack.provider,
      model: pack.model,
      toolRounds: 0,
      uiLanguage: lang
    };
  }
  const room = require("./botdee-room-smartview").buildRoomSession(userPrompt, {
    hasActiveRoom: false,
    declinedKeys: Array.isArray(roomSmartViewDeclined) ? roomSmartViewDeclined : []
  });
  if (room.handled) {
    return {
      reply: room.reply,
      results: [],
      provider: room.provider,
      model: room.model,
      toolRounds: 0,
      uiLanguage: lang,
      smartViews: room.smartViews,
      replyKey: room.replyKey
    };
  }
  const search = bot.localizeSearchPayload(
    bot.contextualSearch(userPrompt, bot.geminiGroundingRole(role), allowed),
    lang,
    allowed
  );
  return {
    reply: bot.sanitizeFeatureMentions(bot.formatSearchFallback(search, lang, allowed), allowed),
    results: bot.resultsForClient(search, lang),
    provider: "local-fallback",
    model: "contextualSearch",
    toolRounds: 1,
    uiLanguage: lang
  };
}

exports.executeBotSession = onCall(CALL_OPTS, async request => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in to chat with BOT DEE.");
    }
    await audit.assertFeatureAccess(request.auth, "botDee", request);

    const rawMessage = request.data?.message || request.data?.prompt || "";
    const storedUserText = bot.clipStoredText(rawMessage, bot.MAX_MESSAGE_CHARS);
    const userPrompt = bot.sanitizeUserPrompt(rawMessage);
    if (!userPrompt) throw new HttpsError("invalid-argument", "Send a message for BOT DEE.");

    const uiLanguage = bot.normalizeUiLanguage(
      request.data?.uiLanguage || request.data?.lang || request.data?.locale
    );
    const clientHistory = bot.sanitizeHistory(request.data?.history);
    const facts = await __botDeeHelpers.roleFactsFor(request.auth);
    const {role} = core.resolveViewerRole(facts);
    const uid = request.auth.uid;
    const receivedAtMs = Date.now();
    const settings = await threads.loadSettings();
    const coercedThreadId = bot.coerceThreadId(request.data?.threadId, uid);
    let stored = {durable: false, history: [], idleEnded: false, lastMessageAtMs: 0};
    if (settings.durableThreads) {
      try {
        stored = await threads.loadThreadState(uid, settings);
      } catch (err) {
        console.warn("BOT DEE loadThread failed", err?.message || err);
      }
    }
    const consent = memory.normalizeConsent(stored.consent);
    let history = settings.durableThreads ? stored.history : clientHistory;
    let memories = [];
    let summary = "";
    let executions = [];
    const sessionReset = !!(stored.sessionReset || prefs.needsSessionReset(stored));
    if (settings.durableThreads) {
      let events = [];
      let archived = [];
      if (!sessionReset) {
        try {
          events = await threads.loadEventHistory(uid, 12);
        } catch (err) {
          console.warn("BOT DEE event load failed", err?.message || err);
        }
        if (!events.length && stored.idleEnded && memory.consentAllows(consent, "archive")) {
          try {
            archived = await threads.loadArchiveHistory(uid, 12);
          } catch (err) {
            console.warn("BOT DEE archive load failed", err?.message || err);
          }
        }
      }
      history = threads.assembleRetrievalTurns({
        docTurns: stored.history,
        events,
        archiveTurns: archived,
        idleEnded: stored.idleEnded,
        archiveConsent: memory.consentAllows(consent, "archive"),
        sessionReset,
        retrievalFromSeq: stored.retrievalFromSeq
      });
      if (memory.consentAllows(consent, "memory")) {
        try {
          memories = await threads.loadAuthorizedMemories(uid, consent);
        } catch (err) {
          console.warn("BOT DEE memory load failed", err?.message || err);
        }
      }
      if (!sessionReset) {
        try {
          summary = stored.summary || await threads.loadLatestSummary(uid);
        } catch (err) {
          console.warn("BOT DEE summary load failed", err?.message || err);
        }
      }
      try {
        executions = await threads.loadExecutionReceipts(uid, 12);
      } catch (err) {
        console.warn("BOT DEE execution load failed", err?.message || err);
      }
    }
    // chatTitles are user-chosen + Chats labels only. Never put them in Gemini
    // context (privilege-leak: a title must not carry Master Admin identity).
    let modelContext = execution.buildModelContext({
      turns: history,
      summary,
      memories: memory.consentAllows(consent, "memory") ? memories : [],
      executions
    });
    history = modelContext.recentTurns;
    const active = bot.conversationIsActive(
      history,
      stored.lastMessageAtMs,
      settings.conversationIdleSeconds,
      receivedAtMs
    );
    let allowedFeatures = null;
    let featureFlags = {};
    try {
      const access = await loadAllowedFeatures(request.auth);
      allowedFeatures = access.keys;
      featureFlags = access.featureFlags || {};
    } catch (error) {
      console.warn("BOT DEE feature access load failed; fail closed to live defaults", error?.message || error);
      allowedFeatures = ["shoutOut", "botDee", "passes"];
    }
    const personalization = prefs.fromThread(stored);
    const session = Object.freeze({
      userId: uid,
      role,
      uiLanguage,
      allowedFeatures,
      lastUserPrompt: userPrompt,
      personalization,
      request,
      loadHelpVerbiage: async ids => {
        try {
          return await require("./help-verbiage-functions").loadPublishedMap(ids, require("firebase-admin/firestore").getFirestore());
        } catch (err) {
          console.warn("BOT DEE help verbiage load failed", err?.message || err);
          return {};
        }
      }
    });

    const apiKey = geminiKey();
    let persistedConversationId = "";
    if (settings.durableThreads) {
      try {
        const persistedUser = await threads.persistUserTurn(uid, settings, storedUserText, {
          receivedAtMs,
          consent,
          conversationId: request.data?.conversationId
        });
        if (persistedUser && persistedUser.conversationId) {
          persistedConversationId = persistedUser.conversationId;
        }
      } catch (err) {
        console.warn("BOT DEE persist user failed", err?.message || err);
        throw new HttpsError("unavailable", "BOT DEE could not save that message. Try again.");
      }
    } else {
      try {
        await threads.markHasUsedBotDee(uid, receivedAtMs);
      } catch (err) {
        console.warn("BOT DEE mark used failed", err?.message || err);
      }
    }
    let outcome;
    const roomDeclined = Array.isArray(request.data?.roomSmartViewDeclined)
      ? request.data.roomSmartViewDeclined.map(value => String(value || "").slice(0, 80)).filter(Boolean).slice(0, 24)
      : [];
    const roomLive = require("./botdee-room-live");
    const roomMod = require("./botdee-room-smartview");
    const roomConversationId = String(
      persistedConversationId || request.data?.conversationId || stored.currentConversationId || ""
    ).trim();
    if (
      stored.joinedRoomId
      && stored.joinedRoomConversationId
      && roomConversationId
      && stored.joinedRoomConversationId !== roomConversationId
    ) {
      try { await threads.persistJoinedRoomId(uid, null); } catch (_) {}
      stored.joinedRoomId = "";
      stored.joinedRoomConversationId = "";
    }
    if (stored.joinedRoomId) {
      try {
        const liveRoom = await roomLive.loadRoom(stored.joinedRoomId);
        if (!liveRoom || liveRoom.status !== "open" || !roomLive.memberOf(liveRoom, uid)) {
          await threads.persistJoinedRoomId(uid, null);
          stored.joinedRoomId = "";
          stored.joinedRoomConversationId = "";
        }
      } catch (error) {
        console.warn("BOT DEE room load failed", error?.message || error);
      }
    }
    const joinToken = String(request.data?.joinToken || request.data?.inviteToken || "").trim();
    const joinRoomId = String(request.data?.roomId || "").trim();
    if (joinToken) {
      try {
        await audit.assertFeatureAccess(request.auth, "mingl", request);
        const joined = await roomLive.joinRoom({uid, token: joinToken, roomId: joinRoomId});
        if (joined.ok) {
          await threads.persistJoinedRoomId(uid, joined.room.roomId, roomConversationId);
          stored.joinedRoomId = joined.room.roomId;
          stored.joinedRoomConversationId = roomConversationId;
          const view = roomMod.buildRoomSmartView({
            utterance: userPrompt,
            hasActiveRoom: true,
            participantCount: joined.room.participantCount,
            joinHref: joined.room.joinHref || ""
          });
          view.hasActiveRoom = true;
          view.roomsLive = true;
          view.lifecycle = "active";
          view.joinHref = "";
          view.participantCount = joined.room.participantCount;
          view.roomId = joined.room.roomId;
          outcome = {
            reply: "You're in this BOT DEE session with your Mingl friends. Joining does not charge anyone. Shared tab needs a separate opt-in.",
            results: [],
            provider: "local-room-smartview",
            model: "roomJoin",
            toolRounds: 0,
            uiLanguage,
            smartViews: [view],
            replyKey: "botdee.rs.joined",
            geminiOnView: false
          };
        } else {
          outcome = joinFailureOutcome(joined.error, uiLanguage);
        }
      } catch (error) {
        console.warn("BOT DEE room join failed", error?.message || error);
        outcome = joinFailureOutcome("not_found", uiLanguage);
      }
    } else if (joinRoomId) {
      try {
        await audit.assertFeatureAccess(request.auth, "mingl", request);
        const live = await roomLive.loadRoom(joinRoomId);
        if (live && live.status === "open" && roomLive.memberOf(live, uid)) {
          await threads.persistJoinedRoomId(uid, live.roomId, roomConversationId);
          stored.joinedRoomId = live.roomId;
          stored.joinedRoomConversationId = roomConversationId;
          const view = roomMod.buildRoomSmartView({
            utterance: userPrompt,
            hasActiveRoom: true,
            participantCount: live.participantCount,
            joinHref: ""
          });
          view.hasActiveRoom = true;
          view.roomsLive = true;
          view.lifecycle = "active";
          view.joinHref = "";
          view.participantCount = live.participantCount;
          view.roomId = live.roomId;
          outcome = {
            reply: "You're in this BOT DEE session with your Mingl friends. Joining does not charge anyone. Shared tab needs a separate opt-in.",
            results: [],
            provider: "local-room-smartview",
            model: "roomJoin",
            toolRounds: 0,
            uiLanguage,
            smartViews: [view],
            replyKey: "botdee.rs.joined",
            geminiOnView: false
          };
        }
      } catch (error) {
        console.warn("BOT DEE room member attach failed", error?.message || error);
      }
    }
    const roomAttached = roomMod.buildRoomSession(userPrompt, {
      hasActiveRoom: !!stored.joinedRoomId,
      declinedKeys: roomDeclined,
      roomId: stored.joinedRoomId || ""
    });
    const previousShoutDraft = stored.headlessShoutOutDraft || null;
    let previousShoutRow = null;
    if (previousShoutDraft) {
      try {
        previousShoutRow = await require("./bot-dee-tools").loadTemplateCollectableRow(previousShoutDraft.templateId);
      } catch (_) {
        previousShoutRow = null;
      }
    }
    const shoutFollowUp = !!(previousShoutDraft
      && require("./headless-shoutout-core").isInteractiveFollowUp(userPrompt, previousShoutDraft, previousShoutRow));
    const shoutExecute = bot.isShoutOutExecutePrompt(userPrompt) || shoutFollowUp;
    const previousVipDraft = stored.headlessVipDraft || null;
    const vipFollowUp = !!(previousVipDraft
      && require("./headless-vip-core").isInteractiveFollowUp(userPrompt, previousVipDraft));
    const vipExecute = bot.isVipExecutePrompt(userPrompt) || vipFollowUp;
    let venueAttached = null;
    let peopleAttached = null;
    const peopleIntent = peopleCards.classifyPeopleSearchIntent(userPrompt);
    if (!outcome && !shoutExecute && !vipExecute && !roomAttached.handled) {
      try {
        venueAttached = await require("./bot-dee-tools").attachVenueSearch({
          query: userPrompt,
          request
        });
      } catch (error) {
        console.warn("BOT DEE venue search attach failed", error?.message || error);
      }
    }
    if (!outcome && !shoutExecute && !vipExecute && !roomAttached.handled && !(venueAttached && venueAttached.handled)) {
      try {
        peopleAttached = await peopleCards.attachPeopleSearch({
          query: userPrompt,
          viewerUid: uid,
          uiLanguage,
          request,
          page: request.data?.peoplePage
        });
      } catch (error) {
        console.warn("BOT DEE people SMARTcard attach failed", error?.message || error);
      }
    }
    // Greetings / identity stay chat-like even when Gemini is down or mis-calls search.
    if (outcome) {
      /* join already handled */
    } else if (shoutExecute) {
      try {
        outcome = await tryHeadlessShoutOut(
          userPrompt, session, uiLanguage, allowedFeatures, previousShoutDraft, history, previousShoutRow
        );
      } catch (error) {
        console.warn("BOT DEE headless ShoutOut failed", error?.message || error);
        outcome = null;
      }
      if (!outcome) {
        outcome = localSession(role, userPrompt, {
          active, uiLanguage, allowedFeatures, featureFlags, personalization, roomSmartViewDeclined: roomDeclined,
          functionsReachable: true,
          geminiConfigured: !!apiKey
        });
      }
    } else if (vipExecute) {
      try {
        outcome = await tryHeadlessVip(
          userPrompt, session, uiLanguage, allowedFeatures, previousVipDraft
        );
      } catch (error) {
        console.warn("BOT DEE headless VIP failed", error?.message || error);
        outcome = vipSmartOutcome(
          error?.message || "VIP reserV could not place that hold. Pick another table or night.",
          uiLanguage,
          {model: "headless-draft", toolRounds: 0, smartViews: []}
        );
      }
    } else if (roomAttached.handled) {
      const classified = roomAttached.classified || {};
      const confirmRoom = classified.command === "confirm" || classified.route === "confirm";
      const leaveRoom = classified.command === "leave" || classified.command === "make_private";
      const endRoom = classified.command === "end";
      const kickRoom = classified.command === "kick";
      const inviteRoom = classified.command === "invite";
      if (leaveRoom && stored.joinedRoomId) {
        try {
          const left = await roomLive.leaveRoom({uid, roomId: stored.joinedRoomId});
          const closedByHost = !!(left && left.closed);
          const members = closedByHost && Array.isArray(left.memberUids) && left.memberUids.length
            ? left.memberUids
            : [uid];
          for (const member of members) {
            try { await threads.persistJoinedRoomId(member, null); } catch (_) {}
          }
          stored.joinedRoomId = "";
          stored.joinedRoomConversationId = "";
          outcome = {
            reply: closedByHost
              ? "This Room SMARTview is closed. Private BOT DEE chat continues here."
              : "You left this Room SMARTview. Your private BOT DEE chat continues here.",
            results: [],
            provider: "local-room-smartview",
            model: closedByHost ? "roomEnd" : "roomLeave",
            toolRounds: 0,
            uiLanguage,
            smartViews: [],
            replyKey: closedByHost ? "botdee.rs.endedLive" : "botdee.rs.leftLive",
            geminiOnView: false
          };
        } catch (error) {
          console.warn("BOT DEE room leave failed", error?.message || error);
        }
      } else if (endRoom && stored.joinedRoomId) {
        try {
          const ended = await roomLive.endRoom({uid, roomId: stored.joinedRoomId});
          if (ended.ok) {
            const members = Array.isArray(ended.memberUids) && ended.memberUids.length
              ? ended.memberUids
              : [uid];
            for (const member of members) {
              try { await threads.persistJoinedRoomId(member, null); } catch (_) {}
            }
            stored.joinedRoomId = "";
            stored.joinedRoomConversationId = "";
            outcome = {
              reply: "This Room SMARTview is closed. Private BOT DEE chat continues here.",
              results: [],
              provider: "local-room-smartview",
              model: "roomEnd",
              toolRounds: 0,
              uiLanguage,
              smartViews: [],
              replyKey: "botdee.rs.endedLive",
              geminiOnView: false
            };
          } else {
            outcome = {
              reply: "Only the host can end this Room SMARTview. Say leave the room to leave without closing it.",
              results: [],
              provider: "local-room-smartview",
              model: "roomEndDenied",
              toolRounds: 0,
              uiLanguage,
              smartViews: roomAttached.smartViews || [],
              replyKey: "botdee.rs.endNeedsHost",
              geminiOnView: false
            };
          }
        } catch (error) {
          console.warn("BOT DEE room end failed", error?.message || error);
        }
      } else if (kickRoom && stored.joinedRoomId) {
        try {
          const resolved = await roomLive.resolveKickTarget({
            roomId: stored.joinedRoomId,
            needles: classified.namedNeedles
          });
          const target = resolved.hits && resolved.hits.length === 1 ? resolved.hits[0] : null;
          if (!target) {
            outcome = {
              reply: "Name the guest to remove, or use Remove on the members panel. Only the host can kick.",
              results: [],
              provider: "local-room-smartview",
              model: "roomKick",
              toolRounds: 0,
              uiLanguage,
              smartViews: roomAttached.smartViews || [],
              replyKey: "botdee.room.commandKick",
              geminiOnView: false
            };
          } else {
            const kicked = await roomLive.kickMember({
              hostUid: uid,
              roomId: stored.joinedRoomId,
              targetUid: target.uid
            });
            if (kicked && kicked.ok) {
              outcome = {
                reply: "That guest was removed from this BOT DEE session. They cannot read further room messages.",
                results: [],
                provider: "local-room-smartview",
                model: "roomKick",
                toolRounds: 0,
                uiLanguage,
                smartViews: roomAttached.smartViews || [],
                replyKey: "botdee.room.kicked",
                geminiOnView: false
              };
            } else {
              outcome = {
                reply: kicked && kicked.error === "not_host"
                  ? "Only the host can remove a guest. Kicked friends cannot read further room messages."
                  : "Could not remove that guest.",
                results: [],
                provider: "local-room-smartview",
                model: "roomKickDenied",
                toolRounds: 0,
                uiLanguage,
                smartViews: roomAttached.smartViews || [],
                replyKey: kicked && kicked.error === "not_host" ? "botdee.room.commandKick" : "botdee.room.kickFailed",
                geminiOnView: false
              };
            }
          }
        } catch (error) {
          console.warn("BOT DEE room kick failed", error?.message || error);
        }
      } else if (inviteRoom && stored.joinedRoomId && Array.isArray(classified.namedNeedles) && classified.namedNeedles.length) {
        try {
          await audit.assertFeatureAccess(request.auth, "mingl", request);
          const sessionCore = require("./botdee-session-core");
          const invited = await roomLive.inviteNamedGuests({
            uid,
            roomId: stored.joinedRoomId,
            needles: classified.namedNeedles,
            actorEmail: request.auth?.token?.email || "",
            actorRole: "patron"
          });
          const reason = invited && invited.error;
          if (invited && invited.ok) {
            outcome = {
              reply: "Invite sent to Inbox. Mingl friends only.",
              results: [],
              provider: "local-room-smartview",
              model: "roomInvite",
              toolRounds: 0,
              uiLanguage,
              smartViews: roomAttached.smartViews || [],
              replyKey: "botdee.room.invited",
              geminiOnView: false
            };
          } else if (reason === "self" || reason === "already_member" || reason === "full" || reason === "not_friend") {
            const replyKeys = {
              self: "botdee.room.self",
              already_member: "botdee.room.alreadyMember",
              full: "botdee.room.joinFull",
              not_friend: "botdee.room.notFriend"
            };
            outcome = {
              reply: sessionCore.denialMessage(reason),
              results: [],
              provider: "local-room-smartview",
              model: "roomInviteDenied",
              toolRounds: 0,
              uiLanguage,
              smartViews: roomAttached.smartViews || [],
              replyKey: replyKeys[reason],
              geminiOnView: false
            };
          }
        } catch (error) {
          console.warn("BOT DEE room invite failed", error?.message || error);
        }
      } else if (confirmRoom) {
        try {
          await audit.assertFeatureAccess(request.auth, "mingl", request);
          let created = null;
          if (stored.joinedRoomId) {
            const rotated = await roomLive.rotateJoinToken({uid, roomId: stored.joinedRoomId});
            if (rotated.ok) created = rotated;
            else if (rotated.error === "not_host") {
              const existing = await roomLive.loadRoom(stored.joinedRoomId);
              outcome = {
                reply: "You're already in this BOT DEE session. Invite Mingl friends from the card — Confirm does not open a second room.",
                results: [],
                provider: "local-room-smartview",
                model: "roomConfirm",
                toolRounds: 0,
                uiLanguage,
                smartViews: roomAttached.smartViews || [],
                replyKey: "botdee.rs.alreadyOpen",
                geminiOnView: false
              };
              if (existing) {
                const view = (outcome.smartViews && outcome.smartViews[0]) || roomMod.buildRoomSmartView({
                  utterance: userPrompt,
                  classified,
                  hasActiveRoom: true,
                  participantCount: existing.participantCount
                });
                view.hasActiveRoom = true;
                view.roomsLive = true;
                view.lifecycle = "active";
                view.needsConfirmation = false;
                view.participantCount = existing.participantCount;
                view.roomId = existing.roomId;
                outcome.smartViews = [view];
              }
            }
          }
          if (!created && !outcome) {
            created = await roomLive.createRoom({
              hostUid: uid,
              conversationId: roomConversationId,
              title: classified.authorizedTitle || "BOT DEE group session"
            });
          }
          if (created && created.ok) {
            await threads.persistJoinedRoomId(uid, created.room.roomId, roomConversationId);
            stored.joinedRoomId = created.room.roomId;
            stored.joinedRoomConversationId = roomConversationId;
            const view = (roomAttached.smartViews && roomAttached.smartViews[0]) || roomMod.buildRoomSmartView({
              utterance: userPrompt,
              classified,
              hasActiveRoom: true,
              participantCount: created.room.participantCount || 1
            });
            view.hasActiveRoom = true;
            view.roomsLive = true;
            view.lifecycle = "active";
            view.needsConfirmation = false;
            view.joinHref = "";
            view.roomId = created.room.roomId;
            view.participantCount = created.room.participantCount;
            view.actions = {...(view.actions || {}), create: false, invite: true, end: true, tabOptIn: true, charge: false};
            outcome = {
              reply: "BOT DEE session is open. Invite Mingl friends from the card. Guests can invite too, up to host plus 7. Joining does not charge anyone.",
              results: [],
              provider: "local-room-smartview",
              model: "roomConfirm",
              toolRounds: 0,
              uiLanguage,
              smartViews: [view],
              replyKey: "botdee.room.confirmedLive",
              geminiOnView: false
            };
          }
        } catch (error) {
          console.warn("BOT DEE room confirm failed", error?.message || error);
        }
      }
      if (!outcome) {
        outcome = {
          reply: roomAttached.reply,
          results: [],
          provider: roomAttached.provider,
          model: roomAttached.model,
          toolRounds: 0,
          uiLanguage,
          smartViews: roomAttached.smartViews || [],
          replyKey: roomAttached.replyKey,
          geminiOnView: false
        };
      }
    } else if (venueAttached && venueAttached.handled) {
      outcome = {
        reply: venueAttached.reply,
        results: [],
        media: venueAttached.media || [],
        provider: "floqr-venues",
        model: "placeSearch",
        toolRounds: 0,
        uiLanguage,
        smartViews: venueAttached.smartViews || [],
        replyKey: venueAttached.replyKey,
        venueSearch: venueAttached.venueSearch,
        geminiOnView: false
      };
    } else if (peopleAttached && peopleAttached.handled) {
      outcome = {
        reply: peopleAttached.reply,
        results: [],
        provider: "people-smartcard",
        model: "peopleSearch",
        toolRounds: 0,
        uiLanguage,
        smartViews: peopleAttached.smartViews || [],
        peopleSearch: peopleAttached.peopleSearch,
        geminiOnView: false
      };
    } else if (peopleIntent.intent !== "none") {
      const peopleCore = require("./botdee-smartcard-core");
      outcome = {
        reply: peopleCore.fallbackReply("error"),
        results: [],
        provider: "people-smartcard",
        model: "peopleSearch",
        toolRounds: 0,
        uiLanguage,
        smartViews: [],
        peopleSearch: {
          schemaVersion: peopleCore.SCHEMA_VERSION,
          mode: "error",
          intent: peopleIntent.intent,
          geminiOnView: false,
          replyKey: peopleCore.replyKeyForMode("error")
        },
        geminiOnView: false
      };
    } else if (
      bot.isPrivilegeAskPrompt(userPrompt)
      || bot.isAckPrompt(userPrompt)
      || bot.isMoodPrompt(userPrompt)
      || bot.isChitchatPrompt(userPrompt)
      || bot.isIdentityPrompt(userPrompt)
      || bot.isVersionPrompt(userPrompt)
      || bot.isFeaturesSmartViewPrompt(userPrompt)
      || bot.isHelpPrompt(userPrompt)
      || bot.isPrivacyPrompt(userPrompt)
    ) {
      outcome = localSession(role, userPrompt, {
        active, uiLanguage, allowedFeatures, featureFlags, personalization, roomSmartViewDeclined: roomDeclined,
        functionsReachable: true,
        geminiConfigured: !!apiKey
      });
    } else if (apiKey) {
      if (stored.joinedRoomId) {
        try {
          const roomTurns = await roomLive.loadTurns(stored.joinedRoomId, 12);
          if (roomTurns.length) {
            history = roomTurns;
            modelContext = execution.buildModelContext({
              turns: roomTurns,
              summary: "",
              memories: [],
              executions: []
            });
          }
        } catch (error) {
          console.warn("BOT DEE room turns load failed", error?.message || error);
        }
      }
      try {
        outcome = await runGeminiSession({
          apiKey, role, history, userPrompt, session, uiLanguage, allowedFeatures, personalization, modelContext
        });
      } catch (error) {
        console.warn("BOT DEE Gemini failed; using contextualSearch fallback", error?.message || error);
        outcome = localSession(role, userPrompt, {
          active, uiLanguage, allowedFeatures, featureFlags, personalization, roomSmartViewDeclined: roomDeclined,
          functionsReachable: true,
          geminiConfigured: !!apiKey
        });
        outcome.geminiError = String(error?.message || error).slice(0, 180);
      }
    } else {
      outcome = localSession(role, userPrompt, {
        active, uiLanguage, allowedFeatures, featureFlags, personalization, roomSmartViewDeclined: roomDeclined,
        functionsReachable: true,
        geminiConfigured: false
      });
    }
    const versionCardOnly = Array.isArray(outcome.smartViews)
      && outcome.smartViews.some(row => row && row.kind === "botDeeVersion")
      && !String(outcome.reply || "").trim();
    outcome.reply = bot.sanitizeBotReply(outcome.reply, {allowEmpty: versionCardOnly});

    if (settings.durableThreads) {
      try {
        await threads.persistModelTurn(uid, settings, outcome.reply, {
          receivedAtMs,
          media: outcome.media,
          consent,
          allowEmpty: versionCardOnly,
          conversationId: persistedConversationId
        });
        if (bot.isFarewellPrompt(userPrompt)) {
          await threads.markIdleEnded(uid, settings);
        }
      } catch (err) {
        console.warn("BOT DEE persist model failed", err?.message || err);
      }
    }
    if (stored.joinedRoomId && !isPrivateBotDeeOutcome(outcome)) {
      try {
        const sessionStore = require("./botdee-session-store");
        const allowedTurn = await sessionStore.consumeRate("turn", stored.joinedRoomId, {
          nowMs: Date.now(),
          windowMs: 60 * 1000,
          max: require("./botdee-session-core").TURN_RATE_PER_MIN
        });
        if (!allowedTurn) {
          console.warn("BOT DEE room turn rate limited", stored.joinedRoomId);
        }
        const written = allowedTurn
          ? await roomLive.appendTurn(stored.joinedRoomId, uid, "user", userPrompt)
          : {ok: false};
        if (written && written.ok && String(outcome.reply || "").trim()) {
          await roomLive.appendTurn(stored.joinedRoomId, uid, "model", outcome.reply);
        } else if (written && (written.error === "closed" || written.error === "not_found" || written.error === "not_member")) {
          await threads.persistJoinedRoomId(uid, null);
          stored.joinedRoomId = "";
          stored.joinedRoomConversationId = "";
        }
      } catch (err) {
        console.warn("BOT DEE room persist failed", err?.message || err);
      }
    }
    try {
      const alreadyVersion = Array.isArray(outcome.smartViews)
        && outcome.smartViews.some(row => row && row.kind === "botDeeVersion");
      const alreadyRoom = Array.isArray(outcome.smartViews)
        && outcome.smartViews.some(row => row && row.kind === "botDeeRoom");
      const alreadyShout = Array.isArray(outcome.smartViews)
        && outcome.smartViews.some(row => row && row.kind === "botDeeShoutOut");
      const alreadyVip = Array.isArray(outcome.smartViews)
        && outcome.smartViews.some(row => row && row.kind === "botDeeVip");
      if (
        !alreadyVersion
        && !alreadyRoom
        && !alreadyShout
        && !alreadyVip
        && !outcome.smartViews
        && /\b(smartview|smart view|research library|explain (?:my )?recommendation)\b/i.test(userPrompt)
      ) {
        outcome.smartViews = smart.mockCatalog();
      }
      if (stored.joinedRoomId && Array.isArray(outcome.smartViews)) {
        outcome.smartViews.forEach((view) => {
          if (view && view.kind === "botDeeRoom" && !view.roomId) {
            view.roomId = stored.joinedRoomId;
          }
        });
      }
    } catch (_) {}

    console.info(JSON.stringify({
      event: "botdee.session",
      uid,
      uiLanguage,
      provider: outcome.provider,
      durable: !!settings.durableThreads,
      results: (outcome.results || []).length,
      toolRounds: outcome.toolRounds || 0
    }));

    return {
      ok: true,
      role,
      uiLanguage,
      allowedFeatures,
      reply: outcome.reply,
      results: outcome.results || [],
      media: Array.isArray(outcome.media) ? outcome.media.slice(0, 8) : [],
      provider: outcome.provider,
      model: outcome.model,
      toolRounds: outcome.toolRounds || 0,
      durable: !!settings.durableThreads,
      threadId: coercedThreadId || bot.threadIdForUid(uid),
      conversationId: persistedConversationId,
      conversationIdleSeconds: settings.conversationIdleSeconds,
      consent,
      hasUsedBotDee: 1,
      smartViews: Array.isArray(outcome.smartViews) ? outcome.smartViews : [],
      shoutOutPreview: outcome.shoutOutPreview || "",
      peopleSearch: outcome.peopleSearch || null,
      venueSearch: outcome.venueSearch || null,
      replyKey: outcome.replyKey || outcome.peopleSearch?.replyKey || "",
      geminiOnView: outcome.geminiOnView === true
    };
  } catch (error) {
    throw asHttps(error);
  }
});

/**
 * Master Admin — save BOT DEE conversation settings (idle pause seconds).
 * SOS2FA + reason; Functions-write only (clients read botDeeSettings/default).
 */
exports.setBotDeeSettings = onCall(ADMIN_CALL_OPTS, async request => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in as Master Admin.");
    }
    if (!isServerAdminAuth(request.auth)) {
      throw new HttpsError("permission-denied", "Master Admin only.");
    }
    const {email, sessionId} = await assertSos2faSession(request);
    const reason = String(request.data?.reason || "").trim();
    if (reason.length < REASON_MIN) {
      throw new HttpsError(
        "invalid-argument",
        `Enter a reason of at least ${REASON_MIN} characters. It is saved in the audit trail.`
      );
    }
    const nextIdle = bot.clampIdleSeconds(request.data?.conversationIdleSeconds);
    const ref = db.doc(BOT_DEE_SETTINGS_DOC);
    const snap = await ref.get();
    const before = bot.normalizeBotDeeSettings(snap.exists ? snap.data() : null);
    if (before.conversationIdleSeconds === nextIdle) {
      throw new HttpsError("failed-precondition", "Nothing changed — idle pause already has that value.");
    }
    const nowMs = Date.now();
    const after = {
      conversationIdleSeconds: nextIdle,
      revision: before.revision + 1,
      updatedAtMs: nowMs,
      updatedAtIso: new Date(nowMs).toISOString(),
      updatedByUid: request.auth.uid,
      updatedByEmail: email || request.auth.token?.email || "",
      lastChangeReason: reason.slice(0, 500),
      sos2faSessionHash: String(sessionId || "").slice(0, 16)
    };
    await ref.set({
      ...after,
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
    console.info(JSON.stringify({
      event: "botdee.settings_changed",
      actorEmail: after.updatedByEmail,
      before: {conversationIdleSeconds: before.conversationIdleSeconds},
      after: {conversationIdleSeconds: after.conversationIdleSeconds},
      reason: after.lastChangeReason
    }));
    return {ok: true, settings: bot.normalizeBotDeeSettings(after), before, after};
  } catch (error) {
    throw asHttps(error);
  }
});

async function readProfileFirstName(uid) {
  if (!uid) return "";
  try {
    const snap = await db.collection("users").doc(uid).get();
    const data = snap.exists ? snap.data() : {};
    return prefs.firstNameFromDisplayName(data.displayName || data.firstName || "");
  } catch (_) {
    return "";
  }
}

const GET_THREAD_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB", maxInstances: 20};

exports.saveBotDeePersonalization = onCall(GET_THREAD_OPTS, async request => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in to save BOT DEE settings.");
    }
    await audit.assertFeatureAccess(request.auth, "botDee", request);
    const saved = await threads.savePersonalization(request.auth.uid, request.data || {});
    if (!saved.ok) throw new HttpsError("invalid-argument", "Could not save BOT DEE settings.");
    return {ok: true, personalization: saved.personalization};
  } catch (error) {
    throw asHttps(error);
  }
});

exports.getBotDeeThread = onCall(GET_THREAD_OPTS, async request => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in to chat with BOT DEE.");
    }
    await audit.assertFeatureAccess(request.auth, "botDee", request);
    const uid = request.auth.uid;
    const settings = await threads.loadSettings();
    if (!settings.durableThreads) {
      const hasUsedBotDee = await threads.readHasUsedBotDee(uid);
      const profileFirstName = await readProfileFirstName(uid);
      return {
        ok: true,
        durable: false,
        status: "fresh",
        threadId: bot.threadIdForUid(uid),
        turns: [],
        idleSeconds: settings.conversationIdleSeconds,
        remainingMs: settings.conversationIdleSeconds * 1000,
        consent: memory.normalizeConsent({}),
        hasUsedBotDee,
        personalization: prefs.normalizePersonalization({}, {profileFirstName}),
        profileFirstName,
        chatTitles: {},
        [prefs.LAST_USED_FIELD]: 0
      };
    }
    const state = await threads.loadThreadState(uid, settings);
    let eventTurns = [];
    let archiveTurns = [];
    const sessionReset = !!(state.sessionReset || prefs.needsSessionReset(state));
    if (!sessionReset) {
      try {
        eventTurns = await threads.loadEventHistory(uid, 12);
      } catch (_) {}
      if (!eventTurns.length && !state.turns.length && state.idleEnded && state.archiveRetained) {
        try {
          archiveTurns = await threads.loadArchiveHistory(uid, 12);
        } catch (_) {}
      }
    }
    const retrievalTurns = threads.assembleRetrievalTurns({
      docTurns: state.turns,
      events: eventTurns,
      archiveTurns,
      idleEnded: state.idleEnded,
      archiveConsent: state.archiveRetained,
      sessionReset,
      retrievalFromSeq: state.retrievalFromSeq
    });
    const profileFirstName = await readProfileFirstName(uid);
    const currentConversationId = threads.clipConversationId(state.currentConversationId)
      || threads.conversationIdFromTurns(retrievalTurns);
    const archiveConversationId = threads.clipConversationId(state.archiveConversationId)
      || threads.conversationIdFromTurns(archiveTurns);
    if (currentConversationId) {
      retrievalTurns.forEach(row => {
        if (row && !row.conversationId) row.conversationId = currentConversationId;
      });
    }
    if (archiveConversationId) {
      archiveTurns.forEach(row => {
        if (row && !row.conversationId) row.conversationId = archiveConversationId;
      });
    }
    const titleSlices = {
      currentConversationId,
      archiveConversationId,
      liveConversationId: currentConversationId,
      currentTurns: retrievalTurns,
      archiveTurns
    };
    let chatTitles = threads.migrateChatTitles(state.chatTitles, titleSlices);
    if (threads.chatTitlesNeedWrite(state.chatTitles)) {
      try {
        const saved = await threads.persistChatTitles(uid, state.chatTitles, Date.now(), titleSlices);
        if (saved && saved.chatTitles) chatTitles = saved.chatTitles;
      } catch (_) {}
    }
    return {
      ok: true,
      durable: true,
      status: state.status,
      threadId: state.threadId,
      turns: retrievalTurns,
      archiveTurns,
      consent: state.consent,
      hasUsedBotDee: state.hasUsedBotDee === 1 ? 1 : 0,
      conversationEpoch: state.conversationEpoch,
      currentConversationId,
      archiveConversationId,
      lastMessageAtMs: state.lastMessageAtMs,
      remainingMs: state.remainingMs,
      idleSeconds: settings.conversationIdleSeconds,
      personalization: prefs.normalizePersonalization(state.personalization, {profileFirstName}),
      profileFirstName,
      chatTitles,
      [prefs.LAST_USED_FIELD]: Number(state[prefs.LAST_USED_FIELD]) || 0
    };
  } catch (error) {
    throw asHttps(error);
  }
});

exports.renameBotDeeChat = onCall(GET_THREAD_OPTS, async request => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in to rename a BOT DEE chat.");
    }
    await audit.assertFeatureAccess(request.auth, "botDee", request);
    const uid = request.auth.uid;
    const result = await threads.renameChat(uid, request.data?.chatId, request.data?.title, Date.now(), {
      conversationId: request.data?.conversationId
    });
    if (!result.ok) {
      if (result.error === "invalid_chat_id" || result.error === "empty_title") {
        throw new HttpsError("invalid-argument", "Enter a chat title.");
      }
      throw new HttpsError("failed-precondition", "Could not rename that chat.");
    }
    return {
      ok: true,
      chatId: result.chatId,
      title: result.title,
      chatTitles: result.chatTitles
    };
  } catch (error) {
    if (error?.code === "permission-denied") {
      throw new HttpsError("permission-denied", "You can only rename your own chats.");
    }
    throw asHttps(error);
  }
});

exports.__botDeeHelpers = {
  runGeminiSession,
  localSession,
  tryHeadlessShoutOut,
  tryHeadlessVip,
  geminiKey,
  BOT_DEE_SETTINGS_DOC
};
