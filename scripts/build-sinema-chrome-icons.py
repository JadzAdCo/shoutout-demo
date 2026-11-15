#!/usr/bin/env python3
"""Build Si-nema Search / feature-landing chrome icons (rounded-square, 1024).

Nightlife source is painted here; other schemes recolor that source so the
wordmark and LED stay aligned across Appearance packs.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images/chrome"
FONT = Path("/usr/share/fonts/truetype/noto/NotoSansDisplay-Bold.ttf")

S = 1024
SQ_CORNER = 88  # matches CSS chrome-photo-face 8.6%
STROKE = 18
PAD = 16
MAGENTA = np.array([255, 46, 184], dtype=np.float32)
TIFFANY = np.array([0, 212, 254], dtype=np.float32)
WHITE = (255, 255, 255, 255)
TIFFANY_RGBA = (0, 212, 254, 255)


def rounded_mask(size: int, radius: int, pad: int = 0) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [pad, pad, size - 1 - pad, size - 1 - pad], radius=radius, fill=255
    )
    return m


def nightlife() -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    clip = rounded_mask(S, SQ_CORNER, 0)

    # Magenta → tiffany ring
    xs = np.linspace(0.0, 1.0, S, dtype=np.float32)
    grad = np.zeros((S, S, 3), dtype=np.float32)
    grad[..., 0] = MAGENTA[0] * (1 - xs) + TIFFANY[0] * xs
    grad[..., 1] = MAGENTA[1] * (1 - xs) + TIFFANY[1] * xs
    grad[..., 2] = MAGENTA[2] * (1 - xs) + TIFFANY[2] * xs
    ring_col = Image.fromarray(np.clip(grad, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    outer = rounded_mask(S, SQ_CORNER, PAD)
    inner = rounded_mask(S, max(8, SQ_CORNER - STROKE), PAD + STROKE)
    ring_a = ImageChops_subtract(outer, inner)
    ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ring.paste(ring_col, (0, 0), ring_a)
    img = Image.alpha_composite(img, ring)

    draw = ImageDraw.Draw(img)
    # LED board (virtual set)
    led = [196, 168, 828, 548]
    draw.rounded_rectangle(led, radius=36, fill=(12, 14, 22, 255), outline=TIFFANY_RGBA, width=10)
    inner_led = [led[0] + 28, led[1] + 28, led[2] - 28, led[3] - 28]
    draw.rounded_rectangle(inner_led, radius=22, fill=(8, 10, 16, 255), outline=(90, 40, 90, 255), width=4)
    # scanlines
    for y in range(inner_led[1] + 18, inner_led[3] - 12, 22):
        draw.line([(inner_led[0] + 16, y), (inner_led[2] - 16, y)], fill=(0, 140, 170, 90), width=3)
    # perspective room (spatial hint)
    cx = (inner_led[0] + inner_led[2]) // 2
    cy = (inner_led[1] + inner_led[3]) // 2
    draw.polygon(
        [(cx - 150, inner_led[3] - 36), (cx + 150, inner_led[3] - 36), (cx + 70, cy - 40), (cx - 70, cy - 40)],
        outline=TIFFANY_RGBA,
    )
    draw.line([(cx - 70, cy - 40), (cx - 70, inner_led[1] + 48)], fill=TIFFANY_RGBA, width=4)
    draw.line([(cx + 70, cy - 40), (cx + 70, inner_led[1] + 48)], fill=TIFFANY_RGBA, width=4)
    draw.line([(cx - 70, inner_led[1] + 48), (cx + 70, inner_led[1] + 48)], fill=TIFFANY_RGBA, width=4)

    font = ImageFont.truetype(str(FONT), 148)
    text = "Si-nema"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (S - tw) // 2 - bbox[0]
    y = 690
    # Under-glow
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).text((x, y), text, font=font, fill=(0, 212, 254, 160))
    glow = glow.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)
    draw.text((x, y), text, font=font, fill=WHITE)
    # Tiffany hyphen
    hyphen = "-"
    pre = "Si"
    pre_w = draw.textbbox((0, 0), pre, font=font)[2]
    hx = x + pre_w
    draw.text((hx, y), hyphen, font=font, fill=TIFFANY_RGBA)

    out = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    out.paste(img, (0, 0), clip)
    return out.convert("RGB")


def ImageChops_subtract(a: Image.Image, b: Image.Image) -> Image.Image:
    aa = np.array(a, dtype=np.int16)
    bb = np.array(b, dtype=np.int16)
    return Image.fromarray(np.clip(aa - bb, 0, 255).astype(np.uint8), "L")


def is_near_black(rgb: np.ndarray, thr: int = 28) -> np.ndarray:
    return rgb.max(axis=-1) < thr


def is_near_white(rgb: np.ndarray, thr: int = 210) -> np.ndarray:
    return (rgb.min(axis=-1) > thr) & (np.ptp(rgb, axis=-1) < 40)


def is_cyan(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (b > 150) & (g > 100) & (r < 140) & (b > r + 40) & (g > r)


def is_magenta(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r > 140) & (b > 80) & (g < r * 0.75) & (r > g + 30)


def recolor(src: np.ndarray, *, mag, cyan, black=None, white=None) -> np.ndarray:
    out = src.copy()
    if black is not None:
        mask = is_near_black(src)
        out[mask] = black
    if white is not None:
        mask = is_near_white(src)
        out[mask] = white
    c = is_cyan(src) & ~is_near_black(out) & ~is_near_white(out)
    if c.any():
        lum = src[c].mean(axis=-1, keepdims=True) / 255.0
        out[c] = np.clip(np.array(cyan, dtype=np.float32) * (0.45 + 0.55 * lum), 0, 255)
    m = is_magenta(src) & ~is_near_black(out) & ~is_near_white(out) & ~c
    if m.any():
        lum = src[m].mean(axis=-1, keepdims=True) / 255.0
        out[m] = np.clip(np.array(mag, dtype=np.float32) * (0.45 + 0.55 * lum), 0, 255)
    return out


def save_jpg(arr: np.ndarray, path: Path) -> None:
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").save(
        path, quality=96, subsampling=0
    )
    print(f"  wrote {path.name}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    night = np.array(nightlife(), dtype=np.float32)
    save_jpg(night, OUT / "sinema-nightlife.jpg")

    trad = recolor(
        night,
        mag=(180, 180, 190),
        cyan=(210, 210, 218),
        black=(18, 18, 20),
    )
    save_jpg(trad, OUT / "sinema-traditional.jpg")

    bt = recolor(night, mag=TIFFANY, cyan=TIFFANY)
    save_jpg(bt, OUT / "sinema-blacktiffany.jpg")

    pw = recolor(
        night,
        mag=(192, 132, 252),
        cyan=(244, 114, 182),
        black=(22, 10, 32),
    )
    save_jpg(pw, OUT / "sinema-purplewhite.jpg")

    TINGS = (90, 199, 131)
    DARK = (46, 138, 90)
    bdg = recolor(night, mag=DARK, cyan=TINGS)
    save_jpg(bdg, OUT / "sinema-blackdarkgreen.jpg")

    wb = recolor(
        night,
        mag=(40, 40, 44),
        cyan=(28, 28, 32),
        black=(246, 246, 248),
        white=(16, 16, 18),
    )
    save_jpg(wb, OUT / "sinema-whiteblack.jpg")


if __name__ == "__main__":
    main()
