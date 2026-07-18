/* FLOQR Pickup / RydR simulation v29.09.14. Dispatch is simulated; trip fare uses real Stripe Checkout. */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const qs = name => new URL(location.href).searchParams.get(name) || "";
  const setStatus = value => { if (byId("pickupStatus")) byId("pickupStatus").textContent = value; };
  const money = cents => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(Number(cents || 0) / 100);
  const PENDING_KEY = "floqrRydrPendingRide";
  const FALLBACK_AD_SVG = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3ERYDR%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3ESPOT%20AD%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E";

  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const locationId = qs("location") || "zebbies-garden-washington-dc";
  let destination = "";
  let userProfile = {};
  let savedPickupAddresses = [];
  let selectedSaveLabel = "Home";
  let rideTimer = 0;
  let adTimer = 0;
  let matchingTimer = 0;
  let activeRequestId = "";
  let paidOrderId = "";
  let currentBooking = null;
  let stageIndex = 0;
  let awaitingSpotConfirm = false;
  let awaitingDropoffConfirm = false;

  const simulatedVehicle = Object.freeze({
    vehicleId:"RX-2047",
    model:"Tesla Model Y Robotaxi",
    vehicleTag:"FLOQR-RX27",
    licensePlate:"SIM-RX27",
    color:"Deep Blue Metallic",
    currentLocation:"17th St & K St NW",
    distanceMiles:1.8,
    batteryPercent:84,
    estimatedRangeMiles:239,
    pickupEtaMinutes:6,
    tripEtaMinutes:14,
    seats:4,
    driverMode:"Tesla autonomous driving system (simulated)",
    safetySpecialist:"Aurora M. - remote safety contact (simulated)",
    accessibility:"Service-animal ready; foldable wheelchair storage",
    fareCents:1840
  });

  const stages = [
    {status:"en-route", title:"Robotaxi is en route", message:`${simulatedVehicle.pickupEtaMinutes} minutes away — ${simulatedVehicle.batteryPercent}% charge.`, progress:18, pin:"stage-one", auto:true},
    {status:"arriving", title:"Arriving in about 2 minutes", message:"Notification: your robotaxi is about 2 minutes from the pickup spot.", progress:32, pin:"stage-two", auto:true},
    {status:"at-pickup-spot", title:"At pickup spot", message:`Confirm you are at the right spot and vehicle tag ${simulatedVehicle.vehicleTag} / plate ${simulatedVehicle.licensePlate}.`, progress:45, pin:"stage-three", pause:"spot"},
    {status:"in-trip", title:"In trip", message:"Heading toward the club. Enjoy the simulated ride.", progress:58, pin:"stage-four", auto:true},
    {status:"in-trip", title:"In trip — mid route", message:"Passing through the corridor toward your destination.", progress:70, pin:"stage-six", auto:true},
    {status:"in-trip", title:"In trip — approaching corridor", message:"Next turn toward the club entrance.", progress:80, pin:"stage-seven", auto:true},
    {status:"in-trip", title:"In trip — final approach", message:"Almost at the club drop-off zone.", progress:88, pin:"stage-eight", auto:true},
    {status:"dropoff-arriving", title:"Drop-off arriving", message:"Pulling into the club curb. Prepare to exit.", progress:95, pin:"stage-nine", auto:true},
    {status:"dropoff-complete", title:"Drop-off complete", message:"Confirm you have arrived safely at the club.", progress:100, pin:"stage-ten", pause:"dropoff"}
  ];

  function addressOf(row = {}) {
    return row.fullAddress || window.FLOQRAddress?.fullAddress?.(row) || [row.streetAddress || row.address, row.city, row.region || row.stateRegion, row.postalCode, row.country].filter(Boolean).join(", ");
  }

  function readPending() {
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null"); } catch { return null; }
  }

  function writePending(data) {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(data || {}));
  }

  function clearPending() {
    sessionStorage.removeItem(PENDING_KEY);
  }

  function updateMapsLink() {
    const mapsUrl = new URL("https://www.google.com/maps/dir/");
    mapsUrl.searchParams.set("api", "1");
    mapsUrl.searchParams.set("origin", byId("pickupAddress")?.value || "My location");
    mapsUrl.searchParams.set("destination", destination);
    if (byId("pickupGoogleMapLink")) byId("pickupGoogleMapLink").href = mapsUrl.href;
  }

  function renderVehicle() {
    const values = {
      pickupVehicleName:simulatedVehicle.model,
      pickupVehicleTag:`${simulatedVehicle.vehicleTag} / ${simulatedVehicle.licensePlate}`,
      pickupVehicleColor:simulatedVehicle.color,
      pickupVehicleCharge:`${simulatedVehicle.batteryPercent}%`,
      pickupVehicleDistance:`${simulatedVehicle.distanceMiles.toFixed(1)} mi`,
      pickupVehicleLocation:simulatedVehicle.currentLocation,
      pickupEta:`${simulatedVehicle.pickupEtaMinutes} min`,
      pickupTripEta:`${simulatedVehicle.tripEtaMinutes} min`,
      pickupDriver:simulatedVehicle.driverMode,
      pickupSafetySpecialist:simulatedVehicle.safetySpecialist,
      pickupSeats:String(simulatedVehicle.seats),
      pickupRange:`${simulatedVehicle.estimatedRangeMiles} mi`,
      pickupMockFare:money(simulatedVehicle.fareCents)
    };
    Object.entries(values).forEach(([id, value]) => { if (byId(id)) byId(id).textContent = value; });
  }

  function selectedValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
  }

  function updateBookingMode() {
    const mode = selectedValue("pickupMode") || "onDemand";
    byId("pickupScheduledFields")?.classList.toggle("hidden", mode !== "scheduled");
    byId("pickupFloqFields")?.classList.toggle("hidden", !["forAnother", "shared"].includes(mode));
    byId("pickupForAnotherFields")?.classList.toggle("hidden", mode !== "forAnother");
    byId("pickupSharedFields")?.classList.toggle("hidden", mode !== "shared");
    updatePaymentPlan();
  }

  function updatePaymentPlan() {
    const mode = selectedValue("pickupMode") || "onDemand";
    let plan = "Organizer pays the trip fare";
    if (mode === "forAnother") {
      const value = byId("pickupForAnotherPayment")?.value;
      plan = value === "recipient" ? "Recipient pays the trip fare" : value === "requestApproval" ? "Recipient approves and pays" : plan;
    }
    if (mode === "shared") {
      const value = byId("pickupSharedPayment")?.value;
      plan = value === "splitEvenly" ? "Fare split evenly among riders" : value === "individualLegs" ? "Each rider pays their route leg" : plan;
    }
    if (byId("pickupPaymentPlan")) byId("pickupPaymentPlan").textContent = plan;
  }

  function bookingDetails() {
    const mode = selectedValue("pickupMode") || "onDemand";
    if (mode === "scheduled") {
      const date = byId("pickupScheduledDate").value;
      const time = byId("pickupScheduledTime").value;
      if (!date || !time) throw new Error("Choose a pickup date and time for a scheduled hail.");
      const scheduledFor = new Date(`${date}T${time}`);
      if (!Number.isFinite(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) throw new Error("Scheduled pickup must be in the future.");
      return {mode, scheduledFor:scheduledFor.toISOString(), payerChoice:"organizer"};
    }
    if (mode === "forAnother") {
      const recipient = byId("pickupRecipient").value.trim();
      if (!recipient) throw new Error("Select or enter the Flocker receiving the ride.");
      return {mode, recipient, payerChoice:byId("pickupForAnotherPayment").value};
    }
    if (mode === "shared") {
      const names = Array.from(document.querySelectorAll('[data-companion="name"]'));
      const dropoffs = Array.from(document.querySelectorAll('[data-companion="dropoff"]'));
      const companions = names.map((field, index) => ({patron:field.value.trim(), dropoffAddress:dropoffs[index]?.value.trim() || destination})).filter(item => item.patron);
      if (!companions.length) throw new Error("Add at least one Flocker to a shared ride.");
      return {mode, companions:companions.slice(0, 3), payerChoice:byId("pickupSharedPayment").value};
    }
    return {mode:"onDemand", payerChoice:"organizer"};
  }

  function showWizardStep(step) {
    document.querySelectorAll(".pickup-wizard-panel").forEach(panel => {
      panel.classList.toggle("hidden", panel.getAttribute("data-wizard-step") !== step);
    });
    document.querySelectorAll("[data-step-indicator]").forEach(el => {
      el.classList.toggle("active", el.getAttribute("data-step-indicator") === step);
      el.classList.toggle("done", "abcd".indexOf(el.getAttribute("data-step-indicator")) < "abcd".indexOf(step));
    });
  }

  function renderSavedChips() {
    const host = byId("pickupSavedChips");
    if (!host) return;
    if (!savedPickupAddresses.length) {
      host.innerHTML = `<p class="sub small">No saved pickup spots yet. Enter an address and save it with a label.</p>`;
      return;
    }
    host.innerHTML = savedPickupAddresses.map(item => `
      <button type="button" class="saved-chip" data-saved-id="${esc(item.id)}" title="${esc(item.address)}">
        <strong>${esc(item.label)}</strong>
        <span>${esc(item.address)}</span>
      </button>`).join("");
    host.querySelectorAll("[data-saved-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        const row = savedPickupAddresses.find(item => item.id === btn.getAttribute("data-saved-id"));
        if (!row) return;
        byId("pickupAddress").value = row.address;
        updateMapsLink();
        setStatus(`Using saved pickup: ${row.label}.`);
      });
    });
  }

  async function saveCurrentPickup() {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in before saving a pickup address.");
    const address = byId("pickupAddress").value.trim();
    if (!address) throw new Error("Enter a pickup address before saving.");
    let label = selectedSaveLabel || "Home";
    if (label === "Other") {
      label = (byId("pickupOtherLabel")?.value || "").trim();
      if (!label) throw new Error("Enter a custom name for Other.");
    }
    const existing = savedPickupAddresses.find(item => item.label.toLowerCase() === label.toLowerCase());
    const next = existing
      ? savedPickupAddresses.map(item => item.id === existing.id ? {...item, address, label} : item)
      : [...savedPickupAddresses, {id:`pickup_${Date.now().toString(36)}`, label, address}];
    savedPickupAddresses = next;
    await db.collection("users").doc(user.uid).set({
      savedPickupAddresses:next,
      taxiPickupAddress:address,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    renderSavedChips();
    setStatus(`Saved pickup as “${label}”.`);
  }

  function formatRideDate(value) {
    if (!value) return "—";
    if (typeof value.toDate === "function") return value.toDate().toLocaleString();
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : "—";
  }

  async function loadRideHistory(uid) {
    const host = byId("pickupRideHistory");
    if (!host) return;
    try {
      const snap = await db.collection("pickupRequests").where("ownerUid", "==", uid).limit(20).get();
      const rows = snap.docs.map(doc => ({id:doc.id, ...doc.data()}))
        .sort((a, b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));
      if (!rows.length) {
        host.innerHTML = `<p class="sub">No RydR rides yet. Complete a paid hail to build history.</p>`;
        return;
      }
      host.innerHTML = rows.map(row => {
        const fare = money(row.estimate?.fareCents || row.payment?.amountCents || row.mockPayment?.amountCents || simulatedVehicle.fareCents);
        return `<article class="pickup-history-item">
          <div><strong>${esc(row.status || "unknown")}</strong><span>${esc(fare)}</span></div>
          <p>${esc(row.pickupAddress || "Pickup")} → ${esc(row.destinationAddress || "Club")}</p>
          <small>${esc(formatRideDate(row.createdAt || row.updatedAt))}</small>
        </article>`;
      }).join("");
    } catch (error) {
      host.innerHTML = `<p class="sub">Could not load ride history: ${esc(error.message || error)}</p>`;
    }
  }

  function renderRideDetails(booking = {}) {
    const modeLabels = {onDemand:"On-demand", scheduled:"Scheduled", forAnother:"For a Flocker", shared:"Shared"};
    const payerLabels = {organizer:"Organizer pays", recipient:"Recipient pays", requestApproval:"Recipient approves and pays", splitEvenly:"Split evenly", individualLegs:"Each rider pays their route leg"};
    byId("pickupRideDetails").innerHTML = `
      <div><span>Booking mode</span><strong>${esc(modeLabels[booking.mode] || booking.mode || "On-demand")}</strong></div>
      <div><span>Payment arrangement</span><strong>${esc(payerLabels[booking.payerChoice] || booking.payerChoice || "Organizer pays")}</strong></div>
      <div><span>Vehicle</span><strong>${esc(simulatedVehicle.model)}</strong></div>
      <div><span>Tag and plate</span><strong>${esc(simulatedVehicle.vehicleTag)} / ${esc(simulatedVehicle.licensePlate)}</strong></div>
      <div><span>Charge</span><strong>${simulatedVehicle.batteryPercent}% (${simulatedVehicle.estimatedRangeMiles} mi range)</strong></div>
      <div><span>Pickup ETA</span><strong>${simulatedVehicle.pickupEtaMinutes} min</strong></div>
      <div><span>Trip fare</span><strong>${esc(money(simulatedVehicle.fareCents))} — paid via Stripe</strong></div>
      <div><span>Safety contact</span><strong>${esc(simulatedVehicle.safetySpecialist)}</strong></div>`;
  }

  async function applyStage(index) {
    const stage = stages[index];
    if (!stage) return;
    stageIndex = index;
    awaitingSpotConfirm = stage.pause === "spot";
    awaitingDropoffConfirm = stage.pause === "dropoff";
    byId("pickupRideTitle").textContent = stage.title;
    byId("pickupRideStage").textContent = stage.message;
    byId("pickupRideProgress").style.width = `${stage.progress}%`;
    byId("vehiclePin").className = `map-pin vehicle-pin ${stage.pin}`;
    byId("pickupConfirmSpotBtn")?.classList.toggle("hidden", !awaitingSpotConfirm);
    byId("pickupConfirmDropoffBtn")?.classList.toggle("hidden", !awaitingDropoffConfirm);
    setStatus(`Simulation: ${stage.title}.`);
    if (activeRequestId) {
      await db.collection("pickupRequests").doc(activeRequestId).set({
        status:stage.status,
        simulationProgress:stage.progress,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true}).catch(() => null);
    }
  }

  function clearRideTimers() {
    window.clearInterval(rideTimer);
    window.clearInterval(matchingTimer);
    window.clearInterval(adTimer);
  }

  function advanceStage() {
    const next = stageIndex + 1;
    if (next >= stages.length) {
      window.clearInterval(rideTimer);
      return;
    }
    applyStage(next);
    if (stages[next].pause) window.clearInterval(rideTimer);
  }

  function startStatusSimulation(fromIndex = 0) {
    window.clearInterval(rideTimer);
    applyStage(fromIndex);
    if (stages[fromIndex]?.pause) return;
    rideTimer = window.setInterval(() => {
      if (awaitingSpotConfirm || awaitingDropoffConfirm) return;
      advanceStage();
    }, 2800);
  }

  async function completeDropoff() {
    const user = auth.currentUser;
    if (!user || !activeRequestId) return;
    await db.collection("pickupRequests").doc(activeRequestId).set({
      status:"completed",
      simulationProgress:100,
      completedAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true}).catch(() => null);
    const summary = {
      lastRideId:activeRequestId,
      lastStatus:"completed",
      lastFareCents:simulatedVehicle.fareCents,
      lastClubLocationId:locationId,
      lastCompletedAt:new Date().toISOString(),
      totalCompleted:(Number(userProfile.rideHistorySummary?.totalCompleted || 0) + 1)
    };
    userProfile.rideHistorySummary = summary;
    await db.collection("users").doc(user.uid).set({
      rideHistorySummary:summary,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true}).catch(() => null);
    byId("pickupRideTitle").textContent = "Ride completed";
    byId("pickupRideStage").textContent = "Drop-off confirmed. Thanks for riding with RydR.";
    byId("pickupConfirmDropoffBtn")?.classList.add("hidden");
    setStatus("Ride completed. History updated.");
    clearPending();
    loadRideHistory(user.uid);
  }

  function startMatchingThenRide(booking) {
    showWizardStep("d");
    currentBooking = booking;
    renderRideDetails(booking);
    let ticks = 0;
    if (byId("pickupMatchingStatus")) byId("pickupMatchingStatus").textContent = "Scanning nearby simulated robotaxis…";
    window.clearInterval(matchingTimer);
    matchingTimer = window.setInterval(() => {
      ticks += 1;
      const messages = [
        "Scanning nearby simulated robotaxis…",
        "Checking charge and ETA…",
        `Matched ${simulatedVehicle.vehicleTag}. Preparing dispatch simulation…`
      ];
      if (byId("pickupMatchingStatus")) byId("pickupMatchingStatus").textContent = messages[Math.min(ticks, messages.length - 1)];
      if (ticks >= 3) {
        window.clearInterval(matchingTimer);
        byId("pickupRideModal").classList.remove("hidden");
        if (booking.mode === "scheduled") {
          const scheduled = new Date(booking.scheduledFor).toLocaleString();
          byId("pickupRideTitle").textContent = "Scheduled hail reserved";
          byId("pickupRideStage").textContent = `Payment confirmed. Simulated vehicle assignment will begin before ${scheduled}.`;
          byId("pickupRideProgress").style.width = "20%";
          setStatus(`Simulation: scheduled pickup reserved for ${scheduled}.`);
        } else {
          startStatusSimulation(0);
        }
      }
    }, 1200);
  }

  async function createPickupRequest(user, booking, paymentMeta = {}) {
    const pickupAddress = (paymentMeta.pickupAddress || byId("pickupAddress")?.value || "").trim();
    const destinationAddress = paymentMeta.destinationAddress || destination;
    await db.collection("users").doc(user.uid).set({
      taxiPickupAddress:pickupAddress,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    const ref = db.collection("pickupRequests").doc();
    activeRequestId = ref.id;
    await ref.set({
      simulation:true,
      provider:"tesla-robotaxi-concept",
      providerApiStatus:"no-public-third-party-booking-endpoint",
      noVehicleDispatched:true,
      ownerUid:user.uid,
      ownerEmail:user.email || "",
      clubLocationId:locationId,
      pickupAddress,
      destinationAddress,
      booking,
      vehicle:{...simulatedVehicle},
      estimate:{fareCents:simulatedVehicle.fareCents, currency:"usd", pickupEtaMinutes:simulatedVehicle.pickupEtaMinutes, tripEtaMinutes:simulatedVehicle.tripEtaMinutes},
      payment:{
        status:"paid",
        charged:true,
        amountCents:simulatedVehicle.fareCents,
        method:"stripe-checkout",
        orderId:paymentMeta.orderId || paidOrderId || "",
        payerChoice:booking.payerChoice
      },
      serviceOrderId:paymentMeta.orderId || paidOrderId || "",
      status:"searching",
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    byId("pickupResult").innerHTML = `<div class="queue-item"><strong>Ride ${esc(ref.id.slice(0, 8).toUpperCase())}</strong><p>Stripe fare paid. Simulated dispatch is running.</p><button id="pickupReopenStatus" type="button">View Ride Status</button></div>`;
    byId("pickupReopenStatus")?.addEventListener("click", () => byId("pickupRideModal").classList.remove("hidden"));
    return ref.id;
  }

  async function resumeAfterPaidOrder(orderId) {
    const user = auth.currentUser;
    if (!user) return;
    paidOrderId = orderId;
    setStatus("Confirming Stripe payment…");
    showWizardStep("c");
    const deadline = Date.now() + 90000;
    let order = null;
    while (Date.now() < deadline) {
      const snap = await db.collection("serviceOrders").doc(orderId).get();
      order = snap.exists ? snap.data() : null;
      if (order?.paymentStatus === "paid") break;
      if (["failed", "refunded", "cancelled"].includes(String(order?.paymentStatus || "").toLowerCase())) {
        throw new Error(`Payment status is ${order.paymentStatus}.`);
      }
      setStatus("Waiting for Stripe payment confirmation…");
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    if (order?.paymentStatus !== "paid") throw new Error("Payment confirmation timed out. Refresh this page if Stripe already charged you.");
    setStatus("Payment confirmed. Starting simulated hail…");
    const pending = readPending() || {};
    const booking = pending.booking || {mode:"onDemand", payerChoice:"organizer"};
    if (pending.pickupAddress && byId("pickupAddress")) byId("pickupAddress").value = pending.pickupAddress;
    await createPickupRequest(user, booking, {
      orderId,
      pickupAddress:pending.pickupAddress || byId("pickupAddress")?.value,
      destinationAddress:pending.destinationAddress || destination
    });
    clearPending();
    startMatchingThenRide(booking);
    loadRideHistory(user.uid);
  }

  function showAdStep() {
    showWizardStep("b");
    const ad = window.FLOQRAdCampaigns?.pickCampaign?.("rydr", userProfile) || {
      title:"Advertise Here",
      body:"Your brand can own this moment before patrons hail a RydR.",
      badge:"FLOQR Media Slot",
      image:FALLBACK_AD_SVG
    };
    if (byId("pickupAdBadge")) byId("pickupAdBadge").textContent = ad.badge || "Sponsored";
    if (byId("pickupAdTitle")) byId("pickupAdTitle").textContent = ad.title || "Spot advertisement";
    if (byId("pickupAdBody")) byId("pickupAdBody").textContent = ad.body || "";
    if (byId("pickupAdImage")) {
      byId("pickupAdImage").innerHTML = `<img src="${esc(ad.image || FALLBACK_AD_SVG)}" alt="${esc(ad.title || "Advertisement")}"/>`;
    }
    let remaining = 8;
    if (byId("pickupAdCountdown")) byId("pickupAdCountdown").textContent = String(remaining);
    window.clearInterval(adTimer);
    adTimer = window.setInterval(() => {
      remaining -= 1;
      if (byId("pickupAdCountdown")) byId("pickupAdCountdown").textContent = String(Math.max(remaining, 0));
      if (remaining <= 0) {
        window.clearInterval(adTimer);
        showWizardStep("c");
      }
    }, 1000);
  }

  async function continueFromAddress() {
    const pickupAddress = byId("pickupAddress").value.trim();
    bookingDetails();
    if (!pickupAddress || !destination) throw new Error("Pickup and verified destination addresses are required.");
    const user = auth.currentUser;
    if (user) {
      await db.collection("users").doc(user.uid).set({
        taxiPickupAddress:pickupAddress,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }
    updateMapsLink();
    showAdStep();
  }

  async function startCheckoutHail() {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in before using Pickup.");
    if (!window.FLOQRPayments?.startCheckout) throw new Error("Stripe checkout is not loaded.");
    const pickupAddress = byId("pickupAddress").value.trim();
    const booking = bookingDetails();
    if (!pickupAddress || !destination) throw new Error("Pickup and verified destination addresses are required.");
    byId("pickupRequestBtn").disabled = true;
    writePending({
      pickupAddress,
      destinationAddress:destination,
      booking,
      clubLocationId:locationId,
      fareCents:simulatedVehicle.fareCents,
      createdAt:Date.now()
    });
    await db.collection("users").doc(user.uid).set({
      taxiPickupAddress:pickupAddress,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    setStatus("Opening FloqR Stripe Checkout for trip fare…");
    await window.FLOQRPayments.startCheckout({
      orderType:"rydrFare",
      payload:{
        fareCents:simulatedVehicle.fareCents,
        clubLocationId:locationId,
        pickupAddress,
        destinationAddress:destination
      },
      status:message => setStatus(message)
    });
  }

  async function cancelSimulation() {
    clearRideTimers();
    if (activeRequestId) {
      await db.collection("pickupRequests").doc(activeRequestId).set({
        status:"cancelled",
        simulationProgress:0,
        cancelledAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true}).catch(() => null);
    }
    byId("pickupConfirmSpotBtn")?.classList.add("hidden");
    byId("pickupConfirmDropoffBtn")?.classList.add("hidden");
    byId("pickupRideTitle").textContent = "Simulation cancelled";
    byId("pickupRideStage").textContent = "No vehicle was dispatched. Any Stripe fare already paid remains on your FloqR order history.";
    byId("pickupRideProgress").style.width = "0%";
    setStatus("Pickup simulation cancelled.");
    showWizardStep("a");
  }

  async function load(user) {
    const [profileSnap, clubSnap] = await Promise.all([
      db.collection("users").doc(user.uid).get(),
      db.collection("clubLocations").doc(locationId).get().catch(() => null)
    ]);
    userProfile = profileSnap.exists ? profileSnap.data() || {} : {};
    savedPickupAddresses = Array.isArray(userProfile.savedPickupAddresses) ? userProfile.savedPickupAddresses : [];
    const club = clubSnap?.exists
      ? {...((window.SHOUTOUT_CLUB_LOCATIONS || {})[locationId] || {}), ...clubSnap.data()}
      : (window.SHOUTOUT_CLUB_LOCATIONS || {})[locationId] || {};
    destination = addressOf(club);
    byId("pickupAddress").value = userProfile.taxiPickupAddress || userProfile.pickupAddress || "";
    byId("pickupDestination").value = destination;
    updateMapsLink();
    renderVehicle();
    renderSavedChips();
    loadRideHistory(user.uid);
    setStatus(destination
      ? "Ready. Enter or pick a pickup address, then continue through ad → pay → match."
      : "This club needs a verified street address before Pickup can be used.");

    const orderId = qs("order");
    const rydrPaid = qs("rydrPaid") === "1";
    const cancelled = qs("rydrCancelled") === "1";
    if (cancelled && orderId) {
      setStatus("Stripe checkout cancelled. You can pay again when ready.");
      showWizardStep("c");
      return;
    }
    if (orderId && (rydrPaid || qs("order"))) {
      try {
        await resumeAfterPaidOrder(orderId);
        const url = new URL(location.href);
        url.searchParams.delete("rydrPaid");
        url.searchParams.delete("session_id");
        history.replaceState({}, "", url.toString());
      } catch (error) {
        setStatus(error?.message || String(error));
        showWizardStep("c");
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("pickupGoogleLoginBtn")?.addEventListener("click", () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
    byId("pickupContinueAddressBtn")?.addEventListener("click", () => {
      continueFromAddress().catch(error => setStatus(error?.message || String(error)));
    });
    byId("pickupAdContinueBtn")?.addEventListener("click", () => {
      window.clearInterval(adTimer);
      showWizardStep("c");
    });
    byId("pickupAdSkipBtn")?.addEventListener("click", () => {
      window.clearInterval(adTimer);
      showWizardStep("c");
    });
    byId("pickupRequestBtn")?.addEventListener("click", () => {
      startCheckoutHail().catch(error => {
        setStatus(error?.message || String(error));
        byId("pickupRequestBtn").disabled = false;
      });
    });
    byId("pickupSaveAddressBtn")?.addEventListener("click", () => {
      saveCurrentPickup().catch(error => setStatus(error?.message || String(error)));
    });
    document.querySelectorAll("[data-save-label]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedSaveLabel = btn.getAttribute("data-save-label") || "Home";
        document.querySelectorAll("[data-save-label]").forEach(el => el.classList.toggle("active", el === btn));
        byId("pickupOtherLabel")?.classList.toggle("hidden", selectedSaveLabel !== "Other");
      });
    });
    document.querySelector("[data-save-label='Home']")?.classList.add("active");
    byId("pickupRideClose")?.addEventListener("click", () => byId("pickupRideModal").classList.add("hidden"));
    byId("pickupRideCancel")?.addEventListener("click", () => cancelSimulation());
    byId("pickupConfirmSpotBtn")?.addEventListener("click", () => {
      awaitingSpotConfirm = false;
      byId("pickupConfirmSpotBtn").classList.add("hidden");
      window.clearInterval(rideTimer);
      rideTimer = window.setInterval(() => {
        if (awaitingSpotConfirm || awaitingDropoffConfirm) return;
        advanceStage();
      }, 2800);
      advanceStage();
    });
    byId("pickupConfirmDropoffBtn")?.addEventListener("click", () => {
      awaitingDropoffConfirm = false;
      completeDropoff().catch(error => setStatus(error?.message || String(error)));
    });
    document.querySelectorAll('input[name="pickupMode"]').forEach(input => input.addEventListener("change", updateBookingMode));
    byId("pickupForAnotherPayment")?.addEventListener("change", updatePaymentPlan);
    byId("pickupSharedPayment")?.addEventListener("change", updatePaymentPlan);
    updateBookingMode();
    byId("pickupAddress")?.addEventListener("change", updateMapsLink);
    showWizardStep("a");
    auth.onAuthStateChanged(user => {
      byId("pickupLogin").classList.toggle("hidden", !!user);
      byId("pickupPanel").classList.toggle("hidden", !user);
      if (user) load(user).catch(error => setStatus(error.message));
      else setStatus("Sign in to use the Pickup simulation.");
    });
  });
})();
