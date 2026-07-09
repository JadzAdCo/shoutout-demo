/* FLOQR ad campaign targeting v28.99 */
(function () {
  "use strict";

  const VERSION = "28.99";
  const OVERRIDE_KEY = "floqrAdCampaignOverrides:v28.99";

  const baseCampaigns = [
    {
      id: "cuisine-bantu-rowlett",
      title: "Cuisine Bantu",
      badge: "Bantu Fusion Dining",
      advertiser: "Cuisine Bantu",
      status: "preview",
      sourceUrl: "https://www.cuisinebantu.com/",
      image: "./ads/cuisine-bantu.svg",
      body: "Bantu fusion flavors are coming to Rowlett. African, Caribbean, and spice-loving food lovers, this one is for you.",
      demoLabel: "Demo ad campaign",
      callToAction: "Join the flavor list",
      slots: ["shoutout", "events", "clubs", "lounges", "lounge-club", "default"],
      targetTags: ["african cuisine", "caribbean cuisine", "bantu fusion", "spicy food", "foodie", "dallas", "rowlett", "texas", "diaspora dining"],
      setupInfo: {
        name: "Cuisine Bantu",
        address: "9103 Lakeview Pkwy, Suite 200, Rowlett, TX 75088",
        phone: "Not published on official site",
        facebookHandle: "Cuisine-Bantu",
        instagramHandle: "@cuisinebantu",
        xHandle: "Not published on official site",
        tiktokHandle: "@cuisinebantu",
        email: "contact@cuisinebantu.com"
      },
      canva: {
        designId: "DAHO15Hg1Ik",
        editUrl: "https://www.canva.com/d/meMIzPHZCiqqtTf",
        viewUrl: "https://www.canva.com/d/fr_eMyVRa246Ei0"
      },
      aiTargetingPrompt: "Prioritize patrons with African, Caribbean, spicy-food, diaspora dining, foodie, Dallas, Rowlett, or Texas datapoints."
    },
    {
      id: "puff-club",
      title: "Puff Club",
      badge: "21+ Cannabis Discovery",
      advertiser: "Puff Club",
      status: "preview",
      sourceUrl: "https://puffclub.app/",
      image: "./ads/puff-club.svg",
      body: "Discover cannabis-friendly spots, products, rewards, and your local Puff Club community. 21+ only.",
      demoLabel: "Demo ad campaign",
      callToAction: "Explore Puff Club",
      slots: ["shoutout", "lounges", "lounge-club", "default"],
      minimumAge: 21,
      targetTags: ["cannabis", "21 plus", "wellness", "puff club", "social discovery", "rewards", "nightlife"],
      canva: {
        designId: "DAHO15k6c_w",
        editUrl: "https://www.canva.com/d/YCeLJvxGuXDhTpH",
        viewUrl: "https://www.canva.com/d/33dq0W2kOmu-kR9"
      },
      aiTargetingPrompt: "Show only to age-eligible patrons whose profile or activity indicates cannabis, wellness, nightlife discovery, or rewards interests."
    },
    {
      id: "lima-dc-draft",
      title: "Lima DC",
      badge: "DC Nightlife",
      advertiser: "Lima DC",
      status: "preview",
      sourceUrl: "",
      image: "./ads/lima-dc.svg",
      body: "DC nightlife energy for Latin nights, VIP tables, late-night celebration, and downtown club moments.",
      demoLabel: "Demo ad campaign",
      callToAction: "Plan a Lima night",
      slots: ["shoutout", "clubs", "events", "lounges", "default"],
      targetTags: ["washington dc", "district of columbia", "dc", "dmv", "latin music", "latin nightlife", "reggae", "raggae", "reggaeton", "ragatton", "dancehall", "afro latin", "salsa", "bachata", "dembow", "club", "vip", "lounge", "dance", "table service", "bottle service", "birthday", "celebration", "date night"],
      campaignDatapoints: [
        {category:"Location", tags:["Washington DC", "District of Columbia", "DC", "DMV"]},
        {category:"Music", tags:["Latin", "Reggae", "Reggaeton", "Dancehall", "Afro Latin", "Salsa", "Bachata", "Dembow"]},
        {category:"Venue style", tags:["Club", "Lounge", "VIP", "Table Service", "Bottle Service"]},
        {category:"Nightlife intent", tags:["Dance", "Celebration", "Birthday", "Date Night", "Late Night"]}
      ],
      requiredTargetGroups: [],
      setupInfo: {
        name: "Lima DC / Lima Nightclub DC",
        address: "Needs official verification",
        phone: "Needs official verification",
        facebookHandle: "Needs official verification",
        instagramHandle: "Needs official verification",
        xHandle: "Needs official verification",
        tiktokHandle: "Needs official verification"
      },
      canva: {
        designId: "DAHO1x-MMTQ",
        editUrl: "https://www.canva.com/d/NZzM8FVSlGfOu34",
        viewUrl: "https://www.canva.com/d/odXh5mh_lfth8It"
      },
      aiTargetingPrompt: "Prioritize DC patrons and travelers interested in Latin nightlife, VIP tables, clubs, lounges, and dance events."
    },
    {
      id: "gran-coramino",
      title: "Gran Coramino Tequila",
      badge: "Sponsored Lounge Moment",
      advertiser: "Gran Coramino",
      status: "active",
      image: "./ads/gran-coramino.svg",
      body: "A smooth premium tequila experience for lounge-club nights, VIP tables, and celebration moments.",
      slots: ["lounge-club", "lounges", "clubs"],
      targetTags: ["tequila", "vip", "lounge", "celebration", "premium spirits", "bottle service"]
    },
    {
      id: "gucci-fragrance",
      title: "Gucci Fragrances",
      badge: "Sponsored Club Moment",
      advertiser: "Gucci Fragrances",
      status: "active",
      image: "./ads/gucci-fragrance.svg",
      body: "Luxury fragrance energy for a night out. Own the room before the first song drops.",
      slots: ["clubs", "events", "default"],
      targetTags: ["fashion", "luxury", "fragrance", "club", "date night", "style"]
    },
    {
      id: "nike-airmax",
      title: "Nike Air Max",
      badge: "Sponsored Event Moment",
      advertiser: "Nike",
      status: "active",
      image: "./ads/nike-airmax.svg",
      body: "Step into the night with Nike energy. Built for movement, style, and the next event.",
      slots: ["events", "clubs", "default"],
      targetTags: ["sneakers", "sportswear", "events", "streetwear", "dance", "music"]
    },
    {
      id: "teremana",
      title: "Teremana Tequila",
      badge: "Sponsored Lounge Moment",
      advertiser: "Teremana",
      status: "active",
      image: "./ads/teremana.svg",
      body: "Premium tequila for lounge nights, group celebrations, and table-service moments.",
      slots: ["lounges", "lounge-club", "clubs"],
      targetTags: ["tequila", "lounge", "celebration", "premium spirits", "vip"]
    },
    {
      id: "advertise-here",
      title: "Advertise Here",
      badge: "FLOQR Media Slot",
      advertiser: "FLOQR",
      status: "active",
      image: "./ads/advertise-here.svg",
      body: "Your brand can own this moment before patrons browse nightlife.",
      slots: ["default", "beach-clubs", "shoutout"],
      isHouseFallback: true,
      targetTags: ["nightlife", "events", "clubs"]
    }
  ];

  function readOverrides() {
    try {
      return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveOverride(id, patch) {
    const overrides = readOverrides();
    overrides[id] = {...(overrides[id] || {}), ...patch, updatedAt:new Date().toISOString()};
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
  }

  function parseRequiredGroups(value) {
    try {
      const parsed = JSON.parse(value || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map(group => ({
        label: String(group.label || "Required target group"),
        fields: splitTags(group.fields || []),
        tags: splitTags(group.tags || [])
      })).filter(group => group.fields.length && group.tags.length);
    } catch {
      return null;
    }
  }

  function campaigns() {
    const overrides = readOverrides();
    return baseCampaigns.map(campaign => ({...campaign, ...(overrides[campaign.id] || {})}));
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function splitTags(value) {
    if (Array.isArray(value)) return value.map(String).map(x => x.trim()).filter(Boolean);
    return String(value || "").split(/[,;|/]+/).map(x => x.trim()).filter(Boolean);
  }

  function profileTags(profile = {}) {
    return splitTags([
      profile.city,
      profile.state,
      profile.region,
      profile.province,
      profile.country,
      profile.ageRange,
      profile.gender,
      profile.favoriteGenres,
      profile.musicInterests,
      profile.nightlifeInterests,
      profile.foodChoices,
      profile.favoriteFoods,
      profile.beverageChoices,
      profile.favoriteBeverages,
      profile.hobbies,
      profile.generalHobbies,
      profile.travelInterests,
      profile.lookingToMeet
    ].flat().join(","));
  }

  function profileFieldTags(profile = {}, fields = []) {
    return splitTags(fields.map(field => profile[field]).flat().join(",")).map(normalize).filter(Boolean);
  }

  function profileAgeNumber(profile = {}) {
    const direct = Number(profile.age || profile.patronAge || 0);
    if (direct > 0) return direct;
    const range = String(profile.ageRange || "").match(/\d+/);
    if (range) return Number(range[0]);
    const birthYear = Number(profile.birthYear || 0);
    return birthYear > 1900 ? new Date().getFullYear() - birthYear : 0;
  }

  function campaignSlotScore(campaign, slot = "default") {
    const slots = campaign.slots || ["default"];
    if (slots.includes(slot)) return 30;
    if (slot === "default" && slots.includes("default")) return 10;
    return -999;
  }

  function campaignTargetMatches(campaign, profile = {}) {
    const patronTags = profileTags(profile).map(normalize).filter(Boolean);
    const targetTags = splitTags(campaign.targetTags).map(normalize).filter(Boolean);
    if (!targetTags.length || !patronTags.length) return [];
    return targetTags.filter(tag => patronTags.some(value => value === tag || value.includes(tag) || tag.includes(value)));
  }

  function campaignRequiredGroupMatches(campaign, profile = {}) {
    const groups = Array.isArray(campaign.requiredTargetGroups) ? campaign.requiredTargetGroups : [];
    return groups.map(group => {
      const values = profileFieldTags(profile, group.fields || []);
      const tags = splitTags(group.tags || []).map(normalize).filter(Boolean);
      const matches = tags.filter(tag => values.some(value => value === tag || value.includes(tag) || tag.includes(value)));
      return {label:group.label || "Required target group", matches};
    });
  }

  function scoreCampaign(campaign, profile = {}, slot = "default") {
    if (campaign.minimumAge) {
      const age = profileAgeNumber(profile);
      if (!age || age < campaign.minimumAge) return -999;
    }
    const slotScore = campaignSlotScore(campaign, slot);
    if (slotScore < 0) return -999;
    const requiredGroups = campaignRequiredGroupMatches(campaign, profile);
    if (requiredGroups.some(group => !group.matches.length)) return -999;
    const matches = campaignTargetMatches(campaign, profile);
    if (!campaign.isHouseFallback && splitTags(campaign.targetTags).length && !matches.length) return -999;
    let score = slotScore + (matches.length * 20) + requiredGroups.reduce((sum, group) => sum + group.matches.length * 25, 0);
    if (campaign.status === "active") score += 5;
    if (campaign.status === "needs-verification") score -= 15;
    return score;
  }

  function pickCampaign(slot = "default", profile = {}) {
    const allCampaigns = campaigns();
    const ranked = allCampaigns
      .map(campaign => ({campaign, score:scoreCampaign(campaign, profile, slot)}))
      .filter(item => item.score > -100 && !item.campaign.isHouseFallback)
      .sort((a, b) => b.score - a.score);
    const topScore = ranked[0]?.score || 0;
    const pool = ranked.filter(item => item.score >= Math.max(0, topScore - 10));
    const selected = nextRotatingCampaign(slot, pool.map(item => item.campaign)) || ranked[0]?.campaign || allCampaigns.find(item => item.isHouseFallback) || allCampaigns.find(item => item.id === "advertise-here");
    return {
      title: selected.title,
      body: selected.body,
      badge: selected.badge,
      image: selected.image,
      campaignId: selected.id,
      callToAction: selected.callToAction || "Learn more"
    };
  }

  function nextRotatingCampaign(slot, pool = []) {
    const candidates = pool.filter(Boolean);
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];
    const key = `floqrAdCampaignRotation:${slot}`;
    const previous = localStorage.getItem(key) || "";
    const previousIndex = candidates.findIndex(item => item.id === previous);
    const next = candidates[(previousIndex + 1) % candidates.length] || candidates[0];
    localStorage.setItem(key, next.id);
    return next;
  }

  function campaignAnalytics(profileRows = []) {
    return campaigns().map(campaign => {
      const matches = profileRows
        .map(profile => ({profile, score:scoreCampaign(campaign, profile, campaign.slots?.[0] || "default")}))
        .filter(item => item.score >= 30);
      return {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        matchedPatrons: matches.length,
        targetTags: splitTags(campaign.targetTags),
        requiredTargetGroups: campaign.requiredTargetGroups || [],
        aiTargetingPrompt: campaign.aiTargetingPrompt || ""
      };
    });
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  function renderAdminCampaignManager(targetId, profileRows = []) {
    const wrap = document.getElementById(targetId);
    if (!wrap) return;
    const analytics = campaignAnalytics(profileRows);
    wrap.innerHTML = campaigns().map(campaign => {
      const stat = analytics.find(item => item.id === campaign.id) || {};
      const setup = campaign.setupInfo ? `<div class="tag-row">
        <span>Name: ${esc(campaign.setupInfo.name)}</span>
        <span>Address: ${esc(campaign.setupInfo.address)}</span>
        <span>Phone: ${esc(campaign.setupInfo.phone)}</span>
        <span>Instagram: ${esc(campaign.setupInfo.instagramHandle)}</span>
      </div>` : "";
      return `<div class="queue-item ad-campaign-admin-card">
        <div class="message-envelope-head">
          <strong>${esc(campaign.title)}</strong>
          <span>${esc(campaign.status || "active")}</span>
        </div>
        <p>${esc(campaign.body)}</p>
        <p><strong>Potential audience:</strong> ${Number(stat.matchedPatrons || 0).toLocaleString()} patron match(es)</p>
        <p><strong>Delivery rule:</strong> Must match this page slot and at least one target tag/datapoint${campaign.minimumAge ? `, and patron must be ${esc(campaign.minimumAge)}+` : ""}.</p>
        ${campaign.requiredTargetGroups?.length ? `<p><strong>Required targeting:</strong> ${campaign.requiredTargetGroups.map(group => esc(group.label)).join(" + ")}</p>` : ""}
        ${campaign.campaignDatapoints?.length ? `<p><strong>Campaign datapoints:</strong> ${campaign.campaignDatapoints.map(group => `${esc(group.category)}: ${esc(splitTags(group.tags).join(", "))}`).join(" | ")}</p>` : ""}
        ${campaign.demoLabel ? `<p><strong>${esc(campaign.demoLabel)}</strong></p>` : ""}
        <p><strong>AI targeting:</strong> ${esc(campaign.aiTargetingPrompt || "Use tag overlap against patron datapoints.")}</p>
        ${campaign.canva?.editUrl ? `<p><strong>Canva Source:</strong> <a class="message-inline-link" href="${esc(campaign.canva.editUrl)}" target="_blank" rel="noopener">${esc(campaign.canva.designId || "Open design")}</a></p>` : ""}
        ${setup}
        <label>Target tags / datapoints
          <textarea rows="2" data-ad-tags="${esc(campaign.id)}">${esc(splitTags(campaign.targetTags).join(", "))}</textarea>
        </label>
        <label>Campaign datapoints JSON
          <textarea rows="5" data-ad-campaign-datapoints="${esc(campaign.id)}">${esc(JSON.stringify(campaign.campaignDatapoints || [], null, 2))}</textarea>
        </label>
        <label>Required target groups JSON
          <textarea rows="5" data-ad-required-groups="${esc(campaign.id)}">${esc(JSON.stringify(campaign.requiredTargetGroups || [], null, 2))}</textarea>
        </label>
        <div class="queue-actions">
          <button type="button" data-save-ad-tags="${esc(campaign.id)}">Save Target Settings</button>
          ${campaign.sourceUrl ? `<a class="button-link" href="${esc(campaign.sourceUrl)}" target="_blank" rel="noopener">Source</a>` : ""}
        </div>
      </div>`;
    }).join("");
    wrap.querySelectorAll("[data-save-ad-tags]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.saveAdTags;
        const input = wrap.querySelector(`[data-ad-tags="${CSS.escape(id)}"]`);
        const groupsInput = wrap.querySelector(`[data-ad-required-groups="${CSS.escape(id)}"]`);
        const datapointsInput = wrap.querySelector(`[data-ad-campaign-datapoints="${CSS.escape(id)}"]`);
        const requiredGroups = parseRequiredGroups(groupsInput?.value || "[]");
        if (requiredGroups === null) {
          alert("Required target groups must be valid JSON.");
          return;
        }
        let campaignDatapoints = [];
        try {
          const parsed = JSON.parse(datapointsInput?.value || "[]");
          campaignDatapoints = Array.isArray(parsed) ? parsed : [];
        } catch {
          alert("Campaign datapoints must be valid JSON.");
          return;
        }
        saveOverride(id, {targetTags:splitTags(input?.value), campaignDatapoints, requiredTargetGroups:requiredGroups});
        renderAdminCampaignManager(targetId, profileRows);
      });
    });
  }

  window.FLOQRAdCampaigns = {
    VERSION,
    campaigns,
    baseCampaigns,
    profileTags,
    scoreCampaign,
    pickCampaign,
    campaignAnalytics,
    renderAdminCampaignManager,
    saveOverride
  };
})();
