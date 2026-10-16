param([string]$Tag = "local", [string]$Base = "..", [string]$Message = "")
Add-Type -AssemblyName System.Drawing
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$out = $PSScriptRoot
$prof = Join-Path $env:TEMP "floqr-edge-shot6"
$sizes = [ordered]@{ "led-96x48" = @(624, 312); "led-64x48" = @(416, 312); "led-64x32" = @(416, 208) }
foreach ($k in $sizes.Keys) {
  $w = $sizes[$k][0]; $h = $sizes[$k][1]
  $q = "w=$w&h=$h&s=$k&base=" + [uri]::EscapeDataString($Base)
  if ($Message) { $q += "&m=" + [uri]::EscapeDataString($Message) }
  $url = "http://127.0.0.1:8765/.tmp-s3-1-38/frame.html?$q"
  $raw = Join-Path $out "raw-$Tag-$k.png"
  $png = Join-Path $out "shiloh-$Tag-$k.png"
  Remove-Item $raw, $png -ErrorAction SilentlyContinue
  & $edge --headless --disable-gpu --hide-scrollbars --no-first-run "--user-data-dir=$prof" --force-device-scale-factor=1 --virtual-time-budget=25000 "--window-size=800,600" "--screenshot=$raw" $url 2>$null | Out-Null
  $deadline = (Get-Date).AddSeconds(60)
  while (!(Test-Path $raw) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
  $img = [System.Drawing.Image]::FromFile($raw)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle 0, 0, $w, $h), [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose(); Remove-Item $raw
  "$k -> $png"
}

