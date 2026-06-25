/* admin-app.js v24 - Club admin portal with analytics and reconciliation */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const safeUser = user => (user?.email || user?.phoneNumber || "unknown").toLowerCase();
  const money = value => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD", maximumFractionDigits:0}).format(value || 0);

  if (!window.firebaseConfig) { setText("adminStatus", "firebase-config.js missing window.firebaseConfig."); return; }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  const locationId = qs("location", qs("club", "zebbies-garden-washington-dc"));
  const loc = window.SHOUTOUT_CLUB_LOCATIONS?.[locationId] || { locationName: locationId, brand: locationId, genres: [], activityDates: [] };
  const MASTER_ADMIN_EMAILS = (window.SHOUTOUT_MASTER_ADMIN_EMAILS || window.SHOUTOUT_ADMIN_EMAILS || []).map(x => x.toLowerCase());
  const CLUB_ADMIN_EMAILS = (window.SHOUTOUT_ADMIN_EMAILS || []).map(x => x.toLowerCase());
  let adminUsers = [];
  let adminDesignations = [];

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  function adminAuthErrorMessage(e) {
    const code = e?.code || "error";
    const message = e?.message || String(e || "Unknown error");

    if (code === "auth/popup-closed-by-user") {
      return "Microsoft sign-in was interrupted before completion. This version uses redirect sign-in, but if you still see this, hard refresh and try again. Also verify Microsoft is enabled in Firebase Authentication.";
    }

    if (code === "auth/operation-not-allowed") {
      return "Microsoft sign-in is not enabled in Firebase Authentication. Go to Firebase Console > Authentication > Sign-in method > Microsoft and enable it.";
    }

    if (code === "auth/unauthorized-domain") {
      return "This domain is not authorized in Firebase Authentication. Add jadzadco.github.io and your Firebase hosting domains under Authentication > Settings > Authorized domains.";
    }

    if (code === "auth/account-exists-with-different-credential") {
      return "This email already exists with another sign-in method. Sign in with the original provider first, then link Microsoft later.";
    }

    if (code === "auth/invalid-credential" || code === "auth/invalid-oauth-client-id") {
      return "Microsoft OAuth configuration appears invalid. Verify Microsoft Client ID, Client Secret, and Firebase redirect URI in the Microsoft App Registration.";
    }

    return `${code}: ${message}`;
  }

  function buildMicrosoftProvider() {
    const p = new firebase.auth.OAuthProvider("microsoft.com");
    p.setCustomParameters({prompt:"select_account"});
    return p;
  }

  function isPopupIssue(e) {
    const code = e?.code || "";
    return code === "auth/popup-blocked" || code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
  }

  async function signInWithPopupThenRedirect(provider, statusId, label) {
    try {
      setText(statusId, `Opening ${label} sign-in...`);
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (isPopupIssue(e)) {
        try {
          setText(statusId, `${label} popup was blocked or closed. Redirecting instead...`);
          await auth.signInWithRedirect(provider);
          return;
        } catch (redirectError) {
          setText(statusId, adminAuthErrorMessage ? adminAuthErrorMessage(redirectError) : `${redirectError.code || "error"}: ${redirectError.message}`);
          return;
        }
      }
      setText(statusId, adminAuthErrorMessage ? adminAuthErrorMessage(e) : `${e.code || "error"}: ${e.message}`);
    }
  }


  function displayUrl(item) {
    const url = new URL("./display.html", window.location.href);
    url.searchParams.set("location", locationId);
    if (item) {
      url.searchParams.set("main", item.mainText || "");
      url.searchParams.set("sub", item.subText || "");
      url.searchParams.set("template", item.template || "neon");
      url.searchParams.set("media", item.mediaUrl || "");
      url.searchParams.set("mediaType", item.mediaType || "");
    }
    return url.href;
  }

  async function loginGoogle() {
    try {
      setText("adminStatus", "Opening Google sign-in...");
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch(e) {
      setText("adminStatus", `${e.code || "error"}: ${e.message}`);
    }
  }
  async function loginFacebook() {
    try {
      setText("adminStatus", "Opening Facebook sign-in...");
      await auth.signInWithPopup(new firebase.auth.FacebookAuthProvider());
    } catch(e) {
      setText("adminStatus", `${e.code || "error"}: ${e.message}`);
    }
  }
  async function loginMicrosoft() {
    const p = buildMicrosoftProvider();
    await signInWithPopupThenRedirect(p, "adminStatus", "Microsoft");
  }
  async function logout() { await auth.signOut(); window.location.reload(); }

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

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function contextualTextMatch(query, value) {
    const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
    const haystack = normalizeSearchText(value);
    return !tokens.length || tokens.every(token => haystack.includes(token));
  }

  function approvedRoles(profile = {}) {
    const raw = [
      profile.memberLevel,
      profile.role,
      profile.approvedRole,
      ...(Array.isArray(profile.approvedRoles) ? profile.approvedRoles : []),
      ...(Array.isArray(profile.roles) ? profile.roles : [])
    ].filter(Boolean).map(x => String(x).toLowerCase());
    const roles = new Set();
    raw.forEach(x => {
      if (x.includes("club")) roles.add("Club Admin");
      if (x.includes("promoter")) roles.add("Promoter");
      if (x.includes("dj")) roles.add("DJ");
      if (x.includes("waiter") || x.includes("waitress") || x.includes("bottle") || x.includes("hospitality")) roles.add("Waiter / Waitress / Bottle Girl");
    });
    return Array.from(roles);
  }

  function isHospitalityWorker(profile = {}) {
    return approvedRoles(profile).some(role => role.includes("Waiter"));
  }

  function employeeSearchText(profile = {}) {
    return [
      profile.displayName, profile.fullName, profile.username, profile.email, profile.city, profile.country,
      approvedRoles(profile).join(" "), ...(profile.clubLocationIds || []), ...(profile.approvedLocations || [])
    ].join(" ");
  }

  function designationId(uid) {
    return `${locationId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function isDesignatedCSR(uid) {
    return adminDesignations.some(x => (x.workerUid || x.uid) === uid && x.isCSR !== false);
  }

  async function setCSR(profile, enabled) {
    if (!profile.uid && !profile.id) return;
    const uid = profile.uid || profile.id;
    const payload = {
      clubLocationId: locationId,
      clubLocationName: loc.locationName || locationId,
      workerUid: uid,
      workerEmail: profile.email || "",
      workerName: profile.displayName || profile.fullName || profile.username || profile.email || "Club worker",
      workerUsername: profile.username || "",
      workerRoles: approvedRoles(profile),
      isCSR: !!enabled,
      designationType: "customer_service_representative",
      updatedByUid: auth.currentUser?.uid || "",
      updatedByEmail: safeUser(auth.currentUser),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("clubEmployeeDesignations").doc(designationId(uid)).set(payload, {merge:true});
    try {
      await db.collection("users").doc(uid).set({
        designatedCSRLocations: enabled ? firebase.firestore.FieldValue.arrayUnion(locationId) : firebase.firestore.FieldValue.arrayRemove(locationId),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    } catch(e) {
      console.warn("CSR designation saved, but user profile mirror was not updated:", e.message);
    }
    setText("adminStatus", enabled ? "CSR designation saved." : "CSR designation removed.");
    await loadEmployeeDesignations();
  }

  function renderEmployeeDesignations() {
    const candidateWrap = byId("employeeCandidates");
    const csrWrap = byId("csrList");
    if (!candidateWrap || !csrWrap) return;
    const query = byId("employeeSearch")?.value || "";
    const workers = adminUsers
      .filter(isHospitalityWorker)
      .filter(profile => contextualTextMatch(query, employeeSearchText(profile)))
      .slice(0, 40);
    candidateWrap.innerHTML = workers.length ? workers.map(profile => {
      const uid = profile.uid || profile.id;
      const checked = isDesignatedCSR(uid);
      return `<div class="queue-item employee-row">
        <div>
          <strong>${esc(profile.displayName || profile.fullName || profile.username || profile.email || "Club worker")}</strong>
          <p>${esc(profile.username ? `@${profile.username}` : profile.email || "")}</p>
          <small>${esc(approvedRoles(profile).join(", ") || "Approved worker")}</small>
        </div>
        <button type="button" data-uid="${esc(uid)}" data-action="${checked ? "remove" : "add"}">${checked ? "Remove CSR" : "Designate CSR"}</button>
      </div>`;
    }).join("") : "<p class='sub'>No approved hospitality workers matched this search.</p>";
    candidateWrap.querySelectorAll("button[data-uid]").forEach(btn => {
      const profile = workers.find(x => (x.uid || x.id) === btn.dataset.uid);
      btn.addEventListener("click", () => setCSR(profile, btn.dataset.action === "add"));
    });

    const active = adminDesignations.filter(x => x.isCSR !== false);
    csrWrap.innerHTML = active.length ? active.map(item => `<div class="queue-item employee-row">
      <div>
        <strong>${esc(item.workerName || item.workerEmail || "CSR")}</strong>
        <p>${esc(item.workerUsername ? `@${item.workerUsername}` : item.workerEmail || "")}</p>
        <small>${esc(item.clubLocationName || locationId)}</small>
      </div>
      <button type="button" data-uid="${esc(item.workerUid)}">Remove CSR</button>
    </div>`).join("") : "<p class='sub'>No customer service representative designated for this location yet.</p>";
    csrWrap.querySelectorAll("button[data-uid]").forEach(btn => {
      const profile = adminUsers.find(x => (x.uid || x.id) === btn.dataset.uid) || {uid:btn.dataset.uid};
      btn.addEventListener("click", () => setCSR(profile, false));
    });
  }

  async function loadEmployeeDesignations() {
    const [users, designations] = await Promise.all([
      getCollectionSafe("users"),
      getCollectionSafe("clubEmployeeDesignations")
    ]);
    adminUsers = users;
    adminDesignations = designations.filter(x => x.clubLocationId === locationId);
    renderEmployeeDesignations();
  }

  function renderQueue() {
    const queueList = byId("queueList");
    queueList.innerHTML = "<p class='sub'>Loading pending ShoutOuts...</p>";

    db.collection("shoutouts")
      .where("clubLocationId","==",locationId)
      .where("status","==","pending")
      .onSnapshot(snapshot => {
        queueList.innerHTML = "";
        setText("metricPending", String(snapshot.size));

        if (snapshot.empty) {
          queueList.innerHTML = "<p class='sub'>No pending ShoutOuts yet.</p>";
          return;
        }

        const sortedDocs = snapshot.docs.slice().sort((a,b) => {
          const av = a.data().submittedAt?.toMillis ? a.data().submittedAt.toMillis() : 0;
          const bv = b.data().submittedAt?.toMillis ? b.data().submittedAt.toMillis() : 0;
          return bv - av;
        });

        sortedDocs.forEach(doc => {
          const item = doc.data();
          const div = document.createElement("div");
          div.className = "queue-item";
          div.innerHTML = `
            <strong>${esc(item.mainText || "")}</strong>
            <p>${esc(item.subText || "")}</p>
            <small>
              Location: ${esc(item.locationName || item.clubName || locationId)}
              • Template: ${esc(item.templateName || item.template || "neon")}
              • Ref: ${esc(item.referenceNumber || "")}
              • Submitted by: ${esc(item.submittedBy || "unknown")}
            </small>
            <div class="queue-actions">
              <button class="approve" type="button">Approve & Push Live</button>
              <button class="reject" type="button">Reject</button>
              <a class="buttonlike" target="_blank" href="${displayUrl(item)}">Preview</a>
            </div>`;
          div.querySelector(".approve").addEventListener("click", () => approve(doc.id, item));
          div.querySelector(".reject").addEventListener("click", () => reject(doc.id));
          queueList.appendChild(div);
        });
      }, e => { queueList.innerHTML = `<p class="status">${esc(e.message)}</p>`; });
  }


  async function createStatusNotification(item, status, title) {
    try {
      await db.collection("inboxNotifications").add({
        recipientUid: item.submittedByUid || "",
        recipientEmail: item.submittedBy || item.submittedByEmail || "",
        type: "shoutoutStatus",
        title: title || `ShoutOut ${status}`,
        body: `Your ShoutOut status is now ${status}.`,
        referenceNumber: item.referenceNumber || "",
        clubLocationId: item.clubLocationId || locationId,
        locationName: item.locationName || loc.locationName || locationId,
        status,
        read:false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        link:"./patron-portal.html?tab=shoutouts&v=28.28-nf"
      });
    } catch(e) {}
  }
  async function auditShoutout(id, item, action) {
    try { await db.collection("shoutoutAudit").add({shoutoutId:id, action, clubLocationId:item.clubLocationId||locationId, referenceNumber:item.referenceNumber||"", actorUid:auth.currentUser?.uid||"", actorEmail:safeUser(auth.currentUser), createdAt:firebase.firestore.FieldValue.serverTimestamp()}); } catch(e) {}
  }

  async function approve(id, item) {
    await db.collection("liveContent").doc(locationId).set({
      location: locationId,
      clubLocationId: locationId,
      locationName: item.locationName || loc.locationName,
      brandName: item.brandName || loc.brandName,
      template: item.template || "neon",
      templateName: item.templateName || "",
      mainText: item.mainText || "SHOUTOUT!",
      subText: item.subText || "",
      mediaUrl: item.mediaUrl || "",
      mediaType: item.mediaType || "",
      mediaFileName: item.mediaFileName || "",
      mediaStoragePath: item.mediaStoragePath || "",
      mediaUploadedAt: item.mediaUploadedAt || null,
      status: "approved",
      submittedBy: item.submittedBy || "unknown",
      approvedBy: safeUser(auth.currentUser),
      referenceNumber: item.referenceNumber || "",
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});

    await createStatusNotification(item,"approved","ShoutOut Approved");
    await auditShoutout(id,item,"approved");
    await db.collection("shoutouts").doc(id).delete();
    loadReports();
  }

  async function reject(id) {
    const snap = await db.collection("shoutouts").doc(id).get();
    const item = snap.exists ? snap.data() : {};
    await db.collection("shoutouts").doc(id).delete();
    loadReports();
  }

  async function getCollectionSafe(name, limit=500) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      return snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch(e) {
      console.warn(`Could not read ${name}:`, e.message);
      return [];
    }
  }

  async function loadReports() {
    const [users, shoutouts, liveDocs, events, guestLists] = await Promise.all([
      getCollectionSafe("users"),
      getCollectionSafe("shoutouts"),
      getCollectionSafe("liveContent"),
      getCollectionSafe("events"),
      getCollectionSafe("guestListRequests")
    ]);

    const locationShoutouts = shoutouts.filter(x => (x.clubLocationId || x.location || x.club) === locationId);
    const locationEvents = events.filter(x => (x.locationId || x.clubLocationId || x.location) === locationId);
    const clubGuestLists = guestLists.filter(x => (x.clubLocationId || x.location) === locationId);
    const live = liveDocs.find(x => x.id === locationId);

    const estimatedShoutOutRevenue = locationShoutouts.length * 10;
    const adImpressions = Math.max(1250, locationShoutouts.length * 45 + 1250);
    const adClicks = Math.round(adImpressions * 0.035);

    setText("metricRevenue", money(estimatedShoutOutRevenue));
    setText("metricLive", live ? "1" : "0");
    setText("metricAdImpressions", adImpressions.toLocaleString());

    byId("venueSummary").innerHTML = simpleRows([
      ["Location", loc.locationName || locationId],
      ["City", loc.city || "—"],
      ["Region", loc.region || "—"],
      ["Country", loc.country || "—"],
      ["Genres", (loc.genres || []).join(", ") || "—"],
      ["Activity", (loc.activityDates || []).slice(0,3).join(" | ") || "—"]
    ]);

    const cities = {};
    users.forEach(u => { if (u.city) cities[u.city] = (cities[u.city] || 0) + 1; });
    const topCities = Object.entries(cities).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c,n]) => `${c} (${n})`).join(", ") || "Not enough data yet";

    byId("audienceReport").innerHTML = simpleRows([
      ["Known patrons", users.length.toLocaleString()],
      ["Top patron cities", topCities],
      ["Marketing opt-ins", users.filter(u => u.marketingConsent).length.toLocaleString()],
      ["Analytics opt-ins", users.filter(u => u.analyticsConsent).length.toLocaleString()]
    ]);

    const genreCounts = {};
    users.forEach(u => (u.favoriteGenres || []).forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1));
    (loc.genres || []).forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
    const topGenres = Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([g,n]) => `${g} (${n})`).join(", ") || "Not enough data yet";

    byId("musicReport").innerHTML = simpleRows([
      ["Top genres", topGenres],
      ["Venue genres", (loc.genres || []).join(", ") || "—"],
      ["Demand opportunity", "Compare searched genres to booked event genres"],
      ["Booking insight", "Use high-search genres to guide DJ/event bookings"]
    ]);

    byId("funnelReport").innerHTML = simpleRows([
      ["Events in system", locationEvents.length.toLocaleString()],
      ["Event views", "Placeholder until event click tracking is enabled"],
      ["Ticket clicks", "Placeholder until Ticketmaster/Eventbrite integration"],
      ["Reservation actions", "Reserve Table / VIP / Entry click tracking planned"]
    ]);

    byId("adReport").innerHTML = simpleRows([
      ["Estimated impressions", adImpressions.toLocaleString()],
      ["Estimated clicks", adClicks.toLocaleString()],
      ["Estimated CTR", `${((adClicks / adImpressions) * 100).toFixed(2)}%`],
      ["Best placements", "Splash screen, display wall, portable display"]
    ]);

    byId("sponsorReport").innerHTML = simpleRows([
      ["Alcohol / Spirits", "Tequila, champagne, cognac, vodka"],
      ["Fashion / Luxury", "Fragrance, designer apparel, watches"],
      ["Lifestyle", "Sneakers, travel, rideshare, beauty"],
      ["Local sponsors", "Restaurants, hookah lounges, promoters"]
    ]);

    const platformFee = Math.round(estimatedShoutOutRevenue * 0.20);
    const venueShare = estimatedShoutOutRevenue - platformFee;
    const adShare = Math.round(adImpressions / 1000 * 25);

    byId("reconciliationReport").innerHTML = simpleRows([
      ["Estimated ShoutOut gross", money(estimatedShoutOutRevenue)],
      ["FLOQR platform fee estimate", money(platformFee)],
      ["Venue ShoutOut share estimate", money(venueShare)],
      ["Estimated local ad share", money(adShare)],
      ["Pending payout", money(venueShare + adShare)],
      ["Reconciliation status", "Prototype — connect Stripe/Square/PayPal later"]
    ]);


    const promoterCounts = {};
    clubGuestLists.forEach(x => {
      const key = x.promoterName || x.promoterId || "Unknown promoter";
      promoterCounts[key] = promoterCounts[key] || {requests:0, guests:0};
      promoterCounts[key].requests += 1;
      promoterCounts[key].guests += Number(x.totalGuestCount || x.partySize || 0);
    });

    if (byId("clubGuestListReport")) {
      byId("clubGuestListReport").innerHTML = clubGuestLists.length ? simpleRows([
        ["Total guest list requests", clubGuestLists.length.toLocaleString()],
        ["Total referred guests", clubGuestLists.reduce((s,x) => s + Number(x.totalGuestCount || x.partySize || 0), 0).toLocaleString()],
        ["Pending requests", clubGuestLists.filter(x => (x.status || "pending") === "pending").length.toLocaleString()]
      ]) : "<p class='sub'>No guest list requests yet.</p>";
    }

    if (byId("clubPromoterReport")) {
      const rows = Object.entries(promoterCounts)
        .sort((a,b) => b[1].requests - a[1].requests)
        .map(([promoter,v]) => [promoter, `${v.requests} requests / ${v.guests} guests`]);
      byId("clubPromoterReport").innerHTML = rows.length ? simpleRows(rows) : "<p class='sub'>No promoter guest-list data yet.</p>";
    }

    byId("reportsList").innerHTML = `
      <div class="report-list">
        <button type="button">Download Venue Summary CSV</button>
        <button type="button">Download ShoutOut Queue CSV</button>
        <button type="button">Download Ad Performance CSV</button>
        <button type="button">Download Reconciliation CSV</button>
      </div>
      <p class="sub small">CSV export buttons are placeholders for the next backend iteration.</p>`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setText("clubName", loc.locationName || locationId);
    setText("adminStatus", "Admin app loaded. Sign in to continue.");
    byId("displayLink").href = `./display.html?location=${locationId}`;
    byId("liveFrame").src = `./display.html?location=${locationId}`;

    bind("adminGoogleLoginBtn", loginGoogle);
    bind("adminFacebookLoginBtn", loginFacebook);
    bind("adminMicrosoftLoginBtn", loginMicrosoft);
    bind("adminLogoutBtn", logout);
    byId("employeeSearch")?.addEventListener("input", renderEmployeeDesignations);

    auth.getRedirectResult().then(result => {
      if (result?.user) setText("adminStatus", `Microsoft redirect sign-in completed: ${result.user.email || result.user.displayName || result.user.uid}`);
    }).catch(e => setText("adminStatus", adminAuthErrorMessage(e)));

    auth.onAuthStateChanged(user => {
      const email = safeUser(user);
      setText("adminSignedInAs", user ? `Signed in as ${user.displayName || user.email || user.phoneNumber}` : "Not signed in");

      if (!user) {
        byId("adminLogin").classList.remove("hidden");
        byId("adminPanel").classList.add("hidden");
        return;
      }

      if (!CLUB_ADMIN_EMAILS.includes(email) && !MASTER_ADMIN_EMAILS.includes(email)) {
        byId("adminLogin").classList.remove("hidden");
        byId("adminPanel").classList.add("hidden");
        setText("adminStatus", `Signed in as ${email}, but this email is not listed as an admin.`);
        return;
      }

      byId("adminLogin").classList.add("hidden");
      byId("adminPanel").classList.remove("hidden");
      setText("adminStatus", "Club admin verified.");
      renderQueue();
      loadReports();
      loadEmployeeDesignations();
    });
  });
})();
