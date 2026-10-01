/* My Profile → Ad Campaigns — service members, club ad posters, promoters / promotion groups, FloqQ, business accounts.
 * Every ad is created by createAdCampaign (server); patrons never write spotAdCampaigns.
 * Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc
 */
(function (global) {
  "use strict";

  let composer = null;
  let groups = null;
  let loading = null;

  function byId(id) { return document.getElementById(id); }

  function isBusinessAccount(profile = {}) {
    return profile.IsBusinessAccount === 1
      || profile.IsBusinessAccount === true
      || String(profile.IsBusinessAccount || "").toLowerCase() === "yes"
      || String(profile.accountType || "").toLowerCase() === "business";
  }

  function hasPromoterRole(profile = {}) {
    const roles = [].concat(profile.approvedRoles || [], profile.roles || [], profile.publicProfileType || [])
      .map(r => String(r || "").toLowerCase());
    return roles.some(r => /promoter|promotion/.test(r));
  }

  function gate(visible) {
    const rules = [{
      tab: "#portalAdCampaignsTab",
      panel: "#portalAdCampaigns",
      when: [{datapoint: "canPostAds", equals: true}],
      reason: "ad-posting"
    }];
    if (global.FLOQRTabGates?.bind) {
      global.FLOQRTabGates.bind(rules, {canPostAds: !!visible});
    } else {
      byId("portalAdCampaignsTab")?.classList.toggle("hidden", !visible);
    }
  }

  async function ensureMounted(profile) {
    const host = byId("adComposerHost");
    if (!host || !global.FLOQRAdComposer) return [];
    if (!composer) {
      composer = global.FLOQRAdComposer.createComposer(host, {prefix: "portalAd"});
      groups = global.FLOQRAdComposer.mountPromotionGroups(byId("adGroupsHost"), {canCreate: hasPromoterRole(profile)});
    }
    return composer.load();
  }

  /** Called on every profile render. Tab shows when the server returns at least one posting identity. */
  function showPanel(profile = {}) {
    if (composer && !loading) {
      gate(composer.identities().length > 0 || isBusinessAccount(profile) || hasPromoterRole(profile));
      return false;
    }
    if (!loading) {
      loading = ensureMounted(profile)
        .then(identities => {
          gate(identities.length > 0 || isBusinessAccount(profile) || hasPromoterRole(profile));
          return identities;
        })
        .catch(() => gate(false))
        .finally(() => { loading = null; });
    }
    return false;
  }

  function refreshMine() {
    composer?.refreshMine?.();
    groups?.refresh?.();
  }

  function bind() {}

  global.FLOQRPatronAdCampaigns = {
    isBusinessAccount,
    showPanel,
    bind,
    refreshMine
  };
})(typeof window !== "undefined" ? window : globalThis);
