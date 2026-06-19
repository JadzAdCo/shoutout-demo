/*
  shared-data.js v19
  Truth source for demo categories, templates, club locations, and demo events.
  New model: club/location records are unique. A brand can have many locations.
*/
window.SHOUTOUT_MASTER_ADMIN_EMAILS = [
  "bans.don@gmail.com",
  "don.b@jadzholdings.com"
];

/*
  v25 Master Admin Security Policy
  Master admin must be explicitly listed, use an approved Jadz email domain,
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

window.SHOUTOUT_ADMIN_EMAILS = [
  "bans.don@gmail.com",
  "don.b@jadzholdings.com"
];

window.SHOUTOUT_TEMPLATES = {
  neon: { id: "neon", name: "Neon ShoutOut", scope: "Shared", className: "neon" },
  birthday: { id: "birthday", name: "Birthday Glow", scope: "Shared", className: "neon" },
  vip: { id: "vip", name: "VIP Table", scope: "Shared", className: "gold" },
  bottle: { id: "bottle", name: "Bottle Service", scope: "Club", className: "fire" },
  gold: { id: "gold", name: "Gold Celebration", scope: "Shared", className: "gold" },
  ice: { id: "ice", name: "Ice Blue", scope: "Club", className: "ice" },
  fire: { id: "fire", name: "Fire Night", scope: "Club", className: "fire" },
  latin: { id: "latin", name: "Latin Night", scope: "Club", className: "gold" },
  hiphop: { id: "hiphop", name: "Hip Hop Night", scope: "Club", className: "fire" },
  afrohouse: { id: "afrohouse", name: "Afro House / Amapiano", scope: "Shared", className: "gold" },
  edm: { id: "edm", name: "EDM / House", scope: "Shared", className: "ice" }
};

window.SHOUTOUT_CLUB_LOCATIONS = {
  "zebbies-garden-washington-dc": {
    brandName:"Zebbies Garden", locationName:"Zebbies Garden DC", type:"club",
    country:"United States", regionType:"District", region:"District of Columbia", city:"Washington",
    locationLabel:"Washington, District of Columbia, United States",
    brand:"ZEBBIES GARDEN DC x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ ZEBBIES DC", defaultSub:"",
    genres:["Hip Hop","Afro Beats","EDM","International"], artists:["DJ Nova"],
    activityStatus:"Active demo location",
    activityDates:["Monday Hip Hop","Wednesday EDM","Friday Afro Beats","Saturday International"],
    templates:["birthday","vip","bottle","neon"], active:true
  },
  "heist-washington-dc": {
    brandName:"Heist", locationName:"Heist Washington DC", type:"club",
    country:"United States", regionType:"District", region:"District of Columbia", city:"Washington",
    locationLabel:"Washington, District of Columbia, United States",
    brand:"HEIST DC x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ HEIST DC", defaultSub:"",
    genres:["Hip Hop","Afro Beats","House"], artists:["Resident DJ"],
    activityStatus:"Demo location", activityDates:["Friday Hip Hop","Saturday House"],
    templates:["hiphop","bottle","birthday","fire"], active:true
  },
  "heist-houston-tx": {
    brandName:"Heist", locationName:"Heist Houston", type:"club",
    country:"United States", regionType:"State", region:"Texas", city:"Houston",
    locationLabel:"Houston, Texas, United States",
    brand:"HEIST HOUSTON x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ HEIST HOUSTON", defaultSub:"",
    genres:["Hip Hop","Afro Beats","Amapiano","House"], artists:["DJ H-Town"],
    activityStatus:"Demo location", activityDates:["Monday Afro Beats","Friday Hip Hop","Saturday International"],
    templates:["hiphop","bottle","birthday","gold"], active:true
  },
  "shoko-barcelona-spain": {
    brandName:"Shôko", locationName:"Shôko Barcelona", type:"club",
    country:"Spain", regionType:"Region", region:"Catalonia", city:"Barcelona",
    locationLabel:"Barcelona, Catalonia, Spain",
    brand:"SHÔKO BARCELONA x JADZ ADCO",
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
    brand:"CHRYSTIE CANNES x JADZ ADCO",
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
    brand:"COCOCURE LONDON x JADZ ADCO",
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
    brand:"HÏ IBIZA x JADZ ADCO",
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
    brand:"PACHA IBIZA x JADZ ADCO",
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
    brand:"CAVO PARADISO x JADZ ADCO",
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
    brand:"THE CLUB MILANO x JADZ ADCO",
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
    brand:"MIAMI x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ MIAMI", defaultSub:"",
    genres:["Hip Hop","Afro House","EDM"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Friday Hip Hop","Saturday Afro House"],
    templates:["afrohouse","hiphop","vip","neon"], active:false
  },
  "atlanta-demo-ga": {
    brandName:"Atlanta Club Demo", locationName:"Atlanta Club Demo", type:"club",
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"ATLANTA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ ATLANTA", defaultSub:"",
    genres:["Hip Hop","Afro Beats","Amapiano"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Friday Hip Hop","Saturday Afro Beats"],
    templates:["hiphop","afrohouse","vip","fire"], active:false
  },
  "nyc-demo-ny": {
    brandName:"NYC Club Demo", locationName:"NYC Club Demo", type:"club",
    country:"United States", regionType:"State", region:"New York", city:"New York",
    locationLabel:"New York, New York, United States",
    brand:"NYC x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ NYC", defaultSub:"",
    genres:["Hip Hop","House","Afro House"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Wednesday House","Friday Hip Hop"],
    templates:["hiphop","edm","vip","ice"], active:false
  },
  "la-demo-ca": {
    brandName:"LA Club Demo", locationName:"LA Club Demo", type:"club",
    country:"United States", regionType:"State", region:"California", city:"Los Angeles",
    locationLabel:"Los Angeles, California, United States",
    brand:"LA x JADZ ADCO",
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
    brand:"SIGNATURE CLUB DC x JADZ ADCO",
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
    brand:"JOSEPHINE ATLANTA x JADZ ADCO",
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
    brand:"MARQUEE NEW YORK x JADZ ADCO",
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
    brand:"LAVO NEW YORK x JADZ ADCO",
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
    brand:"NEBULA NEW YORK x JADZ ADCO",
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
    brand:"ACADEMY LA x JADZ ADCO",
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
    brand:"EXCHANGE LA x JADZ ADCO",
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
    brand:"SOUND NIGHTCLUB LA x JADZ ADCO",
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
    brand:"LIV MIAMI x JADZ ADCO",
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
    brand:"CLUB SPACE MIAMI x JADZ ADCO",
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
    brand:"E11EVEN MIAMI x JADZ ADCO",
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
    brand:"DISTRICT ATLANTA x JADZ ADCO",
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
    brand:"TONGUE & GROOVE ATLANTA x JADZ ADCO",
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
    brand:"REVE ATLANTA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ REVE", defaultSub:"",
    genres:["Hip Hop","Afro Beats","Open Format"], artists:["Resident DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday Hip Hop","Saturday Afro Beats / Open Format"],
    templates:["hiphop","afrohouse","vip","gold"], active:true
  },
  "shoko-barcelona-beach-club-spain": {
    brandName:"Shôko", locationName:"Shôko Barcelona Beach Club", type:"beach-club",
    categories:["Beach Clubs","Clubs","Events","ShoutOut"],
    country:"Spain", regionType:"Region", region:"Catalonia", city:"Barcelona",
    locationLabel:"Barcelona Beachfront, Catalonia, Spain",
    brand:"SHÔKO BEACH CLUB x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ SHÔKO BEACH", defaultSub:"",
    genres:["Hip Hop","House","Reggaeton","R&B","Afro Beats"], artists:["Noriel","Resident DJs"],
    activityStatus:"Beachfront club / nightlife venue",
    activityDates:["Beachfront dining + late-night club programming","Thursday Noriel event seed"],
    templates:["latin","hiphop","vip","neon"], active:true
  },
  "nammos-mykonos-greece": {
    brandName:"Nammos", locationName:"Nammos Mykonos", type:"beach-club",
    categories:["Beach Clubs","Lounges","Events","ShoutOut"],
    country:"Greece", regionType:"Island", region:"Mykonos", city:"Mykonos",
    locationLabel:"Mykonos, South Aegean, Greece",
    brand:"NAMMOS MYKONOS x JADZ ADCO",
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
    name: "Jadz Demo Promotions",
    promoterGroup: "Jadz Demo Promotions",
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
  "Jadz AdCo",
  "Jadz Holdings",
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
  blackwhite: { id:'blackwhite', name:'Classic Black & White', scope:'Shared', className:'classic-bw', category:'Classic' },
  summer: { id:'summer', name:'Summer Vibes', scope:'Shared', className:'summer', category:'Seasonal' },
  car: { id:'car', name:'Car Meet / Luxury Ride', scope:'Shared', className:'car', category:'Lifestyle' },
  champagne: { id:'champagne', name:'Champagne Celebration', scope:'Shared', className:'gold', category:'VIP' },
  beach: { id:'beach', name:'Beach Party', scope:'Shared', className:'summer', category:'Beach' },
  graduation: { id:'graduation', name:'Graduation Night', scope:'Shared', className:'classic-bw', category:'Milestone' },
  wedding: { id:'wedding', name:'Wedding Celebration', scope:'Shared', className:'gold', category:'Milestone' },
  sports: { id:'sports', name:'Sports Night', scope:'Shared', className:'fire', category:'Lifestyle' },
  luxury: { id:'luxury', name:'Luxury Gold', scope:'Shared', className:'gold', category:'VIP' },
  corporate: { id:'corporate', name:'Corporate Event', scope:'Shared', className:'classic-bw', category:'Business' }
});

window.SHOUTOUT_STANDARD_TEMPLATE_IDS = ['blackwhite','summer','car','champagne','beach','graduation','wedding','sports','luxury','corporate'];

Object.keys(window.SHOUTOUT_CLUB_LOCATIONS || {}).forEach(id => {
  const loc = window.SHOUTOUT_CLUB_LOCATIONS[id];
  loc.templates = Array.from(new Set([...(loc.templates || []), ...window.SHOUTOUT_STANDARD_TEMPLATE_IDS]));
});

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
