/* role-request-app.js — service membership and club association requests */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const valueOf = id => (byId(id)?.value || "").trim();
  const access = window.FLOQRServiceAccess || {};

  if (!window.firebaseConfig) {
    setText("roleStatus", "firebase-config.js missing window.firebaseConfig.");
    return;
  }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  let venuePicker = null;

  function mountVenuePicker() {
    const mount = byId("roleVenuePickerMount");
    if (!mount || !window.FLOQRVenuePicker) return;
    venuePicker = window.FLOQRVenuePicker.mount({
      container: mount,
      db,
      staticCatalog: window.SHOUTOUT_CLUB_LOCATIONS || {}
    });
  }

  async function submitRoleRequest() {
    const user = auth.currentUser;
    if (!user) {
      setText("roleStatus", "Please sign in first.");
      return;
    }

    const serviceSubtype = valueOf("serviceSpecialty");
    const notes = valueOf("roleNotes");
    const relatedLocations = venuePicker?.getSelectedIds?.() || [];
    const roleType = access.roleTypeForSpecialty?.(serviceSubtype) || "hospitality";
    const publicName = access.displayWorkerName?.(user, {}) || user.displayName || user.email || "FLOQR member";

    if (!serviceSubtype) {
      setText("roleStatus", "Choose your service role.");
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
      notes,
      relatedLocations,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("roleRequests").add(request);

    const batch = db.batch();
    relatedLocations.forEach(clubLocationId => {
      const associationRef = db.collection("workerAssociationRequests").doc();
      batch.set(associationRef, {
        ...request,
        clubLocationId,
        roleLabel: serviceSubtype,
        workerUid: user.uid,
        status: "pending",
        requestedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const notificationRef = db.collection("clubAdminNotifications").doc();
      batch.set(notificationRef, {
        type: "workerAssociationRequest",
        clubLocationId,
        workerAssociationRequestId: associationRef.id,
        workerUid: user.uid,
        workerName: publicName,
        roleLabel: serviceSubtype,
        serviceSubtype,
        status: "unread",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    batch.set(db.collection("users").doc(user.uid), {
      serviceMember: roleType !== "clubAdmin",
      requestedRoles: firebase.firestore.FieldValue.arrayUnion(serviceSubtype),
      requestedClubLocationIds: relatedLocations,
      publicProfileType: access.publicProfileTypeForSpecialty?.(serviceSubtype) || "patron",
      serviceSubtype,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    await batch.commit();

    if (roleType === "dj") await db.collection("djProfiles").doc(user.uid).set(request, {merge: true});
    if (roleType === "promoter") await db.collection("promoterProfiles").doc(user.uid).set(request, {merge: true});

    setText("roleStatus", `Association request submitted to ${relatedLocations.length} club(s) for approval.`);
  }

  function applyTypeFromQuery() {
    const type = new URLSearchParams(location.search).get("type") || new URLSearchParams(location.search).get("role") || "";
    const specialty = access.specialtyFromQueryType?.(type) || "";
    const select = byId("serviceSpecialty");
    if (select && specialty) select.value = specialty;
  }

  document.addEventListener("DOMContentLoaded", () => {
    access.fillSpecialtySelect?.(byId("serviceSpecialty"));
    applyTypeFromQuery();
    mountVenuePicker();
    window.FLOQRSessionShell?.bind?.({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#roleStatus"
    });
    byId("roleGoogleLoginBtn")?.addEventListener("click", () => {
      if (window.FLOQRSessionShell?.popupBlocked?.("#roleStatus")) return;
      auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    });
    byId("submitRoleRequestBtn")?.addEventListener("click", submitRoleRequest);
  });

  auth.onAuthStateChanged(user => {
    setText("roleStatus", user ? "Choose the service role and clubs you want to associate with." : "Please sign in.");
    byId("roleLogin")?.classList.toggle("hidden", !!user);
    byId("roleForm")?.classList.toggle("hidden", !user);
  });
})();
