/* FLOQR AI grammar service v28.88: draft-only grammar/spelling help, Gemini callable when configured. */
(function () {
  "use strict";

  const PROTECTED_TERMS = ["FLOQR", "ShoutOut", "Mingl", "Bata"];
  function personalWords(context = {}) {
    return Array.isArray(context.personalDictionary)
      ? context.personalDictionary.map(word => String(word || "").trim()).filter(Boolean).slice(0, 120)
      : [];
  }

  function personalCorrections(context = {}) {
    const rows = Array.isArray(context.personalCorrections) ? context.personalCorrections : [];
    return rows.map(row => ({
      from:String(row?.from || "").trim(),
      to:String(row?.to || "").trim()
    })).filter(row => row.from && row.to).slice(0, 120);
  }

  function preserveProtectedTerms(value = "", extraTerms = []) {
    let out = String(value || "");
    [...PROTECTED_TERMS, ...extraTerms].filter(Boolean).forEach(term => {
      const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`\\b${escaped}\\b`, "ig"), term);
    });
    return out;
  }

  function isPersonalWord(value, terms = []) {
    const clean = String(value || "").trim().toLowerCase();
    return !!clean && terms.some(term => String(term || "").trim().toLowerCase() === clean);
  }

  function localDetectPossibleTypos(text, language = "auto", options = {}) {
    const value = String(text || "");
    const dictionary = personalWords(options);
    return personalCorrections(options).flatMap(row => {
      if (isPersonalWord(row.from, dictionary)) return [];
      const escaped = row.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`\\b${escaped}\\b`, "ig");
      const matches = value.match(pattern) || [];
      return matches.map(match => ({
        original:match,
        suggestion:row.to,
        type:"personal-correction",
        confidence:0.96,
        language
      }));
    });
  }

  function localCorrect(text, options = {}) {
    const dictionary = personalWords(options);
    let corrected = String(text || "");
    personalCorrections(options).forEach(row => {
      if (isPersonalWord(row.from, dictionary)) return;
      const escaped = row.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      corrected = corrected.replace(new RegExp(`\\b${escaped}\\b`, "ig"), match => {
        if (/^[A-Z]/.test(match)) return row.to.charAt(0).toUpperCase() + row.to.slice(1);
        return row.to;
      });
    });
    return preserveProtectedTerms(corrected, dictionary);
  }

  function functionsClient() {
    if (!window.firebase?.app || !window.firebase?.functions) return null;
    const region = window.FLOQR_AI_FUNCTIONS_REGION || "us-central1";
    try { return firebase.app().functions(region); } catch (error) { return null; }
  }

  async function suggestGrammarCorrection(text, context = {}) {
    const dictionary = personalWords(context);
    const corrections = personalCorrections(context);
    const draft = preserveProtectedTerms(String(text || "").slice(0, 1200), dictionary);
    const fallbackIssues = localDetectPossibleTypos(draft, context.preferredLanguage || "auto", {personalDictionary:dictionary, personalCorrections:corrections});
    const fallback = {
      correctedText:localCorrect(draft, {personalDictionary:dictionary, personalCorrections:corrections}),
      detectedIssues:fallbackIssues,
      explanation:fallbackIssues.length
        ? "Gemini grammar correction is unavailable. FLOQR applied only your saved personal corrections and preserved your word list."
        : "Gemini grammar correction is unavailable. No generalized local correction was applied; your personal word list is preserved.",
      confidence:fallbackIssues.length ? 0.96 : 0,
      provider:fallbackIssues.length ? "personal-fallback" : "gemini-unavailable"
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
        correctionMode:String(context.correctionMode || "approvalRequired").slice(0, 40),
        personalDictionary:dictionary,
        personalCorrections:corrections
      });
      const data = response?.data || {};
      if (!data.correctedText) return fallback;
      return {
        correctedText:preserveProtectedTerms(String(data.correctedText || draft).slice(0, 1200), dictionary),
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
