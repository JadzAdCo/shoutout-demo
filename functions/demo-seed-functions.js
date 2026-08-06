/* Callable seed / purge for temp_*@floqr-demo.com pack (Master Admin only). */
"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const {
  makeClock,
  normalizeWeekHours,
  formatWeekHoursLines,
  DAYS
} = require("./shared-time.js");

const SINK_EMAIL = "bans.don@gmail.com";
const SINK_SMS = "+12027330274";
const DEMO_DOMAIN = "floqr-demo.com";
const PASSWORD = process.env.FLOQR_DEMO_PASSWORD || "FloqrDemo2026!";
const META_DOC = "system/demoAccounts";
const ORIGIN = "https://jadzadco.github.io/shoutout-demo";

const HUMAN_ROLES = [
  "dj", "waitress", "bottlegirl", "busboy", "security", "host", "barman", "clubadmin", "promoter"
];
const GENRES = [
  {id: 1, genre: "Hip Hop", label: "Hip Hop"},
  {id: 2, genre: "Afro-beats / Afro House", label: "Afro House"},
  {id: 3, genre: "EDM", label: "EDM"},
  {id: 4, genre: "Reggaeton / Latin", label: "Latin"}
];
const ROLE_LABELS = {
  dj: "DJ", waitress: "Waitress", bottlegirl: "Bottle Girl", busboy: "Busboy",
  security: "Security", host: "Host", barman: "Barman", clubadmin: "Club Admin",
  promoter: "Promoter", democlub: "Demo Club", promogroup: "Promo Group"
};

function text(value = "", max = 200) {
  return String(value || "").trim().slice(0, max);
}

async function assertMasterAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const email = String(auth.token?.email || "").toLowerCase();
  const snap = await db.collection("platformSettings").doc("masterAdmins").get();
  const emails = snap.exists && Array.isArray(snap.data()?.emails)
    ? snap.data().emails.map((v) => String(v).toLowerCase())
    : [];
  const envList = String(process.env.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
    .split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (![...emails, ...envList].includes(email)) {
    throw new HttpsError("permission-denied", "Master Admin only.");
  }
}

function dayHours(openH, openM, openMer, closeH, closeM, closeMer, closed = false) {
  if (closed) return {closed: true, open: null, close: null};
  return {
    closed: false,
    open: makeClock({hour: openH, minute: openM, meridiem: openMer}),
    close: makeClock({hour: closeH, minute: closeM, meridiem: closeMer})
  };
}

function defaultWeekHours(variant = 0) {
  const openMin = [35, 0, 15, 45][variant % 4];
  const friOpenH = [10, 9, 10, 11][variant % 4];
  const days = {};
  DAYS.forEach((day) => {
    const isWeekend = day === "friday" || day === "saturday";
    const isSun = day === "sunday";
    const isMonTue = day === "monday" || day === "tuesday";
    if (isMonTue && variant === 0) {
      days[day] = dayHours(0, 0, "AM", 0, 0, "AM", true);
      return;
    }
    if (isSun) {
      days[day] = dayHours(9, openMin, "PM", 2, 0, "AM");
      return;
    }
    if (isWeekend) {
      days[day] = dayHours(friOpenH, openMin, "PM", 3, 30, "AM");
      return;
    }
    days[day] = dayHours(10, openMin, "PM", 2, day === "thursday" ? 15 : 0, "AM");
  });
  return normalizeWeekHours({timezone: "America/New_York", days});
}

function loginCode() {
  return String(crypto.randomInt(100000, 999999));
}

function emailFor(role, n) {
  return `temp_${role}_${n}@${DEMO_DOMAIN}`;
}

function displayName(role, n) {
  const genre = role === "dj" ? ` · ${GENRES[n - 1].label}` : "";
  return `Temp ${ROLE_LABELS[role] || role} ${n}${genre}`;
}

function clubNames(i) {
  return ["Temp Demo Club One", "Temp Demo Club Two", "Temp Demo Club Three", "Temp Demo Club Four"][i - 1];
}

