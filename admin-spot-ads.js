/* FLOQR Club Admin — publish spot ads into the advertisement pool. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const locationId = new URL(location.href).searchParams.get("location")
    || new URL(location.href).searchParams.get("club")
    || "zebbies-garden-washington-dc";
  if (!window.firebase || !byId("spotAdCampaignCard")) return;

  const auth = firebase.auth();
  const db = firebase.firestore();

  function clubRow() {
    return (window.SHOUTOUT_CLUB_LOCATIONS || {})[locationId] || {};
  }

  function statusEl() {
    return byId("spotAdStatus");
  }

  function spotTemplates() {
    const fromDc = window.FLOQRDcSpotAds?.templates || [];
    const fromMarketing = (window.FLOQRMarketingTemplates?.TEMPLATES || []).filter(t => t.layoutId === "spotInterstitial" || t.channelHint === "spot");
    const map = new Map();
    [...fromDc, ...fromMarketing].forEach(t => map.set(t.id, t));
    return Array.from(map.values());
  }

  function fillTemplateSelect() {
    const sel = byId("spotTemplateSelect");
    if (!sel) return;
    const templates = spotTemplates();
    sel.innerHTML = templates.map(t => `<option value="${t.id}">${t.name}</option>`).join("")
      || `<option value="spot-tonight-event">Spot · Tonight's event</option>`;
  }

  function applySpotTemplate() {
    const id = byId("spotTemplateSelect")?.value;
    const t = spotTemplates().find(x => x.id === id) || spotTemplates()[0];
    const club = clubRow();
    const clubName = club.locationName || club.brandName || "Club";
    const event = byId("spotEventFocus")?.value || (club.activityDates || [])[0] || "Tonight";
    const vars = {club: clubName, event};
    const fill = window.FLOQRMarketingTemplates?.fillPlaceholders || ((text, v) => String(text || "").replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] != null ? String(v[k]) : ""));
    if (!t) return;
    if (byId("spotBadge")) byId("spotBadge").value = fill(t.eyebrow || "Tonight", vars);
    if (byId("spotHeadline")) byId("spotHeadline").value = fill(t.headline || "{{club}}", vars);
    if (byId("spotBody")) byId("spotBody").value = fill(t.body || "", vars);
    if (byId("spotCta")) byId("spotCta").value = fill(t.cta || "Open club", vars);
    if (byId("spotSlots") && Array.isArray(t.slots)) byId("spotSlots").value = t.slots.join(",");
    if (byId("spotLinkUrl") && !byId("spotLinkUrl").value) {
      byId("spotLinkUrl").value = club.officialWebsite || `./club-profile.html?location=${encodeURIComponent(locationId)}`;
    }
  }

  function parseSlots(value) {
    return String(value || "")
      .split(/[,|;]+/)
      .map(x => x.trim())
      .filter(Boolean);
  }

  async function publishSpotAd(payload) {
    const ref = db.collection("spotAdCampaigns").doc(payload.id);
    await ref.set({
      ...payload,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    return payload.id;
  }

  async function publishFromForm() {
    const club = clubRow();
    const clubName = club.locationName || club.brandName || locationId;
    const headline = byId("spotHeadline")?.value.trim() || clubName;
    const body = byId("spotBody")?.value.trim() || club.description || "";
    const badge = byId("spotBadge")?.value.trim() || "Tonight";
    const cta = byId("spotCta")?.value.trim() || "Open club";
    const eventFocus = byId("spotEventFocus")?.value.trim() || (club.activityDates || [])[0] || "";
    const imageUrl = byId("spotImageUrl")?.value.trim()
      || window.FLOQRDcSpotAds?.svgBanner?.(clubName, eventFocus || badge, "#dfff5a")
      || "";
    const id = `spot_${locationId}_${Date.now().toString(36)}`;
    const payload = {
      id,
      clubLocationId: locationId,
      clubName,
      advertiser: clubName,
      title: headline,
      headline,
      badge,
      eyebrow: badge,
      body,
      cta,
      callToAction: cta,
      image: imageUrl,
      imageUrl,
      backgroundImageUrl: imageUrl,
      linkUrl: byId("spotLinkUrl")?.value.trim() || club.officialWebsite || "",
      sourceUrl: byId("spotLinkUrl")?.value.trim() || club.officialWebsite || "",
      slots: parseSlots(byId("spotSlots")?.value),
      eventTags: eventFocus ? [eventFocus] : (club.activityDates || []).slice(0, 4),
      targetTags: [],
      status: "active",
      templateId: byId("spotTemplateSelect")?.value || "",
      publishedByUid: auth.currentUser?.uid || "",
      publishedByEmail: auth.currentUser?.email || ""
    };
    if (statusEl()) statusEl().textContent = "Publishing spot ad…";
    await publishSpotAd(payload);
    if (statusEl()) statusEl().textContent = `Published spot ad ${id} to the advertisement pool.`;
    await loadSpotReport();
    await window.FLOQRAdCampaigns?.loadFirestoreSpotAds?.(db);
  }

  async function seedFromWebsiteData() {
    const club = clubRow();
    const clubName = club.locationName || club.brandName || locationId;
    const events = Array.isArray(club.activityDates) ? club.activityDates : ["Tonight"];
    const seeded = [];
    for (const event of events.slice(0, 4)) {
      const id = `spot_${locationId}_${String(event).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
      const image = window.FLOQRDcSpotAds?.svgBanner?.(clubName, event, "#ff64d8") || "";
      await publishSpotAd({
        id,
        clubLocationId: locationId,
        clubName,
        advertiser: clubName,
        title: `${clubName} · ${event}`,
        headline: `${event}`,
        badge: "From venue calendar",
        eyebrow: "Upcoming",
        body: `${club.tagline || club.description || clubName}. Highlighting ${event} from the venue's public programming.`,
        cta: "Open club",
        callToAction: "Open club",
        image,
        imageUrl: image,
        backgroundImageUrl: image,
        linkUrl: club.officialWebsite || `./club-profile.html?location=${encodeURIComponent(locationId)}`,
        sourceUrl: club.officialWebsite || "",
        slots: ["clubs", "events", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
        eventTags: [event],
        targetTags: [],
        status: "active",
        templateId: "spot-tonight-event",
        seededFromWebsite: true,
        publishedByUid: auth.currentUser?.uid || "",
        publishedByEmail: auth.currentUser?.email || ""
      });
      seeded.push(id);
    }
    if (statusEl()) statusEl().textContent = `Seeded ${seeded.length} spot ads from venue activity dates.`;
    await loadSpotReport();
    await window.FLOQRAdCampaigns?.loadFirestoreSpotAds?.(db);
  }

  async function loadSpotReport() {
    const report = byId("spotAdReport");
    if (!report) return;
    const snap = await db.collection("spotAdCampaigns")
      .where("clubLocationId", "==", locationId)
      .limit(40)
      .get();
    const rows = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    report.innerHTML = rows.length
      ? rows.map(row => `<div class="report-row"><strong>${escapeHtml(row.title || row.id)}</strong> · ${escapeHtml(row.status || "active")}<br/><span class="sub small">${escapeHtml((row.eventTags || []).join(" · "))}</span></div>`).join("")
      : "<p class='sub small'>No spot ads published yet for this club.</p>";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.addEventListener("DOMContentLoaded", () => {
    fillTemplateSelect();
    const club = clubRow();
    if (byId("spotEventFocus") && !byId("spotEventFocus").value) {
      byId("spotEventFocus").value = (club.activityDates || [])[0] || "";
    }
    applySpotTemplate();
    window.FLOQRUrlMediaField?.bind?.({
      urlInputId:"spotImageUrl",
      fileInputId:"spotImageFile",
      previewId:"spotImagePreview",
      statusId:"spotAdStatus",
      pathPrefix:`clubMedia/${locationId}/spot-ads`,
      allowVideo:true,
      maxBytes:60 * 1024 * 1024
    });
    byId("spotTemplateSelect")?.addEventListener("change", applySpotTemplate);
    byId("spotEventFocus")?.addEventListener("change", applySpotTemplate);
    byId("publishSpotAdBtn")?.addEventListener("click", () => publishFromForm().catch(err => {
      if (statusEl()) statusEl().textContent = err.message || String(err);
    }));
    byId("seedClubSpotAdsBtn")?.addEventListener("click", () => seedFromWebsiteData().catch(err => {
      if (statusEl()) statusEl().textContent = err.message || String(err);
    }));
    auth.onAuthStateChanged(user => {
      if (!user) return;
      loadSpotReport().catch(() => {});
    });
  });
})();
