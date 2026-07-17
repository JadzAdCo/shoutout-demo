/* FLOQR patron-facing Club Public Profile v29.07 */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const params = new URL(window.location.href).searchParams;
  const requestedLocationId = String(params.get("location") || params.get("club") || "zebbies-garden-washington-dc").toLowerCase();
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth(app);
  const db = firebase.firestore(app);
  let locationId = requestedLocationId;
  let club = {};
  let currentUser = null;

  function safeExternal(value = "") {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
    } catch (e) { return ""; }
  }

  function appReturnPath() {
    return `${window.location.pathname.split("/").pop() || "club-profile.html"}${window.location.search}${window.location.hash}`;
  }

  function redirectForAccess(reason) {
    const query = new URLSearchParams({v:"29.07", returnTo:appReturnPath(), profileRequired:reason});
    window.location.replace(`./?${query.toString()}`);
  }

  function sectionEnabled(key, fallback = true) {
    const settings = club.publicProfileSections || {};
    return settings[key] === undefined ? fallback : settings[key] !== false;
  }

  function toggleSection(id, visible) {
    byId(id)?.classList.toggle("hidden", !visible);
  }

  function staticLocation(id) {
    return (window.SHOUTOUT_CLUB_LOCATIONS || {})[id] || {};
  }

  async function resolveLocation(id) {
    let key = id;
    try {
      const alias = await db.collection("clubLocationAliases").doc(key).get();
      if (alias.exists && alias.data()?.canonicalLocationId) key = String(alias.data().canonicalLocationId).toLowerCase();
    } catch (e) {}
    try {
      const snap = await db.collection("clubLocations").doc(key).get();
      if (snap.exists) {
        const data = snap.data() || {};
        const canonical = String(data.canonicalLocationId || data.aliasOf || data.mergedInto || key).toLowerCase();
        if (canonical !== key) return resolveLocation(canonical);
        return {id:snap.id, ...staticLocation(key), ...data};
      }
    } catch (e) {}
    return {id:key, ...staticLocation(key)};
  }

  function eventTime(event = {}) {
    const value = event.eventDate || event.date || event.startDate || event.startsAt;
    if (value?.toDate) return value.toDate().getTime();
    if (value?.seconds) return value.seconds * 1000;
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function loadEvents() {
    const rows = new Map();
    Object.entries(window.SHOUTOUT_EVENTS || {}).forEach(([id, event]) => {
      if ([event.locationId, event.clubLocationId].filter(Boolean).map(String).map(value => value.toLowerCase()).includes(locationId)) rows.set(id, {id, ...event});
    });
    for (const field of ["locationId", "clubLocationId"]) {
      try {
        const snap = await db.collection("events").where(field, "==", locationId).limit(80).get();
        snap.docs.forEach(doc => rows.set(doc.id, {id:doc.id, ...doc.data()}));
      } catch (e) {}
    }
    return Array.from(rows.values()).filter(event => String(event.status || "active").toLowerCase() !== "deleted");
  }

  async function loadMedia() {
    try {
      const snap = await db.collection("clubMedia").where("clubLocationId", "==", locationId).limit(30).get();
      return snap.docs.map(doc => ({id:doc.id, ...doc.data()}));
    } catch (e) { return []; }
  }

  function safeMediaFilter(value) {
    const key = String(value || "none").toLowerCase();
    return ["none", "vibrant", "warm", "cool", "monochrome", "contrast"].includes(key) ? key : "none";
  }

  function mediaMarkup(url, type, alt, options = {}) {
    if (!url) return "";
    const filterClass = `club-media-filter-${safeMediaFilter(options.mediaFilter)}`;
    if (String(type).toLowerCase() === "video") return `<video class="${filterClass}" src="${esc(url)}" autoplay muted loop playsinline aria-label="${esc(alt)}" data-club-trim-start="${esc(options.trimStart ?? 0)}" data-club-trim-end="${esc(options.trimEnd ?? 15)}"></video>`;
    return `<img class="${filterClass}" src="${esc(url)}" alt="${esc(alt)}"/>`;
  }

  function enforceClubVideoTrims(root = document) {
    root.querySelectorAll("video[data-club-trim-end]").forEach(video => {
      const start = Math.max(0, Number(video.dataset.clubTrimStart || 0));
      const end = Math.min(start + 15, Math.max(start + .1, Number(video.dataset.clubTrimEnd || start + 15)));
      const restart = () => {
        try { video.currentTime = Math.min(start, Math.max(0, (video.duration || start + .1) - .05)); } catch (error) {}
        video.play?.().catch(() => {});
      };
      video.addEventListener("loadedmetadata", restart);
      video.addEventListener("timeupdate", () => { if (video.currentTime >= end) restart(); });
      video.addEventListener("ended", restart);
    });
  }

  function renderHero(media = []) {
    const name = club.locationName || club.brandName || "FLOQR Venue";
    const main = media.find(item => item.slotType === "main") || {};
    const mainUrl = main.mediaUrl || club.mainMediaUrl || club.mainImageUrl || "";
    const mainType = main.mediaType || club.mainMediaType || "image";
    const mainOptions = main.mediaUrl ? main : {mediaFilter:club.mainMediaFilter, trimStart:club.mainMediaTrimStart, trimEnd:club.mainMediaTrimEnd};
    byId("clubProfileHeroMedia").innerHTML = mainUrl ? mediaMarkup(mainUrl, mainType, `${name} main venue media`, mainOptions) : '<div class="club-profile-hero-fallback"></div>';
    enforceClubVideoTrims(byId("clubProfileHeroMedia"));
    const logoUrl = club.logoUrl || club.clubLogoUrl || club.brandLogoUrl || "";
    byId("clubProfileLogo").innerHTML = logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(name)} logo"/>` : `<span>${esc(name.slice(0,1).toUpperCase())}</span>`;
    byId("clubProfileName").textContent = name;
    byId("clubProfileType").textContent = club.venueType || club.type || "FLOQR Venue";
    byId("clubProfileTagline").textContent = club.tagline || club.publicTagline || "";
    byId("clubProfileLocation").textContent = window.FLOQRAddress?.publicLocation(club) || club.locationLabel || [club.city, club.country].filter(Boolean).join(", ");
    byId("clubProfileGenres").innerHTML = (club.genres || []).slice(0,8).map(value => `<span>${esc(value)}</span>`).join("");
    document.title = `${name} | FLOQR`;
  }

  function renderActions() {
    byId("clubShoutoutLink").href = `./?location=${encodeURIComponent(locationId)}&v=29.07`;
    byId("clubGuestListLink").href = `./guest-list.html?location=${encodeURIComponent(locationId)}&v=29.07`;
    const address = window.FLOQRAddress?.fullAddress(club) || club.fullAddress || club.address || [club.city, club.region, club.country].filter(Boolean).join(", ");
    byId("clubDirectionsLink").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    byId("clubPickupLink").href = `./pickup.html?location=${encodeURIComponent(locationId)}&v=29.07`;
    if (club.commerceEnabled) {
      byId("clubCommerceLink").href = `./commerce.html?club=${encodeURIComponent(locationId)}&v=29.07`;
      byId("clubCommerceLink").classList.remove("hidden");
    } else byId("clubCommerceLink").classList.add("hidden");
    const website = safeExternal(club.officialWebsite || club.website);
    if (website) {
      byId("clubWebsiteLink").href = website;
      byId("clubWebsiteLink").classList.remove("hidden");
    }
  }

  function fact(label, value) {
    return value ? `<div><span>${esc(label)}</span><strong>${esc(Array.isArray(value) ? value.join(", ") : value)}</strong></div>` : "";
  }

  function renderAbout() {
    byId("clubProfileDescription").textContent = club.description || club.publicDescription || club.about || "Discover this venue through FLOQR.";
    byId("clubProfileQuickFacts").innerHTML = [
      fact("Hours", club.hours || club.operatingHours),
      fact("Age policy", club.agePolicy),
      fact("Dress code", club.dressCode),
      fact("Amenities", club.amenities),
      fact("FLOQR services", club.publicServices || club.services)
    ].join("");
    toggleSection("clubAboutSection", sectionEnabled("about"));
  }

  function eventCard(event, past = false) {
    const name = event.eventName || event.title || "Club Event";
    const date = event.eventDate || event.date || event.startDate || "Date announced soon";
    const talent = event.artists || event.featuredDjs || event.djs || [];
    const link = safeExternal(event.ticketUrl || event.officialUrl || event.sourceUrl);
    return `<article class="club-event-card ${past ? "past" : ""}">
      ${event.imageUrl ? `<img src="${esc(event.imageUrl)}" alt="${esc(name)}"/>` : ""}
      <div><small>${esc(date)}${event.eventTime ? ` · ${esc(event.eventTime)}` : ""}</small><h3>${esc(name)}</h3>
      ${talent.length ? `<p>${esc(talent.slice(0,4).join(" · "))}</p>` : ""}
      ${link && !past ? `<a class="buttonlike" target="_blank" rel="noopener" href="${esc(link)}">Tickets / Details</a>` : ""}</div>
    </article>`;
  }

  function renderEvents(events) {
    const now = Date.now() - 12 * 60 * 60 * 1000;
    const upcoming = events.filter(event => !eventTime(event) || eventTime(event) >= now).sort((a,b) => eventTime(a) - eventTime(b));
    const past = events.filter(event => eventTime(event) && eventTime(event) < now).sort((a,b) => eventTime(b) - eventTime(a));
    byId("clubUpcomingEvents").innerHTML = upcoming.length ? upcoming.slice(0,12).map(event => eventCard(event)).join("") : '<p class="sub">No upcoming events have been published yet.</p>';
    byId("clubPastEvents").innerHTML = past.length ? past.slice(0,12).map(event => eventCard(event, true)).join("") : '<p class="sub">No past events are published.</p>';
    toggleSection("clubEventsSection", sectionEnabled("upcomingEvents"));
    toggleSection("clubPastEventsSection", sectionEnabled("pastEvents"));
  }

  function personArray(value, fallbackRole) {
    if (!Array.isArray(value)) return [];
    return value.map(item => typeof item === "string" ? {name:item, role:fallbackRole} : item).filter(item => item?.name || item?.displayName);
  }

  function openPerson(person = {}) {
    const name = person.name || person.displayName || "FLOQR Member";
    byId("clubPersonName").textContent = name;
    byId("clubPersonRole").textContent = person.role || person.title || "Featured at this venue";
    byId("clubPersonBio").textContent = person.bio || person.description || "Featured by this club on FLOQR.";
    byId("clubPersonPhoto").innerHTML = person.photoUrl || person.imageUrl ? `<img src="${esc(person.photoUrl || person.imageUrl)}" alt="${esc(name)}"/>` : `<span>${esc(name.slice(0,1).toUpperCase())}</span>`;
    const instagram = String(person.instagram || person.instagramHandle || "").replace(/^@/, "");
    const profileUrl = safeExternal(person.profileUrl);
    byId("clubPersonLinks").innerHTML = [
      instagram ? `<a class="buttonlike" target="_blank" rel="noopener" href="https://instagram.com/${esc(instagram)}">Instagram</a>` : "",
      profileUrl ? `<a class="buttonlike" target="_blank" rel="noopener" href="${esc(profileUrl)}">Profile</a>` : ""
    ].join("");
    byId("clubProfilePersonModal").classList.remove("hidden");
  }

  function personCard(person) {
    const name = person.name || person.displayName || "Featured Member";
    return `<button class="club-person-card" type="button" data-person="${esc(encodeURIComponent(JSON.stringify(person)))}">
      <span class="club-person-card-photo">${person.photoUrl || person.imageUrl ? `<img src="${esc(person.photoUrl || person.imageUrl)}" alt=""/>` : esc(name.slice(0,1).toUpperCase())}</span>
      <strong>${esc(name)}</strong><small>${esc(person.role || person.title || "Featured")}</small>
    </button>`;
  }

  function renderPeople() {
    const djs = personArray(club.featuredDjs, "DJ");
    const staff = personArray(club.featuredStaff || club.featuredServiceStaff, "Service Team");
    byId("clubFeaturedDjs").innerHTML = djs.length ? djs.map(personCard).join("") : '<p class="sub">Featured DJs will appear here when the venue publishes them.</p>';
    byId("clubFeaturedStaff").innerHTML = staff.length ? staff.map(personCard).join("") : '<p class="sub">Featured service staff will appear here when the venue publishes them.</p>';
    document.querySelectorAll("[data-person]").forEach(button => button.addEventListener("click", () => {
      try { openPerson(JSON.parse(decodeURIComponent(button.dataset.person || ""))); } catch (e) {}
    }));
    toggleSection("clubTalentSection", sectionEnabled("featuredDjs") && (djs.length || sectionEnabled("showEmptySections", false)));
    toggleSection("clubStaffSection", sectionEnabled("featuredStaff") && (staff.length || sectionEnabled("showEmptySections", false)));
  }

  function renderPromoters() {
    const groups = personArray(club.promotionGroups || club.featuredPromotionGroups, "Promotion Group");
    byId("clubPromotionGroups").innerHTML = groups.length ? groups.map(group => `<button class="club-promoter-card" type="button" data-promoter="${esc(encodeURIComponent(JSON.stringify(group)))}"><strong>${esc(group.name || group.displayName)}</strong><small>${esc(group.bio || group.description || "Promotion group")}</small></button>`).join("") : '<p class="sub">Promotion groups will appear here when the venue publishes them.</p>';
    document.querySelectorAll("[data-promoter]").forEach(button => button.addEventListener("click", () => {
      try { openPerson(JSON.parse(decodeURIComponent(button.dataset.promoter || ""))); } catch (e) {}
    }));
    toggleSection("clubPromotersSection", sectionEnabled("promotionGroups") && (groups.length || sectionEnabled("showEmptySections", false)));
  }

  function renderGallery(media) {
    const gallery = media.filter(item => item.slotType === "gallery").sort((a,b) => Number(a.galleryOrder ?? 0) - Number(b.galleryOrder ?? 0)).slice(0,10);
    byId("clubProfileGallery").innerHTML = gallery.length ? gallery.map(item => `<figure>${mediaMarkup(item.mediaUrl, item.mediaType, item.title || "Club gallery media", item)}${item.title ? `<figcaption>${esc(item.title)}</figcaption>` : ""}</figure>`).join("") : '<p class="sub">No public gallery media has been published.</p>';
    enforceClubVideoTrims(byId("clubProfileGallery"));
    toggleSection("clubGallerySection", sectionEnabled("gallery") && gallery.length);
  }

  function renderContact() {
    const socials = club.socialMediaHandles || club.socialHandles || {};
    const floqrHandle = window.FLOQRIdentity?.normalizeFloqrHandle?.(socials.floqrHandle || club.floqrHandle || "") || "";
    const floqrLink = floqrHandle ? `<span class="buttonlike">${esc(floqrHandle)}</span>` : "";
    const socialLink = (label, value, base) => {
      if (!value) return "";
      const clean = String(value).replace(/^@/, "");
      const url = /^https?:\/\//i.test(String(value)) ? safeExternal(value) : `${base}${encodeURIComponent(clean)}`;
      return `<a class="buttonlike" target="_blank" rel="noopener" href="${esc(url)}">${esc(label)}</a>`;
    };
    const phone = club.telephone || club.phone || "";
    const email = club.email || "";
    byId("clubProfileContact").innerHTML = `
      ${(window.FLOQRAddress?.fullAddress(club) || club.address) ? `<p><strong>Address</strong><span>${esc(window.FLOQRAddress?.fullAddress(club) || club.address)}</span></p>` : ""}
      ${phone ? `<p><strong>Telephone</strong><a href="tel:${esc(phone)}">${esc(phone)}</a></p>` : ""}
      ${email ? `<p><strong>Email</strong><a href="mailto:${esc(email)}">${esc(email)}</a></p>` : ""}
      <div class="button-row">${floqrLink}${socialLink("Instagram", socials.instagram, "https://instagram.com/")}${socialLink("TikTok", socials.tiktok, "https://tiktok.com/@")}${socialLink("Facebook", socials.facebook, "https://facebook.com/")}${socialLink("X", socials.x || socials.twitter, "https://x.com/")}</div>`;
    toggleSection("clubContactSection", sectionEnabled("contact"));
  }

  function closePerson() { byId("clubProfilePersonModal")?.classList.add("hidden"); }

  function clubFollowId(uid = "") { return `${locationId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_"); }

  async function refreshClubFollow() {
    if (!currentUser || !byId("clubFollowBtn")) return;
    const snap = await db.collection("entityFollows").doc(clubFollowId(currentUser.uid)).get().catch(() => null);
    byId("clubFollowBtn").textContent = snap?.exists && snap.data()?.active !== false ? "Following Club" : "Follow Club";
  }

  async function toggleClubFollow() {
    if (!currentUser) return;
    const ref = db.collection("entityFollows").doc(clubFollowId(currentUser.uid));
    const snap = await ref.get();
    const active = !(snap.exists && snap.data()?.active !== false);
    const payload = {entityId:locationId, entityType:"club", entityName:club.locationName || club.brandName || locationId, followerUid:currentUser.uid, followerEmail:currentUser.email || "", active, updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if (!snap.exists) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set(payload, {merge:true});
    await refreshClubFollow();
  }

  async function loadClubProfile() {
    club = await resolveLocation(locationId);
    locationId = club.id || locationId;
    if (!club.locationName && !club.brandName) throw new Error("This club profile was not found.");
    if (club.publicProfilePublished === false || String(club.visibility || "public").toLowerCase() !== "public") throw new Error("This club profile is not currently published.");
    const [events, media] = await Promise.all([loadEvents(), loadMedia()]);
    renderHero(media);
    renderActions();
    renderAbout();
    renderEvents(events);
    renderPeople();
    renderPromoters();
    renderGallery(media);
    renderContact();
    byId("clubProfileLoading").classList.add("hidden");
    byId("clubProfileContent").classList.remove("hidden");
  }

  byId("clubProfileShareBtn")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(window.location.href);
    window.FLOQRActionFeedback?.show("Club link copied", "Share this FLOQR club profile with another patron.", {status:"success"});
    window.FLOQRActionFeedback?.hide(2200);
  });
  byId("clubFollowBtn")?.addEventListener("click", toggleClubFollow);
  byId("clubPersonCloseBtn")?.addEventListener("click", closePerson);
  byId("clubPersonCloseWindowBtn")?.addEventListener("click", closePerson);
  byId("clubProfilePersonModal")?.addEventListener("click", event => { if (event.target === byId("clubProfilePersonModal")) closePerson(); });

  auth.onAuthStateChanged(async user => {
    if (!user) { redirectForAccess("sign-in"); return; }
    currentUser = user;
    try {
      const profileSnap = await db.collection("users").doc(user.uid).get();
      if (!profileSnap.exists || profileSnap.data()?.profileCompleted !== true) { redirectForAccess("create-profile"); return; }
      await loadClubProfile();
      await refreshClubFollow();
    } catch (error) {
      byId("clubProfileLoading").innerHTML = `<h1>Club profile unavailable</h1><p class="sub">${esc(error?.message || error)}</p><p><a class="buttonlike" href="./?v=29.07">Return to FLOQR</a></p>`;
    }
  });
})();
