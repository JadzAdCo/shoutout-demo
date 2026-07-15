/*
  shared-data.js v29.09.0
  Truth source for demo categories, templates, club locations, and demo events.
  New model: club/location records are unique. A brand can have many locations.
*/
window.SHOUTOUT_MASTER_ADMIN_EMAILS = [
  "bands.don@gmail.com",
  "bans.don@gmail.com",
  "don.b@jadzholdings.com"
];

/*
  v25 Master Admin Security Policy
  Master admin must be explicitly listed, use an approved FLOQR email domain,
  use a verified email identity, and sign in through Google or Microsoft.
  MFA must be enforced at Microsoft Entra ID / Google Workspace.
*/
window.SHOUTOUT_MASTER_ADMIN_ALLOWED_DOMAINS = [
  "jadzadco.com",
  "jadzholdings.com"
];

window.SHOUTOUT_MASTER_ADMIN_ALLOWED_PROVIDERS = [
  "google.com",
  "microsoft.com"
];

window.SHOUTOUT_MASTER_ADMIN_REQUIRE_VERIFIED_EMAIL = true;
window.SHOUTOUT_MASTER_ADMIN_REQUIRE_MFA_NOTICE = true;

window.FLOQR_AI_ENABLED = false;
window.FLOQR_AI_PROVIDER = "firebase-ai-logic";
window.FLOQR_AI_FALLBACK_MODE = "local-contextual-search";
window.FLOQR_AI_STUDIO_ENABLED = false;
window.FLOQR_AI_ASSISTANT_ENABLED = false;
window.FLOQR_AI_TEMPLATE_HELP_ENABLED = true;
window.FLOQR_AI_FUNCTIONS_REGION = "us-central1";
window.FLOQR_AI_GEMINI_MEDIA_FUNCTION = "aiEnhanceShoutOutMedia";
window.FLOQR_AI_GEMINI_MEDIA_MODEL = "gemini-3.1-flash-image";
window.FLOQR_AI_LOCATION_RANK_FUNCTION = "aiRankLocations";
window.FLOQR_AI_SHOUTOUT_SUGGEST_FUNCTION = "aiSuggestShoutOut";
window.FLOQR_AI_GRAMMAR_FUNCTION = "aiSuggestGrammarCorrection";
window.FLOQR_OBSOLETE_LOCATION_IDS = ["heist-houston-tx", "heist-houston", "heist-houston-texas"];

window.SHOUTOUT_ADMIN_EMAILS = [
  "bands.don@gmail.com",
  "bans.don@gmail.com",
  "don.b@jadzholdings.com"
];

window.SHOUTOUT_TEMPLATES = {
  neon: { id: "neon", name: "Neon ShoutOut", scope: "Shared", className: "neon", tags:["neon","nightclub","general","live display","party","glow"] },
  birthday: { id: "birthday", name: "Birthday Glow", scope: "Shared", className: "neon", tags:["birthday","happy birthday","flowers","celebration","cake","party"] },
  vip: { id: "vip", name: "VIP Table", scope: "Shared", className: "gold", tags:["vip","table","bottle service","luxury","reservation","premium"] },
  bottle: { id: "bottle", name: "Bottle Service", scope: "Club", className: "fire", tags:["bottle","champagne","vip","table","celebration"] },
  gold: { id: "gold", name: "Gold Celebration", scope: "Shared", className: "gold", tags:["gold","luxury","anniversary","celebration","premium"] },
  ice: { id: "ice", name: "Ice Blue", scope: "Club", className: "ice", tags:["ice","blue","cool","pool","summer","beach"] },
  fire: { id: "fire", name: "Fire Night", scope: "Club", className: "fire", tags:["fire","hot","tattoo","ink","urban","night"] },
  latin: { id: "latin", name: "Latin Night", scope: "Club", className: "gold", tags:["latin","reggaeton","salsa","bachata","dance"] },
  hiphop: { id: "hiphop", name: "Hip Hop Night", scope: "Club", className: "fire", tags:["hip hop","hiphop","rap","trap","urban","tattoo"] },
  afrohouse: { id: "afrohouse", name: "Afro House / Amapiano", scope: "Shared", className: "gold", tags:["afro house","afrohouse","amapiano","afrobeats","dance"] },
  edm: { id: "edm", name: "EDM / House", scope: "Shared", className: "ice", tags:["edm","house","deep house","tech house","dance"] }
};