function buildAccounts() {
  const accounts = [];
  HUMAN_ROLES.forEach((role) => {
    for (let i = 1; i <= 4; i++) {
      accounts.push({
        key: `temp_${role}_${i}`,
        role,
        index: i,
        email: emailFor(role, i),
        displayName: displayName(role, i),
        loginCode: loginCode(),
        genre: role === "dj" ? GENRES[i - 1].genre : null,
        clubIndex: ((i - 1) % 4) + 1,
        avatarPath: `assets/demo-temp/avatars/temp_${role}_${i}.svg`,
        iconPath: `assets/demo-temp/icons/temp_${role}_${i}.svg`
      });
    }
  });
  for (let i = 1; i <= 4; i++) {
    accounts.push({
      key: `temp_democlub_${i}`,
      role: "democlub",
      index: i,
      email: emailFor("democlub", i),
      displayName: displayName("democlub", i),
      loginCode: loginCode(),
      locationId: `temp-democlub-${i}`,
      clubIndex: i,
      avatarPath: `assets/demo-temp/avatars/temp_democlub_${i}.svg`,
      iconPath: `assets/demo-temp/icons/temp_democlub_${i}.svg`
    });
    accounts.push({
      key: `temp_promogroup_${i}`,
      role: "promogroup",
      index: i,
      email: emailFor("promogroup", i),
      displayName: displayName("promogroup", i),
      loginCode: loginCode(),
      promoGroupId: `temp-promogroup-${i}`,
      clubIndex: i,
      avatarPath: `assets/demo-temp/avatars/temp_promogroup_${i}.svg`,
      iconPath: `assets/demo-temp/icons/temp_promogroup_${i}.svg`
    });
  }
  return accounts;
}

async function ensureAuthUser(account) {
  let user;
  try {
    user = await admin.auth().getUserByEmail(account.email);
    await admin.auth().updateUser(user.uid, {
      password: PASSWORD,
      displayName: account.displayName,
      emailVerified: true
    });
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    user = await admin.auth().createUser({
      email: account.email,
      password: PASSWORD,
      displayName: account.displayName,
      emailVerified: true
    });
  }
  return user.uid;
}

