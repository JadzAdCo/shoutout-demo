/* promoter-admin-app.js v26 */
(function(){
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money = value => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD", maximumFractionDigits:0}).format(value || 0);

  if (!window.firebaseConfig) { setText("promoterStatus", "firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const promoterAdmins = window.SHOUTOUT_PROMOTER_ADMINS || {};

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }
  async function loginGoogle() {
    try { setText("promoterStatus", "Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch(e) { setText("promoterStatus", `${e.code || "error"}: ${e.message}`); }
  }
  async function logout() { await auth.signOut(); window.location.reload(); }

  function getPeriodStart(period) {
    const d = new Date();
    const days = {daily:1, weekly:7, biweekly:14, monthly:30, sixMonths:183, oneYear:365, twoYears:730, fiveYears:1825}[period] || 30;
    d.setDate(d.getDate() - days);
    return d;
  }
  function toDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    return new Date(value);
  }
  function inPeriod(item, field, start) {
    const d = toDate(item[field]);
    return d && d >= start;
  }
  async function getCollectionSafe(name, limit=1000) {
    try { const snap = await db.collection(name).limit(limit).get(); return snap.docs.map(d => ({id:d.id, ...d.data()})); }
    catch(e) { console.warn(`Could not read ${name}:`, e.message); return []; }
  }
  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  }
  function getAllowedPromoters(email) {
    return promoterAdmins[String(email || "").toLowerCase()] || [];
  }
  function isAllowed(allowed, promoterId) {
    return allowed.includes("*") || allowed.includes(promoterId);
  }

  async function loadReports() {
    const email = (auth.currentUser?.email || "").toLowerCase();
    const allowed = getAllowedPromoters(email);
    const start = getPeriodStart(byId("periodFilter").value);
    const [guestLists, users] = await Promise.all([getCollectionSafe("guestListRequests"), getCollectionSafe("users")]);

    const filteredGuests = guestLists.filter(x => isAllowed(allowed, x.promoterId)).filter(x => inPeriod(x, "submittedAt", start));
    const filteredUsers = users.filter(x => isAllowed(allowed, x.referredByPromoterId)).filter(x => inPeriod(x, "createdAt", start) || inPeriod(x, "updatedAt", start));

    const totalParty = filteredGuests.reduce((sum,x) => sum + Number(x.partySize || 0), 0);
    const estimatedCredit = filteredUsers.length * 2 + filteredGuests.length * 5;
    setText("metricSignupRefs", filteredUsers.length.toLocaleString());
    setText("metricGuestRefs", filteredGuests.length.toLocaleString());
    setText("metricGuestCount", totalParty.toLocaleString());
    setText("metricPromoterCredit", money(estimatedCredit));

    const byClub = {};
    filteredGuests.forEach(x => {
      const key = x.locationName || x.clubLocationId || "Unknown";
      byClub[key] = byClub[key] || {requests:0, guests:0};
      byClub[key].requests += 1;
      byClub[key].guests += Number(x.partySize || 0);
    });
    const clubRows = Object.entries(byClub).sort((a,b) => b[1].requests - a[1].requests).map(([club,v]) => [club, `${v.requests} requests / ${v.guests} guests`]);
    byId("guestByClubReport").innerHTML = clubRows.length ? simpleRows(clubRows) : "<p class='sub'>No guest list referrals for this period.</p>";
    byId("signupReport").innerHTML = simpleRows([
      ["Allowed promoter IDs", allowed.join(", ")],
      ["Signup referrals", filteredUsers.length.toLocaleString()],
      ["Guest list referrals", filteredGuests.length.toLocaleString()]
    ]);
    const recent = filteredGuests.sort((a,b) => (toDate(b.submittedAt)?.getTime() || 0) - (toDate(a.submittedAt)?.getTime() || 0)).slice(0, 20);
    byId("recentGuestListReport").innerHTML = recent.length ? recent.map(x => `
      <div class="queue-item"><strong>${esc(x.guestName || "Guest")}</strong>
      <p>${esc(x.locationName || x.clubLocationId)} • ${esc(x.eventOrDay)} • Party of ${esc(x.partySize || 1)}</p>
      <small>Promoter: ${esc(x.promoterName || x.promoterId)} • Status: ${esc(x.status || "pending")}</small></div>`).join("") : "<p class='sub'>No recent guest list requests.</p>";
  }

  document.addEventListener("DOMContentLoaded", () => {
    bind("promoterGoogleLoginBtn", loginGoogle);
    bind("promoterLogoutBtn", logout);
    byId("periodFilter")?.addEventListener("change", loadReports);
    auth.onAuthStateChanged(user => {
      const email = (user?.email || "").toLowerCase();
      const allowed = getAllowedPromoters(email);
      setText("promoterSignedInAs", user ? `Signed in as ${user.displayName || user.email}` : "Not signed in");
      setText("promoterPanelSignedInAs", user ? `Signed in as ${user.displayName || user.email}` : "Not signed in");
      if (!user) {
        byId("promoterLogin").classList.remove("hidden");
        byId("promoterPanel").classList.add("hidden");
        setText("promoterStatus", "Sign in to continue.");
      } else if (!allowed.length) {
        byId("promoterLogin").classList.remove("hidden");
        byId("promoterPanel").classList.add("hidden");
        setText("promoterStatus", `${email} is not listed as a promoter admin.`);
      } else {
        byId("promoterLogin").classList.add("hidden");
        byId("promoterPanel").classList.remove("hidden");
        setText("promoterStatus", "Promoter admin verified.");
        setText("promoterAccessSummary", allowed.includes("*") ? "Access: all promoters." : `Access: ${allowed.join(", ")}`);
        loadReports();
      }
    });
  });
})();
