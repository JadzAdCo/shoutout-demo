// Harmless markup-injection probe: does a preview URL's backgroundUrl become live DOM? Adds a <b id=floqrprobe>; runs no script, writes nothing.
import {spawn} from "node:child_process";
import {writeFileSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const PORT = 9334;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const probe = "x><b id=floqrprobe>PROBE</b><i ";
const urls = {
  football: `https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc&preview=1&template=zebbiesFootballTeamIntro&screen=led-96x48&backgroundUrl=${encodeURIComponent(probe)}`,
  neon: `https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc&preview=1&template=neon&backgroundUrl=${encodeURIComponent(probe)}&main=${encodeURIComponent("<b id=floqrprobe2>x</b>")}&media=${encodeURIComponent('x"><b id=floqrprobe3>m</b>')}`
};
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(OUT, ".chrome-profile-probe")}`, "--no-first-run", "about:blank"], {stdio: "ignore"});
await sleep(2500);
const results = {};
try {
  for (const [name, url] of Object.entries(urls)) {
    const info = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, {method: "PUT"})).json();
    const ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise(ok => { ws.onopen = ok; });
    let id = 0; const pending = new Map();
    ws.onmessage = m => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
    const send = (method, params = {}) => new Promise(ok => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({id: i, method, params})); });
    await send("Emulation.setDeviceMetricsOverride", {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false});
    await send("Page.navigate", {url});
    await sleep(9000);
    const r = await send("Runtime.evaluate", {returnByValue: true, expression: `({
      canvasClass: document.querySelector('#displayCanvas')?.className,
      probeFootball: !!document.getElementById('floqrprobe'),
      probeMain: !!document.getElementById('floqrprobe2'),
      probeMedia: !!document.getElementById('floqrprobe3'),
      stageOuter: (document.querySelector('.football-intro-stage')?.outerHTML || '').slice(0, 400)
    })`});
    results[name] = {url, ...r.result.result.value};
    const shot = await send("Page.captureScreenshot", {format: "png"});
    writeFileSync(join(OUT, `probe-${name}.png`), Buffer.from(shot.result.data, "base64"));
    ws.close();
  }
} finally {
  writeFileSync(join(OUT, "probe-results.json"), JSON.stringify(results, null, 2));
  chrome.kill();
}
console.log(JSON.stringify(results, null, 2));
