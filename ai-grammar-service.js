/* FLOQR AI grammar service v28.84: draft-only grammar/spelling help, Gemini callable when configured. */
(function () {
  "use strict";

  const PROTECTED_TERMS = ["FLOQR", "ShoutOut", "Mingl", "Bata"];
  const COMMON_FIXES = [
    {pattern:/\bgut\b/gi, replacement:"good", type:"spelling", label:"gut"},
    {pattern:/\bteh\b/gi, replacement:"the", type:"spelling", label:"teh"},
    {pattern:/\byuo\b/gi, replacement:"you", type:"spelling", label:"yuo"},
    {pattern:/\bwanna\b/gi, replacement:"want to", type:"grammar", label:"wanna"},
    {pattern:/\bi\b/g, replacement:"I", type:"grammar", label:"i"}
  ];

  function preserveProtectedTerms(value = "") {
    let out = String(value || "");
    PROTECTED_TERMS.forEach(term => {
      out = out.replace(new RegExp(term, "ig"), term);
    });
    return out;
  }

  function localDetectPossibleTypos(text, language = "auto") {
    const value = String(text || "");
    const issues = [];
    COMMON_FIXES.forEach(rule => {
      const matches = value.match(rule.pattern) || [];
      matches.forEach(match => {
        issues.push({
          original:match,
          suggestion:match.replace(rule.pattern, rule.replacement),
          type:rule.type,
          confidence:0.82
        });
      });
    });
    if (/\s{2,}/.test(value)) {
      issues.push({original:"extra spaces", suggestion:"single spaces", type:"grammar", confidence:0.74});
    }
    if (/[!?.,]{3,}/.test(value)) {
      issues.push({original:"repeated punctuation", suggestion:"clean punctuation", type:"grammar", confidence:0.68});
    }
    return issues.map(item => ({...item, language}));
  }

  function localCorrect(text) {
    let corrected = String(text || "");
    COMMON_FIXES.forEach(rule => {
      corrected = corrected.replace(rule.pattern, match => {
        if (rule.replacement === "I") return "I";
        if (/^[A-Z]/.test(match)) return rule.replacement.charAt(0).toUpperCase() + rule.replacement.slice(1);
        return rule.replacement;
      });
    });
    corrected = corrected.replace(/\s{2,}/g, " ").replace(/([!?.,]){3,}/g, "$1").trim();
    return preserveProtectedTerms(corrected);
  }

  function functionsClient() {
    if (!window.firebase?.app || !window.firebase?.functions) return null;
    const region = window.FLOQR_AI_FUNCTIONS_REGION || "us-central1";
    try { return firebase.app().functions(region); } catch (error) { return null; }
  }

  async function suggestGrammarCorrection(text, context = {}) {
    const draft = preserveProtectedTerms(String(text || "").slice(0, 1200));
    const fallbackIssues = localDetectPossibleTypos(draft, context.preferredLanguage || "auto");
    const fallback = {
      correctedText:localCorrect(draft),
      detectedIssues:fallbackIssues,
      explanation:fallbackIssues.length ? "Local draft cleanup found likely spelling or grammar issues." : "No obvious local issues found.",
      confidence:fallbackIssues.length ? 0.78 : 0.5,
      provider:"local-fallback"
    };
    const client = functionsClient();
    if (!draft || !client) return fallback;
    try {
      const callable = client.httpsCallable(window.FLOQR_AI_GRAMMAR_FUNCTION || "aiSuggestGrammarCorrection");
      const response = await callable({
        text:draft,
        product:String(context.product || "mingl").slice(0, 40),
        inputType:String(context.inputType || "chat").slice(0, 60),
        preferredLanguage:String(context.preferredLanguage || "auto").slice(0, 40),
        tonePreference:String(context.tonePreference || "keepTone").slice(0, 40),
        correctionMode:String(context.correctionMode || "approvalRequired").slice(0, 40)
      });
      const data = response?.data || {};
      if (!data.correctedText) return fallback;
      return {
        correctedText:preserveProtectedTerms(String(data.correctedText || draft).slice(0, 1200)),
        detectedIssues:Array.isArray(data.detectedIssues) ? data.detectedIssues.slice(0, 20) : fallbackIssues,
        explanation:String(data.explanation || fallback.explanation).slice(0, 500),
        confidence:Number(data.confidence || fallback.confidence),
        provider:data.provider || "gemini",
        model:data.model || ""
      };
    } catch (error) {
      console.warn("FLOQR grammar fallback used:", error?.message || error);
      return fallback;
    }
  }

  function applyCorrectionToInput(inputElement, correctedText) {
    if (!inputElement) return;
    inputElement.value = preserveProtectedTerms(correctedText || "");
    inputElement.dispatchEvent(new Event("input", {bubbles:true}));
    inputElement.dispatchEvent(new Event("change", {bubbles:true}));
    inputElement.focus();
  }

  window.FLOQRGrammar = {
    suggestGrammarCorrection,
    localDetectPossibleTypos,
    applyCorrectionToInput
  };
})();
