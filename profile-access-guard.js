/* FLOQR required-profile access guard v29.04. Include on every protected page. */
(function () {
  "use strict";

  if (window.FLOQR_PROFILE_GUARD_DISABLED || /(?:^|\/)display\.html$/i.test(window.location.pathname)) return;

  const blocker = document.createElement("div");
  blocker.id = "floqrProfileAccessBlocker";
  blocker.className = "floqr-profile-access-blocker";
  blocker.innerHTML = '<div><strong>Checking your FLOQR profile…</strong><p>Every FLOQR member must complete a patron profile before continuing.</p></div>';
  document.body.appendChild(blocker);

  function returnPath() {
    const file = window.location.pathname.split("/").pop() || "index.html";
    return `${file}${window.location.search}${window.location.hash}`;
  }

  function redirect(reason) {
    if (/\/(?:index\.html)?$/i.test(window.location.pathname)) return;
    const query = new URLSearchParams({v:"29.04", profileRequired:reason, returnTo:returnPath()});
    window.location.replace(`./?${query.toString()}`);
  }

  function release(profile) {
    blocker.remove();
    window.FLOQRProfileAccess = {verified:true, profile};
    window.dispatchEvent(new CustomEvent("floqr:profile-access-ready", {detail:{profile}}));
  }

  async function start() {
    if (!window.firebaseConfig || !window.firebase?.auth || !window.firebase?.firestore) {
      blocker.querySelector("strong").textContent = "FLOQR profile check unavailable";
      blocker.querySelector("p").textContent = "Refresh the page. If this continues, return to FLOQR and sign in again.";
      return;
    }
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.firebaseConfig);
    const auth = firebase.auth(app);
    const db = firebase.firestore(app);
    auth.onAuthStateChanged(async user => {
      if (!user) { redirect("sign-in"); return; }
      try {
        const snap = await db.collection("users").doc(user.uid).get();
        if (!snap.exists || snap.data()?.profileCompleted !== true) { redirect("create-profile"); return; }
        release(snap.data());
      } catch (error) {
        blocker.querySelector("strong").textContent = "We could not verify your profile";
        blocker.querySelector("p").textContent = "Return to FLOQR and sign in again. Your existing profile data was not changed.";
      }
    });
  }

  start();
})();
