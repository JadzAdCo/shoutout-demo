/* FLOQR industry marketing campaign templates (layouts + default copy). */
(function (global) {
  "use strict";

  const INDUSTRIES = [
    {id: "nightlife", label: "Nightlife / Club"},
    {id: "restaurant", label: "Restaurant / Bar"},
    {id: "promoter", label: "Promoter / Events"},
    {id: "fitness", label: "Fitness / Wellness"},
    {id: "retail", label: "Retail / Boutique"},
    {id: "hospitality", label: "Hotel / Hospitality"}
  ];

  /** Layouts: how background + images + text stack in the campaign composer preview. */
  const LAYOUTS = {
    fullBleedHero: {
      id: "fullBleedHero",
      name: "Full-bleed hero",
      slots: ["background", "headline", "body", "cta", "logo"]
    },
    splitPoster: {
      id: "splitPoster",
      name: "Split poster",
      slots: ["background", "sideImage", "headline", "body", "cta"]
    },
    stackedCards: {
      id: "stackedCards",
      name: "Stacked feature",
      slots: ["background", "image1", "image2", "headline", "body", "cta"]
    },
    announcement: {
      id: "announcement",
      name: "Announcement strip",
      slots: ["background", "eyebrow", "headline", "body", "cta"]
    },
    spotInterstitial: {
      id: "spotInterstitial",
      name: "Spot interstitial (in-app)",
      slots: ["background", "eyebrow", "headline", "body", "cta", "badge"]
    }
  };

  const TEMPLATES = [
    {
      id: "nightlife-tonight",
      industry: "nightlife",
      layoutId: "fullBleedHero",
      name: "Tonight at the club",
      eyebrow: "Tonight",
      headline: "Doors open — don't miss it",
      body: "Live DJs, guest list, and bottle service. Reply STOP to opt out.",
      cta: "Get on the list",
      smsBody: "Tonight at {{club}}: doors open. Guest list + bottle service. Details: {{link}} Reply STOP to opt out.",
      whatsappBody: "🔥 Tonight at *{{club}}*\n\nDoors open — guest list & bottle service.\n{{link}}\n\nReply STOP to opt out."
    },
    {
      id: "nightlife-vip",
      industry: "nightlife",
      layoutId: "splitPoster",
      name: "VIP table night",
      eyebrow: "VIP",
      headline: "Reserve your table",
      body: "Skip the line. Tables still available for {{date}}.",
      cta: "Book VIP",
      smsBody: "{{club}} VIP tables for {{date}}. Reserve: {{link}} Reply STOP to opt out.",
      whatsappBody: "*{{club}}* — VIP tables for {{date}}\nReserve: {{link}}\nReply STOP to opt out."
    },
    {
      id: "restaurant-brunch",
      industry: "restaurant",
      layoutId: "stackedCards",
      name: "Weekend brunch",
      eyebrow: "Brunch",
      headline: "Weekend brunch is on",
      body: "Reservations recommended. Specials all weekend.",
      cta: "Reserve a table",
      smsBody: "{{club}} weekend brunch — reserve: {{link}} Reply STOP to opt out.",
      whatsappBody: "*{{club}}* weekend brunch\nReserve: {{link}}\nReply STOP to opt out."
    },
    {
      id: "restaurant-happy-hour",
      industry: "restaurant",
      layoutId: "announcement",
      name: "Happy hour",
      eyebrow: "Happy Hour",
      headline: "Drinks & bites specials",
      body: "Join us {{window}}. Limited-time menu.",
      cta: "See specials",
      smsBody: "{{club}} happy hour {{window}}. Specials: {{link}} Reply STOP to opt out.",
      whatsappBody: "*{{club}}* happy hour {{window}}\n{{link}}\nReply STOP to opt out."
    },
    {
      id: "promoter-guestlist",
      industry: "promoter",
      layoutId: "fullBleedHero",
      name: "Guest list drop",
      eyebrow: "Guest List",
      headline: "You're invited — RSVP now",
      body: "{{event}} at {{club}}. Free before {{cutoff}} with RSVP.",
      cta: "RSVP",
      smsBody: "Guest list: {{event}} at {{club}}. RSVP {{link}} before {{cutoff}}. Reply STOP to opt out.",
      whatsappBody: "Guest list: *{{event}}* at {{club}}\nRSVP: {{link}}\nBefore {{cutoff}}. Reply STOP to opt out."
    },
    {
      id: "promoter-tour",
      industry: "promoter",
      layoutId: "splitPoster",
      name: "Tour / showcase",
      eyebrow: "Live",
      headline: "{{artist}} live",
      body: "{{date}} · {{venue}}. Tickets moving fast.",
      cta: "Get tickets",
      smsBody: "{{artist}} live {{date}} at {{venue}}. Tickets: {{link}} Reply STOP to opt out.",
      whatsappBody: "*{{artist}}* live {{date}}\n{{venue}}\nTickets: {{link}}\nReply STOP to opt out."
    },
    {
      id: "dj-mixcloud",
      industry: "nightlife",
      layoutId: "fullBleedHero",
      name: "DJ Mixcloud drop",
      eyebrow: "New mix",
      headline: "New set on Mixcloud",
      body: "Stream the mix on Mixcloud. Merch + curated playlists on BartR — no audio file downloads.",
      cta: "Listen on Mixcloud",
      smsBody: "{{dj}} new mix on Mixcloud: {{link}} Merch/playlists on BartR. Reply STOP to opt out.",
      whatsappBody: "*{{dj}}* — new Mixcloud set\n{{link}}\nMerch & curated playlists on BartR.\nReply STOP to opt out."
    },
    {
      id: "dj-playlist-pack",
      industry: "promoter",
      layoutId: "stackedCards",
      name: "DJ playlist pack",
      eyebrow: "Curation",
      headline: "Custom playlist package",
      body: "Track lists with Spotify/Apple/Tidal links, BPM notes, and themes. You stream on your own accounts.",
      cta: "Buy on BartR",
      smsBody: "{{dj}} playlist pack (streaming links + notes): {{link}} Reply STOP to opt out.",
      whatsappBody: "*{{dj}}* playlist pack\nStreaming links + notes — no audio files.\n{{link}}\nReply STOP to opt out."
    },
    {
      id: "fitness-class",
      industry: "fitness",
      layoutId: "stackedCards",
      name: "Class pack promo",
      eyebrow: "Train",
      headline: "New class pack — limited seats",
      body: "Book your session this week and save.",
      cta: "Book class",
      smsBody: "{{club}}: new class pack — book {{link}} Reply STOP to opt out.",
      whatsappBody: "*{{club}}* — new class pack\nBook: {{link}}\nReply STOP to opt out."
    },
    {
      id: "retail-drop",
      industry: "retail",
      layoutId: "announcement",
      name: "Product drop",
      eyebrow: "Drop",
      headline: "New arrival is live",
      body: "Shop the drop while sizes last.",
      cta: "Shop now",
      smsBody: "{{club}} new drop is live: {{link}} Reply STOP to opt out.",
      whatsappBody: "*{{club}}* new drop\n{{link}}\nReply STOP to opt out."
    },
    {
      id: "hospitality-stay",
      industry: "hospitality",
      layoutId: "fullBleedHero",
      name: "Weekend stay offer",
      eyebrow: "Stay",
      headline: "Weekend rates just dropped",
      body: "Book your stay and mention FloqR for the offer.",
      cta: "Book stay",
      smsBody: "{{club}} weekend rates: {{link}} Reply STOP to opt out.",
      whatsappBody: "*{{club}}* weekend rates\n{{link}}\nReply STOP to opt out."
    },
    {
      id: "spot-tonight-event",
      industry: "nightlife",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot ad · Tonight's event",
      eyebrow: "Tonight",
      headline: "{{event}} at {{club}}",
      body: "Don't miss {{event}}. Guest list, VIP, and ShoutOuts on FLOQR.",
      cta: "Open club",
      smsBody: "",
      whatsappBody: ""
    },
    {
      id: "spot-weekend-series",
      industry: "nightlife",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot ad · Weekend series",
      eyebrow: "This weekend",
      headline: "{{club}} weekend",
      body: "{{event}}. Arrive early — tables and guest list move fast.",
      cta: "See lineup",
      smsBody: "",
      whatsappBody: ""
    },
    {
      id: "spot-rooftop-dayparty",
      industry: "nightlife",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot ad · Rooftop / day party",
      eyebrow: "Rooftop",
      headline: "{{event}}",
      body: "Sun-to-stars energy at {{club}}. Resy / guest list via FLOQR.",
      cta: "Rooftop details",
      smsBody: "",
      whatsappBody: ""
    },
    {
      id: "spot-promoter-guestlist",
      industry: "promoter",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot ad · Promoter guest list",
      eyebrow: "Guest list",
      headline: "{{event}}",
      body: "You're invited to {{club}}. RSVP before doors.",
      cta: "RSVP",
      smsBody: "",
      whatsappBody: ""
    },
    {
      id: "spot-rydr-hail",
      industry: "nightlife",
      layoutId: "spotInterstitial",
      channelHint: "spot",
      name: "Spot ad · RydR interstitial",
      eyebrow: "On the way",
      headline: "Going out to {{club}}?",
      body: "{{event}} — hail with RydR, then throw a ShoutOut.",
      cta: "Continue hail",
      smsBody: "",
      whatsappBody: ""
    }
  ];

  function templatesForIndustry(industryId) {
    const id = String(industryId || "").trim();
    if (!id || id === "all") return TEMPLATES.slice();
    return TEMPLATES.filter(t => t.industry === id);
  }

  function getTemplate(templateId) {
    return TEMPLATES.find(t => t.id === templateId) || null;
  }

  function getLayout(layoutId) {
    return LAYOUTS[layoutId] || LAYOUTS.fullBleedHero;
  }

  function fillPlaceholders(text, vars = {}) {
    return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ""));
  }

  global.FLOQRMarketingTemplates = {
    INDUSTRIES,
    LAYOUTS,
    TEMPLATES,
    templatesForIndustry,
    getTemplate,
    getLayout,
    fillPlaceholders
  };
})(typeof window !== "undefined" ? window : globalThis);
