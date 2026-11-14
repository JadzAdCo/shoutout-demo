/* FLOQR AI Discovery review tools. Public-source queue, datapoint validation, approval, and soft-delete tools. */
/* Design notes: .cursor/rules/design-notes-ai-discovery-crawl.mdc */
(function () {
  "use strict";

  const DEFAULT_SOURCES = [
    {sourceName:"Ticketmaster Discovery API", sourceType:"api", sourceUrl:"https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/", enabled:true, crawlFrequency:"every4Hours", allowedCategories:["event","concert","comedyShow","nightclub","daytimeEvent","fleaMarket","festival"]},
    {sourceName:"Eventbrite API", sourceType:"api", sourceUrl:"https://www.eventbrite.com/platform/api", enabled:true, crawlFrequency:"every4Hours", allowedCategories:["event","brunchParty","poolParty","comedyShow","daytimeEvent","fleaMarket","farmersMarket","festival"]},
    {sourceName:"Ticket resale partners", sourceType:"api", sourceUrl:"partner-config-required", enabled:false, crawlFrequency:"every4Hours", allowedCategories:["event","ticketResaleEvent"]},
    {sourceName:"Official venue websites and feeds", sourceType:"website", sourceUrl:"manual-source-list", enabled:true, crawlFrequency:"every6Hours", allowedCategories:["nightclub","beachClub","lounge","event","summerParty","comedyShow","daytimeEvent","fleaMarket","festival","communityMarket"]}
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
    importGates: (window.FLOQRDiscoveryGates && window.FLOQRDiscoveryGates.defaultImportGates()) || {venue:{}, event:{}},
    publishingRules: (window.FLOQRDiscoveryGates && window.FLOQRDiscoveryGates.defaultPublishingRules()) || {},
    pastEventPolicy: (window.FLOQRDiscoveryGates && window.FLOQRDiscoveryGates.DEFAULT_PAST_EVENT_POLICY) || {ignoreOnCrawl:1, retireAfterDays:14, removeAfterDays:14},
    notes:"Editable by Super Admin"
  };

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const splitCSV = value => String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  const slug = value => String(value || "floqr-listing").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
  let db = null;
  let auth = null;
  let queueRows = [];
  let allQueueRows = [];
  let listingRows = [];
  let countryFilter = "all";
  let importGates = DEFAULT_CRITERIA.importGates;
  let publishingRules = DEFAULT_CRITERIA.publishingRules;
  let pastEventPolicy = DEFAULT_CRITERIA.pastEventPolicy;
  let activePublishType = "nightclub";
  let csvFileText = "";

  function nowField() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function formatCollectedAt(item = {}) {
    const raw = item.collectedAtIso || item.collectedAtLabel || item.collectedAt || item.createdAt;
    if (!raw) return "";
    try {
      const date = raw.toDate ? raw.toDate() : (raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw));
      if (Number.isNaN(date.getTime())) return String(raw);
      return date.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"});
    } catch (_e) {
      return String(raw);
    }
  }

  function crawlScopeBadge(item = {}) {
    const bits = [];
    if (item.duplicateFlag) {
      const why = (item.duplicateReasons || []).join(", ") || "same establishment";
      const who = item.duplicateMatch?.matchName || item.duplicateMatch?.matchId || "another listing";
      bits.push(`<span class="status-pill dup">Possible duplicate · ${esc(why)} · ${esc(who)}</span>`);
    }
    if (item.crawlScope === "updates-only" || item.discoveryMode === "onboarded-update-scan") {
      bits.push(`<span class="status-pill">Updates only · already onboarded</span>`);
    } else if (item.crawlScope === "full-new-listing") {
      bits.push(`<span class="status-pill">New listing crawl</span>`);
    }
    return bits.join(" ");
  }

  function countryKey(item = {}) {
    return String(item.country || "").trim() || "Unspecified";
  }

  function renderCountryTabs(rows = []) {
    const wrap = byId("aiDiscoveryCountryTabs");
    if (!wrap) return;
    const counts = new Map();
    rows.forEach(row => {
      const key = countryKey(row);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const countries = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));
    const tabs = [
      {id: "all", label: `All countries (${rows.length})`},
      ...countries.map(name => ({id: name, label: `${name} (${counts.get(name)})`}))
    ];
    if (!tabs.some(tab => tab.id === countryFilter)) countryFilter = "all";
    wrap.innerHTML = tabs.map(tab =>
      `<button type="button" class="admin-subtab${tab.id === countryFilter ? " active" : ""}" data-discovery-country="${esc(tab.id)}">${esc(tab.label)}</button>`
    ).join("");
    wrap.querySelectorAll("[data-discovery-country]").forEach(button => {
      button.addEventListener("click", () => {
        countryFilter = button.dataset.discoveryCountry || "all";
        renderQueueCards();
        renderCountryTabs(allQueueRows);
      });
    });
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

  function isDaytimeRecord(item = {}) {
    const hay = `${item.proposedType || ""} ${item.proposedTitle || ""} ${(item.categories || []).join(" ")} ${(item.genres || []).join(" ")}`;
    return /daytime|flea|farmers?\s*market|community\s*market|fall\s*festival|day\s*festival|street\s*fair|outdoor\s*market|harvest/i.test(hay);
  }

  function recordKind(item = {}) {
    if (item.kindLabel) return item.entityKind === "event" ? `Event · ${item.kindLabel}` : `Club · ${item.kindLabel}`;
    const classified = window.FLOQRDiscoveryGates?.classifyEntity?.(item);
    if (classified?.kindLabel) {
      return classified.entityKind === "event" ? `Event · ${classified.kindLabel}` : `Club · ${classified.kindLabel}`;
    }
    const text = String(item.proposedType || "").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
    if (/rooftop/i.test(text) && /bar/i.test(text)) return "Club · Rooftop Bar";
    if (/rooftop/i.test(text)) return "Club · Rooftop Lounge";
    if (/beach/i.test(text)) return "Club · Beach Club";
    if (/lounge/i.test(text)) return "Club · Lounge";
    if (/club/i.test(text)) return "Club · Nightclub";
    if (isComedyRecord(item)) return "Event · Comedy Show";
    if (isDaytimeRecord(item)) {
      if (/flea/i.test(text + (item.proposedTitle || ""))) return "Event · Flea Market";
      if (/farmers/i.test(text + (item.proposedTitle || ""))) return "Event · Farmers Market";
      if (/festival/i.test(text + (item.proposedTitle || ""))) return "Event · Festival";
      return "Event · Daytime Event";
    }
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
    const api = window.FLOQRDiscoveryGates;
    const catalog = api?.IMPORT_GATE_FIELDS || [];
    const event = api?.isEventRecord ? api.isEventRecord(item) : isDaytimeRecord(item) || isComedyRecord(item);
    const rule = api?.publishingRuleFor ? api.publishingRuleFor(item, gateBundle()) : null;
    const map = rule?.fields || (event ? (importGates.event || {}) : (importGates.venue || {}));
    const rows = catalog.filter(field => {
      if (field.appliesTo === "venue" && event) return false;
      if (field.appliesTo === "event" && !event) return false;
      if (field.key === "phone" || field.key === "email") return false;
      return map[field.key] === 1;
    }).map(field => {
      const ok = api?.datapointPresent ? api.datapointPresent(item, field.key) : false;
      const label = event && field.key === "promoters" ? "Organizer(s) / Promoter(s)" : field.label;
      return [field.key, label, ok];
    });
    const contactMode = rule?.contactMode || "phoneOrEmail";
    if (contactMode === "phoneOrEmail") {
      const ok = !!(api?.datapointPresent?.(item, "phone") || api?.datapointPresent?.(item, "email"));
      rows.push(["contact", "Phone or Email", ok]);
    } else if (contactMode === "phone" || contactMode === "email") {
      const key = contactMode;
      rows.push([key, key === "phone" ? "Phone" : "Email", !!api?.datapointPresent?.(item, key)]);
    }
    return rows;
  }

  function gateBundle() {
    return {publishingRules, ...importGates};
  }

  function missingDatapoints(item = {}) {
    if (window.FLOQRDiscoveryGates?.missingDatapoints) {
      return window.FLOQRDiscoveryGates.missingDatapoints(item, gateBundle());
    }
    return requiredDatapoints(item).filter(([, , ok]) => !ok).map(([, label]) => label);
  }

  function writeDiscoveryLog(action, message, details) {
    window.FLOQRLog?.write?.({
      category: "aiCrawl",
      action,
      message,
      details: details || null,
      source: "master-admin"
    });
  }

  function datapointChecklist(item = {}) {
    const rows = requiredDatapoints(item);
    return `<div class="tag-row">${rows.map(([, label, ok]) => `<span>${ok ? "Pass" : "Missing"}: ${esc(label)}</span>`).join("")}</div>`;
  }

  async function getCollectionSafe(name, limit = 500, orderByField = "") {
    try {
      let query = db.collection(name);
      if (orderByField) query = query.orderBy(orderByField, "desc");
      const snap = await query.limit(limit).get();
      return snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch(e) {
      // Unordered limit returns document-id order and hides recent crawl writes.
      if (orderByField) {
        console.warn(`Ordered read failed for ${name} (${orderByField}); falling back unordered:`, e.message);
        try {
          const snap = await db.collection(name).limit(limit).get();
          return snap.docs.map(d => ({id:d.id, ...d.data()}));
        } catch (fallbackError) {
          console.warn(`Could not read ${name}:`, fallbackError.message);
          return [];
        }
      }
      console.warn(`Could not read ${name}:`, e.message);
      return [];
    }
  }

  async function ensureDiscoveryDefaults() {
    if (!db) return;
    try {
      const criteriaRef = db.collection("aiDiscoveryRatingCriteria").doc("defaultNightlifeRating");
      const criteriaSnap = await criteriaRef.get();
      if (!criteriaSnap.exists) {
        await criteriaRef.set({...DEFAULT_CRITERIA, createdAt:nowField(), updatedAt:nowField()});
      } else {
        const data = criteriaSnap.data() || {};
        const patch = {};
        if (!data.importGates) patch.importGates = DEFAULT_CRITERIA.importGates;
        if (!data.publishingRules) patch.publishingRules = DEFAULT_CRITERIA.publishingRules;
        if (!data.pastEventPolicy) patch.pastEventPolicy = DEFAULT_CRITERIA.pastEventPolicy;
        if (Object.keys(patch).length) await criteriaRef.set({...patch, updatedAt:nowField()}, {merge:true});
      }
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
      socialMediaHandles:item.socialMediaHandles || {instagram:"", x:"", tiktok:"", facebook:"", floqrHandle:""},
      sourceConfirmations:item.sourceConfirmations || {},
      amenities:item.amenities || [],
      agePolicy:item.agePolicy || "",
      dressCode:item.dressCode || "",
      cuisine:item.cuisine || "",
      tagline:item.tagline || "",
      hours:item.hours || "",
      hoursStructured:item.hoursStructured || null,
      timeZone:item.timeZone || "",
      menuUrl:item.menuUrl || "",
      reservationsUrl:item.reservationsUrl || "",
      contactUrl:item.contactUrl || "",
      missingDatapoints:item.missingDatapoints || [],
      crawlResultStatus:item.crawlResultStatus || "",
      venueDatapointsCaptured:item.venueDatapointsCaptured || null
    };
  }

  function auditDetailsHtml(item = {}) {
    const raw = item.rawCrawlInput || item.initialCrawlData || {
      note:"No source snapshot was saved on this older record.",
      sourceUrl:item.sourceUrl || "",
      searchQuery:item.searchQuery || "",
      discoveryMode:item.discoveryMode || ""
    };
    const parsed = item.parsedData || parsedDataFallback(item);
    return `<div class="profile-grid">
      <details class="admin-detail wide-field">
        <summary>Advanced: source snapshot</summary>
        <pre class="diagnostic-json">${esc(JSON.stringify(raw, null, 2))}</pre>
      </details>
      <details class="admin-detail wide-field">
        <summary>Advanced: what FLOQR understood</summary>
        <pre class="diagnostic-json">${esc(JSON.stringify(parsed, null, 2))}</pre>
      </details>
    </div>`;
  }

  function readinessBanner(item = {}, missing = []) {
    const status = String(item.status || "pendingReview");
    if (status === "needsResearch") {
      return `<p class="sub small"><strong>Needs research.</strong> Someone still needs to look up: ${esc((item.missingDatapoints || missing).join(", ") || "contact or lineup details")}.</p>`;
    }
    if (missing.length) {
      return `<p class="sub small"><strong>Still need:</strong> ${esc(missing.join(", "))} — fill the fields below, or choose Needs research.</p>`;
    }
    return `<p class="sub small"><strong>Ready to publish</strong> after a final source check.</p>`;
  }

  function queueCard(item, index) {
    item = {...parsedDataFallback(item), ...item};
    const missing = missingDatapoints(item);
    const duplicateBlocks = item.duplicateFlag && item.crawlScope !== "updates-only";
    const ready = missing.length === 0 && !duplicateBlocks && String(item.status || "pendingReview") !== "approved";
    const collected = formatCollectedAt(item);
    return `<div class="queue-item ai-discovery-item${item.duplicateFlag ? " is-duplicate" : ""}" data-queue-index="${index}" data-queue-id="${esc(item.id || "")}" data-onboard-ready="${ready ? "1" : "0"}">`
      <div class="club-option-head">
        <div>
          <label class="consent-line"><input type="checkbox" data-onboard-select ${ready ? "" : "disabled"} aria-label="Select for mass onboard"/> ${ready ? "Ready — select to onboard" : "Not ready to onboard"}</label>
          <strong>${esc(item.proposedTitle || item.proposedLocationName || "Untitled discovery")}</strong>
          <p>${esc(recordKind(item))} - ${esc(window.FLOQRAddress?.publicLocation(item) || [item.city, item.country].filter(Boolean).join(", "))}</p>
          <p class="discovery-meta">${collected ? `Collected ${esc(collected)}` : "Collected time unavailable"}${item.socialPagesFetched?.length ? ` · Social pages checked: ${esc(item.socialPagesFetched.length)}` : ""}</p>
          ${duplicateBlocks ? `<p class="sub small"><strong>Do not import as a new club.</strong> Same establishment as ${esc(item.duplicateMatch?.matchName || item.duplicateMatch?.matchId || "an existing listing")} (${esc((item.duplicateReasons || []).join(", ") || "address, name, or phone")}). Use Updates only or Mark Duplicate.</p>` : ""}
          ${missing.length ? `<p class="sub small"><strong>Missing datapoints:</strong> ${esc(missing.join(", "))}</p>` : `<p class="sub small"><strong>Onboard ready</strong> — import datapoints Master Admin selected are present.</p>`}`
        </div>
        <div>
          <span class="status-pill">${esc(item.aiStarRating || 3)} stars / ${esc(Math.round(Number(item.aiConfidenceScore || 0) * 100))}%</span>
          ${crawlScopeBadge(item)}
        </div>
      </div>
      <p>${esc(item.proposedDescription || item.aiSummary || "No description yet.")}</p>
      ${readinessBanner(item, missing)}
      ${sourceConfirmationsHtml(item)}
      ${datapointChecklist(item)}
      ${item.venueDatapointsCaptured ? `<p class="sub small"><strong>Venue public-profile datapoints captured:</strong> ${esc(item.venueDatapointsCaptured.capturedCount || 0)} / ${(window.FLOQRVenueDatapoints?.VENUE_PUBLIC_PROFILE_DATAPOINTS || []).length || 40}</p>` : ""}
      ${window.FLOQRVenueDatapoints?.checklistHtml ? window.FLOQRVenueDatapoints.checklistHtml() : ""}
      ${sourceLinksHtml(item)}
      <div class="profile-grid">
        ${queueField(item, "proposedType", "Type")}
        ${queueField(item, "proposedTitle", "Name")}
        ${queueTextArea(item, "description", "Description")}
        ${queueField(item, "tagline", "Tagline")}
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
        ${queueField(item, "facebook", "Facebook", false, item.socialMediaHandles?.facebook || "")}
        ${queueField(item, "tiktok", "TikTok", false, item.socialMediaHandles?.tiktok || "")}
        ${queueField(item, "x", "X / Twitter", false, item.socialMediaHandles?.x || "")}
        ${queueField(item, "amenities", "Amenities", true, Array.isArray(item.amenities) ? item.amenities.join(", ") : item.amenities || "")}
        ${queueField(item, "agePolicy", "Age policy")}
        ${queueField(item, "dressCode", "Dress code")}
        ${queueField(item, "cuisine", "Cuisine / concept")}
        ${queueField(item, "hours", "Hours summary", true)}
        ${queueField(item, "timeZone", "Time zone")}
        ${queueField(item, "menuUrl", "Menu URL", true)}
        ${queueField(item, "reservationsUrl", "Reservations URL", true)}
        ${queueField(item, "contactUrl", "Contact URL", true)}
        ${queueField(item, "sourceUrl", "Source URL", true)}
        ${queueField(item, "ticketUrl", "Ticket URL", true)}
      </div>
      ${auditDetailsHtml(item)}
      ${item.aiRatingReasons?.length ? `<div class="tag-row">${item.aiRatingReasons.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
      <div class="queue-actions">
        <button type="button" class="primary" data-discovery-action="publish"${(missing.length || duplicateBlocks) ? " disabled" : ""}>Publish</button>
        <button type="button" data-discovery-action="save">Save</button>
        <button type="button" data-discovery-action="needs-research">Needs research</button>
        <button type="button" data-discovery-action="reject">Reject</button>
        <button type="button" data-discovery-action="duplicate">Mark Duplicate</button>
        <button type="button" data-discovery-action="delete">Delete</button>
        ${item.sourceUrl ? `<a class="buttonlike" target="_blank" href="${esc(item.sourceUrl)}">Open source</a>` : ""}
      </div>
    </div>`;
  }

  function renderOnboardReport(rows = []) {
    const wrap = byId("aiDiscoveryOnboardReport");
    if (!wrap) return;
    const pending = rows.filter(item => {
      const st = String(item.status || "pendingReview");
      return st === "pendingReview" || st === "needsResearch";
    });
    if (!pending.length) {
      wrap.innerHTML = "<p class='sub'>No pending discovery records in this filter.</p>";
      return;
    }
    const scored = pending.map(item => {
      const merged = {...parsedDataFallback(item), ...item};
      const missing = missingDatapoints(merged);
      return {
        item: merged,
        missing,
        ready: missing.length === 0 && !(merged.duplicateFlag && merged.crawlScope !== "updates-only"),
        country: merged.country || "—",
        city: merged.city || "—",
        genre: Array.isArray(merged.genres) ? merged.genres.join(", ") : String(merged.genres || "—"),
        name: merged.proposedTitle || merged.proposedLocationName || "Untitled",
        type: recordKind(merged),
        collected: formatCollectedAt(merged) || "—"
      };
    }).sort((a, b) =>
      a.country.localeCompare(b.country) ||
      a.city.localeCompare(b.city) ||
      a.genre.localeCompare(b.genre) ||
      a.name.localeCompare(b.name)
    );
    const readyN = scored.filter(r => r.ready).length;
    const missingFreq = {};
    scored.forEach(r => r.missing.forEach(m => { missingFreq[m] = (missingFreq[m] || 0) + 1; }));
    const freqRows = Object.entries(missingFreq).sort((a, b) => b[1] - a[1])
      .map(([label, count]) => `<tr><td>${esc(label)}</td><td>${esc(count)}</td></tr>`).join("");
    wrap.innerHTML = `
      <p class="sub small"><strong>Onboard readiness:</strong> ${esc(readyN)} ready · ${esc(scored.length - readyN)} missing datapoints · ${esc(scored.length)} pending shown</p>
      ${freqRows ? `<details class="admin-detail"><summary>Missing datapoint frequency</summary><div class="discovery-queue-table-wrap"><table class="discovery-queue-table is-compact"><thead><tr><th>Datapoint</th><th>Count</th></tr></thead><tbody>${freqRows}</tbody></table></div></details>` : ""}
      <div class="discovery-queue-table-wrap">
        <table class="discovery-queue-table">
          <thead>
            <tr>
              <th>Country</th>
              <th>City</th>
              <th>Genre</th>
              <th>Name</th>
              <th>Type</th>
              <th>Collected</th>
              <th>Ready</th>
              <th>Missing</th>
            </tr>
          </thead>
          <tbody>
            ${scored.map(r => `<tr class="${r.ready ? "is-ready" : ""}">
              <td>${esc(r.country)}</td>
              <td>${esc(r.city)}</td>
              <td>${esc(r.genre)}</td>
              <td class="discovery-name">${esc(r.name)}</td>
              <td>${esc(r.type)}</td>
              <td>${esc(r.collected)}</td>
              <td>${r.ready ? "Yes" : "No"}</td>
              <td class="discovery-missing">${esc(r.missing.join(", ") || "—")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderQueueCards() {
    const wrap = byId("aiDiscoveryQueueList");
    if (!wrap) return;
    const readiness = byId("aiDiscoveryReadinessFilter")?.value || "all";
    queueRows = allQueueRows.filter(item => {
      if (countryFilter !== "all" && countryKey(item) !== countryFilter) return false;
      if (readiness === "all") return true;
      const merged = {...parsedDataFallback(item), ...item};
      if (readiness === "duplicates") return !!merged.duplicateFlag;
      const missing = missingDatapoints(merged);
      const duplicateBlocks = merged.duplicateFlag && merged.crawlScope !== "updates-only";
      if (readiness === "ready") return missing.length === 0 && !duplicateBlocks;
      if (readiness === "notReady") return missing.length > 0 || duplicateBlocks;
      return true;
    });
    renderOnboardReport(allQueueRows);
    wrap.innerHTML = queueRows.length ? queueRows.map(queueCard).join("") : "<p class='sub'>No discovery records matched.</p>";
    wrap.querySelectorAll("[data-discovery-action]").forEach(button => {
      const card = button.closest(".ai-discovery-item");
      const item = queueRows[Number(card.dataset.queueIndex)];
      button.addEventListener("click", async () => {
        const action = button.dataset.discoveryAction;
        if (action === "publish" || action === "approve") return approveQueueItem(card, item);
        if (action === "save") return saveQueueItem(card, item);
        if (action === "needs-research") return markNeedsResearch(card, item);
        if (action === "reject") return setQueueStatus(item, "rejected");
        if (action === "duplicate") return setQueueStatus(item, "pendingReview", {duplicateMarked:true, duplicateFlag:true, crawlResultStatus:"possible-duplicate", aiRatingReasons:[...(item.aiRatingReasons || []), "Marked duplicate by Super Admin"]});
        if (action === "delete" && confirm("Remove this discovery card from active review?")) return setQueueStatus(item, "deleted");
      });
    });
  }

  function readEditedQueueItem(card, original) {
    const next = {...original};
    card.querySelectorAll("[data-queue-field]").forEach(input => {
      const field = input.dataset.queueField;
      const value = input.value.trim();
      if (["categories", "genres", "artistsOrDjs", "promoters", "amenities"].includes(field)) next[field] = splitCSV(value);
      else if (field === "instagram" || field === "facebook" || field === "tiktok" || field === "x") {
        next.socialMediaHandles = {...(next.socialMediaHandles || {}), [field]: value};
        if (field === "instagram") next.instagramHandle = value;
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

  async function publishDiscoveryRecord(edited, itemId) {
    const api = window.FLOQRDiscoveryGates;
    const decision = api?.publishBlockers ? api.publishBlockers(edited, gateBundle()) : {
      ok: !missingDatapoints(edited).length && !(edited.duplicateFlag && edited.crawlScope !== "updates-only"),
      blockers: missingDatapoints(edited)
    };
    if (!decision.ok) {
      writeDiscoveryLog("publish_blocked", `Blocked ${edited.proposedTitle || itemId}`, {blockers: decision.blockers, id: itemId});
      return { ok: false, missing: decision.blockers || decision.missing || [] };
    }
    const proposedType = String(edited.proposedType || "").toLowerCase();
    const isVenue = edited.entityKind === "venue" || /club|venue|lounge|beach|bar|rooftop/.test(proposedType);
    const id = (edited.crawlScope === "updates-only" && edited.onboardedListingId)
      ? edited.onboardedListingId
      : slug(`${edited.proposedTitle || edited.proposedLocationName || "listing"}-${edited.city || ""}-${edited.country || ""}`);
    const venueType = proposedType.includes("beach") ? "beach-club" : proposedType.includes("rooftop") ? (proposedType.includes("bar") ? "rooftop-bar" : "rooftop-lounge") : proposedType.includes("lounge") ? "lounge" : proposedType.includes("bar") ? "bar" : "club";
    const enriched = window.FLOQRVenueDatapoints?.enrichVenueRecord?.(edited, {html: "", text: `${edited.proposedDescription || ""} ${edited.hours || ""}`}) || edited;
    const venueCore = window.FLOQRVenueDatapoints?.clubLocationPayloadFromDiscovery?.(enriched, {type: venueType}) || {};
    const payload = isVenue ? {
      ...venueCore,
      locationLabel:window.FLOQRAddress?.publicLocation(enriched) || [enriched.city, enriched.country].filter(Boolean).join(", "),
      activityStatus:"Approved from AI discovery",
      active:true,
      status:"active",
      visibility:"public",
      clubOwnershipStatus:"unclaimed",
      publicProfileType:"club",
      subscriptionRequiredForPublicProfileEdits:true,
      requiredProfileDatapointsComplete:true,
      publicSearchKeywords:[enriched.proposedTitle, enriched.proposedLocationName, enriched.city, enriched.country, ...(enriched.categories || []), ...(enriched.genres || []), ...(enriched.amenities || [])].filter(Boolean),
      approvedFromDiscoveryQueueId:itemId,
      sourceUrl:enriched.sourceUrl || "",
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
      approvedFromDiscoveryQueueId:itemId,
      updatedAt:nowField()
    };
    await db.collection(isVenue ? "clubLocations" : "events").doc(id).set(payload, {merge:true});
    await db.collection("aiDiscoveryQueue").doc(itemId).set({
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
    writeDiscoveryLog("publish", `Published ${payload.locationName || payload.eventName || id}`, {
      collection: isVenue ? "clubLocations" : "events",
      id,
      crawlType: edited.proposedType || ""
    });
    return { ok: true, approvedRecordId: id, collection: isVenue ? "clubLocations" : "events" };
  }

  async function approveQueueItem(card, item) {
    const edited = readEditedQueueItem(card, item);
    const result = await publishDiscoveryRecord(edited, item.id);
    if (!result.ok) {
      await db.collection("aiDiscoveryQueue").doc(item.id).set({
        ...edited,
        missingDatapoints: result.missing,
        crawlResultStatus: "missing-required-datapoints",
        updatedAt:nowField()
      }, {merge:true});
      setStatus(`Cannot publish yet. Still need: ${result.missing.join(", ")}. Save your edits, or use Needs research if you will come back later.`);
      alert(`Cannot publish yet.\n\nStill need: ${result.missing.join(", ")}\n\nSave keeps the card in review. Fill those fields, then Publish.`);
      await loadDiscoveryQueue();
      return;
    }
    setStatus("Published discovery record.");
    await loadDiscoveryQueue();
  }

  async function saveQueueItem(card, item) {
    const edited = readEditedQueueItem(card, item);
    const missing = missingDatapoints(edited);
    const duplicateBlocks = edited.duplicateFlag && edited.crawlScope !== "updates-only";
    const status = String(item.status || "pendingReview");
    const keepStatus = status === "needsResearch" ? "needsResearch" : "pendingReview";
    await db.collection("aiDiscoveryQueue").doc(item.id).set({
      ...edited,
      status: keepStatus,
      missingDatapoints: missing,
      crawlResultStatus: duplicateBlocks
        ? "possible-duplicate"
        : (missing.length ? "missing-required-datapoints" : "ready-for-approval"),
      lastSavedByUid: auth.currentUser?.uid || "",
      lastSavedAt: nowField(),
      updatedAt: nowField()
    }, {merge: true});
    writeDiscoveryLog("queue_write", `Saved ${edited.proposedTitle || item.id} without publishing`, {
      id: item.id,
      missing,
      status: keepStatus
    });
    setStatus(missing.length
      ? `Saved. Still need: ${missing.join(", ")} — not published.`
      : "Saved. Card is ready — Publish when you want it live.");
    await loadDiscoveryQueue();
  }

  function selectedOnboardCards() {
    const wrap = byId("aiDiscoveryQueueList");
    if (!wrap) return [];
    return [...wrap.querySelectorAll(".ai-discovery-item")].filter(card => {
      const box = card.querySelector("[data-onboard-select]");
      return box && box.checked && !box.disabled;
    });
  }

  function selectAllReadyForOnboard() {
    const wrap = byId("aiDiscoveryQueueList");
    if (!wrap) return;
    wrap.querySelectorAll("[data-onboard-select]:not(:disabled)").forEach(box => { box.checked = true; });
    setStatus(`Selected ${wrap.querySelectorAll("[data-onboard-select]:checked").length} ready discovery card(s).`);
  }

  function clearOnboardSelection() {
    const wrap = byId("aiDiscoveryQueueList");
    if (!wrap) return;
    wrap.querySelectorAll("[data-onboard-select]").forEach(box => { box.checked = false; });
    setStatus("Cleared mass-onboard selection.");
  }

  async function massOnboardSelected() {
    const cards = selectedOnboardCards();
    if (!cards.length) {
      setStatus("Select one or more ready discovery cards first.");
      alert("Select one or more ready discovery cards first.");
      return;
    }
    if (!confirm(`Onboard ${cards.length} ready club/event record(s) to live listings?`)) return;
    let ok = 0;
    const blocked = [];
    for (const card of cards) {
      const item = queueRows[Number(card.dataset.queueIndex)];
      if (!item?.id) continue;
      const edited = readEditedQueueItem(card, item);
      const result = await publishDiscoveryRecord(edited, item.id);
      if (result.ok) ok += 1;
      else blocked.push(`${edited.proposedTitle || item.id}: ${result.missing.join(", ")}`);
    }
    setStatus(ok
      ? `Mass onboard complete: ${ok} published${blocked.length ? `; ${blocked.length} skipped (still missing datapoints)` : ""}.`
      : `Mass onboard skipped. Still missing datapoints on selected cards.`);
    if (blocked.length) alert(`Skipped ${blocked.length} card(s):\n\n${blocked.slice(0, 12).join("\n")}${blocked.length > 12 ? "\n…" : ""}`);
    await loadDiscoveryQueue();
  }

  async function markNeedsResearch(card, item) {
    const edited = readEditedQueueItem(card, item);
    const missing = missingDatapoints(edited);
    await db.collection("aiDiscoveryQueue").doc(item.id).set({
      ...edited,
      status: "needsResearch",
      missingDatapoints: missing,
      crawlResultStatus: "needs-research",
      followUpRequestedAt: nowField(),
      followUpRequestedByUid: auth.currentUser?.uid || "",
      reviewedByUid: auth.currentUser?.uid || "",
      reviewedAt: nowField(),
      updatedAt: nowField()
    }, {merge:true});
    setStatus(missing.length
      ? `Marked for research. Still need: ${missing.join(", ")}.`
      : "Marked for research.");
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

  function jumpToStatus(status) {
    const sel = byId("aiDiscoveryStatusFilter");
    if (sel && status) sel.value = status;
    byId("aiDiscoveryQueueList")?.scrollIntoView({behavior: "smooth", block: "start"});
    return loadDiscoveryQueue();
  }

  function applyClientDiscoveryStamp(item, universe) {
    const api = window.FLOQRDiscoveryGates;
    if (!api) return item;
    const classified = api.classifyEntity ? api.classifyEntity(item) : {};
    let next = {
      ...item,
      entityKind: item.entityKind || classified.entityKind,
      venueCategory: item.venueCategory || classified.venueCategory,
      eventCategory: item.eventCategory || classified.eventCategory,
      kindLabel: item.kindLabel || classified.kindLabel,
      listingClass: item.listingClass || classified.listingClass,
      proposedType: item.proposedType || classified.proposedType
    };
    if (api.findDuplicates && api.applyDuplicateStamp) {
      next = api.applyDuplicateStamp(next, api.findDuplicates(next, universe));
    }
    next.missingDatapoints = missingDatapoints(next);
    const start = Date.parse(next.eventStartIso || `${next.proposedDate || ""}T${next.proposedTime || "12:00"}`);
    if (Number.isFinite(start) && start < Date.now() && (next.entityKind === "event" || next.proposedDate)) {
      next.lifecycleStatus = next.lifecycleStatus === "retired" ? "retired" : "past";
    }
    if (next.duplicateFlag && next.crawlScope !== "updates-only") {
      next.crawlResultStatus = "possible-duplicate";
    } else if (next.lifecycleStatus === "past") {
      next.crawlResultStatus = "past-event";
    } else {
      next.crawlResultStatus = next.missingDatapoints.length ? "missing-required-datapoints" : "ready-for-approval";
    }
    return next;
  }

  async function loadDiscoveryQueue() {
    const status = byId("aiDiscoveryStatusFilter")?.value || "pendingReview";
    const city = String(byId("aiDiscoveryCityFilter")?.value || "").toLowerCase();
    const [rows, clubs, events] = await Promise.all([
      getCollectionSafe("aiDiscoveryQueue", 500, "createdAt"),
      getCollectionSafe("clubLocations", 800),
      getCollectionSafe("events", 400)
    ]);
    const universe = [
      ...clubs.map(row => ({...row, collection: "clubLocations"})),
      ...events.map(row => ({...row, collection: "events", entityKind: row.entityKind || "event"})),
      ...rows.map(row => ({...row, collection: "aiDiscoveryQueue"}))
    ];
    allQueueRows = rows.filter(item => {
      const rowStatus = String(item.status || "pendingReview");
      if (status === "pendingReview") {
        if (rowStatus !== "pendingReview" && rowStatus !== "needsResearch") return false;
      } else if (status !== "all" && rowStatus !== status) {
        return false;
      }
      if (city && !String(item.city || "").toLowerCase().includes(city)) return false;
      return true;
    }).map(item => applyClientDiscoveryStamp(item, universe));
    renderCountryTabs(allQueueRows);
    renderQueueCards();
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

  function syncCriteriaWeightsToForm(weights = {}) {
    const merged = {...DEFAULT_CRITERIA.weights, ...(weights || {})};
    document.querySelectorAll("[data-weight-key]").forEach(input => {
      const key = input.dataset.weightKey;
      if (key && merged[key] != null) input.value = String(merged[key]);
    });
    const jsonEl = byId("aiDiscoveryCriteriaJson");
    if (jsonEl) jsonEl.value = JSON.stringify(merged, null, 2);
  }

  function readCriteriaWeightsFromForm() {
    const weights = {...DEFAULT_CRITERIA.weights};
    document.querySelectorAll("[data-weight-key]").forEach(input => {
      const key = input.dataset.weightKey;
      if (!key) return;
      const num = Number(input.value);
      weights[key] = Number.isFinite(num) ? num : weights[key];
    });
    const jsonEl = byId("aiDiscoveryCriteriaJson");
    if (jsonEl) jsonEl.value = JSON.stringify(weights, null, 2);
    return weights;
  }

  function renderPublishingRuleForm() {
    const api = window.FLOQRDiscoveryGates;
    const catalog = api?.CRAWL_TYPE_CATALOG || [];
    const modes = api?.CONTACT_MODES || [];
    const fields = api?.IMPORT_GATE_FIELDS || [];
    publishingRules = api?.normalizePublishingRules ? api.normalizePublishingRules(publishingRules) : publishingRules;
    const typeSel = byId("aiDiscoveryPublishType");
    const modeSel = byId("aiDiscoveryContactMode");
    if (typeSel && !typeSel.options.length) {
      typeSel.innerHTML = catalog.map(type => `<option value="${esc(type.key)}">${esc(type.label)} (${type.family})</option>`).join("");
    }
    if (typeSel) typeSel.value = activePublishType;
    if (modeSel && !modeSel.options.length) {
      modeSel.innerHTML = modes.map(mode => `<option value="${esc(mode.key)}">${esc(mode.label)}</option>`).join("");
    }
    const rule = publishingRules[activePublishType] || publishingRules.nightclub;
    if (modeSel) modeSel.value = rule?.contactMode || "phoneOrEmail";
    const wrap = byId("aiDiscoveryPublishGates");
    if (wrap) {
      const family = catalog.find(type => type.key === activePublishType)?.family || "venue";
      wrap.innerHTML = fields.filter(field => field.appliesTo === "both" || field.appliesTo === family).map(field => {
        if (field.key === "phone" || field.key === "email") return "";
        const checked = rule?.fields?.[field.key] === 1 ? " checked" : "";
        return `<label><input type="checkbox" data-publish-gate="${esc(field.key)}"${checked}/> ${esc(field.label)}</label>`;
      }).join("");
    }
    const hint = byId("aiDiscoveryPublishRuleHint");
    if (hint) {
      const label = catalog.find(type => type.key === activePublishType)?.label || activePublishType;
      hint.textContent = `${label}: ticked fields plus the contact rule must be filled before Publish, Onboard, or auto-publish. Save keeps the card in review. Promoter(s) and Instagram stay optional unless ticked.`;
    }
  }

  function readPublishingRuleFromForm() {
    const api = window.FLOQRDiscoveryGates;
    publishingRules = api?.normalizePublishingRules ? api.normalizePublishingRules(publishingRules) : publishingRules;
    const type = byId("aiDiscoveryPublishType")?.value || activePublishType;
    activePublishType = type;
    const fields = {...(publishingRules[type]?.fields || {})};
    document.querySelectorAll("[data-publish-gate]").forEach(input => {
      if (!input.dataset.publishGate) return;
      fields[input.dataset.publishGate] = input.checked ? 1 : 0;
    });
    publishingRules[type] = {
      fields,
      contactMode: byId("aiDiscoveryContactMode")?.value || "phoneOrEmail"
    };
    importGates = api?.defaultImportGates ? api.defaultImportGates() : importGates;
    if (publishingRules.nightclub?.fields) importGates.venue = {...publishingRules.nightclub.fields};
    if (publishingRules.daytimeEvent?.fields) importGates.event = {...publishingRules.daytimeEvent.fields};
    return publishingRules;
  }

  function renderImportGateCheckboxes(gates = DEFAULT_CRITERIA.importGates) {
    const api = window.FLOQRDiscoveryGates;
    importGates = api?.normalizeImportGates ? api.normalizeImportGates(gates) : gates;
    renderPublishingRuleForm();
  }

  function readImportGatesFromForm() {
    readPublishingRuleFromForm();
    return importGates;
  }

  async function loadCriteria() {
    const snap = await db.collection("aiDiscoveryRatingCriteria").doc("defaultNightlifeRating").get();
    const criteria = snap.exists ? snap.data() : DEFAULT_CRITERIA;
    const api = window.FLOQRDiscoveryGates;
    syncCriteriaWeightsToForm(criteria.weights || DEFAULT_CRITERIA.weights);
    if (byId("aiDiscoveryCriteriaNotes")) byId("aiDiscoveryCriteriaNotes").value = criteria.notes || "";
    publishingRules = api?.normalizePublishingRules
      ? api.normalizePublishingRules(criteria.publishingRules || DEFAULT_CRITERIA.publishingRules)
      : (criteria.publishingRules || DEFAULT_CRITERIA.publishingRules);
    pastEventPolicy = api?.normalizePastEventPolicy
      ? api.normalizePastEventPolicy(criteria.pastEventPolicy || DEFAULT_CRITERIA.pastEventPolicy)
      : (criteria.pastEventPolicy || DEFAULT_CRITERIA.pastEventPolicy);
    if (byId("aiDiscoveryIgnorePast")) byId("aiDiscoveryIgnorePast").checked = pastEventPolicy.ignoreOnCrawl !== 0;
    if (byId("aiDiscoveryRetireDays")) byId("aiDiscoveryRetireDays").value = String(pastEventPolicy.retireAfterDays ?? 14);
    if (byId("aiDiscoveryRemoveDays")) byId("aiDiscoveryRemoveDays").value = String(pastEventPolicy.removeAfterDays ?? 14);
    renderImportGateCheckboxes(criteria.importGates || DEFAULT_CRITERIA.importGates);
  }

  async function saveCriteria() {
    const weights = readCriteriaWeightsFromForm();
    const gates = readImportGatesFromForm();
    await db.collection("aiDiscoveryRatingCriteria").doc("defaultNightlifeRating").set({
      active:true,
      criteriaName:"Default Nightlife Rating",
      weights,
      importGates: gates,
      publishingRules,
      pastEventPolicy,
      notes:byId("aiDiscoveryCriteriaNotes")?.value || "",
      updatedAt:nowField()
    }, {merge:true});
    setStatus("AI discovery rating criteria and publishing rules saved.");
    renderQueueCards();
  }

  async function saveImportGates() {
    readPublishingRuleFromForm();
    await db.collection("aiDiscoveryRatingCriteria").doc("defaultNightlifeRating").set({
      importGates,
      publishingRules,
      updatedAt:nowField()
    }, {merge:true});
    setStatus("Publishing rule saved. Publish / Onboard / auto-publish now use this crawl type.");
    renderQueueCards();
  }

  function downloadTextFile(filename, text, mime = "text/csv;charset=utf-8") {
    const blob = new Blob([text], {type: mime});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function downloadSampleCsv() {
    const api = window.FLOQRDiscoveryGates;
    const csv = api?.sampleDiscoveryCsv ? api.sampleDiscoveryCsv() : "";
    downloadTextFile("floqr-discovery-template.csv", csv);
    writeDiscoveryLog("csv_template", "Downloaded AI Crawling CSV template");
    setStatus("Downloaded the AI Crawling CSV template. Import uses the same headers.");
  }

  function unpublishedQueueRows() {
    return (allQueueRows.length ? allQueueRows : queueRows).filter(item => {
      const status = String(item.status || "pendingReview");
      return status === "pendingReview" || status === "needsResearch";
    });
  }

  function exportUnpublishedCsv() {
    const api = window.FLOQRDiscoveryGates;
    const rows = unpublishedQueueRows();
    const csv = api?.serializeDiscoveryCsv ? api.serializeDiscoveryCsv(rows) : "";
    downloadTextFile(`floqr-discovery-unpublished-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    writeDiscoveryLog("csv_export", `Exported ${rows.length} unpublished discovery row(s)`, {count: rows.length});
    const report = byId("aiDiscoveryCsvReport");
    if (report) report.innerHTML = simpleRows([["Exported unpublished rows", String(rows.length)], ["Template", api?.csvHeaderRow?.() || ""]]);
    setStatus(`Exported ${rows.length} unpublished discovery row(s) using the shared CSV template.`);
  }

  async function importDiscoveryCsv() {
    const api = window.FLOQRDiscoveryGates;
    if (!api?.parseDiscoveryCsv) {
      setStatus("CSV parser is not loaded.");
      return;
    }
    if (!csvFileText) {
      setStatus("Choose a CSV file that uses the sample template first.");
      return;
    }
    const parsed = api.parseDiscoveryCsv(csvFileText);
    const report = byId("aiDiscoveryCsvReport");
    if (!parsed.templateMatch) {
      if (report) report.innerHTML = `<p class="sub">${esc(parsed.errors.join(" "))}</p>`;
      setStatus("CSV headers must match the sample template.");
      return;
    }
    const [clubs, events, queue] = await Promise.all([
      getCollectionSafe("clubLocations", 800),
      getCollectionSafe("events", 400),
      getCollectionSafe("aiDiscoveryQueue", 500, "createdAt")
    ]);
    const universe = [
      ...clubs.map(row => ({...row, collection: "clubLocations"})),
      ...events.map(row => ({...row, collection: "events", entityKind: row.entityKind || "event"})),
      ...queue.map(row => ({...row, collection: "aiDiscoveryQueue"}))
    ];
    let written = 0;
    let skippedPast = 0;
    const blocked = [];
    for (const record of parsed.records) {
      let next = applyClientDiscoveryStamp(record, universe);
      if (pastEventPolicy.ignoreOnCrawl !== 0 && String(next.lifecycleStatus || "") === "past") {
        skippedPast += 1;
        continue;
      }
      const decision = api.publishBlockers ? api.publishBlockers(next, gateBundle()) : {ok: !missingDatapoints(next).length};
      const id = slug(`csv-${next.proposedTitle || "listing"}-${next.city || ""}-${Date.now()}-${written}`);
      await db.collection("aiDiscoveryQueue").doc(id).set({
        ...next,
        discoveryMode: "csv-import",
        status: "pendingReview",
        crawlResultStatus: decision.ok ? "ready-for-approval" : (next.duplicateFlag ? "possible-duplicate" : "missing-required-datapoints"),
        collectedAtIso: new Date().toISOString(),
        collectedAt: nowField(),
        createdAt: nowField(),
        updatedAt: nowField()
      }, {merge: true});
      universe.push({...next, id, collection: "aiDiscoveryQueue"});
      written += 1;
      if (!decision.ok) blocked.push(`${next.proposedTitle || id}: ${(decision.blockers || []).join(", ")}`);
    }
    writeDiscoveryLog("csv_import", `Imported ${written} CSV row(s)`, {written, skippedPast, blocked: blocked.length});
    if (report) {
      report.innerHTML = simpleRows([
        ["Imported to queue", String(written)],
        ["Skipped past events", String(skippedPast)],
        ["Need review / blocked from live publish", String(blocked.length)]
      ]) + (blocked.length ? `<p class="sub small">${esc(blocked.slice(0, 8).join(" · "))}</p>` : "");
    }
    setStatus(`Imported ${written} CSV row(s). Duplicates and incomplete rows stay in review — they are not live.`);
    await loadDiscoveryQueue();
  }

  function readPastEventPolicyFromForm() {
    const api = window.FLOQRDiscoveryGates;
    pastEventPolicy = api?.normalizePastEventPolicy ? api.normalizePastEventPolicy({
      ignoreOnCrawl: byId("aiDiscoveryIgnorePast")?.checked ? 1 : 0,
      retireAfterDays: Number(byId("aiDiscoveryRetireDays")?.value || 14),
      removeAfterDays: Number(byId("aiDiscoveryRemoveDays")?.value || 14)
    }) : pastEventPolicy;
    return pastEventPolicy;
  }

  async function savePastEventPolicy() {
    readPastEventPolicyFromForm();
    await db.collection("aiDiscoveryRatingCriteria").doc("defaultNightlifeRating").set({
      pastEventPolicy,
      updatedAt: nowField()
    }, {merge: true});
    setStatus("Past-event policy saved. The crawler ignores past dates when Ignore is on.");
  }

  async function cleanPastEventsNow() {
    readPastEventPolicyFromForm();
    const hours = Math.max(0, Number(pastEventPolicy.removeAfterDays || 0) * 24);
    try {
      const callable = firebase.functions().httpsCallable("retirePastCrawledEvents");
      const result = await callable({mode: "remove", olderThanHours: hours, limit: 400});
      const summary = result.data || {};
      writeDiscoveryLog("past_event_cleaned", "Master Admin cleaned past events", summary);
      setStatus(`Cleaned past events. Removed ${summary.removed || 0}, retired ${summary.retired || 0}.`);
    } catch (error) {
      setStatus(error?.message || "Could not clean past events. Functions deploy may still be pending.");
      writeDiscoveryLog("past_event_cleaned", error?.message || "clean failed", {error: error?.message || String(error)});
    }
  }

  function setStatus(value) {
    const el = byId("aiDiscoveryStatus");
    if (el) el.textContent = value || "";
  }

  let masterPanelBound = false;
  let masterPanelLoading = null;
  async function mountMasterAdminPanel(options = {}) {
    db = options.db || db;
    auth = options.auth || auth;
    if (!db || !auth || !byId("aiCrawling")) return;
    if (masterPanelLoading) return masterPanelLoading;
    masterPanelLoading = (async () => {
      await ensureDiscoveryDefaults();
      /* Counts live in #aiCrawlingSummary from masterAdminRollups; keep operator how-to here. */
      byId("aiDiscoverySummary").innerHTML = simpleRows([
        ["How it works", "Search → review cards → Save drafts, Publish when ready, or Needs research → live listing"],
        ["Publish rule", "Each crawl type has its own checklist. Nightclubs need Name, Genre, DJ(s), Address, City, Country, and a Phone or Email. Promoter(s) and Instagram are optional."],
        ["Duplicates", "Same phone, same address, or same club name = one establishment. Monaco and Monte Carlo are treated as the same city."],
        ["Technical dumps", "Hidden under Advanced — operators use the form fields"],
        ["Source confirmation", "Google Places today; Ticketmaster later; paste a detail page when needed"]
      ]);
      window.FLOQRMasterAdminRollup?.paintForPanel?.("aiCrawling");
      if (!masterPanelBound) {
        masterPanelBound = true;
        byId("aiDiscoveryRefreshBtn")?.addEventListener("click", loadDiscoveryQueue);
        byId("aiDiscoveryStatusFilter")?.addEventListener("change", loadDiscoveryQueue);
        byId("aiDiscoveryReadinessFilter")?.addEventListener("change", renderQueueCards);
        byId("aiDiscoveryCityFilter")?.addEventListener("input", loadDiscoveryQueue);
        byId("aiDiscoverySelectReadyBtn")?.addEventListener("click", selectAllReadyForOnboard);
        byId("aiDiscoveryClearSelectionBtn")?.addEventListener("click", clearOnboardSelection);
        byId("aiDiscoveryMassOnboardBtn")?.addEventListener("click", massOnboardSelected);
        byId("saveAiDiscoveryCriteriaBtn")?.addEventListener("click", saveCriteria);
        byId("saveAiDiscoveryImportGatesBtn")?.addEventListener("click", saveImportGates);
        byId("aiDiscoveryPublishType")?.addEventListener("change", () => {
          const next = byId("aiDiscoveryPublishType")?.value || "nightclub";
          const typeSel = byId("aiDiscoveryPublishType");
          if (typeSel) typeSel.value = activePublishType;
          readPublishingRuleFromForm();
          activePublishType = next;
          if (typeSel) typeSel.value = next;
          renderPublishingRuleForm();
        });
        byId("aiDiscoveryContactMode")?.addEventListener("change", readPublishingRuleFromForm);
        byId("aiDiscoveryCsvTemplateBtn")?.addEventListener("click", downloadSampleCsv);
        byId("aiDiscoveryCsvExportBtn")?.addEventListener("click", exportUnpublishedCsv);
        byId("aiDiscoveryCsvFile")?.addEventListener("change", async event => {
          const file = event.target.files?.[0];
          csvFileText = file ? await file.text() : "";
          setStatus(file ? `CSV ready: ${file.name}` : "No CSV selected.");
        });
        byId("aiDiscoveryCsvImportBtn")?.addEventListener("click", importDiscoveryCsv);
        byId("saveAiDiscoveryPastPolicyBtn")?.addEventListener("click", savePastEventPolicy);
        byId("aiDiscoveryCleanPastBtn")?.addEventListener("click", cleanPastEventsNow);
        byId("aiDiscoveryCriteriaJson")?.addEventListener("change", () => {
          try {
            syncCriteriaWeightsToForm(JSON.parse(byId("aiDiscoveryCriteriaJson").value || "{}"));
          } catch (_e) { /* keep form values if advanced dump is invalid */ }
        });
        document.querySelectorAll("[data-weight-key]").forEach(input => {
          input.addEventListener("input", readCriteriaWeightsFromForm);
        });
        byId("listingDeleteSearch")?.addEventListener("input", loadListingDeleteTool);
        byId("listingIncludeDeleted")?.addEventListener("change", loadListingDeleteTool);
      }
      await loadCriteria();
      await loadDiscoveryQueue();
      await loadListingDeleteTool();
    })().finally(() => { masterPanelLoading = null; });
    return masterPanelLoading;
  }

  window.FLOQRAIDiscovery = {
    DEFAULT_SOURCES,
    DEFAULT_CRITERIA,
    mountMasterAdminPanel,
    loadDiscoveryQueue,
    jumpToStatus,
    loadListingDeleteTool
  };
})();
