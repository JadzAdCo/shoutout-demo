/* BOT DEE first-use + Settings pop-out — name, demeanor, recap.
   Authorized overlay over the conversation. Not a ? help popout.
   Guest prefs stay in localStorage; signed-in prefs go to saveBotDeePersonalization. */
(function (global) {
  "use strict";

  const CURRENT_VERSION = 1;
  const LAST_USED_FIELD = "userbotdeelastUsedtime";
  const GUEST_KEY = "floqr.botDeePersonalization.guest";
  const VISIT_KEY = "floqr.botDeeSetupVisit";
  const DEFERRED_KEY = "floqr.botDeeSetupDeferred";

  const state = {
    personalization: {
      preferredAddressName: "",
      demeanor: "balanced",
      remindWhereLeftOff: 1,
      botDeePersonalizationVersion: 0,
      profileFirstName: "",
      [LAST_USED_FIELD]: 0
    },
    signedIn: false,
    setupStep: "",
    tempName: "",
    bound: false
  };

  const byId = id => document.getElementById(id);
  const t = (key, fallback) => {
    const value = global.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  };

  function clipName(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim().slice(0, 40);
  }

  function normalizeDemeanor(raw) {
    const key = String(raw || "").replace(/[\s_-]+/g, "").toLowerCase();
    if (key === "sociallycool" || key === "cool" || key === "social") return "sociallyCool";
    if (key === "professional" || key === "pro") return "professional";
    if (key === "balanced" || key === "balance") return "balanced";
    return "balanced";
  }

  function timeOfDay(hour) {
    const h = Number.isInteger(hour) ? hour : new Date().getHours();
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  }

  function greetingLead(slot) {
    if (slot === "morning") return t("botdee.greetingMorning", "Good morning");
    if (slot === "evening") return t("botdee.greetingEvening", "Good evening");
    return t("botdee.greetingAfternoon", "Good afternoon");
  }

  function greetingFor(row, hour) {
    const name = clipName(row?.preferredAddressName);
    const lead = greetingLead(timeOfDay(hour));
    if (row?.demeanor === "sociallyCool") {
      return name ? `Wassup, ${name}! What's the move?` : "Wassup! What's the move?";
    }
    if (row?.demeanor === "professional") {
      return name ? `${lead}, ${name}. How can I help?` : `${lead}. How can I help?`;
    }
    const low = lead.toLowerCase();
    return name
      ? `Hey, ${low}, ${name}. What are we working on?`
      : `Hey, ${low}. What are we working on?`;
  }

  function needsOnboarding(row) {
    return Math.floor(Number(row?.botDeePersonalizationVersion) || 0) < CURRENT_VERSION;
  }

  function readGuest() {
    try {
      return JSON.parse(localStorage.getItem(GUEST_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function writeGuest(row) {
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify({
        preferredAddressName: clipName(row.preferredAddressName),
        demeanor: normalizeDemeanor(row.demeanor),
        remindWhereLeftOff: row.remindWhereLeftOff === 0 ? 0 : 1,
        botDeePersonalizationVersion: CURRENT_VERSION
      }));
    } catch (_) {}
  }

  function mergePersonalization(next) {
    const src = next && typeof next === "object" ? next : {};
    state.personalization = {
      preferredAddressName: clipName(src.preferredAddressName),
      demeanor: normalizeDemeanor(src.demeanor),
      remindWhereLeftOff: src.remindWhereLeftOff === 0 ? 0 : 1,
      botDeePersonalizationVersion: Math.max(0, Math.floor(Number(src.botDeePersonalizationVersion) || 0)),
      profileFirstName: clipName(src.profileFirstName),
      [LAST_USED_FIELD]: Number(src[LAST_USED_FIELD]) || 0
    };
  }

  function callable(name) {
    try {
      if (!global.firebase?.functions || !global.firebase.apps?.length) return null;
      return global.firebase.app().functions("us-central1").httpsCallable(name);
    } catch (_) {
      return null;
    }
  }

  async function persist(row) {
    const payload = {
      preferredAddressName: clipName(row.preferredAddressName),
      demeanor: normalizeDemeanor(row.demeanor),
      remindWhereLeftOff: row.remindWhereLeftOff === 0 ? 0 : 1
    };
    mergePersonalization({...state.personalization, ...payload, botDeePersonalizationVersion: CURRENT_VERSION});
    if (!state.signedIn) {
      writeGuest(state.personalization);
      return {ok: true, personalization: state.personalization};
    }
    const fn = callable("saveBotDeePersonalization");
    if (!fn) {
      writeGuest(state.personalization);
      return {ok: false, error: "callable_missing"};
    }
    const data = (await fn(payload))?.data || {};
    if (data.personalization) mergePersonalization({...state.personalization, ...data.personalization});
    return {ok: data.ok !== false, personalization: state.personalization};
  }

  function recapFromTurns(turns) {
    const rows = (Array.isArray(turns) ? turns : [])
      .map(row => ({
        role: row?.role === "model" || row?.role === "assistant" ? "model" : "user",
        text: String(row?.text || "").replace(/\s+/g, " ").trim()
      }))
      .filter(row => row.text && !/^(hey|hi|hello|howdy|yo|sup|hiya|hola)\b/i.test(row.text));
    const last = rows.slice(-2);
    if (!last.length) return "";
    return last
      .map(row => (row.role === "user" ? `You: ${row.text.slice(0, 140)}` : `BOT DEE: ${row.text.slice(0, 140)}`))
      .join(" ");
  }

  function fillDialog() {
    const name = byId("botDeePrefName");
    const recap = byId("botDeePrefRecap");
    if (name) name.value = state.personalization.preferredAddressName || state.personalization.profileFirstName || "";
    document.querySelectorAll("input[name='botDeePrefDemeanor']").forEach(input => {
      input.checked = input.value === state.personalization.demeanor;
    });
    if (recap) recap.checked = state.personalization.remindWhereLeftOff !== 0;
  }

  function openDialog() {
    const dialog = byId("botDeePersonalizationDialog");
    if (!dialog) return;
    fillDialog();
    dialog.hidden = false;
    dialog.setAttribute("aria-hidden", "false");
    byId("botDeePrefName")?.focus();
  }

  function closeDialog() {
    const dialog = byId("botDeePersonalizationDialog");
    if (!dialog) return;
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
    try { sessionStorage.setItem(DEFERRED_KEY, "1"); } catch (_) {}
  }

  async function saveFromDialog() {
    const name = clipName(byId("botDeePrefName")?.value);
    const demeanor = normalizeDemeanor(
      document.querySelector("input[name='botDeePrefDemeanor']:checked")?.value
    );
    const recap = byId("botDeePrefRecap")?.checked === false ? 0 : 1;
    const status = byId("botDeePrefStatus");
    try {
      await persist({preferredAddressName: name, demeanor, remindWhereLeftOff: recap});
      if (status) status.textContent = t("botdee.prefsSaved", "Saved.");
      closeDialog();
      state.setupStep = "done";
    } catch (_) {
      if (status) status.textContent = t("botdee.prefsFailed", "Could not save. Try again.");
    }
  }

  function appendChoiceRow(question, choices) {
    const log = byId("botDeeTranscript");
    if (!log) return;
    const row = document.createElement("div");
    row.className = "botdee-msg botdee-msg-bot";
    const article = document.createElement("article");
    article.className = "botdee-bubble botdee-bubble-bot botdee-pref-choices";
    const text = document.createElement("div");
    text.className = "botdee-bubble-text";
    text.textContent = question;
    article.appendChild(text);
    const list = document.createElement("div");
    list.className = "botdee-choice-row";
    choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "buttonlike botdee-choice";
      btn.textContent = choice.label;
      btn.addEventListener("click", () => choice.onPick());
      list.appendChild(btn);
    });
    article.appendChild(list);
    row.appendChild(article);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function askName() {
    state.setupStep = "name";
    const first = state.personalization.profileFirstName;
    const choices = [];
    if (first) {
      choices.push({
        label: first,
        onPick: () => {
          state.tempName = first;
          askDemeanor();
        }
      });
    }
    choices.push({
      label: t("botdee.anotherName", "Another name or title"),
      onPick: () => {
        openDialog();
        byId("botDeePrefName")?.focus();
      }
    });
    appendChoiceRow(t("botdee.callMe", "What should I call you?"), choices);
  }

  function askDemeanor() {
    state.setupStep = "demeanor";
    appendChoiceRow(
      t("botdee.demeanorAsk", "What demeanor would you prefer: Socially Cool, Professional or Balanced?"),
      [
        {label: t("botdee.demeanorCool", "Socially Cool"), onPick: () => finishSetup("sociallyCool")},
        {label: t("botdee.demeanorPro", "Professional"), onPick: () => finishSetup("professional")},
        {label: t("botdee.demeanorBalanced", "Balanced"), onPick: () => finishSetup("balanced")}
      ]
    );
  }

  async function finishSetup(demeanor) {
    await persist({
      preferredAddressName: state.tempName || state.personalization.preferredAddressName,
      demeanor,
      remindWhereLeftOff: state.personalization.remindWhereLeftOff
    });
    state.setupStep = "done";
    openDialog();
  }

  function maybeStartSetup() {
    if (!needsOnboarding(state.personalization)) return;
    try {
      if (sessionStorage.getItem(DEFERRED_KEY) === "1") return;
      if (sessionStorage.getItem(VISIT_KEY) === "1") return;
      sessionStorage.setItem(VISIT_KEY, "1");
    } catch (_) {}
    askName();
  }

  function parseCallMe(text) {
    const q = String(text || "").trim();
    const m = q.match(/^(?:call me|address me as|my name is)\s+(.+)$/i);
    return m ? clipName(m[1]) : "";
  }

  function parseDemeanorText(text) {
    const q = String(text || "").toLowerCase();
    if (/socially\s*cool|^cool$/.test(q)) return "sociallyCool";
    if (/professional|^pro$/.test(q)) return "professional";
    if (/balanced/.test(q)) return "balanced";
    return "";
  }

  function interceptSend(text) {
    const raw = String(text || "").trim();
    if (!raw) return false;
    if (state.setupStep === "name") {
      const callMe = parseCallMe(raw);
      if (callMe) {
        state.tempName = callMe;
        askDemeanor();
        return true;
      }
      if (/^(throw|book|find|search|make me|go live|schedule)\b/i.test(raw) || raw.split(/\s+/).length > 4) {
        try { sessionStorage.setItem(DEFERRED_KEY, "1"); } catch (_) {}
        state.setupStep = "";
        return false;
      }
      state.tempName = clipName(raw);
      askDemeanor();
      return true;
    }
    if (state.setupStep === "demeanor") {
      const demeanor = parseDemeanorText(raw);
      if (demeanor) {
        finishSetup(demeanor);
        return true;
      }
      try { sessionStorage.setItem(DEFERRED_KEY, "1"); } catch (_) {}
      state.setupStep = "";
      return false;
    }
    const callMe = parseCallMe(raw);
    if (callMe && !needsOnboarding(state.personalization)) {
      appendChoiceRow(t("botdee.tempOrSaved", "Just for this conversation, or as your saved preference?"), [
        {
          label: t("botdee.thisConversation", "This conversation"),
          onPick: () => {
            state.personalization.preferredAddressName = callMe;
          }
        },
        {
          label: t("botdee.savedPreference", "Saved preference"),
          onPick: () => persist({...state.personalization, preferredAddressName: callMe})
        }
      ]);
      return true;
    }
    return false;
  }

  function applyFromThread(data, signedIn) {
    state.signedIn = !!signedIn;
    const row = data && typeof data === "object" ? data : {};
    const fromServer = row.personalization && typeof row.personalization === "object" ? row.personalization : {};
    const guest = signedIn ? {} : readGuest();
    mergePersonalization({
      ...guest,
      ...fromServer,
      profileFirstName: row.profileFirstName || fromServer.profileFirstName || "",
      [LAST_USED_FIELD]: row[LAST_USED_FIELD] || fromServer[LAST_USED_FIELD] || 0
    });
    fillDialog();
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    byId("botDeePrefsOpen")?.addEventListener("click", openDialog);
    byId("botDeePrefSave")?.addEventListener("click", event => {
      event.preventDefault();
      saveFromDialog();
    });
    byId("botDeePrefCancel")?.addEventListener("click", event => {
      event.preventDefault();
      closeDialog();
    });
    byId("botDeePersonalizationDialog")?.addEventListener("click", event => {
      if (event.target?.id === "botDeePersonalizationDialog") closeDialog();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && byId("botDeePersonalizationDialog") && !byId("botDeePersonalizationDialog").hidden) {
        closeDialog();
      }
    });
  }

  global.FLOQRBotDeePersonalization = {
    bind,
    applyFromThread,
    maybeStartSetup,
    interceptSend,
    greetingFor: (hour) => greetingFor(state.personalization, hour),
    recapFromTurns,
    needsOnboarding: () => needsOnboarding(state.personalization),
    get: () => ({...state.personalization}),
    LAST_USED_FIELD
  };
})(typeof window !== "undefined" ? window : globalThis);
