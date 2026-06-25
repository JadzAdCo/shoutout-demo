/* patron-app.js v28.4 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const setStatus = value => {
    const el = byId("authStatus");
    if (!el) return;
    el.textContent = value || "";
    el.classList.toggle("hidden", !value);
  };
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const unique = items => [...new Set(items.filter(Boolean))].sort();

  if (!window.firebaseConfig) { setStatus("firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage ? firebase.storage() : null;

  let currentUser = null;
  let selectedLocationId = null;
  let selectedTemplate = "blackwhite";
  let confirmationResult = null;
  let locations = {};
  let templates = {};
  let events = {};
  let pendingDirectLocation = qs("location", qs("club", ""));
  let cachedUserProfile = null;
  let minglCandidates = [];
  let minglConnections = [];
  let activeMinglRoomId = "";

  function locationId() { return (selectedLocationId || pendingDirectLocation || "zebbies-garden-washington-dc").toLowerCase(); }
  function getLocation(id = locationId()) { return locations[id] || window.SHOUTOUT_CLUB_LOCATIONS[id] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"]; }
  function getTemplate(id = selectedTemplate) { return templates[id] || window.SHOUTOUT_TEMPLATES[id] || window.SHOUTOUT_TEMPLATES.neon; }
  function currentTemplateSupportsMedia() {
    const t = getTemplate();
    return !!(t.supportsMedia || t.supportsImage || t.supportsVideo);
  }
  function currentTemplateAccepts() {
    const t = getTemplate();
    if (t.supportsVideo || t.supportsMedia) return "image/*,video/mp4,video/quicktime,video/webm";
    if (t.supportsImage) return "image/*";
    return "";
  }
  function safeUser() { return (currentUser?.email || currentUser?.phoneNumber || "unknown").toLowerCase(); }
  function detectRenderContext() {
    const ua = navigator.userAgent || "";
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const isTouch = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
    const isTablet = /iPad|Tablet/i.test(ua) || (isTouch && width >= 700 && width <= 1180);
    const isMobile = !isTablet && (/Mobi|Android|iPhone|iPod/i.test(ua) || width <= 640);
    const os = /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Windows/i.test(ua) ? "windows" : /Mac OS X/i.test(ua) ? "mac" : "other";
    document.documentElement.lang = (navigator.language || "en").slice(0, 12);
    document.body.dataset.device = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";
    document.body.dataset.os = os;
    document.body.dataset.touch = isTouch ? "true" : "false";
    document.body.dataset.lang = navigator.language || "en";
    document.body.classList.toggle("device-mobile", isMobile);
    document.body.classList.toggle("device-tablet", isTablet);
    document.body.classList.toggle("device-desktop", !isMobile && !isTablet);
  }
  function showPage(id) {
    if (!id || !byId(id)) return;
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    byId(id)?.classList.add("active");
  }
  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  function getInitials(user) {
    const name = user?.displayName || user?.email || user?.phoneNumber || "Guest";
    return name.split(/[ @._-]+/).filter(Boolean).slice(0,2).map(x => x[0].toUpperCase()).join("") || "?";
  }

  function updateUserMenu(user) {
    const photoURL = user?.photoURL || "";
    const displayName = user?.displayName || user?.email || user?.phoneNumber || "Please Sign-In or Sign-Up:";
    const email = user?.email || user?.phoneNumber || "Guest";
    const userPhoto = byId("userPhoto");
    const dropdownPhoto = byId("dropdownUserPhoto");
    const initials = byId("userInitials");

    if (userPhoto) {
      userPhoto.src = photoURL || "";
      userPhoto.classList.toggle("hidden", !photoURL);
    }
    if (dropdownPhoto) {
      dropdownPhoto.src = photoURL || "";
      dropdownPhoto.classList.toggle("hidden", !photoURL);
    }
    if (initials) {
      initials.textContent = user ? getInitials(user) : "?";
      initials.classList.toggle("hidden", !!photoURL);
    }
    setText("dropdownUserName", displayName);
    setText("dropdownUserEmail", email);
  }

  function toggleUserDropdown(event) {
    if (event) event.stopPropagation();
    byId("userDropdown")?.classList.toggle("hidden");
  }

  function closeUserDropdownOnOutsideClick(event) {
    const menu = byId("userMenu");
    if (menu && !menu.contains(event.target)) byId("userDropdown")?.classList.add("hidden");
  }

  const AD_CONTENT = {
    "lounge-club": { title: "Gran Coramino Tequila", body: "A smooth premium tequila experience associated with Kevin Hart. Perfect for a Lounge-Club moment.", badge: "Sponsored Lounge-Club Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2362eaff%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EGRAN%20CORAMINO%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3ETEQUILA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "clubs": { title: "Gucci Fragrances", body: "Luxury fragrance energy for a night out. Own the room before the first song drops.", badge: "Sponsored Club Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ffd45a%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23ff64d8%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ffd45a%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EGUCCI%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EFRAGRANCES%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "events": { title: "Nike Air Max", body: "Step into the night with Nike energy. Built for movement, style, and the next event.", badge: "Sponsored Event Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%2362eaff%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3ENIKE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EAIR%20MAX%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "lounges": { title: "Teremana Tequila", body: "Dwayne Johnson's tequila brand brings a premium toast to the lounge experience.", badge: "Sponsored Lounge Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23dfff5a%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2362eaff%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3ETEREMANA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3ETEQUILA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "beach-clubs": { title: "Advertise Here", body: "Beach club audiences are premium, social, and ready to discover your brand.", badge: "Beach Club Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "shoutout": { title: "Advertise Here", body: "Put your brand in front of patrons right before they create a live LED ShoutOut.", badge: "ShoutOut Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "default": { title: "Advertise Here", body: "Your brand can own this moment before patrons browse nightlife.", badge: "FLOQR Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" }
  };

  let pendingCategoryAfterAd = null;
  let adTimer = null;

  function showAdSplash(type, nextFn) {
    pendingCategoryAfterAd = nextFn;
    const ad = AD_CONTENT[type] || AD_CONTENT.default;
    setText("adTitle", ad.title);
    setText("adBody", ad.body);
    setText("adBadge", ad.badge);
    const adImageSlot = byId("adImageSlot");
    if (adImageSlot) {
      adImageSlot.innerHTML = `<img src="${ad.image || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E'}" alt="${ad.title} advertisement">`;
    }
    let remaining = 10;
    setText("adCountdown", String(remaining));
    showPage("adSplashPage");
    clearInterval(adTimer);
    adTimer = setInterval(() => {
      remaining -= 1;
      setText("adCountdown", String(Math.max(remaining, 0)));
      if (remaining <= 0) {
        clearInterval(adTimer);
        const fn = pendingCategoryAfterAd;
        pendingCategoryAfterAd = null;
        if (typeof fn === "function") fn();
      }
    }, 1000);
  }

  function skipAdSplash() {
    clearInterval(adTimer);
    const fn = pendingCategoryAfterAd;
    pendingCategoryAfterAd = null;
    if (typeof fn === "function") fn();
  }

  function cancelAdSplash() {
    clearInterval(adTimer);
    pendingCategoryAfterAd = null;
    showPage("categoryPage");
  }


  async function loadTemplates() {
    templates = {...window.SHOUTOUT_TEMPLATES};
    try { const snap = await db.collection("templates").get(); snap.forEach(doc => templates[doc.id] = {id:doc.id, ...doc.data()}); } catch(e) {}
  }
  async function loadLocations() {
    locations = {};
    try { const snap = await db.collection("clubLocations").where("active","==",true).orderBy("locationName","asc").get(); snap.forEach(doc => locations[doc.id] = {id:doc.id, ...doc.data()}); } catch(e) {}
    if (Object.keys(locations).length === 0) locations = {...window.SHOUTOUT_CLUB_LOCATIONS};
  }
  async function loadEvents() {
    events = {...(window.SHOUTOUT_EVENTS || {})};
    try { const snap = await db.collection("events").where("active","==",true).get(); snap.forEach(doc => events[doc.id] = {id:doc.id, ...doc.data()}); } catch(e) {}
  }
  async function loadLocationById(id) {
    if (locations[id]) return locations[id];
    try { const doc = await db.collection("clubLocations").doc(id).get(); if (doc.exists) { locations[id] = {id:doc.id, ...doc.data()}; return locations[id]; }} catch(e) {}
    return window.SHOUTOUT_CLUB_LOCATIONS[id] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"];
  }

  function updateLoginUI(user) {
    setText("signedInAs", user ? "" : "Please Sign-In or Sign-Up:");
    byId("signedInActions")?.classList.toggle("hidden", !user);
    byId("loginActions")?.classList.toggle("hidden", !!user);
    updateUserMenu(user);
  }

  
  async function getUserProfile() {
    if (!currentUser) return null;
    try {
      const doc = await db.collection("users").doc(currentUser.uid).get();
      cachedUserProfile = doc.exists ? doc.data() : null;
      return cachedUserProfile;
    } catch (e) {
      console.warn("Could not read user profile:", e.message);
      return null;
    }
  }

  function prefillSignupProfile() {
    if (!currentUser) return;
    const displayName = currentUser.displayName || "";
    const emailName = (currentUser.email || "").split("@")[0] || "";
    const cleanName = (displayName || emailName || "patron").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24);

    if (byId("profileUsername") && !byId("profileUsername").value) byId("profileUsername").value = cleanName;
    if (byId("profileDisplayName") && !byId("profileDisplayName").value) byId("profileDisplayName").value = displayName;
  }

  function cleanHandle(value) {
    const raw = String(value || "").trim().replace(/^@+/, "");
    return raw ? `@${raw.replace(/[^a-zA-Z0-9._]/g, "").slice(0, 30)}` : "";
  }

  function currentAttributionValue() {
    if (!byId("includeAttribution")?.checked) return "";
    const profile = cachedUserProfile || {};
    const choice = byId("attributionChoice")?.value || "displayName";
    const emailName = (currentUser?.email || "").split("@")[0] || "";
    const username = profile.username || emailName || currentUser?.displayName || "patron";
    if (choice === "instagram") return cleanHandle(profile.instagramHandle || byId("profileInstagram")?.value || username);
    if (choice === "username") return cleanHandle(username);
    return String(profile.displayName || currentUser?.displayName || username).trim().slice(0, 30);
  }

  function syncAttribution() {
    const enabled = !!byId("includeAttribution")?.checked;
    byId("attributionChoiceWrap")?.classList.toggle("hidden", !enabled);
    if (byId("subText")) byId("subText").value = currentAttributionValue();
    updatePreview();
  }

  function showSignupProfile() {
    prefillSignupProfile();
    showPage("signupProfilePage");
  }

  function splitCSV(value) {
    return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  }

  async function saveProfile() {
    const status = byId("profileStatus");
    try {
      if (!currentUser) {
        status.textContent = "Please sign in first.";
        return;
      }

      const username = byId("profileUsername").value.trim();
      if (!username) {
        status.textContent = "Please choose a username.";
        return;
      }

      const profile = {
        uid: currentUser.uid,
        username,
        displayName: byId("profileDisplayName").value.trim() || currentUser.displayName || "",
        email: currentUser.email || "",
        phoneNumber: currentUser.phoneNumber || "",
        photoURL: currentUser.photoURL || "",
        providerIds: (currentUser.providerData || []).map(p => p.providerId),
        country: byId("profileCountry").value.trim(),
        region: byId("profileRegion").value.trim(),
        city: byId("profileCity").value.trim(),
        ageRange: byId("profileAgeRange").value,
        gender: byId("profileGender")?.value || "",
        favoriteGenres: splitCSV(byId("profileGenres").value),
        nightlifeInterests: splitCSV(byId("profileInterests").value),
        musicInterests: splitCSV(byId("profileGenres").value),
        foodChoices: splitCSV(byId("profileFoodChoices")?.value || "Sushi, Tapas, Steakhouse"),
        favoriteBeverages: splitCSV(byId("profileBeverageChoices")?.value || "Champagne, Tequila, Mocktails"),
        instagramHandle: byId("profileInstagram").value.trim(),
        xHandle: byId("profileX").value.trim(),
        analyticsConsent: byId("profileAnalyticsConsent").checked,
        marketingConsent: byId("profileMarketingConsent").checked,
        referredByPromoterId: new URL(window.location.href).searchParams.get("promoter") || "",
        profileCompleted: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("users").doc(currentUser.uid).set({
        ...profile,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      status.textContent = "Profile saved.";
      await continueToMainCategories();
    } catch (e) {
      console.error(e);
      status.textContent = e.message;
    }
  }

  async function continueToMainCategories() {
    showPage("categoryPage");
    if (pendingDirectLocation) {
      openCategory("shoutout");
      setTimeout(() => selectLocationForShoutOut(pendingDirectLocation), 400);
    }
  }


  async function afterLogin() {
    await loadTemplates();
    await loadLocations();
    await loadEvents();

    const profile = await getUserProfile();
    if (!profile || !profile.profileCompleted) {
      showSignupProfile();
      return;
    }

    await continueToMainCategories();
  }

  async function signInProvider(provider, label) {
    try {
      setStatus(`Opening ${label} sign-in...`);
      await auth.signInWithPopup(provider);
    } catch(e) {
      const code = e?.code || "";
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        setStatus(`${label} popup was blocked. Redirecting instead...`);
        await auth.signInWithRedirect(provider);
        return;
      }
      setStatus(`${e.code || "error"}: ${e.message}`);
    }
  }
  async function loginGoogle() { await signInProvider(new firebase.auth.GoogleAuthProvider(), "Google"); }
  async function loginFacebook() { await signInProvider(new firebase.auth.FacebookAuthProvider(), "Facebook"); }
  function microsoftAuthErrorMessage(e) {
    const code = e?.code || "error";
    const message = e?.message || String(e || "Unknown error");
    if (code === "auth/popup-closed-by-user") return "Microsoft sign-in popup closed before completion. Try again, or allow popups for this site.";
    if (code === "auth/popup-blocked") return "Your browser blocked Microsoft sign-in. Allow popups for jadzadco.github.io and try again.";
    if (code === "auth/operation-not-allowed") return "Microsoft sign-in is not enabled in Firebase Authentication.";
    if (code === "auth/unauthorized-domain") return "This site is not authorized in Firebase Authentication. Add jadzadco.github.io under Authentication > Settings > Authorized domains.";
    if (code === "auth/account-exists-with-different-credential") return "This email already exists with another sign-in method. Sign in with the original provider first.";
    if (code === "auth/invalid-credential" || code === "auth/invalid-oauth-client-id") return "Microsoft OAuth configuration appears invalid. Verify Microsoft Client ID, Client Secret, and Firebase redirect URI.";
    return `${code}: ${message}`;
  }
  function buildMicrosoftProvider() {
    const p = new firebase.auth.OAuthProvider("microsoft.com");
    p.setCustomParameters({prompt:"select_account"});
    return p;
  }
  function isMicrosoftPopupIssue(e) {
    const code = e?.code || "";
    return code === "auth/popup-blocked" || code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
  }
  async function loginMicrosoft() {
    const p = buildMicrosoftProvider();
    try {
      setStatus("Opening Microsoft sign-in...");
      await auth.signInWithPopup(p);
    } catch(e) {
      if (isMicrosoftPopupIssue(e)) {
        try {
          setStatus("Microsoft popup was blocked or closed. Redirecting instead...");
          await auth.signInWithRedirect(p);
          return;
        } catch(redirectError) {
          setStatus(microsoftAuthErrorMessage(redirectError));
          return;
        }
      }
      setStatus(microsoftAuthErrorMessage(e));
    }
  }
  async function logout() { await auth.signOut(); window.location.href = "./"; }
  window.jadzPatronLogout = logout;

  function showSmsOtpPanel() {
    byId("smsOtpPanel")?.classList.remove("hidden");
    setupPhoneAuth();
    setStatus("Enter your phone number, then send the SMS OTP.");
  }
  function setupPhoneAuth() { if (!byId("recaptcha-container") || window.recaptchaVerifier) return; window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {size:"normal"}); }
  function buildSmsPhoneNumber() {
    const countryCode = byId("phoneCountryCode")?.value || "";
    const local = (byId("phoneNationalNumber")?.value || byId("phoneNumber")?.value || "").replace(/[^\d]/g, "");
    const phone = `${countryCode}${local}`;
    if (byId("phoneNumber")) byId("phoneNumber").value = phone;
    return phone;
  }
  async function sendPhoneCode() {
    try {
      setupPhoneAuth();
      const phone = buildSmsPhoneNumber();
      if (!phone.startsWith("+")) { setStatus("Use international format, for example +12025550123."); return; }
      if (phone.replace(/[^\d]/g, "").length < 8) { setStatus("Enter a valid phone number."); return; }
      confirmationResult = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
      byId("phoneCodeBlock")?.classList.remove("hidden");
      setStatus("Code sent. Enter it below.");
    } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); }
  }
  async function verifyPhoneCode() { try { if (!confirmationResult) { setStatus("Send the OTP first."); return; } await confirmationResult.confirm(byId("phoneCode").value.trim()); } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); } }


  function openGuestListForSelectedLocation() {
    const id =
      selectedLocation?.id ||
      selectedClub?.id ||
      selectedClub?.locationId ||
      selectedClub?.clubLocationId ||
      new URL(window.location.href).searchParams.get("location") ||
      "";

    const url = new URL("./guest-list.html", window.location.href);
    if (id) url.searchParams.set("location", id);

    const promoter = new URL(window.location.href).searchParams.get("promoter");
    if (promoter) url.searchParams.set("promoter", promoter);

    window.location.href = url.toString();
  }


  function openCategory(type) {
    showAdSplash(type, () => openCategoryAfterAd(type));
  }

  function openCategoryAfterAd(type) {
    if (type === "clubs" || type === "lounges" || type === "lounge-club" || type === "beach-clubs") {
      byId("clubActionsPage")?.setAttribute("data-category-type", type);
      showPage("clubActionsPage");
      return;
    }

    byId("listingType").value = type;
    byId("listingTitle").textContent =
      type === "events" ? "Search Events" :
      type === "shoutout" ? "Choose Location for ShoutOut" :
      type.startsWith("club-action:") ? type.replace("club-action:","").replaceAll("-"," ").replace(/\b\w/g, c => c.toUpperCase()) :
      "Search";
    byId("listingIntro").textContent =
      type === "shoutout" ? "Pick the exact location where your ShoutOut should appear." :
      type.startsWith("club-action:") ? "Select the exact venue/location for this action. Payment and booking integration will be connected later." :
      "Search naturally by city, country, venue, genre, artist, event day, or activity time.";
    showListing();
  }

  function populateFilters() {
    const country = byId("countryFilter"), region = byId("regionFilter"), city = byId("cityFilter"), genre = byId("genreFilter");
    if (!country) return;
    country.innerHTML = '<option value="">All countries</option>';
    region.innerHTML = '<option value="">All states / regions</option>';
    city.innerHTML = '<option value="">All cities</option>';
    genre.innerHTML = '<option value="">All genres</option>';
    const source = byId("listingType").value === "events" ? Object.values(events) : Object.values(locations);
    unique(source.map(x => x.country)).forEach(x => country.append(new Option(x,x)));
    unique(source.map(x => x.region)).forEach(x => region.append(new Option(x,x)));
    unique(source.map(x => x.city)).forEach(x => city.append(new Option(x,x)));
    unique(source.flatMap(x => x.genres || [])).forEach(x => genre.append(new Option(x,x)));
  }
  function bindFilters() {
    ["locationSearch","countryFilter","regionFilter","cityFilter","genreFilter"].forEach(id => {
      const el = byId(id);
      if (el && !el.dataset.bound) { el.addEventListener("input", renderGrid); el.addEventListener("change", renderGrid); el.dataset.bound = "1"; }
    });
  }
  function showListing() { showPage("listingPage"); populateFilters(); bindFilters(); renderGrid(); }

  function renderGrid() {
    const type = byId("listingType").value || "clubs";
    if (type === "events") return renderEventGrid();
    return renderLocationGrid();
  }

  const SEARCH_STOP_WORDS = new Set(["a","an","and","am","are","at","for","i","in","interested","interest","into","like","likes","looking","near","of","on","people","person","the","to","want","who","with","going","go","club","clubs","venue","venues","event","events","night","nightlife"]);
  const SEARCH_ALIASES = {
    hiphop: ["hiphop","hip hop","hip-hop","rap"],
    hop: ["hop","hope"],
    girl: ["girl","girls","female","woman","women","lady","ladies"],
    girls: ["girl","girls","female","woman","women","lady","ladies"],
    female: ["female","girl","girls","woman","women"],
    woman: ["woman","women","female","girl","girls"],
    women: ["woman","women","female","girl","girls"],
    car: ["car","cars","fast car","fast cars","coupe","luxury car","exotic car"],
    cars: ["car","cars","fast car","fast cars","coupe","luxury car","exotic car"],
    fast: ["fast","fast car","fast cars","car","cars","coupe"],
    fastcar: ["fast car","fast cars","car","cars","coupe","luxury car"],
    fastcars: ["fast cars","fast car","car","cars","coupe","luxury car"],
    latina: ["latina","latin","latino","reggaeton","salsa","bachata","latin events","latin night"],
    latin: ["latin","latina","latino","reggaeton","salsa","bachata","latin events","latin night"],
    afrobeats: ["afrobeats","afro beats","afrobeat","afro beat"],
    afrobeat: ["afrobeat","afro beat","afrobeats","afro beats"],
    rnb: ["rnb","r b","r&b","r and b"],
    edm: ["edm","electronic dance music"],
    loungeclub: ["loungeclub","lounge club","lounge-club"],
    beachclub: ["beachclub","beach club","beach-club"]
  };

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function compactSearchText(value) {
    return normalizeSearchText(value).replace(/[^a-z0-9]/g, "");
  }

  function searchTokens(value) {
    return normalizeSearchText(value).split(/\s+/).filter(token => token && !SEARCH_STOP_WORDS.has(token));
  }

  function searchFields(value) {
    const text = normalizeSearchText(value);
    return { text, compact: text.replace(/[^a-z0-9]/g, ""), tokens: text.split(/\s+/).filter(Boolean) };
  }

  function editDistanceWithin(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return false;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const curr = [i];
      let rowMin = curr[0];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        rowMin = Math.min(rowMin, curr[j]);
      }
      if (rowMin > limit) return false;
      for (let j = 0; j < curr.length; j += 1) prev[j] = curr[j];
    }
    return prev[b.length] <= limit;
  }

  function tokenMatchesSearchField(token, field) {
    const variants = SEARCH_ALIASES[compactSearchText(token)] || [token];
    return variants.some(variant => {
      const normalized = normalizeSearchText(variant);
      const compact = compactSearchText(variant);
      if (!compact) return true;
      if (field.text.includes(normalized) || field.compact.includes(compact)) return true;
      const tolerance = compact.length >= 6 ? 2 : compact.length >= 3 ? 1 : 0;
      return tolerance > 0 && field.tokens.some(candidate => editDistanceWithin(compact, candidate, tolerance));
    });
  }

  function contextualSearchMatch(query, value) {
    const tokens = searchTokens(query);
    if (!tokens.length) return true;
    const field = searchFields(value);
    return tokens.every(token => tokenMatchesSearchField(token, field));
  }

  async function getCollectionSafe(name, filterFn, limit = 1000) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      const rows = snap.docs.map(d => ({id:d.id, ...d.data()}));
      return filterFn ? rows.filter(filterFn) : rows;
    } catch(e) {
      console.warn(`Could not read ${name}:`, e.message);
      return [];
    }
  }

  async function getParticipantCollectionSafe(name, uid, limit = 1000) {
    try {
      const snap = await db.collection(name).where("participants", "array-contains", uid).limit(limit).get();
      return snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch(e) {
      console.warn(`Could not read participant ${name}:`, e.message);
      return [];
    }
  }

  function pairId(a, b) {
    return [a, b].filter(Boolean).sort().join("_");
  }

  function minglLogoForProfile(profile = cachedUserProfile || {}) {
    const gender = String(profile.gender || profile.sex || profile.genderIdentity || "").toLowerCase();
    if (gender.includes("female") || gender.includes("woman")) return "./images/mingl-pink-logo.png";
    if (gender.includes("male") || gender.includes("man")) return "./images/mingl-blue-logo.png";
    return "./images/mingl-chrome-logo.png";
  }

  function profileStateRegion(profile = {}) {
    return profile.state || profile.region || profile.province || profile.stateRegionProvince || profile.stateProvince || profile.regionProvince || "";
  }

  function profileLocationParts(profile = {}) {
    return [profile.city, profileStateRegion(profile), profile.country].filter(Boolean);
  }

  function publicProfileHaystack(profile) {
    return [
      profile.displayName, profile.username, ...profileLocationParts(profile), profile.bio,
      profile.nightlifeStyle, profile.lookingToMeet, profile.gender,
      ...(profile.musicInterests || profile.favoriteGenres || []),
      ...(profile.travelInterests || []),
      ...(profile.hobbies || profile.generalHobbies || []),
      ...(profile.foodChoices || []),
      ...(profile.favoriteBeverages || [])
    ].join(" ");
  }

  function normValue(value) {
    return normalizeSearchText(value).replace(/\s+/g, " ").trim();
  }

  function valueSet(value) {
    const items = Array.isArray(value) ? value : splitCSV(value);
    return new Set(items.map(normValue).filter(Boolean));
  }

  function setsOverlap(a, b) {
    for (const item of a) if (b.has(item)) return true;
    return false;
  }

  function valuesContextuallyOverlap(a, b) {
    const left = Array.from(valueSet(a));
    const right = Array.from(valueSet(b));
    return left.some(item => right.some(candidate => contextualSearchMatch(item, candidate) || contextualSearchMatch(candidate, item)));
  }

  function contextualValueEquals(a, b) {
    const left = normValue(a);
    const right = normValue(b);
    return !!left && !!right && (contextualSearchMatch(left, right) || contextualSearchMatch(right, left));
  }

  function profileMatchScore(a = {}, b = {}) {
    const checks = [
      contextualValueEquals(a.city, b.city),
      contextualValueEquals(profileStateRegion(a), profileStateRegion(b)),
      contextualValueEquals(a.country, b.country),
      contextualValueEquals(a.gender, b.gender),
      valuesContextuallyOverlap(a.musicInterests || a.favoriteGenres, b.musicInterests || b.favoriteGenres),
      valuesContextuallyOverlap(a.travelInterests, b.travelInterests),
      valuesContextuallyOverlap(a.hobbies || a.generalHobbies, b.hobbies || b.generalHobbies),
      valuesContextuallyOverlap(a.nightlifeInterests, b.nightlifeInterests),
      contextualValueEquals(a.nightlifeStyle, b.nightlifeStyle),
      valuesContextuallyOverlap(a.foodChoices, b.foodChoices),
      valuesContextuallyOverlap(a.favoriteBeverages, b.favoriteBeverages),
      contextualValueEquals(a.lookingToMeet, b.lookingToMeet)
    ];
    return checks.filter(Boolean).length;
  }

  const PROFILE_DATAPOINTS = [
    {key:"gender", label:"Gender", get:p => p.gender},
    {key:"music", label:"Music", get:p => p.musicInterests || p.favoriteGenres},
    {key:"events", label:"Events", get:p => p.nightlifeInterests || p.nightlifeStyle},
    {key:"travel", label:"Travel", get:p => p.travelInterests},
    {key:"hobbies", label:"Hobbies", get:p => p.hobbies || p.generalHobbies},
    {key:"food", label:"Food", get:p => p.foodChoices},
    {key:"beverage", label:"Beverages", get:p => p.favoriteBeverages},
    {key:"meet", label:"Meet", get:p => p.lookingToMeet},
    {key:"location", label:"Location", get:p => profileLocationParts(p)}
  ];

  function dataPointValues(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return splitCSV(value).length ? splitCSV(value) : (value ? [String(value)] : []);
  }

  function profileSearchHaystack(profile = {}) {
    return [
      publicProfileHaystack(profile),
      ...PROFILE_DATAPOINTS.flatMap(point => dataPointValues(point.get(profile)))
    ].join(" ");
  }

  function queryIntentScore(query, profile = {}) {
    const tokens = searchTokens(query);
    if (!tokens.length) return 0;
    const haystack = searchFields(profileSearchHaystack(profile));
    return tokens.reduce((sum, token) => sum + (tokenMatchesSearchField(token, haystack) ? 1 : 0), 0);
  }

  function sharedDataPointLabels(a = {}, b = {}) {
    return PROFILE_DATAPOINTS.filter(point => valuesContextuallyOverlap(point.get(a), point.get(b)) || contextualValueEquals(point.get(a), point.get(b))).map(point => point.label);
  }

  function isPublicMinglCandidate(profile = {}) {
    const visibility = String(profile.publicProfileVisibility || "").toLowerCase();
    return visibility === "public" && !!profileMinglPhoto(profile) && profileMatchScore(cachedUserProfile || {}, profile) >= 3;
  }

  function profileMinglPhoto(profile = {}) {
    const media = Array.isArray(profile.profileMediaSlots) ? profile.profileMediaSlots.find(x => x?.url && x.type !== "video") : null;
    return media?.url || profile.photoURL || profile.avatarUrl || "";
  }

  function connectionFor(uid) {
    const id = pairId(currentUser?.uid, uid);
    return minglConnections.find(x => x.id === id || x.connectionId === id);
  }

  function connectionStatusFor(uid) {
    const c = connectionFor(uid);
    if (!c) return {state:"none"};
    if (c.status === "mutual") return {state:"mutual", connection:c};
    if (c.requestedBy === currentUser?.uid) return {state:"sent", connection:c};
    return {state:"received", connection:c};
  }

  function profileSummaryText(profile) {
    const parts = [
      profileLocationParts(profile).join(", "),
      joinList(profile.musicInterests || profile.favoriteGenres),
      joinList(profile.travelInterests),
      joinList(profile.hobbies || profile.generalHobbies),
      joinList(profile.foodChoices),
      joinList(profile.favoriteBeverages)
    ].filter(Boolean);
    return parts.join(" - ");
  }

  function joinList(value) {
    return Array.isArray(value) ? value.slice(0, 4).join(", ") : String(value || "");
  }

  async function showShoutoutLanding() {
    showPage("shoutoutLandingPage");
  }

  async function showMinglLanding() {
    if (!currentUser) {
      setStatus("Please sign in before using Mingl.");
      showPage("landingPage");
      return;
    }
    const profile = await getUserProfile();
    const logo = byId("minglLandingLogo");
    if (logo) logo.src = minglLogoForProfile(profile || {});
    showPage("minglLandingPage");
    await loadMingl();
  }

  async function loadMingl() {
    if (!currentUser) return;
    const [users, connections] = await Promise.all([
      getCollectionSafe("users", x => x.uid !== currentUser.uid && isPublicMinglCandidate(x)),
      getParticipantCollectionSafe("minglConnections", currentUser.uid)
    ]);
    minglCandidates = users;
    minglConnections = connections;
    renderMinglSelfCard();
    renderMinglPeople();
    renderMinglChats();
  }

  function renderProfileDatapoints(profile = {}, prefix = "profile") {
    return `<div class="profile-datapoint-grid">${PROFILE_DATAPOINTS.map((point, index) => {
      const values = dataPointValues(point.get(profile));
      if (!values.length) return "";
      const id = `${prefix}-${point.key}-${index}`;
      return `<details class="profile-datapoint">
        <summary>${esc(point.label)}</summary>
        <div>${values.map(value => `<span>${esc(value)}</span>`).join("")}</div>
      </details>`;
    }).join("")}</div>`;
  }

  function setupDatapointPopouts(root = document) {
    root.querySelectorAll(".profile-datapoint").forEach(detail => {
      if (detail.dataset.bound === "1") return;
      detail.dataset.bound = "1";
      detail.addEventListener("toggle", () => {
        if (!detail.open) return;
        document.querySelectorAll(".profile-datapoint[open]").forEach(other => {
          if (other !== detail) other.removeAttribute("open");
        });
      });
    });
  }

  function renderMinglSelfCard() {
    const wrap = byId("minglSelfCard");
    if (!wrap || !currentUser) return;
    const profile = cachedUserProfile || {};
    const photo = profileMinglPhoto(profile) || currentUser.photoURL || "";
    wrap.innerHTML = `
      <div class="mingl-self-photo">${photo ? `<img src="${esc(photo)}" alt="${esc(profile.displayName || "Your profile")}">` : `<span>${esc((profile.displayName || currentUser.displayName || "M").slice(0,1).toUpperCase())}</span>`}</div>
      <div>
        <p class="eyebrow">Mingl Profile</p>
        <h3>${esc(profile.displayName || currentUser.displayName || currentUser.email || "Your Profile")}</h3>
        ${renderProfileDatapoints(profile, "self")}
      </div>`;
    setupDatapointPopouts(wrap);
  }

  function renderMinglPeople() {
    const grid = byId("minglPeopleGrid");
    if (!grid) return;
    const query = byId("minglSearch")?.value || "";
    const matches = minglCandidates
      .map(profile => ({
        profile,
        sharedScore: profileMatchScore(cachedUserProfile || {}, profile),
        intentScore: queryIntentScore(query, profile)
      }))
      .filter(item => !query || item.intentScore > 0 || contextualSearchMatch(query, publicProfileHaystack(item.profile)))
      .sort((a,b) => (b.intentScore + b.sharedScore) - (a.intentScore + a.sharedScore))
      .slice(0, 40);
    grid.innerHTML = matches.length ? "" : '<div class="empty">No public Mingl profiles matched that search yet. Try interests like fast cars, Latin events, Afro House, travel, food, city, or hobbies.</div>';
    matches.forEach(({profile, sharedScore, intentScore}) => {
      const uid = profile.uid || profile.id;
      const status = connectionStatusFor(uid);
      const photoUrl = profileMinglPhoto(profile);
      const card = document.createElement("div");
      card.className = "mingl-person-card";
      const buttonText = status.state === "mutual" ? "Start Chat" : status.state === "sent" ? "Mingl Request Sent" : status.state === "received" ? "Mingl Back and Start Chat" : "Start Chat / Mingl";
      const sharedLabels = sharedDataPointLabels(cachedUserProfile || {}, profile).slice(0, 5);
      card.innerHTML = `
        <div class="mingl-person-photo">${photoUrl ? `<img src="${esc(photoUrl)}" alt="${esc(profile.displayName || "Mingl profile")}">` : `<span>${esc((profile.displayName || profile.username || "M").slice(0,1).toUpperCase())}</span>`}</div>
        <div>
          <h3>${esc(profile.displayName || profile.username || "Mingl Member")}</h3>
          <small>${sharedScore} shared profile matches${query ? ` - ${intentScore} search signals` : ""}</small>
          ${sharedLabels.length ? `<div class="mingl-shared-row">${sharedLabels.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
          <p>${esc(profileSummaryText(profile) || "Nightlife profile")}</p>
          ${renderProfileDatapoints(profile, `match-${esc(uid)}`)}
          <button class="primary" type="button" ${status.state === "sent" ? "disabled" : ""}>${esc(buttonText)}</button>
        </div>`;
      card.querySelector("button").addEventListener("click", () => handleMinglAction(profile));
      grid.appendChild(card);
    });
    setupDatapointPopouts(grid);
  }

  async function handleMinglAction(profile) {
    const targetUid = profile.uid || profile.id;
    const status = connectionStatusFor(targetUid);
    if (status.state === "mutual") {
      openMinglChat(status.connection);
      return;
    }
    const id = pairId(currentUser.uid, targetUid);
    const connectionRef = db.collection("minglConnections").doc(id);
    const summary = {
      [currentUser.uid]: {
        displayName: cachedUserProfile?.displayName || currentUser.displayName || currentUser.email || "Patron",
        photoURL: currentUser.photoURL || cachedUserProfile?.photoURL || ""
      },
      [targetUid]: {
        displayName: profile.displayName || profile.username || "Mingl Member",
        photoURL: profile.photoURL || ""
      }
    };
    const nextStatus = status.state === "received" ? "mutual" : "pending";
    await connectionRef.set({
      connectionId:id,
      participants:[currentUser.uid, targetUid],
      requestedBy: status.state === "received" ? status.connection.requestedBy : currentUser.uid,
      requestedTo: status.state === "received" ? status.connection.requestedTo : targetUid,
      status: nextStatus,
      userSummaries: summary,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    if (nextStatus === "mutual") {
      await ensureMinglChatRoom(id, [currentUser.uid, targetUid], summary);
    }
    setStatus(nextStatus === "mutual" ? "You both Mingled back. Chat is now open." : "Mingl request sent.");
    await loadMingl();
  }

  async function ensureMinglChatRoom(connectionId, participants, summaries) {
    const roomId = `mingl_${connectionId}`;
    await db.collection("chatRooms").doc(roomId).set({
      id: roomId,
      type: "mingl",
      title: "Mingl Chat",
      connectionId,
      participants,
      userSummaries: summaries || {},
      lastMessage: "",
      unreadCounts: {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    return roomId;
  }

  async function renderMinglChats() {
    const list = byId("minglChatList");
    if (!list || !currentUser) return;
    const rooms = (await getParticipantCollectionSafe("chatRooms", currentUser.uid)).filter(x => x.type === "mingl");
    list.innerHTML = rooms.length ? "" : "<p class='sub'>No Mingl chats yet. Send a Mingl request and wait for them to Mingl back.</p>";
    rooms.forEach(room => {
      const otherUid = (room.participants || []).find(uid => uid !== currentUser.uid);
      const other = room.userSummaries?.[otherUid] || {};
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mingl-chat-item";
      item.innerHTML = `<strong>${esc(other.displayName || room.title || "Mingl Chat")}</strong><span>${esc(room.lastMessage || "Open chat")}</span>`;
      item.addEventListener("click", () => openMinglChat(room));
      list.appendChild(item);
    });
  }

  async function openMinglChat(connectionOrRoom) {
    const roomId = connectionOrRoom.id?.startsWith("mingl_") ? connectionOrRoom.id : `mingl_${connectionOrRoom.connectionId || connectionOrRoom.id}`;
    activeMinglRoomId = roomId;
    const panel = byId("minglChatPanel");
    panel?.classList.remove("hidden");
    const roomDoc = await db.collection("chatRooms").doc(roomId).get();
    const room = roomDoc.exists ? {id:roomDoc.id, ...roomDoc.data()} : connectionOrRoom;
    const otherUid = (room.participants || []).find(uid => uid !== currentUser.uid);
    setText("minglChatTitle", room.userSummaries?.[otherUid]?.displayName || "Mingl Chat");
    await loadMinglMessages();
  }

  async function loadMinglMessages() {
    const wrap = byId("minglMessages");
    if (!wrap || !activeMinglRoomId) return;
    const rows = await getCollectionSafe("chatMessages", x => x.roomId === activeMinglRoomId, 1000);
    rows.sort((a,b) => {
      const at = a.createdAt?.seconds || 0;
      const bt = b.createdAt?.seconds || 0;
      return at - bt;
    });
    wrap.innerHTML = rows.length ? rows.map(msg => `<div class="mingl-message ${msg.senderUid === currentUser.uid ? "mine" : ""}"><strong>${esc(msg.senderName || "Member")}</strong><p>${esc(msg.body || "")}</p><small>${esc(msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : "")}</small></div>`).join("") : "<p class='sub'>No messages yet.</p>";
    wrap.scrollTop = wrap.scrollHeight;
  }

  async function sendMinglMessage() {
    const body = byId("minglMessageInput")?.value.trim();
    if (!currentUser || !activeMinglRoomId || !body) return;
    const roomSnap = await db.collection("chatRooms").doc(activeMinglRoomId).get();
    if (!roomSnap.exists || !(roomSnap.data().participants || []).includes(currentUser.uid)) {
      setStatus("Mingl chat is available only after both patrons Mingl back.");
      return;
    }
    const room = roomSnap.data();
    const unreadCounts = {...(room.unreadCounts || {})};
    (room.participants || []).forEach(uid => { if (uid !== currentUser.uid) unreadCounts[uid] = Number(unreadCounts[uid] || 0) + 1; });
    await db.collection("chatMessages").add({
      roomId: activeMinglRoomId,
      roomType: "mingl",
      connectionId: room.connectionId || "",
      participants: room.participants || [],
      senderUid: currentUser.uid,
      senderName: cachedUserProfile?.displayName || currentUser.displayName || currentUser.email || "Member",
      body,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection("chatRooms").doc(activeMinglRoomId).set({
      lastMessage: body,
      unreadCounts,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    byId("minglMessageInput").value = "";
    await loadMinglMessages();
    await renderMinglChats();
  }

  function renderEventGrid() {
    const grid = byId("locationGrid");
    const s = byId("locationSearch")?.value || "";
    const country = byId("countryFilter")?.value || "", region = byId("regionFilter")?.value || "", city = byId("cityFilter")?.value || "", genre = byId("genreFilter")?.value || "";
    const matches = Object.entries(events).filter(([id,e]) => {
      const hay = `${e.eventName} ${e.country} ${e.region} ${e.city} ${(e.genres||[]).join(" ")} ${(e.artists||[]).join(" ")} ${e.eventDay} ${e.eventTime} ${e.eventDate}`;
      return contextualSearchMatch(s, hay) && (!country || e.country === country) && (!region || e.region === region) && (!city || e.city === city) && (!genre || (e.genres||[]).includes(genre));
    });
    grid.innerHTML = matches.length ? "" : '<div class="empty">No matching events found.</div>';
    matches.forEach(([id,e]) => {
      const loc = getLocation(e.locationId);
      const card = document.createElement("div");
      card.className = "club-option";
      card.innerHTML = `<div><div class="club-option-head"><div><h3>${esc(e.eventName)}</h3><p>${esc(loc.locationName || e.locationId)} • ${esc(e.city)}, ${esc(e.country)}</p></div><strong>${esc(e.eventDay || "")}</strong></div><p class="dj">${esc((e.genres||[]).join(" • "))}</p><div class="badge-row"><span>${esc(e.eventDate || "")}</span><span>${esc(e.eventTime || "")}</span>${(e.artists||[]).slice(0,2).map(a=>`<span>${esc(a)}</span>`).join("")}</div></div><button class="primary" type="button">Buy Ticket / ShoutOut</button>`;
      card.querySelector("button").addEventListener("click", () => {
        const msg = "Ticket checkout will be connected in the next payment integration. For now, you can throw a ShoutOut at this event location.";
        alert(msg);
        selectLocationForShoutOut(e.locationId);
      });
      grid.appendChild(card);
    });
  }

  function renderLocationGrid() {
    const grid = byId("locationGrid");
    const type = byId("listingType").value || "clubs";
    const s = byId("locationSearch")?.value || "";
    const country = byId("countryFilter")?.value || "", region = byId("regionFilter")?.value || "", city = byId("cityFilter")?.value || "", genre = byId("genreFilter")?.value || "";
    const matches = Object.entries(locations).filter(([id,l]) => {
      const hay = `${l.brandName} ${l.locationName} ${l.country} ${l.region} ${l.city} ${l.locationLabel} ${(l.categories||[]).join(" ")} ${(l.genres||[]).join(" ")} ${(l.artists||[]).join(" ")} ${(l.activityDates||[]).join(" ")}`;
      const actionBase = byId("clubActionsPage")?.getAttribute("data-category-type") || "clubs";
      const effectiveType = type.startsWith("club-action:") ? actionBase : type;
      const typeOk =
        effectiveType === "lounges" ? (l.type === "lounge" || (l.categories||[]).includes("Lounges")) :
        effectiveType === "lounge-club" ? (l.type === "lounge-club" || (l.categories||[]).includes("Lounge-Club")) :
        effectiveType === "beach-clubs" ? (l.type === "beach-club" || (l.categories||[]).includes("Beach Clubs")) :
        effectiveType === "clubs" || effectiveType === "shoutout" ? (l.type === "club" || l.type === "lounge-club" || l.type === "beach-club" || (l.categories||[]).includes("Clubs")) :
        true;
      return typeOk && contextualSearchMatch(s, hay) && (!country || l.country === country) && (!region || l.region === region) && (!city || l.city === city) && (!genre || (l.genres||[]).includes(genre));
    });
    grid.innerHTML = matches.length ? "" : '<div class="empty">No matching results found.</div>';
    matches.forEach(([id,l]) => {
      const card = document.createElement("div");
      card.className = "club-option";
      card.innerHTML = `<div><div class="club-option-head"><div><h3>${esc(l.locationName)}</h3><p>${esc(l.locationLabel)}</p></div><strong>${esc(l.country)}</strong></div><p class="dj">${esc((l.genres||[]).join(" • "))}</p><div class="badge-row">${(l.activityDates||[]).slice(0,4).map(x => `<span>${esc(x)}</span>`).join("")}</div></div><button class="primary" type="button">${type === "shoutout" ? "Throw ShoutOut Here" : type.startsWith("club-action:") ? "Continue" : "Select"}</button>`;
      card.querySelector("button").addEventListener("click", () => selectLocationForShoutOut(id));
      grid.appendChild(card);
    });
  }

  async function selectLocationForShoutOut(id) {
    selectedLocationId = id;
    const loc = await loadLocationById(id);
    setText("selectedClubTitle", loc.locationName);
    setText("selectedClubMeta", `${loc.locationLabel} • ${(loc.genres||[]).join(" / ")}`);
    selectedTemplate = "blackwhite";
    if (byId("templateSearch")) byId("templateSearch").value = "";
    renderTemplates(); updateTemplateSummary(); showPage("templateSelectPage");
  }
  function showTemplateSelection(){ renderTemplates(); updateTemplateSummary(); showPage("templateSelectPage"); }
  function templateSearchText(t) {
    return `${t.name || ""} ${t.category || ""} ${t.scope || ""} ${t.mediaMode || ""} ${t.description || ""} ${t.supportsMedia || t.supportsImage || t.supportsVideo ? "image video photo media placeholder upload" : "no image no video classic text only"}`.toLowerCase();
  }
  function renderTemplates() {
    const grid = byId("templateGrid"); if (!grid) return; grid.innerHTML = "";
    const query = (byId("templateSearch")?.value || "").trim().toLowerCase();
    const ids = Array.from(new Set(["blackwhite", ...(getLocation().templates || []), ...(window.SHOUTOUT_STANDARD_TEMPLATE_IDS || [])]));
    const filteredIds = ids.filter(id => {
      const t = getTemplate(id);
      return !query ? id === "blackwhite" : contextualSearchMatch(query, templateSearchText(t));
    });
    grid.innerHTML = filteredIds.length ? "" : '<div class="empty">No matching templates found.</div>';
    filteredIds.forEach(id => {
      const t = getTemplate(id), item = document.createElement("div");
      item.className = `template ${t.className || "neon"} ${t.id === selectedTemplate ? "selected" : ""}`;
      item.setAttribute("role", "button");
      item.tabIndex = 0;
      item.innerHTML = `<div class="template-mini-preview"><strong>${esc(t.defaultMain || "SHOUTOUT")}</strong><span>${esc(t.defaultSub || t.category || "")}</span></div><div class="name">${esc(t.name)}</div><div class="tag">${esc(t.mediaMode || (t.supportsMedia ? "Image/video placeholder" : "No image/video"))}</div>`;
      const openTemplate = () => { selectedTemplate = t.id; renderTemplates(); updateTemplateSummary(); goToEditor(); };
      item.addEventListener("click", openTemplate);
      item.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTemplate(); } });
      grid.appendChild(item);
    });
  }
  function updateTemplateSummary() {
    const t = getTemplate();
    document.body.dataset.selectedTemplate = t.id || selectedTemplate;
    document.body.classList.toggle("template-media-unavailable", !currentTemplateSupportsMedia());
    byId("selectedTemplateSummary").innerHTML = `<h3>${esc(t.name)}</h3><p>${esc(t.description || "Template selected.")}</p><div class="badge-row"><span>${esc(t.category || "Shared")}</span><span>${esc(t.mediaMode || (t.supportsMedia ? "Image/video placeholder" : "No image/video"))}</span></div>`;
    updateMediaEditorForTemplate();
  }
  function displayUrl(payload, id=locationId()) {
    const url = new URL("./display.html", window.location.href);
    url.searchParams.set("location", id);
    if(payload){ url.searchParams.set("main",payload.mainText||""); url.searchParams.set("sub",payload.subText||""); url.searchParams.set("template",payload.template||"neon"); url.searchParams.set("media",payload.mediaUrl||""); url.searchParams.set("mediaType",payload.mediaType||""); }
    return url.href;
  }
  function goToEditor() { const l=getLocation(), t=getTemplate(); setText("editorClubTitle", l.locationName); setText("editorTemplateMeta", `${l.locationLabel} • Template: ${t.name}`); updatePreview(); showPage("editorPage"); }
  function updatePreview() {
    const frame=byId("previewFrame");
    const mediaUrl = byId("shoutoutMediaUrl")?.value.trim() || byId("mediaUrl")?.value.trim() || "";
    const mediaType = byId("shoutoutMediaType")?.value.trim() || "";
    if(frame) frame.src=displayUrl({mainText:byId("mainText")?.value.trim()||"SHOUTOUT!", subText:byId("subText")?.value.trim()||"", mediaUrl, mediaType, template:selectedTemplate}, locationId());
  }

  async function uploadShoutoutPhoto(referenceNumber) {
    if (!currentTemplateSupportsMedia()) return {};
    const file = byId("shoutoutPhoto")?.files?.[0];
    if (!file) return {};
    if (!storage) throw new Error("Firebase Storage is not initialized. Add firebase-storage-compat.js and enable Storage.");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Only JPG, PNG, and WEBP images are allowed.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Image must be 8MB or smaller.");
    setText("uploadStatus", "Uploading photo...");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `shoutouts/${currentUser.uid}/${referenceNumber}-${Date.now()}-${safeName}`;
    const ref = storage.ref().child(path);
    const snap = await ref.put(file, { contentType: file.type, customMetadata: { uploadedBy: currentUser.uid, referenceNumber } });
    const url = await snap.ref.getDownloadURL();
    setText("uploadStatus", "Photo uploaded.");
    return {
      mediaUrl: url,
      mediaType: "image",
      mediaFileName: file.name,
      mediaStoragePath: path,
      mediaUploadedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function uploadShoutoutMedia(referenceNumber) {
    if (!currentTemplateSupportsMedia()) return {};
    if (window.jadzUploadSelectedShoutoutMedia && byId("shoutoutMediaUpload")?.files?.[0]) {
      setText("uploadStatus", "Uploading media...");
      const media = await window.jadzUploadSelectedShoutoutMedia(referenceNumber);
      if (media?.mediaUrl) {
        setText("uploadStatus", `${media.mediaType === "video" ? "Video" : "Image"} uploaded.`);
        return media;
      }
    }
    return uploadShoutoutPhoto(referenceNumber);
  }

  function applyAiSuggestion() {
    const pool = window.SHOUTOUT_AI_SUGGESTIONS || [];
    const item = pool[Math.floor(Math.random() * pool.length)] || {main:"SHOUTOUT!", sub:"VIP vibes tonight."};
    const mainInput = byId("mainText");
    if (mainInput) mainInput.value = String(item.main || "").slice(0, Number(mainInput.maxLength || 36));
    syncAttribution();
    const box = byId("shoutoutSuggestionBox");
    if (box) { box.classList.remove("hidden"); box.innerHTML = `<strong>AI Suggestion</strong><p>${esc(item.main)} — ${esc(item.sub)}</p>`; }
    updatePreview();
  }

  async function loadPastShoutoutsForReuse() {
    const box = byId("shoutoutSuggestionBox");
    if (!box || !currentUser) return;
    box.classList.remove("hidden");
    box.innerHTML = "Loading past ShoutOuts...";
    try {
      const snap = await db.collection("shoutouts").where("submittedBy", "==", safeUser()).limit(10).get();
      const rows = [];
      snap.forEach(doc => rows.push({id:doc.id, ...doc.data()}));
      if (!rows.length) { box.innerHTML = "<p>No previous ShoutOuts found yet.</p>"; return; }
      box.innerHTML = rows.map((s,i)=>`<button type="button" class="reuse-shoutout" data-i="${i}">${esc(s.mainText||"ShoutOut")} — ${esc(s.subText||"")}</button>`).join("");
      box.querySelectorAll(".reuse-shoutout").forEach(btn => btn.addEventListener("click", () => {
        const s = rows[Number(btn.dataset.i)];
        const mainInput = byId("mainText");
        if (mainInput) mainInput.value = String(s.mainText || "").slice(0, Number(mainInput.maxLength || 36));
        if (byId("includeAttribution")) byId("includeAttribution").checked = !!s.subText;
        syncAttribution();
        if (s.mediaUrl) byId("mediaUrl").value = s.mediaUrl;
        if (s.mediaUrl && byId("shoutoutMediaUrl")) byId("shoutoutMediaUrl").value = s.mediaUrl;
        if (s.mediaType && byId("shoutoutMediaType")) byId("shoutoutMediaType").value = s.mediaType;
        updatePreview();
      }));
    } catch(e) { box.innerHTML = `<p>${esc(e.message)}</p>`; }
  }

  async function submitShoutout() {
    const status=byId("submitStatus");
    try {
      if(!currentUser){ status.textContent="Sign in first."; return; }
      if(!selectedLocationId){ status.textContent="Select a location first."; return; }
      const l=getLocation(), t=getTemplate();
      const referenceNumber = `SO-${Date.now().toString().slice(-7)}`;
      const uploadedMedia = currentTemplateSupportsMedia() ? await uploadShoutoutMedia(referenceNumber) : {};
      const existingMediaUrl = byId("shoutoutMediaUrl")?.value.trim() || byId("mediaUrl")?.value.trim() || "";
      const existingMediaType = byId("shoutoutMediaType")?.value.trim() || "";
      const mediaPayload = currentTemplateSupportsMedia() ? {
        mediaUrl: uploadedMedia.mediaUrl || existingMediaUrl,
        mediaType: uploadedMedia.mediaType || existingMediaType || "",
        mediaFileName: uploadedMedia.mediaFileName || "",
        mediaStoragePath: uploadedMedia.mediaStoragePath || "",
        mediaUploadedAt: uploadedMedia.mediaUploadedAt || null
      } : { mediaUrl:"", mediaType:"", mediaFileName:"", mediaStoragePath:"", mediaUploadedAt:null };
      const payload={ location:locationId(), club:locationId(), clubLocationId:locationId(), brandName:l.brandName, locationName:l.locationName, clubName:l.locationName, country:l.country, region:l.region, city:l.city, locationLabel:l.locationLabel, template:selectedTemplate, templateName:t.name, mainText:byId("mainText").value.trim()||"SHOUTOUT!", subText:byId("subText").value.trim()||"", ...mediaPayload, status:"pending", editable:true, submittedByUid:currentUser.uid, submittedBy:safeUser(), submittedAt:firebase.firestore.FieldValue.serverTimestamp(), referenceNumber };
      const shoutoutRef = await db.collection("shoutouts").add(payload);
      payload.shoutoutId = shoutoutRef.id;
      payload.modifyLink = `./patron-portal.html?tab=shoutouts&ref=${encodeURIComponent(payload.referenceNumber)}&id=${encodeURIComponent(shoutoutRef.id)}&v=28.39-f`;
      await db.collection("shoutoutAudit").add({shoutoutId:shoutoutRef.id, action:"submitted", referenceNumber:payload.referenceNumber, actorUid:currentUser.uid, actorEmail:safeUser(), createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      try { await db.collection("shoutoutRecommendations").add({source:"submission", uid:currentUser.uid, template:payload.template, mainText:payload.mainText, subText:payload.subText, createdAt:firebase.firestore.FieldValue.serverTimestamp()}); } catch(e) {}
      if (window.createShoutOutSubmissionNotification) await window.createShoutOutSubmissionNotification(payload);
      setText("confirmRef",payload.referenceNumber); setText("confirmClub",l.locationName); setText("confirmTemplate",t.name); showPage("confirmationPage");
    } catch(e) { status.textContent=e.message; }
  }
  function startAnother(){ byId("mainText").value="HAPPY BIRTHDAY MAYA!"; if(byId("includeAttribution"))byId("includeAttribution").checked=false; syncAttribution(); byId("mediaUrl").value=""; if(byId("shoutoutMediaUrl")) byId("shoutoutMediaUrl").value=""; if(byId("shoutoutMediaType")) byId("shoutoutMediaType").value=""; if(byId("shoutoutPhoto")) byId("shoutoutPhoto").value=""; if(byId("shoutoutMediaUpload")) byId("shoutoutMediaUpload").value=""; showTemplateSelection(); }

  function updateMediaEditorForTemplate() {
    const t = getTemplate();
    const allowsMedia = currentTemplateSupportsMedia();
    const accepts = currentTemplateAccepts();
    const mainInput = byId("mainText");
    if (mainInput) {
      const isClassic = (t.id || selectedTemplate) === "blackwhite";
      mainInput.maxLength = isClassic ? 36 : 60;
      if (mainInput.value.length > mainInput.maxLength) mainInput.value = mainInput.value.slice(0, mainInput.maxLength);
    }
    document.body.dataset.selectedTemplate = t.id || selectedTemplate;
    document.body.classList.toggle("template-media-unavailable", !allowsMedia);
    const photoWrap = byId("shoutoutPhotoWrap");
    const photoInput = byId("shoutoutPhoto");
    if (photoWrap) photoWrap.classList.toggle("hidden", !allowsMedia);
    if (photoInput) {
      photoInput.accept = accepts || "image/jpeg,image/png,image/webp";
      if (!allowsMedia) photoInput.value = "";
    }
    const mediaInput = byId("shoutoutMediaUpload");
    const mediaCard = mediaInput?.closest(".media-upload-card") || mediaInput?.closest(".card");
    if (mediaInput) {
      mediaInput.accept = accepts;
      if (!allowsMedia) mediaInput.value = "";
    }
    if (mediaCard) mediaCard.classList.toggle("hidden", !allowsMedia);
    const mediaUrl = byId("shoutoutMediaUrl"), mediaType = byId("shoutoutMediaType"), legacyUrl = byId("mediaUrl");
    if (!allowsMedia) {
      if (mediaUrl) mediaUrl.value = "";
      if (mediaType) mediaType.value = "";
      if (legacyUrl) legacyUrl.value = "";
    }
  }

  function goToEditor() {
    const l=getLocation(), t=getTemplate();
    setText("editorClubTitle", l.locationName);
    setText("editorTemplateMeta", `${l.locationLabel} - Template: ${t.name}`);
    updateMediaEditorForTemplate();
    syncAttribution();
    updatePreview();
    showPage("editorPage");
  }


  function ensureProfileMenuEnhancements(user) {
    const menus = [
      byId("profileMenu"),
      byId("userMenu"),
      document.querySelector(".profile-menu"),
      document.querySelector(".user-menu"),
      document.querySelector(".account-menu")
    ].filter(Boolean);

    const menu = menus[0];
    if (!menu || !user) return;

    if (!menu.querySelector("[data-patron-menu='portal']")) {
      const signOutButton = Array.from(menu.querySelectorAll("button")).find(b => String(b.textContent || "").toLowerCase().includes("sign out")) || null;

      const portalLink = document.createElement("a");
      portalLink.href = "./patron-portal.html?v=28.39-f";
      portalLink.textContent = "My Profile";
      portalLink.dataset.patronMenu = "portal";
      portalLink.className = "profile-menu-link";
      menu.insertBefore(portalLink, signOutButton);

      const level = document.createElement("div");
      level.textContent = "Member Level: Patron";
      level.dataset.patronMenu = "level";
      level.className = "profile-menu-line";
      menu.insertBefore(level, signOutButton);

      const messages = document.createElement("a");
      messages.href = "./patron-portal.html?tab=messages&v=28.39-f";
      messages.textContent = "Messages (0/0)";
      messages.dataset.patronMenu = "messages";
      messages.className = "profile-menu-link";
      menu.insertBefore(messages, signOutButton);

      const chats = document.createElement("a");
      chats.href = "./patron-portal.html?tab=chats&v=28.39-f";
      chats.textContent = "Mingl (0/0)";
      chats.dataset.patronMenu = "chats";
      chats.className = "profile-menu-link";
      menu.insertBefore(chats, signOutButton);
    }

    updateProfileMenuCounts(user.uid);
  }

  async function updateProfileMenuCounts(uid) {
    try {
      const profileDoc = await db.collection("users").doc(uid).get();
      const profile = profileDoc.exists ? profileDoc.data() : {};
      const levelEl = document.querySelector("[data-patron-menu='level']");
      if (levelEl) levelEl.textContent = `Member Level: ${profile.memberLevel || "Patron"}`;

      let totalMessages = 0, unreadMessages = 0, totalChats = 0, unreadChats = 0;

      try {
        const msgSnap = await db.collection("messages").where("recipientUid", "==", uid).limit(1000).get();
        totalMessages = msgSnap.size;
        msgSnap.forEach(d => { if (!d.data().read) unreadMessages += 1; });
      } catch(e) {}
      try {
        const noteSnap = await db.collection("inboxNotifications").where("recipientUid", "==", uid).limit(1000).get();
        totalMessages += noteSnap.size;
        noteSnap.forEach(d => { if (!d.data().read) unreadMessages += 1; });
      } catch(e) {}

      try {
        const chatSnap = await db.collection("chatRooms").where("participants", "array-contains", uid).limit(1000).get();
        totalChats = chatSnap.size;
        chatSnap.forEach(d => {
          const unread = d.data().unreadCounts && d.data().unreadCounts[uid] ? Number(d.data().unreadCounts[uid]) : 0;
          unreadChats += unread;
        });
      } catch(e) {}

      const msgEl = document.querySelector("[data-patron-menu='messages']");
      if (msgEl) msgEl.textContent = `Messages (${unreadMessages}/${totalMessages})`;

      const chatEl = document.querySelector("[data-patron-menu='chats']");
      if (chatEl) chatEl.textContent = `Mingl (${unreadChats}/${totalChats})`;
    } catch(e) {
      console.warn("Could not update profile menu counts", e);
    }
  }


  document.addEventListener("DOMContentLoaded", function(){
    detectRenderContext();
    window.addEventListener("resize", detectRenderContext);
    window.addEventListener("orientationchange", detectRenderContext);
    setStatus("");
    auth.getRedirectResult().then(result => {
      if (result?.user) setStatus(`Signed in with Microsoft as ${result.user.email || result.user.displayName || result.user.uid}`);
    }).catch(e => setStatus(microsoftAuthErrorMessage(e)));
    auth.onAuthStateChanged(async user => { currentUser=user; updateLoginUI(user); if(user) await afterLogin(); });
    bind("googleLoginBtn", loginGoogle); bind("facebookLoginBtn", loginFacebook); bind("microsoftLoginBtn", loginMicrosoft); bind("showSmsOtpBtn", showSmsOtpPanel); bind("sendOtpBtn", sendPhoneCode); bind("verifyOtpBtn", verifyPhoneCode); bind("continueBtn", afterLogin);
    ["logoutBtn1","logoutBtn2","logoutBtn3","logoutBtn4","logoutBtn5","logoutBtn6","logoutBtnClubActions"].forEach(id => bind(id, logout));
    bind("eventsBtn", () => openCategory("events")); bind("clubsBtn", () => openCategory("clubs")); bind("loungesBtn", () => openCategory("lounges")); bind("loungeClubBtn", () => openCategory("lounge-club")); bind("beachClubsBtn", () => openCategory("beach-clubs")); bind("shoutoutBtn", () => openCategory("shoutout"));
    bind("eventsBtnCard", () => openCategory("events")); bind("clubsBtnCard", () => openCategory("clubs")); bind("loungesBtnCard", () => openCategory("lounges")); bind("loungeClubBtnCard", () => openCategory("lounge-club")); bind("beachClubsBtnCard", () => openCategory("beach-clubs")); bind("shoutoutBtnCard", showShoutoutLanding); bind("minglBtnCard", showMinglLanding);
    bind("backToWelcomeFromProfileBtn", () => showPage("landingPage"));
    bind("backToWelcomeBtn", () => showPage("landingPage"));
    bind("backToCategoriesFromShoutoutLandingBtn", () => showPage("categoryPage"));
    bind("backToCategoriesFromShoutoutLandingBtn2", () => showPage("categoryPage"));
    bind("startShoutoutFlowBtn", () => openCategory("shoutout"));
    bind("backToCategoriesFromMinglBtn", () => showPage("categoryPage"));
    byId("minglSearch")?.addEventListener("input", renderMinglPeople);
    byId("sendMinglMessageBtn")?.addEventListener("click", sendMinglMessage);
    document.addEventListener("click", event => {
      if (event.target.closest(".profile-datapoint")) return;
      document.querySelectorAll(".profile-datapoint[open]").forEach(detail => detail.removeAttribute("open"));
    });
    bind("backFromAdBtn", cancelAdSplash);
    bind("backToCategoriesFromActionsBtn", () => showPage("categoryPage"));
    bind("clubShoutoutBtn", () => openCategoryAfterAd("shoutout"));
    bind("backToCategoriesBtn", () => showPage("categoryPage"));
    bind("backToCategoriesFromActionsBtn", () => showPage("categoryPage"));
    bind("reserveTableBtn", () => openCategoryAfterAd("club-action:reserve-a-table"));
    bind("joinGuestListBtn", () => openCategoryAfterAd("club-action:join-guest-list"));
    bind("payVipEntryBtn", () => openCategoryAfterAd("club-action:pay-vip-entry"));
    bind("payEventEntryBtn", () => openCategoryAfterAd("club-action:pay-event-entry"));
    bind("payStdEntryBtn", () => openCategoryAfterAd("club-action:pay-std-entry")); bind("backToListingBtn", () => showListing()); bind("backToTemplatesBtn", showTemplateSelection); bind("backToEditorFromConfirmBtn", goToEditor); bind("goToEditorBtn", goToEditor); bind("submitShoutoutBtn", submitShoutout); bind("aiSuggestBtn", applyAiSuggestion); bind("pastShoutoutsBtn", loadPastShoutoutsForReuse); bind("startAnotherBtn", startAnother); bind("chooseAnotherClubBtn", () => openCategory("shoutout"));
    bind("userMenuBtn", toggleUserDropdown);
    bind("dropdownSignOutBtn", logout);
    bind("skipAdBtn", skipAdSplash);
    bind("saveProfileBtn", saveProfile);
    byId("templateSearch")?.addEventListener("input", renderTemplates);
    byId("includeAttribution")?.addEventListener("change", syncAttribution);
    byId("attributionChoice")?.addEventListener("change", syncAttribution);
    document.addEventListener("click", closeUserDropdownOnOutsideClick);
    ["mainText","mediaUrl"].forEach(id => byId(id)?.addEventListener("input", updatePreview));
  });

  auth.onAuthStateChanged(user => {
    if (user) setTimeout(() => ensureProfileMenuEnhancements(user), 500);
  });

})();



/* v28.4 override: patron menu + guest-list routing */
(function(){
  function byId(id){ return document.getElementById(id); }
  function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
  function initials(user){
    const n = user?.displayName || user?.email || "Patron";
    return n.split(/[ @._-]+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase() || "P";
  }
  function selectedLocationId(){
    return window.selectedLocationId || window.locationId?.() || new URL(location.href).searchParams.get("location") || new URL(location.href).searchParams.get("club") || "zebbies-garden-washington-dc";
  }
  window.openGuestListForLocation = function(locationId){
    const url = new URL("./guest-list.html", location.href);
    url.searchParams.set("v","28.2");
    url.searchParams.set("location", locationId || selectedLocationId());
    const promoter = new URL(location.href).searchParams.get("promoter");
    if (promoter) url.searchParams.set("promoter", promoter);
    location.href = url.toString();
  };

  async function counts(uid){
    const out = {tm:0, um:0, tc:0, uc:0};
    try{
      const db = firebase.firestore();
      const ms = await db.collection("messages").where("recipientUid","==",uid).limit(1000).get();
      out.tm = ms.size; ms.forEach(d => { if(!d.data().read) out.um++; });
    }catch(e){}
    try{
      const db = firebase.firestore();
      const ns = await db.collection("inboxNotifications").where("recipientUid","==",uid).limit(1000).get();
      out.tm += ns.size; ns.forEach(d => { if(!d.data().read) out.um++; });
    }catch(e){}
    try{
      const db = firebase.firestore();
      const cs = await db.collection("chatRooms").where("participants","array-contains",uid).limit(1000).get();
      out.tc = cs.size; cs.forEach(d => { out.uc += Number((d.data().unreadCounts || {})[uid] || 0); });
    }catch(e){}
    return out;
  }

  async function enhanceMenu(user){
    if(!user) return;
    const menu = byId("userDropdown") || byId("profileMenu") || byId("userMenu") || document.querySelector(".user-dropdown,.profile-menu,.user-menu,.account-menu");
    if(!menu) return;
    const c = await counts(user.uid);
    const photo = user.photoURL ? `<img class="menu-avatar" src="${esc(user.photoURL)}" alt="">` : `<span class="menu-avatar-fallback">${esc(initials(user))}</span>`;
    menu.innerHTML = `
      <div class="menu-user-row">${photo}<div><strong>${esc(user.displayName || user.email || "Patron")}</strong><p>${esc(user.email || user.phoneNumber || "")}</p></div></div>
      <a class="profile-menu-link" href="./patron-portal.html?v=28.39-f">My Profile</a>
      <div class="profile-menu-line">Member Level: Patron</div>
      <a class="profile-menu-link" href="./patron-portal.html?tab=messages&v=28.39-f">Messages (${c.um}/${c.tm})</a>
      <a class="profile-menu-link" href="./patron-portal.html?tab=chats&v=28.39-f">Mingl (${c.uc}/${c.tc})</a>
      <button class="ghost full" type="button" data-patron-logout="1">Sign out</button>`;
  }

  document.addEventListener("click", function(e){
    if(e.target.closest("[data-patron-logout]")){
      e.preventDefault();
      e.stopPropagation();
      if(window.jadzPatronLogout) window.jadzPatronLogout();
      else if(window.firebase && firebase.auth) firebase.auth().signOut().then(()=>{location.href="./";});
      return;
    }
    const el = e.target.closest("button,a,[role='button']");
    if(!el) return;
    const text = String(el.textContent || el.getAttribute("aria-label") || "").toLowerCase();
    if(text.includes("guest list") || text.includes("join guest")){
      window.__jadzActionMode = "guest-list";
    }
    if(window.__jadzActionMode === "guest-list" && text.trim() === "continue"){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      window.openGuestListForLocation();
    }
  }, true);

  const waitAuth = setInterval(function(){
    try{
      if(window.firebase && firebase.auth){
        clearInterval(waitAuth);
        firebase.auth().onAuthStateChanged(user => {
          if(user) setTimeout(() => enhanceMenu(user), 350);
        });
      }
    }catch(e){}
  }, 250);
})();

/* v28.4 override: club service isolation + inbox notification */
(function(){
function qs(n){return new URL(location.href).searchParams.get(n)||"";}
function currentLoc(){return window.selectedLocationId||window.locationId?.()||qs("location")||qs("club")||"zebbies-garden-washington-dc";}
window.getEnabledServicesForLocation=function(id){return (window.SHOUTOUT_LOCATION_SERVICES||{})[id]||window.SHOUTOUT_DEFAULT_LOCATION_SERVICES||["shoutout","guestList"];};
window.openServiceForLocation=function(service,id){id=id||currentLoc();if(service==="guestList"){let u=new URL("./guest-list.html",location.href);u.searchParams.set("location",id);u.searchParams.set("v","28.3");let pr=qs("promoter");if(pr)u.searchParams.set("promoter",pr);location.href=u.toString();return;} if(service!=="shoutout"){alert(((window.SHOUTOUT_SERVICE_LABELS||{})[service]||service)+" is not yet enabled in this demo workflow.");}};
async function note(payload){try{let u=firebase.auth().currentUser;if(!u)return;await firebase.firestore().collection("inboxNotifications").add({recipientUid:u.uid,recipientEmail:u.email||"",read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp(),...payload});}catch(e){}}
window.createShoutOutSubmissionNotification=async function(s){const link=s.modifyLink||`./patron-portal.html?tab=shoutouts&ref=${encodeURIComponent(s.referenceNumber||"")}&v=28.39-f`;await note({type:"shoutoutSubmitted",title:"ShoutOut Submitted",body:`Your ShoutOut was submitted for ${s.locationName||s.clubName||s.clubLocationId||"the selected venue"}.\n\nModify ShoutOut: ${link}`,referenceNumber:s.referenceNumber||"",shoutoutId:s.shoutoutId||"",clubLocationId:s.clubLocationId||s.location||currentLoc(),status:s.status||"pending",link});};
document.addEventListener("click",function(e){let b=e.target.closest("[data-service]");if(b){e.preventDefault();e.stopPropagation();window.openServiceForLocation(b.dataset.service,currentLoc());return;}let el=e.target.closest("button,a,[role='button']");if(!el)return;let t=String(el.textContent||el.getAttribute("aria-label")||"").toLowerCase();if(t.includes("guest list")||t.includes("join guest"))window.__jadzActionMode="guest-list";if(window.__jadzActionMode==="guest-list"&&t.trim()==="continue"){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();window.openServiceForLocation("guestList",currentLoc());}},true);
})();

/* v28.5 media upload templates override */
(function(){
"use strict";
function byId(id){return document.getElementById(id);}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function templateAllowsMedia(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};return !!(t.supportsMedia||t.supportsImage||t.supportsVideo);}
function templateAcceptsMedia(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};if(t.supportsVideo||t.supportsMedia)return "image/*,video/mp4,video/quicktime,video/webm";if(t.supportsImage)return "image/*";return "";}
function templateUploadLabel(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};return (t.supportsVideo||t.supportsMedia)?"Upload Image or Video":"Upload Image";}
function editorHost(){return byId("editorPage")||byId("screenEditor")||document.querySelector("#editor,.editor-page,[data-screen='editor']");}
function templateHost(){return byId("templateList")||byId("templatesList")||document.querySelector(".template-list");}
function ensureMediaEditor(){
 const host=editorHost(); if(!host||byId("shoutoutMediaUpload")||!templateAllowsMedia())return;
 const box=document.createElement("div"); box.className="card media-upload-card"; box.innerHTML=`<h2>Media Upload</h2><p class="sub small">Add media only when this template supports it.</p><label>${templateUploadLabel()}<input id="shoutoutMediaUpload" type="file" accept="${templateAcceptsMedia()}"></label><div id="shoutoutMediaPreview" class="media-preview-box hidden"></div><input id="shoutoutMediaUrl" type="hidden"><input id="shoutoutMediaType" type="hidden">`; host.appendChild(box);
 byId("shoutoutMediaUpload").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0],prev=byId("shoutoutMediaPreview"); if(!f||!prev)return; const url=URL.createObjectURL(f); const isV=f.type.startsWith("video/"); prev.classList.remove("hidden"); prev.innerHTML=isV?`<video src="${url}" controls playsinline muted loop></video><p>${esc(f.name)}</p>`:`<img src="${url}" alt=""><p>${esc(f.name)}</p>`;});
}
async function uploadSelectedMedia(referenceNumber){
 const input=byId("shoutoutMediaUpload"), file=input&&input.files&&input.files[0]; if(!file)return {mediaUrl:"",mediaType:""};
 if(!firebase.storage){alert("Firebase Storage SDK is not loaded.");return {mediaUrl:"",mediaType:""};}
 const user=firebase.auth().currentUser; if(!user)throw new Error("Sign in first.");
 const safeName=((referenceNumber||Date.now())+"-"+file.name).replace(/[^a-zA-Z0-9._-]/g,"_");
 const storagePath=`shoutouts/${user.uid}/${safeName}`;
 const ref=firebase.storage().ref().child(storagePath);
 await ref.put(file,{contentType:file.type}); const mediaUrl=await ref.getDownloadURL(); const mediaType=file.type.startsWith("video/")?"video":"image";
 byId("shoutoutMediaUrl").value=mediaUrl; byId("shoutoutMediaType").value=mediaType; return {mediaUrl,mediaType,mediaFileName:file.name,mediaStoragePath:storagePath,mediaUploadedAt:firebase.firestore.FieldValue.serverTimestamp()};
}
function ensureTemplates(){
 const host=templateHost(); if(!host||host.dataset.v285==="1")return; host.dataset.v285="1";
 const lib=window.SHOUTOUT_MEDIA_TEMPLATE_LIBRARY||{};
 const wrap=document.createElement("div"); wrap.className="media-template-grid";
 wrap.innerHTML=Object.values(lib).map(t=>`<button class="media-template-card" data-template-id="${esc(t.id)}" type="button"><div class="template-preview-board tpl-${esc(t.previewStyle)}">${t.supportsVideo?'<div class="video-placeholder">VIDEO</div>':''}${t.supportsImage?'<div class="photo-placeholder">PHOTO</div>':''}<div><strong>${esc(t.mainText||t.name)}</strong><span>${esc(t.subText||t.category)}</span></div></div><h3>${esc(t.name)}</h3><p class="sub small">${esc(t.description||"")}</p></button>`).join("");
 host.prepend(wrap);
 wrap.addEventListener("click",e=>{const c=e.target.closest("[data-template-id]"); if(!c)return; wrap.querySelectorAll(".selected").forEach(x=>x.classList.remove("selected")); c.classList.add("selected"); window.selectedTemplate=c.dataset.templateId;});
}
function ensureSuggestions(){
 const host=editorHost(); if(!host||byId("aiSuggestionsBox"))return;
 const box=document.createElement("div"); box.id="aiSuggestionsBox"; box.className="card"; box.innerHTML=`<h2>ShoutOut Recommendations</h2><p class="sub small">Demo suggestions. Full AI backend comes later.</p><div id="aiSuggestionList"></div>`; host.appendChild(box);
 const samples=["Happy Birthday! VIP energy all night.","Big ShoutOut to the table making the night unforgettable.","Bottle service vibes. Celebrate loud.","Tonight belongs to the birthday star.","Luxury entrance. Big celebration. Bigger memories."];
 byId("aiSuggestionList").innerHTML=samples.map(s=>`<button type="button" class="ghost ai-suggestion">${esc(s)}</button>`).join("");
 byId("aiSuggestionList").onclick=e=>{const b=e.target.closest(".ai-suggestion"); if(!b)return; const inp=byId("mainText")||byId("shoutoutText")||document.querySelector("textarea"); if(inp)inp.value=b.textContent;};
}
window.jadzUploadSelectedShoutoutMedia=uploadSelectedMedia;
document.addEventListener("DOMContentLoaded",()=>{setTimeout(()=>{ensureTemplates();ensureMediaEditor();ensureSuggestions();},1000);setInterval(()=>{ensureTemplates();ensureMediaEditor();ensureSuggestions();},2500);});
})();


