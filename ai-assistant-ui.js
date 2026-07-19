/* Ask FLOQR assistant shell. Flag-gated and local-context only by default. */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  const EXAMPLES = {
    patron: [
      "Find hip hop clubs in Barcelona.",
      "Show me people who like Afro Beats.",
      "Find Bata merch from DJs.",
      "Suggest a birthday ShoutOut.",
      "Notify me when Shoko has a guest list.",
      "Create a floral tattoo background for my ShoutOut."
    ],
    clubAdmin: [
      "Summarize today's pending ShoutOuts.",
      "Show guest list trends this week.",
      "Which promoters brought the most guests?"
    ],
    promoter: [
      "Show my guest list referrals this month.",
      "Which clubs have my highest referral activity?"
    ],
    dj: [
      "Show my public profile.",
      "Show playlist interest.",
      "Find patrons interested in my genre."
    ],
    masterAdmin: [
      "Summarize network-wide activity.",
      "Show incomplete patron profile patterns.",
      "Show overlap in Mingl datapoints."
    ]
  };

  let mounted = false;
  let db = null;
  let auth = null;

  function roleFromProfile(profile = {}) {
    const raw = [
      profile.memberLevel,
      profile.role,
      profile.approvedRole,
      ...(Array.isArray(profile.roles) ? profile.roles : []),
      ...(Array.isArray(profile.approvedRoles) ? profile.approvedRoles : [])
    ].join(" ").toLowerCase();
    if (raw.includes("master")) return "masterAdmin";
    if (raw.includes("club")) return "clubAdmin";
    if (raw.includes("promoter")) return "promoter";
    if (raw.includes("dj")) return "dj";
    return "patron";
  }

  async function profileFor(user) {
    if (!db || !user) return {};
    try {
      const snap = await db.collection("users").doc(user.uid).get();
      return snap.exists ? snap.data() : {};
    } catch(e) {
      return {};
    }
  }

  function localRecords() {
    const search = window.FLOQRAISearch;
    if (!search) return [];
    const variants = (window.__FLOQR_TEMPLATE_VARIANTS?.community || []).concat(window.__FLOQR_TEMPLATE_VARIANTS?.mine || []);
    return [
      ...search.locationsToRecords(window.SHOUTOUT_CLUB_LOCATIONS || {}),
      ...search.eventsToRecords(window.SHOUTOUT_EVENTS || {}),
      ...search.templatesToRecords(window.SHOUTOUT_TEMPLATES || {}, variants)
    ];
  }

  async function askAssistant(query, user, profile) {
    const role = roleFromProfile(profile);
    const lower = String(query || "").toLowerCase();
    if (/notify|notification|guest list/.test(lower)) {
      return {
        answer: "I can help with that from Settings > AI Notification Preferences. I will only use public, shared, or permissioned venue/event data.",
        results: [],
        actions: [{label:"Open Settings", href:"./patron-portal.html?tab=ai-notifications&v=29.09.8"}]
      };
    }
    if (/background|template|studio|floral|tattoo|design/.test(lower) && window.FLOQRStudio) {
      return {
        answer: "FLOQR Studio is ready for locked-layout background personalization. Open a ShoutOut template and use Customize Background.",
        results: [],
        actions: [{label:"Start ShoutOut", href:"#shoutout"}]
      };
    }
    const records = await window.floqrSearch(query, {
      records: localRecords(),
      db,
      currentUser: user,
      profile,
      role,
      source: "assistant"
    });
    const top = records.slice(0, 5);
    return {
      answer: top.length ? `I found ${top.length} public or shared FLOQR matches.` : "I did not find a public or shared match yet.",
      results: top,
      actions: top.map(item => suggestedAction(item)).filter(Boolean)
    };
  }

  function suggestedAction(item) {
    if (item.type === "clubLocation") return {label:`Open ${item.title}`, href:`./?location=${encodeURIComponent(item.id)}&v=29.09.8`};
    if (item.type === "event") return {label:`View ${item.title}`, href:`./?v=29.09.8`};
    if (item.type === "publicTemplateVariant" || item.type === "officialTemplate") return {label:"Search templates", href:"./?v=29.09.8"};
    return null;
  }

  async function saveAssistantMessage(user, role, message, response) {
    if (!db || !user) return;
    try {
      const sessionRef = db.collection("aiAssistantSessions").doc(user.uid);
      await sessionRef.set({
        uid:user.uid,
        role,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      await db.collection("aiAssistantMessages").add({
        uid:user.uid,
        sessionId:user.uid,
        role,
        message:String(message || "").slice(0, 1000),
        responseSummary:String(response?.answer || "").slice(0, 1000),
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) {
      console.warn("Assistant message log skipped:", e.message);
    }
  }

  function renderResultList(result) {
    const results = result.results || [];
    const actions = result.actions || [];
    return `
      <p>${esc(result.answer)}</p>
      ${results.length ? `<div class="ai-assistant-results">${results.map(item => `
        <div class="queue-item">
          <strong>${esc(item.title || item.data?.locationName || item.data?.eventName || item.id)}</strong>
          <p>${esc(item.data?.locationLabel || item.data?.city || item.data?.country || item.sourceType || "")}</p>
        </div>`).join("")}</div>` : ""}
      ${actions.length ? `<div class="button-row">${actions.map(action => `<a class="buttonlike" href="${esc(action.href)}">${esc(action.label)}</a>`).join("")}</div>` : ""}`;
  }

  async function mountForUser(user) {
    if (!user || mounted || window.FLOQR_AI_ASSISTANT_ENABLED !== true) return;
    mounted = true;
    const profile = await profileFor(user);
    const role = roleFromProfile(profile);
    const examples = EXAMPLES[role] || EXAMPLES.patron;
    const shell = document.createElement("div");
    shell.id = "floqrAssistantShell";
    shell.className = "floqr-assistant-shell";
    shell.innerHTML = `
      <button id="floqrAssistantToggle" class="floqr-assistant-toggle" type="button">Ask FLOQR</button>
      <aside id="floqrAssistantPanel" class="floqr-assistant-panel hidden" aria-live="polite">
        <div class="floqr-assistant-head">
          <div><p class="eyebrow">FLOQR AI</p><h2>Ask FLOQR</h2></div>
          <button id="floqrAssistantClose" type="button" aria-label="Close assistant">x</button>
        </div>
        <div class="tag-row">${examples.map(x => `<button type="button" class="ai-example">${esc(x)}</button>`).join("")}</div>
        <label>Ask a question<input id="floqrAssistantInput" placeholder="Try: hiphop clubs in Barcelona"/></label>
        <button id="floqrAssistantAsk" class="primary" type="button">Ask FLOQR</button>
        <div id="floqrAssistantAnswer" class="selected-summary">Assistant responses are role-aware and use public/shared data only.</div>
      </aside>`;
    document.body.appendChild(shell);
    byId("floqrAssistantToggle")?.addEventListener("click", () => byId("floqrAssistantPanel")?.classList.toggle("hidden"));
    byId("floqrAssistantClose")?.addEventListener("click", () => byId("floqrAssistantPanel")?.classList.add("hidden"));
    shell.querySelectorAll(".ai-example").forEach(btn => btn.addEventListener("click", () => {
      byId("floqrAssistantInput").value = btn.textContent;
      byId("floqrAssistantAsk").click();
    }));
    byId("floqrAssistantAsk")?.addEventListener("click", async () => {
      const input = byId("floqrAssistantInput");
      const answer = byId("floqrAssistantAnswer");
      const query = input?.value.trim();
      if (!query) return;
      answer.innerHTML = "Searching FLOQR context...";
      const response = await askAssistant(query, user, profile);
      await saveAssistantMessage(user, role, query, response);
      answer.innerHTML = renderResultList(response);
    });
  }

  function boot() {
    if (window.FLOQR_AI_ASSISTANT_ENABLED !== true) return;
    const timer = setInterval(() => {
      if (!window.firebase?.apps?.length) return;
      clearInterval(timer);
      auth = firebase.auth();
      db = firebase.firestore();
      auth.onAuthStateChanged(user => mountForUser(user));
    }, 300);
  }

  window.FLOQRAIAssistant = {boot, mountForUser};
  document.addEventListener("DOMContentLoaded", boot);
})();
