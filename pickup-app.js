/* FLOQR Pickup Robotaxi simulation v29.07. No charge or dispatch occurs. */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const qs = name => new URL(location.href).searchParams.get(name) || "";
  const setStatus = value => { if (byId("pickupStatus")) byId("pickupStatus").textContent = value; };
  const money = cents => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(Number(cents || 0) / 100);

  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const locationId = qs("location") || "zebbies-garden-washington-dc";
  let destination = "";
  let rideTimer = 0;
  let activeRequestId = "";

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
    {status:"mock-payment-approved", title:"Mock payment approved", message:"Assigning your simulated vehicle...", progress:15, pin:"stage-one"},
    {status:"vehicle-assigned", title:"Vehicle assigned", message:`${simulatedVehicle.vehicleTag} is preparing to depart.`, progress:32, pin:"stage-two"},
    {status:"en-route", title:"Robotaxi is en route", message:`${simulatedVehicle.pickupEtaMinutes} minutes away - ${simulatedVehicle.batteryPercent}% charge.`, progress:58, pin:"stage-three"},
    {status:"arriving", title:"Robotaxi is arriving", message:"Meet the vehicle at the marked pickup point.", progress:84, pin:"stage-four"},
    {status:"waiting-at-pickup", title:"Robotaxi is waiting", message:`Confirm tag ${simulatedVehicle.vehicleTag} and plate ${simulatedVehicle.licensePlate}.`, progress:100, pin:"stage-five"}
  ];

  function addressOf(row = {}) {
    return row.fullAddress || window.FLOQRAddress?.fullAddress?.(row) || [row.streetAddress || row.address, row.city, row.region || row.stateRegion, row.postalCode, row.country].filter(Boolean).join(", ");
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
    byId("pickupScheduledFields").classList.toggle("hidden", mode !== "scheduled");
    byId("pickupFloqFields").classList.toggle("hidden", !["forAnother", "shared"].includes(mode));
    byId("pickupForAnotherFields").classList.toggle("hidden", mode !== "forAnother");
    byId("pickupSharedFields").classList.toggle("hidden", mode !== "shared");
    updatePaymentPlan();
  }

  function updatePaymentPlan() {
    const mode = selectedValue("pickupMode") || "onDemand";
    let plan = "Organizer pays the full mock fare";
    if (mode === "forAnother") {
      const value = byId("pickupForAnotherPayment")?.value;
      plan = value === "recipient" ? "Recipient pays the mock fare" : value === "requestApproval" ? "Recipient approves and pays" : plan;
    }
    if (mode === "shared") {
      const value = byId("pickupSharedPayment")?.value;
      plan = value === "splitEvenly" ? "Mock fare split evenly among riders" : value === "individualLegs" ? "Each rider pays their simulated route leg" : plan;
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

  async function load(user) {
    const [profileSnap, clubSnap] = await Promise.all([
      db.collection("users").doc(user.uid).get(),
      db.collection("clubLocations").doc(locationId).get().catch(() => null)
    ]);
    const profile = profileSnap.exists ? profileSnap.data() || {} : {};
    const club = clubSnap?.exists ? {...((window.SHOUTOUT_CLUB_LOCATIONS || {})[locationId] || {}), ...clubSnap.data()} : (window.SHOUTOUT_CLUB_LOCATIONS || {})[locationId] || {};
    destination = addressOf(club);
    byId("pickupAddress").value = profile.taxiPickupAddress || profile.pickupAddress || "";
    byId("pickupDestination").value = destination;
    byId("pickupBackLink").href = `./club-profile.html?location=${encodeURIComponent(locationId)}&v=29.07`;
    const mapsUrl = new URL("https://www.google.com/maps/dir/");
    mapsUrl.searchParams.set("api", "1");
    mapsUrl.searchParams.set("origin", byId("pickupAddress").value || "My location");
    mapsUrl.searchParams.set("destination", destination);
    byId("pickupGoogleMapLink").href = mapsUrl.href;
    renderVehicle();
    setStatus(destination ? "Simulation ready. Review the mock vehicle before requesting Pickup." : "This club needs a verified street address before Pickup can be used.");
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
      <div><span>Mock fare</span><strong>${esc(money(simulatedVehicle.fareCents))} - approved</strong></div>
      <div><span>Safety contact</span><strong>${esc(simulatedVehicle.safetySpecialist)}</strong></div>`;
  }

  async function applyStage(index) {
    const stage = stages[index];
    if (!stage) return;
    byId("pickupRideTitle").textContent = stage.title;
    byId("pickupRideStage").textContent = stage.message;
    byId("pickupRideProgress").style.width = `${stage.progress}%`;
    byId("vehiclePin").className = `map-pin vehicle-pin ${stage.pin}`;
    setStatus(`Simulation: ${stage.title}.`);
    if (activeRequestId) {
      await db.collection("pickupRequests").doc(activeRequestId).set({status:stage.status, simulationProgress:stage.progress, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true}).catch(() => null);
    }
  }

  function startStatusSimulation() {
    let index = 0;
    window.clearInterval(rideTimer);
    applyStage(index);
    rideTimer = window.setInterval(() => {
      index += 1;
      if (index >= stages.length) return window.clearInterval(rideTimer);
      applyStage(index);
    }, 3200);
  }

  async function requestPickup() {
    try {
      const user = auth.currentUser;
      const pickupAddress = byId("pickupAddress").value.trim();
      const booking = bookingDetails();
      if (!user) throw new Error("Sign in before using Pickup.");
      if (!pickupAddress || !destination) throw new Error("Pickup and verified destination addresses are required.");
      byId("pickupRequestBtn").disabled = true;
      setStatus("Approving mock payment - no charge will be made...");
      await db.collection("users").doc(user.uid).set({taxiPickupAddress:pickupAddress, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
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
        destinationAddress:destination,
        booking,
        vehicle:{...simulatedVehicle},
        estimate:{fareCents:simulatedVehicle.fareCents, currency:"usd", pickupEtaMinutes:simulatedVehicle.pickupEtaMinutes, tripEtaMinutes:simulatedVehicle.tripEtaMinutes},
        mockPayment:{status:"approved", charged:false, amountCents:simulatedVehicle.fareCents, paymentMethod:"Mock Apple Pay", payerChoice:booking.payerChoice},
        status:stages[0].status,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      renderRideDetails(booking);
      byId("pickupRideModal").classList.remove("hidden");
      byId("pickupResult").innerHTML = `<div class="queue-item"><strong>Simulation ${esc(ref.id.slice(0, 8).toUpperCase())}</strong><p>Mock payment approved. No charge was made and no vehicle was dispatched.</p><button id="pickupReopenStatus" type="button">View Ride Status</button></div>`;
      byId("pickupReopenStatus")?.addEventListener("click", () => byId("pickupRideModal").classList.remove("hidden"));
      if (booking.mode === "scheduled") {
        const scheduled = new Date(booking.scheduledFor).toLocaleString();
        byId("pickupRideTitle").textContent = "Scheduled hail reserved";
        byId("pickupRideStage").textContent = `Mock payment approved. Simulated vehicle assignment will begin before ${scheduled}.`;
        byId("pickupRideProgress").style.width = "20%";
        setStatus(`Simulation: scheduled pickup reserved for ${scheduled}.`);
      } else {
        startStatusSimulation();
      }
    } catch (error) {
      setStatus(error?.message || String(error));
    } finally {
      byId("pickupRequestBtn").disabled = false;
    }
  }

  async function cancelSimulation() {
    window.clearInterval(rideTimer);
    if (activeRequestId) await db.collection("pickupRequests").doc(activeRequestId).set({status:"cancelled", simulationProgress:0, cancelledAt:firebase.firestore.FieldValue.serverTimestamp(), updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true}).catch(() => null);
    byId("pickupRideTitle").textContent = "Simulation cancelled";
    byId("pickupRideStage").textContent = "No vehicle was dispatched and no payment was charged.";
    byId("pickupRideProgress").style.width = "0%";
    setStatus("Pickup simulation cancelled.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("pickupGoogleLoginBtn")?.addEventListener("click", () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
    byId("pickupRequestBtn")?.addEventListener("click", requestPickup);
    byId("pickupRideClose")?.addEventListener("click", () => byId("pickupRideModal").classList.add("hidden"));
    byId("pickupRideCancel")?.addEventListener("click", cancelSimulation);
    document.querySelectorAll('input[name="pickupMode"]').forEach(input => input.addEventListener("change", updateBookingMode));
    byId("pickupForAnotherPayment")?.addEventListener("change", updatePaymentPlan);
    byId("pickupSharedPayment")?.addEventListener("change", updatePaymentPlan);
    updateBookingMode();
    byId("pickupAddress")?.addEventListener("change", () => {
      const mapsUrl = new URL("https://www.google.com/maps/dir/");
      mapsUrl.searchParams.set("api", "1");
      mapsUrl.searchParams.set("origin", byId("pickupAddress").value || "My location");
      mapsUrl.searchParams.set("destination", destination);
      byId("pickupGoogleMapLink").href = mapsUrl.href;
    });
    auth.onAuthStateChanged(user => {
      byId("pickupLogin").classList.toggle("hidden", !!user);
      byId("pickupPanel").classList.toggle("hidden", !user);
      if (user) load(user).catch(error => setStatus(error.message));
      else setStatus("Sign in to use the Pickup simulation.");
    });
  });
})();
