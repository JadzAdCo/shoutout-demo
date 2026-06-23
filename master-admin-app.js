/* master-admin-app.js v25.7
   Clean Master Admin app.
   Domain enforcement is disabled during development.
   Access is controlled by SHOUTOUT_MASTER_ADMIN_EMAILS + Google/Microsoft provider.
*/
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const safeUser = user => (user?.email || user?.phoneNumber || "unknown").toLowerCase();
  const money = value => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD", maximumFractionDigits:0}).format(value || 0);

  if (!window.firebaseConfig) {
    setText("masterStatus", "firebase-config.js missing window.firebaseConfig.");
    return;
  }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  const MASTER_ADMIN_EMAILS = (window.SHOUTOUT_MASTER_ADMIN_EMAILS || window.SHOUTOUT_ADMIN_EMAILS || []).map(x => String(x).toLowerCase());
  const ALLOWED_PROVIDERS = (window.SHOUTOUT_MASTER_ADMIN_ALLOWED_PROVIDERS || ["google.com", "microsoft.com"]).map(x => String(x).toLowerCase());
  const ENFORCE_DOMAINS = window.SHOUTOUT_MASTER_ADMIN_ENFORCE_DOMAINS === true;
  const ALLOWED_DOMAINS = (window.SHOUTOUT_MASTER_ADMIN_ALLOWED_DOMAINS || ["jadzadco.com", "jadzholdings.com"]).map(x => String(x).toLowerCase());
  const TEMPORARY_EXCEPTION_EMAILS = (window.SHOUTOUT_MASTER_ADMIN_TEMPORARY_EXCEPTION_EMAILS || []).map(x => String(x).toLowerCase());
  const REQUIRE_VERIFIED_EMAIL = window.SHOUTOUT_MASTER_ADMIN_REQUIRE_VERIFIED_EMAIL !== false;

  function bind(id, fn) {
    byId(id)?.addEventListener("click", fn);
  }

  function masterAuthErrorMessage(e) {
    const code = e?.code || "error";
    const message = e?.message || String(e || "Unknown error");

    if (code === "auth/popup-closed-by-user") {
      return "The sign-in popup was closed before completion. If this happens repeatedly, use Microsoft sign-in because it now uses full-page redirect, or retry Google and complete the popup flow.";
    }
    if (code === "auth/popup-blocked") {
      return "The browser blocked the sign-in popup. Allow popups for jadzadco.github.io and try again.";
    }
    if (code === "auth/operation-not-allowed") {
      return "This provider is not enabled in Firebase Authentication.";
    }
    if (code === "auth/unauthorized-domain") {
      return "This domain is not authorized in Firebase Authentication.";
    }
    if (code === "auth/account-exists-with-different-credential") {
      return "This email exists with another sign-in provider. Sign in with the original provider first.";
    }

    return `${code}: ${message}`;
  }

  function buildMicrosoftProvider() {
    const p = new firebase.auth.OAuthProvider("microsoft.com");
    p.setCustomParameters({prompt:"select_account"});
    return p;
  }

  function isMicrosoftPopupIssue(e) {
    const code = e?.code || "";
    return code === "auth/popup-blocked" || code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
  }

  async function loginGoogle() {
    try {
      setText("masterStatus", "Opening Google sign-in...");
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch(e) {
      setText("masterStatus", `${e.code || "error"}: ${e.message}`);
    }
  }

  async function loginMicrosoft() {
    const p = buildMicrosoftProvider();
    try {
      setText("masterStatus", "Opening Microsoft sign-in...");
      await auth.signInWithPopup(p);
    } catch(e) {
      if (isMicrosoftPopupIssue(e)) {
        try {
          setText("masterStatus", "Microsoft popup was blocked or closed. Redirecting instead...");
          await auth.signInWithRedirect(p);
          return;
        } catch(redirectError) {
          setText("masterStatus", masterAuthErrorMessage(redirectError));
          return;
        }
      }
      setText("masterStatus", masterAuthErrorMessage(e));
    }
  }

  async function logout() {
    await auth.signOut();
    window.location.reload();
  }

  function setupTabs() {
    document.querySelectorAll(".admin-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach(x => x.classList.remove("active"));
        document.querySelectorAll(".admin-panel-section").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        byId(btn.dataset.panel)?.classList.add("active");
      });
    });
  }

  function getProviderIds(user) {
    return (user?.providerData || []).map(p => String(p.providerId || "").toLowerCase());
  }

  function getEmailDomain(email) {
    return String(email || "").toLowerCase().split("@")[1] || "";
  }

  function hasFirebaseMfaEnrollment(user) {
    try {
      return !!(user && user.multiFactor && user.multiFactor.enrolledFactors && user.multiFactor.enrolledFactors.length > 0);
    } catch {
      return false;
    }
  }

  function masterSecurityCheck(user) {
    if (!user) return { ok:false, reason:"Not signed in." };

    const email = safeUser(user);
    const domain = getEmailDomain(email);
    const providers = getProviderIds(user);

    if (!email || email === "unknown" || !email.includes("@")) {
      return { ok:false, reason:"Master Admin requires email-based Google or Microsoft sign-in." };
    }

    if (!MASTER_ADMIN_EMAILS.includes(email)) {
      return { ok:false, reason:`${email} is not listed in SHOUTOUT_MASTER_ADMIN_EMAILS.` };
    }

    const providerOk = providers.some(p => ALLOWED_PROVIDERS.includes(p));
    if (!providerOk) {
      return { ok:false, reason:`Master Admin must sign in with ${ALLOWED_PROVIDERS.join(" or ")}.` };
    }

    const isTemporaryException = TEMPORARY_EXCEPTION_EMAILS.includes(email);
    if (ENFORCE_DOMAINS && !ALLOWED_DOMAINS.includes(domain) && !isTemporaryException) {
      return { ok:false, reason:`Master Admin email must belong to ${ALLOWED_DOMAINS.join(" or ")}.` };
    }

    if (REQUIRE_VERIFIED_EMAIL && user.emailVerified === false) {
      return { ok:false, reason:"Master Admin email must be verified by the provider." };
    }

    const domainMessage = ENFORCE_DOMAINS
      ? `Domain enforcement enabled for ${ALLOWED_DOMAINS.join(" or ")}.`
      : "Domain enforcement disabled; explicit email allow-list is active.";

    const mfaMessage = hasFirebaseMfaEnrollment(user)
      ? "Firebase MFA enrollment detected."
      : "MFA should be enforced by the identity provider for production Master Admin accounts.";

    return { ok:true, reason:`Master admin verified. Providers: ${providers.join(", ")}. ${domainMessage} ${mfaMessage}` };
  }

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  }

  async function getCollectionSafe(name, limit=1000) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      return snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch(e) {
      console.warn(`Could not read ${name}:`, e.message);
      return [];
    }
  }

  function countBy(items, fn) {
    const out = {};
    items.forEach(item => {
      const key = fn(item);
      if (key) out[key] = (out[key] || 0) + 1;
    });
    return out;
  }

  function topList(counts, n=6) {
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v]) => `${k} (${v})`).join(", ") || "Not enough data yet";
  }

  async function loadNetworkReports() {
    const [users, shoutouts, liveDocs, locations, events, guestLists] = await Promise.all([
      getCollectionSafe("users"),
      getCollectionSafe("shoutouts"),
      getCollectionSafe("liveContent"),
      getCollectionSafe("clubLocations"),
      getCollectionSafe("events"),
      getCollectionSafe("guestListRequests")
    ]);

    const fallbackLocations = Object.entries(window.SHOUTOUT_CLUB_LOCATIONS || {}).map(([id, data]) => ({id, ...data}));
    const locationRows = locations.length ? locations : fallbackLocations;
    const pending = shoutouts.filter(x => (x.status || "pending") === "pending");
    const revenue = pending.length * 10 + liveDocs.length * 25;
    const impressions = Math.max(10000, locationRows.length * 1250 + pending.length * 50);
    const clicks = Math.round(impressions * 0.035);

    setText("netLocations", locationRows.length.toLocaleString());
    setText("netUsers", users.length.toLocaleString());
    setText("netPending", pending.length.toLocaleString());
    setText("netRevenue", money(revenue));

    const byLocation = countBy(pending, x => x.locationName || x.clubName || x.clubLocationId || x.location || "Unknown");
    byId("topLocationsReport").innerHTML = simpleRows([
      ["Top queue locations", topList(byLocation)],
      ["Live display docs", liveDocs.length.toLocaleString()],
      ["Seeded event records", events.length.toLocaleString()],
      ["Network status", "Prototype reporting live"]
    ]);

    const cityCounts = countBy(users, x => x.city);
    const genreCounts = {};
    users.forEach(u => (u.favoriteGenres || []).forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1));
    locationRows.forEach(l => (l.genres || []).forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1));

    byId("networkAudienceReport").innerHTML = simpleRows([
      ["Known patrons", users.length.toLocaleString()],
      ["Top cities", topList(cityCounts)],
      ["Marketing opt-ins", users.filter(u => u.marketingConsent).length.toLocaleString()],
      ["Analytics opt-ins", users.filter(u => u.analyticsConsent).length.toLocaleString()]
    ]);

    byId("networkMusicReport").innerHTML = simpleRows([
      ["Top genres", topList(genreCounts, 8)],
      ["Booking insight", "Compare patron searched genres with actual event programming"],
      ["High-value trend", "Afro House, Hip Hop, Deep House, EDM, Amapiano"],
      ["Recommended report", "Demand gap: searched genre vs booked event genre"]
    ]);

    byId("networkEventReport").innerHTML = simpleRows([
      ["Internal event records", events.length.toLocaleString()],
      ["Ticketmaster Discovery API", "Recommended for event discovery"],
      ["Ticketmaster Partner API", "Restricted to official distribution relationships"],
      ["Eventbrite API", "Useful for event creation, management, attendee/order workflows"]
    ]);

    byId("networkAdReport").innerHTML = simpleRows([
      ["Estimated impressions", impressions.toLocaleString()],
      ["Estimated clicks", clicks.toLocaleString()],
      ["Estimated CTR", `${((clicks / impressions) * 100).toFixed(2)}%`],
      ["Top sponsor categories", "Spirits, fashion, fragrance, sneakers, luxury, rideshare"],
      ["Best media units", "Splash ads, LED display wall, portable displays, window displays"]
    ]);

    const gross = revenue + Math.round(impressions / 1000 * 25);
    const platformShare = Math.round(gross * 0.35);
    const venueShare = gross - platformShare;

    byId("networkReconReport").innerHTML = simpleRows([
      ["Estimated gross revenue", money(gross)],
      ["Estimated Jadz platform share", money(platformShare)],
      ["Estimated venue payouts", money(venueShare)],
      ["Locations requiring payout", locationRows.length.toLocaleString()],
      ["Reconciliation status", "Prototype — connect payment processor ledger later"]
    ]);

    byId("ticketPartnerReport").innerHTML = `
      ${simpleRows([
        ["Ticketmaster Discovery API", "Open developer API for event discovery and outbound ticket links"],
        ["Ticketmaster Affiliate / Distribution", "Apply for affiliate access and Impact publisher tracking"],
        ["Ticketmaster Partner API", "Restricted; requires official distribution relationship"],
        ["Eventbrite API", "Good candidate for event publishing, checkout customization, attendees, orders, webhooks"],
        ["Jadz near-term approach", "Start with outbound ticket links, then affiliate tracking, then direct checkout/reservation integrations"]
      ])}
      <p class="sub small">Use Events as a discovery layer first. Add affiliate tracking after program approval. Use Jadz-owned VIP/table reservations for higher-margin revenue.</p>`;


    if (byId("promoterNetworkReport")) {
      const promoterCounts = {};
      guestLists.forEach(x => {
        const key = x.promoterName || x.promoterId || "Unknown promoter";
        promoterCounts[key] = promoterCounts[key] || {requests:0, guests:0};
        promoterCounts[key].requests += 1;
        promoterCounts[key].guests += Number(x.partySize || 0);
      });
      const rows = Object.entries(promoterCounts)
        .sort((a,b) => b[1].requests - a[1].requests)
        .map(([promoter,v]) => [promoter, `${v.requests} guest list requests / ${v.guests} guests`]);
      byId("promoterNetworkReport").innerHTML = rows.length ? simpleRows(rows) : "<p class='sub'>No promoter referrals yet.</p>";
    }

    byId("allQueueList").innerHTML = pending.length ? pending.map(item => `
      <div class="queue-item">
        <strong>${esc(item.mainText || "Untitled ShoutOut")}</strong>
        <p>${esc(item.subText || "")}</p>
        <small>
          ${esc(item.locationName || item.clubName || item.clubLocationId || "Unknown location")}
          • ${esc(item.referenceNumber || "")}
          • ${esc(item.submittedBy || "unknown")}
        </small>
      </div>`).join("") : "<p class='sub'>No pending ShoutOuts across the network.</p>";
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setText("masterStatus", "Master admin app loaded. Sign in to continue.");

    bind("masterGoogleLoginBtn", loginGoogle);
    bind("masterMicrosoftLoginBtn", loginMicrosoft);
    bind("masterLogoutBtn", logout);
    bind("masterPanelLogoutBtn", logout);

    auth.getRedirectResult().then(result => {
      if (result?.user) setText("masterStatus", `Microsoft redirect sign-in completed: ${result.user.email || result.user.displayName || result.user.uid}`);
    }).catch(e => setText("masterStatus", masterAuthErrorMessage(e)));

    auth.onAuthStateChanged(user => {
      setText("masterSignedInAs", user ? `Signed in as ${user.displayName || user.email || user.phoneNumber}` : "Not signed in");
      setText("masterPanelSignedInAs", user ? `Signed in as ${user.displayName || user.email || user.phoneNumber}` : "Not signed in");

      if (!user) {
        byId("masterLogin").classList.remove("hidden");
        byId("masterPanel").classList.add("hidden");
        return;
      }

      const check = masterSecurityCheck(user);
      if (!check.ok) {
        byId("masterLogin").classList.remove("hidden");
        byId("masterPanel").classList.add("hidden");
        setText("masterStatus", `Access denied: ${check.reason}`);
        return;
      }

      byId("masterLogin").classList.add("hidden");
      byId("masterPanel").classList.remove("hidden");
      setText("masterStatus", check.reason);
      setText("masterPanelSecurityStatus", check.reason);
      loadNetworkReports();
    });
  });
})();
