#!/usr/bin/env python3
"""Build Baller's Express LED card faces from the Cursor package artwork.

Source: reports/baller-cards/express-package/ballers-express-business.png
Outputs: images/baller/*-{2x1,4x3}.png (+ -amex- twins — same Baller's Express art)

The package art already has BALLER'S EXPRESS / BUSINESS, Valid Thru 12/50, blank
name/company rows, ornate gold rim, and the Roman warrior medallion. Do not
regenerate lettering or punch a face hole — Alert composites a face-only ellipse
over the warrior face via display CSS (helmet / rim / chip stay visible).
"""
from __future__ import annotations

from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "reports/baller-cards/express-package/ballers-express-business.png"
OUT = ROOT / "images/baller"
META_OUT = Path("/tmp/baller-express-face-css.json")

# Calibrated on the 1581×995 package PNG (face under helmet crest, above chip).
FACE = {"cx": 272, "cy": 248, "rx": 72, "ry": 86}
MEDALLION = {"cx": 248, "cy": 268, "r": 198}


def fit_led(card: Image.Image, tw: int, th: int, fill=(6, 6, 8)):
  card_ar = card.width / card.height
  target_ar = tw / th
  if abs(card_ar - target_ar) < 0.04:
    scaled = card.resize((tw, th), Image.Resampling.LANCZOS)
    return scaled, (0, 0, tw, th)
  scale = min(tw / card.width, th / card.height)
  nw, nh = int(round(card.width * scale)), int(round(card.height * scale))
  scaled = card.resize((nw, nh), Image.Resampling.LANCZOS)
  canvas = Image.new("RGB", (tw, th), fill)
  ox, oy = (tw - nw) // 2, (th - nh) // 2
  canvas.paste(scaled, (ox, oy))
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


def main() -> None:
  if not SRC.exists():
    raise SystemExit(f"missing package art: {SRC}")
  OUT.mkdir(parents=True, exist_ok=True)
  src = Image.open(SRC).convert("RGB")
  src_w, src_h = src.size
  src.save(OUT / "ballers-express-business-master.png", optimize=True)
  meta = {"face": FACE, "medallion": MEDALLION, "led": {}}
  for suffix, tw, th in [("2x1", 1600, 800), ("4x3", 1200, 900)]:
    canvas, geom = fit_led(src, tw, th)
    meta["led"][suffix] = face_css(*geom, tw, th, src_w, src_h)
    for name in (
      f"black-card-{suffix}.png",
      f"ballers-alert-{suffix}.png",
      f"black-card-amex-{suffix}.png",
      f"ballers-alert-amex-{suffix}.png",
    ):
      canvas.save(OUT / name, optimize=True)
    print("wrote", suffix, meta["led"][suffix])
  META_OUT.write_text(json.dumps(meta, indent=2))
  print("face CSS →", META_OUT)


if __name__ == "__main__":
  main()
