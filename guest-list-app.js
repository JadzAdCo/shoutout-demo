/* guest-list-app.js v28 - Guest list intake with legal names and invitees */
(function(){
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const qs = name => new URL(window.location.href).searchParams.get(name);

  if (!window.firebaseConfig) { setText("guestStatus", "firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  const locations = window.SHOUTOUT_CLUB_LOCATIONS || {};
  const promoters = window.SHOUTOUT_PROMOTERS || {};
  let friendOptions = [];

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }
  async function loginGoogle() {
    try { setText("guestStatus", "Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch(e) { setText("guestStatus", `${e.code || "error"}: ${e.message}`); }
  }
  async function logout() { await auth.signOut(); window.location.reload(); }

  function parseName(displayName) {
    const parts = String(displayName || "").trim().split(/\s+/).filter(Boolean);
    return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") || "" };
  }

  function renderSelects() {
    const requestedLocation = qs("location") || "";
    const requestedPromoter = qs("promoter") || "";
    byId("guestLocation").innerHTML = `<option value="">Select club/location</option>` +
      Object.entries(locations).map(([id, loc]) => `<option value="${esc(id)}">${esc(loc.locationName || loc.name || id)}</option>`).join("");
    if (requestedLocation && locations[requestedLocation]) byId("guestLocation").value = requestedLocation;
    byId("guestPromoter").innerHTML = `<option value="">Select promoter/promoting group</option>` +
      Object.entries(promoters).filter(([id,p]) => p.active !== false).map(([id,p]) =>
        `<option value="${esc(id)}">${esc(p.promoterGroup || p.name || id)}</option>`).join("");
  }

  function updatePartySize() {
    const count = 1 + document.querySelectorAll(".invitee-row").length;
    byId("guestPartySize").value = count;
  }

  function addInviteeRow(firstName="", lastName="", uid="") {
    const wrap = byId("additionalGuestsList");
    const row = document.createElement("div");
    row.className = "invitee-row profile-grid";
    row.innerHTML = `
      <label>Invitee First Name *<input class="invitee-first" value="${esc(firstName)}" placeholder="First name as shown on ID"/></label>
      <label>Invitee Last Name *<input class="invitee-last" value="${esc(lastName)}" placeholder="Last name as shown on ID"/></label>
      <input class="invitee-uid" type="hidden" value="${esc(uid)}"/>
      <button class="removeInviteeBtn ghost" type="button">Remove</button>`;
    row.querySelector(".removeInviteeBtn").addEventListener("click", () => { row.remove(); updatePartySize(); });
    wrap.appendChild(row);
    updatePartySize();
  }

  async function loadFriendOptions() {
    friendOptions = [];
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snap = await db.collection("friendships").where("memberUids", "array-contains", user.uid).limit(100).get();
      snap.forEach(doc => {
        const f = doc.data();
        const friend = (f.members || []).find(m => m.uid !== user.uid);
        if (friend) friendOptions.push(friend);
      });
    } catch(e) {
      console.warn("Could not load friends yet:", e.message);
    }
    const picker = byId("friendPicker");
    picker.innerHTML = `<option value="">Select an accepted app friend</option>` +
      friendOptions.map((f,idx) => `<option value="${idx}">${esc(f.fullName || f.displayName || f.email || f.uid)}</option>`).join("");
  }

  function addFriendGuest() {
    const wrap = byId("friendPickerWrap");
    wrap.classList.remove("hidden");
    const idx = byId("friendPicker").value;
    if (idx === "") return setText("guestStatus", "Select a friend, then click Add Friend From App again.");
    const f = friendOptions[Number(idx)];
    if (!f) return;
    const parsed = parseName(f.fullName || f.displayName || "");
    addInviteeRow(f.firstName || parsed.firstName, f.lastName || parsed.lastName, f.uid || "");
    byId("friendPicker").value = "";
    setText("guestStatus", "Friend added to guest list.");
  }

  async function loadUserProfile(user) {
    let profile = null;
    try {
      const doc = await db.collection("users").doc(user.uid).get();
      if (doc.exists) profile = doc.data();
    } catch(e) { console.warn("Could not read user profile:", e.message); }

    const parsed = parseName(user.displayName || "");
    if (!byId("guestFirstName").value) byId("guestFirstName").value = profile?.firstName || parsed.firstName || "";
    if (!byId("guestLastName").value) byId("guestLastName").value = profile?.lastName || parsed.lastName || "";
    if (user.email && !byId("guestEmail").value) byId("guestEmail").value = user.email;
  }

  function collectInvitees() {
    return Array.from(document.querySelectorAll(".invitee-row")).map(row => {
      const firstName = row.querySelector(".invitee-first").value.trim();
      const lastName = row.querySelector(".invitee-last").value.trim();
      const uid = row.querySelector(".invitee-uid").value.trim();
      return { firstName, lastName, fullName: `${firstName} ${lastName}`.trim(), uid, source: uid ? "friend" : "manual" };
    });
  }

  async function submitGuestList() {
    try {
      const user = auth.currentUser;
      if (!user) return setText("guestStatus", "Please sign in first.");
      const locationId = byId("guestLocation").value;
      const eventOrDay = byId("guestEventOrDay").value;
      const promoterId = byId("guestPromoter").value;
      const firstName = byId("guestFirstName").value.trim();
      const lastName = byId("guestLastName").value.trim();
      const invitees = collectInvitees();
      const partySize = 1 + invitees.length;
      if (!locationId) return setText("guestStatus", "Please select a club/location.");
      if (!eventOrDay) return setText("guestStatus", "Please select an event or day.");
      if (!promoterId) return setText("guestStatus", "Promoter / promoting group is required.");
      if (!firstName || !lastName) return setText("guestStatus", "First Name and Last Name are required and must match your ID.");
      if (invitees.some(g => !g.firstName || !g.lastName)) return setText("guestStatus", "Every invitee must have First Name and Last Name.");
      if (!byId("legalNameConfirm").checked) return setText("guestStatus", "Please confirm all names match government-issued IDs.");

      const loc = locations[locationId] || {};
      const promoter = promoters[promoterId] || {};
      const primaryGuest = { firstName, lastName, fullName: `${firstName} ${lastName}`.trim(), uid: user.uid, source: "profile" };
      const doc = {
        type: "guestList",
        status: "pending",
        clubLocationId: locationId,
        locationName: loc.locationName || loc.name || locationId,
        eventOrDay,
        promoterId,
        promoterName: promoter.promoterGroup || promoter.name || promoterId,
        primaryGuest,
        additionalGuests: invitees,
        guestName: primaryGuest.fullName,
        firstName,
        lastName,
        fullName: primaryGuest.fullName,
        guestPhone: byId("guestPhone").value.trim(),
        guestEmail: byId("guestEmail").value.trim() || user.email || "",
        partySize,
        totalGuestCount: partySize,
        legalNameConfirmed: true,
        notes: byId("guestNotes").value.trim(),
        submittedByUid: user.uid,
        submittedByEmail: user.email || "",
        submittedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      const ref = await db.collection("guestListRequests").add(doc);
      await db.collection("users").doc(user.uid).set({ firstName, lastName, fullName: primaryGuest.fullName, legalNameUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });

      byId("guestFormCard").classList.add("hidden");
      byId("guestReceipt").classList.remove("hidden");
      byId("guestReceiptBody").innerHTML = `<div class="report-table">
        <div><span>Reference</span><strong>${esc(ref.id)}</strong></div>
        <div><span>Club</span><strong>${esc(doc.locationName)}</strong></div>
        <div><span>Event / Day</span><strong>${esc(doc.eventOrDay)}</strong></div>
        <div><span>Promoter</span><strong>${esc(doc.promoterName)}</strong></div>
        <div><span>Primary Guest</span><strong>${esc(doc.fullName)}</strong></div>
        <div><span>Additional Invitees</span><strong>${esc(invitees.map(g => g.fullName).join(", ") || "None")}</strong></div>
        <div><span>Party Size</span><strong>${esc(doc.partySize)}</strong></div>
        <div><span>Status</span><strong>Pending</strong></div>
      </div>`;
      setText("guestStatus", "Guest list request submitted.");
    } catch(e) { console.error(e); setText("guestStatus", `${e.code || "error"}: ${e.message}`); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderSelects();
    bind("guestGoogleLoginBtn", loginGoogle);
    bind("guestLogoutBtn", logout);
    bind("submitGuestListBtn", submitGuestList);
    bind("addManualGuestBtn", () => addInviteeRow());
    bind("addFriendGuestBtn", addFriendGuest);
    updatePartySize();
    auth.onAuthStateChanged(async user => {
      setText("guestSignedInAs", user ? `Signed in as ${user.displayName || user.email || user.uid}` : "Not signed in");
      if (!user) {
        byId("guestLogin").classList.remove("hidden");
        byId("guestFormCard").classList.add("hidden");
        setText("guestStatus", "Please sign in to continue.");
      } else {
        byId("guestLogin").classList.add("hidden");
        byId("guestFormCard").classList.remove("hidden");
        setText("guestStatus", "Guest list app loaded.");
        await loadUserProfile(user);
        await loadFriendOptions();
      }
    });
  });
})();
