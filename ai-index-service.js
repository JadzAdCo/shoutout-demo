/* FLOQR AI index helpers and Firestore-ready schema map. */
(function () {
  "use strict";

  const SOURCE_TYPES = [
    "clubLocation",
    "event",
    "publicPatronProfile",
    "djProfile",
    "promoterProfile",
    "bataListing",
    "approvedShoutOut",
    "publicTemplateVariant",
    "comedyShow",
    "ticketResaleEvent"
  ];

  const COLLECTIONS = {
    aiIndex: {
      purpose: "Public/shared searchable summaries only",
      privacy: "visibility public/shared or current-user permitted"
    },
    aiUserNotificationPreferences: {
      docId: "uid",
      purpose: "User-owned AI notification settings"
    },
    aiUserSignals: {
      purpose: "Permissioned interests and explicit signals"
    },
    aiSearchLogs: {
      purpose: "Search telemetry without private message or prompt bodies"
    },
    aiRecommendations: {
      purpose: "Generated in-app recommendations"
    },
    aiDiscoveryQueue: {
      purpose: "Admin-reviewed public discovery records"
    },
    aiAssistantSessions: {
      purpose: "User-owned assistant session metadata"
    },
    aiAssistantMessages: {
      purpose: "User-owned assistant message records"
    },
    patronTemplateVariants: {
      purpose: "Patron-created locked-layout ShoutOut background variants"
    },
    aiTemplatePromptHistory: {
      purpose: "Private prompt history unless explicitly shared"
    },
    aiDiscoverySources: {
      purpose: "Public source configuration for scheduled backend crawlers"
    },
    aiDiscoveryRatingCriteria: {
      purpose: "Super Admin editable AI scoring criteria"
    }
  };

  const DEFAULT_ALLOWED_ROLES = ["patron", "clubAdmin", "promoter", "dj", "masterAdmin"];

  function nowField() {
    return window.firebase?.firestore?.FieldValue
      ? firebase.firestore.FieldValue.serverTimestamp()
      : new Date().toISOString();
  }

  function words(value) {
    if (Array.isArray(value)) return value.flatMap(words);
    if (value && typeof value === "object") return Object.values(value).flatMap(words);
    return String(value || "")
      .split(/[^a-zA-Z0-9]+/)
      .map(x => x.trim())
      .filter(Boolean);
  }

  function uniqueKeywords(value) {
    const out = new Set();
    words(value).forEach(item => {
      const key = item.toLowerCase();
      if (key.length > 1) out.add(key);
    });
    return Array.from(out).slice(0, 40);
  }

  function visibilityOf(data = {}) {
    return String(data.visibility || data.publicProfileVisibility || "public").toLowerCase();
  }

  function safeCanIndex(data = {}, context = {}) {
    if (data.aiIndexExcluded === true || data.privateIndex === true) return false;
    const visibility = visibilityOf(data);
    if (visibility === "public" || visibility === "shared") return true;
    const uid = context.uid || context.currentUser?.uid || "";
    return !!uid && !!data.ownerUid && data.ownerUid === uid;
  }

  function makeAiIndexRecord(input = {}) {
    const sourceType = SOURCE_TYPES.includes(input.sourceType) ? input.sourceType : "event";
    const summary = String(input.summary || input.description || "").slice(0, 600);
    const title = String(input.title || input.name || input.sourceId || "FLOQR record").slice(0, 160);
    return {
      sourceType,
      sourceId: String(input.sourceId || input.id || "").slice(0, 180),
      title,
      summary,
      keywords: uniqueKeywords([title, summary, input.keywords, input.tags, input.genres, input.city, input.country]),
      city: input.city || "",
      stateRegion: input.stateRegion || input.region || "",
      country: input.country || "",
      visibility: input.visibility || "public",
      ownerUid: input.ownerUid || null,
      allowedRoles: input.allowedRoles || DEFAULT_ALLOWED_ROLES,
      sourceUrl: input.sourceUrl || "",
      updatedAt: input.updatedAt || nowField(),
      indexedAt: nowField()
    };
  }

  function clubLocationIndexRecord(id, loc = {}) {
    return makeAiIndexRecord({
      sourceType: "clubLocation",
      sourceId: id,
      title: loc.locationName || loc.brandName || id,
      summary: [
        loc.locationName || loc.brandName,
        loc.tagline || loc.publicTagline,
        loc.description || loc.publicDescription,
        loc.type,
        loc.locationLabel,
        loc.address,
        loc.officialWebsite || loc.website,
        loc.telephone || loc.phone,
        loc.email,
        loc.socialMediaHandles || loc.socialHandles,
        loc.genres,
        loc.hours || loc.operatingHours,
        loc.agePolicy,
        loc.dressCode,
        loc.amenities,
        loc.publicServices || loc.services,
        (loc.featuredDjs || []).map(item => typeof item === "string" ? item : item.name || item.displayName),
        (loc.featuredStaff || loc.featuredServiceStaff || []).map(item => typeof item === "string" ? item : item.name || item.displayName),
        (loc.promotionGroups || []).map(item => typeof item === "string" ? item : item.name || item.displayName),
        loc.activityDates,
        "public club profile",
        loc.clubOwnershipStatus === "claimed" ? "claimed by subscribed club admin" : ""
      ].flat().filter(Boolean).join(" "),
      keywords: [loc.categories, loc.genres, loc.artists, loc.amenities, loc.publicServices, loc.activityDates, loc.publicSearchKeywords],
      city: loc.city || "",
      stateRegion: loc.stateRegion || loc.region || "",
      country: loc.country || "",
      visibility: loc.visibility || "public",
      allowedRoles: DEFAULT_ALLOWED_ROLES
    });
  }

  function eventIndexRecord(id, event = {}) {
    return makeAiIndexRecord({
      sourceType: event.category === "Comedy" || /comedy/i.test(event.eventName || event.category || "") ? "comedyShow" : "event",
      sourceId: id,
      title: event.eventName || event.title || id,
      summary: [
        event.eventName || event.title,
        event.eventDate,
        event.eventTime,
        event.eventDay,
        event.city,
        event.country,
        event.genres,
        event.artists,
        event.ticketProvider,
        event.ticketResalePartner,
        event.sourceUrl
      ].flat().filter(Boolean).join(" "),
      keywords: [event.categories, event.genres, event.artists, event.tags, event.ticketProvider],
      city: event.city || "",
      stateRegion: event.stateRegion || event.region || "",
      country: event.country || "",
      visibility: event.visibility || "public",
      allowedRoles: DEFAULT_ALLOWED_ROLES,
      sourceUrl: event.sourceUrl || event.ticketUrl || ""
    });
  }

  function templateVariantIndexRecord(variant = {}) {
    return makeAiIndexRecord({
      sourceType: "publicTemplateVariant",
      sourceId: variant.id || variant.variantId || "",
      title: variant.variantName || "Patron ShoutOut Template Variant",
      summary: [
        variant.variantName,
        variant.baseTemplateName,
        variant.ownerDisplayName,
        variant.tags,
        variant.searchKeywords,
        variant.promptShared ? variant.aiPrompt : ""
      ].flat().filter(Boolean).join(" "),
      keywords: [variant.tags, variant.searchKeywords, variant.promptShared ? variant.aiPrompt : ""],
      visibility: variant.visibility === "public" ? "public" : "private",
      ownerUid: variant.ownerUid || null,
      allowedRoles: DEFAULT_ALLOWED_ROLES
    });
  }

  async function upsertAiIndex(db, id, record) {
    if (!db || !id || !record || !safeCanIndex(record, {uid: record.ownerUid})) return false;
    await db.collection("aiIndex").doc(id).set(record, {merge:true});
    return true;
  }

  window.FLOQRAIIndex = {
    SOURCE_TYPES,
    COLLECTIONS,
    DEFAULT_ALLOWED_ROLES,
    nowField,
    safeCanIndex,
    makeAiIndexRecord,
    clubLocationIndexRecord,
    eventIndexRecord,
    templateVariantIndexRecord,
    upsertAiIndex
  };
})();
