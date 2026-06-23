/* role-request-app.js v28.13 */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const valueOf = id => (byId(id)?.value || "").trim();

  if (!window.firebaseConfig) {
    setText("roleStatus", "firebase-config.js missing window.firebaseConfig.");
    return;
  }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  function getSelectedLocations() {
    const select = byId("relatedLocations");
    if (!select) return [];
    return Array.from(select.selectedOptions || []).map(option => option.value).filter(Boolean);
  }

  function populateLocations() {
    const select = byId("relatedLocations");
    const locations = window.SHOUTOUT_CLUB_LOCATIONS || {};
    if (!select) return;
    select.innerHTML = Object.entries(locations).map(([id, loc]) => {
      const label = [loc.name, loc.city, loc.region || loc.state, loc.country].filter(Boolean).join(" - ");
      return `<option value="${id}">${label}</option>`;
    }).join("");
  }

  async function submitRoleRequest() {
    const user = auth.currentUser;
    if (!user) {
      setText("roleStatus", "Please sign in first.");
      return;
    }

    const roleType = valueOf("requestType");
    const publicName = valueOf("publicName");
    const instagram = valueOf("instagram");
    const phone = valueOf("phone");
    const website = valueOf("website");
    const notes = valueOf("roleNotes");
    const relatedLocations = getSelectedLocations();

    const request = {
      uid: user.uid,
      email: user.email || "",
      roleType,
      publicName,
      instagram,
      phone,
      website,
      notes,
      relatedLocations,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("roleRequests").add(request);

    if (roleType === "dj") {
      await db.collection("djProfiles").doc(user.uid).set(request, { merge: true });
    }
    if (roleType === "promoter") {
      await db.collection("promoterProfiles").doc(user.uid).set(request, { merge: true });
    }

    setText("roleStatus", "Request submitted for approval.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    populateLocations();
    byId("roleGoogleLoginBtn")?.addEventListener("click", () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
    byId("submitRoleRequestBtn")?.addEventListener("click", submitRoleRequest);
  });

  auth.onAuthStateChanged(user => {
    setText("roleSignedInAs", user ? `Signed in as ${user.email || user.phoneNumber || "patron"}` : "Not signed in");
    setText("roleStatus", user ? "Choose the access type you want to request." : "Please sign in.");
    byId("roleLogin")?.classList.toggle("hidden", !!user);
    byId("roleForm")?.classList.toggle("hidden", !user);
  });
})();