window.SHOUTOUT_CLUB_LOCATIONS = {
  "zebbies-garden-washington-dc": {
    brandName:"Zebbies Garden", locationName:"Zebbies Garden DC", type:"club",
    country:"United States", regionType:"District", region:"District of Columbia", city:"Washington",
    streetAddress:"1223 Connecticut Avenue NW", postalCode:"20036",
    locationLabel:"Washington, District of Columbia",
    brand:"ZEBBIES GARDEN DC x FLOQR",
    defaultMain:"USE SHOUT OUT @ ZEBBIES DC", defaultSub:"",
    genres:["Hip Hop","Afro Beats","EDM","International"], artists:["DJ Nova"],
    activityStatus:"Active demo location",
    activityDates:["Monday Hip Hop","Wednesday EDM","Friday Afro Beats","Saturday International"],
    templates:["birthday","vip","bottle","neon","zebbiesFootballTeamIntro"],
    displayScreenFormatIds:["p125-96x48","p125-64x48","p125-64x32","led-96x48","led-64x48","led-64x32"],
    primaryDisplayScreenFormatId:"p125-96x48",
    active:true
  },
  "heist-washington-dc": {
    brandName:"Heist", locationName:"Heist Washington DC", type:"club",
    country:"United States", regionType:"District", region:"District of Columbia", city:"Washington",
    locationLabel:"Washington, District of Columbia, United States",
    brand:"HEIST DC x FLOQR",
    defaultMain:"USE SHOUT OUT @ HEIST DC", defaultSub:"",
    genres:["Hip Hop","Afro Beats","House"], artists:["Resident DJ"],
    activityStatus:"Demo location", activityDates:["Friday Hip Hop","Saturday House"],
    templates:["hiphop","bottle","birthday","fire"], active:true
  },
  "shoko-barcelona-spain": {
    brandName:"Shôko", locationName:"Shôko Barcelona", type:"club",
    categories:["Clubs","Beach Clubs","Events","ShoutOut"],
    aliasLocationIds:["shoko-barcelona-beach-club-spain"],
    aliasNames:["Shôko Barcelona Beach Club"],
    country:"Spain", regionType:"Region", region:"Catalonia", city:"Barcelona",
    locationLabel:"Barcelona, Catalonia, Spain",
    brand:"SHÔKO BARCELONA x FLOQR",
    defaultMain:"USE SHOUT OUT @ SHÔKO", defaultSub:"",
    genres:["Hip Hop","House","Reggaeton","R&B","Afro Beats"], artists:["Noriel","Resident DJs"],
    activityStatus:"Active official venue with ticketed events",
    activityDates:["Thursday 2026-06-11 Noriel","Weekly late-night club programming","Typical late-night schedule"],
    templates:["latin","hiphop","vip","neon"], active:true
  },
  "chrystie-cannes-france": {
    brandName:"Chrystie", locationName:"Chrystie Cannes", type:"club",
    country:"France", regionType:"Region", region:"Provence-Alpes-Côte d’Azur", city:"Cannes",
    locationLabel:"Cannes, Provence-Alpes-Côte d’Azur, France",
    brand:"CHRYSTIE CANNES x FLOQR",
    defaultMain:"USE SHOUT OUT @ CHRYSTIE", defaultSub:"",
    genres:["House","Deep House","EDM","Cabaret"], artists:["Curated performances"],
    activityStatus:"Active seasonal/private club atmosphere",
    activityDates:["Friday 23:30-05:00","Saturday 23:30-05:00","Seasonal summer activity"],
    templates:["gold","vip","neon","birthday"], active:true
  },
  "cococure-london-uk": {
    brandName:"Cococure", locationName:"Cococure London", type:"lounge",
    country:"United Kingdom", regionType:"Region", region:"England", city:"London",
    locationLabel:"London, England, United Kingdom",
    brand:"COCOCURE LONDON x FLOQR",
    defaultMain:"USE SHOUT OUT @ COCOCURE", defaultSub:"",
    genres:["Afrobeats","Amapiano","R&B","Hip Hop"], artists:["Curated DJs"],
    activityStatus:"Active London nightlife/food concept",
    activityDates:["Afrobeats / Bashment / Amapiano programming","R&B / Hip Hop programming"],
    templates:["afrohouse","hiphop","vip","gold"], active:true
  },
  "hi-ibiza-spain": {
    brandName:"Hï Ibiza", locationName:"Hï Ibiza", type:"club",
    country:"Spain", regionType:"Island", region:"Ibiza", city:"Ibiza",
    locationLabel:"Ibiza, Balearic Islands, Spain",
    brand:"HÏ IBIZA x FLOQR",
    defaultMain:"USE SHOUT OUT @ HÏ IBIZA", defaultSub:"",
    genres:["Afro House","House","EDM"], artists:["Black Coffee","Francis Mercier"],
    activityStatus:"Active major Ibiza venue",
    activityDates:["Seasonal Ibiza programming","Afro House / House residencies"],
    templates:["afrohouse","edm","vip","gold"], active:true
  },
  "pacha-ibiza-spain": {
    brandName:"Pacha", locationName:"Pacha Ibiza", type:"club",
    country:"Spain", regionType:"Island", region:"Ibiza", city:"Ibiza",
    locationLabel:"Ibiza, Balearic Islands, Spain",
    brand:"PACHA IBIZA x FLOQR",
    defaultMain:"USE SHOUT OUT @ PACHA IBIZA", defaultSub:"",
    genres:["House","Deep House","EDM"], artists:["International DJs"],
    activityStatus:"Active Ibiza club candidate",
    activityDates:["Seasonal Ibiza programming"],
    templates:["edm","gold","vip","neon"], active:true
  },
  "cavo-paradiso-mykonos-greece": {
    brandName:"Cavo Paradiso", locationName:"Cavo Paradiso Mykonos", type:"club",
    country:"Greece", regionType:"Island", region:"Mykonos", city:"Mykonos",
    locationLabel:"Mykonos, South Aegean, Greece",
    brand:"CAVO PARADISO x FLOQR",
    defaultMain:"USE SHOUT OUT @ CAVO PARADISO", defaultSub:"",
    genres:["EDM","House","Tech House"], artists:["International DJs"],
    activityStatus:"Active open-air club",
    activityDates:["Seasonal DJ events"],
    templates:["edm","ice","vip","neon"], active:true
  },
  "the-club-milan-italy": {
    brandName:"The Club", locationName:"The Club Milano", type:"club",
    country:"Italy", regionType:"Region", region:"Lombardy", city:"Milan",
    locationLabel:"Milan, Lombardy, Italy",
    brand:"THE CLUB MILANO x FLOQR",
    defaultMain:"USE SHOUT OUT @ THE CLUB MILANO", defaultSub:"",
    genres:["Hip Hop","House","Commercial"], artists:["Resident DJs"],
    activityStatus:"Seed candidate",
    activityDates:["Weekly club programming"],
    templates:["hiphop","edm","vip","neon"], active:true
  },
  "miami-demo-fl": {
    brandName:"Miami Club Demo", locationName:"Miami Club Demo", type:"club",
    country:"United States", regionType:"State", region:"Florida", city:"Miami",
    locationLabel:"Miami, Florida, United States",
    brand:"MIAMI x FLOQR",
    defaultMain:"USE SHOUT OUT @ MIAMI", defaultSub:"",
    genres:["Hip Hop","Afro House","EDM"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Friday Hip Hop","Saturday Afro House"],
    templates:["afrohouse","hiphop","vip","neon"], active:false
  },
  "atlanta-demo-ga": {
    brandName:"Atlanta Club Demo", locationName:"Atlanta Club Demo", type:"club",
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"ATLANTA x FLOQR",
    defaultMain:"USE SHOUT OUT @ ATLANTA", defaultSub:"",
    genres:["Hip Hop","Afro Beats","Amapiano"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Friday Hip Hop","Saturday Afro Beats"],
    templates:["hiphop","afrohouse","vip","fire"], active:false
  },
  "nyc-demo-ny": {
    brandName:"NYC Club Demo", locationName:"NYC Club Demo", type:"club",
    country:"United States", regionType:"State", region:"New York", city:"New York",
    locationLabel:"New York, New York, United States",
    brand:"NYC x FLOQR",
    defaultMain:"USE SHOUT OUT @ NYC", defaultSub:"",
    genres:["Hip Hop","House","Afro House"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Wednesday House","Friday Hip Hop"],
    templates:["hiphop","edm","vip","ice"], active:false
  },
  "la-demo-ca": {
    brandName:"LA Club Demo", locationName:"LA Club Demo", type:"club",
    country:"United States", regionType:"State", region:"California", city:"Los Angeles",
    locationLabel:"Los Angeles, California, United States",
    brand:"LA x FLOQR",
    defaultMain:"USE SHOUT OUT @ LA", defaultSub:"",
    genres:["Hip Hop","EDM","House"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Friday Hip Hop","Saturday EDM"],
    templates:["edm","hiphop","vip","gold"], active:false
  },
  "signature-club-washington-dc": {
    brandName:"Signature Club", locationName:"Signature Club DC", type:"lounge",
    categories:["Lounges","Lounge-Club","ShoutOut"],
    country:"United States", regionType:"District", region:"District of Columbia", city:"Washington",
    locationLabel:"Washington, District of Columbia, United States",
    brand:"SIGNATURE CLUB DC x FLOQR",
    defaultMain:"USE SHOUT OUT @ SIGNATURE CLUB", defaultSub:"",
    genres:["Hip Hop","Afro Beats","R&B","Lounge"], artists:["Resident DJs"],
    activityStatus:"Lounge seed location",
    activityDates:["Friday Lounge Night","Saturday VIP Lounge"],
    templates:["vip","gold","birthday","neon"], active:true
  },
  "josephine-atlanta-ga": {
    brandName:"Josephine", locationName:"Josephine Lounge Club Atlanta", type:"lounge-club",
    categories:["Lounge-Club","Lounges","Clubs","ShoutOut"],
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"JOSEPHINE ATLANTA x FLOQR",
    defaultMain:"USE SHOUT OUT @ JOSEPHINE", defaultSub:"",
    genres:["Hip Hop","R&B","Afro Beats","Open Format"], artists:["Resident DJs"],
    activityStatus:"Lounge-club seed location",
    activityDates:["Friday Hip Hop / Open Format","Saturday VIP Lounge Club"],
    templates:["hiphop","vip","gold","birthday"], active:true
  },
  "marquee-new-york-ny": {
    brandName:"Marquee", locationName:"Marquee New York", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"New York", city:"New York",
    locationLabel:"New York, New York, United States",
    brand:"MARQUEE NEW YORK x FLOQR",
    defaultMain:"USE SHOUT OUT @ MARQUEE", defaultSub:"",
    genres:["EDM","House","Open Format"], artists:["International DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday DJ Night","Saturday EDM / House"],
    templates:["edm","vip","ice","neon"], active:true
  },
  "lavo-new-york-ny": {
    brandName:"LAVO", locationName:"LAVO New York", type:"lounge-club",
    categories:["Lounge-Club","Clubs","Lounges","ShoutOut"],
    country:"United States", regionType:"State", region:"New York", city:"New York",
    locationLabel:"New York, New York, United States",
    brand:"LAVO NEW YORK x FLOQR",
    defaultMain:"USE SHOUT OUT @ LAVO", defaultSub:"",
    genres:["Hip Hop","Open Format","House"], artists:["Resident DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday Open Format","Saturday VIP Night"],
    templates:["vip","hiphop","gold","neon"], active:true
  },
  "nebula-new-york-ny": {
    brandName:"Nebula", locationName:"Nebula New York", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"New York", city:"New York",
    locationLabel:"New York, New York, United States",
    brand:"NEBULA NEW YORK x FLOQR",
    defaultMain:"USE SHOUT OUT @ NEBULA", defaultSub:"",
    genres:["EDM","House","Dance"], artists:["International DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Thursday Dance Night","Friday EDM","Saturday House"],
    templates:["edm","ice","vip","neon"], active:true
  },
  "academy-los-angeles-ca": {
    brandName:"Academy LA", locationName:"Academy LA", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"California", city:"Los Angeles",
    locationLabel:"Los Angeles, California, United States",
    brand:"ACADEMY LA x FLOQR",
    defaultMain:"USE SHOUT OUT @ ACADEMY LA", defaultSub:"",
    genres:["EDM","House","Tech House"], artists:["International DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday EDM","Saturday House"],
    templates:["edm","ice","vip","neon"], active:true
  },
  "exchange-la-ca": {
    brandName:"Exchange LA", locationName:"Exchange LA", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"California", city:"Los Angeles",
    locationLabel:"Los Angeles, California, United States",
    brand:"EXCHANGE LA x FLOQR",
    defaultMain:"USE SHOUT OUT @ EXCHANGE LA", defaultSub:"",
    genres:["EDM","House","Dance"], artists:["International DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday EDM","Saturday Dance"],
    templates:["edm","ice","vip","neon"], active:true
  },
  "sound-nightclub-los-angeles-ca": {
    brandName:"Sound Nightclub", locationName:"Sound Nightclub Los Angeles", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"California", city:"Los Angeles",
    locationLabel:"Los Angeles, California, United States",
    brand:"SOUND NIGHTCLUB LA x FLOQR",
    defaultMain:"USE SHOUT OUT @ SOUND", defaultSub:"",
    genres:["House","Deep House","Tech House"], artists:["House DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday House","Saturday Deep House"],
    templates:["edm","gold","vip","neon"], active:true
  },
  "liv-miami-fl": {
    brandName:"LIV", locationName:"LIV Miami", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"Florida", city:"Miami",
    locationLabel:"Miami, Florida, United States",
    brand:"LIV MIAMI x FLOQR",
    defaultMain:"USE SHOUT OUT @ LIV", defaultSub:"",
    genres:["Hip Hop","EDM","Open Format"], artists:["Celebrity DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday Hip Hop / Open Format","Saturday Celebrity Night"],
    templates:["hiphop","edm","vip","gold"], active:true
  },
  "club-space-miami-fl": {
    brandName:"Club Space", locationName:"Club Space Miami", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"Florida", city:"Miami",
    locationLabel:"Miami, Florida, United States",
    brand:"CLUB SPACE MIAMI x FLOQR",
    defaultMain:"USE SHOUT OUT @ CLUB SPACE", defaultSub:"",
    genres:["House","Deep House","Afro House","Techno"], artists:["International DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday House","Saturday Afterhours","Sunday Morning Sessions"],
    templates:["afrohouse","edm","vip","neon"], active:true
  },
  "e11even-miami-fl": {
    brandName:"E11EVEN", locationName:"E11EVEN Miami", type:"lounge-club",
    categories:["Lounge-Club","Clubs","Lounges","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"Florida", city:"Miami",
    locationLabel:"Miami, Florida, United States",
    brand:"E11EVEN MIAMI x FLOQR",
    defaultMain:"USE SHOUT OUT @ E11EVEN", defaultSub:"",
    genres:["Hip Hop","EDM","Open Format"], artists:["Celebrity DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Late-night / 24-hour programming","Friday Open Format","Saturday VIP"],
    templates:["vip","hiphop","edm","gold"], active:true
  },
  "district-atlanta-ga": {
    brandName:"District", locationName:"District Atlanta", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"DISTRICT ATLANTA x FLOQR",
    defaultMain:"USE SHOUT OUT @ DISTRICT", defaultSub:"",
    genres:["EDM","House","Dance"], artists:["DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday EDM","Saturday House"],
    templates:["edm","ice","vip","neon"], active:true
  },
  "tongue-groove-atlanta-ga": {
    brandName:"Tongue & Groove", locationName:"Tongue & Groove Atlanta", type:"lounge-club",
    categories:["Lounge-Club","Clubs","Lounges","ShoutOut"],
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"TONGUE & GROOVE ATLANTA x FLOQR",
    defaultMain:"USE SHOUT OUT @ TONGUE & GROOVE", defaultSub:"",
    genres:["Hip Hop","Open Format","House"], artists:["Resident DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday Open Format","Saturday VIP Night"],
    templates:["hiphop","vip","gold","neon"], active:true
  },
  "reve-atlanta-ga": {
    brandName:"REVE", locationName:"REVE Atlanta", type:"lounge-club",
    categories:["Lounge-Club","Clubs","Lounges","ShoutOut"],
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"REVE ATLANTA x FLOQR",
    defaultMain:"USE SHOUT OUT @ REVE", defaultSub:"",
    genres:["Hip Hop","Afro Beats","Open Format"], artists:["Resident DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday Hip Hop","Saturday Afro Beats / Open Format"],
    templates:["hiphop","afrohouse","vip","gold"], active:true
  },
  "shoko-barcelona-beach-club-spain": {
    brandName:"Shôko", locationName:"Shôko Barcelona Beach Club", type:"beach-club",
    categories:["Beach Clubs","Clubs","Events","ShoutOut"],
    status:"merged", active:false, canonicalLocationId:"shoko-barcelona-spain", aliasOf:"shoko-barcelona-spain",
    country:"Spain", regionType:"Region", region:"Catalonia", city:"Barcelona",
    locationLabel:"Barcelona Beachfront, Catalonia, Spain",
    brand:"SHÔKO BEACH CLUB x FLOQR",
    defaultMain:"USE SHOUT OUT @ SHÔKO BEACH", defaultSub:"",
    genres:["Hip Hop","House","Reggaeton","R&B","Afro Beats"], artists:["Noriel","Resident DJs"],
    activityStatus:"Beachfront club / nightlife venue",
    activityDates:["Beachfront dining + late-night club programming","Thursday Noriel event seed"],
    templates:["latin","hiphop","vip","neon"]
  },
  "nammos-mykonos-greece": {
    brandName:"Nammos", locationName:"Nammos Mykonos", type:"beach-club",
    categories:["Beach Clubs","Lounges","Events","ShoutOut"],
    country:"Greece", regionType:"Island", region:"Mykonos", city:"Mykonos",
    locationLabel:"Mykonos, South Aegean, Greece",
    brand:"NAMMOS MYKONOS x FLOQR",
    defaultMain:"USE SHOUT OUT @ NAMMOS", defaultSub:"",
    genres:["House","Deep House","Luxury Lounge"], artists:["Curated DJs"],
    activityStatus:"Beach club seed location",
    activityDates:["Seasonal beach club programming"],
    templates:["gold","vip","edm","neon"], active:true
  }

};

window.SHOUTOUT_EVENTS = {
  "shoko-noriel-2026-06-11": {
    eventName:"Noriel at Shôko Barcelona", locationId:"shoko-barcelona-spain",
    country:"Spain", region:"Catalonia", city:"Barcelona",
    genres:["Hip Hop","Reggaeton","Latin"], artists:["Noriel"],
    eventDate:"2026-06-11", eventDay:"Thursday", eventTime:"23:55-06:00", active:true
  },
  "chrystie-friday-night": {
    eventName:"Chrystie Cannes Friday Night", locationId:"chrystie-cannes-france",
    country:"France", region:"Provence-Alpes-Côte d’Azur", city:"Cannes",
    genres:["House","Deep House","Cabaret"], artists:["Curated performances"],
    eventDate:"Recurring Friday", eventDay:"Friday", eventTime:"23:30-05:00", active:true
  },
  "josephine-saturday-vip": {
    eventName:"Josephine Atlanta Saturday VIP", locationId:"josephine-atlanta-ga",
    country:"United States", region:"Georgia", city:"Atlanta",
    genres:["Hip Hop","R&B","Open Format"], artists:["Resident DJs"],
    eventDate:"Recurring Saturday", eventDay:"Saturday", eventTime:"22:00-03:00", active:true,
    ticketUrl:"#"
  },
  "shoko-beach-night": {
    eventName:"Shôko Barcelona Beach Night", locationId:"shoko-barcelona-beach-club-spain",
    country:"Spain", region:"Catalonia", city:"Barcelona",
    genres:["Hip Hop","House","Reggaeton"], artists:["Resident DJs"],
    eventDate:"Recurring Weekly", eventDay:"Thursday", eventTime:"23:55-06:00", active:true,
    ticketUrl:"#"
  },
  "club-space-saturday-afterhours": {
    eventName:"Club Space Miami Saturday Afterhours", locationId:"club-space-miami-fl",
    country:"United States", region:"Florida", city:"Miami",
    genres:["House","Deep House","Afro House"], artists:["International DJs"],
    eventDate:"Recurring Saturday", eventDay:"Saturday", eventTime:"23:00-Late", active:true,
    ticketUrl:"#"
  }

};

/*
  v25.1 Temporary Master Admin Exception.
  Keeps bans.don@gmail.com working while corporate master admin accounts are finalized.
  Remove this exception in production.
*/
window.SHOUTOUT_MASTER_ADMIN_TEMPORARY_EXCEPTION_EMAILS = [
  "bands.don@gmail.com",
  "bans.don@gmail.com"
];


/*
  v25.5 Master Admin Domain Policy

  During development, domain enforcement is disabled.
  Master Admin access is controlled by explicit email allow-list plus approved provider.
  Re-enable this in production after corporate-domain authentication is stable.
*/
window.SHOUTOUT_MASTER_ADMIN_ENFORCE_DOMAINS = false;


/* v26 promoter registry */
window.SHOUTOUT_PROMOTERS = {
  "jadz-demo-promotions": {
    id: "jadz-demo-promotions",
    name: "FLOQR Demo Promotions",
    promoterGroup: "FLOQR Demo Promotions",
    contactEmail: "promoters@jadzadco.com",
    active: true,
    locations: ["*"]
  },
  "zebbies-street-team": {
    id: "zebbies-street-team",
    name: "Zebbies Street Team",
    promoterGroup: "Zebbies Street Team",
    contactEmail: "promoters@zebbies.example",
    active: true,
    locations: ["zebbies-garden-washington-dc"]
  },
  "shoko-global-promotions": {
    id: "shoko-global-promotions",
    name: "Shôko Global Promotions",
    promoterGroup: "Shôko Global Promotions",
    contactEmail: "promoters@shoko.example",
    active: true,
    locations: ["shoko-barcelona-spain"]
  },
  "cannes-nightlife-group": {
    id: "cannes-nightlife-group",
    name: "Cannes Nightlife Group",
    promoterGroup: "Cannes Nightlife Group",
    contactEmail: "promoters@cannes.example",
    active: true,
    locations: ["christie-cannes-france"]
  }
};

window.SHOUTOUT_PROMOTER_ADMINS = {
  "bans.don@gmail.com": ["*"],
  "don.b@jadzholdings.com": ["*"]
};


/*
  v28 Localization / Translation Policy
  These product and brand terms must never be translated.
  Example: French should say "Envoyer un ShoutOut", not translate ShoutOut.
*/
window.SHOUTOUT_PROTECTED_TERMS = [
  "ShoutOut",
  "FLOQR",
  "FLOQR Holdings",
  "Superstar",
  "Big Baller",
  "Baller",
  "Diva",
  "Money Spender",
  "Bruv"
];

window.SHOUTOUT_TRANSLATION_EXAMPLES = {
  en: "Send a ShoutOut",
  fr: "Envoyer un ShoutOut",
  es: "Enviar un ShoutOut",
  it: "Invia un ShoutOut",
  de: "Einen ShoutOut senden",
  el: "Αποστολή ενός ShoutOut"
};

/* v28 Patron rank thresholds are displayed/configurable by Master Admin later. */
window.SHOUTOUT_PATRON_RANKS = [
  { id:"superstar", label:"Superstar", monthlySpend:30000, annualSpend:120000 },
  { id:"big-baller", label:"Big Baller", monthlySpend:20000, annualSpend:70000 },
  { id:"baller-diva", label:"Baller / Diva", monthlySpend:10000, annualSpend:50000 },
  { id:"money-spender", label:"Money Spender", monthlySpend:7500, annualSpend:30000 },
  { id:"bruv-diva", label:"Bruv / Diva", monthlySpend:5000, annualSpend:20000 }
];

/* v28.4 club/location service catalog */
window.SHOUTOUT_DEFAULT_LOCATION_SERVICES = ["shoutout","guestList"];
window.SHOUTOUT_LOCATION_SERVICES = {
  "zebbies-garden-washington-dc": ["shoutout","guestList","vipReservation","stdEntry"],
  "shoko-barcelona-spain": ["shoutout","guestList","vipReservation","ticketing"],
  "christie-cannes-france": ["shoutout","guestList","vipReservation","ticketing"],
  "abigail-washington-dc": ["shoutout","guestList","vipReservation"],
  "signature-lounge-washington-dc": ["shoutout","guestList","vipReservation"],
  "josephine-atlanta-ga": ["shoutout","guestList","vipReservation"]
};
window.SHOUTOUT_SERVICE_LABELS = {
  shoutout: "Throw a ShoutOut",
  guestList: "Join Guest List",
  vipReservation: "Reserve VIP / Table",
  stdEntry: "Pay Standard Entry",
  vipEntry: "Pay VIP Entry",
  ticketing: "Buy Ticket",
  bottleService: "Bottle Service",
  cabanaBooking: "Cabana Booking"
};
window.SHOUTOUT_STATUS_FLOW = ["draft","pending","approved","rejected","scheduled","displayed","archived"];


/* v28.4 enhanced templates, AI suggestions, and role request config */
Object.assign(window.SHOUTOUT_TEMPLATES, {
  blackwhite: { id:'blackwhite', name:'Traditional Black and White ShoutOut', scope:'Shared', className:'classic-bw', category:'Classic', mediaMode:'No image/video', supportsMedia:false, backgroundEditable:true, defaultMain:'HAPPY BIRTHDAY', defaultSub:'', lineCount:3, maxCharactersPerLine:15, maxMainCharacters:45, maxSubCharacters:20, identityRail:true, identityAnimation:'burst-away', identityAnimationSeconds:20, description:'Default shared marquee lightbox for every club. The main message is centered in a raised three-line board, while an optional name or social handle uses a fixed identity rail below and bursts away during playback. Without patron attribution, the same rail presents FLOQR SHOUTOUT so the composition never shifts. Patrons may change the background while the board, rail, text geometry, and timing remain locked.', tags:["traditional","classic","black and white","physical sign","letter board","birthday","no media","3 lines","15 characters per line","45 characters total","optional name","social handle","identity rail","burst animation","background editable","locked layout"] },
  birthdayMedia: { id:'birthdayMedia', name:'Happy Birthday with image/video placeholder', scope:'Shared', className:'celebration-media', category:'Milestone', mediaMode:'Image/video placeholder', supportsMedia:true, layout:'split-media', defaultMain:'HAPPY BIRTHDAY', defaultSub:'CELEBRATE BIG', description:'Half-screen media area with half-screen birthday message.', tags:["birthday","happy birthday","image","video","photo","flowers","placeholder","celebration"] },
  anniversaryMedia: { id:'anniversaryMedia', name:'Happy Anniversary with image/video placeholder', scope:'Shared', className:'anniversary-media', category:'Milestone', mediaMode:'Image/video placeholder', supportsMedia:true, layout:'split-media', defaultMain:'HAPPY ANNIVERSARY', defaultSub:'LOVE ALL NIGHT', description:'Half-screen media area with half-screen anniversary message.', tags:["anniversary","love","image","video","photo","placeholder","romance"] },
  engagementMedia: { id:'engagementMedia', name:'Happy Engagement with image/video placeholder', scope:'Shared', className:'engagement-media', category:'Milestone', mediaMode:'Image/video placeholder', supportsMedia:true, layout:'split-media', defaultMain:'HAPPY ENGAGEMENT', defaultSub:'FOREVER STARTS TONIGHT', description:'Half-screen media area with half-screen engagement message.', tags:["engagement","proposal","fiance","image","video","photo","placeholder","love"] },
  fianceMedia: { id:'fianceMedia', name:'Fiance Celebration with image/video placeholder', scope:'Shared', className:'engagement-media', category:'Milestone', mediaMode:'Image/video placeholder', supportsMedia:true, layout:'split-media', defaultMain:'FIANCE CELEBRATION', defaultSub:'SHE SAID YES', description:'Half-screen media area for fiance or proposal celebrations.', tags:["fiance","proposal","engagement","image","video","photo","placeholder","love"] },
  summer: { id:'summer', name:'Summer Vibes', scope:'Shared', className:'summer', category:'Seasonal', tags:["summer","pool party","beach","cabana","day party","vacation"] },
  car: { id:'car', name:'Luxury Car Celebration', scope:'Shared', className:'car', category:'Lifestyle', mediaMode:'No image/video', supportsMedia:false, backgroundEditable:true, defaultMain:'LUXURY RIDE CREW', defaultSub:'PULL UP CLEAN', description:'Car-inspired layout for luxury ride or car meet ShoutOuts. Patrons may replace its background while the car silhouette, text geometry, and readability limits remain locked.', tags:["car","coupe","fast cars","ferrari","lamborghini","luxury ride","automotive","ride","background editable","locked layout"] },
  champagne: { id:'champagne', name:'Champagne Celebration', scope:'Shared', className:'gold', category:'VIP', tags:["champagne","bottle","vip","toast","celebration","luxury"] },
  beach: { id:'beach', name:'Beach Party', scope:'Shared', className:'summer', category:'Beach', tags:["beach","pool","summer","cabana","day party","vacation"] },
  graduation: { id:'graduation', name:'Graduation Night', scope:'Shared', className:'classic-bw', category:'Milestone', tags:["graduation","grad","school","college","achievement"] },
  wedding: { id:'wedding', name:'Wedding Celebration', scope:'Shared', className:'gold', category:'Milestone', tags:["wedding","marriage","love","bride","groom","celebration"] },
  sports: { id:'sports', name:'Sports Night', scope:'Shared', className:'fire', category:'Lifestyle', tags:["sports","game night","team","championship","watch party"] },
  zebbiesFootballTeamIntro: {
    id:'zebbiesFootballTeamIntro',
    name:'Zebbies 4-Player Football Intro',
    scope:'Club',
    venueIds:['zebbies-garden-washington-dc'],
    className:'football-team-intro',
    category:'Sports',
    mediaMode:'4 patron photos + 20-second animation',
    supportsMedia:false,
    supportsTeamMedia:true,
    backgroundEditable:true,
    layout:'football-team-intro',
    teamMemberSlots:4,
    durationSeconds:20,
    priceCents:3000,
    priceLabel:'$30',
    screenFormatIds:['p125-96x48','p125-64x48','p125-64x32','led-96x48','led-64x48','led-64x32'],
    preferredP125FormatIds:['p125-96x48','p125-64x48','p125-64x32'],
    defaultMain:'ZEBBIES ALL-STARS',
    defaultSub:'GAME NIGHT LINEUP',
    maxMainCharacters:36,
    maxSubCharacters:36,
    description:'A Zebbies-only, 20-second American football game-introduction sequence. Add exactly four authorized patron photos; each player gets a cinematic reveal followed by the full lineup. Patrons may change the stadium background while the field, player frames, text geometry, and 20-second timing stay locked.',
    tags:["zebbies","american football","football","team intro","4 photos","four players","20 seconds","stadium","game night","collaboration","ai image treatment","$30","background editable","locked layout"]
  },
  luxury: { id:'luxury', name:'Luxury Gold', scope:'Shared', className:'gold', category:'VIP', tags:["luxury","gold","vip","premium","bottle service"] },
  corporate: { id:'corporate', name:'Corporate Event', scope:'Shared', className:'classic-bw', category:'Business', tags:["corporate","business","company","brand","event"] }
});

window.SHOUTOUT_STANDARD_TEMPLATE_IDS = ['blackwhite','birthdayMedia','anniversaryMedia','engagementMedia','fianceMedia','car','summer','champagne','beach','graduation','wedding','sports','luxury','corporate'];

window.FLOQR_DISPLAY_FORMATS = {
  "p125-96x48": {id:"p125-96x48", label:"P1.25 - 96 x 48 cm", widthCm:96, heightCm:48, pixelPitchMm:1.25, pixelWidth:768, pixelHeight:384, aspectRatio:"2 / 1", tags:["P1.25","96x48cm","768x384","2:1","7 meter visibility"]},
  "p125-64x48": {id:"p125-64x48", label:"P1.25 - 64 x 48 cm", widthCm:64, heightCm:48, pixelPitchMm:1.25, pixelWidth:512, pixelHeight:384, aspectRatio:"4 / 3", tags:["P1.25","64x48cm","512x384","4:3","7 meter visibility"]},
  "p125-64x32": {id:"p125-64x32", label:"P1.25 - 64 x 32 cm", widthCm:64, heightCm:32, pixelPitchMm:1.25, pixelWidth:512, pixelHeight:256, aspectRatio:"2 / 1", tags:["P1.25","64x32cm","512x256","2:1","7 meter visibility"]},
  "led-96x48": {id:"led-96x48", label:"96 x 48 cm", widthCm:96, heightCm:48, pixelWidth:624, pixelHeight:312, aspectRatio:"2 / 1", tags:["96x48cm","624x312","2:1"]},
  "led-64x48": {id:"led-64x48", label:"64 x 48 cm", widthCm:64, heightCm:48, pixelWidth:416, pixelHeight:312, aspectRatio:"4 / 3", tags:["64x48cm","416x312","4:3"]},
  "led-64x32": {id:"led-64x32", label:"64 x 32 cm", widthCm:64, heightCm:32, pixelWidth:416, pixelHeight:208, aspectRatio:"2 / 1", tags:["64x32cm","416x208","2:1"]}
};
window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS = Object.keys(window.FLOQR_DISPLAY_FORMATS);

/* v29.08.4: display-aware text contracts. Limits are readability ceilings, not targets. */
window.FLOQR_TEMPLATE_TEXT_PROFILES = {
  full: {
    label:"Full-screen message",
    formats:{
      "p125-96x48": {supported:true,lineCount:3,maxCharactersPerLine:16,maxMainCharacters:48,maxSubCharacters:28,minimumFontPixels:72},
      "p125-64x48": {supported:true,lineCount:3,maxCharactersPerLine:10,maxMainCharacters:30,maxSubCharacters:22,minimumFontPixels:72},
      "p125-64x32": {supported:true,lineCount:3,maxCharactersPerLine:14,maxMainCharacters:42,maxSubCharacters:24,minimumFontPixels:48},
      "led-96x48": {supported:true,lineCount:3,maxCharactersPerLine:16,maxMainCharacters:48,maxSubCharacters:28,minimumFontPixels:58},
      "led-64x48": {supported:true,lineCount:3,maxCharactersPerLine:10,maxMainCharacters:30,maxSubCharacters:22,minimumFontPixels:58},
      "led-64x32": {supported:true,lineCount:3,maxCharactersPerLine:12,maxMainCharacters:36,maxSubCharacters:20,minimumFontPixels:38}
    }
  },
  classicBoard: {
    label:"Three-line classic board",
    formats:{
      "p125-96x48": {supported:true,lineCount:3,maxCharactersPerLine:15,maxMainCharacters:45,maxSubCharacters:20,minimumFontPixels:62},
      "p125-64x48": {supported:true,lineCount:3,maxCharactersPerLine:12,maxMainCharacters:36,maxSubCharacters:18,minimumFontPixels:56},
      "p125-64x32": {supported:true,lineCount:3,maxCharactersPerLine:14,maxMainCharacters:42,maxSubCharacters:18,minimumFontPixels:44},
      "led-96x48": {supported:true,lineCount:3,maxCharactersPerLine:15,maxMainCharacters:45,maxSubCharacters:20,minimumFontPixels:52},
      "led-64x48": {supported:true,lineCount:3,maxCharactersPerLine:12,maxMainCharacters:36,maxSubCharacters:18,minimumFontPixels:46},
      "led-64x32": {supported:true,lineCount:3,maxCharactersPerLine:12,maxMainCharacters:36,maxSubCharacters:16,minimumFontPixels:34}
    }
  },
  splitMedia: {
    label:"Media and message split",
    formats:{
      "p125-96x48": {supported:true,lineCount:3,maxCharactersPerLine:10,maxMainCharacters:30,maxSubCharacters:20,minimumFontPixels:54},
      "p125-64x48": {supported:true,lineCount:2,maxCharactersPerLine:12,maxMainCharacters:24,maxSubCharacters:18,minimumFontPixels:58},
      "p125-64x32": {supported:false,lineCount:0,maxCharactersPerLine:0,maxMainCharacters:0,maxSubCharacters:0,minimumFontPixels:0,advice:"Choose a 96 x 48 cm or 64 x 48 cm display; media plus enlarged text is not reliably readable on a 64 x 32 cm panel."},
      "led-96x48": {supported:true,lineCount:3,maxCharactersPerLine:10,maxMainCharacters:30,maxSubCharacters:20,minimumFontPixels:44},
      "led-64x48": {supported:true,lineCount:2,maxCharactersPerLine:12,maxMainCharacters:24,maxSubCharacters:18,minimumFontPixels:46},
      "led-64x32": {supported:false,lineCount:0,maxCharactersPerLine:0,maxMainCharacters:0,maxSubCharacters:0,minimumFontPixels:0,advice:"Choose a 96 x 48 cm or 64 x 48 cm display; media plus enlarged text is not reliably readable on a 64 x 32 cm panel."}
    }
  },
  car: {
    label:"Illustrated car message",
    formats:{
      "p125-96x48": {supported:true,lineCount:2,maxCharactersPerLine:14,maxMainCharacters:28,maxSubCharacters:22,minimumFontPixels:72},
      "p125-64x48": {supported:true,lineCount:2,maxCharactersPerLine:10,maxMainCharacters:20,maxSubCharacters:18,minimumFontPixels:72},
      "p125-64x32": {supported:true,lineCount:2,maxCharactersPerLine:12,maxMainCharacters:24,maxSubCharacters:18,minimumFontPixels:48},
      "led-96x48": {supported:true,lineCount:2,maxCharactersPerLine:14,maxMainCharacters:28,maxSubCharacters:22,minimumFontPixels:58},
      "led-64x48": {supported:true,lineCount:2,maxCharactersPerLine:10,maxMainCharacters:20,maxSubCharacters:18,minimumFontPixels:58},
      "led-64x32": {supported:true,lineCount:2,maxCharactersPerLine:12,maxMainCharacters:24,maxSubCharacters:16,minimumFontPixels:38}
    }
  },
  footballIntro: {
    label:"Four-player football introduction",
    formats:{
      "p125-96x48": {supported:true,lineCount:2,maxCharactersPerLine:14,maxMainCharacters:28,maxSubCharacters:20,stadiumLineCount:3,stadiumCharactersPerLine:18,maxStadiumCharacters:54,maxPlayerNameCharacters:14,minimumFontPixels:72},
      "p125-64x48": {supported:true,lineCount:2,maxCharactersPerLine:10,maxMainCharacters:20,maxSubCharacters:16,stadiumLineCount:3,stadiumCharactersPerLine:12,maxStadiumCharacters:36,maxPlayerNameCharacters:10,minimumFontPixels:68},
      "p125-64x32": {supported:false,lineCount:0,maxCharactersPerLine:0,maxMainCharacters:0,maxSubCharacters:0,minimumFontPixels:0,advice:"Use a 96 x 48 cm or 64 x 48 cm display. Four portraits, names, positions, and the stadium message are too dense for a 64 x 32 cm panel."},
      "led-96x48": {supported:true,lineCount:2,maxCharactersPerLine:14,maxMainCharacters:28,maxSubCharacters:20,stadiumLineCount:3,stadiumCharactersPerLine:18,maxStadiumCharacters:54,maxPlayerNameCharacters:14,minimumFontPixels:58},
      "led-64x48": {supported:true,lineCount:2,maxCharactersPerLine:10,maxMainCharacters:20,maxSubCharacters:16,stadiumLineCount:3,stadiumCharactersPerLine:12,maxStadiumCharacters:36,maxPlayerNameCharacters:10,minimumFontPixels:54},
      "led-64x32": {supported:false,lineCount:0,maxCharactersPerLine:0,maxMainCharacters:0,maxSubCharacters:0,minimumFontPixels:0,advice:"Use a 96 x 48 cm or 64 x 48 cm display. Four portraits, names, positions, and the stadium message are too dense for a 64 x 32 cm panel."}
    }
  }
};

window.FLOQRTextLayout = {
  version:"29.08.4",
  profileId(template = {}) {
    const id = String(template.id || "");
    if (id === "blackwhite" || template.className === "classic-bw") return "classicBoard";
    if (id === "zebbiesFootballTeamIntro" || template.layout === "football-team-intro") return "footballIntro";
    if (id === "car" || template.className === "car") return "car";
    if (template.layout === "split-media") return "splitMedia";
    return String(template.textProfileId || "full");
  },
  resolve(templateOrId = {}, formatId = "") {
    const template = typeof templateOrId === "string" ? (window.SHOUTOUT_TEMPLATES?.[templateOrId] || {id:templateOrId}) : (templateOrId || {});
    const resolvedFormatId = String(formatId || template.screenFormatIds?.[0] || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS?.[0] || "p125-96x48");
    const profileId = this.profileId(template);
    const profile = window.FLOQR_TEMPLATE_TEXT_PROFILES[profileId] || window.FLOQR_TEMPLATE_TEXT_PROFILES.full;
    const rule = profile.formats[resolvedFormatId] || {supported:false,lineCount:0,maxCharactersPerLine:0,maxMainCharacters:0,maxSubCharacters:0,minimumFontPixels:0,advice:"This template has no reviewed text layout for the selected display."};
    return {
      ...rule,
      templateId:String(template.id || ""),
      templateName:String(template.name || template.id || "Template"),
      formatId:resolvedFormatId,
      formatLabel:String(window.FLOQR_DISPLAY_FORMATS?.[resolvedFormatId]?.label || resolvedFormatId),
      profileId,
      profileLabel:profile.label,
      mainTextSizePercent:20.8,
      subTextSizePercent:7.8,
      main:Number(rule.maxMainCharacters || 0),
      sub:Number(rule.maxSubCharacters || 0),
      total:Number(rule.maxMainCharacters || 0),
      perLine:Number(rule.maxCharactersPerLine || 0),
      textScale:1.3
    };
  },
  supportedFormatIds(templateOrId = {}, candidates = window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS || []) {
    return candidates.filter(formatId => this.resolve(templateOrId, formatId).supported);
  }
};

Object.values(window.SHOUTOUT_TEMPLATES || {}).forEach(template => {
  template.screenFormatIds = Array.from(new Set(template.screenFormatIds || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS));
  template.textProfileId = window.FLOQRTextLayout.profileId(template);
  template.textLayoutVersion = window.FLOQRTextLayout.version;
  template.textCompatibleScreenFormatIds = window.FLOQRTextLayout.supportedFormatIds(template, template.screenFormatIds);
  const primaryTextRule = window.FLOQRTextLayout.resolve(template, template.textCompatibleScreenFormatIds[0] || template.screenFormatIds[0]);
  template.maxMainCharacters = primaryTextRule.main;
  template.maxSubCharacters = primaryTextRule.sub;
  template.lineCount = primaryTextRule.lineCount;
  template.maxCharactersPerLine = primaryTextRule.perLine;
  template.tags = Array.from(new Set([...(template.tags || []), ...template.screenFormatIds.flatMap(id => window.FLOQR_DISPLAY_FORMATS[id]?.tags || [])]));
  template.status = template.status || "active";
  template.backgroundEditable = template.backgroundEditable !== false;
  template.mainTextSizePercent = primaryTextRule.mainTextSizePercent;
  template.subTextSizePercent = primaryTextRule.subTextSizePercent;
});

window.FLOQRAddress = {
  isUnitedStates(record = {}) {
    return /^(us|usa|u\.s\.|u\.s\.a\.|united states|united states of america)$/i.test(String(record.country || "").trim());
  },
  publicLocation(record = {}) {
    const city = record.city || "";
    const region = record.stateRegion || record.region || record.state || "";
    const country = record.country || "";
    return this.isUnitedStates(record)
      ? [city, region].filter(Boolean).join(", ")
      : [city, country].filter(Boolean).join(", ");
  },
  fullAddress(record = {}) {
    if (record.fullAddress) return String(record.fullAddress);
    const street = record.streetAddress || record.addressLine1 || record.address || "";
    const region = record.stateRegion || record.region || record.state || "";
    return [street, record.city, region, record.postalCode, record.country].filter(Boolean).join(", ");
  }
};

Object.keys(window.SHOUTOUT_CLUB_LOCATIONS || {}).forEach(id => {
  const loc = window.SHOUTOUT_CLUB_LOCATIONS[id];
  loc.templates = Array.from(new Set([...(loc.templates || []), ...window.SHOUTOUT_STANDARD_TEMPLATE_IDS]));
  loc.visibility = loc.visibility || "public";
  loc.publicProfileType = "club";
  loc.publicProfilePublished = loc.publicProfilePublished !== false;
  loc.tagline = loc.tagline || `${loc.locationName || loc.brandName || "FLOQR venue"} on FLOQR`;
  loc.description = loc.description || `Explore ${loc.locationName || loc.brandName || "this venue"}, upcoming nightlife experiences, featured talent, guest-list options, and live ShoutOut services on FLOQR.`;
  loc.logoUrl = loc.logoUrl || "";
  loc.hours = loc.hours || "";
  loc.agePolicy = loc.agePolicy || "";
  loc.dressCode = loc.dressCode || "";
  loc.amenities = loc.amenities || [];
  loc.publicServices = loc.publicServices || ["ShoutOut", "Guest List / RSVP"];
  loc.featuredDjs = loc.featuredDjs || (loc.artists || []).map(name => ({name, role:"Featured DJ", bio:`Featured at ${loc.locationName || loc.brandName || "this FLOQR venue"}.`}));
  loc.featuredStaff = loc.featuredStaff || [];
  loc.promotionGroups = loc.promotionGroups || [];
  loc.publicProfileSections = loc.publicProfileSections || {
    about:true,
    contact:true,
    upcomingEvents:true,
    pastEvents:true,
    featuredDjs:true,
    featuredStaff:true,
    promotionGroups:true,
    gallery:true
  };
  loc.clubOwnershipStatus = loc.clubOwnershipStatus || "unclaimed";
  loc.subscriptionRequiredForPublicProfileEdits = true;
  loc.displayScreenFormatIds = Array.from(new Set(loc.displayScreenFormatIds || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS));
  loc.primaryDisplayScreenFormatId = loc.primaryDisplayScreenFormatId || loc.displayScreenFormatIds[0] || "led-96x48";
  loc.patronTemplateBackgroundEditingEnabled = loc.patronTemplateBackgroundEditingEnabled !== false;
  loc.streetAddress = loc.streetAddress || loc.addressLine1 || "";
  loc.fullAddress = loc.fullAddress || window.FLOQRAddress.fullAddress(loc);
  loc.address = loc.fullAddress || loc.address || "";
  loc.locationLabel = window.FLOQRAddress.publicLocation(loc) || loc.locationLabel || "";
  loc.officialWebsite = loc.officialWebsite || loc.website || "";
  loc.email = loc.email || "";
  loc.telephone = loc.telephone || loc.phone || "";
  loc.socialMediaHandles = loc.socialMediaHandles || {
    instagram: "",
    x: "",
    tiktok: "",
    facebook: ""
  };
  loc.publicSearchKeywords = Array.from(new Set([
    ...(loc.publicSearchKeywords || []),
    loc.locationName,
    loc.brandName,
    loc.city,
    loc.country,
    ...(loc.categories || []),
    ...(loc.genres || [])
  ].filter(Boolean)));
});

window.FLOQR_AI_DISCOVERY_PARTNERS = {
  eventDiscoveryApis: ["Ticketmaster Discovery API", "Eventbrite API"],
  ticketResalePartnerTypes: ["official resale partner", "affiliate ticketing partner", "distribution partner"],
  categories: ["nightclub", "lounge", "beachClub", "brunchParty", "poolParty", "summerParty", "djEvent", "promoterEvent", "comedyShow"],
  taxiHailingPartnerMode: "tesla-robotaxi-simulation-and-official-app-handoff"
};

/* v29.09.0: original, non-lyrical music-inspired recommendations awaiting Master Admin review. */
window.FLOQR_RECOMMENDATION_SEED_QUEUE = [
  {id:"music-ruger-bae-bae-01",mainText:"MY BAE OWNS TONIGHT",subText:"AFRO LOVE",genre:"afrobeats",tone:"romantic",sourceArtist:"Ruger & BNXN",sourceTrack:"Bae Bae"},
  {id:"music-ruger-bae-bae-02",mainText:"LOVE SET THE VIBE",subText:"BAE BAE ENERGY",genre:"afrobeats",tone:"romantic",sourceArtist:"Ruger & BNXN",sourceTrack:"Bae Bae"},
  {id:"music-ruger-bae-bae-03",mainText:"BAE CAME TO SHINE",subText:"SWEET NIGHT",genre:"afrobeats",tone:"celebration",sourceArtist:"Ruger & BNXN",sourceTrack:"Bae Bae"},
  {id:"music-ruger-bae-bae-04",mainText:"OUR LOVE RUNS DEEP",subText:"TWO HEARTS",genre:"afrobeats",tone:"romantic",sourceArtist:"Ruger & BNXN",sourceTrack:"Bae Bae"},
  {id:"music-ruger-bae-bae-05",mainText:"TWO HEARTS ONE VIBE",subText:"LOVE IN MOTION",genre:"afrobeats",tone:"romantic",sourceArtist:"Ruger & BNXN",sourceTrack:"Bae Bae"},
  {id:"music-ruger-bae-bae-06",mainText:"MY PERSON MY PEACE",subText:"ONLY US",genre:"afrobeats",tone:"romantic",sourceArtist:"Ruger & BNXN",sourceTrack:"Bae Bae"},
  {id:"music-ruger-bae-bae-07",mainText:"LOVE LOOKS GOOD HERE",subText:"DATE NIGHT",genre:"afrobeats",tone:"romantic",sourceArtist:"Ruger & BNXN",sourceTrack:"Bae Bae"},
  {id:"music-ruger-bae-bae-08",mainText:"BAE LIGHTS THE ROOM",subText:"GLOW TOGETHER",genre:"afrobeats",tone:"celebration",sourceArtist:"Ruger & BNXN",sourceTrack:"Bae Bae"},

  {id:"music-usher-club-01",mainText:"YEAH WE OWN TONIGHT",subText:"CLUB CLASSIC",genre:"rnb-hiphop",tone:"party",sourceArtist:"Usher",sourceTrack:"Yeah!"},
  {id:"music-usher-club-02",mainText:"CLUB LOVE ALL NIGHT",subText:"RNB ENERGY",genre:"rnb-hiphop",tone:"romantic",sourceArtist:"Usher",sourceTrack:"Love in This Club"},
  {id:"music-usher-club-03",mainText:"DJ RUN IT BACK",subText:"DANCE AGAIN",genre:"rnb-hiphop",tone:"party",sourceArtist:"Usher",sourceTrack:"DJ Got Us Fallin' in Love"},
  {id:"music-usher-club-04",mainText:"THIS DANCE IS OURS",subText:"LIGHTS UP",genre:"rnb-hiphop",tone:"party",sourceArtist:"Usher",sourceTrack:"DJ Got Us Fallin' in Love"},
  {id:"music-usher-club-05",mainText:"CAUGHT IN THE VIBE",subText:"SMOOTH NIGHT",genre:"rnb-hiphop",tone:"party",sourceArtist:"Usher",sourceTrack:"Caught Up"},
  {id:"music-usher-club-06",mainText:"LOOK AT US TONIGHT",subText:"BIG MOMENT",genre:"rnb-hiphop",tone:"celebration",sourceArtist:"Usher",sourceTrack:"OMG"},
  {id:"music-usher-club-07",mainText:"WE MOVE OUR WAY",subText:"MAIN STAGE",genre:"rnb-hiphop",tone:"confident",sourceArtist:"Usher",sourceTrack:"My Way"},
  {id:"music-usher-club-08",mainText:"ONE MORE DANCE",subText:"ALL TOGETHER",genre:"rnb-hiphop",tone:"party",sourceArtist:"Usher",sourceTrack:"DJ Got Us Fallin' in Love"},

  {id:"music-wizkid-ikebe-01",mainText:"HER VIBE OWNS HERE",subText:"STAR ENERGY",genre:"afrobeats",tone:"confident",sourceArtist:"Wizkid",sourceTrack:"Psycho (Kcee feat. Wizkid)"},
  {id:"music-wizkid-ikebe-02",mainText:"RHYTHM ALL NIGHT",subText:"AFRO SWAY",genre:"afrobeats",tone:"party",sourceArtist:"Wizkid",sourceTrack:"Psycho (Kcee feat. Wizkid)"},
  {id:"music-wizkid-ikebe-03",mainText:"STAR ENERGY ONLY",subText:"BIG WIZ VIBE",genre:"afrobeats",tone:"confident",sourceArtist:"Wizkid",sourceTrack:"Psycho (Kcee feat. Wizkid)"},
  {id:"music-wizkid-ikebe-04",mainText:"SHE MOVES WE CHEER",subText:"DANCE FLOOR",genre:"afrobeats",tone:"celebration",sourceArtist:"Wizkid",sourceTrack:"Psycho (Kcee feat. Wizkid)"},
  {id:"music-wizkid-ikebe-05",mainText:"BIG VIBE NO APOLOGY",subText:"OWN THE ROOM",genre:"afrobeats",tone:"confident",sourceArtist:"Wizkid",sourceTrack:"Psycho (Kcee feat. Wizkid)"},
  {id:"music-wizkid-ikebe-06",mainText:"RHYTHM MADE FOR US",subText:"SWEET MOTION",genre:"afrobeats",tone:"romantic",sourceArtist:"Wizkid",sourceTrack:"Psycho (Kcee feat. Wizkid)"},
  {id:"music-wizkid-ikebe-07",mainText:"FINE VIBE FRONT ROW",subText:"AFRO STAR",genre:"afrobeats",tone:"confident",sourceArtist:"Wizkid",sourceTrack:"Psycho (Kcee feat. Wizkid)"},
  {id:"music-wizkid-ikebe-08",mainText:"WE SWAY TILL LATE",subText:"NIGHT RHYTHM",genre:"afrobeats",tone:"party",sourceArtist:"Wizkid",sourceTrack:"Psycho (Kcee feat. Wizkid)"},

  {id:"music-davido-unavailable-01",mainText:"PEACE OVER PRESSURE",subText:"UNBOTHERED",genre:"afrobeats",tone:"confident",sourceArtist:"Davido",sourceTrack:"Unavailable"},
  {id:"music-davido-unavailable-02",mainText:"NO DRAMA JUST VIBES",subText:"DANCE MODE",genre:"afrobeats",tone:"party",sourceArtist:"Davido",sourceTrack:"Unavailable"},
  {id:"music-davido-unavailable-03",mainText:"BLESSED NOT STRESSED",subText:"GOOD ENERGY",genre:"afrobeats",tone:"confident",sourceArtist:"Davido",sourceTrack:"Unavailable"},
  {id:"music-davido-unavailable-04",mainText:"OFFLINE ON THE FLOOR",subText:"PHONE DOWN",genre:"afrobeats",tone:"party",sourceArtist:"Davido",sourceTrack:"Unavailable"},
  {id:"music-davido-unavailable-05",mainText:"BUSY MAKING MEMORIES",subText:"LIVE TONIGHT",genre:"afrobeats",tone:"celebration",sourceArtist:"Davido",sourceTrack:"Unavailable"},
  {id:"music-davido-unavailable-06",mainText:"NO CALLS JUST DANCE",subText:"WE OUTSIDE",genre:"afrobeats",tone:"party",sourceArtist:"Davido",sourceTrack:"Unavailable"},
  {id:"music-davido-unavailable-07",mainText:"MY PEACE COMES FIRST",subText:"GOOD LIFE",genre:"afrobeats",tone:"confident",sourceArtist:"Davido",sourceTrack:"Unavailable"},
  {id:"music-davido-unavailable-08",mainText:"UNBOTHERED ALL NIGHT",subText:"NO DISTRACTIONS",genre:"afrobeats",tone:"confident",sourceArtist:"Davido",sourceTrack:"Unavailable"}
].map(item => ({
  ...item,
  status:"pending",
  source:"editorial-music-inspiration",
  sourceType:"music-inspired-original",
  rightsStatus:"original-non-lyrical",
  rightsNote:"Original FLOQR wording; no song lyrics are stored.",
  sourceNote:item.sourceArtist === "Wizkid" ? "User referenced this theme as Ikebe; exact track attribution requires Master Admin confirmation." : "Song themes used only as creative direction.",
  seedVersion:"29.09.0"
}));

window.SHOUTOUT_AI_SUGGESTIONS = [
  {category:'birthday', main:'HAPPY BIRTHDAY!', sub:'VIP vibes all night long.'},
  {category:'vip', main:'VIP TABLE IN THE BUILDING', sub:'Champagne ready. Lights up.'},
  {category:'summer', main:'SUMMER NIGHTS', sub:'Good people. Great music. Better memories.'},
  {category:'car', main:'LUXURY RIDE CREW', sub:'Pull up clean. Celebrate louder.'},
  {category:'classic', main:'TONIGHT IS YOUR NIGHT', sub:'Classic style. Big energy.'},
  {category:'love', main:'LOVE IS IN THE ROOM', sub:'Cheers to the perfect night.'},
  {category:'graduation', main:'CONGRATS GRAD!', sub:'The future starts tonight.'},
  {category:'afrobeats', main:'AFROBEATS ENERGY', sub:'From the table to the dance floor.'}
];

window.SHOUTOUT_ROLE_TYPES = {
  clubAdmin: 'Club Admin',
  clubMasterAdmin: 'Club Master Admin',
  dj: 'DJ',
  promoter: 'Promoter'
};

/* v28.5 media/video template library */
window.SHOUTOUT_MEDIA_TEMPLATE_LIBRARY = {
  "classic-black-white": {id:"classic-black-white", name:"Classic Black & White", category:"Classic", supportsImage:true, supportsVideo:false, previewStyle:"classic-board", mainText:"HAPPY BIRTHDAY", subText:"STACY", description:"Black words on a clean white classic board."},
  "ferrari-f8-vip": {id:"ferrari-f8-vip", name:"Ferrari F8 VIP", category:"Cars", supportsImage:true, supportsVideo:true, previewStyle:"ferrari", mainText:"VIP ARRIVAL", subText:"FERRARI NIGHT", description:"Red exotic-car inspired VIP theme."},
  "rolls-cullinan-vip": {id:"rolls-cullinan-vip", name:"Rolls-Royce Cullinan VIP", category:"Cars", supportsImage:true, supportsVideo:true, previewStyle:"rolls", mainText:"VIP EXPERIENCE", subText:"TABLE RESERVED", description:"Black-and-gold luxury SUV VIP theme."},
  "summer-vibes": {id:"summer-vibes", name:"Summer Vibes", category:"Seasonal", supportsImage:true, supportsVideo:true, previewStyle:"summer", mainText:"SUMMER VIBES", subText:"ALL NIGHT", description:"Beach and summer party theme."},
  "champagne-gold": {id:"champagne-gold", name:"Champagne Gold", category:"VIP", supportsImage:true, supportsVideo:true, previewStyle:"gold", mainText:"CHAMPAGNE", subText:"CELEBRATION", description:"Gold VIP celebration theme."},
  "neon-party": {id:"neon-party", name:"Neon Party", category:"Nightclub", supportsImage:true, supportsVideo:true, previewStyle:"neon", mainText:"SHOUTOUT", subText:"LIVE TONIGHT", description:"Neon nightclub theme."}
};
window.SHOUTOUT_UPLOAD_LIMITS = {imageBytes: 8*1024*1024, videoBytes: 30*1024*1024};


/* v28.7 force ShoutOut service for every club/location */
(function(){
  window.SHOUTOUT_SERVICE_LABELS = window.SHOUTOUT_SERVICE_LABELS || {};
  window.SHOUTOUT_SERVICE_LABELS.shoutout = "Throw a ShoutOut";

  window.SHOUTOUT_DEFAULT_LOCATION_SERVICES =
    Array.from(new Set(["shoutout", ...(window.SHOUTOUT_DEFAULT_LOCATION_SERVICES || ["guestList"])]));

  const services = window.SHOUTOUT_LOCATION_SERVICES || {};
  Object.keys(services).forEach(id => {
    if (!services[id].includes("shoutout")) services[id].unshift("shoutout");
  });
  window.SHOUTOUT_LOCATION_SERVICES = services;
})();

/* v28.8 service catalog shoutout force */
(function(){
  window.SHOUTOUT_SERVICE_LABELS = window.SHOUTOUT_SERVICE_LABELS || {};
  window.SHOUTOUT_SERVICE_LABELS.shoutout = "Throw a ShoutOut";
  window.SHOUTOUT_DEFAULT_LOCATION_SERVICES = Array.from(new Set(["shoutout", ...(window.SHOUTOUT_DEFAULT_LOCATION_SERVICES || [])]));
  if (window.SHOUTOUT_LOCATION_SERVICES) {
    Object.keys(window.SHOUTOUT_LOCATION_SERVICES).forEach(function(id){
      if (!window.SHOUTOUT_LOCATION_SERVICES[id].includes("shoutout")) {
        window.SHOUTOUT_LOCATION_SERVICES[id].unshift("shoutout");
      }
    });
  }
})();
