/* FLOQR AI notification preference service. */
(function () {
  "use strict";

  const DEFAULT_PREFS = {
    enabled: true,
    notifyFor: {
      events: true,
      clubs: true,
      guestLists: true,
      shoutouts: true,
      minglMatches: true,
      bataListings: true,
      ticketAvailability: true,
      djPlaylists: true,
      promoterUpdates: true,
      publicTemplateVariants: true
    },
    interests: [],
    cities: [],
    eventCategories: [],
    venueCategories: [],
    minglMatchPreferences: [],
    bataListingInterests: [],
    publicTemplateVariantInterests: [],
    maxFrequency: "daily",
    channels: {
      inApp: true,
      email: false,
      sms: false
    }
  };

  function splitCSV(value) {
    return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  }

  function joinCSV(value) {
    return Array.isArray(value) ? value.join(", ") : String(value || "");
  }

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_PREFS));
  }

  function mergePrefs(data = {}) {
    const defaults = cloneDefaults();
    return {
      ...defaults,
      ...data,
      notifyFor: {...defaults.notifyFor, ...(data.notifyFor || {})},
      channels: {...defaults.channels, ...(data.channels || {})}
    };
  }

  async function loadAiNotificationPreferences(db, uid) {
    if (!db || !uid) return mergePrefs();
    try {
      const snap = await db.collection("aiUserNotificationPreferences").doc(uid).get();
      return mergePrefs(snap.exists ? snap.data() : {});
    } catch(e) {
      console.warn("Could not load AI notification preferences:", e.message);
      return mergePrefs();
    }
  }

  async function saveAiNotificationPreferences(db, uid, values = {}) {
    if (!db || !uid) throw new Error("Sign in before saving AI notification preferences.");
    const payload = mergePrefs(values);
    payload.uid = uid;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection("aiUserNotificationPreferences").doc(uid).set(payload, {merge:true});
    return payload;
  }

  function checkbox(name, label, checked) {
    return `<label class="consent-line"><input type="checkbox" data-ai-pref="${name}" ${checked ? "checked" : ""}/> <span>${label}</span></label>`;
  }

  async function renderAiNotificationPreferences(container, {db, user, profile} = {}) {
    if (!container || !user) return;
    const prefs = await loadAiNotificationPreferences(db, user.uid);
    container.innerHTML = `
      <div class="card">
        <h2>AI Notification Preferences</h2>
        <p class="sub small">FLOQR AI uses only public, shared, or permissioned data for discovery and in-app recommendations.</p>
        ${checkbox("enabled", "Enable in-app AI recommendations", prefs.enabled)}
        <div class="profile-grid">
          <label>Interests<input id="aiPrefInterests" value="${escapeAttr(joinCSV(prefs.interests || profile?.musicInterests || []))}" placeholder="Afrobeats, hip hop, VIP, fast cars"/></label>
          <label>Cities<input id="aiPrefCities" value="${escapeAttr(joinCSV(prefs.cities || [profile?.city].filter(Boolean)))}" placeholder="Washington DC, Barcelona"/></label>
          <label>Event categories<input id="aiPrefEventCategories" value="${escapeAttr(joinCSV(prefs.eventCategories))}" placeholder="concerts, comedy shows, pool parties"/></label>
          <label>Venue categories<input id="aiPrefVenueCategories" value="${escapeAttr(joinCSV(prefs.venueCategories))}" placeholder="clubs, lounges, beach clubs"/></label>
          <label>Mingl match preferences<input id="aiPrefMingl" value="${escapeAttr(joinCSV(prefs.minglMatchPreferences))}" placeholder="music lovers, travelers, fast cars"/></label>
          <label>Bata listing interests<input id="aiPrefBata" value="${escapeAttr(joinCSV(prefs.bataListingInterests))}" placeholder="DJ merch, VIP apparel"/></label>
          <label>Public template interests<input id="aiPrefTemplates" value="${escapeAttr(joinCSV(prefs.publicTemplateVariantInterests))}" placeholder="birthday, flowers, tattoos"/></label>
          <label>Notification frequency
            <select id="aiPrefFrequency">
              ${["immediate","daily","weekly"].map(x => `<option value="${x}" ${prefs.maxFrequency === x ? "selected" : ""}>${x}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="profile-grid ai-pref-checks">
          ${Object.entries(prefs.notifyFor).map(([key, value]) => checkbox(`notifyFor.${key}`, labelFor(key), value)).join("")}
        </div>
        <div class="profile-grid">
          ${checkbox("channels.inApp", "In-app notifications", prefs.channels.inApp)}
          ${checkbox("channels.email", "Email later when explicitly enabled", prefs.channels.email)}
          ${checkbox("channels.sms", "SMS later when explicitly enabled", prefs.channels.sms)}
        </div>
        <button id="saveAiNotificationPrefsBtn" class="primary" type="button">Save AI Notification Preferences</button>
        <p id="aiNotificationPrefsStatus" class="status"></p>
      </div>`;

    container.querySelector("#saveAiNotificationPrefsBtn")?.addEventListener("click", async () => {
      try {
        const next = {
          enabled: checked(container, "enabled"),
          interests: splitCSV(container.querySelector("#aiPrefInterests")?.value),
          cities: splitCSV(container.querySelector("#aiPrefCities")?.value),
          eventCategories: splitCSV(container.querySelector("#aiPrefEventCategories")?.value),
          venueCategories: splitCSV(container.querySelector("#aiPrefVenueCategories")?.value),
          minglMatchPreferences: splitCSV(container.querySelector("#aiPrefMingl")?.value),
          bataListingInterests: splitCSV(container.querySelector("#aiPrefBata")?.value),
          publicTemplateVariantInterests: splitCSV(container.querySelector("#aiPrefTemplates")?.value),
          maxFrequency: container.querySelector("#aiPrefFrequency")?.value || "daily",
          notifyFor: Object.fromEntries(Object.keys(DEFAULT_PREFS.notifyFor).map(key => [key, checked(container, `notifyFor.${key}`)])),
          channels: Object.fromEntries(Object.keys(DEFAULT_PREFS.channels).map(key => [key, checked(container, `channels.${key}`)]))
        };
        await saveAiNotificationPreferences(db, user.uid, next);
        setStatus(container, "AI notification preferences saved.");
      } catch(e) {
        setStatus(container, e.message);
      }
    });
  }

  function checked(root, name) {
    return !!root.querySelector(`[data-ai-pref="${name}"]`)?.checked;
  }

  function labelFor(key) {
    return String(key).replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
  }

  function setStatus(root, value) {
    const el = root.querySelector("#aiNotificationPrefsStatus");
    if (el) el.textContent = value || "";
  }

  function escapeAttr(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  window.FLOQRAINotifications = {
    DEFAULT_PREFS,
    loadAiNotificationPreferences,
    saveAiNotificationPreferences,
    renderAiNotificationPreferences
  };
})();
