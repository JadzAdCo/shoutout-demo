/* seed-app.js — batched seed with visible progress + errors */
(function(){
  const BATCH_LIMIT = 450;
  const byId = id => document.getElementById(id);
  const setStatus = t => { const el = byId("seedStatus"); if (el) el.textContent = t; };
  if (!window.firebaseConfig) { setStatus("firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth(), db = firebase.firestore();
  const safeUser = u => (u?.email || "").toLowerCase();
  const adminEmails = () => (window.SHOUTOUT_ADMIN_EMAILS || []).map(e => String(e || "").trim().toLowerCase()).filter(Boolean);
  const isAdminUser = user => !!user && adminEmails().includes(safeUser(user));
  const errText = e => `${(e && e.code) || "error"}: ${(e && e.message) || String(e)}`;
  const yieldUi = () => new Promise(r => setTimeout(r, 0));
  let seeding = false;

  function setBusy(busy) {
    seeding = busy;
    const btn = byId("seedBtn");
    if (btn) btn.disabled = busy;
  }

  function progressLine(counts) {
    const t = counts.templates, c = counts.clubs, e = counts.events;
    return `Seeding… templates ${t.done}/${t.total}, clubs ${c.done}/${c.total}, events ${e.done}/${e.total}` +
      (counts.phase ? ` — ${counts.phase}` : "");
  }

  async function commitMerged(collectionName, docs, counts, key) {
    const entries = Object.entries(docs || {});
    counts[key].total = entries.length;
    counts[key].done = 0;
    setStatus(progressLine(counts));
    await yieldUi();
    for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
      const slice = entries.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const [id, data] of slice) {
        batch.set(db.collection(collectionName).doc(id), data, { merge: true });
      }
      await batch.commit();
      counts[key].done += slice.length;
      setStatus(progressLine(counts));
      await yieldUi();
    }
  }

  async function cleanupObsoleteLocations(user, counts) {
    counts.phase = "cleanup obsolete locations";
    setStatus(progressLine(counts));
    await yieldUi();
    const ids = window.FLOQR_OBSOLETE_LOCATION_IDS || [];
    const locBatch = db.batch();
    let locWrites = 0;
    for (const id of ids) {
      locBatch.set(db.collection("clubLocations").doc(id), {
        active: false,
        status: "deleted",
        deletedReason: "Fictitious test record removed from FLOQR package.",
        deletedByUid: user.uid,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      locWrites += 1;
      locBatch.set(db.collection("aiIndex").doc(`clubLocation_${id}`), {
        visibility: "deleted",
        status: "deleted",
        aiIndexExcluded: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      locWrites += 1;
    }
    if (locWrites) await locBatch.commit();
    counts.phase = "cleanup Heist Houston queue";
    setStatus(progressLine(counts));
    await yieldUi();
    const queueSnap = await db.collection("aiDiscoveryQueue").where("proposedTitle", "==", "Heist Houston").limit(25).get();
    const queueBatch = db.batch();
    let batchWrites = 0;
    queueSnap.forEach(doc => {
      queueBatch.set(doc.ref, {
        status: "deleted",
        deletedReason: "Fictitious Heist Houston record removed from FLOQR package.",
        deletedByUid: user.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      batchWrites += 1;
    });
    if (batchWrites) await queueBatch.commit();
    counts.phase = "";
  }

  async function seed(){
    const user = auth.currentUser;
    if (!isAdminUser(user)) { setStatus("Sign in with an admin email first."); return; }
    if (seeding) return;
    setBusy(true);
    const counts = {
      templates: { done: 0, total: Object.keys(window.SHOUTOUT_TEMPLATES || {}).length },
      clubs: { done: 0, total: Object.keys(window.SHOUTOUT_CLUB_LOCATIONS || {}).length },
      events: { done: 0, total: Object.keys(window.SHOUTOUT_EVENTS || {}).length },
      phase: ""
    };
    setStatus(progressLine(counts));
    try {
      await commitMerged("templates", window.SHOUTOUT_TEMPLATES, counts, "templates");
      await commitMerged("clubLocations", window.SHOUTOUT_CLUB_LOCATIONS, counts, "clubs");
      await commitMerged("events", window.SHOUTOUT_EVENTS, counts, "events");
      await cleanupObsoleteLocations(user, counts);
      setStatus(`Done. Templates ${counts.templates.done}/${counts.templates.total}, clubs ${counts.clubs.done}/${counts.clubs.total}, events ${counts.events.done}/${counts.events.total}. Obsolete fictitious location records were marked deleted.`);
    } catch (e) {
      setStatus(`Seed failed at ${progressLine(counts)}. ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("seedGoogleLoginBtn").onclick = () => login(new firebase.auth.GoogleAuthProvider());
    byId("seedFacebookLoginBtn").onclick = () => login(new firebase.auth.FacebookAuthProvider());
    byId("seedMicrosoftLoginBtn").onclick = () => {
      const p = new firebase.auth.OAuthProvider("microsoft.com");
      p.setCustomParameters({ prompt: "select_account" });
      login(p);
    };
    byId("seedBtn").onclick = seed;
    byId("seedLogoutBtn").onclick = () => auth.signOut();
    auth.onAuthStateChanged(u => {
      if (seeding) return;
      if (!u) { setStatus("Not signed in"); return; }
      setStatus(isAdminUser(u)
        ? `Signed in as ${u.displayName || u.email}`
        : `Signed in as ${u.displayName || u.email} — this email is not in SHOUTOUT_ADMIN_EMAILS.`);
    });
  });

  async function login(provider){
    try { await auth.signInWithPopup(provider); }
    catch (e) { setStatus(errText(e)); }
  }
})();
