/* FLOQR / BartR DJ commerce policy — curation & Mixcloud-safe selling (no uncleared audio delivery). */
(function (global) {
  "use strict";

  const DJ_CATEGORIES = [
    "DJ Merch",
    "DJ Playlist",
    "DJ Mix (Mixcloud)",
    "DJ Consultation",
    "Apparel",
    "Other"
  ];

  /**
   * Allowed BartR product types for DJs / music sellers.
   * Audio policy: sell curation/service or Mixcloud links — not uncleared recordings.
   */
  const PRODUCT_TYPES = {
    physical: {
      id: "physical",
      label: "Physical product / merch",
      requiresShipping: true,
      deliveryMode: "ship"
    },
    playlistCuration: {
      id: "playlistCuration",
      label: "Playlist curation (links + notes — no audio files)",
      requiresShipping: false,
      deliveryMode: "digital-links",
      hint: "Sell track lists with Spotify / Apple Music / Tidal links, BPM notes, themes, schedules. Listeners stream on their own licensed accounts."
    },
    mixcloudShow: {
      id: "mixcloudShow",
      label: "Mixcloud show / mix (embed or link)",
      requiresShipping: false,
      deliveryMode: "mixcloud-link",
      hint: "Link or embed a Mixcloud show. Prefer Mixcloud Creator Subscriptions for monetized mixes — do not upload uncleared mixes for download on BartR."
    },
    djConsultation: {
      id: "djConsultation",
      label: "DJ consultation / programming service",
      requiresShipping: false,
      deliveryMode: "service",
      hint: "Paid programming, wedding/gym/restaurant playlist design, weekly subscription curation — without delivering recordings."
    },
    photoLicense: {
      id: "photoLicense",
      label: "Digital photo license",
      requiresShipping: false,
      deliveryMode: "digital-media"
    },
    videoLicense: {
      id: "videoLicense",
      label: "Digital video license",
      requiresShipping: false,
      deliveryMode: "digital-media"
    },
    clearedMixDownload: {
      id: "clearedMixDownload",
      label: "Cleared mix download (rights certified only)",
      requiresShipping: false,
      deliveryMode: "download",
      requiresRightsCert: true,
      hint: "Allowed only when you certify written clearance for masters + compositions, own/commissioned music, or a library licensed for commercial resale."
    }
  };

  const RIGHTS_CERT_OPTIONS = [
    {id: "", label: "Not a downloadable mix"},
    {id: "mixcloudHosted", label: "Hosted on Mixcloud (no BartR download)"},
    {id: "ownOrCommissioned", label: "Own / commissioned music only"},
    {id: "writtenClearance", label: "Written clearance for master + composition (all tracks)"},
    {id: "licensedLibrary", label: "Commercial mix/resale-licensed library"}
  ];

  const POLICY_SUMMARY = [
    "Sell the curation service, not the audio: custom playlists, weekly refreshed lists, Spotify/Apple/Tidal link packs, BPM/transition notes, and consultation.",
    "Listeners stream each song through their own licensed account. Do not download, copy, bundle, or deliver the actual recordings on BartR.",
    "Do not sell guaranteed playlist placement to artists (e.g. Spotify prohibits paid guaranteed placement). Honest review without a placement promise is OK.",
    "Recorded mixes: prefer Mixcloud embeds/links (Mixcloud’s licensing + Creator Subscriptions). Clearing every track for download is the other path.",
    "Direct downloads on BartR require an explicit rights certification. “Under 30 seconds” / “promotional only” / “no infringement intended” are not safe harbors."
  ].join(" ");

  function isMixcloudUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return /(^|\.)mixcloud\.com$/i.test(url.hostname);
    } catch (_) {
      return false;
    }
  }

  /** Normalize a Mixcloud show path for widget embed: https://www.mixcloud.com/widget/iframe/?feed=... */
  function mixcloudEmbedSrc(showUrl) {
    if (!isMixcloudUrl(showUrl)) return "";
    try {
      const url = new URL(String(showUrl).trim());
      const feed = encodeURIComponent(url.origin + url.pathname.replace(/\/$/, "") + "/");
      return `https://www.mixcloud.com/widget/iframe/?hide_cover=1&light=1&feed=${feed}`;
    } catch (_) {
      return "";
    }
  }

  function validateDjListing({productType, mixcloudUrl, externalPlaylistUrl, rightsCert, downloadUrl} = {}) {
    const type = PRODUCT_TYPES[productType] || PRODUCT_TYPES.physical;
    const errors = [];
    if (productType === "mixcloudShow") {
      if (!isMixcloudUrl(mixcloudUrl)) errors.push("Mixcloud show listings need a valid mixcloud.com URL.");
    }
    if (productType === "playlistCuration") {
      const link = String(externalPlaylistUrl || "").trim();
      if (!link) errors.push("Playlist curation listings need at least one Spotify / Apple Music / Tidal (or similar) link.");
      if (/\.(mp3|wav|flac|aiff|m4a)(\?|$)/i.test(link)) {
        errors.push("Playlist products cannot point to audio file downloads. Use streaming-service links only.");
      }
    }
    if (productType === "clearedMixDownload") {
      const allowed = ["ownOrCommissioned", "writtenClearance", "licensedLibrary"];
      if (!allowed.includes(String(rightsCert || ""))) {
        errors.push("Cleared mix downloads require rights certification (own music, written clearance, or licensed library).");
      }
      if (!String(downloadUrl || "").trim()) {
        errors.push("Cleared mix downloads need a fulfillment download URL (delivered after purchase).");
      }
    }
    if (type.requiresRightsCert && !rightsCert) {
      errors.push("This product type requires a rights certification.");
    }
    return {ok: !errors.length, errors, type};
  }

  function typeOptionsHtml(selected = "physical") {
    return Object.values(PRODUCT_TYPES).map(t =>
      `<option value="${t.id}" ${t.id === selected ? "selected" : ""}>${t.label}</option>`
    ).join("");
  }

  const api = {
    DJ_CATEGORIES,
    PRODUCT_TYPES,
    RIGHTS_CERT_OPTIONS,
    POLICY_SUMMARY,
    isMixcloudUrl,
    mixcloudEmbedSrc,
    validateDjListing,
    typeOptionsHtml
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.FLOQRDjCommerce = api;
})(typeof window !== "undefined" ? window : globalThis);
