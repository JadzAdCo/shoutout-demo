#!/usr/bin/env python3
"""Build Baller's Express LED card faces from the Cursor package artwork.

Source: reports/baller-cards/express-package/ballers-express-business.png
Outputs: images/baller/*-{2x1,4x3}.png (+ -amex- twins — same Baller's Express art)

Pipeline:
1) Flood-fill the light/white exterior outside the rounded card → opaque black
   (antialiased edge). Gold rim / lettering / highlights are preserved.
2) Paste a crisp SVG EMV chip (images/baller/baller-emv-chip.svg) at the
   calibrated CHIP box so portrait overlays cannot leave a smeared base chip.
3) Letterbox onto LED aspect canvases (never crop the ornate rim).

The package art already has BALLER'S EXPRESS / BUSINESS, Valid Thru 12/50, blank
name/company rows, ornate gold rim, and the Roman warrior medallion. Do not
regenerate lettering or punch a face hole — Alert composites a face-only ellipse
over the warrior face via display CSS (helmet / rim stay visible; chip overlays).
"""
from __future__ import annotations

from collections import deque
from pathlib import Path
import io
import json
from PIL import Image, ImageFilter, ImageDraw
import cairosvg

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "reports/baller-cards/express-package/ballers-express-business.png"
CHIP_SVG = ROOT / "images/baller/baller-emv-chip.svg"
CHIP_PNG = ROOT / "images/baller/baller-emv-chip.png"
OUT = ROOT / "images/baller"
META_OUT = Path("/tmp/baller-express-face-css.json")

FILL = (6, 6, 8)

# Calibrated on the 1581×995 package PNG.
FACE = {"cx": 278, "cy": 252, "rx": 148, "ry": 168}
CHIP = {"x0": 217, "y0": 382, "x1": 383, "y1": 479}
MEDALLION = {"cx": 248, "cy": 268, "r": 198}


def is_exterior_seed(rgb, luma=170, chroma=36) -> bool:
  """Near-white / light-gray exterior (package art wedges), not gold rim."""
  r, g, b = (int(rgb[0]), int(rgb[1]), int(rgb[2]))
  if max(r, g, b) < luma:
    return False
  return max(abs(r - g), abs(g - b), abs(r - b)) <= chroma


def exterior_mask(rgb: Image.Image) -> Image.Image:
  """BFS flood from the four corners through light exterior, then dilate through
  pale antialias fringe while protecting saturated gold ornament."""
  w, h = rgb.size
  px = rgb.load()
  visited = [[False] * w for _ in range(h)]
  q: deque[tuple[int, int]] = deque()
  for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
    x, y = seed
    if is_exterior_seed(px[x, y]):
      q.append(seed)
      visited[y][x] = True
  while q:
    x, y = q.popleft()
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
      if nx < 0 or ny < 0 or nx >= w or ny >= h or visited[ny][nx]:
        continue
      if not is_exterior_seed(px[nx, ny]):
        continue
      visited[ny][nx] = True
      q.append((nx, ny))
  mask = Image.new("L", (w, h), 0)
  mp = mask.load()
  for y in range(h):
    row = visited[y]
    for x in range(w):
      if row[x]:
        mp[x, y] = 255
  # Grow into the white/gray antialias ring around the rounded silhouette.
  grown = mask.filter(ImageFilter.MaxFilter(5))
  for _ in range(3):
    grown = grown.filter(ImageFilter.MaxFilter(5))
  gp = grown.load()
  out = Image.new("L", (w, h), 0)
  op = out.load()
  for y in range(h):
    for x in range(w):
      if mp[x, y] >= 128:
        op[x, y] = 255
        continue
      if gp[x, y] < 128:
        continue
      r, g, b = px[x, y][:3]
      # Protect ornate gold (high red vs blue). Pale fringe stays replaceable.
      if (r - b) > 45 and r > 110:
        continue
      luma = max(r, g, b)
      chroma = max(abs(r - g), abs(g - b), abs(r - b))
      if luma > 40 and (chroma < 42 or (r - b) < 40):
        op[x, y] = 255
  return out.filter(ImageFilter.GaussianBlur(radius=0.85))


