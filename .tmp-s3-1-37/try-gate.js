// Show what the codemod does to main's floqr-auth-gate.js (staged clone), without writing.
const fs = require("fs");
const {stripPageLinkVersions} = require("../scripts/strip-page-link-versions.js");
const file = ".publish-s3-1-37-no-page-link-versions/floqr-auth-gate.js";
const src = fs.readFileSync(file, "utf8");
const out = stripPageLinkVersions(src);
const a = src.split("\n");
const b = out.split("\n");
console.log("lines", a.length, "->", b.length);
console.log(b.slice(28, 42).join("\n"));
