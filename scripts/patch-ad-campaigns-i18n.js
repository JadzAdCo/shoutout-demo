const fs = require("fs");
const p = "floqr-i18n.js";
let s = fs.readFileSync(p, "utf8");
const map = [
  ['"nav.bartrStore": "BartR Store"', '"nav.adCampaigns": "Ad Campaigns"'],
  ['"nav.bartrStore": "Boutique BartR"', '"nav.adCampaigns": "Campagnes publicitaires"'],
  ['"nav.bartrStore": "BartR-Shop"', '"nav.adCampaigns": "Werbekampagnen"'],
  ['"nav.bartrStore": "Tienda BartR"', '"nav.adCampaigns": "Campañas publicitarias"'],
  ['"nav.bartrStore": "BartR-winkel"', '"nav.adCampaigns": "Advertentiecampagnes"'],
  ['"nav.bartrStore": "Магазин BartR"', '"nav.adCampaigns": "Рекламные кампании"'],
  ['"nav.bartrStore": "BartR Negozio"', '"nav.adCampaigns": "Campagne pubblicitarie"'],
  ['"nav.bartrStore": "Loja BartR"', '"nav.adCampaigns": "Campanhas publicitárias"'],
  ['"nav.bartrStore": "Κατάστημα BartR"', '"nav.adCampaigns": "Διαφημιστικές καμπάνιες"'],
  ['"nav.bartrStore": "Sklep BartR"', '"nav.adCampaigns": "Kampanie reklamowe"'],
  ['"nav.bartrStore": "متجر BartR"', '"nav.adCampaigns": "حملات إعلانية"']
];
for (const [needle, line] of map) {
  if (!s.includes(needle)) {
    console.error("MISS", needle);
    process.exit(1);
  }
  if (s.includes(line)) continue;
  s = s.replace(needle, `${needle},\n      ${line}`);
}
fs.writeFileSync(p, s);
console.log("keys", (s.match(/nav\.adCampaigns/g) || []).length);
