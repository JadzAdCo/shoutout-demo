const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const {
  enrichVenueRecord,
  listSocialSecondaryUrls
} = require("../functions/venue-datapoint-extract");

const pages = [
  ["sbm", "buddha-bar.html", "https://www.montecarlosbm.com/fr/restaurant-monaco/buddha-bar-monte-carlo"],
  ["contact", "buddha-sbm-contact.html", "https://www.montecarlosbm.com/fr/contact"],
  ["brand", "buddha-bar-brand.html", "https://www.buddhabar.com/en/restaurants/buddha-bar-monte-carlo/"]
];

let rec = {
  proposedTitle: "Buddha-Bar Monte-Carlo",
  officialWebsite: pages[0][2]
};

for (const [name, file, url] of pages) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  rec = enrichVenueRecord({...rec, officialWebsite: rec.officialWebsite || url}, {
    html,
    text: html.replace(/<[^>]+>/g, " ")
  });
  const emails = [...new Set([...html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(m => m[0]))].slice(0, 10);
  const phones = [...new Set(html.match(/\+377[\d\s.-]{6,20}/g) || [])].slice(0, 8);
  console.log(JSON.stringify({
    page: name,
    ig: rec.socialMediaHandles?.instagram,
    fb: rec.socialMediaHandles?.facebook,
    email: rec.email,
    telephone: rec.telephone,
    secondaries: listSocialSecondaryUrls(html, url).slice(0, 4),
    emailsInHtml: emails,
    monacoPhones: phones
  }, null, 2));
}
