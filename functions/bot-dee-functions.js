/* BOT DEE — executeBotSession callable (Auth + botDee gate + classification → Gemini + tools).
   Tools: contextualSearch + VIP / ShoutOut / FloqCAST / checkout (each re-validates role).
   Durable threads: getBotDeeThread + persist under botDeeThreads/{uid}.
   Master Admin: setBotDeeSettings (idle pause) under SOS2FA. */
"use strict";

const admin = require("firebase-admin");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {GoogleGenAI, FunctionCallingConfigMode} = require("@google/genai");
const core = require("./data-classification-core");
const bot = require("./bot-dee-core");
const threads = require("./bot-dee-thread");
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

async function runGeminiSession({apiKey, role, history, userPrompt, session}) {
  const ai = new GoogleGenAI({apiKey});
  const contents = bot.historyToContents(history, userPrompt);
  const tools = [{functionDeclarations: bot.toolDeclarations()}];
  let lastSearch = null;
  const actionLinks = [];
  let rounds = 0;

  while (rounds < bot.MAX_TOOL_ROUNDS) {
    rounds += 1;
    const response = await ai.models.generateContent({
      model: bot.TEXT_MODEL,
      contents,
      config: {
        systemInstruction: bot.systemInstruction(role),
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
      return {
        reply: text || bot.formatSearchFallback(lastSearch),
        results: [...bot.resultsForClient(lastSearch), ...actionLinks],
        provider: "gemini",
        model: bot.TEXT_MODEL,
        toolRounds: rounds - (text ? 1 : 0)
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
      if (call.name === "contextualSearch") lastSearch = result;
      bot.linksFromToolResult(result).forEach(link => actionLinks.push(link));
      responseParts.push(functionResponsePart(call, result));
    }
    contents.push({role: "user", parts: responseParts});
  }

  return {
    reply: bot.formatSearchFallback(lastSearch),
    results: [...bot.resultsForClient(lastSearch), ...actionLinks],
    provider: "gemini",
    model: bot.TEXT_MODEL,
    toolRounds: rounds,
    truncated: true
  };
}

function localSession(role, userPrompt, ctx) {
  const active = !!(ctx && ctx.active);
  if (bot.isAckPrompt(userPrompt)) {
    return {
      reply: bot.ackReply(role, userPrompt),
      results: [],
      provider: "local-chitchat",
      model: "ack",
      toolRounds: 0
    };
  }
  if (bot.isMoodPrompt(userPrompt)) {
    return {
      reply: bot.moodReply(),
      results: [],
      provider: "local-chitchat",
      model: "mood",
      toolRounds: 0
    };
  }
  if (bot.isChitchatPrompt(userPrompt)) {
    return {
      reply: active ? bot.stillHereReply() : bot.chitchatReply(role),
      results: [],
      provider: "local-chitchat",
      model: active ? "still-here" : "chitchat",
      toolRounds: 0
    };
  }
  if (bot.isIdentityPrompt(userPrompt)) {
    return {
      reply: bot.identityReply(),
      results: [],
      provider: "local-identity",
      model: "identity",
      toolRounds: 0
    };
  }
  const search = bot.contextualSearch(userPrompt, role);
  return {
    reply: bot.formatSearchFallback(search),
    results: bot.resultsForClient(search),
    provider: "local-fallback",
    model: "contextualSearch",
    toolRounds: 1
  };
}

exports.executeBotSession = onCall(CALL_OPTS, async request => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in to chat with BOT DEE.");
    }
    await audit.assertFeatureAccess(request.auth, "botDee", request);

    const userPrompt = bot.sanitizeUserPrompt(request.data?.message || request.data?.prompt || "");
    if (!userPrompt) throw new HttpsError("invalid-argument", "Send a message for BOT DEE.");

    const clientHistory = bot.sanitizeHistory(request.data?.history);
    const facts = await __botDeeHelpers.roleFactsFor(request.auth);
    const {role} = core.resolveViewerRole(facts);
    const uid = request.auth.uid;
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
    const history = settings.durableThreads ? stored.history : clientHistory;
    const active = bot.conversationIsActive(
      history,
      stored.lastMessageAtMs,
      settings.conversationIdleSeconds,
      Date.now()
    );
    const session = Object.freeze({
      userId: uid,
      role,
      lastUserPrompt: userPrompt,
      request
    });

    const apiKey = geminiKey();
    let outcome;
    // Greetings / identity stay chat-like even when Gemini is down or mis-calls search.
    if (
      bot.isAckPrompt(userPrompt)
      || bot.isMoodPrompt(userPrompt)
      || bot.isChitchatPrompt(userPrompt)
      || bot.isIdentityPrompt(userPrompt)
    ) {
      outcome = localSession(role, userPrompt, {active});
    } else if (apiKey) {
      try {
        outcome = await runGeminiSession({apiKey, role, history, userPrompt, session});
      } catch (error) {
        console.warn("BOT DEE Gemini failed; using contextualSearch fallback", error?.message || error);
        outcome = localSession(role, userPrompt, {active});
        outcome.geminiError = String(error?.message || error).slice(0, 180);
      }
    } else {
      outcome = localSession(role, userPrompt, {active});
    }

    if (settings.durableThreads) {
      try {
        await threads.persistExchange(uid, settings, userPrompt, outcome.reply);
        if (bot.isFarewellPrompt(userPrompt)) {
          await threads.markIdleEnded(uid, settings);
        }
      } catch (err) {
        console.warn("BOT DEE persist failed", err?.message || err);
      }
    }

    console.info(JSON.stringify({
      event: "botdee.session",
      uid,
      role,
      provider: outcome.provider,
      durable: !!settings.durableThreads,
      results: (outcome.results || []).length,
      toolRounds: outcome.toolRounds || 0
    }));

    return {
      ok: true,
      role,
      reply: outcome.reply,
      results: outcome.results || [],
      provider: outcome.provider,
      model: outcome.model,
      toolRounds: outcome.toolRounds || 0,
      durable: !!settings.durableThreads,
      threadId: coercedThreadId || bot.threadIdForUid(uid),
      conversationIdleSeconds: settings.conversationIdleSeconds
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

const GET_THREAD_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB", maxInstances: 20};

exports.getBotDeeThread = onCall(GET_THREAD_OPTS, async request => {
  try {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in to chat with BOT DEE.");
    }
    await audit.assertFeatureAccess(request.auth, "botDee", request);
    const uid = request.auth.uid;
    const settings = await threads.loadSettings();
    if (!settings.durableThreads) {
      return {
        ok: true,
        durable: false,
        status: "fresh",
        threadId: bot.threadIdForUid(uid),
        turns: [],
        idleSeconds: settings.conversationIdleSeconds,
        remainingMs: settings.conversationIdleSeconds * 1000
      };
    }
    const state = await threads.loadThreadState(uid, settings);
    return {
      ok: true,
      durable: true,
      status: state.status,
      threadId: state.threadId,
      turns: state.turns,
      conversationEpoch: state.conversationEpoch,
      lastMessageAtMs: state.lastMessageAtMs,
      remainingMs: state.remainingMs,
      idleSeconds: settings.conversationIdleSeconds
    };
  } catch (error) {
    throw asHttps(error);
  }
});

exports.__botDeeHelpers = {
  runGeminiSession,
  localSession,
  geminiKey,
  BOT_DEE_SETTINGS_DOC
};
