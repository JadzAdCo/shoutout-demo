/* seed-app.js v19 */
(function(){
  const byId = id => document.getElementById(id);
  const setStatus = t => byId("seedStatus").textContent = t;
  if (!window.firebaseConfig) { setStatus("firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth(), db = firebase.firestore();
  const safeUser = u => (u?.email || "").toLowerCase();
  async function login(provider){ try{ await auth.signInWithPopup(provider); }catch(e){ setStatus(`${e.code || "error"}: ${e.message}`); } }
  async function cleanupObsoleteLocations(user){
    const ids = window.FLOQR_OBSOLETE_LOCATION_IDS || [];
    for (const id of ids) {
      await db.collection("clubLocations").doc(id).set({
        active:false,
        status:"deleted",
        deletedReason:"Fictitious test record removed from FLOQR package.",
        deletedByUid:user.uid,
        deletedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      await db.collection("aiIndex").doc(`clubLocation_${id}`).set({
        visibility:"deleted",
        status:"deleted",
        aiIndexExcluded:true,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }
    const queueSnap = await db.collection("aiDiscoveryQueue").where("proposedTitle","==","Heist Houston").limit(25).get();
    const batch = db.batch();
    let batchWrites = 0;
    queueSnap.forEach(doc => batch.set(doc.ref, {
      status:"deleted",
      deletedReason:"Fictitious Heist Houston record removed from FLOQR package.",
      deletedByUid:user.uid,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true}) && (batchWrites += 1));
    if (batchWrites) await batch.commit();
  }
  async function seed(){
    const user = auth.currentUser;
    if (!user || !window.SHOUTOUT_ADMIN_EMAILS.includes(safeUser(user))) { setStatus("Sign in with an admin email first."); return; }
    setStatus("Seeding...");
    for (const [id,t] of Object.entries(window.SHOUTOUT_TEMPLATES)) await db.collection("templates").doc(id).set(t,{merge:true});
    for (const [id,c] of Object.entries(window.SHOUTOUT_CLUB_LOCATIONS)) await db.collection("clubLocations").doc(id).set(c,{merge:true});
    for (const [id,e] of Object.entries(window.SHOUTOUT_EVENTS)) await db.collection("events").doc(id).set(e,{merge:true});
    await cleanupObsoleteLocations(user);
    setStatus("Done. Templates, clubLocations, and events created/updated. Obsolete fictitious location records were marked deleted.");
  }
  document.addEventListener("DOMContentLoaded",()=>{
    byId("seedGoogleLoginBtn").onclick = () => login(new firebase.auth.GoogleAuthProvider());
    byId("seedFacebookLoginBtn").onclick = () => login(new firebase.auth.FacebookAuthProvider());
    byId("seedMicrosoftLoginBtn").onclick = () => { const p=new firebase.auth.OAuthProvider("microsoft.com"); p.setCustomParameters({prompt:"select_account"}); login(p); };
    byId("seedBtn").onclick = seed;
    byId("seedLogoutBtn").onclick = () => auth.signOut();
    auth.onAuthStateChanged(u => setStatus(u ? `Signed in as ${u.displayName || u.email}` : "Not signed in"));
  });
})();
