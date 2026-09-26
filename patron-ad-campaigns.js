/* Patron Ad Campaigns — business accounts only.
 * Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc
 */
(function (global) {
  "use strict";

  const COLLECTION = "spotAdCampaigns";
  const TARGET_FIELDS = [
    {id: "city", label: "City"},
    {id: "region", label: "State / region"},
    {id: "country", label: "Country"},
    {id: "ageRange", label: "Age range"},
    {id: "gender", label: "Gender"},
    {id: "musicInterests", label: "Music interests"},
    {id: "nightlifeStyle", label: "Nightlife style"},
    {id: "foodChoices", label: "Food choices"},
    {id: "favoriteBeverages", label: "Beverages"},
    {id: "hobbies", label: "Hobbies"},
    {id: "travelInterests", label: "Travel"},
    {id: "lookingToMeet", label: "Looking to meet"}
  ];

  function byId(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value == null ? "" : String(value);
  }
  function pricing() { return global.FLOQRAdPricing; }
  function db() { return firebase.firestore(); }
  function storage() { return firebase.storage(); }

  function isBusinessAccount(profile = {}) {
    return profile.IsBusinessAccount === 1
      || profile.IsBusinessAccount === true
      || String(profile.IsBusinessAccount || "").toLowerCase() === "yes"
      || String(profile.accountType || "").toLowerCase() === "business";
  }

  function updatePricingHints() {
    const placement = String(byId("adCampPlacement")?.value || "inline");
    const pkg = pricing()?.packageFor?.(placement);
    const hint = byId("adCampPriceHint");
    if (!hint || !pkg) return;
    hint.innerHTML = `<strong>${esc(pkg.packageLabel)}</strong> — ${esc(pkg.justification)}`;
  }

  function syncCreativeUi() {
    const type = String(byId("adCampCreativeType")?.value || "image");
    byId("adCampImageBlock")?.classList.toggle("hidden", type !== "image");
    byId("adCampHtmlBlock")?.classList.toggle("hidden", type !== "html");
  }

  function syncTargetUi() {
    const mode = String(byId("adCampTargetMode")?.value || "all");
    byId("adCampTargetBlock")?.classList.toggle("hidden", mode !== "targeted");
  }

  async function uploadFlyer(file, uid, campaignId) {
    if (!file) throw new Error("Choose a PNG, JPEG, or GIF flyer.");
    const ok = /image\/(png|jpeg|jpg|gif)/i.test(file.type) || /\.(png|jpe?g|gif)$/i.test(file.name || "");
    if (!ok) throw new Error("Flyer must be PNG, JPEG, or GIF.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Flyer must be 8 MB or smaller.");
    const path = `spotAds/${uid}/${campaignId}/${Date.now()}-${String(file.name || "flyer").replace(/[^\w.\-]+/g, "_")}`;
    const ref = storage().ref().child(path);
    await ref.put(file, {contentType: file.type || "image/png"});
    return ref.getDownloadURL();
  }

  function collectTargetTags() {
    const tags = [];
    TARGET_FIELDS.forEach((field) => {
      const input = byId(`adCampTag_${field.id}`);
      const raw = String(input?.value || "").trim();
      if (!raw) return;
      raw.split(/[,;|]+/).map((t) => t.trim()).filter(Boolean).forEach((t) => tags.push(t));
    });
    const free = String(byId("adCampTargetTags")?.value || "").trim();
    if (free) free.split(/[,;|]+/).map((t) => t.trim()).filter(Boolean).forEach((t) => tags.push(t));
    return Array.from(new Set(tags));
  }

  async function submitCampaign(profile, user) {
    if (!user?.uid) throw new Error("Sign in required.");
    if (!isBusinessAccount(profile)) throw new Error("Elect a business account in My Profile before posting ads.");
    const placement = String(byId("adCampPlacement")?.value || "inline");
    const pkg = pricing()?.packageFor?.(placement);
    if (!pkg) throw new Error("Choose Inline or Mingl Gist.");
    const creativeType = String(byId("adCampCreativeType")?.value || "image");
    const title = String(byId("adCampTitle")?.value || "").trim();
    const body = String(byId("adCampBody")?.value || "").trim();
    const cta = String(byId("adCampCta")?.value || "Learn more").trim() || "Learn more";
    const sourceUrl = String(byId("adCampLink")?.value || "").trim();
    const targetMode = String(byId("adCampTargetMode")?.value || "all");
    const advertiser = String(profile.businessName || profile.displayName || profile.fullName || "Business").trim();
    if (!title) throw new Error("Add a campaign title.");
    if (creativeType === "html" && !String(byId("adCampHtml")?.value || "").trim()) {
      throw new Error("Paste HTML for an HTML ad, or switch to flyer upload.");
    }
    if (creativeType === "image" && !byId("adCampFlyer")?.files?.[0]) {
      throw new Error("Upload a PNG, JPEG, or GIF flyer.");
    }
    const targetTags = targetMode === "targeted" ? collectTargetTags() : [];
    if (targetMode === "targeted" && !targetTags.length) {
      throw new Error("Add at least one targeting datapoint, or choose All patrons.");
    }

    const ref = db().collection(COLLECTION).doc();
    let imageUrl = "";
    let htmlBody = "";
    if (creativeType === "image") {
      imageUrl = await uploadFlyer(byId("adCampFlyer").files[0], user.uid, ref.id);
    } else {
      htmlBody = String(byId("adCampHtml")?.value || "").trim();
    }

    const now = Date.now();
    const flightMs = pkg.flightDays * 24 * 60 * 60 * 1000;
    const row = {
      title,
      body,
      badge: pkg.shortLabel,
      advertiser,
      creativeType: creativeType === "html" ? "html" : "image",
      image: imageUrl,
      imageUrl,
      htmlBody,
      cta,
      callToAction: cta,
      sourceUrl,
      linkUrl: sourceUrl,
      placementType: placement,
      slots: pkg.slots.slice(),
      targetMode,
      targetTags,
      status: "pending_approval",
      paymentStatus: "unpaid",
      priceCents: pkg.priceCents,
      flightDays: pkg.flightDays,
      proposedStartsAtMs: now,
      proposedEndsAtMs: now + flightMs,
      publishedByUid: user.uid,
      publisherEmail: user.email || "",
      businessName: advertiser,
      IsBusinessAccount: 1,
      source: "patron_business",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtMs: now
    };
    await ref.set(row);
    return {id: ref.id, ...row, priceLabel: pkg.priceLabel};
  }

  async function listMine(uid) {
    if (!uid) return [];
    try {
      const snap = await db().collection(COLLECTION).where("publishedByUid", "==", uid).limit(40).get();
      return snap.docs.map((doc) => ({id: doc.id, ...doc.data()}))
        .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
    } catch (err) {
      console.warn("listMine ad campaigns", err?.message || err);
      return [];
    }
  }

  function renderMine(rows) {
    const host = byId("adCampMineList");
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = `<p class="sub">No campaigns yet. Compose one above — it goes to Master Admin for approval and scheduling.</p>`;
      return;
    }
    host.innerHTML = rows.map((row) => {
      const pkg = pricing()?.packageFor?.(row.placementType);
      const price = pricing()?.priceLabel?.(row.priceCents) || pkg?.priceLabel || "";
      return `<div class="queue-item">
        <strong>${esc(row.title || "Campaign")}</strong>
        <p>${esc(row.placementType || "")} · ${esc(row.creativeType || "image")} · ${esc(row.status || "")} · ${esc(row.paymentStatus || "")} · ${esc(price)}</p>
        <p class="sub small">${esc(row.body || "").slice(0, 160)}</p>
        <small>Submitted ${esc(row.createdAtMs ? new Date(row.createdAtMs).toLocaleString() : "—")} · Audience ${esc(row.targetMode || "all")}</small>
      </div>`;
    }).join("");
  }

  async function refreshMine(user) {
    const rows = await listMine(user?.uid);
    renderMine(rows);
  }

  function mountForm() {
    const fields = byId("adCampTargetFields");
    if (fields && !fields.dataset.ready) {
      fields.dataset.ready = "1";
      fields.innerHTML = TARGET_FIELDS.map((field) =>
        `<label>${esc(field.label)}<input id="adCampTag_${esc(field.id)}" placeholder="Comma-separated values"/></label>`
      ).join("");
    }
    updatePricingHints();
    syncCreativeUi();
    syncTargetUi();
  }

  function bind(profile, user) {
    mountForm();
    byId("adCampPlacement")?.addEventListener("change", updatePricingHints);
    byId("adCampCreativeType")?.addEventListener("change", syncCreativeUi);
    byId("adCampTargetMode")?.addEventListener("change", syncTargetUi);
    byId("adCampSubmitBtn")?.addEventListener("click", async () => {
      setText("adCampStatus", "Submitting campaign…");
      try {
        const result = await submitCampaign(profile, user);
        setText("adCampStatus", `Submitted for Master Admin approval. Package ${result.priceLabel}. Campaign id ${result.id}.`);
        byId("adCampTitle") && (byId("adCampTitle").value = "");
        byId("adCampBody") && (byId("adCampBody").value = "");
        byId("adCampHtml") && (byId("adCampHtml").value = "");
        byId("adCampFlyer") && (byId("adCampFlyer").value = "");
        await refreshMine(user);
      } catch (err) {
        setText("adCampStatus", err?.message || "Submit failed.");
      }
    });
    byId("adCampRefreshMineBtn")?.addEventListener("click", () => refreshMine(user).catch(console.warn));
    refreshMine(user).catch(console.warn);
  }

  function showPanel(profile) {
    const tab = byId("portalAdCampaignsTab");
    const section = byId("portalAdCampaigns");
    const gate = byId("adCampBusinessGate");
    const form = byId("adCampComposer");
    const business = isBusinessAccount(profile);
    tab?.classList.toggle("hidden", !business);
    if (gate) gate.classList.toggle("hidden", business);
    if (form) form.classList.toggle("hidden", !business);
    return business;
  }

  global.FLOQRPatronAdCampaigns = {
    TARGET_FIELDS,
    isBusinessAccount,
    bind,
    showPanel,
    refreshMine,
    submitCampaign,
    listMine
  };
})(typeof window !== "undefined" ? window : globalThis);
