param([string]$Root = (Resolve-Path "$PSScriptRoot\..\..\..").Path)
# Makes web-sized JPG copies of Aurelia's public gallery images (club-owned, no patron faces).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$demo = Join-Path $Root 'reports\vip-aurelia-demo'
$map = [ordered]@{
  'club-1-venue.png'                   = 'main-room'
  'club-gallery-entrance.png'          = 'entrance'
  'club-gallery-vip.png'               = 'vip-room'
  'dj-jordan-booth.png'                = 'dj-booth'
  'staff-barman-pour.png'              = 'bar'
  'club-aurelia-vip-shoutout.png'      = 'vip-table-led'
  'staff-sienna-sparkler.png'          = 'bottle-service'
  'club-aurelia-portrait-birthday.png' = 'portrait-led-wall'
}
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]82)

function Save-Resized([string]$Src, [string]$Out, [int]$MaxSide) {
  $img = [System.Drawing.Image]::FromFile($Src)
  $scale = [math]::Min(1.0, [double]$MaxSide / [math]::Max($img.Width, $img.Height))
  $nw = [int][math]::Round($img.Width * $scale); $nh = [int][math]::Round($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $nw, $nh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $nw, $nh)
  $bmp.Save($Out, $enc, $ep)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  "{0} {1}x{2}" -f (Split-Path $Out -Leaf), $nw, $nh
}

New-Item -ItemType Directory -Force (Join-Path $demo 'photos') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $demo '.preview') | Out-Null
foreach ($k in $map.Keys) {
  $src = Join-Path $Root "images\temp-qa\$k"
  Save-Resized $src (Join-Path $demo "photos\$($map[$k]).jpg") 1024
  Save-Resized $src (Join-Path $demo ".preview\$($map[$k]).jpg") 320 | Out-Null
}
