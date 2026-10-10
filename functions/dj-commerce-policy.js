/* FLOQR / BartR DJ commerce policy — Node (functions) + shared rules. */
"use strict";

const PRODUCT_TYPES = {
  physical: {id: "physical", requiresShipping: true, deliveryMode: "ship"},
  playlistCuration: {id: "playlistCuration", requiresShipping: false, deliveryMode: "digital-links"},
  mixcloudShow: {id: "mixcloudShow", requiresShipping: false, deliveryMode: "mixcloud-link"},
  djConsultation: {id: "djConsultation", requiresShipping: false, deliveryMode: "service"},
  photoLicense: {id: "photoLicense", requiresShipping: false, deliveryMode: "digital-media"},
  videoLicense: {id: "videoLicense", requiresShipping: false, deliveryMode: "digital-media"},
  clearedMixDownload: {id: "clearedMixDownload", requiresShipping: false, deliveryMode: "download", requiresRightsCert: true}
};

function isMixcloudUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return /(^|\.)mixcloud\.com$/i.test(url.hostname);
  } catch (_) {
    return false;
  }
}

function validateDjListing({productType, mixcloudUrl, externalPlaylistUrl, rightsCert, downloadUrl} = {}) {
  const errors = [];
  if (productType === "mixcloudShow" && !isMixcloudUrl(mixcloudUrl)) {
    errors.push("Mixcloud show listings need a valid mixcloud.com URL.");
  }
  if (productType === "playlistCuration") {
    const link = String(externalPlaylistUrl || "").trim();
    if (!link) errors.push("Playlist curation listings need a streaming-service link.");
    if (/\.(mp3|wav|flac|aiff|m4a)(\?|$)/i.test(link)) {
      errors.push("Playlist products cannot point to audio file downloads.");
    }
  }
  if (productType === "clearedMixDownload") {
    const allowed = ["ownOrCommissioned", "writtenClearance", "licensedLibrary"];
    if (!allowed.includes(String(rightsCert || ""))) {
      errors.push("Cleared mix downloads require rights certification.");
    }
    if (!String(downloadUrl || "").trim()) {
      errors.push("Cleared mix downloads need a fulfillment download URL.");
    }
  }
  return {ok: !errors.length, errors};
}

module.exports = {
  PRODUCT_TYPES,
  isMixcloudUrl,
  validateDjListing,
  POLICY_SUMMARY: "Sell curation/services or Mixcloud links — not uncleared audio files. No guaranteed playlist placement. Downloads only with rights certification."
};
