"use strict";
const {execFileSync} = require("child_process");
const fs = require("fs");
const norm = (s) => s.replace(/\r\n/g, "\n")
  .replace(/([?&]|&amp;)v=[^"'&\s#<>)]+/g, "$1v=X")
  .replace(/searchParams\.set\("v", "[^"]+"\)/g, 'searchParams.set("v", "X")');
const files = execFileSync("git", ["diff", "--name-only"], {encoding: "utf8"}).split("\n").filter((f) => f.endsWith(".html"));
for (const f of files) {
  const head = execFileSync("git", ["show", `HEAD:${f}`], {encoding: "utf8", maxBuffer: 64 << 20});
  const work = fs.readFileSync(f, "utf8");
  console.log(norm(head) === norm(work) ? "BUMP-ONLY " : "OTHER     ", f);
}