def blackout_exterior(card: Image.Image, fill=FILL) -> Image.Image:
  rgb = card.convert("RGB")
  mask = exterior_mask(rgb)
  base = Image.new("RGB", rgb.size, fill)
  # Image.composite(image1, image2, mask): mask high → image1 (fill).
  out = Image.composite(base, rgb, mask)
  # Darken 1px pale gold→black antialias fringe on the silhouette (reads as
  # white wedges on LED) without painting over interior gold ornament.
  return darken_silhouette_fringe(out, fill=fill)


def darken_silhouette_fringe(card: Image.Image, fill=FILL, dark=40) -> Image.Image:
  """Any card-edge pixel that still looks bright next to exterior → pull to fill."""
  w, h = card.size
  px = card.load()
  visited = [[False] * w for _ in range(h)]
  q: deque[tuple[int, int]] = deque()
  for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
    if max(px[seed][:3]) <= dark:
      q.append(seed)
      visited[seed[1]][seed[0]] = True
  while q:
    x, y = q.popleft()
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
      if nx < 0 or ny < 0 or nx >= w or ny >= h or visited[ny][nx]:
        continue
      if max(px[nx, ny][:3]) > dark:
        continue
      visited[ny][nx] = True
      q.append((nx, ny))
  out = card.copy()
  op = out.load()
  for y in range(h):
    for x in range(w):
      if not visited[y][x]:
        continue
      for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if nx < 0 or ny < 0 or nx >= w or ny >= h or visited[ny][nx]:
          continue
        r, g, b = op[nx, ny][:3]
        luma = max(r, g, b)
        if luma < 70:
          continue
        # Pale fringe (white / washed gold) on the outer rim only.
        chroma = max(abs(r - g), abs(g - b), abs(r - b))
        if chroma > 55 and (r - b) > 50 and r > 140:
          continue  # keep saturated gold rim body
        op[nx, ny] = fill
  return out


def render_clean_chip(dest: Path, width=332, height=194) -> Image.Image:
  """Rasterize the crisp SVG chip (2× for sharp LED paste) and write PNG."""
  if not CHIP_SVG.exists():
    raise SystemExit(f"missing chip SVG: {CHIP_SVG}")
  png = cairosvg.svg2png(url=str(CHIP_SVG), output_width=width, output_height=height)
  chip = Image.open(io.BytesIO(png)).convert("RGBA")
  # Also write 1× asset used by display overlay
  chip_1x = chip.resize((166, 97), Image.Resampling.LANCZOS)
  dest.parent.mkdir(parents=True, exist_ok=True)
  chip_1x.save(dest, optimize=True)
  return chip


def paste_clean_chip(card: Image.Image, chip_hires: Image.Image) -> Image.Image:
  out = card.convert("RGBA")
  box = (CHIP["x0"], CHIP["y0"], CHIP["x1"], CHIP["y1"])
  bw, bh = box[2] - box[0], box[3] - box[1]
  # Slightly expand paste so the clean chip fully covers the soft base-art chip.
  pad = 2
  paste_box = (box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad)
  pw, ph = paste_box[2] - paste_box[0], paste_box[3] - paste_box[1]
  # Dark underlay kills any residual wavy contacts from the package art.
  under = Image.new("RGBA", (pw, ph), (8, 6, 4, 255))
  out.paste(under, paste_box[:2], under)
  scaled = chip_hires.resize((pw, ph), Image.Resampling.LANCZOS)
  out.paste(scaled, paste_box[:2], scaled)
  return out.convert("RGB")


def scrub_led_corner_fringe(canvas: Image.Image, fill=FILL, dark=32, grow=4) -> Image.Image:
  """Remove LANCZOS / bevel speckles outside the rounded card on LED canvases.
  Flood from the four corners through near-black pixels, grow a few px, then
  force-fill the entire exterior region (card body stays outside this mask)."""
  w, h = canvas.size
  px = canvas.load()
  visited = [[False] * w for _ in range(h)]
  q: deque[tuple[int, int]] = deque()
  for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
    r, g, b = px[seed][:3]
    if max(r, g, b) <= dark:
      q.append(seed)
      visited[seed[1]][seed[0]] = True
  while q:
    x, y = q.popleft()
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
      if nx < 0 or ny < 0 or nx >= w or ny >= h or visited[ny][nx]:
        continue
      r, g, b = px[nx, ny][:3]
      if max(r, g, b) > dark:
        continue
      visited[ny][nx] = True
      q.append((nx, ny))
  exterior = Image.new("L", (w, h), 0)
  ep = exterior.load()
  for y in range(h):
    for x in range(w):
      if visited[y][x]:
        ep[x, y] = 255
  for _ in range(grow):
    exterior = exterior.filter(ImageFilter.MaxFilter(3))
  base = Image.new("RGB", (w, h), fill)
  # Hard fill on the grown exterior — a blurred mask re-introduces pale fringe
  # when LANCZOS-scaled gold edges are only partially replaced.
  out = Image.composite(base, canvas.convert("RGB"), exterior)
  return darken_silhouette_fringe(out, fill=fill, dark=36)