function clubDoc(i, adminAccount, hoursWeek) {
  const locationId = `temp-democlub-${i}`;
  const name = clubNames(i);
  const hoursLines = formatWeekHoursLines(hoursWeek);
  const djs = GENRES.map((g) => ({
    name: displayName("dj", g.id),
    role: `DJ · ${g.label}`,
    genre: g.genre,
    email: emailFor("dj", g.id),
    photoUrl: `${ORIGIN}/assets/demo-temp/avatars/temp_dj_${g.id}.svg`,
    bio: `Featured ${g.genre} DJ for FLOQR demo nights.`
  }));
  const staff = ["waitress", "bottlegirl", "barman", "host"].map((role) => ({
    name: displayName(role, 1),
    role: ROLE_LABELS[role],
    email: emailFor(role, 1),
    photoUrl: `${ORIGIN}/assets/demo-temp/avatars/temp_${role}_1.svg`
  }));
  return {
    locationId,
    clubId: locationId,
    clubName: name,
    brandName: name,
    locationName: name,
    name,
    status: "active",
    active: true,
    published: true,
    visibility: "public",
    publicProfileType: "club",
    demoTemp: true,
    demoPack: "temp-v1",
    email: emailFor("democlub", i),
    phone: SINK_SMS,
    telephone: SINK_SMS,
    website: `https://example.com/temp-democlub-${i}`,
    officialWebsite: `https://example.com/temp-democlub-${i}`,
    eventsUrl: `https://example.com/temp-democlub-${i}/events`,
    city: "Washington",
    state: "DC",
    stateRegion: "DC",
    country: "US",
    region: "DC",
    postalCode: `2000${i}`,
    addressLine1: `${100 + i} Demo Floor Ave`,
    address: {
      line1: `${100 + i} Demo Floor Ave`,
      city: "Washington",
      state: "DC",
      postalCode: `2000${i}`,
      country: "US"
    },
    fullAddress: `${100 + i} Demo Floor Ave, Washington, DC 2000${i}`,
    tagline: `Demo nightlife venue ${i} — scheduling, hail, and featured events.`,
    description: `Full-profile demo venue ${i} for FLOQR scheduling, hail a waitress, and featured genre nights. Hours use atomic hour / minute / AM|PM datapoints.`,
    agePolicy: "21+",
    dressCode: "Upscale nightlife",
    hoursStructured: hoursWeek,
    openingHours: hoursWeek,
    hours: hoursLines.join("; "),
    hoursDisplayLines: hoursLines,
    hoursSource: "seed-normalized",
    hoursTimezone: hoursWeek.timezone || "America/New_York",
    services: ["vip", "bottle", "tables", "scheduling", "hail", "shoutout", "guestList"],
    floqrServices: ["ShoutOut", "Guest List", "VIP", "Scheduling", "Hail"],
    displayFormats: ["led-64x32", "led-96x48"],
    displayScreenFormatIds: ["led-96x48", "led-64x48", "led-64x32"],
    primaryDisplayScreenFormatId: "led-96x48",
    genres: GENRES.map((g) => g.genre),
    amenities: ["VIP booths", "Bottle service", "Dance floor", "Coat check", "Valet"],
    featuredDjs: i === 1 ? djs : [djs[i - 1]],
    featuredStaff: i === 1 ? staff : [],
    promotionGroups: [{
      name: displayName("promogroup", i),
      email: emailFor("promogroup", i),
      bio: "Demo promotion group"
    }],
    publicSections: {
      about: true, contact: true, upcomingEvents: true, pastEvents: true,
      featuredDjs: true, featuredStaff: true, promotionGroups: true, gallery: true
    },
    publicProfileSections: {
      about: true, contact: true, upcomingEvents: true, pastEvents: true,
      featuredDjs: true, featuredStaff: true, promotionGroups: true, gallery: true
    },
    tableMapKey: i === 1 ? "decades-dc" : (i === 2 ? "lima-twist-dc" : ""),
    adminUids: adminAccount?.uid ? [adminAccount.uid] : [],
    adminEmails: [emailFor("clubadmin", i), emailFor("democlub", i)],
    sourceUrls: [
      `https://example.com/temp-democlub-${i}`,
      `https://example.com/temp-democlub-${i}/events`
    ],
    onboardingSource: "temp-demo-seed",
    logoUrl: `${ORIGIN}/assets/demo-temp/icons/temp_democlub_${i}.svg`,
    mainImageUrl: `${ORIGIN}/assets/demo-temp/avatars/temp_democlub_${i}.svg`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function eventDoc(clubIndex, djAccount, dayOffset) {
  const locationId = `temp-democlub-${clubIndex}`;
  const when = new Date();
  when.setDate(when.getDate() + dayOffset);
  when.setHours(22, 0, 0, 0);
  const id = `temp-event-${locationId}-dj${djAccount.index}`;
  const startClock = makeClock({hour: 10, minute: 0, meridiem: "PM"});
  return {
    id,
    locationId,
    clubLocationId: locationId,
    clubId: locationId,
    eventName: `${djAccount.genre} Night · ${djAccount.displayName}`,
    title: `${djAccount.genre} Night · ${djAccount.displayName}`,
    description: `Featured ${djAccount.genre} set with ${djAccount.displayName}.`,
    eventDate: when.toISOString().slice(0, 10),
    date: when.toISOString().slice(0, 10),
    startDate: when.toISOString().slice(0, 10),
    eventDay: DAYS[when.getDay() === 0 ? 6 : when.getDay() - 1],
    eventTime: startClock.display,
    eventTimeStructured: startClock,
    genres: [djAccount.genre],
    artists: [djAccount.displayName],
    featuredDjs: [djAccount.displayName],
    presentedBy: [`Temp Promo Group ${clubIndex}`],
    promoters: [`temp-promogroup-${clubIndex}`],
    agePolicy: "21+",
    ticketUrl: `https://example.com/tickets/${id}`,
    vipPassUrl: `https://example.com/vip/${id}`,
    bottleServiceUrl: `https://example.com/bottle/${id}`,
    eventsPageUrl: `https://example.com/temp-democlub-${clubIndex}/events`,
    sourceUrls: [
      `https://example.com/temp-democlub-${clubIndex}/events`,
      `https://example.com/tickets/${id}`
    ],
    onboardingSource: "temp-demo-seed",
    featured: true,
    status: "active",
    demoTemp: true,
    demoPack: "temp-v1",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function isoForDayClock(dayDate, clock, nextDay = false) {
  const d = new Date(dayDate);
  if (nextDay) d.setDate(d.getDate() + 1);
  const h24 = clock.hour24 != null ? clock.hour24 : (clock.meridiem === "PM"
    ? (clock.hour === 12 ? 12 : clock.hour + 12)
    : (clock.hour === 12 ? 0 : clock.hour));
  d.setHours(h24, clock.minute || 0, 0, 0);
  return d.toISOString();
}

function scheduleForClub1(accounts, clubAdminUid) {
  const locationId = "temp-democlub-1";
  const ownerKey = `club:${locationId}`;
  const workers = accounts.filter((a) =>
    ["waitress", "bottlegirl", "busboy", "security", "host", "barman", "dj"].includes(a.role) && a.index === 1
  );
  const shifts = [];
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  for (let d = 0; d < 7; d++) {
    const day = new Date(start);
    day.setDate(start.getDate() + d);
    const weekday = DAYS[day.getDay() === 0 ? 6 : day.getDay() - 1];
    if (weekday === "monday" || weekday === "tuesday") continue;
    const open = makeClock({hour: 10, minute: 35, meridiem: "PM"});
    const close = makeClock({hour: 2, minute: 0, meridiem: "AM"});
    workers.forEach((w, idx) => {
      const startsAt = isoForDayClock(day, open, false);
      const endsAt = isoForDayClock(day, close, true);
      shifts.push({
        id: `temp-shift-${locationId}-${day.toISOString().slice(0, 10)}-${w.role}`,
        ownerKey,
        ownerType: "club",
        ownerId: locationId,
        ownerName: clubNames(1),
        clubLocationId: locationId,
        roleLabel: ROLE_LABELS[w.role] || w.role,
        role: w.role,
        assigneeUid: w.uid,
        assigneeName: w.displayName,
        assigneeEmail: w.email,
        assigneePhone: SINK_SMS,
        startsAt,
        endsAt,
        startsAtMs: Date.parse(startsAt),
        endsAtMs: Date.parse(endsAt),
        startsAtLabel: `${weekday} ${open.display}`,
        endsAtLabel: close.display,
        startClock: open,
        endClock: close,
        weekday,
        dayKey: day.toISOString().slice(0, 10),
        venueName: clubNames(1),
        notes: "Demo seed shift — temp pack",
        status: "confirmed",
        requireApproval: false,
        demoTemp: true,
        demoPack: "temp-v1",
        createdByUid: clubAdminUid || null,
        sort: idx
      });
    });
  }
  return shifts;
}

async function runSeed() {
  const accounts = buildAccounts();
  for (const account of accounts) {
    account.uid = await ensureAuthUser(account);
    const profile = {
      uid: account.uid,
      email: account.email,
      displayName: account.displayName,
      publicName: account.displayName,
      role: account.role,
      roles: [account.role],
      approvedRoles: [ROLE_LABELS[account.role] || account.role],
      phone: SINK_SMS,
      demoTemp: true,
      demoPack: "temp-v1",
      loginCode: account.loginCode,
      deliveryRedirect: {emailTo: SINK_EMAIL, smsTo: SINK_SMS, intendedEmail: account.email},
      avatarUrl: `${ORIGIN}/${account.avatarPath}`,
      iconUrl: `${ORIGIN}/${account.iconPath}`,
      genre: account.genre || null,
      locationId: account.locationId || (account.clubIndex ? `temp-democlub-${account.clubIndex}` : null),
      clubLocationId: account.locationId || (account.role !== "promogroup" && account.clubIndex ? `temp-democlub-${account.clubIndex}` : null),
      promoGroupId: account.promoGroupId || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("userProfiles").doc(account.uid).set(profile, {merge: true});
    await db.collection("users").doc(account.uid).set({
      uid: account.uid,
      email: account.email,
      displayName: account.displayName,
      approvedRoles: profile.approvedRoles,
      phone: SINK_SMS,
      demoTemp: true,
      demoPack: "temp-v1",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
  }

  const clubAdmin1 = accounts.find((a) => a.key === "temp_clubadmin_1");
  for (let i = 1; i <= 4; i++) {
    const adminAcct = accounts.find((a) => a.key === `temp_clubadmin_${i}`) || clubAdmin1;
    const hours = defaultWeekHours(i - 1);
    const club = clubDoc(i, adminAcct, hours);
    await db.collection("clubLocations").doc(club.locationId).set(club, {merge: true});
    await db.collection("clubs").doc(club.locationId).set({
      clubId: club.locationId,
      clubName: club.clubName,
      brandName: club.brandName,
      primaryLocationId: club.locationId,
      demoTemp: true,
      demoPack: "temp-v1",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    const subKey = `club:${club.locationId}`;
    await db.collection("schedulingSubscriptions").doc(subKey).set({
      ownerKey: subKey,
      ownerType: "club",
      ownerId: club.locationId,
      ownerName: club.clubName,
      ownerUid: adminAcct?.uid || null,
      locationId: club.locationId,
      clubLocationId: club.locationId,
      status: "active",
      plan: "demo",
      demoTemp: true,
      demoPack: "temp-v1",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
  }

  const locationId1 = "temp-democlub-1";
  for (const role of ["waitress", "bottlegirl", "busboy", "security", "host", "barman", "dj", "clubadmin"]) {
    const a = accounts.find((x) => x.role === role && x.index === 1);
    if (!a?.uid) continue;
    const designationId = `${locationId1}_${a.uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    await db.collection("clubEmployeeDesignations").doc(designationId).set({
      clubLocationId: locationId1,
      clubLocationName: clubNames(1),
      workerUid: a.uid,
      workerEmail: a.email,
      workerName: a.displayName,
      workerRoles: [ROLE_LABELS[role] || role],
      roleElectionType: ROLE_LABELS[role] || role,
      rolePermissions: role === "clubadmin" ? ["manageSchedules"] : [],
      status: "approved",
      demoTemp: true,
      demoPack: "temp-v1",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
  }

  const djs = accounts.filter((a) => a.role === "dj");
  for (let i = 0; i < djs.length; i++) {
    const ev = eventDoc(1, djs[i], i + 1);
    await db.collection("events").doc(ev.id).set(ev, {merge: true});
  }
  for (let club = 2; club <= 4; club++) {
    const dj = djs.find((d) => d.index === club);
    if (!dj) continue;
    const ev = eventDoc(club, dj, club);
    await db.collection("events").doc(ev.id).set(ev, {merge: true});
  }

  const shifts = scheduleForClub1(accounts, clubAdmin1 && clubAdmin1.uid);
  for (const shift of shifts) {
    await db.collection("scheduleShifts").doc(shift.id).set({
      ...shift,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
  }

  const manifest = {
    pack: "temp-v1",
    createdAt: new Date().toISOString(),
    sinkEmail: SINK_EMAIL,
    sinkSms: SINK_SMS,
    passwordNote: "Default FloqrDemo2026! (override FLOQR_DEMO_PASSWORD on Functions)",
    accounts: accounts.map((a) => ({
      key: a.key,
      uid: a.uid,
      email: a.email,
      role: a.role,
      displayName: a.displayName,
      loginCode: a.loginCode,
      genre: a.genre || null,
      locationId: a.locationId || (a.clubIndex ? `temp-democlub-${a.clubIndex}` : null)
    })),
    clubs: [1, 2, 3, 4].map((i) => `temp-democlub-${i}`),
    scheduleLocationId: "temp-democlub-1",
    shiftCount: shifts.length,
    profileUrl: `${ORIGIN}/club-profile.html?location=temp-democlub-1`,
    adminUrl: `${ORIGIN}/admin.html?location=temp-democlub-1&v=29.09.122`
  };
  await db.doc(META_DOC).set({
    ...manifest,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, {merge: true});
  return manifest;
}

async function runPurge() {
  const metaSnap = await db.doc(META_DOC).get();
  const accounts = metaSnap.exists ? (metaSnap.data().accounts || []) : [];
  for (const a of accounts) {
    try {
      if (a.uid) await admin.auth().deleteUser(a.uid);
    } catch (_) { /* ignore */ }
    if (a.uid) {
      await db.collection("userProfiles").doc(a.uid).delete().catch(() => {});
      await db.collection("users").doc(a.uid).delete().catch(() => {});
    }
  }
  for (let i = 1; i <= 4; i++) {
    const loc = `temp-democlub-${i}`;
    await db.collection("clubLocations").doc(loc).delete().catch(() => {});
    await db.collection("clubs").doc(loc).delete().catch(() => {});
    await db.collection("schedulingSubscriptions").doc(`club:${loc}`).delete().catch(() => {});
    const events = await db.collection("events").where("locationId", "==", loc).get();
    for (const doc of events.docs) await doc.ref.delete();
    const shifts = await db.collection("scheduleShifts").where("clubLocationId", "==", loc).get();
    for (const doc of shifts.docs) await doc.ref.delete();
    const des = await db.collection("clubEmployeeDesignations").where("clubLocationId", "==", loc).get();
    for (const doc of des.docs) await doc.ref.delete();
  }
  await db.doc(META_DOC).delete().catch(() => {});
  return {purged: true, accounts: accounts.length};
}

exports.seedTempDemoPack = onCall({region: "us-central1", timeoutSeconds: 300, memory: "512MiB"}, async (request) => {
  await assertMasterAdmin(request.auth);
  const action = text(request.data?.action || "seed", 20).toLowerCase();
  if (action === "purge") return runPurge();
  return runSeed();
});