/* v28.6 single media input and live preview fix */
(function(){
  "use strict";
function byId(id){return document.getElementById(id);}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  function templateAllowsMedia(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};return !!(t.supportsMedia||t.supportsImage||t.supportsVideo);}
  function templateAcceptsMedia(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};if(t.supportsVideo||t.supportsMedia)return "image/*,video/mp4,video/quicktime,video/webm";if(t.supportsImage)return "image/*";return "";}
  function templateUploadLabel(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};return (t.supportsVideo||t.supportsMedia)?"Upload Image or Video":"Upload Image";}
  function findTextInput(){return byId("mainText")||byId("shoutoutText")||byId("messageText")||document.querySelector("textarea[name='mainText']")||document.querySelector("textarea")||document.querySelector("input[name='mainText']");}
  function findSubTextInput(){return byId("subText")||byId("shoutoutSubText")||document.querySelector("input[name='subText']")||document.querySelector("textarea[name='subText']");}
  function findEditor(){return byId("editorPage")||byId("screenEditor")||document.querySelector("#editor,.editor-page,[data-screen='editor']");}
  function removeDuplicateMediaInputs(){
    const fileInputs=Array.from(document.querySelectorAll("input[type='file']")).filter(i=>/image|photo|video|media|upload/i.test(((i.closest("label")||{}).textContent||"")+" "+(i.id||"")+" "+(i.name||"")));
    if(fileInputs.length<=1)return;
    let keep=byId("shoutoutMediaUpload")||fileInputs[0];
    keep.id="shoutoutMediaUpload";
    keep.accept="image/*,video/mp4,video/quicktime,video/webm";
    fileInputs.forEach(input=>{if(input!==keep){const wrap=input.closest("label")||input.parentElement;if(wrap)wrap.style.display="none";}});
  }
  function ensureSingleMediaUploader(){
    const editor=findEditor(); if(!editor)return;
    if(!templateAllowsMedia()){removeDuplicateMediaInputs();return;}
    removeDuplicateMediaInputs();
    let input=byId("shoutoutMediaUpload");
    if(!input){
      const card=document.createElement("div");
      card.className="card media-upload-card";
      card.innerHTML=`<h2>Media Upload</h2><p class="single-media-upload-note">Add media only when this template supports it.</p><label>${templateUploadLabel()}<input id="shoutoutMediaUpload" type="file" accept="${templateAcceptsMedia()}"></label><div id="shoutoutMediaPreview" class="media-preview-box hidden"></div><input id="shoutoutMediaUrl" type="hidden"><input id="shoutoutMediaType" type="hidden">`;
      editor.appendChild(card);
      input=byId("shoutoutMediaUpload");
    }
    input.accept=templateAcceptsMedia();
    input.onchange=renderLiveMediaPreview;
  }
  function getCurrentText(){
    const main=findTextInput(), sub=findSubTextInput();
    return {mainText:main?main.value.trim():"", subText:sub?sub.value.trim():""};
  }
  function renderLiveMediaPreview(){
    const input=byId("shoutoutMediaUpload");
    const file=input&&input.files&&input.files[0];
    const preview=byId("shoutoutMediaPreview")||byId("liveShoutoutPreview");
    if(!file||!preview)return;
    const url=URL.createObjectURL(file);
    const isVideo=file.type.startsWith("video/");
    const text=getCurrentText();
    preview.classList.remove("hidden");
    preview.innerHTML=`<div class="media-preview-stage">${isVideo?`<video src="${url}" autoplay muted loop playsinline controls></video>`:`<img src="${url}" alt="">`}<div class="media-preview-overlay"><strong>${esc(text.mainText||"YOUR SHOUTOUT")}</strong><span>${esc(text.subText||"LIVE ON THE DISPLAY")}</span></div></div><p class="sub small">${esc(file.name)} • ${isVideo?"Video":"Image"} preview</p>`;
  }
  function refreshPreviewText(){
    const preview=byId("shoutoutMediaPreview")||byId("liveShoutoutPreview");
    if(!preview||preview.classList.contains("hidden"))return;
    const text=getCurrentText();
    const strong=preview.querySelector(".media-preview-overlay strong");
    const span=preview.querySelector(".media-preview-overlay span");
    if(strong)strong.textContent=text.mainText||"YOUR SHOUTOUT";
    if(span)span.textContent=text.subText||"LIVE ON THE DISPLAY";
  }
  function patchAISuggestionButtons(){
    document.addEventListener("click",function(e){
      const btn=e.target.closest(".ai-suggestion,[data-ai-suggestion]");
      if(!btn)return;
      const input=findTextInput();
      if(input){
        input.value=btn.textContent.trim();
        input.dispatchEvent(new Event("input",{bubbles:true}));
        input.dispatchEvent(new Event("change",{bubbles:true}));
        refreshPreviewText();
      }
    },true);
  }
  function bindTextPreviewRefresh(){
    const main=findTextInput(), sub=findSubTextInput();
    if(main&&!main.dataset.v286Bound){main.dataset.v286Bound="1";main.addEventListener("input",refreshPreviewText);main.addEventListener("change",refreshPreviewText);}
    if(sub&&!sub.dataset.v286Bound){sub.dataset.v286Bound="1";sub.addEventListener("input",refreshPreviewText);sub.addEventListener("change",refreshPreviewText);}
  }
  async function uploadSingleSelectedMedia(referenceNumber){
    if(!templateAllowsMedia())return {mediaUrl:"",mediaType:""};
    const input=byId("shoutoutMediaUpload");
    const file=input&&input.files&&input.files[0];
    if(!file)return {mediaUrl:"",mediaType:""};
    if(!firebase.storage){alert("Firebase Storage SDK is not loaded.");return {mediaUrl:"",mediaType:""};}
    const user=firebase.auth().currentUser;
    if(!user)throw new Error("Please sign in before uploading media.");
    const safeName=((referenceNumber||Date.now())+"-"+file.name).replace(/[^a-zA-Z0-9._-]/g,"_");
    const storagePath=`shoutouts/${user.uid}/${safeName}`;
    const ref=firebase.storage().ref().child(storagePath);
    await ref.put(file,{contentType:file.type});
    const mediaUrl=await ref.getDownloadURL();
    const mediaType=file.type.startsWith("video/")?"video":"image";
    const mediaUrlInput=byId("shoutoutMediaUrl"), mediaTypeInput=byId("shoutoutMediaType");
    if(mediaUrlInput)mediaUrlInput.value=mediaUrl;
    if(mediaTypeInput)mediaTypeInput.value=mediaType;
    return {mediaUrl,mediaType,mediaFileName:file.name,mediaStoragePath:storagePath,mediaUploadedAt:firebase.firestore.FieldValue.serverTimestamp()};
  }
  window.jadzUploadSelectedShoutoutMedia=uploadSingleSelectedMedia;
  window.jadzRefreshShoutoutMediaPreview=refreshPreviewText;
  document.addEventListener("DOMContentLoaded",()=>{
    patchAISuggestionButtons();
    setInterval(()=>{ensureSingleMediaUploader();bindTextPreviewRefresh();removeDuplicateMediaInputs();},1000);
  });
})();
