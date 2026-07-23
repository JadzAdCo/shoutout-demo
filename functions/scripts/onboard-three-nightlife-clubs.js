/* Onboard Decades, Mayflower, and LIMA Twist with crawled events + gallery media. */
"use strict";
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({projectId: "shoutoutdemo-5b402"});
const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();
const ORIGIN = "https://jadzadco.github.io/shoutout-demo";
const VERSION = "v29.09.48";

function venueBase(row) {
  const id = row.id;
  return {
    ...row,
    clubId: id,
    locationName: row.locationName || row.brandName,
    clubName: row.locationName || row.brandName,
    country: "United States",
    regionType: "District",
    region: "District of Columbia",
    stateRegion: "District of Columbia",
    city: "Washington",
    locationLabel: "Washington, District of Columbia, United States",
    publicProfileType: "club",
    visibility: "public",
    published: true,
    services: row.services || ["shoutout", "guestList", "vip"],
    floqrServices: row.floqrServices || ["ShoutOut", "Guest List", "VIP Reservation"],
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
    displayScreenFormatIds: row.displayScreenFormatIds || ["led-96x48", "led-64x48", "led-64x32"],
    primaryDisplayScreenFormatId: row.primaryDisplayScreenFormatId || "led-96x48",
    templates: row.templates || ["hiphop", "vip", "bottle", "neon", "birthday"],
    active: true,
    onboardingSource: row.onboardingSource || "website-extract-batch-dc-nightlife",
    onboardingVersion: VERSION,
    updatedAt: now,
    createdAt: now
  };
}

