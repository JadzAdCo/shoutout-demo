
/* seed-app.js v18 */
(function(){
  const byId = id => document.getElementById(id);
  const setStatus = t => byId("seedStatus").textContent = t;
  if (!window.firebaseConfig) { setStatus("firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth(), db = firebase.firestore();
  const safeUser = u => (u?.email || "").toLowerCase();
  async function login(provider){ try{ await auth.signInWithPopup(provider); }catch(e){ setStatus(`${e.code || "error"}: ${e.message}`); } }
  async function seed(){
    const user = auth.currentUser;
    if (!user || !window.SHOUTOUT_ADMIN_EMAILS.includes(safeUser(user))) { setStatus("Sign in with an admin email first."); return; }
    setStatus("Seeding...");
    for (const [id,t] of Object.entries(window.SHOUTOUT_TEMPLATES)) await db.collection("templates").doc(id).set(t,{merge:true});
    for (const [id,c] of Object.entries(window.SHOUTOUT_CLUBS)) await db.collection("clubs").doc(id).set(c,{merge:true});
    setStatus("Done. Clubs and templates created/updated in Firestore.");
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
