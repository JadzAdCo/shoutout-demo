/* admin-app.js v19 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const safeUser = user => (user?.email || user?.phoneNumber || "unknown").toLowerCase();

  if (!window.firebaseConfig) { setText("adminStatus", "firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const locationId = qs("location", qs("club", "zebbies-garden-washington-dc"));
  const loc = window.SHOUTOUT_CLUB_LOCATIONS[locationId] || { locationName: locationId, brand: locationId };

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }
  function displayUrl(item) {
    const url = new URL("./display.html", window.location.href);
    url.searchParams.set("location", locationId);
    if (item) { url.searchParams.set("main", item.mainText || ""); url.searchParams.set("sub", item.subText || ""); url.searchParams.set("template", item.template || "neon"); url.searchParams.set("media", item.mediaUrl || ""); }
    return url.href;
  }

  async function loginGoogle() { try { setText("adminStatus","Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); } catch(e) { setText("adminStatus", `${e.code || "error"}: ${e.message}`); } }
  async function loginFacebook() { try { setText("adminStatus","Opening Facebook sign-in..."); await auth.signInWithPopup(new firebase.auth.FacebookAuthProvider()); } catch(e) { setText("adminStatus", `${e.code || "error"}: ${e.message}`); } }
  async function loginMicrosoft() { try { const p = new firebase.auth.OAuthProvider("microsoft.com"); p.setCustomParameters({prompt:"select_account"}); setText("adminStatus","Opening Microsoft sign-in..."); await auth.signInWithPopup(p); } catch(e) { setText("adminStatus", `${e.code || "error"}: ${e.message}`); } }
  async function logout() { await auth.signOut(); window.location.reload(); }

  function renderQueue() {
    const queueList = byId("queueList");
    queueList.innerHTML = "<p class='sub'>Loading pending shoutouts...</p>";
    db.collection("shoutouts").where("clubLocationId","==",locationId).where("status","==","pending").orderBy("submittedAt","desc")
      .onSnapshot(snapshot => {
        queueList.innerHTML = "";
        if (snapshot.empty) { queueList.innerHTML = "<p class='sub'>No pending shoutouts yet.</p>"; return; }
        snapshot.forEach(doc => {
          const item = doc.data();
          const div = document.createElement("div");
          div.className = "queue-item";
          div.innerHTML = `<strong>${esc(item.mainText || "")}</strong><p>${esc(item.subText || "")}</p><small>Location: ${esc(item.locationName || item.clubName || locationId)} • Template: ${esc(item.templateName || item.template || "neon")} • Ref: ${esc(item.referenceNumber || "")} • Submitted by: ${esc(item.submittedBy || "unknown")}</small><div class="queue-actions"><button class="approve" type="button">Approve & Push Live</button><button class="reject" type="button">Reject</button><a class="buttonlike" target="_blank" href="${displayUrl(item)}">Preview</a></div>`;
          div.querySelector(".approve").addEventListener("click", () => approve(doc.id, item));
          div.querySelector(".reject").addEventListener("click", () => reject(doc.id));
          queueList.appendChild(div);
        });
      }, e => { queueList.innerHTML = `<p class="status">${esc(e.message)}</p>`; });
  }

  async function approve(id, item) {
    await db.collection("liveContent").doc(locationId).set({
      location: locationId, clubLocationId: locationId,
      locationName: item.locationName || loc.locationName,
      brandName: item.brandName || loc.brandName,
      template: item.template || "neon",
      templateName: item.templateName || "",
      mainText: item.mainText || "SHOUTOUT!",
      subText: item.subText || "",
      mediaUrl: item.mediaUrl || "",
      status: "approved",
      submittedBy: item.submittedBy || "unknown",
      approvedBy: safeUser(auth.currentUser),
      referenceNumber: item.referenceNumber || "",
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    await db.collection("shoutouts").doc(id).delete();
  }
  async function reject(id) { await db.collection("shoutouts").doc(id).delete(); }

  document.addEventListener("DOMContentLoaded", () => {
    setText("clubName", loc.locationName || locationId);
    setText("adminStatus", "Admin app loaded. Sign in to continue.");
    byId("displayLink").href = `./display.html?location=${locationId}`;
    byId("liveFrame").src = `./display.html?location=${locationId}`;
    bind("adminGoogleLoginBtn", loginGoogle); bind("adminFacebookLoginBtn", loginFacebook); bind("adminMicrosoftLoginBtn", loginMicrosoft); bind("adminLogoutBtn", logout);
    auth.onAuthStateChanged(user => {
      setText("adminSignedInAs", user ? `Signed in as ${user.displayName || user.email || user.phoneNumber}` : "Not signed in");
      if (!user) { byId("adminLogin").classList.remove("hidden"); byId("adminPanel").classList.add("hidden"); return; }
      if (!window.SHOUTOUT_ADMIN_EMAILS.includes(safeUser(user))) {
        byId("adminLogin").classList.remove("hidden"); byId("adminPanel").classList.add("hidden");
        setText("adminStatus", `Signed in as ${safeUser(user)}, but this email is not listed in SHOUTOUT_ADMIN_EMAILS in shared-data.js.`);
        return;
      }
      byId("adminLogin").classList.add("hidden"); byId("adminPanel").classList.remove("hidden"); setText("adminStatus","Admin verified."); renderQueue();
    });
  });
})();
