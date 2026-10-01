const https = require("https");

const base = "https://jadzadco.github.io/shoutout-demo";
const v = "s3.1.0";
const body = JSON.stringify({
  to: "bans.don@gmail.com",
  package: v,
  v,
  note: "FLOQR s3.1.0 — Paid in-app ads. Search splash rotates ads again with real impression/click stats; ads are server-only (no client can publish); Stripe pay-as-you-go/subscription + contract invoice; Master Admin Ad Management (Approval queue, Live, Stats with Clear, SMS & WhatsApp intake, Settings). Pages SHA 41d3948. Functions tests green; 30 Functions + Firestore/Storage rules deployed.",
  links: [
    {label: "Master Admin Ad Management", url: `${base}/master-admin.html?v=${v}#adApprovalQueue`},
    {label: "Patron Search (splash ad)", url: `${base}/?v=${v}&start=search`},
    {label: "My Profile Ad Campaigns", url: `${base}/patron-portal.html?v=${v}&tab=ad-campaigns`},
    {label: "Club Admin In-App Marketing", url: `${base}/admin.html?v=${v}`}
  ]
});

const req = https.request({
  hostname: "us-central1-shoutoutdemo-5b402.cloudfunctions.net",
  path: "/emailFloqrPreviewLinks",
  method: "POST",
  headers: {"Content-Type": "application/json", "Content-Length": Buffer.byteLength(body)}
}, res => {
  let data = "";
  res.on("data", chunk => { data += chunk; });
  res.on("end", () => console.log(res.statusCode, data.slice(0, 300)));
});
req.on("error", error => console.error(error.message));
req.write(body);
req.end();
