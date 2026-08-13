/* FLOQR temp QA showcase brands + service-member photos (browser + Node). */
(function (root) {
  "use strict";

  const PAGES = "https://jadzadco.github.io/shoutout-demo";
  const REL = "./images/temp-qa";

  const CLUBS = [
    {n:1, brand:"Aurelia", vibe:"Champagne lounge", tagline:"Where the night pours gold.", genres:["House","R&B","Open Format"], street:"1001 U St NW"},
    {n:2, brand:"Volt Room", vibe:"Late electro warehouse", tagline:"Bass first. Lights second.", genres:["EDM","Techno","Open Format"], street:"1002 14th St NW"},
    {n:3, brand:"Nectar", vibe:"Afrobeats supperclub", tagline:"Sweat, silk, and Saturday.", genres:["Afrobeats","Amapiano","Hip Hop"], street:"1003 Florida Ave NW"},
    {n:4, brand:"Panthera", vibe:"Hip-hop den", tagline:"Black-cat energy after midnight.", genres:["Hip Hop","Trap","R&B"], street:"1004 H St NE"},
    {n:5, brand:"Luna Fold", vibe:"Latin rooftop", tagline:"Moonlight, merengue, and bottle service.", genres:["Latin","Reggaeton","Open Format"], street:"1005 9th St NW"},
    {n:6, brand:"Facet", vibe:"Disco-luxe room", tagline:"Every angle catches the light.", genres:["Disco","House","Pop"], street:"1006 Connecticut Ave NW"},
    {n:7, brand:"After Koi", vibe:"East-meets-afterhours", tagline:"Swim past last call.", genres:["House","Techno","International"], street:"1007 7th St NW"},
    {n:8, brand:"Strike", vibe:"Match-lit lounge", tagline:"One spark starts the room.", genres:["Hip Hop","Open Format","Live"], street:"1008 M St NW"},
    {n:9, brand:"Orchid Frequency", vibe:"R&B listening club", tagline:"Petals, velvet, and 808s.", genres:["R&B","Soul","Quiet Storm"], street:"1009 U St NW"},
    {n:10, brand:"Northstar", vibe:"International late lounge", tagline:"Follow the room, not the map.", genres:["International","House","Afro House"], street:"1010 K St NW"}
  ];

  const PHOTOS = {
    logo: n => `club-${n}-logo.png`,
    venue: n => (n % 3 === 1 ? "club-1-venue.png" : n % 3 === 2 ? "club-rooftop.png" : "club-speakeasy.png"),
    galleryA: "club-gallery-vip.png",
    galleryB: "club-gallery-entrance.png",
    promo: "promo-collective-logo.png",
    dj: n => ["dj-jordan.png", "dj-maya.png", "dj-rico.png"][(n - 1) % 3],
    waitress: "staff-priya.png",
    waiter: "staff-luis.png",
    bottle: n => (n % 2 ? "staff-sienna.png" : "staff-amara.png"),
    promoter: "staff-nia.png",
    admin: "staff-marcus.png"
  };

  const PEOPLE = {
    dj: n => ({
      first: ["Jordan", "Maya", "Rico"][(n - 1) % 3],
      last: ["Vee", "Cole", "Santos"][(n - 1) % 3],
      role: "Resident DJ",
      type: "dj",
      nightlifeStyle: "Booth-first, crowd-reading, no dead air.",
      music: ["House", "Hip Hop", "Afrobeats"],
      lookingToMeet: "Promoters who actually pack rooms."
    }),
    waitress: n => ({
      first: "Priya", last: "Shah", role: "Waitress", type: "waiterWaitress",
      nightlifeStyle: "Fast floor, warm table, never miss a hail.",
      music: ["R&B", "Open Format"],
      lookingToMeet: "Regulars who tip and DJs who keep the energy up."
    }),
    waiter: n => ({
      first: "Luis", last: "Ortega", role: "Waiter", type: "waiterWaitress",
      nightlifeStyle: "VIP tables, water before the third round.",
      music: ["Latin", "House"],
      lookingToMeet: "Bottle teams who move as one."
    }),
    bottle: n => ({
      first: n % 2 ? "Sienna" : "Amara",
      last: n % 2 ? "Vale" : "Quinn",
      role: "Bottle Service",
      type: "bottleGirl",
      nightlifeStyle: "Glamorous, tattooed, campaign-ready bottle service — the room notices when she arrives.",
      music: ["Hip Hop", "House", "R&B"],
      lookingToMeet: "Tables that celebrate and promoters who book the right nights."
    }),
    promoter: n => ({
      first: "Nia", last: "Brooks", role: "Promoter", type: "promoter",
      nightlifeStyle: "Guest lists that actually show. Stories that convert.",
      music: ["Open Format", "Afrobeats"],
      lookingToMeet: "Club admins who pay on time."
    }),
    clubadmin: n => ({
      first: "Marcus", last: "Hale", role: "Club Admin", type: "clubAdmin",
      nightlifeStyle: "Door, staff, and the board all talking to each other.",
      music: ["Open Format"],
      lookingToMeet: "Service members who show up for the schedule."
    })
  };

  function relUrl(file) { return `${REL}/${file}`; }
  function absUrl(file) { return `${PAGES}/images/temp-qa/${file}`; }

  function personRecord(roleKey, n, absolute) {
    const spec = (PEOPLE[roleKey] || PEOPLE.dj)(n);
    const file = roleKey === "dj" ? PHOTOS.dj(n)
      : roleKey === "bottle" ? PHOTOS.bottle(n)
      : roleKey === "clubadmin" ? PHOTOS.admin
      : PHOTOS[roleKey] || PHOTOS.admin;
    const url = absolute ? absUrl(file) : relUrl(file);
    const name = `${spec.first} ${spec.last}`;
    const email = `temp_${roleKey === "clubadmin" ? "clubadmin" : roleKey}_${n}@floqr-demo.com`;
    return {
      name,
      displayName: name,
      firstName: spec.first,
      lastName: spec.last,
      role: spec.role,
      title: spec.role,
      email,
      photoUrl: url,
      photoURL: url,
      imageUrl: url,
      profilePhotoUrl: url,
      avatarUrl: url,
      publicPhotoUrl: url,
      bio: `${spec.first} is the ${spec.role.toLowerCase()} for ${CLUBS[n - 1].brand} — ${spec.nightlifeStyle}`,
      instagram: `@temp_${roleKey}_${n}`,
      nightlifeStyle: spec.nightlifeStyle,
      publicProfileType: spec.type,
      musicInterests: spec.music,
      lookingToMeet: spec.lookingToMeet
    };
  }

  function clubRecord(n, absolute) {
    const row = CLUBS[n - 1];
    const url = file => (absolute ? absUrl(file) : relUrl(file));
    const dj = personRecord("dj", n, absolute);
    const guestDj = personRecord("dj", (n % 10) + 1, absolute);
    guestDj.role = "Guest DJ";
    guestDj.title = "Guest DJ";
    const waitress = personRecord("waitress", n, absolute);
    const waiter = personRecord("waiter", n, absolute);
    const bottle = personRecord("bottle", n, absolute);
    const admin = personRecord("clubadmin", n, absolute);
    const promoter = personRecord("promoter", n, absolute);
    const slug = row.brand.toLowerCase().replace(/\s+/g, "");
    const telephone = `+12025550${String(100 + n).slice(-3)}`;
    const profileUrl = `${PAGES}/club-profile.html?location=temp-democlub-${n}`;
    const logo = url(PHOTOS.logo(n));
    const venue = url(PHOTOS.venue(n));
    const galleryA = url(PHOTOS.galleryA);
    const galleryB = url(PHOTOS.galleryB);
    const promoLogo = url(PHOTOS.promo);
    return {
      n,
      id: `temp-democlub-${n}`,
      brandName: row.brand,
      locationName: `${row.brand} (Temp Demo ${n})`,
      type: "club",
      venueType: "club",
      categories: ["Clubs", "Lounge", "Nightlife", "Events", "ShoutOut", "QA Demo"],
      country: "United States",
      regionType: "District",
      region: "District of Columbia",
      stateRegion: "District of Columbia",
      city: "Washington",
      streetAddress: row.street,
      postalCode: "20001",
      locationLabel: "Washington, District of Columbia",
      fullAddress: `${row.street}, Washington, District of Columbia 20001, United States`,
      brand: `${row.brand.toUpperCase()} x FLOQR`,
      defaultMain: `USE ShoutOut @ ${row.brand.toUpperCase()}`,
      defaultSub: row.vibe,
      tagline: row.tagline,
      publicTagline: row.tagline,
      description: `${row.brand} is a ${row.vibe} in DC built to showcase FLOQR: public profile, hours grid, hail-a-waitress, scheduling, and featured talent. ${row.tagline}`,
      genres: row.genres,
      artists: [dj.name, guestDj.name],
      artistsOrDjs: [dj.name, guestDj.name],
      promoters: [`${row.brand} Collective`],
      amenities: ["VIP tables", "Bottle service", "Coat check", "Dance floor", "DJ booth"],
      agePolicy: "21+",
      dressCode: "Upscale / nightlife attire",
      cuisine: "Late small plates",
      telephone,
      phone: telephone,
      email: `temp_clubadmin_${n}@floqr-demo.com`,
      officialWebsite: profileUrl,
      website: profileUrl,
      menuUrl: `${profileUrl}#clubAboutSection`,
      reservationsUrl: `${PAGES}/guest-list.html?location=temp-democlub-${n}`,
      contactUrl: `${profileUrl}#clubContactSection`,
      socialMediaHandles: {
        instagram: `@${slug}dc`,
        facebook: `${slug}dc`,
        x: `@${slug}dc`,
        tiktok: `@${slug}dc`,
        floqrHandle: `@tempdemoclub${n}`
      },
      logoUrl: logo,
      clubLogoUrl: logo,
      brandLogoUrl: logo,
      mainImageUrl: venue,
      mainMediaUrl: venue,
      mainMediaType: "image",
      publicGallery: [
        {mediaUrl: galleryA, mediaType: "image", slotType: "gallery", title: "VIP Room", galleryOrder: 1},
        {mediaUrl: galleryB, mediaType: "image", slotType: "gallery", title: "Entrance", galleryOrder: 2}
      ],
      extractedImages: [
        {url: logo, mediaUrl: logo, mediaType: "image", title: "Logo", slotType: "logo"},
        {url: venue, mediaUrl: venue, mediaType: "image", title: "Venue", slotType: "main"},
        {url: galleryA, mediaUrl: galleryA, mediaType: "image", title: "VIP Room", slotType: "gallery"},
        {url: galleryB, mediaUrl: galleryB, mediaType: "image", title: "Entrance", slotType: "gallery"}
      ],
      featuredDjs: [dj, guestDj],
      featuredStaff: [waitress, waiter, bottle, admin],
      promotionGroups: [{
        ...promoter,
        name: `${row.brand} Collective`,
        displayName: `${row.brand} Collective`,
        logoUrl: promoLogo,
        bio: `The ${row.brand} guest-list and genre-night crew.`
      }],
      publicServices: ["ShoutOut", "Guest List / RSVP", "Hail a Waitress", "Staff Scheduling"],
      hours: "Thu–Sat 22:00–03:00",
      hoursStructured: {
        sun:{closed:true,open:"",close:""},
        mon:{closed:true,open:"",close:""},
        tue:{closed:true,open:"",close:""},
        wed:{closed:true,open:"",close:""},
        thu:{closed:false,open:"22:00",close:"03:00"},
        fri:{closed:false,open:"22:00",close:"03:00"},
        sat:{closed:false,open:"22:00",close:"03:00"}
      },
      hoursExceptions: [{
        id: `labor-day-2026-${n}`,
        startDate: "2026-09-07",
        endDate: "2026-09-07",
        closed: false,
        open: "21:00",
        close: "02:00",
        label: "Labor Day late lounge"
      }],
      timeZone: "America/New_York",
      displayScreenFormatIds: ["led-96x48", "led-64x32"],
      primaryDisplayScreenFormatId: "led-96x48",
      publicProfileSections: {
        about: true, contact: true, upcomingEvents: true, pastEvents: true,
        featuredDjs: true, featuredStaff: true, promotionGroups: true, gallery: true
      },
      activityStatus: "Demo Club Admin training venue",
      activityDates: ["Thursday late night", "Friday Demo Night", "Saturday Demo Night"],
      templates: ["birthday", "vip", "bottle", "neon"],
      demo: true,
      isDemo: true,
      qaTemp: true,
      staffSchedulingPaid: 1,
      publicProfilePublished: true,
      visibility: "public",
      active: true,
      people: {dj, guestDj, waitress, waiter, bottle, admin, promoter}
    };
  }

  function userProfilePatch(roleKey, n, uid) {
    const person = personRecord(roleKey, n, true);
    const club = CLUBS[n - 1];
    const photo = person.photoURL;
    return {
      displayName: person.displayName,
      fullName: person.displayName,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      photoURL: photo,
      photoUrl: photo,
      imageUrl: photo,
      profilePhotoUrl: photo,
      avatarUrl: photo,
      publicPhotoUrl: photo,
      publicProfileType: person.publicProfileType,
      publicProfileVisibility: "public",
      publicProfilePublished: true,
      publicProfileBioOriginal: person.bio,
      publicProfileBioEnglish: person.bio,
      bio: person.bio,
      nightlifeStyle: person.nightlifeStyle,
      musicInterests: person.musicInterests,
      favoriteGenres: person.musicInterests,
      lookingToMeet: person.lookingToMeet,
      hobbies: ["Nightlife", "Music", "Hosting"],
      foodChoices: ["Late-night small plates"],
      favoriteBeverages: ["Champagne", "Espresso martini"],
      instagramHandle: person.instagram,
      floqrHandle: `@temp_${roleKey}_${n}`,
      city: "Washington",
      country: "United States",
      affiliatedClubId: `temp-democlub-${n}`,
      affiliatedClubName: club.brand,
      approvedRoles: [person.publicProfileType],
      profileCompleted: true,
      qaTemp: true,
      profileMediaSlots: [
        {slot:1, order:1, type:"image", url:photo, fileName:`${roleKey}-${n}.png`, travelDatapointAdded:false},
        {slot:2, order:2, type:"image", url: absUrl(PHOTOS.venue(n)), fileName:"venue.png", travelDatapointAdded:false}
      ]
    };
  }

  const api = {PAGES, REL, CLUBS, PHOTOS, personRecord, clubRecord, userProfilePatch, relUrl, absUrl};
  root.FLOQRTempQaShowcase = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