const venues = [
  {
    id: "decades-washington-dc",
    brandName: "Decades",
    locationName: "Decades Nightclub",
    type: "club",
    categories: ["Clubs", "Retro", "Nightlife", "Events", "ShoutOut"],
    streetAddress: "1219 Connecticut Avenue NW",
    addressLine1: "1219 Connecticut Avenue NW",
    fullAddress: "1219 Connecticut Avenue NW, Washington, DC 20036, United States",
    postalCode: "20036",
    telephone: "+12026507326",
    phoneDisplay: "(202) 650-7326",
    officialWebsite: "https://decadesdc.com/",
    eventsUrl: "https://decadesdc.com/weekly-events/",
    logoUrl: "https://decadesdc.com/wp-content/uploads/2024/02/Logo-p-500x97-1-1.png",
    mainMediaUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2024/02/722A8852.jpg?ssl=1",
    mainMediaType: "image",
    coverImageUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2024/02/722A8852.jpg?ssl=1",
    tagline: "DC's only multi-level retro nightclub",
    description: "Located in the heart of Dupont Circle / Connecticut Ave, Decades is a 15,000 sq ft retro-themed nightclub with 6 floors, 8 bars, and 5 DJs — plus a retractable rooftop, VIP passes, bottle service, and weekly themed nights (Summer Beach Club, Fridays, Saturdays, Sueño Sundays).",
    genres: ["Hip Hop", "Top 40", "Throwbacks", "EDM", "House", "Reggaeton", "Techno", "International"],
    artists: ["5 DJs", "Guest DJs"],
    amenities: ["6 floors", "8 bars", "5 DJs", "Retractable rooftop", "VIP passes", "Bottle service", "Private events", "Birthday experiences"],
    hours: "Event-driven (typically Thu–Sun late night; confirm each event)",
    brand: "DECADES DC x FLOQR",
    defaultMain: "USE SHOUT OUT @ DECADES",
    defaultSub: "Dupont / Connecticut Ave",
    activityStatus: "Active multi-level retro nightclub — weekly Beach Club / Fridays / Saturdays / Sueño Sundays",
    activityDates: ["Thu Summer Beach Club (18+)", "Fri Fridays at Decades (21+)", "Sat Saturdays at Decades (21+)", "Sun Sueño Sundays rooftop"],
    templates: ["hiphop", "edm", "vip", "bottle", "neon", "birthday"],
    onboardingSource: "website-extract-decadesdc.com",
    sourceUrls: ["https://decadesdc.com/", "https://decadesdc.com/weekly-events/"]
  },
  {
    id: "mayflower-washington-dc",
    brandName: "The Mayflower",
    locationName: "The Mayflower DC",
    type: "club",
    categories: ["Clubs", "Lounge", "Restaurant", "Nightlife", "Events", "Private Events", "ShoutOut"],
    aliasNames: ["Mayflower Club DC", "The Mayflower Club", "Zebbie's Garden"],
    streetAddress: "1223 Connecticut Avenue NW",
    addressLine1: "1223 Connecticut Avenue NW",
    fullAddress: "1223 Connecticut Avenue NW, Washington, DC 20036, United States",
    postalCode: "20036",
    telephone: "+12022711171",
    phoneDisplay: "(202) 271-1171",
    email: "info@mayflowerclubdc.com",
    eventsEmail: "events@mayflowerclubdc.com",
    officialWebsite: "https://www.themayflowerdc.com/",
    eventsUrl: "https://www.themayflowerdc.com/weekly-events",
    reservationsUrl: "https://www.themayflowerdc.com/reservations",
    logoUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/6099e2367e59b6b7dd31c8f4_Mayflower_Icon.png",
    mainMediaUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/6776ceb045575851c01b68b2_websitecover.jpg",
    mainMediaType: "image",
    coverImageUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/6776ceb045575851c01b68b2_websitecover.jpg",
    tagline: "DC's newest multi-level lounge, garden & event space",
    description: "Historic Connecticut Ave speakeasy legacy (est. 1933) reborn as The Mayflower Club — multi-level lounge, dinner service, bottle service, and Zebbie's Garden nightlife. Private events for groups from 10 to 800.",
    genres: ["Lounge", "Hip Hop", "Open Format", "House", "Top 40"],
    artists: ["Curated DJs"],
    amenities: ["Multi-level lounge", "Dinner service", "Bottle service", "Private events (10–800)", "Zebbie's Garden", "VIP / reservations"],
    hours: "Mayflower: Fri–Sat 6:00 PM–11:45 PM dinner / bar to 3:00 AM. Zebbie's Garden: Thu 10:00 PM–2:00 AM; Fri–Sat 10:00 PM–3:00 AM; Mon–Wed closed",
    brand: "MAYFLOWER DC x FLOQR",
    defaultMain: "USE SHOUT OUT @ MAYFLOWER",
    defaultSub: "Connecticut Ave",
    activityStatus: "Active multi-level lounge / garden / event space on Connecticut Ave",
    activityDates: ["Friday dinner + late bar", "Saturday dinner + late bar", "Thursday Zebbie's Garden", "Friday–Saturday Zebbie's Garden", "Private events"],
    templates: ["vip", "bottle", "gold", "neon", "hiphop", "birthday"],
    onboardingSource: "website-extract-themayflowerdc.com",
    sourceUrls: [
      "https://www.themayflowerdc.com/",
      "https://www.themayflowerdc.com/aboutus",
      "https://www.themayflowerdc.com/weekly-events",
      "https://www.themayflowerdc.com/bottle-service",
      "https://www.themayflowerdc.com/private-events/private-events"
    ]
  },
  {
    id: "lima-twist-washington-dc",
    brandName: "LIMA Twist",
    locationName: "LIMA Twist",
    type: "club",
    categories: ["Restaurant", "Bar", "Lounge", "Nightlife", "Clubs", "Events", "ShoutOut"],
    streetAddress: "1411 K Street NW",
    addressLine1: "1411 K Street NW",
    fullAddress: "1411 K Street NW, Washington, DC 20005, United States",
    postalCode: "20005",
    telephone: "+12025067151",
    phoneDisplay: "(202) 506-7151",
    officialWebsite: "https://www.limatwist.com/",
    logoUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/5d815a65-4fc9-4128-a947-f8058a482da0/LIMA+Logo+web.png?format=1500w",
    mainMediaUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/fb22d58b-4396-4697-8eea-da403bc01db8/LIMA-115.png?format=1500w",
    mainMediaType: "image",
    coverImageUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/fb22d58b-4396-4697-8eea-da403bc01db8/LIMA-115.png?format=1500w",
    socialMediaHandles: {
      instagram: "@limatwistdc",
      facebook: "https://www.facebook.com/limatwistdc/",
      x: "",
      tiktok: ""
    },
    tagline: "Join us for a meal to remember!",
    description: "Downtown DC South American Fusion restaurant, bar, and lounge. Restaurant by day; by night the twist reveals itself through light, state-of-the-art sound, and house-rooted musical programming — festive nightlife with bottle service and private events.",
    cuisine: "South American Fusion",
    genres: ["House", "Deep House", "EDM", "Latin", "International"],
    artists: ["Curated DJs"],
    amenities: ["Valet Parking", "Restaurant", "Bar", "Lounge", "Bottle Service", "Private events", "OpenTable reservations"],
    dressCode: "Smart upscale — collared shirts, fashion-forward denim OK; no sportswear, hats, or flip-flops",
    hours: "Fri–Sat 7:00 PM–3:00 AM; Sun 7:00 PM–1:00 AM; Mon–Thu closed",
    menuUrl: "https://www.limatwist.com/menu",
    reservationsUrl: "https://www.opentable.com/r/lima-twist-washington",
    eventsUrl: "https://www.limatwist.com/private-events",
    brand: "LIMA TWIST DC x FLOQR",
    defaultMain: "USE SHOUT OUT @ LIMA TWIST",
    defaultSub: "Downtown DC",
    activityStatus: "Active downtown DC restaurant / bar / lounge with late-night house nightlife",
    activityDates: ["Friday late-night lounge / house", "Saturday late-night lounge / house", "Sunday evening lounge", "Private events"],
    templates: ["edm", "latin", "vip", "bottle", "birthday", "neon", "gold"],
    onboardingSource: "website-extract-limatwist.com",
    sourceUrls: [
      "https://www.limatwist.com/",
      "https://www.limatwist.com/contact",
      "https://www.limatwist.com/menu",
      "https://www.limatwist.com/private-events"
    ]
  }
];

