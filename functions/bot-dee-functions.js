/* BOT DEE — executeBotSession callable (Auth + floqAi gate + classification → Gemini + tools).
   Tools: contextualSearch + VIP / ShoutOut / FloqCAST / checkout (each re-validates role). */
"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {GoogleGenAI, FunctionCallingConfigMode} = require("@google/genai");
const core = require("./data-classification-core");
const bot = require("./bot-dee-core");
const {__featureServiceHelpers: audit} = require("./feature-services-functions");
const {__floqAiHelpers} = require("./data-classification-functions");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

const CALL_OPTS = {
  region: "us-central1",
  timeoutSeconds: 90,
  memory: "512MiB",
  secrets: [GEMINI_API_KEY, STRIPE_SECRET_KEY]
};

function asHttps(error) {
  if (error instanceof HttpsError) return error;
  if (error?.code === "invalid-argument") return new HttpsError("invalid-argument", error.message);
  console.error("BOT DEE session failed", error?.message || error);
  return new HttpsError("internal", "BOT DEE could not complete that request. Try again.");
}

function geminiKey() {
  try {
    return GEMINI_API_KEY.value() || process.env.GEMINI_API_KEY || "";
  } catch (_) {
    return process.env.GEMINI_API_KEY || "";
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
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
            allowedFunctionNames: bot.TOOL_NAMES
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

function localSession(role, userPrompt) {
  if (bot.isChitchatPrompt(userPrompt)) {
    return {
      reply: bot.chitchatReply(role),
      results: [],
      provider: "local-chitchat",
      model: "chitchat",
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
    await audit.assertFeatureAccess(request.auth, "floqAi", request);

    const userPrompt = bot.sanitizeUserPrompt(request.data?.message || request.data?.prompt || "");
    if (!userPrompt) throw new HttpsError("invalid-argument", "Send a message for BOT DEE.");

    const history = bot.sanitizeHistory(request.data?.history);
    const facts = await __floqAiHelpers.roleFactsFor(request.auth);
    const {role} = core.resolveViewerRole(facts);
    const session = Object.freeze({
      userId: request.auth.uid,
      role,
      lastUserPrompt: userPrompt,
      request
    });

    const apiKey = geminiKey();
    let outcome;
    // Greetings stay chat-like even when Gemini is down or mis-calls search.
    if (bot.isChitchatPrompt(userPrompt)) {
      outcome = localSession(role, userPrompt);
    } else if (apiKey) {
      try {
        outcome = await runGeminiSession({apiKey, role, history, userPrompt, session});
      } catch (error) {
        console.warn("BOT DEE Gemini failed; using contextualSearch fallback", error?.message || error);
        outcome = localSession(role, userPrompt);
        outcome.geminiError = String(error?.message || error).slice(0, 180);
      }
    } else {
      outcome = localSession(role, userPrompt);
    }

    console.info(JSON.stringify({
      event: "botdee.session",
      uid: request.auth.uid,
      role,
      provider: outcome.provider,
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
      toolRounds: outcome.toolRounds || 0
    };
  } catch (error) {
    throw asHttps(error);
  }
});

exports.__botDeeHelpers = {
  runGeminiSession,
  localSession,
  geminiKey
};
