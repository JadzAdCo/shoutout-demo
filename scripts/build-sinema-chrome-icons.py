#!/usr/bin/env python3
"""Si-nema Search chrome tiles from the approved FloqMedia official mark.

Source: images/chrome/official/si-nema-blacktiffany.webp
(FloqMedia public/brand/official/si-nema-blacktiffany.webp — clapper + AI + Si-nema).

Nightlife and blackTiffany keep the official pixels. Other Site chrome packs
recolor saturated ring/accent only so the clapper and wordmark stay aligned.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images/chrome"
SOURCE = ROOT / "images/chrome/official/si-nema-blacktiffany.webp"
S = 1024
TIFFANY = np.array([0, 212, 254], dtype=np.float32)


def load_official() -> np.ndarray:
    if not SOURCE.exists():
        raise SystemExit(f"missing approved Si-nema logo: {SOURCE}")
    img = Image.open(SOURCE).convert("RGB")
    if img.size != (S, S):
        img = img.resize((S, S), Image.Resampling.LANCZOS)
    return np.array(img, dtype=np.float32)


def chroma(rgb: np.ndarray) -> np.ndarray:
    return rgb.max(axis=-1) - rgb.min(axis=-1)


def is_near_black(rgb: np.ndarray, thr: int = 28) -> np.ndarray:
    return rgb.max(axis=-1) < thr


def is_near_white(rgb: np.ndarray, thr: int = 210) -> np.ndarray:
    return (rgb.min(axis=-1) > thr) & (np.ptp(rgb, axis=-1) < 48)


def is_cyan(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (b > 130) & (g > 90) & (r < 160) & (b > r + 25) & (g > r - 10) & (chroma(rgb) > 40)


def is_magenta(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r > 110) & (b > 70) & (g < r * 0.85) & (r > g + 18) & (chroma(rgb) > 35)


def recolor(src: np.ndarray, *, mag, cyan, black=None, white=None) -> np.ndarray:
    out = src.copy()
    if black is not None:
        out[is_near_black(src)] = black
    if white is not None:
        out[is_near_white(src)] = white
    c = is_cyan(src)
    if black is not None:
        c &= ~is_near_black(out)
    if white is not None:
        c &= ~is_near_white(out)
    if c.any():
        lum = src[c].mean(axis=-1, keepdims=True) / 255.0
        out[c] = np.clip(np.array(cyan, dtype=np.float32) * (0.40 + 0.60 * lum), 0, 255)
    m = is_magenta(src) & ~c
    if black is not None:
        m &= ~is_near_black(out)
    if white is not None:
        m &= ~is_near_white(out)
    if m.any():
        lum = src[m].mean(axis=-1, keepdims=True) / 255.0
        out[m] = np.clip(np.array(mag, dtype=np.float32) * (0.40 + 0.60 * lum), 0, 255)
    return out


def save_jpg(arr: np.ndarray, path: Path) -> None:
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").save(
        path, quality=96, subsampling=0
    )
    print(f"  wrote {path.name}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    official = load_official()
    # Approved mark is the blackTiffany / nightlife Search face.
    save_jpg(official, OUT / "sinema-nightlife.jpg")
    save_jpg(official, OUT / "sinema-blacktiffany.jpg")

    trad = recolor(
        official,
        mag=(180, 180, 190),
        cyan=(210, 210, 218),
        black=(18, 18, 20),
    )
    save_jpg(trad, OUT / "sinema-traditional.jpg")

    pw = recolor(
        official,
        mag=(192, 132, 252),
        cyan=(244, 114, 182),
        black=(22, 10, 32),
    )
    save_jpg(pw, OUT / "sinema-purplewhite.jpg")

    TINGS = (90, 199, 131)
    DARK = (46, 138, 90)
    save_jpg(recolor(official, mag=DARK, cyan=TINGS), OUT / "sinema-blackdarkgreen.jpg")

    wb = recolor(
        official,
        mag=(40, 40, 44),
        cyan=(28, 28, 32),
        black=(246, 246, 248),
        white=(16, 16, 18),
    )
    save_jpg(wb, OUT / "sinema-whiteblack.jpg")


if __name__ == "__main__":
    main()
