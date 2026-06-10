/* patron-app.js v19 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const setStatus = value => setText("authStatus", value);
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const unique = items => [...new Set(items.filter(Boolean))].sort();

  if (!window.firebaseConfig) { setStatus("firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  let currentUser = null;
  let selectedLocationId = null;
  let selectedTemplate = "neon";
  let confirmationResult = null;
  let locations = {};
  let templates = {};
  let events = {};
  let pendingDirectLocation = qs("location", qs("club", ""));

  function locationId() { return (selectedLocationId || pendingDirectLocation || "zebbies-garden-washington-dc").toLowerCase(); }
  function getLocation(id = locationId()) { return locations[id] || window.SHOUTOUT_CLUB_LOCATIONS[id] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"]; }
  function getTemplate(id = selectedTemplate) { return templates[id] || window.SHOUTOUT_TEMPLATES[id] || window.SHOUTOUT_TEMPLATES.neon; }
  function safeUser() { return (currentUser?.email || currentUser?.phoneNumber || "unknown").toLowerCase(); }
  function showPage(id) { document.querySelectorAll(".page").forEach(p => p.classList.remove("active")); byId(id)?.classList.add("active"); }
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
    "lounge-club": { title: "Gran Coramino Tequila", body: "A smooth premium tequila experience associated with Kevin Hart. Perfect for a Lounge-Club moment.", badge: "Sponsored Lounge-Club Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2362eaff%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EGRAN%20CORAMINO%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3ETEQUILA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "clubs": { title: "Gucci Fragrances", body: "Luxury fragrance energy for a night out. Own the room before the first song drops.", badge: "Sponsored Club Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ffd45a%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23ff64d8%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ffd45a%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EGUCCI%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EFRAGRANCES%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "events": { title: "Nike Air Max", body: "Step into the night with Nike energy. Built for movement, style, and the next event.", badge: "Sponsored Event Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%2362eaff%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3ENIKE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EAIR%20MAX%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "lounges": { title: "Teremana Tequila", body: "Dwayne Johnson's tequila brand brings a premium toast to the lounge experience.", badge: "Sponsored Lounge Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23dfff5a%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2362eaff%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3ETEREMANA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3ETEQUILA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "beach-clubs": { title: "Advertise Here", body: "Beach club audiences are premium, social, and ready to discover your brand.", badge: "Beach Club Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "shoutout": { title: "Advertise Here", body: "Put your brand in front of patrons right before they create a live LED ShoutOut.", badge: "ShoutOut Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "default": { title: "Advertise Here", body: "Your brand can own this moment before patrons browse nightlife.", badge: "Jadz AdCo Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" }
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
      adImageSlot.innerHTML = `<img src="${ad.image || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E'}" alt="${ad.title} advertisement">`;
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
      return doc.exists ? doc.data() : null;
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
        favoriteGenres: splitCSV(byId("profileGenres").value),
        nightlifeInterests: splitCSV(byId("profileInterests").value),
        instagramHandle: byId("profileInstagram").value.trim(),
        xHandle: byId("profileX").value.trim(),
        analyticsConsent: byId("profileAnalyticsConsent").checked,
        marketingConsent: byId("profileMarketingConsent").checked,
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

  async function loginGoogle() { try { setStatus("Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); } }
  async function loginFacebook() { try { setStatus("Opening Facebook sign-in..."); await auth.signInWithPopup(new firebase.auth.FacebookAuthProvider()); } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); } }
  async function loginMicrosoft() { try { const p = new firebase.auth.OAuthProvider("microsoft.com"); p.setCustomParameters({prompt:"select_account"}); setStatus("Opening Microsoft sign-in..."); await auth.signInWithPopup(p); } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); } }
  async function logout() { await auth.signOut(); window.location.href = "./"; }

  function setupPhoneAuth() { if (!byId("recaptcha-container") || window.recaptchaVerifier) return; window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {size:"normal"}); }
  async function sendPhoneCode() {
    try {
      setupPhoneAuth();
      const phone = byId("phoneNumber").value.trim();
      if (!phone.startsWith("+")) { setStatus("Use international format, for example +12025550123."); return; }
      confirmationResult = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
      byId("phoneCodeBlock")?.classList.remove("hidden");
      setStatus("Code sent. Enter it below.");
    } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); }
  }
  async function verifyPhoneCode() { try { if (!confirmationResult) { setStatus("Send the OTP first."); return; } await confirmationResult.confirm(byId("phoneCode").value.trim()); } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); } }

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
      "Search by country, state/region/province, city, genre, artist, event day, or activity time.";
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

  function renderEventGrid() {
    const grid = byId("locationGrid");
    const s = (byId("locationSearch")?.value || "").toLowerCase();
    const country = byId("countryFilter")?.value || "", region = byId("regionFilter")?.value || "", city = byId("cityFilter")?.value || "", genre = byId("genreFilter")?.value || "";
    const matches = Object.entries(events).filter(([id,e]) => {
      const hay = `${e.eventName} ${e.country} ${e.region} ${e.city} ${(e.genres||[]).join(" ")} ${(e.artists||[]).join(" ")} ${e.eventDay} ${e.eventTime} ${e.eventDate}`.toLowerCase();
      return (!s || hay.includes(s)) && (!country || e.country === country) && (!region || e.region === region) && (!city || e.city === city) && (!genre || (e.genres||[]).includes(genre));
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
    const s = (byId("locationSearch")?.value || "").toLowerCase();
    const country = byId("countryFilter")?.value || "", region = byId("regionFilter")?.value || "", city = byId("cityFilter")?.value || "", genre = byId("genreFilter")?.value || "";
    const matches = Object.entries(locations).filter(([id,l]) => {
      const hay = `${l.brandName} ${l.locationName} ${l.country} ${l.region} ${l.city} ${l.locationLabel} ${(l.genres||[]).join(" ")} ${(l.artists||[]).join(" ")} ${(l.activityDates||[]).join(" ")}`.toLowerCase();
      const actionBase = byId("clubActionsPage")?.getAttribute("data-category-type") || "clubs";
      const effectiveType = type.startsWith("club-action:") ? actionBase : type;
      const typeOk =
        effectiveType === "lounges" ? (l.type === "lounge" || (l.categories||[]).includes("Lounges")) :
        effectiveType === "lounge-club" ? (l.type === "lounge-club" || (l.categories||[]).includes("Lounge-Club")) :
        effectiveType === "beach-clubs" ? (l.type === "beach-club" || (l.categories||[]).includes("Beach Clubs")) :
        effectiveType === "clubs" || effectiveType === "shoutout" ? (l.type === "club" || l.type === "lounge-club" || l.type === "beach-club" || (l.categories||[]).includes("Clubs")) :
        true;
      return typeOk && (!s || hay.includes(s)) && (!country || l.country === country) && (!region || l.region === region) && (!city || l.city === city) && (!genre || (l.genres||[]).includes(genre));
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
    selectedTemplate = (loc.templates && loc.templates[0]) || "neon";
    renderTemplates(); updateTemplateSummary(); showPage("templateSelectPage");
  }
  function showTemplateSelection(){ renderTemplates(); updateTemplateSummary(); showPage("templateSelectPage"); }
  function renderTemplates() {
    const grid = byId("templateGrid"); if (!grid) return; grid.innerHTML = "";
    (getLocation().templates || ["neon"]).forEach(id => {
      const t = getTemplate(id), item = document.createElement("div");
      item.className = `template ${t.className || "neon"} ${t.id === selectedTemplate ? "selected" : ""}`;
      item.innerHTML = `<div class="name">${esc(t.name)}</div><div class="tag">${esc(t.scope || "Shared")} template</div>`;
      item.addEventListener("click", () => { selectedTemplate = t.id; renderTemplates(); updateTemplateSummary(); });
      grid.appendChild(item);
    });
  }
  function updateTemplateSummary() { const t = getTemplate(); byId("selectedTemplateSummary").innerHTML = `<h3>${esc(t.name)}</h3><p>${esc(t.scope || "Shared")} template selected.</p>`; }
  function displayUrl(payload, id=locationId()) {
    const url = new URL("./display.html", window.location.href);
    url.searchParams.set("location", id);
    if(payload){ url.searchParams.set("main",payload.mainText||""); url.searchParams.set("sub",payload.subText||""); url.searchParams.set("template",payload.template||"neon"); url.searchParams.set("media",payload.mediaUrl||""); }
    return url.href;
  }
  function goToEditor() { const l=getLocation(), t=getTemplate(); setText("editorClubTitle", l.locationName); setText("editorTemplateMeta", `${l.locationLabel} • Template: ${t.name}`); updatePreview(); showPage("editorPage"); }
  function updatePreview() {
    const frame=byId("previewFrame");
    if(frame) frame.src=displayUrl({mainText:byId("mainText")?.value.trim()||"SHOUTOUT!", subText:byId("subText")?.value.trim()||"", mediaUrl:byId("mediaUrl")?.value.trim()||"", template:selectedTemplate}, locationId());
  }
  async function submitShoutout() {
    const status=byId("submitStatus");
    try {
      if(!currentUser){ status.textContent="Sign in first."; return; }
      if(!selectedLocationId){ status.textContent="Select a location first."; return; }
      const l=getLocation(), t=getTemplate();
      const payload={ location:locationId(), club:locationId(), clubLocationId:locationId(), brandName:l.brandName, locationName:l.locationName, clubName:l.locationName, country:l.country, region:l.region, city:l.city, locationLabel:l.locationLabel, template:selectedTemplate, templateName:t.name, mainText:byId("mainText").value.trim()||"SHOUTOUT!", subText:byId("subText").value.trim()||"", mediaUrl:byId("mediaUrl").value.trim(), status:"pending", submittedBy:safeUser(), submittedAt:firebase.firestore.FieldValue.serverTimestamp(), referenceNumber:`SO-${Date.now().toString().slice(-7)}` };
      await db.collection("shoutouts").add(payload);
      setText("confirmRef",payload.referenceNumber); setText("confirmClub",l.locationName); setText("confirmTemplate",t.name); showPage("confirmationPage");
    } catch(e) { status.textContent=e.message; }
  }
  function startAnother(){ byId("mainText").value="HAPPY BIRTHDAY MAYA!"; byId("subText").value="VIP Table 4 sends love"; byId("mediaUrl").value=""; showTemplateSelection(); }

  document.addEventListener("DOMContentLoaded", function(){
    setStatus("Choose a sign-in/up option.");
    auth.onAuthStateChanged(async user => { currentUser=user; updateLoginUI(user); if(user) await afterLogin(); });
    bind("googleLoginBtn", loginGoogle); bind("facebookLoginBtn", loginFacebook); bind("microsoftLoginBtn", loginMicrosoft); bind("sendOtpBtn", sendPhoneCode); bind("verifyOtpBtn", verifyPhoneCode); bind("continueBtn", afterLogin);
    ["logoutBtn1","logoutBtn2","logoutBtn3","logoutBtn4","logoutBtn5","logoutBtn6","logoutBtnClubActions"].forEach(id => bind(id, logout));
    bind("eventsBtn", () => openCategory("events")); bind("clubsBtn", () => openCategory("clubs")); bind("loungesBtn", () => openCategory("lounges")); bind("loungeClubBtn", () => openCategory("lounge-club")); bind("beachClubsBtn", () => openCategory("beach-clubs")); bind("shoutoutBtn", () => openCategory("shoutout"));
    bind("eventsBtnCard", () => openCategory("events")); bind("clubsBtnCard", () => openCategory("clubs")); bind("loungesBtnCard", () => openCategory("lounges")); bind("loungeClubBtnCard", () => openCategory("lounge-club")); bind("beachClubsBtnCard", () => openCategory("beach-clubs")); bind("shoutoutBtnCard", () => openCategory("shoutout"));
    bind("backToCategoriesFromActionsBtn", () => showPage("categoryPage"));
    bind("reserveTableBtn", () => openCategory("club-action:reserve-a-table"));
    bind("joinGuestListBtn", () => openCategory("club-action:join-guest-list"));
    bind("payVipEntryBtn", () => openCategory("club-action:pay-vip-entry"));
    bind("payEventEntryBtn", () => openCategory("club-action:pay-event-entry"));
    bind("payStdEntryBtn", () => openCategory("club-action:pay-std-entry"));
    bind("backToCategoriesBtn", () => showPage("categoryPage"));
    bind("backToCategoriesFromActionsBtn", () => showPage("categoryPage"));
    bind("reserveTableBtn", () => openCategoryAfterAd("club-action:reserve-a-table"));
    bind("joinGuestListBtn", () => openCategoryAfterAd("club-action:join-guest-list"));
    bind("payVipEntryBtn", () => openCategoryAfterAd("club-action:pay-vip-entry"));
    bind("payEventEntryBtn", () => openCategoryAfterAd("club-action:pay-event-entry"));
    bind("payStdEntryBtn", () => openCategoryAfterAd("club-action:pay-std-entry")); bind("backToListingBtn", () => showListing()); bind("backToTemplatesBtn", showTemplateSelection); bind("goToEditorBtn", goToEditor); bind("submitShoutoutBtn", submitShoutout); bind("startAnotherBtn", startAnother); bind("chooseAnotherClubBtn", () => openCategory("shoutout"));
    bind("userMenuBtn", toggleUserDropdown);
    bind("dropdownSignOutBtn", logout);
    bind("skipAdBtn", skipAdSplash);
    bind("saveProfileBtn", saveProfile);
    document.addEventListener("click", closeUserDropdownOnOutsideClick);
    ["mainText","subText","mediaUrl"].forEach(id => byId(id)?.addEventListener("input", updatePreview));
  });
})();
