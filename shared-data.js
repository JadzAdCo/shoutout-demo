
/* shared-data.js - common demo clubs/templates */
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
  hiphop: { id: "hiphop", name: "Hip Hop Night", scope: "Club", className: "fire" }
};

window.SHOUTOUT_CLUBS = {
  "zebbies-garden": { name: "Zebbies Garden", country: "United States", region: "District of Columbia", city: "Washington", locationLabel: "Washington, District of Columbia, United States", brand: "ZEBBIES GARDEN x JADZ ADCO", defaultMain: "USE SHOUT OUT @ ZEBBIES", defaultSub: "", dj: "DJ Nova", schedule: { Monday: "Hip Hop", Wednesday: "EDM", Friday: "Afro Beats", Saturday: "International" }, templates: ["birthday", "vip", "bottle", "neon"], active: true },
  "st-yves": { name: "St. Yves", country: "United States", region: "District of Columbia", city: "Washington", locationLabel: "Washington, District of Columbia, United States", brand: "ST. YVES x JADZ ADCO", defaultMain: "USE SHOUT OUT @ ST. YVES", defaultSub: "", dj: "DJ Saint", schedule: { Thursday: "EDM", Friday: "Hip Hop", Saturday: "International" }, templates: ["vip", "gold", "birthday", "neon"], active: true },
  "abigail": { name: "Abigail", country: "Spain", region: "Catalonia", city: "Barcelona", locationLabel: "Barcelona, Spain", brand: "ABIGAIL x JADZ ADCO", defaultMain: "USE SHOUT OUT @ ABIGAIL", defaultSub: "", dj: "DJ Luna", schedule: { Tuesday: "Latin", Thursday: "Cuban", Saturday: "EDM", Sunday: "International" }, templates: ["latin", "birthday", "vip", "ice"], active: true },
  "heist": { name: "Heist", country: "United States", region: "Georgia", city: "Atlanta", locationLabel: "Atlanta, Georgia, United States", brand: "HEIST x JADZ ADCO", defaultMain: "USE SHOUT OUT @ HEIST", defaultSub: "", dj: "DJ Cipher", schedule: { Monday: "Hip Hop", Friday: "Afro Beats", Saturday: "Hip Hop" }, templates: ["hiphop", "birthday", "bottle", "fire"], active: true },
  "decades": { name: "Decades", country: "United States", region: "California", city: "Los Angeles", locationLabel: "Los Angeles, California, United States", brand: "DECADES x JADZ ADCO", defaultMain: "USE SHOUT OUT @ DECADES", defaultSub: "", dj: "DJ Era", schedule: { Wednesday: "EDM", Friday: "Latin", Saturday: "International" }, templates: ["neon", "vip", "gold", "birthday"], active: true },
  "zebbies-dallas": { name: "Zebbies Garden", country: "United States", region: "Texas", city: "Dallas", locationLabel: "Dallas, Texas, United States", brand: "ZEBBIES DALLAS x JADZ ADCO", defaultMain: "USE SHOUT OUT @ ZEBBIES DALLAS", defaultSub: "", dj: "DJ Metro", schedule: { Thursday: "Hip Hop", Friday: "Latin", Saturday: "EDM" }, templates: ["birthday", "vip", "bottle", "fire"], active: true },
  "abigail-austin": { name: "Abigail", country: "United States", region: "Texas", city: "Austin", locationLabel: "Austin, Texas, United States", brand: "ABIGAIL AUSTIN x JADZ ADCO", defaultMain: "USE SHOUT OUT @ ABIGAIL AUSTIN", defaultSub: "", dj: "DJ Sol", schedule: { Tuesday: "Latin", Friday: "International", Saturday: "EDM" }, templates: ["latin", "neon", "vip", "ice"], active: true },
  "heist-houston": { name: "Heist", country: "United States", region: "Texas", city: "Houston", locationLabel: "Houston, Texas, United States", brand: "HEIST HOUSTON x JADZ ADCO", defaultMain: "USE SHOUT OUT @ HEIST HOUSTON", defaultSub: "", dj: "DJ H-Town", schedule: { Monday: "Afro Beats", Friday: "Hip Hop", Saturday: "International" }, templates: ["hiphop", "bottle", "birthday", "gold"], active: true },
  "decades-nyc": { name: "Decades", country: "United States", region: "New York", city: "New York", locationLabel: "New York, New York, United States", brand: "DECADES NYC x JADZ ADCO", defaultMain: "USE SHOUT OUT @ DECADES NYC", defaultSub: "", dj: "DJ Skyline", schedule: { Wednesday: "EDM", Friday: "Hip Hop", Saturday: "International" }, templates: ["neon", "birthday", "vip", "ice"], active: true },
  "st-yves-cannes": { name: "St. Yves", country: "France", region: "Cote D’Azur", city: "Cannes", locationLabel: "Cannes, Cote D’Azur, France", brand: "ST. YVES CANNES x JADZ ADCO", defaultMain: "USE SHOUT OUT @ ST. YVES CANNES", defaultSub: "", dj: "DJ Riviera", schedule: { Thursday: "International", Friday: "EDM", Saturday: "Latin" }, templates: ["gold", "vip", "neon", "birthday"], active: true }
};
