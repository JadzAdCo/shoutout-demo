/* FLOQR Club Admin — In-App Marketing: post paid ads for this club and choose club ad posters.
 * Ads are created by createAdCampaign (server) and run only after payment + Master Admin approval.
 * Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc
 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const params = new URL(location.href).searchParams;
  const locationId = params.get("location") || params.get("club") || "zebbies-garden-washington-dc";
  if (!window.firebase || !byId("spotAdCampaignCard")) return;

  let mounted = false;

  function setStatus(message) {
    const el = byId("spotAdStatus");
    if (el) el.textContent = message || "";
  }

  async function venueAllowsAds() {
    const gates = window.FLOQRFeatureGates;
    if (!gates?.loadVenueRecord) return true;
    const row = await gates.loadVenueRecord(firebase.firestore(), locationId);
    return gates.venueMayUse("uberAds", row);
  }

  async function mount() {
    if (mounted || !window.FLOQRAdComposer) return;
    mounted = true;
    if (!await venueAllowsAds().catch(() => true)) {
      setStatus(window.FLOQRI18n?.t?.("ads.club.disabled") || "In-app ads are turned off for this venue.");
      return;
    }
    const composer = window.FLOQRAdComposer.createComposer(byId("spotAdComposerHost"), {
      prefix: "clubAd",
      preferPosterKey: `club:${locationId}`
    });
    await composer.load();
    window.FLOQRAdComposer.mountClubPosters(byId("spotAdPostersHost"), locationId);
  }

  document.addEventListener("DOMContentLoaded", () => {
    firebase.auth().onAuthStateChanged(user => {
      if (user) mount().catch(error => setStatus(error?.message || String(error)));
    });
  });
})();
