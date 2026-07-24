/* Mingl Gist — Instagram Stories-style feed for FLOQR */
(function () {
  "use strict";

  const STORY_MS = 5000;
  const AD_EVERY = 4;
  const APP_V = "29.09.14";

  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

  let currentUser = null;
  let clubNameById = {};
  let stories = [];
  let rings = [];
  let activeIndex = 0;
  let timerId = null;
  let progressStartedAt = 0;
  let progressRaf = null;
  let seenRingIds = new Set();

  function setStatus(message) {
    const el = byId("minglGistStatus");
    if (el) el.textContent = message || "";
  }

  function toMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.seconds === "number") return value.seconds * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isDisplayableShoutout(row = {}) {
    const status = String(row.status || "").toLowerCase();
    const payment = String(row.paymentStatus || row.payment || "").toLowerCase();
    if (row.displayed === true || row.onDisplay === true) return true;
    if (["approved", "paid", "displayed", "displaying", "live", "completed"].includes(status)) return true;
    if (["paid", "succeeded", "complete", "completed"].includes(payment)) return true;
    return false;
  }

  function hashTag(value) {
    const raw = String(value || "").trim().replace(/^#/, "");
    if (!raw) return "";
    return `#${raw.replace(/\s+/g, "")}`;
  }

  function clubTagFor(row = {}) {
    const id = String(row.clubLocationId || row.location || row.club || "").trim();
    const name = row.locationName || row.clubName || clubNameById[id] || "";
    if (name) return hashTag(name);
    if (id) return hashTag(id);
    return "";
  }

  function eventTagFor(row = {}) {
    const tag = row.eventTag || row.eventName || row.eventLabel || "";
    return tag ? hashTag(tag) : "";
  }

  function submitterName(row = {}) {
    const submittedBy = row.submittedBy;
    const submittedByLabel = typeof submittedBy === "string"
      ? submittedBy
      : (submittedBy?.displayName || submittedBy?.email || submittedBy?.name || "");
    return row.submittedByName
      || row.displayName
      || row.submittedByDisplayName
      || submittedByLabel
      || row.submittedByEmail
      || "ShoutOut";
  }

  function initial(name) {
    return String(name || "G").trim().slice(0, 1).toUpperCase() || "G";
  }

  function isMinglAdCampaign(campaign = {}) {
    const slots = Array.isArray(campaign.slots) ? campaign.slots.map(String) : [];
    if (slots.some((slot) => ["mingl", "mingl-gist"].includes(slot))) return true;
    if (slots.some((slot) => ["clubs", "events", "lounges", "lounge-club", "promoter"].includes(slot))) return true;
    const advertiser = String(campaign.advertiser || "").toLowerCase();
    return /club|promoter|nightlife|venue/.test(advertiser);
  }

  async function loadClubNames() {
    clubNameById = {};
    try {
      const snap = await db.collection("clubLocations").limit(400).get();
      snap.forEach((doc) => {
        const data = doc.data() || {};
        clubNameById[doc.id] = data.locationName || data.brandName || data.clubName || doc.id;
      });
    } catch (error) {
      console.warn("Mingl Gist clubLocations load skipped", error);
    }
  }

  async function loadShoutoutStories() {
    if (!currentUser) return [];
    let rows = [];
    try {
      const snap = await db.collection("shoutouts").orderBy("submittedAt", "desc").limit(60).get();
      rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      try {
        const snap = await db.collection("shoutouts").limit(80).get();
        rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      } catch (fallbackError) {
        console.warn("Mingl Gist shoutouts load failed", fallbackError || error);
        return [];
      }
    }
    return rows
      .filter(isDisplayableShoutout)
      .sort((a, b) => toMillis(b.submittedAt || b.approvedAt || b.createdAt) - toMillis(a.submittedAt || a.approvedAt || a.createdAt))
      .slice(0, 40)
      .map((row) => {
        const name = submitterName(row);
        const clubChip = clubTagFor(row);
        const eventChip = eventTagFor(row);
        const chips = [clubChip, eventChip].filter(Boolean);
        const mediaUrl = row.mediaUrl || row.image || row.enhancedMediaUrl || row.originalMediaUrl || "";
        return {
          id: `shoutout:${row.id}`,
          ringId: `user:${row.submittedByUid || name}`,
          type: "shoutout",
          authorUid: row.submittedByUid || "",
          submittedByUid: row.submittedByUid || "",
          authorName: name,
          avatarUrl: row.submitterPhotoURL || row.photoURL || "",
          mediaUrl,
          mediaType: row.mediaType || "",
          title: row.mainText || row.main || "ShoutOut",
          body: row.subText || row.sub || [row.locationName || row.clubName, row.city].filter(Boolean).join(" · "),
          chips,
          createdAt: toMillis(row.submittedAt || row.approvedAt || row.createdAt),
          ctaLabel: "",
          ctaHref: ""
        };
      });
  }

  async function loadMinglGistStories() {
    try {
      const snap = await db.collection("minglGists").orderBy("createdAt", "desc").limit(40).get();
      return snap.docs.map((doc) => {
        const row = { id: doc.id, ...doc.data() };
        const name = row.authorName || row.displayName || "Mingl";
        const chips = [row.eventTag ? hashTag(row.eventTag) : "", clubTagFor(row)].filter(Boolean);
        return {
          id: `gist:${row.id}`,
          ringId: `user:${row.authorUid || name}`,
          type: "gist",
          authorUid: row.authorUid || "",
          submittedByUid: row.authorUid || "",
          authorName: name,
          avatarUrl: row.authorPhotoURL || row.photoURL || "",
          mediaUrl: row.mediaUrl || row.image || "",
          mediaType: row.mediaType || "",
          title: row.caption || row.mainText || "Mingl Gist",
          body: row.subText || "",
          chips,
          createdAt: toMillis(row.createdAt),
          ctaLabel: "",
          ctaHref: ""
        };
      });
    } catch (error) {
      console.warn("Mingl Gist minglGists load skipped", error);
      return [];
    }
  }

  function loadAdStories(profile = {}) {
    const campaigns = (window.FLOQRAdCampaigns?.campaigns?.() || []).filter(isMinglAdCampaign);
    if (!campaigns.length) {
      const picked = window.FLOQRAdCampaigns?.pickCampaign?.("mingl-gist", profile)
        || window.FLOQRAdCampaigns?.pickCampaign?.("mingl", profile);
      if (!picked) return [];
      return [{
        id: `ad:${picked.campaignId || "mingl"}`,
        ringId: `ad:${picked.campaignId || "mingl"}`,
        type: "ad",
        authorName: picked.title || "Sponsored",
        avatarUrl: picked.image || "",
        mediaUrl: picked.image || "",
        mediaType: "image",
        title: picked.title || "Sponsored",
        body: picked.body || "",
        chips: ["#Sponsored"],
        createdAt: Date.now(),
        ctaLabel: picked.callToAction || "Learn more",
        ctaHref: picked.sourceUrl || "#"
      }];
    }
    return campaigns.slice(0, 8).map((campaign) => ({
      id: `ad:${campaign.id}`,
      ringId: `ad:${campaign.id}`,
      type: "ad",
      authorName: campaign.advertiser || campaign.title || "Sponsored",
      avatarUrl: campaign.image || "",
      mediaUrl: campaign.image || "",
      mediaType: "image",
      title: campaign.title || "Sponsored",
      body: campaign.body || "",
      chips: ["#Sponsored", campaign.badge ? hashTag(campaign.badge) : ""].filter(Boolean),
      createdAt: Date.now(),
      ctaLabel: campaign.callToAction || "Learn more",
      ctaHref: campaign.sourceUrl || "#",
      campaignId: campaign.id
    }));
  }

  function interleaveAds(contentStories, adStories) {
    if (!contentStories.length) return adStories.slice(0, 3);
    if (!adStories.length) return contentStories.slice();
    const out = [];
    let adIndex = 0;
    contentStories.forEach((story, index) => {
      out.push(story);
      if ((index + 1) % AD_EVERY === 0 && adStories.length) {
        out.push(adStories[adIndex % adStories.length]);
        adIndex += 1;
      }
    });
    return out;
  }

  function buildRings(storyList) {
    const map = new Map();
    storyList.forEach((story, index) => {
      if (!map.has(story.ringId)) {
        map.set(story.ringId, {
          ringId: story.ringId,
          authorName: story.authorName,
          avatarUrl: story.avatarUrl,
          type: story.type,
          startIndex: index,
          count: 0
        });
      }
      map.get(story.ringId).count += 1;
    });
    return Array.from(map.values());
  }

  function renderRing() {
    const wrap = byId("minglGistRing");
    const empty = byId("minglGistEmpty");
    if (!wrap) return;
    if (!rings.length) {
      wrap.innerHTML = "";
      empty?.classList.remove("hidden");
      return;
    }
    empty?.classList.add("hidden");
    wrap.innerHTML = rings.map((ring) => {
      const seen = seenRingIds.has(ring.ringId) ? "seen" : "";
      const sponsored = ring.type === "ad" ? "sponsored" : "";
      const avatar = ring.avatarUrl
        ? `<img src="${esc(ring.avatarUrl)}" alt="">`
        : `<span>${esc(initial(ring.authorName))}</span>`;
      return `<button class="mingl-gist-ring-item" type="button" data-ring-id="${esc(ring.ringId)}" data-start-index="${ring.startIndex}">
        <span class="mingl-gist-ring-avatar ${seen} ${sponsored}">${avatar}</span>
        <small>${esc(ring.authorName)}</small>
      </button>`;
    }).join("");
    wrap.querySelectorAll("[data-start-index]").forEach((button) => {
      button.addEventListener("click", () => {
        openViewer(Number(button.dataset.startIndex || 0));
      });
    });
  }

  function stopProgress() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (progressRaf) {
      cancelAnimationFrame(progressRaf);
      progressRaf = null;
    }
  }

  function renderProgress(index) {
    const wrap = byId("minglGistProgress");
    if (!wrap) return;
    wrap.innerHTML = stories.map((_, i) => {
      const state = i < index ? "done" : i === index ? "active" : "";
      return `<div class="mingl-gist-progress-seg ${state}"><i></i></div>`;
    }).join("");
  }

  function tickProgress() {
    const active = byId("minglGistProgress")?.querySelector(".mingl-gist-progress-seg.active");
    if (!active) return;
    const elapsed = Date.now() - progressStartedAt;
    const pct = Math.min(100, (elapsed / STORY_MS) * 100);
    active.style.setProperty("--gist-progress", `${pct}%`);
    if (elapsed < STORY_MS) {
      progressRaf = requestAnimationFrame(tickProgress);
    }
  }

  function showStory(index) {
    if (!stories.length) return;
    activeIndex = ((index % stories.length) + stories.length) % stories.length;
    const story = stories[activeIndex];
    seenRingIds.add(story.ringId);
    renderProgress(activeIndex);

    const avatar = byId("minglGistViewerAvatar");
    if (avatar) {
      avatar.innerHTML = story.avatarUrl
        ? `<img src="${esc(story.avatarUrl)}" alt="">`
        : esc(initial(story.authorName));
    }
    setText("minglGistViewerName", story.authorName || "Story");
    setText("minglGistViewerSub", story.type === "ad" ? "Sponsored" : story.type === "shoutout" ? "ShoutOut" : "Mingl Gist");
    setText("minglGistTitle", story.title || "");
    setText("minglGistBody", story.body || "");

    const chips = byId("minglGistChips");
    if (chips) {
      chips.innerHTML = (story.chips || []).map((chip) => {
        const sponsored = /sponsored/i.test(chip) ? "sponsored" : "";
        return `<span class="mingl-gist-chip ${sponsored}">${esc(chip)}</span>`;
      }).join("");
    }

    const media = byId("minglGistMedia");
    if (media) {
      media.classList.toggle("no-media", !story.mediaUrl);
      if (story.mediaUrl) {
        const isVideo = String(story.mediaType || "").startsWith("video") || /\.(mp4|webm|mov)(\?|$)/i.test(story.mediaUrl);
        media.innerHTML = isVideo
          ? `<video src="${esc(story.mediaUrl)}" autoplay muted playsinline></video>`
          : `<img src="${esc(story.mediaUrl)}" alt="">`;
        if (!isVideo) media.style.backgroundImage = `url("${story.mediaUrl.replace(/"/g, "%22")}")`;
        else media.style.backgroundImage = "";
      } else {
        media.innerHTML = "";
        media.style.backgroundImage = "";
      }
    }

    const cta = byId("minglGistCta");
    if (cta) {
      const showCta = story.type === "ad" && story.ctaHref && story.ctaHref !== "#";
      cta.classList.toggle("hidden", !showCta && story.type !== "ad");
      cta.textContent = story.ctaLabel || "Learn more";
      cta.href = story.ctaHref && story.ctaHref !== "#" ? story.ctaHref : `./?v=${APP_V}&start=mingl`;
      if (!showCta && story.type === "ad") cta.classList.remove("hidden");
    }

    stopProgress();
    progressStartedAt = Date.now();
    tickProgress();
    timerId = setTimeout(() => {
      if (activeIndex >= stories.length - 1) closeViewer();
      else showStory(activeIndex + 1);
    }, STORY_MS);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value || "";
  }

  function openViewer(index = 0) {
    const viewer = byId("minglGistViewer");
    if (!viewer || !stories.length) return;
    viewer.classList.remove("hidden");
    viewer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    showStory(index);
  }

  function closeViewer() {
    stopProgress();
    const viewer = byId("minglGistViewer");
    viewer?.classList.add("hidden");
    viewer?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    renderRing();
  }

  async function refreshFeed() {
    setStatus("Loading Mingl Gist…");
    await loadClubNames();
    let blocked = new Set();
    if (currentUser && window.FLOQRBlocks?.loadActiveBlocks) {
      const blocks = await window.FLOQRBlocks.loadActiveBlocks(db, currentUser.uid);
      blocked = window.FLOQRBlocks.blockedUidSet(blocks, currentUser.uid);
    }
    const [shoutouts, gists] = await Promise.all([loadShoutoutStories(), loadMinglGistStories()]);
    const content = [...gists, ...shoutouts]
      .filter(story => {
        const author = story.authorUid || story.submittedByUid || "";
        return !author || !blocked.has(author);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    const ads = loadAdStories();
    stories = interleaveAds(content, ads);
    rings = buildRings(stories);
    renderRing();
    const adCount = stories.filter((s) => s.type === "ad").length;
    setStatus(`${content.length} story${content.length === 1 ? "" : "ies"} · ${adCount} sponsored`);
    if (!currentUser) {
      byId("minglGistLogin")?.classList.remove("hidden");
      if (!content.length) setStatus("Sign in to load ShoutOut stories. Public Mingl Gists still appear when available.");
    } else {
      byId("minglGistLogin")?.classList.add("hidden");
    }
  }

  function bindAuth() {
    byId("minglGistGoogleLoginBtn")?.addEventListener("click", () => {
      auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch((error) => setStatus(error.message));
    });
    byId("minglGistMicrosoftLoginBtn")?.addEventListener("click", () => {
      const provider = new firebase.auth.OAuthProvider("microsoft.com");
      auth.signInWithPopup(provider).catch((error) => {
        auth.signInWithRedirect(provider).catch((redirectError) => setStatus(redirectError.message || error.message));
      });
    });
  }

  function bindViewer() {
    byId("minglGistCloseBtn")?.addEventListener("click", closeViewer);
    byId("minglGistPrevZone")?.addEventListener("click", () => {
      if (activeIndex <= 0) closeViewer();
      else showStory(activeIndex - 1);
    });
    byId("minglGistNextZone")?.addEventListener("click", () => {
      if (activeIndex >= stories.length - 1) closeViewer();
      else showStory(activeIndex + 1);
    });
    document.addEventListener("keydown", (event) => {
      const viewer = byId("minglGistViewer");
      if (!viewer || viewer.classList.contains("hidden")) return;
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowRight") {
        if (activeIndex >= stories.length - 1) closeViewer();
        else showStory(activeIndex + 1);
      }
      if (event.key === "ArrowLeft") {
        if (activeIndex <= 0) closeViewer();
        else showStory(activeIndex - 1);
      }
    });
  }

  function init() {
    bindAuth();
    bindViewer();
    auth.onAuthStateChanged(async (user) => {
      currentUser = user;
      await refreshFeed();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