def fit_led(card: Image.Image, tw: int, th: int, fill=FILL, margin=4):
  """Letterbox onto LED canvas with a thin black margin so the rounded-card
  silhouette (and any residual edge antialias) never kisses the canvas edge."""
  inner_w = max(1, tw - 2 * margin)
  inner_h = max(1, th - 2 * margin)
  scale = min(inner_w / card.width, inner_h / card.height)
  nw, nh = int(round(card.width * scale)), int(round(card.height * scale))
  scaled = card.resize((nw, nh), Image.Resampling.LANCZOS)
  canvas = Image.new("RGB", (tw, th), fill)
  ox, oy = (tw - nw) // 2, (th - nh) // 2
  canvas.paste(scaled, (ox, oy))
  canvas = scrub_led_corner_fringe(canvas, fill=fill)
  return canvas, (ox, oy, nw, nh)


def face_css(ox, oy, nw, nh, tw, th, src_w, src_h):
  sx, sy = nw / src_w, nh / src_h
  cx = ox + FACE["cx"] * sx
  cy = oy + FACE["cy"] * sy
  rx, ry = FACE["rx"] * sx, FACE["ry"] * sy
  return {
    "left": round((cx - rx) / tw * 100, 3),
    "top": round((cy - ry) / th * 100, 3),
    "width": round((2 * rx) / tw * 100, 3),
    "height": round((2 * ry) / th * 100, 3),
  }


def chip_css(ox, oy, nw, nh, tw, th, src_w, src_h):
  sx, sy = nw / src_w, nh / src_h
  x0 = ox + CHIP["x0"] * sx
  y0 = oy + CHIP["y0"] * sy
  x1 = ox + CHIP["x1"] * sx
  y1 = oy + CHIP["y1"] * sy
  return {
    "left": round(x0 / tw * 100, 3),
    "top": round(y0 / th * 100, 3),
    "width": round((x1 - x0) / tw * 100, 3),
    "height": round((y1 - y0) / th * 100, 3),
  }


def main() -> None:
  if not SRC.exists():
    raise SystemExit(f"missing package art: {SRC}")
  OUT.mkdir(parents=True, exist_ok=True)
  raw = Image.open(SRC).convert("RGB")
  cleaned = blackout_exterior(raw)
  chip_hires = render_clean_chip(CHIP_PNG)
  card = paste_clean_chip(cleaned, chip_hires)
  src_w, src_h = card.size
  card.save(OUT / "ballers-express-business-master.png", optimize=True)
  meta = {"face": FACE, "chip": CHIP, "medallion": MEDALLION, "led": {}}
  for suffix, tw, th in [("2x1", 1600, 800), ("4x3", 1200, 900)]:
    canvas, geom = fit_led(card, tw, th)
    meta["led"][suffix] = {
      "face": face_css(*geom, tw, th, src_w, src_h),
      "chip": chip_css(*geom, tw, th, src_w, src_h),
    }
    for name in (
      f"black-card-{suffix}.png",
      f"ballers-alert-{suffix}.png",
      f"black-card-amex-{suffix}.png",
      f"ballers-alert-amex-{suffix}.png",
    ):
      canvas.save(OUT / name, optimize=True)
    print("wrote", suffix, meta["led"][suffix])
  META_OUT.write_text(json.dumps(meta, indent=2))
  print("face/chip CSS →", META_OUT)
  # Sanity: exterior white should be gone on LED 2x1
  check = Image.open(OUT / "black-card-2x1.png")
  px = check.load()
  white = 0
  for y in range(check.height):
    for x in range(check.width):
      r, g, b = px[x, y][:3]
      if r > 200 and g > 200 and b > 200:
        white += 1
  print(f"near-white pixels on black-card-2x1.png: {white}")


if __name__ == "__main__":
  main()
