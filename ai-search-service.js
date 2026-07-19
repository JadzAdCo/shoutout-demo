/* Shared FLOQR search record adapters. */
(function () {
  "use strict";

  function record(type, id, title, searchText, data, extra = {}) {
    return {
      id,
      type,
      sourceType: extra.sourceType || type,
      title,
      searchText,
      data: data || {},
      visibility: extra.visibility || data?.visibility || data?.publicProfileVisibility || "public",
      ownerUid: extra.ownerUid || data?.ownerUid || data?.uid || null,
      allowedRoles: extra.allowedRoles || data?.allowedRoles || ["patron", "clubAdmin", "promoter", "dj", "masterAdmin"]
    };
  }

  function locationsToRecords(locations = {}) {
    return Object.entries(locations).map(([id, loc]) => record(
      "clubLocation",
      id,
      loc.locationName || loc.brandName || id,
      [
        loc.brandName, loc.locationName, loc.type, loc.categories, loc.country,
        loc.region, loc.stateRegion, loc.city, loc.locationLabel, loc.address,
        loc.officialWebsite || loc.website, loc.email, loc.telephone || loc.phone,
        loc.socialMediaHandles || loc.socialHandles, loc.genres, loc.artists,
        loc.activityDates, loc.publicSearchKeywords, loc.taxiPartnerNotes
      ].flat().filter(Boolean).join(" "),
      loc
    ));
  }

  function eventsToRecords(events = {}) {
    return Object.entries(events).map(([id, event]) => record(
      "event",
      id,
      event.eventName || event.title || id,
      [
        event.eventName || event.title, event.eventDate, event.eventTime,
        event.eventDay, event.city, event.region, event.stateRegion, event.country,
        event.genres, event.artists, event.categories, event.category,
        event.ticketProvider, event.ticketResalePartner, event.sourceName,
        event.sourceUrl, event.ticketUrl, event.description
      ].flat().filter(Boolean).join(" "),
      event,
      {sourceType: /comedy/i.test([event.eventName, event.category, event.categories].flat().join(" ")) ? "comedyShow" : "event"}
    ));
  }

  function profilesToRecords(profiles = []) {
    return profiles.map(profile => record(
      profile.publicProfileType === "dj" ? "djProfile" : profile.publicProfileType === "promoter" ? "promoterProfile" : "publicPatronProfile",
      profile.uid || profile.id || "",
      profile.displayName || profile.username || "FLOQR member",
      [
        profile.displayName, profile.username, profile.city, profile.region,
        profile.country, profile.bio, profile.gender, profile.nightlifeStyle,
        profile.lookingToMeet, profile.musicInterests || profile.favoriteGenres,
        profile.travelInterests, profile.hobbies || profile.generalHobbies,
        profile.foodChoices, profile.favoriteBeverages
      ].flat().filter(Boolean).join(" "),
      profile,
      {visibility: profile.publicProfileVisibility || "private", ownerUid: profile.uid || profile.id || null}
    ));
  }

  function templatesToRecords(templates = {}, variants = []) {
    const official = Object.entries(templates).map(([id, tpl]) => record(
      "officialTemplate",
      id,
      tpl.name || id,
      [
        tpl.name, tpl.category, tpl.scope, tpl.mediaMode, tpl.description,
        tpl.defaultMain, tpl.defaultSub, tpl.supportsMedia || tpl.supportsImage || tpl.supportsVideo ? "image video photo media upload" : "classic no image no video"
      ].filter(Boolean).join(" "),
      tpl,
      {sourceType:"approvedShoutOut", visibility:"public"}
    ));
    const community = variants.map(variant => record(
      "publicTemplateVariant",
      variant.id || variant.variantId || "",
      variant.variantName || "Community Template",
      [
        variant.variantName, variant.baseTemplateName, variant.ownerDisplayName,
        variant.tags, variant.searchKeywords, variant.promptShared ? variant.aiPrompt : ""
      ].flat().filter(Boolean).join(" "),
      variant,
      {sourceType:"publicTemplateVariant", visibility:variant.visibility || "private", ownerUid:variant.ownerUid || null}
    ));
    return [...official, ...community];
  }

  async function searchRecords(query, records, context = {}) {
    if (window.floqrSearch) return window.floqrSearch(query, {...context, records});
    return records;
  }

  window.FLOQRAISearch = {
    record,
    locationsToRecords,
    eventsToRecords,
    profilesToRecords,
    templatesToRecords,
    searchRecords
  };
})();
