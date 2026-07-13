/* admin-app.js v29.04 - Venue Command Center and owner-managed public club profiles */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const safeUser = user => (user?.email || user?.phoneNumber || "unknown").toLowerCase();
  const money = value => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD", maximumFractionDigits:0}).format(value || 0);
  const CURRENT_VERSION = "29.04";

  if (!window.firebaseConfig) { setText("adminStatus", "firebase-config.js missing window.firebaseConfig."); return; }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage ? firebase.storage() : null;

  let locationId = canonicalStaticLocationId(qs("location", qs("club", "zebbies-garden-washington-dc")));
  const profileImportDraftId = qs("profileImportDraft", "");
  let loc = getStaticLocation(locationId);
  let publicClubProfile = {...loc};
  const MASTER_ADMIN_EMAILS = (window.SHOUTOUT_MASTER_ADMIN_EMAILS || window.SHOUTOUT_ADMIN_EMAILS || []).map(x => x.toLowerCase());
  const CLUB_ADMIN_EMAILS = (window.SHOUTOUT_ADMIN_EMAILS || []).map(x => x.toLowerCase());
  let adminUsers = [];
  let adminDesignations = [];
  let clubMedia = [];
  let guestListCampaigns = [];

  function canonicalStaticLocationId(id = "") {
    const key = String(id || "zebbies-garden-washington-dc").toLowerCase();
    const row = (window.SHOUTOUT_CLUB_LOCATIONS || {})[key] || {};
    return String(row.canonicalLocationId || row.aliasOf || row.mergedInto || key).toLowerCase();
  }

  function getStaticLocation(id = "") {
    const key = canonicalStaticLocationId(id);
    return (window.SHOUTOUT_CLUB_LOCATIONS || {})[key] || (window.SHOUTOUT_CLUB_LOCATIONS || {})[id] || { locationName: key, brand: key, genres: [], activityDates: [] };
  }

  async function resolveAdminLocationId(id = "") {
    let key = canonicalStaticLocationId(id);
    try {
      const alias = await db.collection("clubLocationAliases").doc(key).get();
      if (alias.exists && alias.data()?.canonicalLocationId) {
        key = String(alias.data().canonicalLocationId).toLowerCase();
      }
    } catch (e) {}
    try {
      const doc = await db.collection("clubLocations").doc(key).get();
      if (doc.exists) {
        const data = doc.data() || {};
        if (data.canonicalLocationId || data.aliasOf || data.mergedInto) {
          key = String(data.canonicalLocationId || data.aliasOf || data.mergedInto).toLowerCase();
        }
      }
    } catch (e) {}
    return canonicalStaticLocationId(key);
  }

  function refreshLocationShell() {
    loc = getStaticLocation(locationId);
    setText("clubName", loc.locationName || locationId);
    const displayLink = byId("displayLink");
    if (displayLink) displayLink.href = `./display.html?location=${locationId}`;
    const liveFrame = byId("liveFrame");
    if (liveFrame) liveFrame.src = `./display.html?location=${locationId}`;
    const publicLink = byId("clubPublicProfileLink");
    if (publicLink) publicLink.href = `./club-profile.html?location=${encodeURIComponent(locationId)}&v=29.04`;
  }

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  function actionFeedback(messages, action) {
    return window.FLOQRActionFeedback?.run ? window.FLOQRActionFeedback.run(messages, action) : action();
  }

  function publicProfileUrl() {
    return new URL(`./club-profile.html?location=${encodeURIComponent(locationId)}&v=29.04`, window.location.href).toString();
  }

  function parsePeopleLines(value, fallbackRole) {
    return String(value || "").split(/\r?\n/).map(line => {
      const [name, role, bio, photoUrl, instagram] = line.split("|").map(item => String(item || "").trim());
      return {name, role:role || fallbackRole, bio, photoUrl, instagram};
    }).filter(item => item.name);
  }

  function peopleLines(rows = []) {
    return (Array.isArray(rows) ? rows : []).map(item => typeof item === "string"
      ? item
      : [item.name || item.displayName, item.role || item.title, item.bio || item.description, item.photoUrl || item.imageUrl, item.instagram || item.instagramHandle].map(value => String(value || "").trim()).join(" | ")
    ).join("\n");
  }

  function publicSectionSettings() {
    return Array.from(document.querySelectorAll("[data-club-section]")).reduce((result, input) => {
      result[input.dataset.clubSection] = !!input.checked;
      return result;
    }, {});
  }

  function setInputIfMissing(id, value) {
    const el = byId(id);
    const clean = String(value || "").trim();
    if (el && clean && !String(el.value || "").trim()) el.value = clean;
  }

  function applyProfileImportDraftToForm(draft = {}, source = {}) {
    const profile = draft.publicProfile || {};
    const socials = profile.socialMediaHandles || {};
    setInputIfMissing("clubProfileAddress", profile.address);
    setInputIfMissing("clubProfileWebsite", profile.officialWebsite || profile.website);
    setInputIfMissing("clubProfileEmail", profile.email);
    setInputIfMissing("clubProfileTelephone", profile.telephone || profile.phone);
    setInputIfMissing("clubProfileInstagram", socials.instagram);
    setInputIfMissing("clubProfileX", socials.x || socials.twitter);
    setInputIfMissing("clubProfileTiktok", socials.tiktok);
    setInputIfMissing("clubProfileFacebook", socials.facebook);
    const report = byId("clubPublicProfileReport");
    if (report) {
      report.innerHTML += `<div class="queue-item">
        <strong>AI crawler profile import loaded</strong>
        <p>Review the public-source values, then click Save Public Profile if they are correct. Existing filled fields were not overwritten.</p>
        ${simpleRows([
          ["Draft", source.id || profileImportDraftId],
          ["Source", source.sourceName || profile.sourceName || "AI crawler public source"],
          ["Source URL", source.sourceUrl || profile.sourceUrl || "-"],
          ["Import mode", "Missing fields only"]
        ])}
      </div>`;
    }
    setText("adminStatus", "AI crawler profile import loaded. Review values and click Save Public Profile to apply.");
  }

  async function loadProfileImportDraft() {
    if (!profileImportDraftId) return;
    try {
      const snap = await db.collection("aiDiscoveryQueue").doc(profileImportDraftId).get();
      if (!snap.exists) {
        setText("adminStatus", "AI crawler profile import link was not found or is no longer available.");
        return;
      }
      const row = {id:snap.id, ...snap.data()};
      const draft = row.profileImport || {};
      if (draft.targetCollection && draft.targetCollection !== "clubLocations") {
        setText("adminStatus", "AI crawler profile import is not for a club profile.");
        return;
      }
      if (draft.targetId && draft.targetId !== locationId) {
        setText("adminStatus", `AI crawler profile import is for ${draft.targetId}, but this page is ${locationId}.`);
        return;
      }
      applyProfileImportDraftToForm(draft, row);
    } catch (error) {
      setText("adminStatus", `AI crawler profile import failed to load: ${error?.message || error}`);
    }
  }

  async function loadClubPublicProfile() {
    try {
      const snap = await db.collection("clubLocations").doc(locationId).get();
      publicClubProfile = snap.exists ? {id:snap.id, ...loc, ...snap.data()} : {...loc};
    } catch(e) {
      publicClubProfile = {...loc};
    }
    const socials = publicClubProfile.socialMediaHandles || publicClubProfile.socialHandles || {};
    if (byId("clubProfileAddress")) byId("clubProfileAddress").value = publicClubProfile.address || "";
    if (byId("clubProfileLogoUrl")) byId("clubProfileLogoUrl").value = publicClubProfile.logoUrl || publicClubProfile.clubLogoUrl || "";
    if (byId("clubProfileTagline")) byId("clubProfileTagline").value = publicClubProfile.tagline || publicClubProfile.publicTagline || "";
    if (byId("clubProfileDescription")) byId("clubProfileDescription").value = publicClubProfile.description || publicClubProfile.publicDescription || publicClubProfile.about || "";
    if (byId("clubProfileWebsite")) byId("clubProfileWebsite").value = publicClubProfile.officialWebsite || publicClubProfile.website || "";
    if (byId("clubProfileEmail")) byId("clubProfileEmail").value = publicClubProfile.email || "";
    if (byId("clubProfileTelephone")) byId("clubProfileTelephone").value = publicClubProfile.telephone || publicClubProfile.phone || "";
    if (byId("clubProfileInstagram")) byId("clubProfileInstagram").value = socials.instagram || "";
    if (byId("clubProfileX")) byId("clubProfileX").value = socials.x || "";
    if (byId("clubProfileTiktok")) byId("clubProfileTiktok").value = socials.tiktok || "";
    if (byId("clubProfileFacebook")) byId("clubProfileFacebook").value = socials.facebook || "";
    if (byId("clubProfileGenres")) byId("clubProfileGenres").value = (publicClubProfile.genres || loc.genres || []).join(", ");
    if (byId("clubProfileHours")) byId("clubProfileHours").value = publicClubProfile.hours || publicClubProfile.operatingHours || "";
    if (byId("clubProfileAgePolicy")) byId("clubProfileAgePolicy").value = publicClubProfile.agePolicy || "";
    if (byId("clubProfileDressCode")) byId("clubProfileDressCode").value = publicClubProfile.dressCode || "";
    if (byId("clubProfileAmenities")) byId("clubProfileAmenities").value = (publicClubProfile.amenities || []).join(", ");
    if (byId("clubProfileServices")) byId("clubProfileServices").value = (publicClubProfile.publicServices || publicClubProfile.services || []).join(", ");
    if (byId("clubProfileFeaturedDjs")) byId("clubProfileFeaturedDjs").value = peopleLines(publicClubProfile.featuredDjs);
    if (byId("clubProfileFeaturedStaff")) byId("clubProfileFeaturedStaff").value = peopleLines(publicClubProfile.featuredStaff || publicClubProfile.featuredServiceStaff);
    if (byId("clubProfilePromotionGroups")) byId("clubProfilePromotionGroups").value = peopleLines(publicClubProfile.promotionGroups || publicClubProfile.featuredPromotionGroups);
    if (byId("clubProfilePublished")) byId("clubProfilePublished").checked = publicClubProfile.publicProfilePublished !== false;
    const sectionSettings = publicClubProfile.publicProfileSections || {};
    document.querySelectorAll("[data-club-section]").forEach(input => {
      input.checked = sectionSettings[input.dataset.clubSection] === undefined ? true : sectionSettings[input.dataset.clubSection] !== false;
    });
    if (byId("clubPublicProfileReport")) {
      byId("clubPublicProfileReport").innerHTML = simpleRows([
        ["Search visibility", publicClubProfile.visibility || "public"],
        ["Ownership status", publicClubProfile.clubOwnershipStatus || "unclaimed"],
        ["Subscription required for edits", publicClubProfile.subscriptionRequiredForPublicProfileEdits === false ? "No" : "Yes"],
        ["AI index", "Public profile fields only"]
        ,["Public page", publicProfileUrl()]
      ]);
    }
    await loadProfileImportDraft();
  }

  async function saveClubPublicProfile() {
    return actionFeedback({
      starting:"Saving club public profile…",
      wait:"FLOQR is publishing the venue profile and owner visibility choices.",
      success:"Club public profile saved",
      redirecting:"The public page and FLOQR search profile are updated.",
      returnTo:"Venue Command Center"
    }, async () => {
    const payload = {
      logoUrl:byId("clubProfileLogoUrl")?.value.trim() || "",
      tagline:byId("clubProfileTagline")?.value.trim() || "",
      description:byId("clubProfileDescription")?.value.trim() || "",
      address:byId("clubProfileAddress")?.value.trim() || "",
      officialWebsite:byId("clubProfileWebsite")?.value.trim() || "",
      email:byId("clubProfileEmail")?.value.trim() || "",
      telephone:byId("clubProfileTelephone")?.value.trim() || "",
      socialMediaHandles:{
        instagram:byId("clubProfileInstagram")?.value.trim() || "",
        x:byId("clubProfileX")?.value.trim() || "",
        tiktok:byId("clubProfileTiktok")?.value.trim() || "",
        facebook:byId("clubProfileFacebook")?.value.trim() || ""
      },
      genres: splitCSV(byId("clubProfileGenres")?.value || ""),
      hours:byId("clubProfileHours")?.value.trim() || "",
      agePolicy:byId("clubProfileAgePolicy")?.value.trim() || "",
      dressCode:byId("clubProfileDressCode")?.value.trim() || "",
      amenities:splitCSV(byId("clubProfileAmenities")?.value || ""),
      publicServices:splitCSV(byId("clubProfileServices")?.value || ""),
      featuredDjs:parsePeopleLines(byId("clubProfileFeaturedDjs")?.value || "", "DJ"),
      featuredStaff:parsePeopleLines(byId("clubProfileFeaturedStaff")?.value || "", "Service Team"),
      promotionGroups:parsePeopleLines(byId("clubProfilePromotionGroups")?.value || "", "Promotion Group"),
      publicProfileSections:publicSectionSettings(),
      publicProfilePublished:!!byId("clubProfilePublished")?.checked,
      visibility:"public",
      publicProfileType:"club",
      subscriptionRequiredForPublicProfileEdits:true,
      clubOwnershipStatus:publicClubProfile.clubOwnershipStatus || "unclaimed",
      publicSearchKeywords:[
        publicClubProfile.locationName || loc.locationName,
        publicClubProfile.brandName || loc.brandName,
        publicClubProfile.city || loc.city,
        publicClubProfile.country || loc.country,
        byId("clubProfileAddress")?.value.trim() || "",
        byId("clubProfileWebsite")?.value.trim() || ""
      ].concat(splitCSV(byId("clubProfileGenres")?.value || "")).filter(Boolean),
      updatedByUid:auth.currentUser?.uid || "",
      updatedByEmail:safeUser(auth.currentUser),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("clubLocations").doc(locationId).set(payload, {merge:true});
    publicClubProfile = {...publicClubProfile, ...payload};
    if (window.FLOQRAIIndex) {
      const indexRecord = window.FLOQRAIIndex.clubLocationIndexRecord(locationId, publicClubProfile);
      await window.FLOQRAIIndex.upsertAiIndex(db, `clubLocation_${locationId}`, indexRecord);
    }
    setText("adminStatus", "Club public profile saved.");
    await loadClubPublicProfile();
    });
  }

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
      url.searchParams.set("backgroundUrl", item.backgroundUrl || "");
      url.searchParams.set("backgroundColor", item.backgroundColor || "");
      url.searchParams.set("backgroundGradient", item.backgroundGradient || "");
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

  function splitCSV(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return String(value || "").split(/[,;|/]+/).map(x => x.trim()).filter(Boolean);
  }

  function cleanFileName(name = "") {
    return String(name || "media").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 80);
  }

  function mediaKind(file) {
    const type = String(file?.type || "");
    if (type.startsWith("video/")) return "video";
    return "image";
  }

  async function uploadClubLogo() {
    return actionFeedback({
      starting:"Uploading club logo…",
      wait:"FLOQR is saving the logo for the public club page.",
      success:"Club logo uploaded",
      redirecting:"The logo is now available on the public profile.",
      returnTo:"Club Public Profile"
    }, async () => {
      const file = byId("clubLogoFile")?.files?.[0];
      if (!storage) throw new Error("Firebase Storage SDK is not loaded.");
      if (!file || !String(file.type || "").startsWith("image/")) throw new Error("Choose an image file for the club logo.");
      const path = `clubMedia/${locationId}/logo/${Date.now()}-${cleanFileName(file.name)}`;
      const ref = storage.ref(path);
      await ref.put(file, {contentType:file.type || "image/png"});
      const url = await ref.getDownloadURL();
      await db.collection("clubLocations").doc(locationId).set({
        logoUrl:url,
        logoStoragePath:path,
        updatedByUid:auth.currentUser?.uid || "",
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      publicClubProfile.logoUrl = url;
      if (byId("clubProfileLogoUrl")) byId("clubProfileLogoUrl").value = url;
    });
  }

  async function uploadClubMedia(file, slotType) {
    if (!storage) throw new Error("Firebase Storage SDK is not loaded.");
    if (!file) throw new Error("Choose a media file first.");
    const kind = mediaKind(file);
    const path = `clubMedia/${locationId}/${slotType}/${Date.now()}-${cleanFileName(file.name)}`;
    const ref = storage.ref(path);
    await ref.put(file, {contentType:file.type || (kind === "video" ? "video/mp4" : "image/jpeg")});
    const url = await ref.getDownloadURL();
    const payload = {
      clubLocationId: locationId,
      locationName: publicClubProfile.locationName || loc.locationName || locationId,
      slotType,
      mediaType: kind,
      mediaUrl: url,
      mediaStoragePath: path,
      mediaFileName: file.name || "",
      title: byId("clubMediaTitle")?.value.trim() || "",
      relatedDjs: splitCSV(byId("clubMediaDjs")?.value || ""),
      relatedPromoters: splitCSV(byId("clubMediaPromoters")?.value || ""),
      maxVideoSeconds: kind === "video" ? 15 : null,
      uploadedByUid: auth.currentUser?.uid || "",
      uploadedByEmail: safeUser(auth.currentUser),
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const id = slotType === "main" ? `${locationId}_main` : `${locationId}_${Date.now()}`;
    await db.collection("clubMedia").doc(id).set(payload, {merge: slotType === "main"});
    await db.collection("clubLocations").doc(locationId).set({
      mainMediaUrl: slotType === "main" ? url : publicClubProfile.mainMediaUrl || "",
      mainMediaType: slotType === "main" ? kind : publicClubProfile.mainMediaType || "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    setText("adminStatus", slotType === "main" ? "Main venue media uploaded." : "Gallery media uploaded.");
    await loadClubMedia();
  }

  async function uploadMainMedia() {
    try {
      await uploadClubMedia(byId("clubMainMediaFile")?.files?.[0], "main");
    } catch (e) {
      setText("adminStatus", `Media upload failed: ${e.message || e}`);
    }
  }

  async function uploadGalleryMedia() {
    try {
      const file = byId("clubGalleryMediaFile")?.files?.[0];
      const kind = mediaKind(file);
      const existing = clubMedia.filter(x => x.slotType === "gallery" && x.mediaType === kind);
      if (kind === "image" && existing.length >= 5) throw new Error("This club already has 5 public gallery images.");
      if (kind === "video" && existing.length >= 5) throw new Error("This club already has 5 public marketing videos.");
      await uploadClubMedia(file, "gallery");
    } catch (e) {
      setText("adminStatus", `Gallery upload failed: ${e.message || e}`);
    }
  }

  function renderClubMedia() {
    const wrap = byId("clubMediaReport");
    if (!wrap) return;
    const main = clubMedia.find(x => x.slotType === "main");
    const images = clubMedia.filter(x => x.slotType === "gallery" && x.mediaType === "image");
    const videos = clubMedia.filter(x => x.slotType === "gallery" && x.mediaType === "video");
    wrap.innerHTML = `
      ${simpleRows([
        ["Main media", main ? `${main.mediaType} uploaded` : "Not uploaded"],
        ["Public images", `${images.length}/5`],
        ["Marketing videos", `${videos.length}/5`],
        ["Video policy", "15 seconds max; related DJs/promoters saved as pop-out datapoints"]
      ])}
      ${clubMedia.map(item => `<div class="queue-item">
        <strong>${esc(item.title || item.mediaFileName || item.slotType)}</strong>
        <p>${esc(item.slotType)} - ${esc(item.mediaType)}${item.maxVideoSeconds ? " - 15 sec max" : ""}</p>
        <small>DJs: ${esc((item.relatedDjs || []).join(", ") || "-")} | Promoters: ${esc((item.relatedPromoters || []).join(", ") || "-")}</small>
      </div>`).join("")}`;
  }

  async function loadClubMedia() {
    clubMedia = (await getCollectionSafe("clubMedia", 200)).filter(x => x.clubLocationId === locationId);
    renderClubMedia();
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

  function isClubWorkerOrAffiliate(profile = {}) {
    return approvedRoles(profile).some(role => (
      role === "Club Admin" ||
      role === "Promoter" ||
      role === "DJ" ||
      role === "Waiter / Waitress / Bottle Girl"
    ));
  }

  function promoterCompanyLabel(profile = {}) {
    return profile.promoterCompany || profile.promotionCompany || profile.companyName || profile.company || (profile.independentPromoter ? "Independent promoter" : "");
  }

  function profileLocationText(profile = {}) {
    return [
      profile.clubLocationId,
      profile.pendingClubLocationId,
      profile.requestedClubLocationId,
      ...(Array.isArray(profile.clubLocationIds) ? profile.clubLocationIds : []),
      ...(Array.isArray(profile.approvedLocations) ? profile.approvedLocations : []),
      ...(Array.isArray(profile.affiliatedClubLocationIds) ? profile.affiliatedClubLocationIds : []),
      ...(Array.isArray(profile.requestedClubLocationIds) ? profile.requestedClubLocationIds : [])
    ].filter(Boolean).join(" ");
  }

  function hasPendingWorkerRequest(profile = {}) {
    const requested = [
      profile.pendingClubLocationId,
      profile.requestedClubLocationId,
      ...(Array.isArray(profile.requestedClubLocationIds) ? profile.requestedClubLocationIds : [])
    ].filter(Boolean);
    const nested = Array.isArray(profile.clubJoinRequests)
      ? profile.clubJoinRequests.some(item => item?.clubLocationId === locationId && String(item?.status || "pending").toLowerCase() === "pending")
      : false;
    return requested.includes(locationId) || nested;
  }

  function employeeSearchText(profile = {}) {
    return [
      profile.displayName, profile.fullName, profile.username, profile.email, profile.city, profile.country,
      promoterCompanyLabel(profile), approvedRoles(profile).join(" "), profileLocationText(profile)
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

  async function electClubRole() {
    const query = byId("roleElectionSearch")?.value || "";
    const role = byId("roleElectionRole")?.value || "Club Admin";
    const match = adminUsers.find(profile => contextualTextMatch(query, [
      profile.displayName, profile.fullName, profile.username, profile.email
    ].join(" ")));
    if (!match || !(match.uid || match.id)) {
      setText("adminStatus", "No patron matched the role election search. The person must be a patron first.");
      return;
    }
    const uid = match.uid || match.id;
    const payload = {
      clubLocationId: locationId,
      clubLocationName: loc.locationName || locationId,
      workerUid: uid,
      workerEmail: match.email || "",
      workerName: match.displayName || match.fullName || match.username || match.email || "Club worker",
      workerUsername: match.username || "",
      workerRoles: firebase.firestore.FieldValue.arrayUnion(role),
      roleElectionType: role,
      promoterCompany: byId("roleElectionCompany")?.value.trim() || "",
      independentPromoter: !!byId("roleElectionIndependentPromoter")?.checked,
      electedByUid: auth.currentUser?.uid || "",
      electedByEmail: safeUser(auth.currentUser),
      status: "elected",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("clubEmployeeDesignations").doc(designationId(uid)).set(payload, {merge:true});
    try {
      await db.collection("users").doc(uid).set({
        approvedRoles: firebase.firestore.FieldValue.arrayUnion(role),
        approvedLocations: firebase.firestore.FieldValue.arrayUnion(locationId),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    } catch (e) {
      console.warn("Role election saved, but user profile mirror was not updated:", e.message);
    }
    setText("adminStatus", `${payload.workerName} elected as ${role} for this club.`);
    await loadEmployeeDesignations();
  }

  function renderEmployeeDesignations() {
    const candidateWrap = byId("employeeCandidates");
    const csrWrap = byId("csrList");
    if (!candidateWrap || !csrWrap) return;
    const query = byId("employeeSearch")?.value || "";
    const workers = adminUsers
      .filter(isClubWorkerOrAffiliate)
      .filter(profile => contextualTextMatch(query, employeeSearchText(profile)))
      .slice(0, 40);
    candidateWrap.innerHTML = workers.length ? workers.map(profile => {
      const uid = profile.uid || profile.id;
      const checked = isDesignatedCSR(uid);
      const roles = approvedRoles(profile);
      const canBeCSR = isHospitalityWorker(profile);
      const company = promoterCompanyLabel(profile);
      return `<div class="queue-item employee-row">
        <div>
          <strong>${esc(profile.displayName || profile.fullName || profile.username || profile.email || "Club worker")}</strong>
          <p>${esc(profile.username ? `@${profile.username}` : profile.email || "")}</p>
          <small>${esc(roles.join(", ") || "Approved worker")}${company ? ` - ${esc(company)}` : ""}</small>
        </div>
        ${canBeCSR ? `<button type="button" data-uid="${esc(uid)}" data-action="${checked ? "remove" : "add"}">${checked ? "Remove CSR" : "Designate CSR"}</button>` : `<span class="status-pill">${roles.includes("Promoter") ? "Promoter / affiliate" : roles[0] || "Worker"}</span>`}
      </div>`;
    }).join("") : "<p class='sub'>No approved workers or affiliates matched this search.</p>";
    candidateWrap.querySelectorAll("button[data-uid]").forEach(btn => {
      const profile = workers.find(x => (x.uid || x.id) === btn.dataset.uid);
      btn.addEventListener("click", () => setCSR(profile, btn.dataset.action === "add"));
    });

    const roleCounts = new Map();
    adminUsers.filter(isClubWorkerOrAffiliate).forEach(profile => {
      approvedRoles(profile).forEach(role => roleCounts.set(role, (roleCounts.get(role) || 0) + 1));
    });
    byId("workerSummaryReport").innerHTML = simpleRows([
      ["Club admins", roleCounts.get("Club Admin") || 0],
      ["DJs / visiting DJs", roleCounts.get("DJ") || 0],
      ["Promoters / companies", roleCounts.get("Promoter") || 0],
      ["Waiters / waitresses / bottle girls", roleCounts.get("Waiter / Waitress / Bottle Girl") || 0],
      ["Designated CSRs", adminDesignations.filter(x => x.isCSR !== false).length]
    ]);
    byId("workerRoleReport").innerHTML = workers.length ? workers.slice(0, 12).map(profile => {
      const company = promoterCompanyLabel(profile);
      return `<div class="queue-item">
        <strong>${esc(profile.displayName || profile.fullName || profile.username || profile.email || "Worker")}</strong>
        <p>${esc(approvedRoles(profile).join(", ") || "Role not labeled")}</p>
        ${company ? `<small>${esc(company)}</small>` : ""}
      </div>`;
    }).join("") : "<p class='sub'>Search or approve role members to populate role groups.</p>";

    const pending = adminUsers.filter(profile => isClubWorkerOrAffiliate(profile) && hasPendingWorkerRequest(profile));
    byId("pendingWorkerRequests").innerHTML = pending.length ? pending.map(profile => `<div class="queue-item">
      <strong>${esc(profile.displayName || profile.fullName || profile.username || profile.email || "Worker request")}</strong>
      <p>${esc(approvedRoles(profile).join(", ") || "Requested worker role")}</p>
      <small>${esc(profile.email || profile.username || "")}</small>
    </div>`).join("") : "<p class='sub'>No pending worker requests for this club location yet.</p>";

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

  function guestCampaignPayload() {
    return {
      clubLocationId: locationId,
      locationName: publicClubProfile.locationName || loc.locationName || locationId,
      campaignName: byId("guestCampaignName")?.value.trim() || "",
      eventType: byId("guestCampaignType")?.value || "Free Admission",
      eventDate: byId("guestCampaignDate")?.value || "",
      capacity: Number(byId("guestCampaignCapacity")?.value || 0),
      promoterName: byId("guestCampaignPromoter")?.value.trim() || "",
      actionUrl: byId("guestCampaignUrl")?.value.trim() || "",
      description: byId("guestCampaignDescription")?.value.trim() || "",
      status: "enabled",
      active: true,
      eligibleMembers: "floqr-patrons-only",
      createdByUid: auth.currentUser?.uid || "",
      createdByEmail: safeUser(auth.currentUser),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function createGuestCampaign() {
    try {
      const active = guestListCampaigns.filter(x => x.active !== false && x.status !== "archived");
      if (active.length >= 6) throw new Error("This club already has 6 active guest list campaigns. Disable or archive one first.");
      const payload = guestCampaignPayload();
      if (!payload.campaignName) throw new Error("Campaign name is required.");
      await db.collection("guestListCampaigns").add(payload);
      setText("adminStatus", "Guest list campaign created.");
      await loadGuestListCampaigns();
    } catch (e) {
      setText("adminStatus", `Guest list campaign failed: ${e.message || e}`);
    }
  }

  async function setGuestCampaignState(id, status) {
    const active = status === "enabled";
    await db.collection("guestListCampaigns").doc(id).set({
      status,
      active,
      archived: status === "archived",
      updatedByUid: auth.currentUser?.uid || "",
      updatedByEmail: safeUser(auth.currentUser),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    setText("adminStatus", `Guest list campaign ${status}.`);
    await loadGuestListCampaigns();
  }

  function renderGuestListCampaigns() {
    const wrap = byId("guestCampaignReport");
    if (!wrap) return;
    const active = guestListCampaigns.filter(x => x.status !== "archived");
    wrap.innerHTML = `
      ${simpleRows([
        ["Active / disabled campaigns", `${active.length}/6`],
        ["Archived reusable campaigns", guestListCampaigns.filter(x => x.status === "archived").length],
        ["Patron eligibility", "Only FLOQR Patrons can join"]
      ])}
      ${guestListCampaigns.map(item => `<div class="queue-item">
        <div class="message-envelope-head">
          <strong>${esc(item.campaignName || "Guest list campaign")}</strong>
          <span>${esc(item.status || "enabled")}</span>
        </div>
        <p>${esc(item.eventType || "")}${item.eventDate ? ` - ${esc(item.eventDate)}` : ""}</p>
        <small>${esc(item.description || "")}</small>
        <div class="queue-actions">
          <button type="button" data-id="${esc(item.id)}" data-status="enabled">Enable</button>
          <button type="button" data-id="${esc(item.id)}" data-status="disabled">Disable</button>
          <button type="button" data-id="${esc(item.id)}" data-status="archived">Archive</button>
        </div>
      </div>`).join("")}`;
    wrap.querySelectorAll("button[data-id][data-status]").forEach(btn => {
      btn.addEventListener("click", () => setGuestCampaignState(btn.dataset.id, btn.dataset.status));
    });
  }

  async function loadGuestListCampaigns() {
    guestListCampaigns = (await getCollectionSafe("guestListCampaigns", 300))
      .filter(x => x.clubLocationId === locationId)
      .sort((a,b) => String(b.createdAt?.seconds || "").localeCompare(String(a.createdAt?.seconds || "")));
    renderGuestListCampaigns();
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
      originalMediaStoragePath: item.originalMediaStoragePath || "",
      enhancedMediaStoragePath: item.enhancedMediaStoragePath || "",
      originalMediaUrl: item.originalMediaUploaded === false ? "" : (item.originalMediaUrl || item.mediaUrl || ""),
      enhancedMediaUrl: item.enhancedMediaUrl || "",
      trimmedMediaUrl: item.trimmedMediaUrl || "",
      selectedMediaVersion: item.selectedMediaVersion || "original",
      aiEnhancementApplied: !!item.aiEnhancementApplied,
      aiEnhancementType: item.aiEnhancementType || "none",
      aiEnhancementPrompt: item.aiEnhancementPrompt || "",
      aiEnhancementProvider: item.aiEnhancementProvider || "",
      aiEnhancementModel: item.aiEnhancementModel || "",
      originalDuration: item.originalDuration || null,
      trimmedDuration: item.trimmedDuration || null,
      trimStart: item.trimStart || null,
      trimEnd: item.trimEnd || null,
      trimProcessingMode: item.trimProcessingMode || "",
      trimWarning: item.trimWarning || "",
      originalMediaUploaded: item.originalMediaUploaded !== false,
      aiMediaSafetyStatus: item.aiMediaSafetyStatus || "notChecked",
      aiMediaSafetyNotes: item.aiMediaSafetyNotes || "",
      mediaUploadedAt: item.mediaUploadedAt || null,
      templateVariantId: item.templateVariantId || "",
      templateVariantName: item.templateVariantName || "",
      lockedBaseTemplateId: item.lockedBaseTemplateId || "",
      backgroundType: item.backgroundType || "",
      backgroundUrl: item.backgroundUrl || "",
      backgroundColor: item.backgroundColor || "",
      backgroundGradient: item.backgroundGradient || "",
      backgroundStoragePath: item.backgroundStoragePath || "",
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

  async function resetDisplayToClubDefault() {
    const user = auth.currentUser;
    if (!user) {
      setText("adminStatus", "Please sign in first.");
      return;
    }
    const main = loc.defaultMain || `USE SHOUT OUT @ ${loc.locationName || locationId}`;
    const payload = {
      location: locationId,
      clubLocationId: locationId,
      locationName: loc.locationName || locationId,
      brandName: loc.brandName || loc.locationName || locationId,
      template: (loc.templates || [])[0] || "neon",
      templateName: "Club Default",
      mainText: main,
      subText: loc.defaultSub || "",
      mediaUrl: "",
      mediaType: "",
      mediaFileName: "",
      mediaStoragePath: "",
      status: "default",
      source: "clubDefaultReset",
      resetByUid: user.uid || "",
      resetByEmail: safeUser(user),
      resetAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("liveContent").doc(locationId).set(payload, {merge:false});
    try {
      await db.collection("shoutoutAudit").add({
        action:"reset-display-to-club-default",
        clubLocationId:locationId,
        actorUid:user.uid || "",
        actorEmail:safeUser(user),
        mainText:main,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) {}
    setText("adminStatus", `Display reset to club default: ${main}`);
    refreshLocationShell();
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

    const venueProfile = publicClubProfile || loc;
    byId("venueSummary").innerHTML = simpleRows([
      ["Location", venueProfile.locationName || loc.locationName || locationId],
      ["City", loc.city || "—"],
      ["Region", loc.region || "—"],
      ["Country", loc.country || "—"],
      ["Genres", (loc.genres || []).join(", ") || "—"],
      ["Activity", (loc.activityDates || []).slice(0,3).join(" | ") || "—"]
    ]);

    byId("venueSummary").innerHTML = simpleRows([
      ["Location", venueProfile.locationName || loc.locationName || locationId],
      ["City", venueProfile.city || loc.city || "-"],
      ["Region", venueProfile.region || loc.region || "-"],
      ["Country", venueProfile.country || loc.country || "-"],
      ["Address", venueProfile.address || "-"],
      ["Official website", venueProfile.officialWebsite || venueProfile.website || "-"],
      ["Email", venueProfile.email || "-"],
      ["Telephone", venueProfile.telephone || venueProfile.phone || "-"],
      ["Genres", (venueProfile.genres || loc.genres || []).join(", ") || "-"],
      ["Activity", (venueProfile.activityDates || loc.activityDates || []).slice(0,3).join(" | ") || "-"]
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
        ["Pending requests", clubGuestLists.filter(x => (x.status || "pending") === "pending").length.toLocaleString()],
        ["Enabled campaigns", guestListCampaigns.filter(x => x.status === "enabled").length.toLocaleString()]
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

  document.addEventListener("DOMContentLoaded", async () => {
    locationId = await resolveAdminLocationId(locationId);
    setupTabs();
    setText("adminStatus", "Admin app loaded. Sign in to continue.");
    refreshLocationShell();

    bind("adminGoogleLoginBtn", loginGoogle);
    bind("adminFacebookLoginBtn", loginFacebook);
    bind("adminMicrosoftLoginBtn", loginMicrosoft);
    bind("adminLogoutBtn", logout);
    bind("saveClubPublicProfileBtn", saveClubPublicProfile);
    bind("copyClubPublicProfileLinkBtn", async () => {
      await navigator.clipboard?.writeText(publicProfileUrl());
      window.FLOQRActionFeedback?.show("Club page link copied", "The patron-facing FLOQR club profile URL is ready to share.", {status:"success"});
      window.FLOQRActionFeedback?.hide(2200);
    });
    bind("resetDisplayDefaultBtn", resetDisplayToClubDefault);
    bind("uploadClubMainMediaBtn", uploadMainMedia);
    bind("uploadClubLogoBtn", uploadClubLogo);
    bind("uploadClubGalleryMediaBtn", uploadGalleryMedia);
    bind("electClubRoleBtn", electClubRole);
    bind("createGuestCampaignBtn", createGuestCampaign);
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
      loadClubPublicProfile().then(loadReports);
      loadEmployeeDesignations();
      loadClubMedia();
      loadGuestListCampaigns().then(loadReports);
    });
  });
})();
