// Which exported Cloud Functions reach the changed helpers? Top-level-unit call graph across functions/*.js.
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "functions");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".js") && !f.endsWith(".test.js"));
const units = [];
for (const f of files) {
  const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
  let cur = null;
  lines.forEach((line, i) => {
    let m = line.match(/^exports\.(\w+)\s*=/) || line.match(/^(?:async\s+)?function\s+(\w+)/) || line.match(/^const\s+(\w+)\s*=\s*(?:async\s*)?(?:\(|function|\w+\s*=>)/);
    if (m) {
      cur = {file: f, name: m[1], isExport: /^exports\./.test(line), start: i + 1, body: []};
      units.push(cur);
    }
    if (cur) cur.body.push(line);
  });
}
const changed = process.argv.slice(2);
const reach = new Set(changed);
let grew = true;
while (grew) {
  grew = false;
  for (const u of units) {
    if (reach.has(u.name)) continue;
    const text = u.body.join("\n");
    for (const name of reach) {
      if (new RegExp(`\\b${name}\\b`).test(text.replace(new RegExp(`^(?:exports\\.|(?:async\\s+)?function\\s+|const\\s+)${u.name}`), ""))) {
        reach.add(u.name);
        grew = true;
        break;
      }
    }
  }
}
const exportsHit = units.filter(u => u.isExport && reach.has(u.name)).map(u => `${u.name} (${u.file}:${u.start})`);
console.log([...new Set(exportsHit)].join("\n"));
