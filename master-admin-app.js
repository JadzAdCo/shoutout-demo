/* master-admin-app.js v29.06
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
  const CURRENT_VERSION = "29.06";

  if (!window.firebaseConfig) {
    setText("masterStatus", "firebase-config.js missing window.firebaseConfig.");
    return;
  }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage ? firebase.storage() : null;
  const functions = firebase.functions ? firebase.functions() : null;
  let networkUsers = [];
  let networkLocations = [];
  let selectedEntityClubId = "";
  let selectedEntityPatronUid = "";
  let managedTemplates = {};

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

  function setupActionFeedback() {
    document.addEventListener("click", event => {
      const target = event.target?.closest?.("a,button");
      if (!target || !byId("masterAdminPage")?.contains(target)) return;
      const rawLabel = target.textContent || target.getAttribute("aria-label") || target.id || target.href || "action";
      const label = rawLabel.replace(/\s+/g, " ").trim().slice(0, 140) || "action";
      const href = target.tagName === "A" ? target.href : "";
      const message = href
        ? `Clicked link: ${label}. Destination: ${href}`
        : `Clicked action: ${label}. Waiting for the feature-specific result message...`;
      setText("masterActionFeedback", message);
      if (target.closest("#diagnostics")) setText("diagnosticsStatus", message);
      if (target.closest("#duplicateRecords")) setText("duplicateRecordStatus", message);
      if (target.closest("#aiCrawling")) setText("aiDiscoveryStatus", message);
      if (target.closest("#staleRecordCleanup")) setText("staleRecordCleanupStatus", message);
    }, true);
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

  function locationName(row = {}) {
    return row.locationName || row.clubName || row.brandName || row.name || row.id || "Unknown location";
  }

  function clubAdminUrl(id = "") {
    const url = new URL("./admin.html", window.location.href);
    url.searchParams.set("location", id);
    url.searchParams.set("v", CURRENT_VERSION);
    return url.toString();
  }

  function displayUrl(id = "") {
    const url = new URL("./display.html", window.location.href);
    url.searchParams.set("location", id);
    url.searchParams.set("v", CURRENT_VERSION);
    return url.toString();
  }

  function slugify(value = "") {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `club-${Date.now()}`;
  }

  function addressParts(fullAddress = "") {
    const parts = String(fullAddress || "").split(",").map(x => x.trim()).filter(Boolean);
    const city = parts.length >= 2 ? parts[parts.length - 3] || parts[parts.length - 2] : "";
    const regionZip = parts.length >= 2 ? parts[parts.length - 2] : "";
    const country = parts.length >= 1 ? parts[parts.length - 1] : "";
    const region = (regionZip.match(/[A-Za-z]{2,}/) || [""])[0];
    return {city, region, country: country || "United States"};
  }

  function clubOnboardingPayload(input = {}) {
    const name = String(input.clubName || input["Club Name"] || "").trim();
    const fullAddress = String(input.fullAddress || input["Full Address"] || input.address || "").trim();
    const inferred = addressParts(fullAddress);
    const id = slugify(`${name}-${inferred.city || input.city || ""}-${inferred.region || input.region || ""}`);
    const genres = splitCSV(input.genres || input["Music Genres"] || input.musicGenres);
    const displayScreenFormatIds = Array.isArray(input.displayScreenFormatIds)
      ? input.displayScreenFormatIds
      : Array.from(document.querySelectorAll("[data-onboard-screen-format]:checked")).map(el => el.dataset.onboardScreenFormat);
    return {
      id,
      clubId: id,
      locationName: name,
      clubName: name,
      brandName: name,
      fullAddress,
      address: fullAddress,
      city: input.city || inferred.city || "",
      region: input.region || input.state || inferred.region || "",
      country: input.country || inferred.country || "United States",
      telephone: String(input.telephone || input.phone || input["Telephone #"] || "").trim(),
      officialWebsite: String(input.website || input.Website || "").trim(),
      email: String(input.email || input["Customer Email"] || "").trim(),
      socialMediaHandles: {
        instagram: String(input.instagram || input.Instagram || "").trim(),
        facebook: String(input.facebook || input.Facebook || "").trim(),
        x: String(input.x || input.X || "").trim(),
        tiktok: String(input.tiktok || input["Tic Tok"] || input.TikTok || input.Tiktok || "").trim()
      },
      genres,
      displayScreenFormatIds: displayScreenFormatIds.length ? displayScreenFormatIds : ["led-96x48"],
      primaryDisplayScreenFormatId: displayScreenFormatIds[0] || "led-96x48",
      publicProfileType: "club",
      visibility: "public",
      services: ["shoutout", "guestList"],
      maxGuestListCampaigns: 6,
      mediaPolicy: {
        maxMainMedia: 1,
        maxPublicImages: 5,
        maxPublicVideos: 5,
        maxMarketingVideoSeconds: 15
      },
      masterAdminUids: auth.currentUser?.uid ? [auth.currentUser.uid] : [],
      adminEmails: [safeUser(auth.currentUser)].filter(x => x && x !== "unknown"),
      onboardingSource: "master-admin",
      onboardingVersion: `v${CURRENT_VERSION}`,
      updatedByUid: auth.currentUser?.uid || "",
      updatedByEmail: safeUser(auth.currentUser),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  function readClubOnboardingForm() {
    return clubOnboardingPayload({
      clubName: byId("clubOnboardName")?.value,
      fullAddress: byId("clubOnboardAddress")?.value,
      telephone: byId("clubOnboardPhone")?.value,
      website: byId("clubOnboardWebsite")?.value,
      email: byId("clubOnboardEmail")?.value,
      instagram: byId("clubOnboardInstagram")?.value,
      facebook: byId("clubOnboardFacebook")?.value,
      x: byId("clubOnboardX")?.value,
      tiktok: byId("clubOnboardTiktok")?.value,
      genres: byId("clubOnboardGenres")?.value,
      displayScreenFormatIds: Array.from(document.querySelectorAll("[data-onboard-screen-format]:checked")).map(el => el.dataset.onboardScreenFormat)
    });
  }

  async function saveClubOnboarding(payload) {
    if (!payload.locationName) throw new Error("Club Name is required.");
    await db.collection("clubLocations").doc(payload.id).set(payload, {merge:true});
    await db.collection("clubs").doc(payload.id).set({
      clubId: payload.id,
      clubName: payload.clubName,
      brandName: payload.brandName,
      primaryLocationId: payload.id,
      adminEmails: payload.adminEmails,
      masterAdminUids: payload.masterAdminUids,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    await db.collection("clubOnboardingRecords").doc(payload.id).set({
      ...payload,
      adminPortalUrl: clubAdminUrl(payload.id),
      displayUrl: displayUrl(payload.id),
      status: "created"
    }, {merge:true});
    if (window.FLOQRAIIndex) {
      const indexRecord = window.FLOQRAIIndex.clubLocationIndexRecord(payload.id, payload);
      await window.FLOQRAIIndex.upsertAiIndex(db, `clubLocation_${payload.id}`, indexRecord);
    }
    return payload;
  }

  function renderOnboardingResult(payload, targetId = "clubOnboardingPreview") {
    const wrap = byId(targetId);
    if (!wrap) return;
    wrap.innerHTML = `<div class="queue-item">
      <strong>${esc(payload.locationName)}</strong>
      <p>${esc(payload.fullAddress || "")}</p>
      <p><strong>Club Location ID:</strong> ${esc(payload.id)}</p>
      <p><strong>Admin Portal:</strong> <a class="message-inline-link" href="${esc(clubAdminUrl(payload.id))}">${esc(clubAdminUrl(payload.id))}</a></p>
      <p><strong>Display URL:</strong> <a class="message-inline-link" href="${esc(displayUrl(payload.id))}">${esc(displayUrl(payload.id))}</a></p>
    </div>`;
  }

  async function createClubFromForm() {
    try {
      setText("clubOnboardingStatus", "Creating club venue...");
      const payload = readClubOnboardingForm();
      await saveClubOnboarding(payload);
      renderOnboardingResult(payload);
      setText("clubOnboardingStatus", `Created ${payload.locationName}.`);
      await loadNetworkReports();
    } catch (e) {
      setText("clubOnboardingStatus", `Club onboarding failed: ${e.message || e}`);
    }
  }

  function parseCsv(text = "") {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];
      if (quoted && ch === '"' && next === '"') { cell += '"'; i += 1; continue; }
      if (ch === '"') { quoted = !quoted; continue; }
      if (!quoted && ch === ",") { row.push(cell); cell = ""; continue; }
      if (!quoted && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (row.some(x => String(x).trim())) rows.push(row);
        row = [];
        cell = "";
        continue;
      }
      cell += ch;
    }
    row.push(cell);
    if (row.some(x => String(x).trim())) rows.push(row);
    if (!rows.length) return [];
    const headers = rows.shift().map(x => x.trim());
    return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] || ""])));
  }

  let previewedClubCsvRows = [];

  async function previewClubCsv() {
    const file = byId("clubOnboardingCsvFile")?.files?.[0];
    const report = byId("clubOnboardingCsvReport");
    if (!file || !report) return;
    const text = await file.text();
    previewedClubCsvRows = parseCsv(text).map(clubOnboardingPayload);
    report.innerHTML = previewedClubCsvRows.length ? previewedClubCsvRows.map(row => `<div class="queue-item">
      <strong>${esc(row.locationName || "Unnamed club")}</strong>
      <p>${esc(row.fullAddress || "")}</p>
      <small>${esc(row.id)} - ${esc((row.genres || []).join(", "))}</small>
    </div>`).join("") : "<p class='sub'>No importable club rows found.</p>";
  }

  async function importClubCsv() {
    const report = byId("clubOnboardingCsvReport");
    if (!previewedClubCsvRows.length) await previewClubCsv();
    if (!previewedClubCsvRows.length) return;
    setText("clubOnboardingStatus", `Importing ${previewedClubCsvRows.length} club(s)...`);
    const imported = [];
    for (const row of previewedClubCsvRows) {
      imported.push(await saveClubOnboarding(row));
    }
    if (report) {
      report.innerHTML = imported.map(row => `<div class="queue-item">
        <strong>${esc(row.locationName)}</strong>
        <p>Created: <a class="message-inline-link" href="${esc(clubAdminUrl(row.id))}">${esc(clubAdminUrl(row.id))}</a></p>
      </div>`).join("");
    }
    setText("clubOnboardingStatus", `Imported ${imported.length} club(s).`);
    await loadNetworkReports();
  }

  async function createPromoterOnboarding() {
    const identity = String(byId("promoterOnboardIdentity")?.value || "").trim();
    const name = String(byId("promoterOnboardName")?.value || "").trim();
    const clubId = String(byId("promoterOnboardClubId")?.value || "").trim();
    const payload = {
      promoterName: name,
      patronIdentity: identity,
      promoterCompany: String(byId("promoterOnboardCompany")?.value || "").trim(),
      independentPromoter: !!byId("promoterOnboardIndependent")?.checked,
      affiliatedClubLocationId: clubId,
      roleType: "Promoter",
      status: "pending-patron-match",
      createdByUid: auth.currentUser?.uid || "",
      createdByEmail: safeUser(auth.currentUser),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!name || !identity) {
      byId("promoterOnboardingReport").innerHTML = "<p class='status'>Promoter name and patron email/username are required.</p>";
      return;
    }
    const docId = slugify(`${identity}-${clubId || name}`);
    await db.collection("promoterOnboardingRecords").doc(docId).set(payload, {merge:true});
    byId("promoterOnboardingReport").innerHTML = simpleRows([
      ["Promoter", name],
      ["Patron identity", identity],
      ["Affiliated club", clubId || "Not assigned yet"],
      ["Status", "Created; match this record to an existing patron before role activation"]
    ]);
  }

  function entitySearchText(row = {}) {
    return [
      row.id,
      row.locationName,
      row.clubName,
      row.brandName,
      row.address,
      row.fullAddress,
      row.city,
      row.region,
      row.country,
      row.onboardingSource,
      row.discoveryMode
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function patronSearchText(row = {}) {
    return [row.uid, row.id, row.displayName, row.username, row.email, row.phoneNumber].filter(Boolean).join(" ").toLowerCase();
  }

  function updateEntityAssignmentSummary() {
    const wrap = byId("entityAssignmentSummary");
    const club = networkLocations.find(row => row.id === selectedEntityClubId);
    const patron = networkUsers.find(row => (row.uid || row.id) === selectedEntityPatronUid);
    if (wrap) wrap.innerHTML = simpleRows([
      ["Selected entity", club ? `${locationName(club)} (${club.id})` : "Choose a club"],
      ["Selected patron", patron ? `${patron.displayName || patron.username || patron.email || patron.uid || patron.id} (${patron.email || patron.uid || patron.id})` : "Choose a completed patron profile"],
      ["Activation", club && patron ? "Ready to assign Club Admin portal access" : "Waiting for both selections"]
    ]);
    if (byId("assignEntityClubAdminBtn")) byId("assignEntityClubAdminBtn").disabled = !(club && patron && patron.profileCompleted === true);
  }

  function renderEntityClubResults() {
    const wrap = byId("entityClubResults");
    if (!wrap) return;
    const query = String(byId("entityClubSearch")?.value || "").trim().toLowerCase();
    const rows = networkLocations.filter(row => !query || entitySearchText(row).includes(query)).slice(0, 80);
    wrap.innerHTML = rows.length ? rows.map(row => `<button class="entity-result-card ${row.id === selectedEntityClubId ? "selected" : ""}" type="button" data-entity-club-id="${esc(row.id)}">
      <strong>${esc(locationName(row))}</strong>
      <span>${esc([row.city, row.region, row.country].filter(Boolean).join(", ") || row.address || row.fullAddress || row.id)}</span>
      <small>${esc(row.onboardingSource || row.discoveryMode || "FLOQR clubLocations")}</small>
    </button>`).join("") : "<p class='sub'>No matching imported or discovered club was found.</p>";
    wrap.querySelectorAll("[data-entity-club-id]").forEach(button => button.addEventListener("click", () => {
      selectedEntityClubId = button.dataset.entityClubId || "";
      renderEntityClubResults();
      updateEntityAssignmentSummary();
    }));
  }

  function renderEntityPatronResults() {
    const wrap = byId("entityPatronResults");
    if (!wrap) return;
    const query = String(byId("entityPatronSearch")?.value || "").trim().toLowerCase();
    const rows = networkUsers.filter(row => !query || patronSearchText(row).includes(query)).slice(0, 80);
    wrap.innerHTML = rows.length ? rows.map(row => {
      const uid = row.uid || row.id;
      const complete = row.profileCompleted === true;
      return `<button class="entity-result-card ${uid === selectedEntityPatronUid ? "selected" : ""}" type="button" data-entity-patron-uid="${esc(uid)}" ${complete ? "" : "disabled"}>
        <strong>${esc(row.displayName || row.username || row.email || uid)}</strong>
        <span>${esc(row.email || row.phoneNumber || uid)}</span>
        <small>${complete ? "Completed patron profile — eligible" : "Profile incomplete — not eligible"}</small>
      </button>`;
    }).join("") : "<p class='sub'>No matching registered patron was found.</p>";
    wrap.querySelectorAll("[data-entity-patron-uid]").forEach(button => button.addEventListener("click", () => {
      selectedEntityPatronUid = button.dataset.entityPatronUid || "";
      renderEntityPatronResults();
      updateEntityAssignmentSummary();
    }));
  }

  async function assignSelectedEntityClubAdmin() {
    const club = networkLocations.find(row => row.id === selectedEntityClubId);
    const patron = networkUsers.find(row => (row.uid || row.id) === selectedEntityPatronUid);
    if (!club || !patron || patron.profileCompleted !== true) {
      setText("entityOnboardingStatus", "Select one club and one patron with a completed profile.");
      return;
    }
    const uid = patron.uid || patron.id;
    const email = String(patron.email || "").toLowerCase();
    setText("entityOnboardingStatus", `Assigning ${patron.displayName || email || uid} to ${locationName(club)}...`);
    if (club.sourceCollection && club.sourceCollection !== "clubLocations") {
      await db.collection("clubLocations").doc(club.id).set({
        locationName:locationName(club),
        brandName:club.brandName || club.proposedTitle || locationName(club),
        address:club.address || club.proposedAddress || "",
        city:club.city || "",
        region:club.region || club.stateRegion || "",
        country:club.country || "",
        telephone:club.telephone || club.phone || "",
        officialWebsite:club.officialWebsite || club.website || club.sourceUrl || "",
        socialMediaHandles:club.socialMediaHandles || {},
        onboardingSource:club.sourceCollection,
        sourceRecordId:club.sourceRecordId || "",
        active:true,
        status:"active",
        displayScreenFormatIds:club.displayScreenFormatIds || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS || ["led-96x48"],
        primaryDisplayScreenFormatId:club.primaryDisplayScreenFormatId || "led-96x48",
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }
    let backendActivated = false;
    if (functions) {
      try {
        const result = await functions.httpsCallable("assignClubAdmin")({clubId:club.id, clubLocationId:club.id, patronUid:uid});
        backendActivated = result?.data?.status === "active";
      } catch (error) {
        console.warn("assignClubAdmin callable unavailable; using assignment-record fallback:", error?.message || error);
      }
    }
    if (!backendActivated) {
      const assignmentId = `${club.id}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const assignment = {
        clubLocationId:club.id,
        clubLocationName:locationName(club),
        patronUid:uid,
        patronEmail:email,
        patronDisplayName:patron.displayName || patron.username || email || uid,
        role:"Club Admin",
        status:"active",
        assignedByUid:auth.currentUser?.uid || "",
        assignedByEmail:safeUser(auth.currentUser),
        assignedAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection("clubAdminAssignments").doc(assignmentId).set(assignment, {merge:true});
      await db.collection("clubLocations").doc(club.id).set({
        adminUids:firebase.firestore.FieldValue.arrayUnion(uid),
        adminEmails:email ? firebase.firestore.FieldValue.arrayUnion(email) : (club.adminEmails || []),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      await db.collection("clubs").doc(club.id).set({
        adminUids:firebase.firestore.FieldValue.arrayUnion(uid),
        adminEmails:email ? firebase.firestore.FieldValue.arrayUnion(email) : [],
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }
    setText("entityOnboardingStatus", `${patron.displayName || email || uid} now has Club Admin access to ${locationName(club)}. ${backendActivated ? "The patron profile and venue records were synchronized by the backend." : "The assignment record is active; deploy assignClubAdmin to synchronize custom claims/profile role fields."}`);
    updateEntityAssignmentSummary();
  }

  function managedTemplateScreenIds() {
    return Array.from(document.querySelectorAll("[data-template-screen-format]:checked")).map(el => el.dataset.templateScreenFormat);
  }

  function clearManagedTemplateForm() {
    ["templateManageId","templateManageName","templateManageCategory","templateManageTags","templateManageDescription"].forEach(id => { if (byId(id)) byId(id).value = ""; });
    if (byId("templateManageClass")) byId("templateManageClass").value = "neon";
    if (byId("templateManageMainLimit")) byId("templateManageMainLimit").value = "45";
    if (byId("templateManageLineCount")) byId("templateManageLineCount").value = "3";
    if (byId("templateManageLineLimit")) byId("templateManageLineLimit").value = "15";
    if (byId("templateManageSupportsMedia")) byId("templateManageSupportsMedia").checked = false;
    if (byId("templateManageBackgroundEditable")) byId("templateManageBackgroundEditable").checked = true;
    document.querySelectorAll("[data-template-screen-format]").forEach(el => { el.checked = true; });
  }

  function fillManagedTemplateForm(template = {}) {
    if (byId("templateManageId")) byId("templateManageId").value = template.id || "";
    if (byId("templateManageName")) byId("templateManageName").value = template.name || "";
    if (byId("templateManageClass")) byId("templateManageClass").value = template.className || "neon";
    if (byId("templateManageCategory")) byId("templateManageCategory").value = template.category || "";
    if (byId("templateManageTags")) byId("templateManageTags").value = (template.tags || []).join(", ");
    if (byId("templateManageDescription")) byId("templateManageDescription").value = template.description || "";
    if (byId("templateManageMainLimit")) byId("templateManageMainLimit").value = template.maxMainCharacters || 45;
    if (byId("templateManageLineCount")) byId("templateManageLineCount").value = template.lineCount || 3;
    if (byId("templateManageLineLimit")) byId("templateManageLineLimit").value = template.maxCharactersPerLine || 15;
    if (byId("templateManageSupportsMedia")) byId("templateManageSupportsMedia").checked = !!(template.supportsMedia || template.supportsImage || template.supportsVideo);
    if (byId("templateManageBackgroundEditable")) byId("templateManageBackgroundEditable").checked = template.backgroundEditable !== false;
    const formats = new Set(template.screenFormatIds || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS || []);
    document.querySelectorAll("[data-template-screen-format]").forEach(el => { el.checked = formats.has(el.dataset.templateScreenFormat); });
    byId("templateManageId")?.scrollIntoView?.({behavior:"smooth", block:"center"});
  }

  async function loadManagedTemplates() {
    managedTemplates = Object.fromEntries(Object.entries(window.SHOUTOUT_TEMPLATES || {}).map(([id, data]) => [id, {id, source:"package", ...data}]));
    const rows = await getCollectionSafe("templates", 500);
    rows.forEach(row => { managedTemplates[row.id] = {...managedTemplates[row.id], ...row, id:row.id, source:"Firestore"}; });
    renderTemplateManagement();
  }

  function renderTemplateManagement() {
    const wrap = byId("templateManagementList");
    if (!wrap) return;
    const query = String(byId("templateManagementSearch")?.value || "").trim().toLowerCase();
    const rows = Object.values(managedTemplates).filter(template => !query || [template.id, template.name, template.category, template.description, ...(template.tags || []), ...(template.screenFormatIds || [])].join(" ").toLowerCase().includes(query)).sort((a,b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
    wrap.innerHTML = rows.map(template => `<div class="queue-item managed-template-row ${template.status === "deleted" ? "is-deactivated" : ""}">
      <div class="message-envelope-head"><strong>${esc(template.name || template.id)}</strong><span>${esc(template.status || "active")}</span></div>
      <p>${esc(template.description || "No description")}</p>
      <small>${esc(template.id)} | ${esc((template.tags || []).join(", "))} | Screens: ${esc((template.screenFormatIds || []).join(", ") || "not tagged")} | Background: ${template.backgroundEditable === false ? "locked" : "editable"}</small>
      <div class="queue-actions"><button type="button" data-template-edit="${esc(template.id)}">Edit</button><button type="button" data-template-toggle="${esc(template.id)}">${template.status === "deleted" ? "Restore" : "Deactivate"}</button></div>
    </div>`).join("") || "<p class='sub'>No templates matched.</p>";
    wrap.querySelectorAll("[data-template-edit]").forEach(button => button.addEventListener("click", () => fillManagedTemplateForm(managedTemplates[button.dataset.templateEdit] || {})));
    wrap.querySelectorAll("[data-template-toggle]").forEach(button => button.addEventListener("click", async () => {
      const template = managedTemplates[button.dataset.templateToggle] || {};
      const status = template.status === "deleted" ? "active" : "deleted";
      await db.collection("templates").doc(button.dataset.templateToggle).set({status, updatedAt:firebase.firestore.FieldValue.serverTimestamp(), updatedByUid:auth.currentUser?.uid || ""}, {merge:true});
      setText("templateManagementStatus", `${template.name || template.id} is now ${status}.`);
      await loadManagedTemplates();
    }));
  }

  async function saveManagedTemplate() {
    const id = slugify(byId("templateManageId")?.value || byId("templateManageName")?.value || "");
    const name = String(byId("templateManageName")?.value || "").trim();
    if (!id || !name) { setText("templateManagementStatus", "Template ID and name are required."); return; }
    const supportsMedia = !!byId("templateManageSupportsMedia")?.checked;
    const screenFormatIds = managedTemplateScreenIds();
    if (!screenFormatIds.length) { setText("templateManagementStatus", "Select at least one compatible screen format."); return; }
    const lineCount = Math.max(1, Number(byId("templateManageLineCount")?.value || 3));
    const maxCharactersPerLine = Math.max(1, Number(byId("templateManageLineLimit")?.value || 15));
    const requestedTotal = Math.max(1, Number(byId("templateManageMainLimit")?.value || (lineCount * maxCharactersPerLine)));
    const maxMainCharacters = Math.min(requestedTotal, lineCount * maxCharactersPerLine);
    const payload = {
      id,
      name,
      className:byId("templateManageClass")?.value || "neon",
      category:String(byId("templateManageCategory")?.value || "").trim(),
      tags:splitCSV(byId("templateManageTags")?.value),
      description:String(byId("templateManageDescription")?.value || "").trim(),
      supportsMedia,
      supportsImage:supportsMedia,
      supportsVideo:supportsMedia,
      backgroundEditable:byId("templateManageBackgroundEditable")?.checked !== false,
      mediaMode:supportsMedia ? "Image/video placeholder" : "No image/video",
      maxMainCharacters,
      lineCount,
      maxCharactersPerLine,
      screenFormatIds,
      status:"active",
      scope:"Shared",
      updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedByUid:auth.currentUser?.uid || "",
      updatedByEmail:safeUser(auth.currentUser)
    };
    await db.collection("templates").doc(id).set(payload, {merge:true});
    setText("templateManagementStatus", `${name} saved with ${lineCount} line(s), ${maxCharactersPerLine} characters per line, ${maxMainCharacters} total characters, ${screenFormatIds.length} screen format tag(s), and a ${payload.backgroundEditable ? "customizable" : "locked"} background.`);
    await loadManagedTemplates();
    fillManagedTemplateForm(managedTemplates[id] || payload);
  }

  function renderClubAdminUrls(locationRows = []) {
    const wrap = byId("clubAdminUrlList");
    if (!wrap) return;
    const rows = locationRows
      .filter(row => row && row.id)
      .sort((a,b) => locationName(a).localeCompare(locationName(b)));
    wrap.innerHTML = rows.length ? rows.map(row => {
      const admin = clubAdminUrl(row.id);
      const display = displayUrl(row.id);
      const where = [row.city, row.region || row.state || row.province, row.country].filter(Boolean).join(", ");
      return `<div class="queue-item">
        <div class="message-envelope-head">
          <strong>${esc(locationName(row))}</strong>
          <span>${esc(row.id)}</span>
        </div>
        <p>${esc(where || row.locationLabel || "Location details not added yet")}</p>
        <p><strong>Admin Portal:</strong> <a class="message-inline-link" href="${esc(admin)}">${esc(admin)}</a></p>
        <p><strong>Display URL:</strong> <a class="message-inline-link" href="${esc(display)}">${esc(display)}</a></p>
      </div>`;
    }).join("") : "<p class='sub'>No club locations found yet.</p>";
  }

  function splitCSV(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return String(value || "").split(/[,;|/]+/).map(x => x.trim()).filter(Boolean);
  }

  function norm(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function firstValue(...values) {
    return values.find(value => String(value || "").trim()) || "";
  }

  function profileStateRegion(profile = {}) {
    return firstValue(profile.state, profile.region, profile.province, profile.stateRegionProvince, profile.stateProvince, profile.regionProvince);
  }

  function profileAge(profile = {}) {
    const direct = firstValue(profile.age, profile.patronAge);
    if (direct) return String(direct);
    const birthYear = Number(profile.birthYear || 0);
    if (birthYear > 1900) return String(new Date().getFullYear() - birthYear);
    return "";
  }

  function datapointValue(profile = {}, key) {
    const map = {
      City: profile.city,
      "State / Region": profileStateRegion(profile),
      Country: profile.country,
      Age: profileAge(profile),
      Food: profile.foodChoices || profile.favoriteFoods,
      Music: profile.musicInterests || profile.favoriteGenres,
      Hobbies: profile.hobbies || profile.generalHobbies,
      Travel: profile.travelInterests,
      Events: profile.nightlifeInterests || profile.nightlifeStyle,
      Beverages: profile.favoriteBeverages || profile.beverageChoices,
      Meet: profile.lookingToMeet
    };
    return map[key];
  }

  const PATRON_DIAGNOSTIC_KEYS = ["City", "State / Region", "Country", "Age", "Food", "Music", "Hobbies", "Travel", "Events", "Beverages", "Meet"];

  function datapointList(profile = {}, key) {
    const value = datapointValue(profile, key);
    return splitCSV(value).map(x => x.trim()).filter(Boolean);
  }

  function datapointText(profile = {}, key) {
    return datapointList(profile, key).join(", ");
  }

  function datapointOverlap(a = {}, b = {}, key) {
    const left = datapointList(a, key).map(norm).filter(Boolean);
    const right = datapointList(b, key).map(norm).filter(Boolean);
    return left.some(item => right.includes(item));
  }

  function isPatronProfile(profile = {}) {
    const roleText = [
      profile.memberLevel,
      profile.role,
      profile.approvedRole,
      ...(Array.isArray(profile.roles) ? profile.roles : []),
      ...(Array.isArray(profile.approvedRoles) ? profile.approvedRoles : [])
    ].join(" ").toLowerCase();
    if (!roleText.trim()) return true;
    return roleText.includes("patron") && !roleText.includes("master admin");
  }

  function patronName(profile = {}) {
    return profile.displayName || profile.fullName || profile.username || profile.email || profile.uid || profile.id || "Unknown patron";
  }

  function renderPatronDiagnostics(users = []) {
    const patrons = users.filter(isPatronProfile);
    const rows = PATRON_DIAGNOSTIC_KEYS.map(key => [key, topList(countBy(patrons, p => datapointText(p, key)), 5)]);
    byId("patronDatapointSummary").innerHTML = simpleRows([
      ["Patrons scanned", patrons.length.toLocaleString()],
      ["Public profiles", patrons.filter(p => String(p.publicProfileVisibility || "").toLowerCase() === "public").length.toLocaleString()],
      ...rows
    ]);

    byId("patronDatapointTable").innerHTML = patrons.length ? patrons.map(profile => `
      <div class="queue-item">
        <strong>${esc(patronName(profile))}</strong>
        <p>${esc(profile.email || profile.username || profile.uid || profile.id || "")}</p>
        <div class="tag-row">
          ${PATRON_DIAGNOSTIC_KEYS.map(key => {
            const value = datapointText(profile, key);
            return value ? `<span>${esc(key)}: ${esc(value)}</span>` : "";
          }).join("")}
        </div>
      </div>`).join("") : "<p class='sub'>No patron profiles found.</p>";

    const pairs = [];
    for (let i = 0; i < patrons.length; i += 1) {
      for (let j = i + 1; j < patrons.length; j += 1) {
        const matched = PATRON_DIAGNOSTIC_KEYS.filter(key => datapointOverlap(patrons[i], patrons[j], key));
        if (matched.length >= 2) pairs.push({a:patrons[i], b:patrons[j], matched});
      }
    }
    pairs.sort((a,b) => b.matched.length - a.matched.length);
    byId("patronOverlapReport").innerHTML = pairs.length ? pairs.slice(0, 100).map(pair => `
      <div class="queue-item">
        <strong>${esc(patronName(pair.a))} + ${esc(patronName(pair.b))}</strong>
        <p>${esc(pair.matched.length)} common datapoints: ${esc(pair.matched.join(", "))}</p>
      </div>`).join("") : "<p class='sub'>No patron pairs have 2 or more matching datapoints yet.</p>";
  }

  function renderAdCampaignManagement(users = []) {
    const summary = byId("adCampaignManagementSummary");
    const list = byId("adCampaignManagementList");
    if (!summary || !list) return;
    if (!window.FLOQRAdCampaigns) {
      summary.innerHTML = "<p class='sub'>Ad campaign registry did not load.</p>";
      list.innerHTML = "";
      return;
    }
    const patrons = users.filter(isPatronProfile);
    const campaigns = window.FLOQRAdCampaigns.campaigns();
    const analytics = window.FLOQRAdCampaigns.campaignAnalytics(patrons);
    summary.innerHTML = simpleRows([
      ["Campaigns in pool", campaigns.length.toLocaleString()],
      ["Preview campaigns", campaigns.filter(item => item.status === "preview").length.toLocaleString()],
      ["Needs verification", campaigns.filter(item => item.status === "needs-verification").length.toLocaleString()],
      ["Patron profiles scanned", patrons.length.toLocaleString()],
      ["Top campaign match", analytics.sort((a,b) => b.matchedPatrons - a.matchedPatrons)[0]?.title || "Not enough patron data"]
    ]);
    window.FLOQRAdCampaigns.renderAdminCampaignManager("adCampaignManagementList", patrons);
  }

  async function loadNetworkReports() {
    const [users, shoutouts, liveDocs, locations, events, guestLists, onboardingRecords, discoveryRecords] = await Promise.all([
      getCollectionSafe("users"),
      getCollectionSafe("shoutouts"),
      getCollectionSafe("liveContent"),
      getCollectionSafe("clubLocations"),
      getCollectionSafe("events"),
      getCollectionSafe("guestListRequests"),
      getCollectionSafe("clubOnboardingRecords"),
      getCollectionSafe("aiDiscoveryQueue")
    ]);

    const fallbackLocations = Object.entries(window.SHOUTOUT_CLUB_LOCATIONS || {}).map(([id, data]) => ({id, ...data}));
    const locationMap = new Map((locations.length ? locations : fallbackLocations).map(row => [row.id, row]));
    onboardingRecords.forEach(row => {
      const id = slugify(row.clubLocationId || row.id || row.clubName || row.locationName || "imported-club");
      if (!locationMap.has(id)) locationMap.set(id, {...row, id, sourceCollection:"clubOnboardingRecords", sourceRecordId:row.id, onboardingSource:row.onboardingSource || "CSV/manual onboarding"});
    });
    discoveryRecords.filter(row => /club|lounge|bar|venue|nightclub/i.test(`${row.proposedType || ""} ${(row.categories || []).join(" ")}`)).forEach(row => {
      const id = slugify(`${row.proposedTitle || row.proposedLocationName || "discovered-club"}-${row.city || row.country || row.id}`);
      if (!locationMap.has(id)) locationMap.set(id, {...row, id, locationName:row.proposedTitle || row.proposedLocationName, address:row.proposedAddress || row.address || "", sourceCollection:"aiDiscoveryQueue", sourceRecordId:row.id, onboardingSource:"AI crawl discovery"});
    });
    const locationRows = Array.from(locationMap.values());
    networkUsers = users.map(row => ({...row, uid:row.uid || row.id}));
    networkLocations = locationRows;
    renderEntityClubResults();
    renderEntityPatronResults();
    updateEntityAssignmentSummary();
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

    renderClubAdminUrls(locationRows);

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

    renderPatronDiagnostics(users);
    renderAdCampaignManagement(users);

    const gross = revenue + Math.round(impressions / 1000 * 25);
    const platformShare = Math.round(gross * 0.35);
    const venueShare = gross - platformShare;

    byId("networkReconReport").innerHTML = simpleRows([
      ["Estimated gross revenue", money(gross)],
      ["Estimated FLOQR platform share", money(platformShare)],
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
        ["FLOQR near-term approach", "Start with outbound ticket links, then affiliate tracking, then direct checkout/reservation integrations"]
      ])}
      <p class="sub small">Use Events as a discovery layer first. Add affiliate tracking after program approval. Use FLOQR-owned VIP/table reservations for higher-margin revenue.</p>`;


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
    setupActionFeedback();
    setText("masterStatus", "Master admin app loaded. Sign in to continue.");

    bind("masterGoogleLoginBtn", loginGoogle);
    bind("masterMicrosoftLoginBtn", loginMicrosoft);
    bind("masterLogoutBtn", logout);
    bind("masterPanelLogoutBtn", logout);
    bind("createClubOnboardingBtn", createClubFromForm);
    bind("previewClubOnboardingCsvBtn", previewClubCsv);
    bind("importClubOnboardingCsvBtn", importClubCsv);
    bind("createPromoterOnboardingBtn", createPromoterOnboarding);
    bind("assignEntityClubAdminBtn", assignSelectedEntityClubAdmin);
    bind("saveManagedTemplateBtn", saveManagedTemplate);
    bind("clearManagedTemplateBtn", clearManagedTemplateForm);
    byId("entityClubSearch")?.addEventListener("input", renderEntityClubResults);
    byId("entityPatronSearch")?.addEventListener("input", renderEntityPatronResults);
    byId("templateManagementSearch")?.addEventListener("input", renderTemplateManagement);

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
      loadManagedTemplates();
      if (window.FLOQRAIDiscovery) window.FLOQRAIDiscovery.mountMasterAdminPanel({db, auth});
      if (window.FLOQRDuplicateRecords) window.FLOQRDuplicateRecords.mount({db, auth});
      if (window.FLOQRDiagnostics) window.FLOQRDiagnostics.mount({db, auth, storage});
    });
  });
})();
