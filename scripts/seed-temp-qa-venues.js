/* Seed Firestore clubLocations for temp-democlub-1..10 (QA only). */
"use strict";

const path = require("path");
const admin = require("../functions/node_modules/firebase-admin");
const fauth = require(path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib/auth"));

const BASE = "https://jadzadco.github.io/shoutout-demo/images/temp-qa";

function hoursStructured() {
  return {
    sun: {closed: true, open: "", close: ""},
    mon: {closed: true, open: "", close: ""},
    tue: {closed: true, open: "", close: ""},
    wed: {closed: true, open: "", close: ""},
    thu: {closed: false, open: "22:00", close: "03:00"},
    fri: {closed: false, open: "22:00", close: "03:00"},
    sat: {closed: false, open: "22:00", close: "03:00"}
  };
}

function clubPayload(n) {
  const id = `temp-democlub-${n}`;
  return {
    brandName: `Temp Demo Club ${n}`,
    locationName: `Temp Demo Club ${n}`,
    type: "club",
    categories: ["Clubs", "Lounge", "Nightlife", "Events", "ShoutOut", "QA Demo"],
    country: "United States",
    regionType: "District",
    region: "District of Columbia",
    city: "Washington",
    streetAddress: `${1000 + n} Demo Plaza NW`,
    postalCode: "20001",
    locationLabel: "Washington, District of Columbia",
    brand: `TEMP DEMO CLUB ${n} x FLOQR`,
    defaultMain: `USE ShoutOut @ TEMP DEMO ${n}`,
    defaultSub: "QA Venue",
    tagline: `Full-profile demo venue ${n} for FLOQR scheduling, hail a waitress, and featured genre nights.`,
    description: `Full-profile demo venue ${n} for FLOQR scheduling, hail a waitress, and featured genre nights. Hours use atomic hour / minute / AM|PM datapoints.`,
    genres: ["Hip Hop", "Open Format", "House"],
    artists: [`Temp DJ ${n}`, "Temp DJ Guest"],
    artistsOrDjs: [`Temp DJ ${n}`, "Temp DJ Guest"],
    promoters: [`Temp Promoter ${n} Collective`],
    amenities: ["VIP tables", "Bottle service", "Coat check", "Dance floor"],
    agePolicy: "21+",
    dressCode: "Upscale / smart casual",
    cuisine: "Nightlife small plates",
    telephone: `+12025550${String(100 + n).slice(-3)}`,
    email: `temp_clubadmin_${n}@floqr-demo.com`,
    officialWebsite: `https://jadzadco.github.io/shoutout-demo/club-profile.html?location=${id}`,
    socialMediaHandles: {
      instagram: `@tempdemoclub${n}`,
      facebook: "",
      x: `@tempdemoclub${n}`,
      tiktok: `@tempdemoclub${n}`,
      floqrHandle: `@tempdemoclub${n}`
    },
    logoUrl: `${BASE}/club-${n}-logo.svg`,
    mainImageUrl: `${BASE}/club-${n}-venue.svg`,
    mainMediaUrl: `${BASE}/club-${n}-venue.svg`,
    mainMediaType: "image",
    publicGallery: [
      {mediaUrl: `${BASE}/club-${n}-gallery-a.svg`, mediaType: "image", slotType: "gallery", title: "VIP Room", galleryOrder: 1},
      {mediaUrl: `${BASE}/club-${n}-gallery-b.svg`, mediaType: "image", slotType: "gallery", title: "Entrance", galleryOrder: 2}
    ],
    featuredDjs: [
      {
        name: `Temp DJ ${n}`,
        role: "Resident DJ",
        email: `temp_dj_${n}@floqr-demo.com`,
        photoUrl: `${BASE}/dj-${n}.svg`,
        bio: `QA resident DJ for Temp Demo Club ${n}.`,
        instagram: `@temp_dj_${n}`
      },
      {
        name: "Temp DJ Guest",
        role: "Guest DJ",
        email: `temp_dj_guest_${n}@floqr-demo.com`,
        photoUrl: `${BASE}/dj-${n}.svg`,
        bio: "Rotating guest talent for QA nights."
      }
    ],
    featuredStaff: [
      {
        name: `Temp Waitress ${n}`,
        role: "Waitress",
        email: `temp_waitress_${n}@floqr-demo.com`,
        photoUrl: `${BASE}/waitress-${n}.svg`,
        bio: "QA service staff — hail a waitress flows."
      },
      {
        name: `Temp Waiter ${n}`,
        role: "Waiter",
        email: `temp_waiter_${n}@floqr-demo.com`,
        photoUrl: `${BASE}/waiter-${n}.svg`,
        bio: "QA floor service for VIP tables."
      },
      {
        name: `Temp Bottle ${n}`,
        role: "Bottle Service",
        email: `temp_bottle_${n}@floqr-demo.com`,
        photoUrl: `${BASE}/bottle-${n}.svg`,
        bio: "QA bottle service specialist."
      },
      {
        name: `Temp Club Admin ${n}`,
        role: "Club Admin",
        email: `temp_clubadmin_${n}@floqr-demo.com`,
        photoUrl: `${BASE}/admin-${n}.svg`,
        bio: `QA Club Admin mapped to ${id}.`
      }
    ],
    promotionGroups: [
      {
        name: `Temp Promoter ${n} Collective`,
        role: "Promotion Group",
        email: `temp_promoter_${n}@floqr-demo.com`,
        photoUrl: `${BASE}/promoter-${n}.svg`,
        bio: "QA promotion group for guest list and genre nights."
      }
    ],
    hours: "Thu–Sat 22:00–03:00",
    hoursStructured: hoursStructured(),
    hoursExceptions: [],
    timeZone: "America/New_York",
    activityStatus: "Demo Club Admin training venue",
    activityDates: ["Friday Demo Night", "Saturday Demo Night"],
    templates: ["birthday", "vip", "bottle", "neon"],
    demo: true,
    isDemo: true,
    qaTemp: true,
    staffSchedulingPaid: 1,
    displayScreenFormatIds: ["led-96x48", "led-64x32"],
    primaryDisplayScreenFormatId: "led-96x48",
    publicProfilePublished: true,
    visibility: "public",
    active: true,
    publicProfileSections: {
      about: true,
      contact: true,
      upcomingEvents: true,
      pastEvents: true,
      featuredDjs: true,
      featuredStaff: true,
      promotionGroups: true,
      gallery: true
    },
    updatedBy: "seed-temp-qa-venues"
  };
}

(async () => {
  const access = await fauth.getAccessToken(true);
  const token = typeof access === "string" ? access : (access && (access.access_token || access.token));
  if (!token) throw new Error("No Firebase CLI access token available");

  admin.initializeApp({
    projectId: "shoutoutdemo-5b402",
    credential: {
      getAccessToken: async () => ({access_token: token, expires_in: 3500})
    }
  });

  const db = admin.firestore();
  let clubsUpdated = 0;
  for (let n = 1; n <= 10; n += 1) {
    const id = `temp-democlub-${n}`;
    const payload = {
      ...clubPayload(n),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("clubLocations").doc(id).set(payload, {merge: true});
    clubsUpdated += 1;
  }

  let usersUpdated = 0;
  const usersSnap = await db.collection("users").limit(500).get();
  for (const doc of usersSnap.docs) {
    const data = doc.data() || {};
    const email = String(data.email || "").toLowerCase();
    const match = email.match(/^temp_(clubadmin|dj|waitress|waiter|bottle|promoter)_(\d+)@floqr-demo\.com$/);
    if (!match) continue;
    const role = match[1];
    const n = Number(match[2]);
    const file = role === "clubadmin" ? `admin-${n}.svg` : `${role}-${n}.svg`;
    const photoURL = `${BASE}/${file}`;
    const displayName = role === "clubadmin"
      ? `Temp Club Admin ${n}`
      : `Temp ${role.charAt(0).toUpperCase()}${role.slice(1)} ${n}`;
    await doc.ref.set({
      displayName: data.displayName || displayName,
      fullName: data.fullName || displayName,
      photoURL,
      profilePhotoUrl: photoURL,
      avatarUrl: photoURL,
      qaTemp: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    usersUpdated += 1;
  }

  console.log(JSON.stringify({ok: true, clubsUpdated, usersUpdated}, null, 2));
  process.exit(0);
})().catch(err => {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
