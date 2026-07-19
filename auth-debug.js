/* auth-debug.js v25.9 */
(function(){
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  if (!window.firebaseConfig) {
    setText("debugStatus", "firebase-config.js missing window.firebaseConfig.");
    return;
  }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();

  function render(user) {
    const out = byId("debugOutput");
    if (!user) {
      out.innerHTML = "<p class='sub'>No authenticated user.</p>";
      return;
    }
    const providerIds = (user.providerData || []).map(p => p.providerId).join(", ");
    out.innerHTML = `
      <div class="report-table">
        <div><span>UID</span><strong>${esc(user.uid)}</strong></div>
        <div><span>Email</span><strong>${esc(user.email)}</strong></div>
        <div><span>Email verified</span><strong>${esc(user.emailVerified)}</strong></div>
        <div><span>Display name</span><strong>${esc(user.displayName)}</strong></div>
        <div><span>Provider IDs</span><strong>${esc(providerIds)}</strong></div>
      </div>`;
  }

  async function google() {
    try {
      setText("debugStatus", "Opening Google popup...");
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch(e) {
      setText("debugStatus", `${e.code || "error"}: ${e.message}`);
    }
  }

  async function microsoft() {
    const p = new firebase.auth.OAuthProvider("microsoft.com");
    p.setCustomParameters({prompt:"select_account"});
    try {
      setText("debugStatus", "Opening Microsoft popup...");
      await auth.signInWithPopup(p);
    } catch(e) {
      if (["auth/popup-blocked","auth/popup-closed-by-user","auth/cancelled-popup-request"].includes(e?.code || "")) {
        try {
          setText("debugStatus", "Microsoft popup was blocked or closed. Redirecting instead...");
          await auth.signInWithRedirect(p);
          return;
        } catch(redirectError) {
          setText("debugStatus", `${redirectError.code || "error"}: ${redirectError.message}`);
          return;
        }
      }
      setText("debugStatus", `${e.code || "error"}: ${e.message}`);
    }
  }

  async function logout() {
    await auth.signOut();
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("debugGoogle").addEventListener("click", google);
    byId("debugMicrosoft").addEventListener("click", microsoft);
    byId("debugLogout").addEventListener("click", logout);

    auth.onAuthStateChanged(user => {
      setText("debugStatus", user ? `Signed in as ${user.email || user.displayName || user.uid}` : "Not signed in.");
      render(user);
    });
  });
})();
    auth.getRedirectResult().then(result => {
      if (result?.user) setText("debugStatus", `Redirect sign-in completed: ${result.user.email || result.user.displayName || result.user.uid}`);
    }).catch(e => setText("debugStatus", `${e.code || "error"}: ${e.message}`));
