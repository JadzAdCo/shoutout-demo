/* admin-app.js v29.08.2 - Venue Command Center, trusted Stripe onboarding, commerce, guest-list distribution, staffing, and REP */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const safeUser = user => (user?.email || user?.phoneNumber || "unknown").toLowerCase();
  const money = value => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD", maximumFractionDigits:0}).format(value || 0);
  const CURRENT_VERSION = "29.09.8";

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
  let workerAssociationRequests = [];
  let clubMedia = [];
  let clubMediaEditTargetId = "";
  let clubMediaPreviewFile = null;
  let clubMediaPreviewObjectUrl = "";
  let clubTemplates = {};
  let clubTemplateVariants = [];
  let guestListCampaigns = [];
  let adminMfaResolver = null;
  let adminMfaVerificationId = "";
  let adminMfaEnrollmentSession = null;
  let adminMfaRecaptcha = null;
  let clubConnectRefreshHandled = false;

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
    if (displayLink) displayLink.href = window.FLOQRNav?.adminLink("./display.html", { location: locationId }) || `./display.html?location=${locationId}&from=admin`;
    const liveFrame = byId("liveFrame");
    if (liveFrame) liveFrame.src = `./display.html?location=${locationId}`;
    const publicLink = byId("clubPublicProfileLink");
    if (publicLink) publicLink.href = window.FLOQRNav?.adminLink("./club-profile.html", { location: locationId }) || `./club-profile.html?location=${encodeURIComponent(locationId)}&v=29.09.8&from=admin`;
    const roleProfilesLink = byId("adminRoleProfilesLink");
    if (roleProfilesLink) roleProfilesLink.href = window.FLOQRNav?.adminLink("./role-profiles.html") || `./role-profiles.html?v=29.09.8&from=admin&location=${encodeURIComponent(locationId)}`;
  }

  async function enforceVenueFeatureGates() {
    const g = window.FLOQRFeatureGates;
    if (!g) return;
    const row = await g.loadVenueRecord(db, locationId);
    const advertising = byId("panelAdvertising") || document.querySelector('[data-panel="panelAdvertising"]');
    const spotCard = byId("spotAdCampaignCard");
    const marketingCard = byId("marketingCampaignCard");
    const shoutoutTab = document.querySelector('[data-panel="panelQueue"]');
    if (!g.entityIsAppEnabled(row)) {
      setText("adminStatus", `${row.locationName || locationId} is disabled or offboarded. Club Admin features are locked.`);
      byId("adminPanel")?.querySelectorAll("button, input, select, textarea").forEach(el => {
        el.disabled = true;
      });
      return;
    }
    const uberOk = g.venueMayUse("uberAds", row);
    const windowOk = g.venueMayUse("windowAds", row);
    const shoutOk = g.venueMayUse("shoutOut", row);
    const bartrOk = g.venueMayUse("bartrStores", row);
    if (spotCard) spotCard.classList.toggle("hidden", !uberOk);
    if (marketingCard) marketingCard.classList.toggle("hidden", !(uberOk || windowOk));
    if (advertising && advertising.tagName === "BUTTON") advertising.classList.toggle("hidden", !(uberOk || windowOk));
    if (shoutoutTab) shoutoutTab.classList.toggle("hidden", !shoutOk);
    document.querySelectorAll("[data-bartr-store-gate]").forEach(el => el.classList.toggle("hidden", !bartrOk));
  }

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  function actionFeedback(messages, action) {
    return window.FLOQRActionFeedback?.run ? window.FLOQRActionFeedback.run(messages, action) : action();
  }

  function publicProfileUrl() {
    return new URL(`./club-profile.html?location=${encodeURIComponent(locationId)}&v=29.09.8`, window.location.href).toString();
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
    setInputIfMissing("clubProfileStreetAddress", profile.streetAddress || profile.addressLine1 || profile.address);
    setInputIfMissing("clubProfileCity", profile.city);
    setInputIfMissing("clubProfileRegion", profile.stateRegion || profile.region || profile.state);
    setInputIfMissing("clubProfilePostalCode", profile.postalCode || profile.zipCode);
    setInputIfMissing("clubProfileCountry", profile.country);
    setInputIfMissing("clubProfileWebsite", profile.officialWebsite || profile.website);
    setInputIfMissing("clubProfileEmail", profile.email);
    setInputIfMissing("clubProfileTelephone", profile.telephone || profile.phone);
    setInputIfMissing("clubProfileInstagram", socials.instagram);
    setInputIfMissing("clubProfileFloqrHandle", socials.floqrHandle || profile.floqrHandle);
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
    if (byId("clubProfileStreetAddress")) byId("clubProfileStreetAddress").value = publicClubProfile.streetAddress || publicClubProfile.addressLine1 || (publicClubProfile.fullAddress ? "" : publicClubProfile.address) || "";
    if (byId("clubProfileCity")) byId("clubProfileCity").value = publicClubProfile.city || loc.city || "";
    if (byId("clubProfileRegion")) byId("clubProfileRegion").value = publicClubProfile.stateRegion || publicClubProfile.region || loc.region || "";
    if (byId("clubProfilePostalCode")) byId("clubProfilePostalCode").value = publicClubProfile.postalCode || publicClubProfile.zipCode || "";
    if (byId("clubProfileCountry")) byId("clubProfileCountry").value = publicClubProfile.country || loc.country || "";
    if (byId("clubProfileLogoUrl")) byId("clubProfileLogoUrl").value = publicClubProfile.logoUrl || publicClubProfile.clubLogoUrl || "";
    if (byId("clubProfileTagline")) byId("clubProfileTagline").value = publicClubProfile.tagline || publicClubProfile.publicTagline || "";
    if (byId("clubProfileDescription")) byId("clubProfileDescription").value = publicClubProfile.description || publicClubProfile.publicDescription || publicClubProfile.about || "";
    if (byId("clubProfileWebsite")) byId("clubProfileWebsite").value = publicClubProfile.officialWebsite || publicClubProfile.website || "";
    if (byId("clubProfileEmail")) byId("clubProfileEmail").value = publicClubProfile.email || "";
    if (byId("clubProfileTelephone")) byId("clubProfileTelephone").value = publicClubProfile.telephone || publicClubProfile.phone || "";
    if (byId("clubProfileInstagram")) byId("clubProfileInstagram").value = socials.instagram || "";
    if (byId("clubProfileFloqrHandle")) byId("clubProfileFloqrHandle").value = socials.floqrHandle || publicClubProfile.floqrHandle || "";
    if (byId("clubProfileX")) byId("clubProfileX").value = socials.x || "";
    if (byId("clubProfileTiktok")) byId("clubProfileTiktok").value = socials.tiktok || "";
    if (byId("clubProfileFacebook")) byId("clubProfileFacebook").value = socials.facebook || "";
    if (byId("clubProfileGenres")) byId("clubProfileGenres").value = (publicClubProfile.genres || loc.genres || []).join(", ");
    if (byId("clubProfileHours")) byId("clubProfileHours").value = publicClubProfile.hours || publicClubProfile.operatingHours || "";
    if (byId("clubProfileAgePolicy")) byId("clubProfileAgePolicy").value = publicClubProfile.agePolicy || "";
    if (byId("clubProfileDressCode")) byId("clubProfileDressCode").value = publicClubProfile.dressCode || "";
    if (byId("clubProfileAmenities")) byId("clubProfileAmenities").value = (publicClubProfile.amenities || []).join(", ");
    if (byId("clubProfileServices")) byId("clubProfileServices").value = (publicClubProfile.publicServices || publicClubProfile.services || []).join(", ");
    if (byId("clubCommerceEnabled")) byId("clubCommerceEnabled").checked = !!publicClubProfile.commerceEnabled;
    if (byId("clubCommerceStoreName")) byId("clubCommerceStoreName").value = publicClubProfile.commerceStoreName || `${publicClubProfile.locationName || loc.locationName || "Club"} Shop`;
    if (byId("clubProfileFeaturedDjs")) byId("clubProfileFeaturedDjs").value = peopleLines(publicClubProfile.featuredDjs);
    if (byId("clubProfileFeaturedStaff")) byId("clubProfileFeaturedStaff").value = peopleLines(publicClubProfile.featuredStaff || publicClubProfile.featuredServiceStaff);
    if (byId("clubProfilePromotionGroups")) byId("clubProfilePromotionGroups").value = peopleLines(publicClubProfile.promotionGroups || publicClubProfile.featuredPromotionGroups);
    if (byId("clubProfilePublished")) byId("clubProfilePublished").checked = publicClubProfile.publicProfilePublished !== false;
    const sectionSettings = publicClubProfile.publicProfileSections || {};
    document.querySelectorAll("[data-club-section]").forEach(input => {
      input.checked = sectionSettings[input.dataset.clubSection] === undefined ? true : sectionSettings[input.dataset.clubSection] !== false;
    });
    const displayFormats = new Set(publicClubProfile.displayScreenFormatIds || ["led-96x48"]);
    document.querySelectorAll("[data-club-display-format]").forEach(input => {
      input.checked = displayFormats.has(input.dataset.clubDisplayFormat);
    });
    if (byId("clubPrimaryDisplayFormat")) byId("clubPrimaryDisplayFormat").value = publicClubProfile.primaryDisplayScreenFormatId || [...displayFormats][0] || "led-96x48";
    if (byId("patronTemplateBackgroundEditingEnabled")) byId("patronTemplateBackgroundEditingEnabled").checked = publicClubProfile.patronTemplateBackgroundEditingEnabled !== false;
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

  function connectStatusMessage(result = {}) {
    if (result.transfersReady) return `Club Stripe ready for club-billed products (${result.livemode ? "live mode" : "test mode"}). Patron ShoutOuts still charge FloqR.`;
    if (!result.connected || result.capabilityStatus === "not-started") return "Club Stripe onboarding has not started (optional — only for club subscription / Commerce).";
    const due = Number(result.requirementsDue || 0);
    return `Club Stripe transfer capability: ${result.capabilityStatus || "pending"}.${due ? ` ${due} requirement${due === 1 ? "" : "s"} need attention.` : ""} Not required for patron ShoutOuts.`;
  }

  async function refreshClubConnectStatus() {
    const statusEl = byId("clubStripeConnectStatus");
    const button = byId("clubStripeConnectBtn");
    try {
      if (!window.FLOQRPayments?.getConnectStatus) throw new Error("Stripe Connect controls are not loaded.");
      const result = await window.FLOQRPayments.getConnectStatus({
        entityType:"club",
        entityId:locationId,
        status:value => { if (statusEl) statusEl.textContent = value; }
      });
      if (statusEl) statusEl.textContent = connectStatusMessage(result);
    if (button) button.textContent = result.connected ? "Continue / manage club Stripe" : "Start club Stripe onboarding";
      return result;
    } catch (error) {
      if (statusEl) statusEl.textContent = error?.message || String(error);
      return null;
    }
  }

  async function startClubConnectOnboarding() {
    const statusEl = byId("clubStripeConnectStatus");
    try {
      await window.FLOQRPayments.startConnectOnboarding({
        entityType:"club",
        entityId:locationId,
        status:value => { if (statusEl) statusEl.textContent = value; }
      });
    } catch (error) {
      if (statusEl) statusEl.textContent = error?.message || String(error);
    }
  }

  async function handleClubConnectReturn() {
    const result = await refreshClubConnectStatus();
    if (qs("connect") === "refresh" && !clubConnectRefreshHandled) {
      clubConnectRefreshHandled = true;
      await startClubConnectOnboarding();
    }
    return result;
  }

  async function saveClubPublicProfile() {
    return actionFeedback({
      starting:"Saving club public profile…",
      wait:"FLOQR is publishing the venue profile and owner visibility choices.",
      success:"Club public profile saved",
      redirecting:"The public page and FLOQR search profile are updated.",
      returnTo:"Venue Command Center"
    }, async () => {
    const displayScreenFormatIds = Array.from(document.querySelectorAll("[data-club-display-format]:checked")).map(input => input.dataset.clubDisplayFormat);
    if (!displayScreenFormatIds.length) throw new Error("Select at least one FLOQR display screen format.");
    const primaryDisplayScreenFormatId = displayScreenFormatIds.includes(byId("clubPrimaryDisplayFormat")?.value)
      ? byId("clubPrimaryDisplayFormat").value
      : displayScreenFormatIds[0];
    const streetAddress = byId("clubProfileStreetAddress")?.value.trim() || "";
    const city = byId("clubProfileCity")?.value.trim() || "";
    const stateRegion = byId("clubProfileRegion")?.value.trim() || "";
    const postalCode = byId("clubProfilePostalCode")?.value.trim() || "";
    const country = byId("clubProfileCountry")?.value.trim() || "";
    if (!streetAddress || !city || !stateRegion || !country) throw new Error("Street address, city, state/region, and country are required.");
    const addressRecord = {streetAddress, city, stateRegion, postalCode, country};
    const fullAddress = window.FLOQRAddress?.fullAddress(addressRecord) || [streetAddress, city, stateRegion, postalCode, country].filter(Boolean).join(", ");
    const locationLabel = window.FLOQRAddress?.publicLocation(addressRecord) || [city, country].filter(Boolean).join(", ");
    const floqrHandle = window.FLOQRIdentity?.normalizeFloqrHandle?.(byId("clubProfileFloqrHandle")?.value || "") || "";
    const payload = {
      logoUrl:byId("clubProfileLogoUrl")?.value.trim() || "",
      tagline:byId("clubProfileTagline")?.value.trim() || "",
      description:byId("clubProfileDescription")?.value.trim() || "",
      streetAddress,
      addressLine1:streetAddress,
      city,
      region:stateRegion,
      stateRegion,
      postalCode,
      country,
      fullAddress,
      address:fullAddress,
      locationLabel,
      officialWebsite:byId("clubProfileWebsite")?.value.trim() || "",
      email:byId("clubProfileEmail")?.value.trim() || "",
      telephone:byId("clubProfileTelephone")?.value.trim() || "",
      socialMediaHandles:{
        instagram:byId("clubProfileInstagram")?.value.trim() || "",
        floqrHandle,
        x:byId("clubProfileX")?.value.trim() || "",
        tiktok:byId("clubProfileTiktok")?.value.trim() || "",
        facebook:byId("clubProfileFacebook")?.value.trim() || ""
      },
      floqrHandle,
      genres: splitCSV(byId("clubProfileGenres")?.value || ""),
      hours:byId("clubProfileHours")?.value.trim() || "",
      agePolicy:byId("clubProfileAgePolicy")?.value.trim() || "",
      dressCode:byId("clubProfileDressCode")?.value.trim() || "",
      amenities:splitCSV(byId("clubProfileAmenities")?.value || ""),
      publicServices:splitCSV(byId("clubProfileServices")?.value || ""),
      commerceEnabled:!!byId("clubCommerceEnabled")?.checked,
      commerceStoreName:byId("clubCommerceStoreName")?.value.trim() || `${publicClubProfile.locationName || loc.locationName || "Club"} Shop`,
      featuredDjs:parsePeopleLines(byId("clubProfileFeaturedDjs")?.value || "", "DJ"),
      featuredStaff:parsePeopleLines(byId("clubProfileFeaturedStaff")?.value || "", "Service Team"),
      promotionGroups:parsePeopleLines(byId("clubProfilePromotionGroups")?.value || "", "Promotion Group"),
      displayScreenFormatIds,
      primaryDisplayScreenFormatId,
      patronTemplateBackgroundEditingEnabled:byId("patronTemplateBackgroundEditingEnabled")?.checked !== false,
      publicProfileSections:publicSectionSettings(),
      publicProfilePublished:!!byId("clubProfilePublished")?.checked,
      visibility:"public",
      publicProfileType:"club",
      subscriptionRequiredForPublicProfileEdits:true,
      clubOwnershipStatus:publicClubProfile.clubOwnershipStatus || "unclaimed",
      publicSearchKeywords:[
        publicClubProfile.locationName || loc.locationName,
        publicClubProfile.brandName || loc.brandName,
        city,
        stateRegion,
        country,
        fullAddress,
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

  function templateBackgroundSearchText(template = {}) {
    return [template.id, template.name, template.category, template.description, ...(template.tags || [])].join(" ").toLowerCase();
  }

  function renderClubTemplateBackgrounds() {
    const wrap = byId("clubTemplateBackgroundList");
    if (!wrap) return;
    const query = String(byId("clubTemplateBackgroundSearch")?.value || "").trim().toLowerCase();
    const formats = publicClubProfile.displayScreenFormatIds || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS || ["led-96x48"];
    const rows = Object.values(clubTemplates)
      .filter(template => String(template.status || "active") === "active")
      .filter(template => (template.screenFormatIds || formats).some(id => formats.includes(id)))
      .filter(template => !query || templateBackgroundSearchText(template).includes(query))
      .sort((a,b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
    wrap.innerHTML = rows.map(template => {
      const editable = template.backgroundEditable !== false;
      const count = clubTemplateVariants.filter(variant => variant.baseTemplateId === template.id && String(variant.status || "active") === "active").length;
      return `<article class="template ${esc(template.className || "neon")}">
        <div class="template-mini-preview"><strong>${esc(template.defaultMain || "SHOUTOUT")}</strong><span>${esc(template.defaultSub || template.category || "")}</span></div>
        <div class="name">${esc(template.name || template.id)}</div>
        <div class="tag">${editable ? "Editable background" : "Background locked by Master Admin"}</div>
        <div class="tag-row"><span>${esc(template.category || "Shared")}</span><span>${count} club background${count === 1 ? "" : "s"}</span></div>
        ${editable ? `<button type="button" data-club-template-customize="${esc(template.id)}">Customize for this club</button>` : '<button type="button" disabled>Use original design only</button>'}
      </article>`;
    }).join("") || '<p class="sub">No compatible templates matched.</p>';
    wrap.querySelectorAll("[data-club-template-customize]").forEach(button => button.addEventListener("click", () => openClubTemplateStudio(button.dataset.clubTemplateCustomize)));
  }

  function renderClubTemplateVariants() {
    const wrap = byId("clubTemplateVariantList");
    if (!wrap) return;
    const rows = clubTemplateVariants.filter(item => String(item.status || "active") === "active");
    wrap.innerHTML = rows.map(item => {
      const style = window.FLOQRStudio?.variantBackgroundStyle ? window.FLOQRStudio.variantBackgroundStyle(item) : "";
      return `<div class="queue-item club-template-variant-row">
        <div class="message-envelope-head"><strong>${esc(item.variantName || "Club Background")}</strong><span>${esc(item.baseTemplateName || item.baseTemplateId || "Template")}</span></div>
        <div class="club-template-variant-swatch" style="${esc(style)}"></div>
        <small>Club-only • created by ${esc(item.ownerDisplayName || "Club Admin")}</small>
        <div class="queue-actions"><button type="button" data-club-variant-deactivate="${esc(item.id)}">Deactivate</button></div>
      </div>`;
    }).join("") || '<p class="sub">No club-specific backgrounds have been saved yet.</p>';
    wrap.querySelectorAll("[data-club-variant-deactivate]").forEach(button => button.addEventListener("click", async () => {
      await db.collection("clubTemplateVariants").doc(button.dataset.clubVariantDeactivate).set({status:"deleted", updatedAt:firebase.firestore.FieldValue.serverTimestamp(), updatedByUid:auth.currentUser?.uid || ""}, {merge:true});
      setText("clubTemplateBackgroundStatus", "Club background deactivated.");
      await loadClubTemplateControls();
    }));
  }

  async function loadClubTemplateControls() {
    clubTemplates = Object.fromEntries(Object.entries(window.SHOUTOUT_TEMPLATES || {}).map(([id, data]) => [id, {id, ...data}]));
    try {
      const snap = await db.collection("templates").limit(500).get();
      snap.forEach(doc => { clubTemplates[doc.id] = {...clubTemplates[doc.id], id:doc.id, ...doc.data()}; });
    } catch (error) {}
    clubTemplateVariants = window.FLOQRStudio?.loadClubTemplateVariants
      ? await window.FLOQRStudio.loadClubTemplateVariants({db, clubLocationId:locationId})
      : [];
    if (byId("patronTemplateBackgroundEditingEnabled")) byId("patronTemplateBackgroundEditingEnabled").checked = publicClubProfile.patronTemplateBackgroundEditingEnabled !== false;
    renderClubTemplateBackgrounds();
    renderClubTemplateVariants();
  }

  async function openClubTemplateStudio(templateId) {
    const template = clubTemplates[templateId];
    if (!template || template.backgroundEditable === false) {
      setText("clubTemplateBackgroundStatus", "This template background is locked by Master Admin.");
      return;
    }
    if (!window.FLOQRStudio) {
      setText("clubTemplateBackgroundStatus", "The background editor did not load. Refresh the page and try again.");
      return;
    }
    await window.FLOQRStudio.openFloqrTemplateStudio({
      db,
      storage,
      currentUser:auth.currentUser,
      baseTemplateId:template.id,
      baseTemplate:template,
      variantScope:"club",
      clubLocationId:locationId,
      onSaved:async () => {
        setText("clubTemplateBackgroundStatus", `${template.name || template.id} club background saved.`);
        await loadClubTemplateControls();
      }
    });
  }

  async function saveClubTemplatePolicy() {
    const enabled = byId("patronTemplateBackgroundEditingEnabled")?.checked !== false;
    await db.collection("clubLocations").doc(locationId).set({
      patronTemplateBackgroundEditingEnabled:enabled,
      templateBackgroundPolicyUpdatedByUid:auth.currentUser?.uid || "",
      templateBackgroundPolicyUpdatedByEmail:safeUser(auth.currentUser),
      templateBackgroundPolicyUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    publicClubProfile.patronTemplateBackgroundEditingEnabled = enabled;
    setText("clubTemplatePolicyStatus", enabled
      ? "Patrons may customize backgrounds on templates marked editable."
      : "Patron background customization is disabled. Original and club-curated templates remain available.");
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

  function showAdminMfaPanel(message = "") {
    byId("adminLogin")?.classList.add("hidden");
    byId("adminPanel")?.classList.add("hidden");
    byId("adminMfaPanel")?.classList.remove("hidden");
    setText("adminMfaStatus", message || (adminMfaResolver ? "Send a code to your enrolled mobile phone." : "Enroll the Club Admin mobile phone to continue."));
  }

  function adminMfaVerifier() {
    if (adminMfaRecaptcha) return adminMfaRecaptcha;
    adminMfaRecaptcha = new firebase.auth.RecaptchaVerifier("admin-mfa-recaptcha", {size:"normal"});
    return adminMfaRecaptcha;
  }

  function handleAdminMfaRequired(error) {
    if (error?.code !== "auth/multi-factor-auth-required" || !error.resolver) return false;
    adminMfaResolver = error.resolver;
    adminMfaEnrollmentSession = null;
    showAdminMfaPanel("This Club Admin account requires its enrolled SMS second factor. Send the verification code to continue.");
    return true;
  }

  async function sendAdminMfaCode() {
    try {
      setText("adminMfaStatus", "Preparing SMS verification...");
      const provider = new firebase.auth.PhoneAuthProvider();
      if (adminMfaResolver) {
        const hint = adminMfaResolver.hints?.find(item => item.factorId === firebase.auth.PhoneMultiFactorGenerator.FACTOR_ID) || adminMfaResolver.hints?.[0];
        if (!hint) throw new Error("No enrolled mobile factor was found for this account.");
        adminMfaVerificationId = await provider.verifyPhoneNumber({multiFactorHint:hint, session:adminMfaResolver.session}, adminMfaVerifier());
      } else {
        const user = auth.currentUser;
        if (!user) throw new Error("Sign in with the Club Admin account first.");
        const phoneNumber = String(byId("adminMfaPhone")?.value || "").trim();
        if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) throw new Error("Enter the mobile number in international format, such as +12025550123.");
        adminMfaEnrollmentSession = await user.multiFactor.getSession();
        adminMfaVerificationId = await provider.verifyPhoneNumber({phoneNumber, session:adminMfaEnrollmentSession}, adminMfaVerifier());
      }
      setText("adminMfaStatus", "SMS code sent. Enter the six-digit code, then Verify and Continue.");
      byId("adminMfaCode")?.focus();
    } catch (error) {
      setText("adminMfaStatus", `${error.code || "mfa-error"}: ${error.message || error}`);
      adminMfaRecaptcha?.clear?.();
      adminMfaRecaptcha = null;
    }
  }

  async function verifyAdminMfaCode() {
    try {
      const code = String(byId("adminMfaCode")?.value || "").trim();
      if (!adminMfaVerificationId || !/^\d{6}$/.test(code)) throw new Error("Enter the six-digit SMS verification code.");
      const credential = firebase.auth.PhoneAuthProvider.credential(adminMfaVerificationId, code);
      const assertion = firebase.auth.PhoneMultiFactorGenerator.assertion(credential);
      if (adminMfaResolver) {
        await adminMfaResolver.resolveSignIn(assertion);
        adminMfaResolver = null;
      } else {
        await auth.currentUser.multiFactor.enroll(assertion, "Club Admin Mobile");
      }
      adminMfaVerificationId = "";
      byId("adminMfaPanel")?.classList.add("hidden");
      setText("adminStatus", "Club Admin mobile verification completed.");
      window.location.reload();
    } catch (error) {
      setText("adminMfaStatus", `${error.code || "mfa-error"}: ${error.message || error}`);
    }
  }

  async function signInWithPopupThenRedirect(provider, statusId, label) {
    try {
      setText(statusId, `Opening ${label} sign-in...`);
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (handleAdminMfaRequired(e)) return;
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
      url.searchParams.set("screenFormatId", item.screenFormatId || "");
      if (Array.isArray(item.teamMembers) && item.teamMembers.length) url.searchParams.set("teamMembers", JSON.stringify(item.teamMembers));
      if (item.stadiumMessage) url.searchParams.set("stadiumMessage", item.stadiumMessage);
    }
    return url.href;
  }

  async function loginGoogle() {
    try {
      setText("adminStatus", "Opening Google sign-in...");
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch(e) {
      if (handleAdminMfaRequired(e)) return;
      setText("adminStatus", `${e.code || "error"}: ${e.message}`);
    }
  }
  async function loginFacebook() {
    try {
      setText("adminStatus", "Opening Facebook sign-in...");
      await auth.signInWithPopup(new firebase.auth.FacebookAuthProvider());
    } catch(e) {
      if (handleAdminMfaRequired(e)) return;
      setText("adminStatus", `${e.code || "error"}: ${e.message}`);
    }
  }
  async function loginMicrosoft() {
    const p = buildMicrosoftProvider();
    await signInWithPopupThenRedirect(p, "adminStatus", "Microsoft");
  }
  async function logout() { await auth.signOut(); window.location.reload(); }

  async function hasClubAdminAccess(user) {
    if (!user) return false;
    const email = safeUser(user);
    if (MASTER_ADMIN_EMAILS.includes(email) || CLUB_ADMIN_EMAILS.includes(email)) return true;
    try {
      const locationSnap = await db.collection("clubLocations").doc(locationId).get();
      const locationData = locationSnap.exists ? locationSnap.data() || {} : {};
      if ((locationData.adminUids || []).includes(user.uid)) return true;
      if ((locationData.adminEmails || []).map(value => String(value).toLowerCase()).includes(email)) return true;
    } catch (error) {}
    try {
      const assignmentId = `${locationId}_${user.uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const assignment = await db.collection("clubAdminAssignments").doc(assignmentId).get();
      if (assignment.exists && String(assignment.data()?.status || "active") === "active") return true;
      const designation = await db.collection("clubEmployeeDesignations").doc(assignmentId).get();
      const permissions = designation.exists ? designation.data()?.rolePermissions || [] : [];
      return designation.exists && designation.data()?.status !== "rejected" && permissions.some(permission => ["manageGuestLists","postPublicContent","manageCommerce","customerSupport"].includes(permission));
    } catch (error) {
      return false;
    }
  }

  function setupTabs() {
    document.querySelectorAll(".admin-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach(x => x.classList.remove("active"));
        document.querySelectorAll(".admin-panel-section").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        byId(btn.dataset.panel)?.classList.add("active");
        if (btn.dataset.panel === "panelReconciliation") loadClubPaymentLedger();
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

  const CLUB_MEDIA_FILTERS = new Set(["none", "vibrant", "warm", "cool", "monochrome", "contrast"]);

  function safeClubMediaFilter(value) {
    const key = String(value || "none").toLowerCase();
    return CLUB_MEDIA_FILTERS.has(key) ? key : "none";
  }

  function clubMediaOrder(item = {}) {
    if (Number.isFinite(Number(item.galleryOrder))) return Number(item.galleryOrder);
    return Number(item.uploadedAt?.toMillis?.() || item.updatedAt?.toMillis?.() || 0);
  }

  function clubVideoTrimPayload(kind, originalDuration = null) {
    if (kind !== "video") return {trimStart:null, trimEnd:null, trimmedDuration:null, maxVideoSeconds:null};
    const trimStart = Math.max(0, Number(byId("clubMediaTrimStart")?.value || 0));
    const trimEnd = Math.max(0, Number(byId("clubMediaTrimEnd")?.value || 15));
    if (!(trimEnd > trimStart)) throw new Error("Video trim end must be greater than the trim start.");
    if (trimEnd - trimStart > 15.0001) throw new Error("A club video clip can be no longer than 15 seconds. Shorten the trim window.");
    if (Number(originalDuration) > 0 && trimStart >= Number(originalDuration)) throw new Error(`Video trim start must be before the source ends at ${Number(originalDuration).toFixed(1)} seconds.`);
    if (Number(originalDuration) > 0 && trimEnd > Number(originalDuration) + .05) throw new Error(`Video trim end cannot exceed the source duration of ${Number(originalDuration).toFixed(1)} seconds.`);
    return {trimStart, trimEnd, trimmedDuration:Number((trimEnd - trimStart).toFixed(2)), maxVideoSeconds:15, originalDuration:Number(originalDuration) || null};
  }

  function clubMediaMetadata(kind, originalDuration = null) {
    return {
      title:byId("clubMediaTitle")?.value.trim() || "",
      relatedDjs:splitCSV(byId("clubMediaDjs")?.value || ""),
      relatedPromoters:splitCSV(byId("clubMediaPromoters")?.value || ""),
      mediaFilter:safeClubMediaFilter(byId("clubMediaFilter")?.value),
      ...clubVideoTrimPayload(kind, originalDuration),
      updatedByUid:auth.currentUser?.uid || "",
      updatedByEmail:safeUser(auth.currentUser),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function uploadUnifiedClubMediaFile(file, slotType) {
    if (!storage) throw new Error("Firebase Storage SDK is not loaded.");
    if (!file || !/^(image|video)\//.test(String(file.type || ""))) throw new Error("Choose an image or video file.");
    const kind = mediaKind(file);
    if (slotType === "logo" && kind !== "image") throw new Error("The club logo must be an image. Videos are supported for main and gallery media.");
    const path = `clubMedia/${locationId}/${slotType}/${Date.now()}-${cleanFileName(file.name)}`;
    const ref = storage.ref(path);
    await ref.put(file, {contentType:file.type || (kind === "video" ? "video/mp4" : "image/jpeg")});
    return {mediaType:kind, mediaUrl:await ref.getDownloadURL(), mediaStoragePath:path, mediaFileName:file.name || ""};
  }

  function readClubVideoDuration(file) {
    if (!file || mediaKind(file) !== "video") return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);
      const done = value => { URL.revokeObjectURL(url); video.removeAttribute("src"); resolve(value); };
      video.preload = "metadata";
      video.onloadedmetadata = () => done(Number(video.duration) || null);
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not read the duration of ${file.name || "the selected video"}.`)); };
      video.src = url;
    });
  }

  function updateClubMediaTrimVisibility() {
    const target = clubMedia.find(item => item.id === clubMediaEditTargetId);
    const files = Array.from(byId("clubMediaUnifiedFiles")?.files || []);
    const hasVideo = files.some(file => mediaKind(file) === "video") || (!files.length && target?.mediaType === "video");
    document.querySelectorAll("[data-club-video-trim]").forEach(el => el.classList.toggle("hidden", !hasVideo || byId("clubMediaPlacement")?.value === "logo"));
    renderClubMediaInputPreview();
  }

  function releaseClubMediaPreviewUrl() {
    if (clubMediaPreviewObjectUrl) URL.revokeObjectURL(clubMediaPreviewObjectUrl);
    clubMediaPreviewObjectUrl = "";
    clubMediaPreviewFile = null;
  }

  function renderClubMediaInputPreview() {
    const wrap = byId("clubMediaInputPreview");
    if (!wrap) return;
    const target = clubMedia.find(item => item.id === clubMediaEditTargetId);
    const files = Array.from(byId("clubMediaUnifiedFiles")?.files || []);
    const file = files[0] || null;
    if (file && file !== clubMediaPreviewFile) {
      releaseClubMediaPreviewUrl();
      clubMediaPreviewFile = file;
      clubMediaPreviewObjectUrl = URL.createObjectURL(file);
    }
    if (!file && clubMediaPreviewFile) releaseClubMediaPreviewUrl();
    const mediaUrl = file ? clubMediaPreviewObjectUrl : target?.mediaUrl || "";
    const mediaType = file ? mediaKind(file) : target?.mediaType || "";
    if (!mediaUrl) { wrap.classList.add("hidden"); wrap.innerHTML = ""; return; }
    const trimStart = Math.max(0, Number(byId("clubMediaTrimStart")?.value || target?.trimStart || 0));
    const requestedEnd = Number(byId("clubMediaTrimEnd")?.value || target?.trimEnd || trimStart + 15);
    const trimEnd = Math.min(trimStart + 15, Math.max(trimStart + .1, requestedEnd));
    const preview = {mediaUrl, mediaType, mediaFilter:safeClubMediaFilter(byId("clubMediaFilter")?.value || target?.mediaFilter), trimStart, trimEnd, title:target?.title || file?.name || "Media preview"};
    wrap.innerHTML = `<strong>Editor Preview</strong>${clubMediaPreview(preview)}<small>${mediaType === "video" ? `Playback window ${trimStart}s–${trimEnd}s (${(trimEnd - trimStart).toFixed(1)} seconds)` : "Image preview"}${files.length > 1 ? ` • plus ${files.length - 1} more selected file(s)` : ""}</small>`;
    wrap.classList.remove("hidden");
    enforceClubMediaPreviewTrims();
  }

  function resetClubMediaEditor(message = "Choose a placement and one or more files.") {
    clubMediaEditTargetId = "";
    if (byId("clubMediaPlacement")) { byId("clubMediaPlacement").disabled = false; byId("clubMediaPlacement").value = "gallery"; }
    if (byId("clubMediaUnifiedFiles")) byId("clubMediaUnifiedFiles").value = "";
    releaseClubMediaPreviewUrl();
    ["clubMediaTitle", "clubMediaDjs", "clubMediaPromoters"].forEach(id => { if (byId(id)) byId(id).value = ""; });
    if (byId("clubMediaFilter")) byId("clubMediaFilter").value = "none";
    if (byId("clubMediaTrimStart")) byId("clubMediaTrimStart").value = "0";
    if (byId("clubMediaTrimEnd")) byId("clubMediaTrimEnd").value = "15";
    if (byId("saveClubMediaBtn")) byId("saveClubMediaBtn").textContent = "Add Media";
    byId("cancelClubMediaEditBtn")?.classList.add("hidden");
    setText("clubMediaEditorStatus", message);
    updateClubMediaTrimVisibility();
  }

  function editClubMediaItem(id) {
    const item = clubMedia.find(row => row.id === id);
    if (!item) return;
    clubMediaEditTargetId = id;
    if (byId("clubMediaPlacement")) { byId("clubMediaPlacement").value = item.slotType || "gallery"; byId("clubMediaPlacement").disabled = true; }
    if (byId("clubMediaTitle")) byId("clubMediaTitle").value = item.title || "";
    if (byId("clubMediaDjs")) byId("clubMediaDjs").value = (item.relatedDjs || []).join(", ");
    if (byId("clubMediaPromoters")) byId("clubMediaPromoters").value = (item.relatedPromoters || []).join(", ");
    if (byId("clubMediaFilter")) byId("clubMediaFilter").value = safeClubMediaFilter(item.mediaFilter);
    if (byId("clubMediaTrimStart")) byId("clubMediaTrimStart").value = String(item.trimStart ?? 0);
    if (byId("clubMediaTrimEnd")) byId("clubMediaTrimEnd").value = String(item.trimEnd ?? Math.min(15, Number(item.originalDuration || 15)));
    if (byId("clubMediaUnifiedFiles")) byId("clubMediaUnifiedFiles").value = "";
    if (byId("saveClubMediaBtn")) byId("saveClubMediaBtn").textContent = "Save Media Changes";
    byId("cancelClubMediaEditBtn")?.classList.remove("hidden");
    setText("clubMediaEditorStatus", `Editing ${item.title || item.mediaFileName || item.slotType}. Choose one new file only if you want to replace the upload.`);
    updateClubMediaTrimVisibility();
    byId("clubMediaUnifiedFiles")?.focus?.();
  }

  async function removeStoredClubMedia(path) {
    if (!storage || !path) return;
    try { await storage.ref(path).delete(); } catch (error) {}
  }

  async function clearClubLocationMedia(slotType) {
    const isLogo = slotType === "logo";
    const path = isLogo ? publicClubProfile.logoStoragePath : publicClubProfile.mainMediaStoragePath;
    const payload = isLogo
      ? {logoUrl:"", logoStoragePath:""}
      : {mainMediaUrl:"", mainMediaType:"", mainMediaStoragePath:"", mainMediaFilter:"none", mainMediaTrimStart:null, mainMediaTrimEnd:null};
    await db.collection("clubLocations").doc(locationId).set({...payload, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    Object.assign(publicClubProfile, payload);
    if (isLogo && byId("clubProfileLogoUrl")) byId("clubProfileLogoUrl").value = "";
    await removeStoredClubMedia(path);
  }

  async function deleteClubMediaItem(id) {
    const item = clubMedia.find(row => row.id === id);
    if (!item || !window.confirm(`Delete ${item.title || item.mediaFileName || "this media item"}?`)) return;
    await db.collection("clubMedia").doc(id).delete();
    if (item.slotType === "main" || item.slotType === "logo") await clearClubLocationMedia(item.slotType);
    await removeStoredClubMedia(item.mediaStoragePath);
    resetClubMediaEditor("Media deleted.");
    await loadClubMedia();
  }

  async function setClubMediaAsMain(id) {
    const selected = clubMedia.find(row => row.id === id);
    if (!selected) return;
    const gallery = clubMedia.filter(row => row.slotType === "gallery").sort((a,b) => clubMediaOrder(a) - clubMediaOrder(b));
    const batch = db.batch();
    clubMedia.filter(row => row.slotType === "main" && row.id !== id).forEach((row, index) => {
      batch.set(db.collection("clubMedia").doc(row.id), {slotType:"gallery", galleryOrder:gallery.length + index, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    });
    batch.set(db.collection("clubMedia").doc(id), {slotType:"main", updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    batch.set(db.collection("clubLocations").doc(locationId), {
      mainMediaUrl:selected.mediaUrl || "",
      mainMediaType:selected.mediaType || "image",
      mainMediaStoragePath:selected.mediaStoragePath || "",
      mainMediaFilter:safeClubMediaFilter(selected.mediaFilter),
      mainMediaTrimStart:selected.trimStart ?? null,
      mainMediaTrimEnd:selected.trimEnd ?? null,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    await batch.commit();
    Object.assign(publicClubProfile, {mainMediaUrl:selected.mediaUrl || "", mainMediaType:selected.mediaType || "image"});
    setText("clubMediaEditorStatus", "Main profile media changed.");
    await loadClubMedia();
  }

  async function moveClubGalleryMedia(id, direction) {
    const gallery = clubMedia.filter(row => row.slotType === "gallery").sort((a,b) => clubMediaOrder(a) - clubMediaOrder(b));
    const index = gallery.findIndex(row => row.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= gallery.length) return;
    [gallery[index], gallery[nextIndex]] = [gallery[nextIndex], gallery[index]];
    const batch = db.batch();
    gallery.forEach((row, order) => batch.set(db.collection("clubMedia").doc(row.id), {galleryOrder:order, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true}));
    await batch.commit();
    await loadClubMedia();
  }

  async function saveClubMedia() {
    const status = byId("clubMediaEditorStatus");
    try {
      const placement = byId("clubMediaPlacement")?.value || "gallery";
      const files = Array.from(byId("clubMediaUnifiedFiles")?.files || []);
      if (clubMediaEditTargetId) {
        const item = clubMedia.find(row => row.id === clubMediaEditTargetId);
        if (!item) throw new Error("The media item being edited no longer exists.");
        if (files.length > 1) throw new Error("Choose only one replacement file while editing an existing item.");
        const originalDuration = files[0] ? await readClubVideoDuration(files[0]) : item.originalDuration || null;
        const kind = files[0] ? mediaKind(files[0]) : item.mediaType || "image";
        const metadata = clubMediaMetadata(kind, originalDuration);
        const upload = files[0] ? await uploadUnifiedClubMediaFile(files[0], item.slotType) : {};
        const payload = {...metadata, ...upload};
        await db.collection("clubMedia").doc(item.id).set(payload, {merge:true});
        if (item.slotType === "main") await db.collection("clubLocations").doc(locationId).set({
          mainMediaUrl:upload.mediaUrl || item.mediaUrl || "", mainMediaType:kind,
          mainMediaStoragePath:upload.mediaStoragePath || item.mediaStoragePath || "",
          mainMediaFilter:payload.mediaFilter, mainMediaTrimStart:payload.trimStart, mainMediaTrimEnd:payload.trimEnd,
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        }, {merge:true});
        if (item.slotType === "logo") await db.collection("clubLocations").doc(locationId).set({logoUrl:upload.mediaUrl || item.mediaUrl || "", logoStoragePath:upload.mediaStoragePath || item.mediaStoragePath || "", updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
        if (upload.mediaStoragePath && item.mediaStoragePath !== upload.mediaStoragePath) await removeStoredClubMedia(item.mediaStoragePath);
        resetClubMediaEditor("Media changes saved.");
        await loadClubPublicProfile();
        await loadClubMedia();
        return;
      }
      if (!files.length) throw new Error("Choose at least one photo or video.");
      if ((placement === "logo" || placement === "main") && files.length !== 1) throw new Error(`${placement === "logo" ? "Club logo" : "Main media"} accepts one file at a time.`);
      const newKinds = files.map(mediaKind);
      if (placement === "logo" && newKinds.some(kind => kind !== "image")) throw new Error("Club logo accepts images only.");
      if (placement === "gallery") {
        const existingImages = clubMedia.filter(row => row.slotType === "gallery" && row.mediaType === "image").length;
        const existingVideos = clubMedia.filter(row => row.slotType === "gallery" && row.mediaType === "video").length;
        if (existingImages + newKinds.filter(kind => kind === "image").length > 5) throw new Error("Public gallery allows up to 5 images.");
        if (existingVideos + newKinds.filter(kind => kind === "video").length > 5) throw new Error("Public gallery allows up to 5 videos.");
      }
      const baseOrder = Math.max(-1, ...clubMedia.filter(row => row.slotType === "gallery").map(clubMediaOrder)) + 1;
      for (let index = 0; index < files.length; index += 1) {
        const originalDuration = await readClubVideoDuration(files[index]);
        const metadata = clubMediaMetadata(mediaKind(files[index]), originalDuration);
        const upload = await uploadUnifiedClubMediaFile(files[index], placement);
        const payload = {
          clubLocationId:locationId,
          locationName:publicClubProfile.locationName || loc.locationName || locationId,
          slotType:placement,
          ...upload,
          ...metadata,
          galleryOrder:placement === "gallery" ? baseOrder + index : null,
          uploadedByUid:auth.currentUser?.uid || "",
          uploadedByEmail:safeUser(auth.currentUser),
          uploadedAt:firebase.firestore.FieldValue.serverTimestamp()
        };
        const existing = clubMedia.find(row => row.slotType === placement);
        const id = placement === "gallery" ? `${locationId}_${Date.now()}_${index}` : (existing?.id || `${locationId}_${placement}`);
        await db.collection("clubMedia").doc(id).set(payload, {merge:placement !== "gallery"});
        if (existing && placement !== "gallery" && existing.mediaStoragePath !== upload.mediaStoragePath) await removeStoredClubMedia(existing.mediaStoragePath);
        if (placement === "main") await db.collection("clubLocations").doc(locationId).set({mainMediaUrl:upload.mediaUrl, mainMediaType:upload.mediaType, mainMediaStoragePath:upload.mediaStoragePath, mainMediaFilter:payload.mediaFilter, mainMediaTrimStart:payload.trimStart, mainMediaTrimEnd:payload.trimEnd, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
        if (placement === "logo") await db.collection("clubLocations").doc(locationId).set({logoUrl:upload.mediaUrl, logoStoragePath:upload.mediaStoragePath, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
      }
      resetClubMediaEditor(`${files.length} media item${files.length === 1 ? "" : "s"} saved.`);
      await loadClubPublicProfile();
      await loadClubMedia();
    } catch (error) {
      if (status) status.textContent = `Media save failed: ${error.message || error}`;
    }
  }

  function clubMediaPreview(item = {}) {
    const cls = `club-media-filter-${safeClubMediaFilter(item.mediaFilter)}`;
    if (item.mediaType === "video") return `<video class="club-media-manager-preview ${cls}" src="${esc(item.mediaUrl || "")}" controls muted playsinline data-club-trim-start="${esc(item.trimStart ?? 0)}" data-club-trim-end="${esc(item.trimEnd ?? 15)}"></video>`;
    return `<img class="club-media-manager-preview ${cls}" src="${esc(item.mediaUrl || "")}" alt="${esc(item.title || "Club media")}"/>`;
  }

  function enforceClubMediaPreviewTrims() {
    document.querySelectorAll("#clubMediaReport video[data-club-trim-end], #clubMediaInputPreview video[data-club-trim-end]").forEach(video => {
      const start = Math.max(0, Number(video.dataset.clubTrimStart || 0));
      const end = Math.max(start + .1, Number(video.dataset.clubTrimEnd || start + 15));
      video.addEventListener("loadedmetadata", () => { try { video.currentTime = Math.min(start, Math.max(0, video.duration - .05)); } catch (error) {} });
      video.addEventListener("timeupdate", () => { if (video.currentTime >= end) { video.pause(); try { video.currentTime = start; } catch (error) {} } });
    });
  }

  function renderClubMedia() {
    const wrap = byId("clubMediaReport");
    if (!wrap) return;
    const main = clubMedia.find(x => x.slotType === "main");
    const logo = clubMedia.find(x => x.slotType === "logo");
    const gallery = clubMedia.filter(x => x.slotType === "gallery").sort((a,b) => clubMediaOrder(a) - clubMediaOrder(b));
    const images = gallery.filter(x => x.mediaType === "image");
    const videos = gallery.filter(x => x.mediaType === "video");
    const rows = [logo, main, ...gallery].filter(Boolean);
    wrap.innerHTML = `
      ${simpleRows([
        ["Club logo", logo || publicClubProfile.logoUrl ? "Published" : "Not uploaded"],
        ["Main media", main || publicClubProfile.mainMediaUrl ? `${main?.mediaType || publicClubProfile.mainMediaType || "image"} published` : "Not uploaded"],
        ["Public images", `${images.length}/5`],
        ["Public videos", `${videos.length}/5`],
        ["Video clip policy", "Trimmed playback window: up to 15 seconds"]
      ])}
      ${!logo && publicClubProfile.logoUrl ? `<div class="queue-item club-media-manager-row"><img class="club-media-manager-preview" src="${esc(publicClubProfile.logoUrl)}" alt="Current club logo"/><div><strong>Current Club Logo</strong><p>Legacy logo record</p><div class="queue-actions"><button type="button" data-club-replace-legacy="logo">Replace</button><button type="button" data-club-delete-legacy="logo">Delete</button></div></div></div>` : ""}
      ${!main && publicClubProfile.mainMediaUrl ? `<div class="queue-item club-media-manager-row">${clubMediaPreview({mediaUrl:publicClubProfile.mainMediaUrl,mediaType:publicClubProfile.mainMediaType,mediaFilter:publicClubProfile.mainMediaFilter,trimStart:publicClubProfile.mainMediaTrimStart,trimEnd:publicClubProfile.mainMediaTrimEnd,title:"Current main media"})}<div><strong>Current Main Media</strong><p>Legacy main-media record</p><div class="queue-actions"><button type="button" data-club-replace-legacy="main">Replace</button><button type="button" data-club-delete-legacy="main">Delete</button></div></div></div>` : ""}
      ${rows.map((item, index) => `<div class="queue-item club-media-manager-row">
        ${clubMediaPreview(item)}
        <div><strong>${esc(item.title || item.mediaFileName || item.slotType)}</strong>
        <p>${esc(item.slotType)} • ${esc(item.mediaType)} • filter: ${esc(safeClubMediaFilter(item.mediaFilter))}${item.mediaType === "video" ? ` • ${esc(item.trimStart ?? 0)}s–${esc(item.trimEnd ?? 15)}s (${esc(item.trimmedDuration ?? 15)}s max clip)` : ""}</p>
        <small>DJs: ${esc((item.relatedDjs || []).join(", ") || "-")} | Promoters: ${esc((item.relatedPromoters || []).join(", ") || "-")}</small>
        <div class="queue-actions"><button type="button" data-club-media-edit="${esc(item.id)}">Edit / Replace</button>${item.slotType === "gallery" ? `<button type="button" data-club-media-main="${esc(item.id)}">Set as Main</button><button type="button" data-club-media-up="${esc(item.id)}" ${index === (logo ? 1 : 0) + (main ? 1 : 0) ? "disabled" : ""}>Move Up</button><button type="button" data-club-media-down="${esc(item.id)}">Move Down</button>` : ""}<button type="button" data-club-media-delete="${esc(item.id)}">Delete</button></div></div>
      </div>`).join("") || '<p class="sub">No managed club media has been added yet.</p>'}`;
    wrap.querySelectorAll("[data-club-media-edit]").forEach(button => button.addEventListener("click", () => editClubMediaItem(button.dataset.clubMediaEdit)));
    wrap.querySelectorAll("[data-club-media-delete]").forEach(button => button.addEventListener("click", () => deleteClubMediaItem(button.dataset.clubMediaDelete)));
    wrap.querySelectorAll("[data-club-media-main]").forEach(button => button.addEventListener("click", () => setClubMediaAsMain(button.dataset.clubMediaMain)));
    wrap.querySelectorAll("[data-club-media-up]").forEach(button => button.addEventListener("click", () => moveClubGalleryMedia(button.dataset.clubMediaUp, -1)));
    wrap.querySelectorAll("[data-club-media-down]").forEach(button => button.addEventListener("click", () => moveClubGalleryMedia(button.dataset.clubMediaDown, 1)));
    wrap.querySelectorAll("[data-club-replace-legacy]").forEach(button => button.addEventListener("click", () => {
      if (byId("clubMediaPlacement")) byId("clubMediaPlacement").value = button.dataset.clubReplaceLegacy;
      setText("clubMediaEditorStatus", `Choose one new ${button.dataset.clubReplaceLegacy === "logo" ? "image" : "photo or video"} above, then click Add Media to replace the current ${button.dataset.clubReplaceLegacy}.`);
      updateClubMediaTrimVisibility();
      byId("clubMediaUnifiedFiles")?.focus?.();
    }));
    wrap.querySelectorAll("[data-club-delete-legacy]").forEach(button => button.addEventListener("click", async () => {
      if (!window.confirm(`Delete the current club ${button.dataset.clubDeleteLegacy}?`)) return;
      await clearClubLocationMedia(button.dataset.clubDeleteLegacy);
      await loadClubPublicProfile();
      await loadClubMedia();
    }));
    enforceClubMediaPreviewTrims();
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
      if (x.includes("bartender") || x.includes("barman")) roles.add("Bartender / Barman");
      if (/videographer|camera operator|cameraman|camera man|photographer|cinematographer/.test(x)) roles.add("Videographer / Camera Operator");
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
      role === "Waiter / Waitress / Bottle Girl" || role === "Bartender / Barman" || role === "Videographer / Camera Operator"
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
      ["Videographers / camera operators", roleCounts.get("Videographer / Camera Operator") || 0],
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

    const pending = workerAssociationRequests.filter(request => String(request.status || "pending").toLowerCase() === "pending");
    byId("pendingWorkerRequests").innerHTML = pending.length ? pending.map(request => `<div class="queue-item">
      <strong>${esc(request.publicName || request.displayName || request.email || "Worker request")}</strong>
      <p>${esc(request.roleLabel || request.roleType || "Requested worker role")}${request.serviceSubtype ? ` - ${esc(request.serviceSubtype)}` : ""}</p>
      <small>${esc(request.email || request.instagram || "")}</small>
      <div class="queue-actions"><button type="button" data-worker-request="${esc(request.id)}" data-worker-status="approved">Approve</button><button type="button" data-worker-request="${esc(request.id)}" data-worker-status="rejected">Reject</button></div>
    </div>`).join("") : "<p class='sub'>No pending worker requests for this club location yet.</p>";
    byId("pendingWorkerRequests").querySelectorAll("[data-worker-request]").forEach(button => button.addEventListener("click", () => setWorkerAssociationRequest(button.dataset.workerRequest, button.dataset.workerStatus)));

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
    const [users, designations, requests] = await Promise.all([
      getCollectionSafe("users"),
      getCollectionSafe("clubEmployeeDesignations"),
      getCollectionSafe("workerAssociationRequests")
    ]);
    adminUsers = users;
    adminDesignations = designations.filter(x => x.clubLocationId === locationId);
    workerAssociationRequests = requests.filter(x => x.clubLocationId === locationId);
    const teamOptions = byId("guestSupportingTeamOptions");
    if (teamOptions) teamOptions.innerHTML = adminDesignations.filter(item => String(item.status || "approved") === "approved").map(item => {
      const name = item.workerName || item.workerUsername || item.workerEmail || "Approved team member";
      const role = item.roleElectionType || (item.workerRoles || [])[0] || "Club worker";
      return `<option value="${esc(name)}">${esc(role)}</option>`;
    }).join("");
    renderEmployeeDesignations();
  }

  function workerRoleLabel(request = {}) {
    const type = String(request.roleType || "").toLowerCase();
    if (type === "clubadmin") return "Club Admin";
    if (type === "dj") return "DJ";
    if (type === "promoter") return "Promoter";
    if (type === "bartender") return "Bartender / Barman";
    if (type === "mediacreator") return "Videographer / Camera Operator";
    return request.serviceSubtype || "Waiter / Waitress / Bottle Girl";
  }

  async function setWorkerAssociationRequest(requestId, status) {
    const request = workerAssociationRequests.find(item => item.id === requestId);
    if (!request) return;
    const role = workerRoleLabel(request);
    if (status === "approved") {
      const uid = request.uid || request.workerUid;
      await db.collection("clubEmployeeDesignations").doc(designationId(uid)).set({clubLocationId:locationId, clubLocationName:loc.locationName || locationId, workerUid:uid, workerEmail:request.email || "", workerName:request.publicName || request.displayName || request.email || "Club worker", workerRoles:firebase.firestore.FieldValue.arrayUnion(role), roleElectionType:role, status:"approved", approvedByUid:auth.currentUser?.uid || "", updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
      await db.collection("users").doc(uid).set({approvedRoles:firebase.firestore.FieldValue.arrayUnion(role), approvedLocations:firebase.firestore.FieldValue.arrayUnion(locationId), updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
      await db.collection("inboxNotifications").add({recipientUid:uid, type:"workerAssociation", title:"Club association approved", body:`${loc.locationName || locationId} approved your ${role} association.`, clubLocationId:locationId, read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    }
    await db.collection("workerAssociationRequests").doc(requestId).set({status, reviewedByUid:auth.currentUser?.uid || "", reviewedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    setText("adminStatus", `Worker association ${status}.`);
    await loadEmployeeDesignations();
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
      theme:byId("guestCampaignTheme")?.value || "midnight",
      mainImageUrl:byId("guestCampaignImage")?.value.trim() || "",
      supportingTeam:splitCSV(byId("guestCampaignSupportingTeam")?.value || ""),
      audienceMode:byId("guestCampaignAudience")?.value || "followers",
      targetUserCount:Number(byId("guestCampaignTargetCount")?.value || 0),
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
      const designation = adminDesignations.find(item => (item.workerUid || item.uid) === auth.currentUser?.uid);
      if (designation && !String(designation.roleElectionType || "").toLowerCase().includes("club admin")) {
        const policySnap = await db.collection("clubRolePolicies").doc(locationId).get().catch(() => null);
        const policy = policySnap?.exists ? policySnap.data()?.roles?.[designation.roleElectionType] || {} : {};
        if (designation.requireApproval !== false && policy.requireApproval !== false) {
          await db.collection("clubRoleActivity").add({clubLocationId:locationId, actionType:"guestListCampaign", payload, submittedByUid:auth.currentUser.uid, submittedByRole:designation.roleElectionType || "Club worker", status:"pendingApproval", createdAt:firebase.firestore.FieldValue.serverTimestamp()});
          setText("adminStatus", "Guest list campaign submitted for Club Admin approval.");
          return;
        }
      }
      if (payload.audienceMode === "targetedFloqr") {
        if (payload.targetUserCount < 1) throw new Error("Enter the number of targeted FloqR patrons.");
        const checkoutCampaign = {...payload, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
        await window.FLOQRPayments.startCheckout({orderType:"targetedGuestList", payload:{clubLocationId:locationId, campaign:checkoutCampaign, targetUserCount:payload.targetUserCount}, status:message => setText("adminStatus", message)});
        return;
      }
      const campaignRef = await db.collection("guestListCampaigns").add(payload);
      const result = await window.FLOQRPayments.publishFollowerCampaign({entityId:locationId, campaign:{title:payload.campaignName, body:payload.description || `${payload.eventType}${payload.eventDate ? ` on ${payload.eventDate}` : ""}`, link:`./guest-list.html?location=${encodeURIComponent(locationId)}&campaign=${encodeURIComponent(campaignRef.id)}&v=29.09.8`, campaignType:"guestList", sourceCampaignId:campaignRef.id}, status:message => setText("adminStatus", message)});
      await campaignRef.set({publishedAt:firebase.firestore.FieldValue.serverTimestamp(), deliveredCount:result.deliveredCount || 0}, {merge:true});
      setText("adminStatus", `Guest list campaign submitted to ${result.deliveredCount || 0} club follower(s).`);
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
        link:"./patron-portal.html?tab=shoutouts&v=29.09.8"
      });
    } catch(e) {}
  }
  async function auditShoutout(id, item, action) {
    try { await db.collection("shoutoutAudit").add({shoutoutId:id, action, clubLocationId:item.clubLocationId||locationId, referenceNumber:item.referenceNumber||"", actorUid:auth.currentUser?.uid||"", actorEmail:safeUser(auth.currentUser), createdAt:firebase.firestore.FieldValue.serverTimestamp()}); } catch(e) {}
  }

  function adminShoutoutTextCaps(item = {}) {
    const template = window.SHOUTOUT_TEMPLATES?.[item.template || item.templateId] || {id:item.template || item.templateId || "blackwhite", className:item.templateClassName || ""};
    const formatId = item.screenFormatId || loc.primaryDisplayScreenFormatId || "led-96x48";
    return window.FLOQRTextLayout?.resolve?.(template, formatId) || {
      supported:true,
      formatId,
      main:Number(item.maxMainCharacters || 45),
      sub:Number(item.maxSubCharacters ?? 20),
      lineCount:Number(item.lineCount || 3),
      perLine:Number(item.maxCharactersPerLine || 15),
      mainTextSizePercent:Number(item.mainTextSizePercent || 20.8),
      subTextSizePercent:Number(item.subTextSizePercent || 7.8)
    };
  }

  function fitAdminShoutoutText(value = "", caps = {}, type = "main") {
    const limit = Math.max(0, Number(type === "sub" ? caps.sub : caps.main));
    const cleaned = String(value || "").replace(/\s+/g, " ").trim();
    if (type === "sub" || caps.lineCount <= 1) return cleaned.slice(0, limit);
    const rows = [];
    let row = "";
    cleaned.slice(0, limit + caps.lineCount - 1).split(/\s+/).filter(Boolean).forEach(word => {
      const chunks = [];
      for (let index = 0; index < word.length; index += caps.perLine) chunks.push(word.slice(index, index + caps.perLine));
      chunks.forEach(chunk => {
        const next = row ? `${row} ${chunk}` : chunk;
        if (next.length <= caps.perLine) row = next;
        else if (rows.length < caps.lineCount) { rows.push(row); row = chunk; }
      });
    });
    if (row && rows.length < caps.lineCount) rows.push(row);
    return rows.slice(0, caps.lineCount).join("\n");
  }

  async function approve(id, item) {
    const defaultMain = String(loc.defaultMain || `USE SHOUTOUT @ ${loc.locationName || locationId}`).replace(/USE SHOUT\s*OUT/i, "USE SHOUTOUT");
    const textCaps = adminShoutoutTextCaps(item);
    if (textCaps.supported === false) throw new Error(textCaps.advice || "This template is not supported on the selected display size.");
    await db.collection("liveContent").doc(locationId).set({
      location: locationId,
      clubLocationId: locationId,
      locationName: item.locationName || loc.locationName,
      brandName: item.brandName || loc.brandName,
      template: item.template || "neon",
      templateName: item.templateName || "",
      mainText: fitAdminShoutoutText(item.mainText || "SHOUTOUT!", textCaps, "main"),
      subText: fitAdminShoutoutText(item.subText || "", textCaps, "sub"),
      textLayoutVersion:window.FLOQRTextLayout?.version || "",
      textProfileId:textCaps.profileId || item.textProfileId || "full",
      maxMainCharacters:textCaps.main,
      maxSubCharacters:textCaps.sub,
      lineCount:textCaps.lineCount,
      maxCharactersPerLine:textCaps.perLine,
      minimumFontPixels:textCaps.minimumFontPixels || 0,
      mainTextSizePercent:textCaps.mainTextSizePercent || 20.8,
      subTextSizePercent:textCaps.subTextSizePercent || 7.8,
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
      teamMembers: Array.isArray(item.teamMembers) ? item.teamMembers.slice(0, 4) : [],
      animationDurationSeconds: item.template === "zebbiesFootballTeamIntro" ? 20 : (item.animationDurationSeconds || null),
      collaborationMode: item.collaborationMode || "",
      stadiumMessage: item.template === "zebbiesFootballTeamIntro" ? String(item.stadiumMessage || "TONIGHT, WE TAKE THE FIELD TOGETHER").slice(0, Number(textCaps.maxStadiumCharacters || 54)) : "",
      photoPermissionConfirmed: item.photoPermissionConfirmed === true,
      priceCents: item.template === "zebbiesFootballTeamIntro" ? 3000 : (item.priceCents || null),
      screenFormatId: item.screenFormatId || loc.primaryDisplayScreenFormatId || "led-96x48",
      templateVariantId: item.templateVariantId || "",
      templateVariantName: item.templateVariantName || "",
      lockedBaseTemplateId: item.lockedBaseTemplateId || "",
      backgroundType: item.backgroundType || "",
      backgroundUrl: item.backgroundUrl || "",
      backgroundColor: item.backgroundColor || "",
      backgroundGradient: item.backgroundGradient || "",
      backgroundStoragePath: item.backgroundStoragePath || "",
      status: "approved",
      displayDurationSeconds: 600,
      defaultMain,
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
    const main = String(loc.defaultMain || `USE SHOUTOUT @ ${loc.locationName || locationId}`).replace(/USE SHOUT\s*OUT/i, "USE SHOUTOUT");
    const screenFormatId = loc.primaryDisplayScreenFormatId || "led-96x48";
    const textCaps = window.FLOQRTextLayout?.resolve?.(window.SHOUTOUT_TEMPLATES?.blackwhite || {id:"blackwhite", className:"classic-bw"}, screenFormatId) || {main:45,sub:20,lineCount:3,perLine:15,mainTextSizePercent:20.8,subTextSizePercent:7.8};
    const payload = {
      location: locationId,
      clubLocationId: locationId,
      locationName: loc.locationName || locationId,
      brandName: loc.brandName || loc.locationName || locationId,
      template: "blackwhite",
      templateName: "Traditional Black and White ShoutOut",
      mainText: fitAdminShoutoutText(main, textCaps, "main"),
      subText: loc.defaultSub || "",
      screenFormatId,
      textLayoutVersion:window.FLOQRTextLayout?.version || "",
      textProfileId:"classicBoard",
      maxMainCharacters:textCaps.main,
      maxSubCharacters:textCaps.sub,
      lineCount:textCaps.lineCount,
      maxCharactersPerLine:textCaps.perLine,
      minimumFontPixels:textCaps.minimumFontPixels || 0,
      mainTextSizePercent:textCaps.mainTextSizePercent || 20.8,
      subTextSizePercent:textCaps.subTextSizePercent || 7.8,
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

    const adShare = Math.round(adImpressions / 1000 * 25);

    // Prototype estimates remain as a fallback summary; live FloqR ledger is loaded separately.
    if (byId("reconciliationSummary")) {
      byId("reconciliationSummary").innerHTML = simpleRows([
        ["Payment model", "Patron pays FloqR; club accrues 20% of priced ShoutOuts"],
        ["Currently priced template", "Football Intro ($30)"],
        ["Free templates", "Traditional Black & White and other unpriced templates"],
        ["Estimated local ad share (prototype)", money(adShare)]
      ]);
    }

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

    await loadClubPaymentLedger();
  }

  function ledgerTimestamp(value) {
    if (!value) return "-";
    if (typeof value.toDate === "function") return value.toDate().toLocaleString();
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    return String(value);
  }

  async function loadClubPaymentLedger() {
    const statusEl = byId("reconciliationStatus");
    const listEl = byId("reconciliationReport");
    if (!listEl) return;
    if (statusEl) statusEl.textContent = "Loading FloqR payment ledger…";
    try {
      let rows = [];
      try {
        const snap = await db.collection("paymentLedger").where("clubLocationId", "==", locationId).limit(200).get();
        rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (_) {
        const orderSnap = await db.collection("serviceOrders").where("clubLocationId", "==", locationId).limit(200).get();
        rows = orderSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(row => row.paymentStatus === "paid" && row.orderType === "shoutout")
          .map(row => ({
            ...row,
            clubShareCents: row.clubShareCents ?? row.venueShareCents ?? 0,
            settlementStatus: row.settlementStatus || "accrued-pending-payout"
          }));
      }
      rows.sort((a, b) => Number(b.paidAt?.seconds || b.createdAt?.seconds || 0) - Number(a.paidAt?.seconds || a.createdAt?.seconds || 0));
      const gross = rows.reduce((sum, row) => sum + Number(row.amountCents || 0), 0);
      const clubShare = rows.reduce((sum, row) => sum + Number(row.clubShareCents ?? row.venueShareCents ?? 0), 0);
      const floqrShare = rows.reduce((sum, row) => sum + Number(row.floqrShareCents || 0), 0);
      if (byId("reconGross")) byId("reconGross").textContent = money(gross);
      if (byId("reconClubShare")) byId("reconClubShare").textContent = money(clubShare);
      if (byId("reconFloqrShare")) byId("reconFloqrShare").textContent = money(floqrShare);
      if (byId("reconEntryCount")) byId("reconEntryCount").textContent = String(rows.length);
      listEl.innerHTML = rows.length
        ? rows.map(row => {
            const isTest = row.isTestPayment || row.environment === "test" || row.testPaymentMarker;
            return `<article class="queue-item">
            <div class="message-envelope-head"><strong>${esc(row.itemName || row.orderType || "Paid ShoutOut")}</strong><span>${esc(row.settlementStatus || row.paymentStatus || "paid")}${isTest ? " · <strong>TEST</strong>" : ""}</span></div>
            <p>${esc(row.invoiceNumber || row.orderId || row.id)} · Gross ${money(row.amountCents)} · Club 20% ${money(row.clubShareCents ?? row.venueShareCents)} · FloqR ${money(row.floqrShareCents)}</p>
            <small>${esc(row.customerEmail || row.ownerUid || "-")} · ${esc(ledgerTimestamp(row.paidAt || row.createdAt))} · ${esc(row.paymentModel || "floqr-platform")}${isTest ? " · TEST" : ""}</small>
          </article>`;
          }).join("")
        : `<p class="sub">No paid FloqR ShoutOut ledger entries for this club yet. Free templates do not appear here.</p>`;
      if (statusEl) statusEl.textContent = `Loaded ${rows.length} payment ledger entr${rows.length === 1 ? "y" : "ies"}.`;
    } catch (error) {
      listEl.innerHTML = `<p class="sub">${esc(error.message || "Could not load payment ledger.")}</p>`;
      if (statusEl) statusEl.textContent = error.message || "Ledger load failed.";
    }
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
    bind("adminMfaSendBtn", sendAdminMfaCode);
    bind("adminMfaVerifyBtn", verifyAdminMfaCode);
    bind("adminMfaCancelBtn", logout);
    bind("saveClubPublicProfileBtn", saveClubPublicProfile);
    bind("clubStripeConnectBtn", startClubConnectOnboarding);
    bind("clubStripeConnectRefreshBtn", refreshClubConnectStatus);
    bind("refreshReconciliationBtn", loadClubPaymentLedger);
    bind("saveClubTemplatePolicyBtn", saveClubTemplatePolicy);
    bind("copyClubPublicProfileLinkBtn", async () => {
      await navigator.clipboard?.writeText(publicProfileUrl());
      window.FLOQRActionFeedback?.show("Club page link copied", "The patron-facing FLOQR club profile URL is ready to share.", {status:"success"});
      window.FLOQRActionFeedback?.hide(2200);
    });
    bind("resetDisplayDefaultBtn", resetDisplayToClubDefault);
    bind("saveClubMediaBtn", saveClubMedia);
    bind("cancelClubMediaEditBtn", () => resetClubMediaEditor("Media edit cancelled."));
    bind("electClubRoleBtn", electClubRole);
    bind("createGuestCampaignBtn", createGuestCampaign);
    byId("employeeSearch")?.addEventListener("input", renderEmployeeDesignations);
    byId("clubTemplateBackgroundSearch")?.addEventListener("input", renderClubTemplateBackgrounds);
    byId("clubMediaUnifiedFiles")?.addEventListener("change", updateClubMediaTrimVisibility);
    byId("clubMediaPlacement")?.addEventListener("change", updateClubMediaTrimVisibility);
    byId("clubMediaFilter")?.addEventListener("change", renderClubMediaInputPreview);
    byId("clubMediaTrimStart")?.addEventListener("input", renderClubMediaInputPreview);
    byId("clubMediaTrimEnd")?.addEventListener("input", renderClubMediaInputPreview);
    byId("guestCampaignAudience")?.addEventListener("change", event => byId("guestCampaignTargetCountLabel")?.classList.toggle("hidden", event.currentTarget.value !== "targetedFloqr"));
    window.FLOQRUrlMediaField?.bind?.({
      urlInputId:"guestCampaignImage",
      fileInputId:"guestCampaignImageFile",
      previewId:"guestCampaignImagePreview",
      statusId:"adminStatus",
      pathPrefix:`clubMedia/${locationId}/guest-campaigns`,
      allowVideo:false,
      maxBytes:12 * 1024 * 1024
    });
    updateClubMediaTrimVisibility();

    auth.getRedirectResult().then(result => {
      if (result?.user) setText("adminStatus", `Microsoft redirect sign-in completed: ${result.user.email || result.user.displayName || result.user.uid}`);
    }).catch(e => { if (!handleAdminMfaRequired(e)) setText("adminStatus", adminAuthErrorMessage(e)); });

    auth.onAuthStateChanged(async user => {
      const email = safeUser(user);

      if (!user) {
        byId("adminLogin").classList.toggle("hidden", !!adminMfaResolver);
        byId("adminPanel").classList.add("hidden");
        if (adminMfaResolver) showAdminMfaPanel();
        return;
      }

      if (!(await hasClubAdminAccess(user))) {
        byId("adminLogin").classList.remove("hidden");
        byId("adminPanel").classList.add("hidden");
        setText("adminStatus", `${email || "This account"} is not assigned as an admin for ${locationId}.`);
        return;
      }

      const isMasterAdmin = MASTER_ADMIN_EMAILS.includes(email);
      if (!isMasterAdmin && !(user.multiFactor?.enrolledFactors || []).length) {
        showAdminMfaPanel("First-time Club Admin setup: enroll the patron's mobile phone as the required SMS second factor.");
        return;
      }

      byId("adminLogin").classList.add("hidden");
      byId("adminMfaPanel")?.classList.add("hidden");
      byId("adminPanel").classList.remove("hidden");
      setText("adminStatus", isMasterAdmin ? "Master Admin verified for Club Admin." : "Club admin verified.");
      enforceVenueFeatureGates();
      renderQueue();
      loadClubPublicProfile().then(async () => {
        await Promise.all([loadReports(), loadClubTemplateControls(), handleClubConnectReturn()]);
      });
      loadEmployeeDesignations();
      loadClubMedia();
      loadGuestListCampaigns().then(loadReports);
    });
  });
})();
