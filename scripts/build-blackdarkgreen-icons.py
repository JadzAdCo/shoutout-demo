#!/usr/bin/env python3
"""Build Black & Dark Green Search chrome icons from nightlife sources.

Accent green matches Settings blackDarkGreen font fill for \"tings\": #5ac783.
Companion dark green (gear hole / CSS accent): #2e8a5a.

Usage: python3 scripts/build-blackdarkgreen-icons.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images/chrome"

# Settings \"tings\" fill (sampled) + darker companion from settings / CSS
TINGS = np.array([90, 199, 131], dtype=np.float32)  # #5ac783
DARK = np.array([46, 138, 90], dtype=np.float32)  # #2e8a5a


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"), dtype=np.float32)


def is_near_black(rgb: np.ndarray, thr: int = 28) -> np.ndarray:
    return rgb.max(axis=-1) < thr


def is_near_white(rgb: np.ndarray, thr: int = 210) -> np.ndarray:
    return (rgb.min(axis=-1) > thr) & (np.ptp(rgb, axis=-1) < 40)


def is_cyan_tiffany(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (b > 150) & (g > 100) & (r < 140) & (b > r + 40) & (g > r)


def is_magenta_pink(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r > 140) & (b > 80) & (g < r * 0.75) & (r > g + 30)


def is_neon_violet(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (b > 140) & (r > 60) & (r < 180) & (g < 120) & (b > g + 40)


def recolor_to_bdg(src: Path, dst: Path) -> None:
    a = load_rgb(src)
    out = a.copy()
    cyan = is_cyan_tiffany(a) & ~is_near_black(a) & ~is_near_white(a)
    if cyan.any():
        lum = a[cyan].mean(axis=-1, keepdims=True) / 255.0
        out[cyan] = DARK * (1 - lum) + TINGS * lum
    mag = (is_magenta_pink(a) | is_neon_violet(a)) & ~is_near_black(a) & ~is_near_white(a) & ~cyan
    if mag.any():
        lum = a[mag].mean(axis=-1, keepdims=True) / 255.0
        out[mag] = np.clip(DARK * (0.55 + 0.45 * lum) + TINGS * (0.25 * lum), 0, 255)
    g, r, b = a[..., 1], a[..., 0], a[..., 2]
    old_forest = (g > 70) & (g > r + 20) & (g > b + 15) & (r < 80) & (b < 80) & (g < 160)
    if old_forest.any():
        lum = (g[old_forest] / 255.0)[..., None]
        out[old_forest] = DARK * (1 - lum) + TINGS * lum
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB").save(
        dst, quality=96, subsampling=0
    )
    print(f"  {src.name} → {dst.name}  cyan={int(cyan.sum())} mag={int(mag.sum())}")


def main() -> None:
    pairs = [
        ("floqcast-nightlife.jpg", "floqcast-blackdarkgreen.jpg"),
        ("botdee-nightlife.jpg", "botdee-blackdarkgreen.jpg"),
        ("vip-nightlife.jpg", "vip-blackdarkgreen.jpg"),
        ("shoutout-nightlife.png", "shoutout-blackdarkgreen.png"),
        ("bartr-nightlife.png", "bartr-blackdarkgreen.png"),
        ("rydr-nightlife.png", "rydr-blackdarkgreen.png"),
    ]
    for src_name, dst_name in pairs:
        src = OUT / src_name
        if not src.exists():
            print(f"  SKIP missing {src_name}")
            continue
        recolor_to_bdg(src, OUT / dst_name)
    print("blackDarkGreen pack ready (Settings tings #5ac783)")


if __name__ == "__main__":
    main()