const mediaByClub = {
  "decades-washington-dc": {
    main: {
      title: "Decades Nightclub floor",
      mediaUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2024/02/722A8852.jpg?ssl=1"
    },
    gallery: [
      {title: "Summer Beach Club", mediaUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2026/07/beachclub-ig-1.jpg?ssl=1"},
      {title: "Jell-O Shot Night", mediaUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2026/07/JELLOSHOT-IG.png?ssl=1"},
      {title: "Ladies Night", mediaUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2026/07/LADIESNIGHT-IG.png?ssl=1"},
      {title: "Sueño Sundays", mediaUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2024/08/SUENO-FEATURED.jpg?ssl=1"},
      {title: "Decades crowd", mediaUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2025/12/IMG_7269-copy.jpg?ssl=1"}
    ]
  },
  "mayflower-washington-dc": {
    main: {
      title: "The Mayflower DC cover",
      mediaUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/6776ceb045575851c01b68b2_websitecover.jpg"
    },
    gallery: [
      {title: "Mayflower lounge", mediaUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/61778e898a0e587ab4c2b269_10.15.21%20mayflower-19.jpeg"},
      {title: "Zebbie's Garden interior", mediaUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/60a582518e7662d6a9cdb012_Zebbies_Interior-2.jpg"},
      {title: "Zebbie's Garden section", mediaUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/611584bb8d0a823285ab8bf2_Zebbies_interior-section.jpg"},
      {title: "Zebbie's sign", mediaUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/611c04a44f1583a27103770c_zebbies-sign-interior.jpg"},
      {title: "Mayflower vibe still", mediaUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/60c2aca6dcffab2025abed06_IMG_8714-poster-00001.jpg"}
    ]
  },
  "lima-twist-washington-dc": {
    main: {
      title: "LIMA Twist dining / lounge",
      mediaUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/fb22d58b-4396-4697-8eea-da403bc01db8/LIMA-115.png?format=1500w"
    },
    gallery: [
      {title: "LIMA Twist interior", mediaUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/b54f519c-f8c8-480a-a3a4-64a44ede9550/LIMA-015.png?format=1500w"},
      {title: "LIMA Twist nightlife", mediaUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/c7acf1b9-6c5e-418e-8375-027cf3302178/LIMA-109.png?format=1500w"},
      {title: "LIMA Twist ambience", mediaUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/5c17ad51-798b-43f8-851e-cf04bb538db0/LIMA-022.png?format=1500w"},
      {title: "LIMA Twist bar", mediaUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/530df192-622e-48cc-a61f-d080a72f3dc6/LIMA-028.png?format=1500w"},
      {title: "LIMA Twist dining room", mediaUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/0576a0b2-40bb-4271-a3ec-da03f68b25a4/LIMA-058.png?format=1500w"}
    ]
  }
};

const events = [
  {
    id: "decades-summer-beach-club-2026-07-23",
    eventName: "Summer Beach Club",
    locationId: "decades-washington-dc",
    clubLocationId: "decades-washington-dc",
    eventDate: "2026-07-23",
    eventDay: "Thursday",
    eventTime: "10:00 PM",
    agePolicy: "18+",
    genres: ["Throwbacks", "Hip Hop", "Top 40"],
    artists: ["DCClubbing DJs"],
    flyerUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2026/07/beachclub-ig-1.jpg?ssl=1",
    ticketUrl: "https://decadesdc.com/vip-passes-exclusive-decades-nightclubdc-freeentry/",
    status: "active",
    active: true
  },
  {
    id: "decades-jello-shot-night-2026-07-24",
    eventName: "Jell-O Shot Night",
    locationId: "decades-washington-dc",
    clubLocationId: "decades-washington-dc",
    eventDate: "2026-07-24",
    eventDay: "Friday",
    eventTime: "10:00 PM",
    agePolicy: "21+",
    genres: ["Hip Hop", "Throwbacks", "Top 40"],
    artists: ["Decades DJs"],
    flyerUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2026/07/JELLOSHOT-IG.png?ssl=1",
    ticketUrl: "https://decadesdc.com/vip-passes-exclusive-decades-nightclubdc-freeentry/",
    status: "active",
    active: true
  },
  {
    id: "decades-ladies-night-2026-07-25",
    eventName: "Pretty Girls Like to Party — Ladies Night",
    locationId: "decades-washington-dc",
    clubLocationId: "decades-washington-dc",
    eventDate: "2026-07-25",
    eventDay: "Saturday",
    eventTime: "9:30 PM",
    agePolicy: "21+",
    genres: ["Hip Hop", "Open Format", "Top 40"],
    artists: ["Decades DJs"],
    flyerUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2026/07/LADIESNIGHT-IG.png?ssl=1",
    ticketUrl: "https://decadesdc.com/vip-passes-exclusive-decades-nightclubdc-freeentry/",
    status: "active",
    active: true
  },
  {
    id: "decades-summer-beach-club-weekly",
    eventName: "Summer Beach Club",
    locationId: "decades-washington-dc",
    clubLocationId: "decades-washington-dc",
    eventDate: "Recurring Thursday",
    eventDay: "Thursday",
    eventTime: "Late",
    agePolicy: "18+",
    genres: ["Throwbacks", "Hip Hop", "Top 40"],
    artists: ["DCClubbing DJs"],
    flyerUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2026/07/beachclub-ig-1.jpg?ssl=1",
    ticketUrl: "https://decadesdc.com/weekly-events/",
    status: "active",
    active: true
  },
  {
    id: "decades-fridays",
    eventName: "Fridays at Decades",
    locationId: "decades-washington-dc",
    clubLocationId: "decades-washington-dc",
    eventDate: "Recurring Friday",
    eventDay: "Friday",
    eventTime: "Late",
    agePolicy: "21+",
    genres: ["Hip Hop", "Throwbacks"],
    artists: ["Decades DJs"],
    flyerUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2026/07/JELLOSHOT-IG.png?ssl=1",
    ticketUrl: "https://decadesdc.com/weekly-events/",
    status: "active",
    active: true
  },
  {
    id: "decades-saturdays",
    eventName: "Saturdays at Decades",
    locationId: "decades-washington-dc",
    clubLocationId: "decades-washington-dc",
    eventDate: "Recurring Saturday",
    eventDay: "Saturday",
    eventTime: "Late",
    agePolicy: "21+",
    genres: ["Hip Hop", "EDM", "Open Format"],
    artists: ["Guest DJs", "Decades DJs"],
    flyerUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2026/07/LADIESNIGHT-IG.png?ssl=1",
    ticketUrl: "https://decadesdc.com/weekly-events/",
    status: "active",
    active: true
  },
  {
    id: "decades-sueno-sundays",
    eventName: "Sueño Sundays",
    locationId: "decades-washington-dc",
    clubLocationId: "decades-washington-dc",
    eventDate: "Recurring Sunday",
    eventDay: "Sunday",
    eventTime: "Rooftop late",
    genres: ["International", "Techno", "Reggaeton", "Top 40"],
    artists: ["EG Productions", "City Socials"],
    flyerUrl: "https://i0.wp.com/decadesdc.com/wp-content/uploads/2024/08/SUENO-FEATURED.jpg?ssl=1",
    ticketUrl: "https://posh.vip/e/sueo-decades-58",
    status: "active",
    active: true
  },
  {
    id: "mayflower-friday-late",
    eventName: "Mayflower Friday Dinner & Late Night",
    locationId: "mayflower-washington-dc",
    clubLocationId: "mayflower-washington-dc",
    eventDate: "Recurring Friday",
    eventDay: "Friday",
    eventTime: "6:00 PM–3:00 AM",
    genres: ["Lounge", "Open Format", "Hip Hop"],
    artists: ["Curated DJs"],
    flyerUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/6776ceb045575851c01b68b2_websitecover.jpg",
    ticketUrl: "https://www.themayflowerdc.com/reservations",
    status: "active",
    active: true
  },
  {
    id: "mayflower-saturday-late",
    eventName: "Mayflower Saturday Dinner & Late Night",
    locationId: "mayflower-washington-dc",
    clubLocationId: "mayflower-washington-dc",
    eventDate: "Recurring Saturday",
    eventDay: "Saturday",
    eventTime: "6:00 PM–3:00 AM",
    genres: ["Lounge", "Open Format", "Hip Hop"],
    artists: ["Curated DJs"],
    flyerUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/61778e898a0e587ab4c2b269_10.15.21%20mayflower-19.jpeg",
    ticketUrl: "https://www.themayflowerdc.com/bottle-service",
    status: "active",
    active: true
  },
  {
    id: "mayflower-zebbies-thu",
    eventName: "Zebbie's Garden Thursday",
    locationId: "mayflower-washington-dc",
    clubLocationId: "mayflower-washington-dc",
    eventDate: "Recurring Thursday",
    eventDay: "Thursday",
    eventTime: "10:00 PM–2:00 AM",
    genres: ["Lounge", "Open Format"],
    artists: ["Curated DJs"],
    flyerUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/60a582518e7662d6a9cdb012_Zebbies_Interior-2.jpg",
    ticketUrl: "https://www.themayflowerdc.com/weekly-events",
    status: "active",
    active: true
  },
  {
    id: "mayflower-private-events",
    eventName: "Private Events at The Mayflower",
    locationId: "mayflower-washington-dc",
    clubLocationId: "mayflower-washington-dc",
    eventDate: "By inquiry",
    eventDay: "Flexible",
    eventTime: "Custom",
    genres: ["Private Events", "Lounge"],
    artists: ["Venue programming"],
    flyerUrl: "https://cdn.prod.website-files.com/6099dfe7b24896a8568af325/611584bb8d0a823285ab8bf2_Zebbies_interior-section.jpg",
    ticketUrl: "https://www.themayflowerdc.com/private-events/private-events",
    status: "active",
    active: true
  },
  {
    id: "lima-twist-friday-nightlife",
    eventName: "LIMA Twist Friday Nightlife",
    locationId: "lima-twist-washington-dc",
    clubLocationId: "lima-twist-washington-dc",
    eventDate: "Recurring Friday",
    eventDay: "Friday",
    eventTime: "7:00 PM–3:00 AM",
    genres: ["House", "Deep House", "Latin"],
    artists: ["Curated DJs"],
    flyerUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/fb22d58b-4396-4697-8eea-da403bc01db8/LIMA-115.png?format=1500w",
    ticketUrl: "https://www.opentable.com/r/lima-twist-washington",
    status: "active",
    active: true
  },
  {
    id: "lima-twist-saturday-nightlife",
    eventName: "LIMA Twist Saturday Nightlife",
    locationId: "lima-twist-washington-dc",
    clubLocationId: "lima-twist-washington-dc",
    eventDate: "Recurring Saturday",
    eventDay: "Saturday",
    eventTime: "7:00 PM–3:00 AM",
    genres: ["House", "Deep House", "EDM", "Latin"],
    artists: ["Curated DJs"],
    flyerUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/b54f519c-f8c8-480a-a3a4-64a44ede9550/LIMA-015.png?format=1500w",
    ticketUrl: "https://www.opentable.com/r/lima-twist-washington",
    status: "active",
    active: true
  },
  {
    id: "lima-twist-sunday-lounge",
    eventName: "LIMA Twist Sunday Lounge",
    locationId: "lima-twist-washington-dc",
    clubLocationId: "lima-twist-washington-dc",
    eventDate: "Recurring Sunday",
    eventDay: "Sunday",
    eventTime: "7:00 PM–1:00 AM",
    genres: ["House", "Lounge", "International"],
    artists: ["Curated DJs"],
    flyerUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/c7acf1b9-6c5e-418e-8375-027cf3302178/LIMA-109.png?format=1500w",
    ticketUrl: "https://www.limatwist.com/contact",
    status: "active",
    active: true
  },
  {
    id: "lima-twist-private-events",
    eventName: "Private Events at LIMA Twist",
    locationId: "lima-twist-washington-dc",
    clubLocationId: "lima-twist-washington-dc",
    eventDate: "By inquiry",
    eventDay: "Flexible",
    eventTime: "Custom",
    genres: ["Private Events", "House", "Latin"],
    artists: ["Venue programming"],
    flyerUrl: "https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/530df192-622e-48cc-a61f-d080a72f3dc6/LIMA-028.png?format=1500w",
    ticketUrl: "https://www.limatwist.com/private-events",
    status: "active",
    active: true
  }
];

async function writeMedia(clubId, locationName, pack) {
  const writes = [];
  if (pack.main) {
    const id = `${clubId}_main`;
    writes.push(db.collection("clubMedia").doc(id).set({
      clubLocationId: clubId,
      locationName,
      slotType: "main",
      mediaType: "image",
      mediaUrl: pack.main.mediaUrl,
      title: pack.main.title || "",
      source: "website-crawl",
      uploadedAt: now,
      updatedAt: now
    }, {merge: true}));
  }
  (pack.gallery || []).slice(0, 5).forEach((item, index) => {
    const id = `${clubId}_gallery_${index + 1}`;
    writes.push(db.collection("clubMedia").doc(id).set({
      clubLocationId: clubId,
      locationName,
      slotType: "gallery",
      mediaType: "image",
      mediaUrl: item.mediaUrl,
      title: item.title || "",
      galleryOrder: index + 1,
      source: "website-crawl",
      uploadedAt: now,
      updatedAt: now
    }, {merge: true}));
  });
  await Promise.all(writes);
  return writes.length;
}

async function onboardOne(raw) {
  const payload = venueBase(raw);
  const id = payload.id;
  await db.collection("clubLocations").doc(id).set(payload, {merge: true});
  await db.collection("clubs").doc(id).set({
    clubId: id,
    clubName: payload.clubName,
    brandName: payload.brandName,
    primaryLocationId: id,
    officialWebsite: payload.officialWebsite || "",
    telephone: payload.telephone || "",
    aliasNames: payload.aliasNames || [],
    updatedAt: now,
    createdAt: now
  }, {merge: true});
  await db.collection("clubOnboardingRecords").doc(id).set({
    ...payload,
    adminPortalUrl: `${ORIGIN}/admin.html?location=${id}&v=29.09.48`,
    displayUrl: `${ORIGIN}/display.html?location=${id}&v=29.09.48`,
    publicProfileUrl: `${ORIGIN}/club-profile.html?location=${id}&v=29.09.48`,
    status: "created"
  }, {merge: true});
  const mediaCount = await writeMedia(id, payload.locationName, mediaByClub[id] || {});
  return {id, mediaCount};
}

async function writeEvents() {
  for (const event of events) {
    const {id, ...rest} = event;
    await db.collection("events").doc(id).set({
      ...rest,
      country: "United States",
      region: "District of Columbia",
      city: "Washington",
      onboardingSource: "website-crawl-dc-nightlife",
      onboardingVersion: VERSION,
      updatedAt: now,
      createdAt: now
    }, {merge: true});
  }
  return events.length;
}

async function main() {
  const results = [];
  for (const venue of venues) {
    const row = await onboardOne(venue);
    results.push(row);
    console.log("onboarded", row.id, "media", row.mediaCount);
  }
  const eventCount = await writeEvents();
  console.log(JSON.stringify({ok: true, clubs: results, eventCount}, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
