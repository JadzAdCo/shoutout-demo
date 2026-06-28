/* FLOQR AI Discovery admin scaffold. Public-source queue, approval, and soft-delete tools. */
(function () {
  "use strict";

  const DEFAULT_SOURCES = [
    {sourceName:"Ticketmaster Discovery API", sourceType:"api", sourceUrl:"https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/", enabled:true, crawlFrequency:"every4Hours", allowedCategories:["event","concert","comedyShow","nightclub"]},
    {sourceName:"Eventbrite API", sourceType:"api", sourceUrl:"https://www.eventbrite.com/platform/api", enabled:true, crawlFrequency:"every4Hours", allowedCategories:["event","brunchParty","poolParty","comedyShow"]},
    {sourceName:"Ticket resale partners", sourceType:"api", sourceUrl:"partner-config-required", enabled:false, crawlFrequency:"every4Hours", allowedCategories:["event","ticketResaleEvent"]},
    {sourceName:"Official venue websites and feeds", sourceType:"website", sourceUrl:"manual-source-list", enabled:true, crawlFrequency:"every6Hours", allowedCategories:["nightclub","beachClub","lounge","event","summerParty","comedyShow"]}
  ];

  const DEFAULT_CRITERIA = {
    active:true,
    criteriaName:"Default Nightlife Rating",
    weights:{
      venueRelevance:20,
      eventQuality:20,
      brandFit:20,
      locationValue:15,
      sourceCredibility:15,
      patronInterestMatch:10
    },
    notes:"Editable by Super Admin"
  };

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const splitCSV = value => String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  const slug = value => String(value || "floqr-listing").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
  let db = null;
  let auth = null;
  let queueRows = [];
  let listingRows = [];

  function nowField() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  }

  async function getCollectionSafe(name, limit = 500) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      return snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch(e) {
      console.warn(`Could not read ${name}:`, e.message);
      return [];
    }
  }

  async function ensureDiscoveryDefaults() {
    if (!db) return;
    try {
      const criteriaRef = db.collection("aiDiscoveryRatingCriteria").doc("defaultNightlifeRating");
      const criteriaSnap = await criteriaRef.get();
      if (!criteriaSnap.exists) await criteriaRef.set({...DEFAULT_CRITERIA, createdAt:nowField(), updatedAt:nowField()});
      for (const source of DEFAULT_SOURCES) {
        const id = slug(source.sourceName);
        await db.collection("aiDiscoverySources").doc(id).set({
          ...source,
          createdAt:nowField(),
          updatedAt:nowField()
        }, {merge:true});
      }
    } catch(e) {
      console.warn("Discovery defaults skipped:", e.message);
    }
  }

  function queueField(item, field, label, wide) {
    const value = Array.isArray(item[field]) ? item[field].join(", ") : item[field] || "";
    return `<label class="${wide ? "wide-field" : ""}">${esc(label)}<input data-queue-field="${esc(field)}" value="${esc(value)}"/></label>`;
  }

  function queueCard(item, index) {
    return `<div class="queue-item ai-discovery-item" data-queue-index="${index}">
      <div class="club-option-head">
        <div>
          <strong>${esc(item.proposedTitle || "Untitled discovery")}</strong>
          <p>${esc(item.proposedType || "event")} - ${esc(item.city || "")}, ${esc(item.country || "")}</p>
        </div>
        <span class="status-pill">${esc(item.aiStarRating || 3)} stars / ${esc(Math.round(Number(item.aiConfidenceScore || 0) * 100))}%</span>
      </div>
      <p>${esc(item.aiSummary || item.proposedDescription || "No AI summary yet.")}</p>
      <div class="profile-grid">
        ${queueField(item, "proposedType", "Type")}
        ${queueField(item, "proposedTitle", "Title")}
        ${queueField(item, "proposedDate", "Date")}
        ${queueField(item, "proposedTime", "Time")}
        ${queueField(item, "proposedLocationName", "Location name")}
        ${queueField(item, "city", "City")}
        ${queueField(item, "stateRegion", "State / region")}
        ${queueField(item, "country", "Country")}
        ${queueField(item, "categories", "Categories", true)}
        ${queueField(item, "genres", "Genres", true)}
        ${queueField(item, "sourceUrl", "Source URL", true)}
      </div>
      ${item.aiRatingReasons?.length ? `<div class="tag-row">${item.aiRatingReasons.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
      <div class="queue-actions">
        <button type="button" data-discovery-action="approve">Approve</button>
        <button type="button" data-discovery-action="reject">Reject</button>
        <button type="button" data-discovery-action="duplicate">Mark Duplicate</button>
        <button type="button" data-discovery-action="delete">Delete</button>
        ${item.sourceUrl ? `<a class="buttonlike" target="_blank" href="${esc(item.sourceUrl)}">Source</a>` : ""}
      </div>
    </div>`;
  }

  function readEditedQueueItem(card, original) {
    const next = {...original};
    card.querySelectorAll("[data-queue-field]").forEach(input => {
      const field = input.dataset.queueField;
      if (["categories", "genres"].includes(field)) next[field] = splitCSV(input.value);
      else next[field] = input.value.trim();
    });
    return next;
  }

  async function approveQueueItem(card, item) {
    const edited = readEditedQueueItem(card, item);
    const proposedType = String(edited.proposedType || "").toLowerCase();
    const isVenue = /club|venue|lounge|beach/.test(proposedType);
    const id = slug(`${edited.proposedTitle || edited.proposedLocationName || "listing"}-${edited.city || ""}-${edited.country || ""}`);
    const payload = isVenue ? {
      locationName:edited.proposedTitle || edited.proposedLocationName || id,
      brandName:edited.proposedLocationName || edited.proposedTitle || id,
      type:proposedType.includes("beach") ? "beach-club" : proposedType.includes("lounge") ? "lounge" : "club",
      categories:edited.categories || [],
      genres:edited.genres || [],
      country:edited.country || "",
      region:edited.stateRegion || "",
      stateRegion:edited.stateRegion || "",
      city:edited.city || "",
      address:edited.proposedAddress || "",
      officialWebsite:edited.officialWebsite || "",
      email:edited.email || "",
      telephone:edited.telephone || "",
      socialMediaHandles:edited.socialMediaHandles || {},
      locationLabel:[edited.city, edited.stateRegion, edited.country].filter(Boolean).join(", "),
      activityStatus:"Approved from AI discovery",
      active:true,
      status:"active",
      visibility:"public",
      clubOwnershipStatus:"unclaimed",
      approvedFromDiscoveryQueueId:item.id,
      sourceUrl:edited.sourceUrl || "",
      updatedAt:nowField()
    } : {
      eventName:edited.proposedTitle || id,
      eventDate:edited.proposedDate || "",
      eventTime:edited.proposedTime || "",
      eventDay:edited.proposedDate || "",
      locationId:edited.locationId || "",
      locationName:edited.proposedLocationName || "",
      city:edited.city || "",
      region:edited.stateRegion || "",
      stateRegion:edited.stateRegion || "",
      country:edited.country || "",
      categories:edited.categories || [],
      category:/comedy/i.test([edited.proposedTitle, edited.categories].flat().join(" ")) ? "Comedy" : "Event",
      genres:edited.genres || [],
      ticketProvider:edited.ticketProvider || "Ticketmaster/Eventbrite/resale partner ready",
      ticketResalePartner:edited.ticketResalePartner || "",
      sourceUrl:edited.sourceUrl || "",
      active:true,
      status:"active",
      visibility:"public",
      approvedFromDiscoveryQueueId:item.id,
      updatedAt:nowField()
    };
    await db.collection(isVenue ? "clubLocations" : "events").doc(id).set(payload, {merge:true});
    await db.collection("aiDiscoveryQueue").doc(item.id).set({
      ...edited,
      status:"approved",
      reviewedByUid:auth.currentUser?.uid || "",
      reviewedAt:nowField(),
      approvedCollection:isVenue ? "clubLocations" : "events",
      approvedRecordId:id,
      updatedAt:nowField()
    }, {merge:true});
    if (window.FLOQRAIIndex) {
      const indexRecord = isVenue ? window.FLOQRAIIndex.clubLocationIndexRecord(id, payload) : window.FLOQRAIIndex.eventIndexRecord(id, payload);
      await window.FLOQRAIIndex.upsertAiIndex(db, `${indexRecord.sourceType}_${id}`, indexRecord);
    }
    setStatus("Approved discovery record.");
    await loadDiscoveryQueue();
  }

  async function setQueueStatus(item, status, extra = {}) {
    await db.collection("aiDiscoveryQueue").doc(item.id).set({
      status,
      reviewedByUid:auth.currentUser?.uid || "",
      reviewedAt:nowField(),
      updatedAt:nowField(),
      ...extra
    }, {merge:true});
    setStatus(`Discovery record ${status}.`);
    await loadDiscoveryQueue();
  }

  async function loadDiscoveryQueue() {
    const status = byId("aiDiscoveryStatusFilter")?.value || "pendingReview";
    const city = String(byId("aiDiscoveryCityFilter")?.value || "").toLowerCase();
    const rows = await getCollectionSafe("aiDiscoveryQueue", 500);
    queueRows = rows.filter(item => {
      if (status !== "all" && String(item.status || "pendingReview") !== status) return false;
      if (city && !String(item.city || "").toLowerCase().includes(city)) return false;
      return true;
    });
    const wrap = byId("aiDiscoveryQueueList");
    if (!wrap) return;
    wrap.innerHTML = queueRows.length ? queueRows.map(queueCard).join("") : "<p class='sub'>No discovery records matched.</p>";
    wrap.querySelectorAll("[data-discovery-action]").forEach(button => {
      const card = button.closest(".ai-discovery-item");
      const item = queueRows[Number(card.dataset.queueIndex)];
      button.addEventListener("click", async () => {
        const action = button.dataset.discoveryAction;
        if (action === "approve") return approveQueueItem(card, item);
        if (action === "reject") return setQueueStatus(item, "rejected");
        if (action === "duplicate") return setQueueStatus(item, "pendingReview", {duplicateMarked:true, aiRatingReasons:[...(item.aiRatingReasons || []), "Marked duplicate by Super Admin"]});
        if (action === "delete" && confirm("This will delete the discovery queue record from active review.")) return setQueueStatus(item, "deleted");
      });
    });
  }

  function listingSearchText(item = {}) {
    return [item.id, item.locationName, item.brandName, item.eventName, item.city, item.country, item.status].filter(Boolean).join(" ").toLowerCase();
  }

  async function loadListingDeleteTool() {
    const [clubs, events] = await Promise.all([getCollectionSafe("clubLocations", 1000), getCollectionSafe("events", 1000)]);
    const includeDeleted = byId("listingIncludeDeleted")?.checked;
    const q = String(byId("listingDeleteSearch")?.value || "").toLowerCase();
    listingRows = [
      ...clubs.map(x => ({...x, collection:"clubLocations", label:x.locationName || x.brandName || x.id})),
      ...events.map(x => ({...x, collection:"events", label:x.eventName || x.title || x.id}))
    ].filter(item => (includeDeleted || String(item.status || "active") !== "deleted") && (!q || listingSearchText(item).includes(q))).slice(0, 80);
    const wrap = byId("listingDeleteResults");
    if (!wrap) return;
    wrap.innerHTML = listingRows.length ? listingRows.map((item, index) => `<div class="queue-item employee-row" data-listing-index="${index}">
      <div>
        <strong>${esc(item.label)}</strong>
        <p>${esc(item.collection)} - ${esc(item.city || "")}, ${esc(item.country || "")}</p>
        <small>Status: ${esc(item.status || "active")}</small>
      </div>
      <div class="queue-actions">
        ${String(item.status || "active") === "deleted"
          ? `<button type="button" data-listing-action="restore">Restore</button>`
          : `<button type="button" data-listing-action="delete">Soft Delete</button>`}
      </div>
    </div>`).join("") : "<p class='sub'>No listings matched.</p>";
    wrap.querySelectorAll("[data-listing-action]").forEach(button => {
      const item = listingRows[Number(button.closest("[data-listing-index]").dataset.listingIndex)];
      button.addEventListener("click", () => button.dataset.listingAction === "restore" ? restoreListing(item) : softDeleteListing(item));
    });
  }

  async function softDeleteListing(item) {
    const reason = prompt("Delete reason (optional):", "Super Admin soft delete") || "";
    if (!confirm("This will delete the listing from FLOQR. This action may affect searches and user access.")) return;
    await db.collection(item.collection).doc(item.id).set({
      status:"deleted",
      active:false,
      deletedAt:nowField(),
      deletedByUid:auth.currentUser?.uid || "",
      deleteReason:reason
    }, {merge:true});
    setStatus("Listing soft-deleted.");
    await loadListingDeleteTool();
  }

  async function restoreListing(item) {
    await db.collection(item.collection).doc(item.id).set({
      status:"active",
      active:true,
      restoredAt:nowField(),
      restoredByUid:auth.currentUser?.uid || ""
    }, {merge:true});
    setStatus("Listing restored.");
    await loadListingDeleteTool();
  }

  async function loadCriteria() {
    const snap = await db.collection("aiDiscoveryRatingCriteria").doc("defaultNightlifeRating").get();
    const criteria = snap.exists ? snap.data() : DEFAULT_CRITERIA;
    byId("aiDiscoveryCriteriaJson").value = JSON.stringify(criteria.weights || DEFAULT_CRITERIA.weights, null, 2);
    byId("aiDiscoveryCriteriaNotes").value = criteria.notes || "";
  }

  async function saveCriteria() {
    let weights = DEFAULT_CRITERIA.weights;
    try {
      weights = JSON.parse(byId("aiDiscoveryCriteriaJson").value || "{}");
    } catch(e) {
      setStatus("Rating criteria weights must be valid JSON.");
      return;
    }
    await db.collection("aiDiscoveryRatingCriteria").doc("defaultNightlifeRating").set({
      active:true,
      criteriaName:"Default Nightlife Rating",
      weights,
      notes:byId("aiDiscoveryCriteriaNotes").value || "",
      updatedAt:nowField()
    }, {merge:true});
    setStatus("AI discovery rating criteria saved.");
  }

  function setStatus(value) {
    const el = byId("aiDiscoveryStatus");
    if (el) el.textContent = value || "";
  }

  async function mountMasterAdminPanel(options = {}) {
    db = options.db || db;
    auth = options.auth || auth;
    if (!db || !auth || !byId("aiDiscovery")) return;
    await ensureDiscoveryDefaults();
    byId("aiDiscoverySummary").innerHTML = simpleRows([
      ["Crawler schedule", "Backend scaffold supports every 4 hours or 4-6 runs per day"],
      ["Publish behavior", "Discovered records stay in aiDiscoveryQueue until Super Admin approval"],
      ["Event partners", "Ticketmaster, Eventbrite, comedy shows, and resale partners are modeled as public-source candidates"],
      ["Taxi hailing", "Third-party taxi services remain a future partner integration, not an AI crawler input"]
    ]);
    byId("aiDiscoveryRefreshBtn")?.addEventListener("click", loadDiscoveryQueue);
    byId("aiDiscoveryStatusFilter")?.addEventListener("change", loadDiscoveryQueue);
    byId("aiDiscoveryCityFilter")?.addEventListener("input", loadDiscoveryQueue);
    byId("saveAiDiscoveryCriteriaBtn")?.addEventListener("click", saveCriteria);
    byId("listingDeleteSearch")?.addEventListener("input", loadListingDeleteTool);
    byId("listingIncludeDeleted")?.addEventListener("change", loadListingDeleteTool);
    await loadCriteria();
    await loadDiscoveryQueue();
    await loadListingDeleteTool();
  }

  window.FLOQRAIDiscovery = {
    DEFAULT_SOURCES,
    DEFAULT_CRITERIA,
    mountMasterAdminPanel,
    loadDiscoveryQueue,
    loadListingDeleteTool
  };
})();
