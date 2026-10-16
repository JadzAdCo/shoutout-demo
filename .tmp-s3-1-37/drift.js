// For each file changed in the commit: does origin/main equal commit^ (ignoring CRLF and v= values)?
const {execSync} = require("child_process");
const commit = process.argv[2];
const sh = cmd => execSync(cmd, {encoding: "utf8", maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "ignore"]});
const norm = s => s.replace(/\r\n/g, "\n").replace(/([?&])v=[^"'&\s#<>`]*/g, "$1v=X").trimEnd();
const files = sh(`git diff --name-only ${commit}~1 ${commit}`).split(/\r?\n/).filter(Boolean);
for (const f of files) {
  let parent = null, main = null;
  try { parent = sh(`git show ${commit}~1:${f}`); } catch {}
  try { main = sh(`git show origin/main:${f}`); } catch {}
  const tag = parent === null ? "NEW" : main === null ? "NOT-ON-MAIN" : norm(parent) === norm(main) ? "same" : "DRIFT";
  console.log(tag.padEnd(12), f);
}
