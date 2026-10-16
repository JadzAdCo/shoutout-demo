[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-v29-09-118"
$git = "C:\Program Files\Git\cmd\git.exe"
$utf8 = New-Object System.Text.UTF8Encoding $false

function Read-Lf([string]$path) {
  return [IO.File]::ReadAllText($path).Replace("`r`n", "`n")
}
function Write-Lf([string]$path, [string]$text) {
  [IO.File]::WriteAllText($path, $text.Replace("`r`n", "`n"), $utf8)
}
function Replace-Once([string]$text, [string]$old, [string]$new, [string]$label) {
  $old = $old.Replace("`r`n", "`n").TrimEnd("`n")
  $new = $new.Replace("`r`n", "`n").TrimEnd("`n")
  $idx = $text.IndexOf($old)
  if ($idx -lt 0) { throw "patch miss: $label" }
  return $text.Remove($idx, $old.Length).Insert($idx, $new)
}

if (-not (Test-Path (Join-Path $stage "display-app.js"))) {
  & $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
  if ($LASTEXITCODE -ne 0) { throw "Clone of shoutout-demo failed" }
}

Copy-Item (Join-Path $root "patron-app.js") (Join-Path $stage "patron-app.js") -Force
Copy-Item (Join-Path $root "index.html") (Join-Path $stage "index.html") -Force

$appPath = Join-Path $stage "display-app.js"
$app = Read-Lf $appPath
$start = $app.IndexOf("  function resetBackgroundLayer(bgEl) {")
if ($start -lt 0) { throw "patch miss: resetBackgroundLayer" }
$endMarker = "    if (backgroundGradient && /^linear-gradient"
$end = $app.IndexOf($endMarker, $start)
if ($end -lt 0) { throw "patch miss: applyBackgroundLayer end" }
$newBg = @'
  function resetBackgroundLayer(bgEl) {
    if (!bgEl) return;
    bgEl.className = "display-background";
    bgEl.style.backgroundImage = "";
    bgEl.style.background = "";
    bgEl.style.backgroundSize = "";
    bgEl.style.backgroundPosition = "";
    bgEl.style.backgroundRepeat = "";
    delete bgEl.dataset.backgroundFit;
  }

  function resolveBackgroundFit(data = {}, template = {}, backgroundUrl = "") {
    const explicit = String(data.backgroundFit || "").toLowerCase();
    if (explicit === "contain" || explicit === "cover") return explicit;
    const url = String(backgroundUrl || "").trim();
    if (!url) return "cover";
    const designed = String(template.defaultBackgroundUrl || "").trim();
    if (designed && url === designed) return "cover";
    if (template.sport || template.jerseyCssBack || String(template.id || "").startsWith("heist") || /jersey/i.test(String(template.id || ""))) {
      return "cover";
    }
    if (String(data.mediaFit || "").toLowerCase() === "cover") return "cover";
    return "contain";
  }

  function applyBackgroundLayer(bgEl, { backgroundUrl = "", backgroundColor = "", backgroundGradient = "", fit = "cover" } = {}) {
    resetBackgroundLayer(bgEl);
    if (backgroundUrl) {
      const size = fit === "contain" ? "contain" : "cover";
      bgEl.style.backgroundImage = "url(\"" + String(backgroundUrl).replace(/"/g, "%22") + "\")";
      bgEl.style.backgroundSize = size;
      bgEl.style.backgroundPosition = "center";
      bgEl.style.backgroundRepeat = "no-repeat";
      bgEl.dataset.backgroundFit = size;
      return true;
    }

'@
$newBg = $newBg.Replace("`r`n", "`n")
$app = $app.Remove($start, $end - $start).Insert($start, $newBg)
$app = Replace-Once $app @'
      mediaFit: params.get("mediaFit") || "contain",
      screenFormatId:
'@ @'
      mediaFit: params.get("mediaFit") || "contain",
      backgroundFit: params.has("backgroundFit")
        ? params.get("backgroundFit")
        : "",
      screenFormatId:
'@ "url preview backgroundFit"
$app = Replace-Once $app @'
    const hasBackgroundLayer = applyBackgroundLayer(bgEl, { backgroundUrl, backgroundColor, backgroundGradient });
'@ @'
    const backgroundFit = resolveBackgroundFit(data, t, backgroundUrl);
    const hasBackgroundLayer = applyBackgroundLayer(bgEl, { backgroundUrl, backgroundColor, backgroundGradient, fit: backgroundFit });
'@ "render() applyBackgroundLayer fit"
Write-Lf $appPath $app

$oldCss = @'
.display-background{
  position:absolute;
  inset:0;
  z-index:0;
  background-color:#050507;
  background-size:cover;
  background-position:center;
  background-repeat:no-repeat;
}
.display-text-overlay{
  position:relative;
  z-index:1;
  width:100%;
  height:100%;
  min-height:100vh;
'@
$newCss = @'
.display-background{
  position:absolute;
  inset:0;
  z-index:0;
  background-color:#050507;
  background-size:cover;
  background-position:center;
  background-repeat:no-repeat;
}
/* v29.09.118: patron photos letterbox (contain); designed kits stay cover */
.display-background[data-background-fit="contain"]{
  background-size:contain!important;
  background-position:center!important;
  background-color:#000;
}
body.display{
  display:grid;
  place-items:center;
}
.display-canvas[data-screen-format-id="led-64x48"],
.display-canvas[data-screen-format-id="p125-64x48"]{
  width:min(100vw, calc(100vh * 4 / 3));
  height:min(100vh, calc(100vw * 3 / 4));
}
.display-canvas[data-screen-format-id="led-96x48"],
.display-canvas[data-screen-format-id="p125-96x48"],
.display-canvas[data-screen-format-id="led-64x32"],
.display-canvas[data-screen-format-id="p125-64x32"]{
  width:min(100vw, calc(100vh * 2 / 1));
  height:min(100vh, calc(100vw * 1 / 2));
}
.display-text-overlay{
  position:relative;
  z-index:1;
  width:100%;
  height:100%;
  min-height:100%;
'@
$cssPath = Join-Path $stage "display.css"
$css = Read-Lf $cssPath
$css = Replace-Once $css $oldCss $newCss "display.css contain + aspect lock"
Write-Lf $cssPath $css

foreach ($name in @("display.html", "display2.html")) {
  $htmlPath = Join-Path $stage $name
  $html = Read-Lf $htmlPath
  $html2 = ([regex]'display\.css\?v=[^"\s]+').Replace($html, 'display.css?v=29.09.118', 1)
  $html2 = ([regex]'display-app\.js\?v=[^"\s]+').Replace($html2, 'display-app.js?v=29.09.118', 1)
  if ($html2 -eq $html) { throw "patch miss: $name cache bust" }
  Write-Lf $htmlPath $html2
}

$files = @(
  "display.html",
  "display2.html",
  "display.css",
  "display-app.js",
  "patron-app.js",
  "index.html"
)

Push-Location $stage
try {
  & $git config user.name "JadzAdCo"
  & $git config user.email "290611448+JadzAdCo@users.noreply.github.com"
  & $git add -- $files
  & $git diff --cached --stat
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Show full patron photos on LED displays (v29.09.118)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location }
Write-Host "Published v29.09.118 Pages"
