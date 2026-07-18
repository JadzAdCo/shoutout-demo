"use strict";
const fs = require("fs");
const path = require("path");
const srcPath = path.join(__dirname, "onboard-dc-venues.js");
const src = fs.readFileSync(srcPath, "utf8");
const start = src.indexOf("const venues = [");
const end = src.indexOf("\n];", start);
if (start < 0 || end < 0) throw new Error("venues array not found");
const arrayText = src.slice(start + "const venues = ".length, end + 2);
const venues = Function(`"use strict"; return (${arrayText});`)();
const enriched = venues.map(v => ({
  ...v,
  clubId: v.id,
  clubName: v.locationName || v.brandName,
  country: "United States",
  region: "District of Columbia",
  stateRegion: "District of Columbia",
  regionType: "District",
  city: "Washington",
  locationLabel: "Washington, District of Columbia, United States",
  publicProfileType: "club",
  visibility: "public",
  published: true,
  services: v.services || ["shoutout", "guestList", "vip"],
  floqrServices: v.floqrServices || ["ShoutOut", "Guest List", "VIP Reservation"],
  maxGuestListCampaigns: 6,
  mediaPolicy: {
    maxMainMedia: 1,
    maxPublicImages: 5,
    maxPublicVideos: 5,
    maxMarketingVideoSeconds: 15
  },
  displayScreenFormatIds: v.displayScreenFormatIds || ["led-96x48", "led-64x48", "led-64x32"],
  primaryDisplayScreenFormatId: v.primaryDisplayScreenFormatId || "led-96x48",
  templates: v.templates || ["hiphop", "vip", "bottle", "neon", "birthday"],
  active: true,
  onboardingSource: "website-extract-batch-dc"
}));
const outPath = path.join(__dirname, "..", "..", "onboarding", "dc-venues-payload.js");
const out = `(function (g) {\n  "use strict";\n  g.FLOQR_DC_VENUE_ONBOARDING = ${JSON.stringify(enriched, null, 2)};\n})(typeof window !== "undefined" ? window : globalThis);\n`;
fs.writeFileSync(outPath, out);
console.log("wrote", enriched.length, "venues to", outPath);
