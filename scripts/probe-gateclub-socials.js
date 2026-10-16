const {extractSocialHandles, listSocialSecondaryUrls, enrichVenueRecord} = require("../functions/venue-datapoint-extract");

const html = `
<link href="https://www.gateclubparis.com/wp-content/plugins/contact-form-7/includes/css/styles.css?ver=5.8.6"/>
<a href="tel:0171253215">01 71 25 32 15</a>
<a href="mailto:coporate@elegance-hospitality.com">Contact</a>
<a href="mailto:privatisation@gateclubparis.com">Privatisation</a>
<a href="https://www.instagram.com/gateclubparis/">Actualités</a>
<a href="https://www.instagram.com/justin_prinz/">Justin Prinz</a>
`;

const enriched = enrichVenueRecord({
  proposedTitle: "Gate Club Paris",
  officialWebsite: "https://www.gateclubparis.com/"
}, {html, text: "Gate Club Paris"});

const secondaries = listSocialSecondaryUrls(html + `<a href="/contact-us/">Contact</a>`, "https://www.gateclubparis.com/");
console.log(JSON.stringify({
  instagram: enriched.socialMediaHandles.instagram,
  email: enriched.email,
  telephone: enriched.telephone,
  secondaries: secondaries.slice(0, 5),
  photographerRejected: extractSocialHandles(html, {venueName:"Gate Club Paris", website:"https://www.gateclubparis.com/"}).instagram === "@gateclubparis"
}, null, 2));
