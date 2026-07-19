/* role-request-app.js v29.07 - service membership and club association requests */
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
    const serviceSubtype = valueOf("serviceSubtype");
    const instagram = valueOf("instagram");
    const phone = valueOf("phone");
    const website = valueOf("website");
    const notes = valueOf("roleNotes");
    const relatedLocations = getSelectedLocations();
    if (!roleType || !publicName) {
      setText("roleStatus", "Role and public name are required.");
      return;
    }
    if (!relatedLocations.length) {
      setText("roleStatus", "Select at least one club for the association request.");
      return;
    }

    const request = {
      uid: user.uid,
      email: user.email || "",
      roleType,
      publicName,
      serviceSubtype,
      instagram,
      phone,
      website,
      notes,
      relatedLocations,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("roleRequests").add(request);

    const roleLabels = {clubAdmin:"Club Admin", dj:"DJ", promoter:"Promoter", hospitality:"Waiter / Waitress / Bottle Girl", bartender:"Bartender / Barman", mediaCreator:"Videographer / Camera Operator"};
    const batch = db.batch();
    relatedLocations.forEach(clubLocationId => {
      const associationRef = db.collection("workerAssociationRequests").doc();
      batch.set(associationRef, {
        ...request,
        clubLocationId,
        roleLabel:roleLabels[roleType] || roleType,
        workerUid:user.uid,
        status:"pending",
        requestedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      const notificationRef = db.collection("clubAdminNotifications").doc();
      batch.set(notificationRef, {
        type:"workerAssociationRequest",
        clubLocationId,
        workerAssociationRequestId:associationRef.id,
        workerUid:user.uid,
        workerName:publicName || user.displayName || user.email || "FLOQR patron",
        roleLabel:roleLabels[roleType] || roleType,
        serviceSubtype,
        status:"unread",
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    batch.set(db.collection("users").doc(user.uid), {
      serviceMember:roleType !== "clubAdmin",
      requestedRoles:firebase.firestore.FieldValue.arrayUnion(roleLabels[roleType] || roleType),
      requestedClubLocationIds:relatedLocations,
      publicProfileType:roleType === "hospitality" || roleType === "bartender" ? "hospitality" : roleType,
      serviceSubtype,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    await batch.commit();

    if (roleType === "dj") {
      await db.collection("djProfiles").doc(user.uid).set(request, { merge: true });
    }
    if (roleType === "promoter") {
      await db.collection("promoterProfiles").doc(user.uid).set(request, { merge: true });
    }

    setText("roleStatus", `Association request submitted to ${relatedLocations.length} club(s) for approval.`);
  }

  document.addEventListener("DOMContentLoaded", () => {
    populateLocations();
    byId("roleGoogleLoginBtn")?.addEventListener("click", () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
    byId("submitRoleRequestBtn")?.addEventListener("click", submitRoleRequest);
  });

  auth.onAuthStateChanged(user => {
    setText("roleStatus", user ? "Choose the access type you want to request." : "Please sign in.");
    byId("roleLogin")?.classList.toggle("hidden", !!user);
    byId("roleForm")?.classList.toggle("hidden", !user);
  });
})();
