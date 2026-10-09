/* BartR demo catalog seed — pure helpers (missing-only; never overwrites venue/seller edits).
   Design notes: .cursor/rules/design-notes-data-classification.mdc → "Seed endpoints + clubMedia storage" */
"use strict";

const SEED_SOURCE = "seedLucyCobraBartrCatalog";
const REFUND_POLICY = "Unused physical art items may be returned within 14 days unused and in original packaging. Custom commissions are final sale.";
const REFUND_SNAPSHOT = "Unused physical art items may be returned within 14 days unused and in original packaging.";
const ACCENTS = ["#dfff5a", "#7ad7ff", "#ffb347", "#c4a1ff", "#ff6b9d"];

const LUCY_COBRA_CATALOG = Object.freeze([
  {name:"Sunset Over Dupont (oil)", category:"Artwork", priceCents:18500, desc:"Original oil painting, 16x20 framed."},
  {name:"Neon Corridor Study", category:"Artwork", priceCents:9200, desc:"Acrylic on canvas nightlife study."},
  {name:"Mediterranean Rooftop Light", category:"Artwork", priceCents:12400, desc:"Watercolor inspired by rooftop evenings."},
  {name:"Abstract Bassline #3", category:"Artwork", priceCents:7800, desc:"Mixed media abstract for lounge walls."},
  {name:"Portrait: Midnight Patron", category:"Artwork", priceCents:21000, desc:"Charcoal portrait series print + frame option."},
  {name:"Gold Leaf Mini Series (set of 3)", category:"Artwork", priceCents:6500, desc:"Three small gold-leaf panels."},
  {name:"Club Geometry Print", category:"Artwork", priceCents:4500, desc:"Limited giclee print, signed."},
  {name:"City Rain Reflections", category:"Artwork", priceCents:9900, desc:"Oil on board, urban night rain."},
  {name:"Hammered Brass Cuff", category:"Jewelry", priceCents:6800, desc:"Hand-hammered brass cuff bracelet."},
  {name:"Resin Drop Earrings", category:"Jewelry", priceCents:3200, desc:"Lightweight resin and gold-tone earrings."},
  {name:"Beaded Night Collar", category:"Jewelry", priceCents:5400, desc:"Statement beaded collar necklace."},
  {name:"Silver Stack Ring Set", category:"Jewelry", priceCents:4100, desc:"Three textured sterling-finish rings."},
  {name:"Enamel Pin: Throw a ShoutOut", category:"Jewelry", priceCents:1800, desc:"Hard enamel pin for jackets and bags."},
  {name:"Gallery Float Frame 16x20", category:"Art accessories", priceCents:5200, desc:"Black gallery float frame, ready to hang."},
  {name:"Walnut Shadow Box Frame", category:"Art accessories", priceCents:7400, desc:"Deep walnut shadow box for mixed media."},
  {name:"Pro Acrylic Brush Set (12)", category:"Art accessories", priceCents:3600, desc:"Synthetic brush set for acrylic and oil."},
  {name:"Palette Knife Kit", category:"Art accessories", priceCents:2800, desc:"Five stainless palette knives."},
  {name:"Artist Travel Case", category:"Art accessories", priceCents:8900, desc:"Compact hard case for brushes and tubes."},
  {name:"Linen Canvas Pack (5)", category:"Art accessories", priceCents:4700, desc:"Pre-stretched linen canvases, assorted."},
  {name:"Archival Print Sleeve Bundle", category:"Art accessories", priceCents:2200, desc:"Acid-free sleeves for print editions."}
].map(item => Object.freeze({...item, seedKey: seedKeyFor(item.name)})));

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function seedKeyFor(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function sellerProfileDefaults(seller = {}) {
  return {
    country: "United States",
    commerceEnabled: true,
    commerceStoreName: text(`${seller.displayName || seller.username || "Lucy Cobra"} Arts`, 120),
    commerceContact: text(seller.email, 200),
    commerceRefundPolicy: REFUND_POLICY,
    publicProfileVisibility: "public"
  };
}

/** Only fields the seller profile does not have yet. An explicit `false` / edited value is kept. */
function missingProfilePatch(existing = {}, defaults = {}) {
  const patch = {};
  Object.keys(defaults).forEach(key => {
    if (isBlank(defaults[key])) return;
    if (isBlank(existing[key])) patch[key] = defaults[key];
  });
  return patch;
}

/** Catalog rows with no existing product by seedKey or (case-insensitive) name. Existing products are never touched. */
function productsToCreate(catalog = LUCY_COBRA_CATALOG, existingProducts = []) {
  const names = new Set();
  const keys = new Set();
  existingProducts.forEach(row => {
    if (row?.name) names.add(String(row.name).trim().toLowerCase());
    if (row?.seedKey) keys.add(String(row.seedKey));
  });
  return catalog.filter(item => !keys.has(item.seedKey) && !names.has(item.name.trim().toLowerCase()));
}

function placeholderImage(title, index) {
  const label = String(title || "Art").slice(0, 28).replace(/[<>&"']/g, "");
  const accent = ACCENTS[index % ACCENTS.length];
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#14121c"/><circle cx="180" cy="160" r="140" fill="${accent}" opacity=".35"/><circle cx="420" cy="420" r="160" fill="#ff64d8" opacity=".25"/><text x="300" y="300" fill="#fff" font-size="28" text-anchor="middle" font-family="Georgia, serif">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(raw)}`;
}

function productDoc(item, index, {sellerUid, storeName, contact}) {
  return {
    sellerEntityId: sellerUid,
    sellerEntityType: "member",
    sellerUid,
    sellerName: storeName,
    sellerCountry: "United States",
    marketplaceCountry: "US",
    marketplace: "bartr",
    name: item.name,
    seedKey: item.seedKey,
    category: item.category,
    productType: "physical",
    previewMediaType: "image",
    mediaLicense: "",
    priceCents: item.priceCents,
    inventory: 8 + (index % 5),
    imageUrl: placeholderImage(item.name, index),
    description: item.desc,
    requiresShipping: true,
    active: true,
    refundPolicySnapshot: REFUND_SNAPSHOT,
    contactSnapshot: text(contact, 200),
    seededBy: SEED_SOURCE
  };
}

module.exports = {
  SEED_SOURCE,
  LUCY_COBRA_CATALOG,
  seedKeyFor,
  sellerProfileDefaults,
  missingProfilePatch,
  productsToCreate,
  productDoc
};
