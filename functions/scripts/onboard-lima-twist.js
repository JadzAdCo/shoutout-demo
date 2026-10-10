/* One-shot: onboard LIMA Twist from extracted website datapoints. */
"use strict";
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({projectId: "shoutoutdemo-5b402"});
const db = admin.firestore();

const id = "lima-twist-washington-dc";
const now = admin.firestore.FieldValue.serverTimestamp();

const payload = {
  id,
  clubId: id,
  locationName: "LIMA Twist",
  clubName: "LIMA Twist",
  brandName: "LIMA Twist",
  type: "club",
  categories: ["Restaurant", "Bar", "Lounge", "Nightlife", "Clubs", "Events", "ShoutOut"],
  streetAddress: "1411 K Street NW",
  addressLine1: "1411 K Street NW",
  fullAddress: "1411 K Street NW, Washington, DC 20005, United States",
  address: "1411 K Street NW, Washington, DC 20005, United States",
  city: "Washington",
  region: "District of Columbia",
  stateRegion: "District of Columbia",
  regionType: "District",
  postalCode: "20005",
  country: "United States",
  locationLabel: "Washington, District of Columbia, United States",
  telephone: "+12025067151",
  phoneDisplay: "(202) 506-7151",
  officialWebsite: "https://www.limatwist.com/",
  email: "",
  socialMediaHandles: {
    instagram: "@limatwistdc",
    facebook: "https://www.facebook.com/limatwistdc/",
    x: "",
    tiktok: ""
  },
  logoUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/be6ac216-be12-4708-a090-69e3666a2f13/LIMA+Logo+web.png?format=1500w",
  tagline: "Join us for a meal to remember!",
  description: "Located in Downtown Washington DC, LIMA Twist serves South American Fusion cuisine. Restaurant by day; by night the twist reveals itself through light, state-of-the-art sound, and house-rooted musical programming. Guests are at the heart of the LIMA Twist experience.",
  concept: "The legendary LIMA is back — Restaurant | Bar | Lounge | Valet Parking.",
  cuisine: "South American Fusion",
  genres: ["House", "Deep House", "EDM", "Latin", "International"],
  artists: ["Curated DJs"],
  amenities: ["Valet Parking", "Restaurant", "Bar", "Lounge", "Bottle Service", "VIP tables", "Cocktail program", "Wine list"],
  hours: "Fri–Sat 7:00 PM–3:00 AM; Sun 7:00 PM–1:00 AM; Mon–Thu closed (per limatwist.com/contact)",
  hoursStructured: {
    mon: "Closed",
    tue: "Closed",
    wed: "Closed",
    thu: "Closed",
    fri: "19:00-03:00",
    sat: "19:00-03:00",
    sun: "19:00-01:00"
  },
  hoursNote: "OpenTable also lists brunch Sun 2:00–5:00 PM and dinner Thu–Sat 7:00–11:30 PM — confirm with venue; FloqR primary hours taken from official contact page.",
  reservationsUrl: "https://www.opentable.com/r/lima-twist-washington",
  menuUrl: "https://www.limatwist.com/menu",
  contactUrl: "https://www.limatwist.com/contact",
  agePolicy: "21+ nightlife (confirm with door policy)",
  dressCode: "Upscale nightlife attire",
  services: ["shoutout", "guestList", "vip"],
  floqrServices: ["ShoutOut", "Guest List", "VIP Reservation"],
  brand: "LIMA TWIST DC x FLOQR",
  defaultMain: "USE SHOUT OUT @ LIMA TWIST",
  defaultSub: "Downtown DC",
  activityStatus: "Active downtown DC restaurant / bar / lounge",
  activityDates: [
    "Friday late-night lounge / house programming",
    "Saturday late-night lounge / house programming",
    "Sunday evening lounge"
  ],
  templates: ["edm", "latin", "vip", "bottle", "birthday", "neon", "gold"],
  displayScreenFormatIds: ["led-96x48", "led-64x48", "led-64x32"],
  primaryDisplayScreenFormatId: "led-96x48",
  publicProfileType: "club",
  visibility: "public",
  published: true,
  publicSections: {
    about: true,
    contact: true,
    upcomingEvents: true,
    pastEvents: true,
    featuredDjs: true,
    featuredStaff: true,
    promotionGroups: true,
    gallery: true
  },
  maxGuestListCampaigns: 6,
  mediaPolicy: {
    maxMainMedia: 1,
    maxPublicImages: 5,
    maxPublicVideos: 5,
    maxMarketingVideoSeconds: 15
  },
  sourceUrls: [
    "https://www.limatwist.com/",
    "https://www.limatwist.com/contact",
    "https://www.limatwist.com/menu",
    "https://www.instagram.com/limatwistdc",
    "https://www.facebook.com/limatwistdc/",
    "https://www.opentable.com/r/lima-twist-washington"
  ],
  onboardingSource: "website-extract-limatwist.com",
  onboardingVersion: "v29.09.12",
  active: true,
  updatedAt: now,
  createdAt: now
};

async function main() {
  await db.collection("clubLocations").doc(id).set(payload, {merge: true});
  await db.collection("clubs").doc(id).set({
    clubId: id,
    clubName: payload.clubName,
    brandName: payload.brandName,
    primaryLocationId: id,
    officialWebsite: payload.officialWebsite,
    telephone: payload.telephone,
    updatedAt: now,
    createdAt: now
  }, {merge: true});
  await db.collection("clubOnboardingRecords").doc(id).set({
    ...payload,
    adminPortalUrl: `https://jadzadco.github.io/shoutout-demo/admin.html?location=${id}&v=29.09.12`,
    displayUrl: `https://jadzadco.github.io/shoutout-demo/display.html?location=${id}&v=29.09.12`,
    publicProfileUrl: `https://jadzadco.github.io/shoutout-demo/club-profile.html?location=${id}&v=29.09.12`,
    status: "created"
  }, {merge: true});
  console.log(JSON.stringify({ok: true, id, locationName: payload.locationName}, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
