/* FLOQR ad campaign targeting.
 * Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc
 */
(function () {
  "use strict";

  const VERSION = "s3.0.101";
  const OVERRIDE_KEY = "floqrAdCampaignOverrides:v28.99";

  /** Profile fields operators can require for a match group (same keys as profileTags). */
  const PROFILE_FIELD_OPTIONS = [
    {id: "city", label: "City"},
    {id: "state", label: "State"},
    {id: "region", label: "Region"},
    {id: "province", label: "Province"},
    {id: "country", label: "Country"},
    {id: "ageRange", label: "Age range"},
    {id: "gender", label: "Gender"},
    {id: "favoriteGenres", label: "Favorite genres"},
    {id: "musicInterests", label: "Music interests"},
    {id: "nightlifeInterests", label: "Nightlife style"},
    {id: "foodChoices", label: "Food choices"},
    {id: "favoriteFoods", label: "Favorite foods"},
    {id: "beverageChoices", label: "Beverage choices"},
    {id: "favoriteBeverages", label: "Favorite beverages"},
    {id: "hobbies", label: "Hobbies"},
    {id: "generalHobbies", label: "General hobbies"},
    {id: "travelInterests", label: "Travel"},
    {id: "lookingToMeet", label: "Looking to meet"}
  ];

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
      slots: ["shoutout", "events", "clubs", "lounges", "lounge-club", "mingl", "mingl-gist", "default"],
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
      slots: ["shoutout", "lounges", "lounge-club", "mingl", "default"],
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
      slots: ["shoutout", "clubs", "events", "lounges", "mingl", "mingl-gist", "default"],
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
      slots: ["lounge-club", "lounges", "clubs", "mingl"],
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
      slots: ["clubs", "events", "mingl", "mingl-gist", "default"],
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
      slots: ["events", "clubs", "mingl", "default"],
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
      slots: ["lounges", "lounge-club", "clubs", "mingl"],
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
      slots: ["default", "beach-clubs", "shoutout", "rydr", "mingl", "mingl-gist"],
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
      return normalizeRequiredGroups(parsed);
    } catch {
      return null;
    }
  }

  function normalizeDatapoints(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
      category: String(row?.category || "").trim().slice(0, 80),
      tags: splitTags(row?.tags || []).map((t) => String(t).slice(0, 80)).slice(0, 40)
    })).filter((row) => row.category && row.tags.length);
  }

  function normalizeRequiredGroups(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((group) => ({
      label: String(group?.label || "Required target group").trim().slice(0, 80) || "Required target group",
      fields: splitTags(group?.fields || []).map((f) => String(f).slice(0, 60)).slice(0, 20),
      tags: splitTags(group?.tags || []).map((t) => String(t).slice(0, 80)).slice(0, 40)
    })).filter((group) => group.fields.length && group.tags.length);
  }

  function fieldOptionsHtml(selectedFields) {
    const selected = new Set(splitTags(selectedFields).map(normalize));
    return PROFILE_FIELD_OPTIONS.map((field) =>
      `<option value="${esc(field.id)}"${selected.has(normalize(field.id)) ? " selected" : ""}>${esc(field.label)}</option>`
    ).join("");
  }

  function datapointEditorHtml(datapoints) {
    const rows = normalizeDatapoints(datapoints);
    const list = rows.length ? rows : [{category: "", tags: []}];
    return `<div class="ad-target-editor" data-dp-editor>
      <p class="sub small">Group related tags under a category (Location, Music, Venue style…). These help operators read the campaign; matching still uses the tags below.</p>
      <div data-dp-rows>${list.map((row) => `
        <div class="profile-grid ad-target-row" data-dp-row>
          <label>Category
            <input type="text" data-dp-category maxlength="80" placeholder="e.g. Location" value="${esc(row.category || "")}"/>
          </label>
          <label>Tags (comma-separated)
            <input type="text" data-dp-tags maxlength="600" placeholder="Washington DC, DC, DMV" value="${esc(splitTags(row.tags).join(", "))}"/>
          </label>
          <button type="button" data-remove-dp-row>Remove</button>
        </div>`).join("")}</div>
      <button type="button" data-add-dp-row>+ Add category</button>
    </div>`;
  }

  function requiredGroupsEditorHtml(groups) {
    const rows = normalizeRequiredGroups(groups);
    const list = rows.length ? rows : [];
    return `<div class="ad-target-editor" data-rg-editor>
      <p class="sub small">Optional hard filters: patron must match at least one tag in <em>each</em> group below (checked only on the selected profile fields). Leave empty for soft tag scoring only.</p>
      <div data-rg-rows>${list.map((row) => `
        <div class="ad-target-row" data-rg-row>
          <label>Group label
            <input type="text" data-rg-label maxlength="80" placeholder="e.g. DC music fans" value="${esc(row.label || "")}"/>
          </label>
          <label>Profile fields to check
            <select multiple size="5" data-rg-fields>${fieldOptionsHtml(row.fields)}</select>
          </label>
          <label>Must match any of these tags (comma-separated)
            <input type="text" data-rg-tags maxlength="600" placeholder="DC, Latin, Reggaeton" value="${esc(splitTags(row.tags).join(", "))}"/>
          </label>
          <button type="button" data-remove-rg-row>Remove group</button>
        </div>`).join("")}</div>
      <button type="button" data-add-rg-row>+ Add required group</button>
    </div>`;
  }

  function collectDatapointsFromCard(card) {
    if (!card) return [];
    return normalizeDatapoints(Array.from(card.querySelectorAll("[data-dp-row]")).map((row) => ({
      category: row.querySelector("[data-dp-category]")?.value || "",
      tags: row.querySelector("[data-dp-tags]")?.value || ""
    })));
  }

  function collectRequiredGroupsFromCard(card) {
    if (!card) return [];
    return normalizeRequiredGroups(Array.from(card.querySelectorAll("[data-rg-row]")).map((row) => {
      const select = row.querySelector("[data-rg-fields]");
      const fields = select
        ? Array.from(select.selectedOptions).map((opt) => opt.value)
        : [];
      return {
        label: row.querySelector("[data-rg-label]")?.value || "",
        fields,
        tags: row.querySelector("[data-rg-tags]")?.value || ""
      };
    }));
  }

  function emptyDatapointRowHtml() {
    return `<div class="profile-grid ad-target-row" data-dp-row>
      <label>Category
        <input type="text" data-dp-category maxlength="80" placeholder="e.g. Location" value=""/>
      </label>
      <label>Tags (comma-separated)
        <input type="text" data-dp-tags maxlength="600" placeholder="Washington DC, DC, DMV" value=""/>
      </label>
      <button type="button" data-remove-dp-row>Remove</button>
    </div>`;
  }

  function emptyRequiredGroupRowHtml() {
    return `<div class="ad-target-row" data-rg-row>
      <label>Group label
        <input type="text" data-rg-label maxlength="80" placeholder="e.g. DC music fans" value=""/>
      </label>
      <label>Profile fields to check
        <select multiple size="5" data-rg-fields>${fieldOptionsHtml([])}</select>
      </label>
      <label>Must match any of these tags (comma-separated)
        <input type="text" data-rg-tags maxlength="600" placeholder="DC, Latin, Reggaeton" value=""/>
      </label>
      <button type="button" data-remove-rg-row>Remove group</button>
    </div>`;
  }

  function mountCreativePreview(host, campaign) {
    if (!host || !campaign) return;
    host.innerHTML = "";
    host.classList.add("ad-creative-preview");
    if (campaign.creativeType === "html" && campaign.htmlBody) {
      const frame = document.createElement("iframe");
      frame.className = "ad-html-preview";
      frame.setAttribute("sandbox", "");
      frame.setAttribute("title", `${campaign.title || "Ad"} HTML preview`);
      frame.style.cssText = "width:100%;max-width:360px;height:200px;border:0;border-radius:12px;background:#111";
      frame.srcdoc = String(campaign.htmlBody);
      host.appendChild(frame);
      return;
    }
    if (campaign.image) {
      const img = document.createElement("img");
      img.src = String(campaign.image);
      img.alt = `${campaign.title || "Ad"} creative preview`;
      img.style.cssText = "max-width:100%;max-width:360px;max-height:280px;border-radius:12px;background:#050819;display:block";
      host.appendChild(img);
      return;
    }
    host.innerHTML = `<p class="sub small">No flyer or HTML creative on this campaign yet.</p>`;
  }

  function bindTargetEditorActions(card) {
    if (!card || card.dataset.targetEditorBound === "1") return;
    card.dataset.targetEditorBound = "1";
    card.addEventListener("click", (event) => {
      const addDp = event.target.closest("[data-add-dp-row]");
      if (addDp && card.contains(addDp)) {
        card.querySelector("[data-dp-rows]")?.insertAdjacentHTML("beforeend", emptyDatapointRowHtml());
        return;
      }
      const removeDp = event.target.closest("[data-remove-dp-row]");
      if (removeDp && card.contains(removeDp)) {
        const rows = card.querySelectorAll("[data-dp-row]");
        if (rows.length <= 1) {
          removeDp.closest("[data-dp-row]")?.querySelectorAll("input").forEach((input) => { input.value = ""; });
          return;
        }
        removeDp.closest("[data-dp-row]")?.remove();
        return;
      }
      const addRg = event.target.closest("[data-add-rg-row]");
      if (addRg && card.contains(addRg)) {
        card.querySelector("[data-rg-rows]")?.insertAdjacentHTML("beforeend", emptyRequiredGroupRowHtml());
        return;
      }
      const removeRg = event.target.closest("[data-remove-rg-row]");
      if (removeRg && card.contains(removeRg)) {
        removeRg.closest("[data-rg-row]")?.remove();
      }
    });
  }

  let firestoreSpotAds = [];
  let firestorePendingAds = [];

  function isScheduleLive(campaign, nowMs = Date.now()) {
    const starts = Number(campaign.startsAtMs || campaign.proposedStartsAtMs || 0);
    const ends = Number(campaign.endsAtMs || campaign.proposedEndsAtMs || 0);
    if (starts && nowMs < starts) return false;
    if (ends && nowMs > ends) return false;
    return true;
  }

  function campaigns() {
    const overrides = readOverrides();
    const dc = (typeof window !== "undefined" && window.FLOQRDcSpotAds?.campaigns) || [];
    const merged = [...baseCampaigns, ...dc, ...firestoreSpotAds];
    const byId = new Map();
    merged.forEach(campaign => {
      if (!campaign?.id) return;
      byId.set(campaign.id, {...campaign, ...(overrides[campaign.id] || {})});
    });
    return Array.from(byId.values());
  }

  function mapSpotDoc(doc) {
    const row = doc.data() || {};
    const placementType = String(row.placementType || "").trim() || (
      Array.isArray(row.slots) && row.slots.includes("mingl-gist") && !row.slots.includes("default")
        ? "minglGist"
        : "inline"
    );
    const pricing = (typeof window !== "undefined" && window.FLOQRAdPricing?.packageFor?.(placementType)) || null;
    return {
      id: doc.id,
      title: row.title || row.headline || "Spot ad",
      badge: row.badge || row.eyebrow || "Sponsored",
      advertiser: row.advertiser || row.businessName || row.clubName || "Advertiser",
      status: row.status || "active",
      sourceUrl: row.sourceUrl || row.linkUrl || "",
      image: row.image || row.imageUrl || row.backgroundImageUrl || "",
      htmlBody: row.htmlBody || "",
      creativeType: row.creativeType || (row.htmlBody ? "html" : "image"),
      body: row.body || "",
      callToAction: row.cta || row.callToAction || "Learn more",
      slots: Array.isArray(row.slots) && row.slots.length
        ? row.slots
        : (pricing?.slots || ["clubs", "events", "mingl", "mingl-gist", "rydr", "default"]),
      placementType,
      targetMode: row.targetMode || (Array.isArray(row.targetTags) && row.targetTags.length ? "targeted" : "all"),
      targetTags: row.targetTags || [],
      clubLocationId: row.clubLocationId || "",
      eventTags: row.eventTags || [],
      priceCents: row.priceCents ?? pricing?.priceCents ?? null,
      paymentStatus: row.paymentStatus || "",
      publishedByUid: row.publishedByUid || "",
      publisherEmail: row.publisherEmail || "",
      businessName: row.businessName || "",
      startsAtMs: Number(row.startsAtMs || 0) || null,
      endsAtMs: Number(row.endsAtMs || 0) || null,
      proposedStartsAtMs: Number(row.proposedStartsAtMs || 0) || null,
      proposedEndsAtMs: Number(row.proposedEndsAtMs || 0) || null,
      createdAtMs: Number(row.createdAtMs || 0) || null,
      source: row.source || "firestore"
    };
  }

  async function loadFirestoreSpotAds(db) {
    if (!db?.collection) return campaigns();
    try {
      const snap = await db.collection("spotAdCampaigns").where("status", "==", "active").limit(80).get();
      firestoreSpotAds = snap.docs.map(mapSpotDoc).filter((row) => isScheduleLive(row));
    } catch (error) {
      firestoreSpotAds = [];
    }
    return campaigns();
  }

  async function loadPendingSpotAds(db) {
    if (!db?.collection) return [];
    try {
      const snap = await db.collection("spotAdCampaigns").where("status", "==", "pending_approval").limit(80).get();
      firestorePendingAds = snap.docs.map(mapSpotDoc)
        .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
    } catch (error) {
      firestorePendingAds = [];
    }
    return firestorePendingAds;
  }

  function pendingCampaigns() {
    return firestorePendingAds.slice();
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
    // Allow "default" campaigns to be eligible for other slots too.
    // This prevents the rotation from collapsing to a single advertiser when
    // your non-default slots don't have matching campaigns seeded yet.
    if (slots.includes("default")) return slot === "default" ? 10 : 8;
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
    if (String(campaign.status || "active") === "pending_approval") return -999;
    if (String(campaign.status || "") === "rejected") return -999;
    if (!isScheduleLive(campaign)) return -999;
    if (campaign.minimumAge) {
      const age = profileAgeNumber(profile);
      if (!age || age < campaign.minimumAge) return -999;
    }
    const placement = String(campaign.placementType || "");
    if (placement === "minglGist" && slot !== "mingl-gist" && slot !== "mingl") return -999;
    if (placement === "inline" && (slot === "mingl-gist")) {
      // Inline packages are not Mingl Gist scroll inventory.
      return -999;
    }
    const slotScore = campaignSlotScore(campaign, slot);
    if (slotScore < 0) return -999;
    const requiredGroups = campaignRequiredGroupMatches(campaign, profile);
    if (requiredGroups.some(group => !group.matches.length)) return -999;
    const targetMode = String(campaign.targetMode || "all");
    const matches = campaignTargetMatches(campaign, profile);
    const hasTags = splitTags(campaign.targetTags).length > 0;
    if (targetMode === "targeted" && hasTags && !matches.length && !campaign.isHouseFallback) return -999;
    // targetMode "all" or empty tags: eligible for any patron (still slot/age gated).
    let score = slotScore + (matches.length * 20) + requiredGroups.reduce((sum, group) => sum + group.matches.length * 25, 0);
    if (campaign.status === "active") score += 5;
    if (campaign.status === "needs-verification") score -= 15;
    if (campaign.source === "patron_business") score += 3;
    // Soft diversify: lightly prefer campaigns that are not the last shown advertiser.
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
      htmlBody: selected.htmlBody || "",
      creativeType: selected.creativeType || "image",
      campaignId: selected.id,
      advertiser: selected.advertiser || "",
      placementType: selected.placementType || "",
      callToAction: selected.callToAction || "Learn more",
      sourceUrl: selected.sourceUrl || ""
    };
  }

  function nextRotatingCampaign(slot, pool = []) {
    const candidates = pool.filter(Boolean);
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];
    const key = `floqrAdCampaignRotation:${slot}`;
    const prevKey = `floqrAdCampaignRotationAdvertiser:${slot}`;
    const previous = localStorage.getItem(key) || "";
    const previousAdvertiser = normalize(localStorage.getItem(prevKey) || "");
    // Prefer a different advertiser than last shown so Zebbies cannot monopolize.
    const diversify = candidates.filter(item => normalize(item.advertiser || item.id) !== previousAdvertiser);
    const rotatePool = diversify.length ? diversify : candidates;
    const previousIndex = rotatePool.findIndex(item => item.id === previous);
    const next = rotatePool[(previousIndex + 1) % rotatePool.length] || rotatePool[0];
    localStorage.setItem(key, next.id);
    localStorage.setItem(prevKey, next.advertiser || next.id);
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

  async function approveCampaign(db, campaignId, {startsAtMs, endsAtMs, waivePayment = false} = {}) {
    if (!db?.collection || !campaignId) throw new Error("Missing campaign.");
    const ref = db.collection("spotAdCampaigns").doc(campaignId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Campaign not found.");
    const row = snap.data() || {};
    const now = Date.now();
    const flightDays = Number(row.flightDays || 7);
    const starts = Number(startsAtMs || row.proposedStartsAtMs || now);
    const ends = Number(endsAtMs || row.proposedEndsAtMs || (starts + flightDays * 24 * 60 * 60 * 1000));
    const patch = {
      status: "active",
      startsAtMs: starts,
      endsAtMs: ends,
      approvedAtMs: now,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (waivePayment) patch.paymentStatus = "waived";
    await ref.set(patch, {merge: true});
    return patch;
  }

  async function rejectCampaign(db, campaignId, reason = "") {
    if (!db?.collection || !campaignId) throw new Error("Missing campaign.");
    await db.collection("spotAdCampaigns").doc(campaignId).set({
      status: "rejected",
      rejectedAtMs: Date.now(),
      rejectionReason: String(reason || "").slice(0, 400),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
  }

  function renderPendingApprovalQueue(targetId, db) {
    const wrap = document.getElementById(targetId);
    if (!wrap) return;
    const rows = pendingCampaigns();
    if (!rows.length) {
      wrap.innerHTML = `<p class="sub">No pending business campaigns. Business accounts submit from My Profile → Ad Campaigns.</p>`;
      return;
    }
    wrap.innerHTML = rows.map((campaign) => {
      const price = (typeof window !== "undefined" && window.FLOQRAdPricing?.priceLabel?.(campaign.priceCents)) || "";
      const startVal = campaign.proposedStartsAtMs ? new Date(campaign.proposedStartsAtMs).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      const endVal = campaign.proposedEndsAtMs ? new Date(campaign.proposedEndsAtMs).toISOString().slice(0, 10) : "";
      return `<div class="queue-item ad-campaign-pending-card" data-campaign-id="${esc(campaign.id)}">
        <div class="message-envelope-head">
          <strong>${esc(campaign.title)}</strong>
          <span>pending · ${esc(campaign.placementType || "")} · ${esc(campaign.creativeType || "image")}</span>
        </div>
        <p>${esc(campaign.body || "")}</p>
        <p class="sub small">${esc(campaign.advertiser || "")} · ${esc(campaign.publisherEmail || "")} · ${esc(price)} · pay ${esc(campaign.paymentStatus || "unpaid")} · audience ${esc(campaign.targetMode || "all")}</p>
        ${campaign.targetTags?.length ? `<p class="sub small">Tags: ${esc(splitTags(campaign.targetTags).join(", "))}</p>` : ""}
        <div class="ad-creative-preview" data-ad-preview-host="${esc(campaign.id)}" hidden></div>
        <div class="profile-grid">
          <label>Starts <input type="date" data-ad-start="${esc(campaign.id)}" value="${esc(startVal)}"/></label>
          <label>Ends <input type="date" data-ad-end="${esc(campaign.id)}" value="${esc(endVal)}"/></label>
        </div>
        <div class="queue-actions">
          <button type="button" data-preview-ad="${esc(campaign.id)}">Preview creative</button>
          <button type="button" class="primary" data-approve-ad="${esc(campaign.id)}">Approve &amp; schedule</button>
          <button type="button" data-approve-waive-ad="${esc(campaign.id)}">Approve (waive payment)</button>
          <button type="button" data-reject-ad="${esc(campaign.id)}">Reject</button>
        </div>
      </div>`;
    }).join("");

    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    wrap.querySelectorAll("[data-preview-ad]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.previewAd;
        const host = wrap.querySelector(`[data-ad-preview-host="${CSS.escape(id)}"]`);
        const campaign = byId[id];
        if (!host || !campaign) return;
        const opening = host.hasAttribute("hidden");
        if (opening) {
          mountCreativePreview(host, campaign);
          host.removeAttribute("hidden");
          button.textContent = "Hide preview";
        } else {
          host.setAttribute("hidden", "");
          host.innerHTML = "";
          button.textContent = "Preview creative";
        }
      });
    });

    const refresh = async () => {
      await loadPendingSpotAds(db);
      await loadFirestoreSpotAds(db);
      renderPendingApprovalQueue(targetId, db);
    };

    wrap.querySelectorAll("[data-approve-ad], [data-approve-waive-ad]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.approveAd || button.dataset.approveWaiveAd;
        const startStr = wrap.querySelector(`[data-ad-start="${CSS.escape(id)}"]`)?.value || "";
        const endStr = wrap.querySelector(`[data-ad-end="${CSS.escape(id)}"]`)?.value || "";
        const startsAtMs = startStr ? Date.parse(`${startStr}T00:00:00`) : Date.now();
        const endsAtMs = endStr ? Date.parse(`${endStr}T23:59:59`) : startsAtMs + 7 * 24 * 60 * 60 * 1000;
        try {
          await approveCampaign(db, id, {
            startsAtMs,
            endsAtMs,
            waivePayment: !!button.dataset.approveWaiveAd
          });
          await refresh();
        } catch (err) {
          alert(err?.message || "Approve failed.");
        }
      });
    });
    wrap.querySelectorAll("[data-reject-ad]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.rejectAd;
        const reason = prompt("Rejection reason (optional)") || "";
        try {
          await rejectCampaign(db, id, reason);
          await refresh();
        } catch (err) {
          alert(err?.message || "Reject failed.");
        }
      });
    });
  }

  function renderAdminCampaignManager(targetId, profileRows = []) {
    const wrap = document.getElementById(targetId);
    if (!wrap) return;
    const analytics = campaignAnalytics(profileRows);
    const list = campaigns();
    if (!list.length) {
      wrap.innerHTML = `<p class="sub">No campaigns in the live pool yet.</p>`;
      return;
    }
    wrap.innerHTML = list.map((campaign) => {
      const stat = analytics.find((item) => item.id === campaign.id) || {};
      const setup = campaign.setupInfo ? `<div class="tag-row">
        <span>Name: ${esc(campaign.setupInfo.name)}</span>
        <span>Address: ${esc(campaign.setupInfo.address)}</span>
        <span>Phone: ${esc(campaign.setupInfo.phone)}</span>
        <span>Instagram: ${esc(campaign.setupInfo.instagramHandle)}</span>
      </div>` : "";
      return `<div class="queue-item ad-campaign-admin-card" data-campaign-id="${esc(campaign.id)}">
        <div class="message-envelope-head">
          <strong>${esc(campaign.title)}</strong>
          <span>${esc(campaign.status || "active")} · ${esc(campaign.placementType || campaign.slots?.[0] || "")}</span>
        </div>
        <p>${esc(campaign.body)}</p>
        <p class="sub small"><strong>Potential audience:</strong> ${Number(stat.matchedPatrons || 0).toLocaleString()} patron match(es)${campaign.minimumAge ? ` · ${esc(campaign.minimumAge)}+ only` : ""}${campaign.targetMode === "all" ? " · all patrons (slot/age still apply)" : ""}</p>
        ${campaign.demoLabel ? `<p class="sub small">${esc(campaign.demoLabel)}</p>` : ""}
        ${campaign.aiTargetingPrompt ? `<p class="sub small">${esc(campaign.aiTargetingPrompt)}</p>` : ""}
        ${campaign.canva?.editUrl ? `<p class="sub small">Canva: <a class="message-inline-link" href="${esc(campaign.canva.editUrl)}" target="_blank" rel="noopener">${esc(campaign.canva.designId || "Open design")}</a></p>` : ""}
        ${setup}
        <div class="ad-creative-preview" data-ad-preview-host="${esc(campaign.id)}" hidden></div>
        <fieldset class="ad-target-fieldset">
          <legend>Who should see this ad</legend>
          <label>Match tags (comma-separated)
            <input type="text" data-ad-tags="${esc(campaign.id)}" maxlength="1200" placeholder="tequila, lounge, VIP, celebration" value="${esc(splitTags(campaign.targetTags).join(", "))}"/>
          </label>
          <p class="sub small">Patrons match when any of these overlap their profile (city, music, nightlife, food, etc.).</p>
          <h4 class="sub">Tag categories (optional, for clarity)</h4>
          ${datapointEditorHtml(campaign.campaignDatapoints)}
          <h4 class="sub">Required match groups (optional hard filters)</h4>
          ${requiredGroupsEditorHtml(campaign.requiredTargetGroups)}
        </fieldset>
        <div class="queue-actions">
          <button type="button" data-preview-ad="${esc(campaign.id)}">Preview creative</button>
          <button type="button" class="primary" data-save-ad-tags="${esc(campaign.id)}">Save targeting</button>
          ${campaign.sourceUrl ? `<a class="button-link" href="${esc(campaign.sourceUrl)}" target="_blank" rel="noopener">Advertiser site</a>` : ""}
        </div>
        <p class="sub small">Save stores targeting as a local override in this browser (for packaged demos and quick tests). It does not rewrite the Firestore campaign document.</p>
      </div>`;
    }).join("");

    const byId = Object.fromEntries(list.map((row) => [row.id, row]));
    wrap.querySelectorAll(".ad-campaign-admin-card").forEach((card) => bindTargetEditorActions(card));

    wrap.querySelectorAll("[data-preview-ad]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.previewAd;
        const host = wrap.querySelector(`[data-ad-preview-host="${CSS.escape(id)}"]`);
        const campaign = byId[id];
        if (!host || !campaign) return;
        const opening = host.hasAttribute("hidden");
        if (opening) {
          mountCreativePreview(host, campaign);
          host.removeAttribute("hidden");
          button.textContent = "Hide preview";
        } else {
          host.setAttribute("hidden", "");
          host.innerHTML = "";
          button.textContent = "Preview creative";
        }
      });
    });

    wrap.querySelectorAll("[data-save-ad-tags]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.saveAdTags;
        const card = button.closest(".ad-campaign-admin-card");
        const input = wrap.querySelector(`[data-ad-tags="${CSS.escape(id)}"]`);
        const targetTags = splitTags(input?.value).map((t) => String(t).slice(0, 80)).slice(0, 80);
        if (!targetTags.length && !card?.querySelector("[data-rg-row]")) {
          // Allow empty tags (house / all-mode demos) — do not block save.
        }
        const campaignDatapoints = collectDatapointsFromCard(card);
        const requiredTargetGroups = collectRequiredGroupsFromCard(card);
        const incompleteDp = Array.from(card?.querySelectorAll("[data-dp-row]") || []).some((row) => {
          const cat = String(row.querySelector("[data-dp-category]")?.value || "").trim();
          const tags = splitTags(row.querySelector("[data-dp-tags]")?.value);
          return (cat && !tags.length) || (!cat && tags.length);
        });
        if (incompleteDp) {
          alert("Each tag category needs both a category name and at least one tag (or clear the row).");
          return;
        }
        const incompleteRg = Array.from(card?.querySelectorAll("[data-rg-row]") || []).some((row) => {
          const select = row.querySelector("[data-rg-fields]");
          const fields = select ? Array.from(select.selectedOptions) : [];
          const tags = splitTags(row.querySelector("[data-rg-tags]")?.value);
          const label = String(row.querySelector("[data-rg-label]")?.value || "").trim();
          const any = label || fields.length || tags.length;
          return any && (!fields.length || !tags.length);
        });
        if (incompleteRg) {
          alert("Each required group needs profile fields and match tags (or remove the group).");
          return;
        }
        saveOverride(id, {targetTags, campaignDatapoints, requiredTargetGroups});
        renderAdminCampaignManager(targetId, profileRows);
      });
    });
  }

  window.FLOQRAdCampaigns = {
    VERSION,
    campaigns,
    pendingCampaigns,
    baseCampaigns,
    profileTags,
    scoreCampaign,
    pickCampaign,
    campaignAnalytics,
    renderAdminCampaignManager,
    renderPendingApprovalQueue,
    approveCampaign,
    rejectCampaign,
    saveOverride,
    loadFirestoreSpotAds,
    loadPendingSpotAds,
    isScheduleLive,
    PROFILE_FIELD_OPTIONS,
    normalizeDatapoints,
    normalizeRequiredGroups,
    collectDatapointsFromCard,
    collectRequiredGroupsFromCard,
    mountCreativePreview
  };
})();
