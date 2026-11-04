#!/usr/bin/env python3
"""Build photoreal Baller's / Amex metal-card faces from the Centurion Business reference.

Source: reports/baller-cards/reference-amex-not-shipped.jpg
Outputs: images/baller/*-{2x1,4x3}.png (+ -amex- twins)

Amex twins = exact photo graphics (PII name/company wiped for ShoutOut overlay).
Baller's = same exact ornate frame / centurion / chip / emboss, brand wordmark swapped.
"""
from __future__ import annotations

from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
REF_PATH = ROOT / "reports/baller-cards/reference-amex-not-shipped.jpg"
OUT = ROOT / "images/baller"


def font(size: int, serif: bool = False) -> ImageFont.ImageFont:
  path = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
    if serif
    else "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
  )
  try:
    return ImageFont.truetype(path, size)
  except Exception:
    return ImageFont.load_default()


def patch(img: Image.Image, dest, src) -> Image.Image:
  im = img.copy()
  x0, y0, x1, y1 = dest
  dw, dh = x1 - x0, y1 - y0
  sample = im.crop(src).resize((dw, dh), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
  mask = Image.new("L", (dw, dh), 0)
  ImageDraw.Draw(mask).rounded_rectangle((0, 0, dw - 1, dh - 1), radius=3, fill=255)
  mask = mask.filter(ImageFilter.GaussianBlur(2.5))
  im.paste(sample, (x0, y0), mask)
  return im


def crush_bright(img: Image.Image, box, thresh: float = 55) -> Image.Image:
  arr = np.array(img).astype(np.float32)
  x0, y0, x1, y1 = box
  region = arr[y0:y1, x0:x1]
  lum = region.mean(axis=2)
  dark = np.percentile(region.reshape(-1, 3), 18, axis=0)
  bright = lum > thresh
  for c in range(3):
    ch = region[:, :, c]
    ch[bright] = dark[c]
    region[:, :, c] = ch
  arr[y0:y1, x0:x1] = region
  return Image.fromarray(arr.astype(np.uint8))


def wipe(img: Image.Image, boxes, src=(90, 220, 340, 340)) -> Image.Image:
  out = img
  for box in boxes:
    out = patch(out, box, src)
    out = crush_bright(out, box, thresh=55)
  return out


def fit(img: Image.Image, tw: int, th: int) -> Image.Image:
  if abs(tw / th - 1.6) < 0.05:
    return img.resize((tw, th), Image.Resampling.LANCZOS)
  scale = th / img.height
  nw = max(tw, int(img.width * scale))
  scaled = img.resize((nw, th), Image.Resampling.LANCZOS)
  left = (nw - tw) // 2
  return scaled.crop((left, 0, left + tw, th))


def face_hole(img: Image.Image) -> Image.Image:
  im = img.convert("RGBA")
  w, h = im.size
  cx, cy = int(0.146 * w), int(0.278 * h)
  r = int(0.141 * h)
  ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
  d = ImageDraw.Draw(ov)
  d.ellipse((cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4), outline=(210, 195, 155, 255), width=max(3, int(0.01 * h)))
  d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(8, 8, 12, 255))
  return Image.alpha_composite(im, ov).convert("RGB")


def hard_wipe(im: Image.Image, box) -> Image.Image:
  x0, y0, x1, y1 = box
  arr = np.array(im).astype(np.float32)
  sx0, sx1 = int(0.12 * im.width), int(0.28 * im.width)
  sy0, sy1 = int(0.36 * im.height), int(0.52 * im.height)
  sample = arr[sy0:sy1, sx0:sx1]
  fill = np.percentile(sample.reshape(-1, 3), 20, axis=0)
  arr[y0:y1, x0:x1] = fill
  noise = sample.reshape(-1, 3)
  rng = np.random.default_rng(42)
  picks = noise[rng.integers(0, len(noise), size=(y1 - y0) * (x1 - x0))].reshape((y1 - y0, x1 - x0, 3))
  arr[y0:y1, x0:x1] = arr[y0:y1, x0:x1] * 0.65 + picks * 0.35
  return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def make_ballers(amex: Image.Image) -> Image.Image:
  w, h = amex.size
  im = amex.copy()
  im = hard_wipe(im, (int(0.38 * w), int(0.06 * h), int(0.98 * w), int(0.34 * h)))
  im = hard_wipe(im, (int(0.36 * w), int(0.93 * h), int(0.66 * w), int(0.995 * h)))
  im = hard_wipe(im, (int(0.93 * w), int(0.91 * h), int(0.995 * w), int(0.99 * h)))
  band = im.crop((int(0.38 * w), int(0.06 * h), int(0.98 * w), int(0.34 * h))).filter(ImageFilter.GaussianBlur(0.8))
  im.paste(band, (int(0.38 * w), int(0.06 * h)))
  d = ImageDraw.Draw(im)
  brand_font = font(max(22, int(0.048 * h)), False)
  biz_font = font(max(50, int(0.13 * h)), True)
  foot_font = font(max(11, int(0.018 * h)), False)
  bx, by = int(0.415 * w), int(0.10 * h)
  d.text((bx + 1, by + 2), "BALLER'S EXPRESS", font=brand_font, fill=(5, 5, 8))
  d.text((bx, by), "BALLER'S EXPRESS", font=brand_font, fill=(228, 228, 232))
  bx2, by2 = int(0.415 * w), int(0.175 * h)
  d.text((bx2 + 2, by2 + 3), "BUSINESS", font=biz_font, fill=(5, 5, 8))
  d.text((bx2, by2), "BUSINESS", font=biz_font, fill=(236, 236, 240))
  footer = "© BALLER'S EXPRESS · FLOQR SHOUTOUT"
  try:
    tw = d.textlength(footer, font=foot_font)
  except Exception:
    tw = len(footer) * 7
  d.text(((w - tw) / 2, int(0.958 * h)), footer, font=foot_font, fill=(100, 100, 108))
  return im


def main() -> None:
  OUT.mkdir(parents=True, exist_ok=True)
  ref = Image.open(REF_PATH).convert("RGB")
  # Wipe embossed cardholder + company for ShoutOut overlay slots
  amex_clean = wipe(ref, [(40, 485, 700, 560), (40, 545, 750, 625)])
  for suffix, tw, th in [("2x1", 1600, 800), ("4x3", 1200, 900)]:
    amex = fit(amex_clean, tw, th)
    amex.save(OUT / f"black-card-amex-{suffix}.png", optimize=True)
    face_hole(amex).save(OUT / f"ballers-alert-amex-{suffix}.png", optimize=True)
    ballers = make_ballers(amex)
    ballers.save(OUT / f"black-card-{suffix}.png", optimize=True)
    face_hole(ballers).save(OUT / f"ballers-alert-{suffix}.png", optimize=True)
    print("wrote", suffix)


if __name__ == "__main__":
  main()
