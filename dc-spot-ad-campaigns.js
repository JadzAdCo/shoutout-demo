/* FLOQR DC club spot advertisements — seeded from public venue websites / shared-data. */
(function (global) {
  "use strict";

  function svgBanner(title, subtitle, accent) {
    const t = String(title || "FLOQR").replace(/[<>&]/g, "");
    const s = String(subtitle || "").replace(/[<>&]/g, "");
    const a = String(accent || "#dfff5a");
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 520">
<defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="#ff64d8"/></linearGradient></defs>
<rect width="900" height="520" rx="36" fill="#0a0b16"/>
<circle cx="140" cy="90" r="160" fill="${a}" opacity=".18"/>
<circle cx="780" cy="430" r="190" fill="#ff64d8" opacity=".16"/>
<rect x="48" y="48" width="804" height="424" rx="28" fill="none" stroke="url(#g)" stroke-width="4"/>
<text x="450" y="220" fill="#fff" font-size="42" text-anchor="middle" font-family="Georgia, serif" font-weight="700">${t}</text>
<text x="450" y="280" fill="${a}" font-size="24" text-anchor="middle" font-family="Arial, sans-serif">${s}</text>
<text x="450" y="420" fill="#c9cee5" font-size="18" text-anchor="middle" font-family="Arial, sans-serif">FLOQR spot advertisement · Washington DC</text>
</svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(raw)}`;
  }

  const DC_SPOT_ADS = [
    {
      id: "dc-heist-fri-sat",
      clubLocationId: "heist-washington-dc",
      title: "HEIST Dupont",
      badge: "Tonight · Heist DC",
      advertiser: "Heist",
      status: "active",
      sourceUrl: "https://www.heistdc.com/",
      image: svgBanner("HEIST", "Friday & Saturday nights · Dupont Circle"),
      body: "Dupont Circle's subterranean lounge. Thursday late night, Friday HEIST, Saturday HEIST — hand-selected DJs and VIP service.",
      callToAction: "Plan a Heist night",
      slots: ["clubs", "events", "lounges", "lounge-club", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Thursday late night", "Friday HEIST", "Saturday HEIST"]
    },
    {
      id: "dc-gaia-ambrosia",
      clubLocationId: "gaia-supperclub-washington-dc",
      title: "GAIA Ambrosia Brunch",
      badge: "Sunday · GAIA Supperclub",
      advertiser: "GAIA / Gaiai",
      status: "active",
      sourceUrl: "https://www.gaiasupperclub.com/",
      image: svgBanner("GAIA", "Ambrosia Sunday brunch · downtown supperclub"),
      body: "Dine in elegance, dance in allure. Ambrosia Sunday brunch, weeknight dinner/lounge, and weekend late nights at GAIA.",
      callToAction: "Reserve GAIA",
      slots: ["clubs", "events", "lounges", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Ambrosia Sunday brunch", "Weekend late night"]
    },
    {
      id: "dc-onyx-feel-good",
      clubLocationId: "onyx-rooftop-washington-dc",
      title: "Onyx Feel Good Fridays",
      badge: "Rooftop · Onyx DC",
      advertiser: "Onyx Rooftop",
      status: "active",
      sourceUrl: "https://onyxrooftopdc.com/",
      image: svgBanner("ONYX", "Feel Good Fridays · Dupont After Dark Saturdays"),
      body: "DC's premier rooftop nightlife — retractable glass roof, VIP bottle service, Hip-Hop / Afrobeats / Latin. Love Sunday Day Party.",
      callToAction: "Open Onyx",
      slots: ["clubs", "events", "lounges", "lounge-club", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Feel Good Fridays", "Dupont After Dark Saturdays", "Love Sunday Day Party"]
    },
    {
      id: "dc-vera-sala-sonidos",
      clubLocationId: "vera-cocina-washington-dc",
      title: "Vera · Sala Sonidos",
      badge: "Fri–Sat late · Ivy City",
      advertiser: "Vera Cocina & Bar",
      status: "active",
      sourceUrl: "https://veradc.com/",
      image: svgBanner("VERA", "Sala Sonidos Fri–Sat · Brunch Hafla weekends"),
      body: "Lebanese-Mexican by day, Sala Sonidos by night. Brunch Hafla Sat–Sun; late-night club energy Fri–Sat in Ivy City.",
      callToAction: "See Vera events",
      slots: ["clubs", "events", "lounges", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Brunch Hafla Sat–Sun", "Sala Sonidos Fri–Sat"]
    },
    {
      id: "dc-sax-late-night",
      clubLocationId: "sax-washington-dc",
      title: "SAX Late Night",
      badge: "Dinner theater · SAX",
      advertiser: "SAX",
      status: "active",
      sourceUrl: "https://www.saxwdc.com/",
      image: svgBanner("SAX", "Wed / Fri / Sat late-night lounge"),
      body: "Opulence, service, and entertainment. Dinner theater plus late-night DJ lounge and bottle service downtown.",
      callToAction: "Book SAX",
      slots: ["clubs", "events", "lounges", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Wednesday late night", "Friday late night", "Saturday late night"]
    },
    {
      id: "dc-decades-retro",
      clubLocationId: "decades-washington-dc",
      title: "Decades DC",
      badge: "Multi-level retro club",
      advertiser: "Decades",
      status: "active",
      sourceUrl: "https://decadesdc.com/",
      image: svgBanner("DECADES", "Thu / Fri / Sat · 6 floors · rooftop"),
      body: "DC's only multi-level retro nightclub — 15,000 sq ft, 8 bars, 5 DJs, retractable rooftop. Thursday through Saturday events.",
      callToAction: "Go to Decades",
      slots: ["clubs", "events", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Thursday events", "Friday events", "Saturday events"]
    },
    {
      id: "dc-rosebar-vip",
      clubLocationId: "rosebar-lounge-washington-dc",
      title: "Rosebar VIP Nights",
      badge: "Connecticut Ave lounge",
      advertiser: "Rosebar Lounge",
      status: "active",
      sourceUrl: "https://www.rosebarlounge.com/",
      image: svgBanner("ROSEBAR", "Tue & Thu–Sun VIP nights"),
      body: "Premier nightclub lounge on Connecticut Ave — VIP tables, day parties, bottle service, and celebrity guests.",
      callToAction: "Rosebar tonight",
      slots: ["clubs", "events", "lounges", "lounge-club", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Tuesday VIP", "Thursday VIP", "Friday VIP", "Saturday VIP", "Sunday night"]
    },
    {
      id: "dc-kata-chinatown",
      clubLocationId: "kata-washington-dc",
      title: "KATA Chinatown",
      badge: "Asian tapas · cocktails",
      advertiser: "KATA",
      status: "active",
      sourceUrl: "https://www.kata-dc.com/",
      image: svgBanner("KATA", "Weeknight dinner · weekend late lounge"),
      body: "DC's first Asian Tapas Cocktail experience in Chinatown / Gallery Place — fusion tapas, sushi, experiential cocktails.",
      callToAction: "Visit KATA",
      slots: ["clubs", "events", "lounges", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Weeknight dinner", "Weekend late dining/lounge"]
    },
    {
      id: "dc-lima-twist-lounge",
      clubLocationId: "lima-twist-washington-dc",
      title: "LIMA Twist Late Lounge",
      badge: "South American fusion",
      advertiser: "LIMA Twist",
      status: "active",
      sourceUrl: "https://www.limatwist.com/",
      image: svgBanner("LIMA TWIST", "Fri–Sat late lounge · Sun evening"),
      body: "Downtown South American fusion — restaurant early, house-rooted late-night lounge Fri–Sat, Sunday evening lounge.",
      callToAction: "LIMA Twist tonight",
      slots: ["clubs", "events", "lounges", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Friday late-night lounge", "Saturday late-night lounge", "Sunday evening lounge"]
    },
    {
      id: "dc-casamara-sunset-sundays",
      clubLocationId: "casamara-rooftop-washington-dc",
      title: "Casamara Sunset Sundays",
      badge: "Rooftop events · 18th St",
      advertiser: "Casamara Rooftop",
      status: "active",
      sourceUrl: "https://casamaradc.com/rooftop/",
      image: svgBanner("CASAMARA", "Sunset Sundays · Mediterranean rooftop"),
      body: "Sun-soaked days, starry Mediterranean nights. Sunset Sundays, Tue–Thu evenings, Fri–Sat late. Private events ~80 seated / ~200 cocktail.",
      callToAction: "Rooftop events",
      slots: ["clubs", "events", "lounges", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Sunset Sundays (from June 7)", "Fri late rooftop", "Private events"]
    },
    {
      id: "dc-zebbies-demo",
      clubLocationId: "zebbies-garden-washington-dc",
      title: "Zebbies Garden",
      badge: "Demo venue · FLOQR",
      advertiser: "Zebbies Garden",
      status: "active",
      sourceUrl: "",
      image: svgBanner("ZEBBIES", "Mon Hip Hop · Wed EDM · Fri Afro · Sat International"),
      body: "Active FLOQR demo location — weekly programming across Hip Hop, EDM, Afro Beats, and International nights.",
      callToAction: "Open Zebbies",
      slots: ["clubs", "events", "mingl", "mingl-gist", "rydr", "shoutout", "default"],
      targetTags: [],
      eventTags: ["Monday Hip Hop", "Wednesday EDM", "Friday Afro Beats", "Saturday International"]
    }
  ];

  /** Spot ad layout templates for Club Admin composer. */
  const SPOT_TEMPLATES = [
    {
      id: "spot-tonight-event",
      industry: "nightlife",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot · Tonight's event",
      eyebrow: "Tonight",
      headline: "{{event}} at {{club}}",
      body: "Don't miss {{event}}. Guest list, VIP, and ShoutOuts on FLOQR.",
      cta: "Open club",
      slots: ["clubs", "events", "mingl", "mingl-gist", "rydr", "shoutout"]
    },
    {
      id: "spot-weekend-series",
      industry: "nightlife",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot · Weekend series",
      eyebrow: "This weekend",
      headline: "{{club}} weekend",
      body: "{{event}}. Arrive early — tables and guest list move fast.",
      cta: "See lineup",
      slots: ["clubs", "events", "mingl", "rydr"]
    },
    {
      id: "spot-rooftop-dayparty",
      industry: "nightlife",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot · Rooftop / day party",
      eyebrow: "Rooftop",
      headline: "{{event}}",
      body: "Sun-to-stars energy at {{club}}. Resy / guest list via FLOQR.",
      cta: "Rooftop details",
      slots: ["clubs", "events", "lounges", "mingl", "mingl-gist", "rydr"]
    },
    {
      id: "spot-brunch-hafla",
      industry: "restaurant",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot · Brunch / daytime",
      eyebrow: "Brunch",
      headline: "{{event}} at {{club}}",
      body: "Daytime dining, then nightlife. Reserve on FLOQR.",
      cta: "Reserve",
      slots: ["events", "lounges", "mingl", "default"]
    },
    {
      id: "spot-promoter-guestlist",
      industry: "promoter",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot · Promoter guest list",
      eyebrow: "Guest list",
      headline: "{{event}}",
      body: "You're invited to {{club}}. RSVP before doors.",
      cta: "RSVP",
      slots: ["events", "mingl", "mingl-gist", "shoutout", "default"]
    },
    {
      id: "spot-rydr-hail",
      industry: "nightlife",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot · RydR interstitial",
      eyebrow: "On the way",
      headline: "Going out to {{club}}?",
      body: "{{event}} — hail with RydR, then throw a ShoutOut.",
      cta: "Continue hail",
      slots: ["rydr", "default"]
    }
  ];

  global.FLOQRDcSpotAds = {
    campaigns: DC_SPOT_ADS,
    templates: SPOT_TEMPLATES,
    svgBanner
  };
})(typeof window !== "undefined" ? window : globalThis);
