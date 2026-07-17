/* FLOQR AI Discovery review tools. Public-source queue, datapoint validation, approval, and soft-delete tools. */
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

  function clean(value) {
    return String(value || "").trim();
  }

  function isVenueRecord(item = {}) {
    return /club|venue|lounge|bar|beach/i.test(`${item.proposedType || ""} ${item.categories || ""}`);
  }

  function isComedyRecord(item = {}) {
    return /comedy/i.test(`${item.proposedType || ""} ${item.proposedTitle || ""} ${item.categories || ""}`);
  }

  function recordKind(item = {}) {
    const text = String(item.proposedType || "").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
    if (/rooftop/i.test(text) && /bar/i.test(text)) return "Rooftop Bar";
    if (/rooftop/i.test(text)) return "Rooftop Lounge";
    if (/beach/i.test(text)) return "Beach Club";
    if (/lounge/i.test(text)) return "Lounge";
    if (/club/i.test(text)) return "Club";
    if (isComedyRecord(item)) return "Comedy Show";
    return "Event";
  }

  function queueText(item, field) {
    if (field === "description") return item.proposedDescription || item.aiSummary || "";
    if (field === "name") return item.proposedTitle || item.proposedLocationName || "";
    if (field === "phone") return item.telephone || item.phone || "";
    if (field === "website") return item.officialWebsite || item.website || "";
    return item[field] || "";
  }

  function hasAny(value) {
    if (Array.isArray(value)) return value.length > 0;
    return clean(value).length > 0;
  }

  function hasArtistsOrDjs(item = {}) {
    return hasAny(item.artistsOrDjs || item.artists || item.djs);
  }

  function hasPromoters(item = {}) {
    return hasAny(item.promoters || item.promotionGroup);
  }

  function hasInstagram(item = {}) {
    return clean(item.socialMediaHandles?.instagram || item.instagramHandle);
  }

  function artistsOrDjsDisplay(item = {}) {
    const val = item.artistsOrDjs || item.artists || item.djs;
    return Array.isArray(val) ? val.join(", ") : String(val || "");
  }

  function promotersDisplay(item = {}) {
    const val = item.promoters || item.promotionGroup;
    return Array.isArray(val) ? val.join(", ") : String(val || "");
  }

  function requiredDatapoints(item = {}) {
    const genres = Array.isArray(item.genres) ? item.genres : splitCSV(item.genres);
    const base = [
      ["name", "Name", hasAny(item.proposedTitle || item.proposedLocationName)],
      ["genres", "Genre", hasAny(genres)],
      ["artistsOrDjs", "DJ(s)/Artist(s)", hasArtistsOrDjs(item)],
      ["promoters", "Promoter(s)", hasPromoters(item)],
      ["address", "Address", hasAny(item.proposedAddress || item.address)],
      ["city", "City", hasAny(item.city)],
      ["country", "Country", hasAny(item.country)],
      ["phone", "Phone", hasAny(item.telephone || item.phone)],
      ["email", "Email", hasAny(item.email)],
      ["instagram", "Instagram", hasInstagram(item)]
    ];
    if (isComedyRecord(item)) {
      return [
        ...base,
        ["date", "Date", hasAny(item.proposedDate)],
        ["time", "Time", hasAny(item.proposedTime)]
      ];
    }
    return base;
  }

  function missingDatapoints(item = {}) {
    return requiredDatapoints(item).filter(([, , ok]) => !ok).map(([, label]) => label);
  }

  function datapointChecklist(item = {}) {
    const rows = requiredDatapoints(item);
    return `<div class="tag-row">${rows.map(([, label, ok]) => `<span>${ok ? "Pass" : "Missing"}: ${esc(label)}</span>`).join("")}</div>`;
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

  function queueField(item, field, label, wide, valueOverride) {
    const value = valueOverride !== undefined
      ? valueOverride
      : (Array.isArray(item[field]) ? item[field].join(", ") : queueText(item, field));
    return `<label class="${wide ? "wide-field" : ""}">${esc(label)}<input data-queue-field="${esc(field)}" value="${esc(value)}"/></label>`;
  }

  function sourceConfirmationsHtml(item = {}) {
    const sc = item.sourceConfirmations;
    if (!sc || typeof sc !== "object") return "";
    const flags = [];
    if (sc.googlePlaces) flags.push("Google Places");
    if (sc.publicPage) flags.push("Public page");
    if (sc.eventbrite) flags.push("Eventbrite");
    const tm = sc.ticketmaster;
    if (tm === true) flags.push("Ticketmaster");
    else if (tm === "later") flags.push("Ticketmaster (later)");
    if (!flags.length) return "";
    return `<p class="sub small"><strong>Source confirmation:</strong> ${esc(flags.join(" · "))}</p>`;
  }

  function queueTextArea(item, field, label) {
    return `<label class="wide-field">${esc(label)}<textarea data-queue-field="${esc(field)}" rows="3">${esc(queueText(item, field))}</textarea></label>`;
  }

  function sourceLinksHtml(item = {}) {
    const links = Array.isArray(item.sourceSearchLinks) ? item.sourceSearchLinks : [];
    if (!links.length) return "";
    return `<div class="queue-actions">${links.map(link => `<a class="buttonlike" target="_blank" href="${esc(link.href)}">${esc(link.label || "Open source")}</a>`).join("")}</div>`;
  }

  function parsedDataFallback(item = {}) {
    return {
      proposedType:item.proposedType || "",
      proposedTitle:item.proposedTitle || item.proposedLocationName || "",
      proposedDescription:item.proposedDescription || item.aiSummary || "",
      proposedDate:item.proposedDate || "",
      proposedTime:item.proposedTime || "",
      proposedLocationName:item.proposedLocationName || "",
      proposedAddress:item.proposedAddress || item.address || "",
      streetAddress:item.streetAddress || item.addressLine1 || String(item.proposedAddress || item.address || "").split(",")[0].trim(),
      city:item.city || "",
      stateRegion:item.stateRegion || item.region || "",
      postalCode:item.postalCode || item.zipCode || "",
      country:item.country || "",
      telephone:item.telephone || item.phone || "",
      officialWebsite:item.officialWebsite || item.website || "",
      email:item.email || "",
      sourceUrl:item.sourceUrl || "",
      ticketUrl:item.ticketUrl || "",
      categories:item.categories || [],
      genres:item.genres || [],
      artistsOrDjs:item.artistsOrDjs || item.artists || item.djs || [],
      promoters:item.promoters || [],
      promotionGroup:item.promotionGroup || "",
      socialMediaHandles:item.socialMediaHandles || {instagram:"", x:"", tiktok:"", facebook:""},
      sourceConfirmations:item.sourceConfirmations || {},
      missingDatapoints:item.missingDatapoints || [],
      crawlResultStatus:item.crawlResultStatus || ""
    };
  }

  function auditDetailsHtml(item = {}) {
    const raw = item.rawCrawlInput || item.initialCrawlData || {
      note:"No raw crawl/input audit was saved on this older record.",
      sourceUrl:item.sourceUrl || "",
      searchQuery:item.searchQuery || "",
      discoveryMode:item.discoveryMode || ""
    };
    const parsed = item.parsedData || parsedDataFallback(item);
    return `<div class="profile-grid">
      <details class="admin-detail wide-field">
        <summary>Raw crawled/input data</summary>
        <pre class="diagnostic-json">${esc(JSON.stringify(raw, null, 2))}</pre>
      </details>
      <details class="admin-detail wide-field">
        <summary>Parsed data used by FLOQR</summary>
        <pre class="diagnostic-json">${esc(JSON.stringify(parsed, null, 2))}</pre>
      </details>
    </div>`;
  }

  function queueCard(item, index) {
    item = {...parsedDataFallback(item), ...item};
    const missing = missingDatapoints(item);
    return `<div class="queue-item ai-discovery-item" data-queue-index="${index}">
      <div class="club-option-head">
        <div>
          <strong>${esc(item.proposedTitle || item.proposedLocationName || "Untitled discovery")}</strong>
          <p>${esc(recordKind(item))} - ${esc(window.FLOQRAddress?.publicLocation(item) || [item.city, item.country].filter(Boolean).join(", "))}</p>
        </div>
        <span class="status-pill">${esc(item.aiStarRating || 3)} stars / ${esc(Math.round(Number(item.aiConfidenceScore || 0) * 100))}%</span>
      </div>
      <p>${esc(item.proposedDescription || item.aiSummary || "No description yet.")}</p>
      ${missing.length ? `<p class="sub small"><strong>Missing required datapoints:</strong> ${esc(missing.join(", "))}</p>` : `<p class="sub small"><strong>Required datapoints complete.</strong> Ready for final source review and approval.</p>`}
      ${sourceConfirmationsHtml(item)}
      ${auditDetailsHtml(item)}
      ${datapointChecklist(item)}
      ${sourceLinksHtml(item)}
      <div class="profile-grid">
        ${queueField(item, "proposedType", "Type")}
        ${queueField(item, "proposedTitle", "Name")}
        ${queueTextArea(item, "description", "Description")}
        ${queueField(item, "proposedDate", "Date")}
        ${queueField(item, "proposedTime", "Time")}
        ${queueField(item, "proposedLocationName", "Location name")}
        ${queueField(item, "streetAddress", "Street address", true)}
        ${queueField(item, "phone", "Phone")}
        ${queueField(item, "website", "Official website")}
        ${queueField(item, "email", "Email")}
        ${queueField(item, "city", "City")}
        ${queueField(item, "stateRegion", "State / region")}
        ${queueField(item, "postalCode", "Postal code")}
        ${queueField(item, "country", "Country")}
        ${queueField(item, "categories", "Categories", true)}
        ${queueField(item, "genres", "Genres", true)}
        ${queueField(item, "artistsOrDjs", "DJ(s)/Artist(s)", true, artistsOrDjsDisplay(item))}
        ${queueField(item, "promoters", "Promoter(s)", true, promotersDisplay(item))}
        ${queueField(item, "instagram", "Instagram", false, item.socialMediaHandles?.instagram || item.instagramHandle || "")}
        ${queueField(item, "sourceUrl", "Source URL", true)}
        ${queueField(item, "ticketUrl", "Ticket URL", true)}
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
      const value = input.value.trim();
      if (["categories", "genres", "artistsOrDjs", "promoters"].includes(field)) next[field] = splitCSV(value);
      else if (field === "instagram") {
        next.socialMediaHandles = {...(next.socialMediaHandles || {}), instagram:value};
        next.instagramHandle = value;
      } else if (field === "description") {
        next.proposedDescription = value;
        next.aiSummary = value || next.aiSummary;
      } else if (field === "name") {
        next.proposedTitle = value;
      } else if (field === "phone") {
        next.telephone = value;
        next.phone = value;
      } else if (field === "website") {
        next.officialWebsite = value;
        next.website = value;
      } else {
        next[field] = value;
      }
    });
    next.missingDatapoints = missingDatapoints(next);
    const addressRecord = {streetAddress:next.streetAddress || next.proposedAddress || "", city:next.city || "", stateRegion:next.stateRegion || "", postalCode:next.postalCode || "", country:next.country || ""};
    next.streetAddress = addressRecord.streetAddress;
    next.proposedAddress = window.FLOQRAddress?.fullAddress(addressRecord) || [addressRecord.streetAddress, addressRecord.city, addressRecord.stateRegion, addressRecord.postalCode, addressRecord.country].filter(Boolean).join(", ");
    next.fullAddress = next.proposedAddress;
    next.locationLabel = window.FLOQRAddress?.publicLocation(addressRecord) || [addressRecord.city, addressRecord.country].filter(Boolean).join(", ");
    next.crawlResultStatus = next.missingDatapoints.length ? "missing-required-datapoints" : "ready-for-approval";
    return next;
  }

  async function approveQueueItem(card, item) {
    const edited = readEditedQueueItem(card, item);
    const missing = missingDatapoints(edited);
    if (missing.length) {
      await db.collection("aiDiscoveryQueue").doc(item.id).set({
        ...edited,
        missingDatapoints: missing,
        crawlResultStatus: "missing-required-datapoints",
        updatedAt:nowField()
      }, {merge:true});
      setStatus(`Cannot approve yet. Missing required datapoints: ${missing.join(", ")}.`);
      alert(`Cannot approve yet. Missing required datapoints: ${missing.join(", ")}.`);
      await loadDiscoveryQueue();
      return;
    }
    const proposedType = String(edited.proposedType || "").toLowerCase();
    const isVenue = /club|venue|lounge|beach|bar|rooftop/.test(proposedType);
    const id = slug(`${edited.proposedTitle || edited.proposedLocationName || "listing"}-${edited.city || ""}-${edited.country || ""}`);
    const payload = isVenue ? {
      locationName:edited.proposedTitle || edited.proposedLocationName || id,
      brandName:edited.proposedLocationName || edited.proposedTitle || id,
      type:proposedType.includes("beach") ? "beach-club" : proposedType.includes("rooftop") ? (proposedType.includes("bar") ? "rooftop-bar" : "rooftop-lounge") : proposedType.includes("lounge") ? "lounge" : proposedType.includes("bar") ? "bar" : "club",
      categories:edited.categories || [],
      genres:edited.genres || [],
      description:edited.proposedDescription || edited.aiSummary || "",
      country:edited.country || "",
      region:edited.stateRegion || "",
      stateRegion:edited.stateRegion || "",
      city:edited.city || "",
      address:edited.proposedAddress || "",
      streetAddress:edited.streetAddress || edited.proposedAddress || "",
      addressLine1:edited.streetAddress || edited.proposedAddress || "",
      fullAddress:edited.fullAddress || edited.proposedAddress || "",
      postalCode:edited.postalCode || "",
      officialWebsite:edited.officialWebsite || "",
      website:edited.officialWebsite || "",
      email:edited.email || "",
      telephone:edited.telephone || "",
      phone:edited.telephone || "",
      socialMediaHandles:edited.socialMediaHandles || {instagram:"", x:"", tiktok:"", facebook:""},
      locationLabel:window.FLOQRAddress?.publicLocation(edited) || [edited.city, edited.country].filter(Boolean).join(", "),
      activityStatus:"Approved from AI discovery",
      active:true,
      status:"active",
      visibility:"public",
      clubOwnershipStatus:"unclaimed",
      publicProfileType:"club",
      subscriptionRequiredForPublicProfileEdits:true,
      requiredProfileDatapointsComplete:true,
      publicSearchKeywords:[edited.proposedTitle, edited.proposedLocationName, edited.city, edited.country, ...(edited.categories || []), ...(edited.genres || [])].filter(Boolean),
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
      description:edited.proposedDescription || edited.aiSummary || "",
      address:edited.proposedAddress || "",
      streetAddress:edited.streetAddress || edited.proposedAddress || "",
      addressLine1:edited.streetAddress || edited.proposedAddress || "",
      fullAddress:edited.fullAddress || edited.proposedAddress || "",
      postalCode:edited.postalCode || "",
      city:edited.city || "",
      region:edited.stateRegion || "",
      stateRegion:edited.stateRegion || "",
      country:edited.country || "",
      officialWebsite:edited.officialWebsite || "",
      website:edited.officialWebsite || "",
      email:edited.email || "",
      telephone:edited.telephone || "",
      phone:edited.telephone || "",
      categories:edited.categories || [],
      category:/comedy/i.test([edited.proposedTitle, edited.categories].flat().join(" ")) ? "Comedy" : "Event",
      genres:edited.genres || [],
      ticketProvider:edited.ticketProvider || "Ticketmaster/Eventbrite/resale partner ready",
      ticketUrl:edited.ticketUrl || edited.sourceUrl || "",
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
      missingDatapoints:[],
      crawlResultStatus:"approved",
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
    if (!db || !auth || !byId("aiCrawling")) return;
    await ensureDiscoveryDefaults();
    byId("aiDiscoverySummary").innerHTML = simpleRows([
      ["Discovery mode", "Refined city/genre/venue-or-event search with Google Places + public pages"],
      ["Publish behavior", "Records remain in review until impactful datapoints are complete and Master Admin approves"],
      ["Impactful datapoints", "Name, genre, DJ(s)/artist(s), promoter(s), phone, email, Instagram, physical address"],
      ["Source confirmation", "Google Places today; Ticketmaster (later); public page when extracted"]
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
