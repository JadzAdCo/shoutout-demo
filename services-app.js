/* FLOQR role-capacity following and campaigns v29.07. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const setStatus = value => { if (byId("serviceStatus")) byId("serviceStatus").textContent = value; };
  if (!window.firebaseConfig) return setStatus("Firebase configuration is missing.");
  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  let profile = {};
  let services = [];
  let following = new Set();

  function normalizedRole(value = "") {
    const raw = String(value || "").toLowerCase();
    if (raw.includes("promoter")) return "promoter";
    if (raw.includes("dj")) return "dj";
    if (/hospitality|waitress|waiter|bottle|bartender/.test(raw)) return "hospitality";
    if (/videographer|camera operator|cameraman|camera man|photographer|cinematographer|media ?creator/.test(raw)) return "mediaCreator";
    return "";
  }

  function rolesOf(row = {}) {
    const roles = (Array.isArray(row.approvedRoles) ? row.approvedRoles : [row.approvedRole]).map(normalizedRole).filter(Boolean);
    return Array.from(new Set(roles));
  }

  function roleOf(row = {}) { return row.serviceRole || rolesOf(row)[0] || ""; }
  function roleLabel(role) { return role === "dj" ? "DJ" : role === "promoter" ? "Promoter" : role === "mediaCreator" ? "Videographer / Camera Operator" : "Hospitality Service"; }
  function followId(entityId, uid) { return `${entityId}_${uid}`.replace(/[^a-zA-Z0-9_-]/g, "_"); }

  async function loadDirectory(user) {
    const [mine, users, follows] = await Promise.all([
      db.collection("users").doc(user.uid).get(),
      db.collection("users").limit(500).get(),
      db.collection("entityFollows").where("followerUid", "==", user.uid).limit(500).get()
    ]);
    profile = mine.exists ? mine.data() || {} : {};
    let blocked = new Set();
    if (window.FLOQRBlocks?.loadActiveBlocks) {
      const blocks = await window.FLOQRBlocks.loadActiveBlocks(db, user.uid);
      blocked = window.FLOQRBlocks.blockedUidSet(blocks, user.uid);
    }
    services = users.docs.flatMap(doc => rolesOf(doc.data() || {}).map(serviceRole => ({id:`${doc.id}:${serviceRole}`, memberUid:doc.id, serviceRole, ...doc.data()}))).filter(row => row.memberUid !== user.uid && !blocked.has(row.memberUid));
    following = new Set(follows.docs.filter(doc => doc.data()?.active !== false).map(doc => doc.data()?.entityId));
    const ownRoles = rolesOf(profile);
    byId("serviceCampaignPanel").classList.toggle("hidden", !ownRoles.length);
    byId("serviceCampaignRole").innerHTML = ownRoles.map(role => `<option value="${esc(role)}">${esc(roleLabel(role))}</option>`).join("");
    render();
  }

  function render() {
    const query = String(byId("serviceSearch")?.value || "").trim().toLowerCase();
    const filter = byId("serviceRoleFilter")?.value || "";
    const rows = services
      .filter(row => !filter || roleOf(row) === filter)
      .filter(row => !query || `${row.displayName || ""} ${row.username || ""} ${row.city || ""} ${row.country || ""} ${(row.musicInterests || row.favoriteGenres || []).join(" ")} ${roleLabel(roleOf(row))}`.toLowerCase().includes(query));
    byId("serviceDirectory").innerHTML = rows.length ? rows.map(row => `<article class="card service-member-card">
      <div><p class="eyebrow">${esc(roleLabel(roleOf(row)))}</p><h2>${esc(row.displayName || row.username || "FLOQR Service Member")}</h2><p class="sub">${esc([row.city, row.country].filter(Boolean).join(", "))}</p><div class="badge-row">${(row.musicInterests || row.favoriteGenres || []).slice(0,5).map(value => `<span>${esc(value)}</span>`).join("")}</div></div>
      <div class="queue-actions"><button type="button" data-follow="${esc(row.id)}">${following.has(row.id) ? "Unfollow service" : "Follow service"}</button>${row.commerceEnabled ? `<a class="buttonlike" href="./commerce.html?seller=${encodeURIComponent(row.memberUid)}&v=29.09.8">Shop</a>` : ""}</div>
    </article>`).join("") : `<div class="card"><p class="sub">No approved services matched.</p></div>`;
    document.querySelectorAll("[data-follow]").forEach(button => button.addEventListener("click", () => toggleFollow(button.dataset.follow)));
  }

  async function toggleFollow(entityId) {
    const user = auth.currentUser;
    const active = !following.has(entityId);
    const row = services.find(item => item.id === entityId) || {};
    const ref = db.collection("entityFollows").doc(followId(entityId, user.uid));
    const existing = await ref.get();
    const payload = {entityId, entityType:"service", entityRole:roleOf(row), memberUid:row.memberUid || "", entityName:row.displayName || row.username || "Service Member", followerUid:user.uid, followerEmail:user.email || "", active, updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if (!existing.exists) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set(payload, {merge:true});
    active ? following.add(entityId) : following.delete(entityId);
    setStatus(active ? "Service followed." : "Service unfollowed.");
    render();
  }

  async function publishCampaign() {
    try {
      const title = byId("serviceCampaignTitle").value.trim();
      const body = byId("serviceCampaignBody").value.trim();
      if (!title || !body) throw new Error("Campaign title and message are required.");
      const entityRole = byId("serviceCampaignRole").value || rolesOf(profile)[0];
      if (!entityRole) throw new Error("An approved service role is required.");
      const entityId = `${auth.currentUser.uid}:${entityRole}`;
      const campaign = {title, body, link:byId("serviceCampaignLink").value.trim(), campaignType:"service", entityRole, entityName:profile.displayName || profile.username || "Service Member"};
      if (byId("serviceCampaignAudience").value === "followers") {
        const result = await window.FLOQRPayments.publishFollowerCampaign({entityId, campaign, status:setStatus});
        setStatus(`Campaign published to ${result.deliveredCount || 0} follower(s).`);
      } else {
        const targetUserCount = Number(byId("serviceTargetCount").value || 0);
        if (targetUserCount < 1) throw new Error("Enter at least one targeted patron.");
        await window.FLOQRPayments.startCheckout({orderType:"audienceCampaign", payload:{entityId, campaign, targetUserCount}, status:setStatus});
      }
    } catch (error) { setStatus(error?.message || String(error)); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("serviceGoogleLoginBtn")?.addEventListener("click", () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
    byId("serviceSearch")?.addEventListener("input", render);
    byId("serviceRoleFilter")?.addEventListener("change", render);
    byId("serviceCampaignAudience")?.addEventListener("change", event => byId("serviceTargetCountLabel").classList.toggle("hidden", event.currentTarget.value !== "targetedFloqr"));
    byId("servicePublishCampaignBtn")?.addEventListener("click", publishCampaign);
    auth.onAuthStateChanged(user => {
      byId("serviceLogin").classList.toggle("hidden", !!user);
      byId("servicePanel").classList.toggle("hidden", !user);
      if (user) loadDirectory(user).then(() => setStatus("Service directory ready.")).catch(error => setStatus(error.message));
      else setStatus("Sign in to follow a service.");
    });
  });
})();
