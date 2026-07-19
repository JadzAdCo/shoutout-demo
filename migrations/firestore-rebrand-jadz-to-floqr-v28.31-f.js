/* Firestore data migration v28.31-f: clubLocations Jadz AdCo -> FLOQR */
(function(){
  "use strict";

  const VERSION = "28.31-f";
  const COLLECTION = "clubLocations";
  const OLD_BRAND_PATTERNS = [
    /Jadz\s*Ad\s*Co/gi,
    /Jadz\s*AdCo/gi,
    /JADZ\s*ADCO/g,
    /JADZ\s*AD\s*CO/g
  ];
  const NEW_BRAND = "FLOQR";

  const byId = id => document.getElementById(id);
  const setStatus = text => { const el = byId("migrationStatus"); if (el) el.textContent = text; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const safeUser = user => (user?.email || "").toLowerCase();

  if (!window.firebaseConfig) { setStatus("firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  let plannedChanges = [];
  let backupPayload = null;

  function isAdmin(user) {
    const adminEmails = window.SHOUTOUT_ADMIN_EMAILS || [];
    return !!user && adminEmails.includes(safeUser(user));
  }

  async function login(provider) {
    try { await auth.signInWithPopup(provider); }
    catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); }
  }

  function replaceBrand(value) {
    if (typeof value === "string") {
      return OLD_BRAND_PATTERNS.reduce((out, pattern) => out.replace(pattern, NEW_BRAND), value);
    }
    if (Array.isArray(value)) return value.map(replaceBrand);
    if (value && typeof value === "object" && !value.toDate && !value.seconds) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceBrand(v)]));
    }
    return value;
  }

  function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function changedFields(before, after, prefix = "") {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const out = [];
    keys.forEach(key => {
      const path = prefix ? `${prefix}.${key}` : key;
      const a = before ? before[key] : undefined;
      const b = after ? after[key] : undefined;
      if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b) && !a.toDate && !b.toDate) {
        out.push(...changedFields(a, b, path));
      } else if (!deepEqual(a, b)) {
        out.push(path);
      }
    });
    return out;
  }

  function renderResults(rows, heading = "Preview") {
    const wrap = byId("migrationResults");
    if (!wrap) return;
    if (!rows.length) {
      wrap.innerHTML = `<p class="sub">No matching ${esc(COLLECTION)} documents found.</p>`;
      return;
    }
    wrap.innerHTML = `
      <p><strong>${esc(heading)}:</strong> ${rows.length} document(s)</p>
      ${rows.map(row => `<div class="queue-item">
        <strong>${esc(row.id)}</strong>
        <p>${esc(row.fields.join(", "))}</p>
      </div>`).join("")}
    `;
  }

  async function previewMigration() {
    const user = auth.currentUser;
    if (!isAdmin(user)) { setStatus("Sign in with an approved admin email first."); return; }
    setStatus(`Scanning ${COLLECTION}...`);
    const snap = await db.collection(COLLECTION).get();
    plannedChanges = [];
    snap.forEach(doc => {
      const before = doc.data();
      const after = replaceBrand(before);
      if (!deepEqual(before, after)) {
        plannedChanges.push({
          id: doc.id,
          path: `${COLLECTION}/${doc.id}`,
          before,
          after,
          fields: changedFields(before, after)
        });
      }
    });
    backupPayload = {
      version: VERSION,
      collection: COLLECTION,
      createdAt: new Date().toISOString(),
      createdBy: safeUser(user),
      replacements: OLD_BRAND_PATTERNS.map(x => String(x)),
      newBrand: NEW_BRAND,
      documents: plannedChanges.map(({id, path, before, fields}) => ({id, path, before, fields}))
    };
    byId("downloadBackupBtn").disabled = plannedChanges.length === 0;
    byId("applyMigrationBtn").disabled = plannedChanges.length === 0;
    setStatus(plannedChanges.length ? `Preview ready. ${plannedChanges.length} document(s) will change. Download backup before applying.` : "No documents need migration.");
    renderResults(plannedChanges, "Migration preview");
  }

  function downloadBackup() {
    if (!backupPayload) { setStatus("Preview the migration first."); return; }
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firestore-rebrand-backup-${COLLECTION}-v${VERSION}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Rollback backup downloaded. You can apply the migration now.");
  }

  async function applyMigration() {
    const user = auth.currentUser;
    if (!isAdmin(user)) { setStatus("Sign in with an approved admin email first."); return; }
    if (!plannedChanges.length) { setStatus("Preview changes first."); return; }
    const ok = confirm(`Apply FLOQR rebrand migration to ${plannedChanges.length} ${COLLECTION} document(s)? Download the rollback backup first if you have not already.`);
    if (!ok) return;
    setStatus("Applying migration...");
    for (const change of plannedChanges) {
      await db.collection(COLLECTION).doc(change.id).set({
        ...change.after,
        migration: {
          ...(change.after.migration || {}),
          lastRebrandVersion: VERSION,
          lastRebrandAppliedAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastRebrandAppliedBy: safeUser(user)
        }
      }, {merge:true});
    }
    setStatus(`Migration complete. Updated ${plannedChanges.length} ${COLLECTION} document(s).`);
    renderResults(plannedChanges, "Applied");
    byId("applyMigrationBtn").disabled = true;
  }

  async function applyRollback() {
    const user = auth.currentUser;
    if (!isAdmin(user)) { setStatus("Sign in with an approved admin email first."); return; }
    const file = byId("rollbackFile")?.files?.[0];
    if (!file) { setStatus("Choose a rollback JSON backup first."); return; }
    const text = await file.text();
    const payload = JSON.parse(text);
    if (payload.collection !== COLLECTION || !Array.isArray(payload.documents)) {
      setStatus("Invalid rollback file for this migration.");
      return;
    }
    const ok = confirm(`Rollback ${payload.documents.length} ${COLLECTION} document(s) using ${file.name}?`);
    if (!ok) return;
    setStatus("Applying rollback...");
    for (const doc of payload.documents) {
      await db.collection(COLLECTION).doc(doc.id).set({
        ...doc.before,
        migration: {
          ...(doc.before.migration || {}),
          lastRollbackVersion: VERSION,
          lastRollbackAppliedAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastRollbackAppliedBy: safeUser(user)
        }
      }, {merge:true});
    }
    setStatus(`Rollback complete. Restored ${payload.documents.length} ${COLLECTION} document(s).`);
    renderResults(payload.documents, "Rolled back");
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("migrationGoogleLoginBtn").onclick = () => login(new firebase.auth.GoogleAuthProvider());
    byId("migrationFacebookLoginBtn").onclick = () => login(new firebase.auth.FacebookAuthProvider());
    byId("migrationMicrosoftLoginBtn").onclick = () => {
      const provider = new firebase.auth.OAuthProvider("microsoft.com");
      provider.setCustomParameters({prompt:"select_account"});
      login(provider);
    };
    byId("migrationLogoutBtn").onclick = () => auth.signOut();
    byId("previewMigrationBtn").onclick = previewMigration;
    byId("downloadBackupBtn").onclick = downloadBackup;
    byId("applyMigrationBtn").onclick = applyMigration;
    byId("applyRollbackBtn").onclick = applyRollback;
    auth.onAuthStateChanged(user => {
      setStatus(user ? `Signed in as ${user.displayName || user.email}. ${isAdmin(user) ? "Ready." : "This email is not in SHOUTOUT_ADMIN_EMAILS."}` : "Not signed in.");
    });
  });
})();
