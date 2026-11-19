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
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images/chrome"
SOURCE = ROOT / "images/chrome/official/si-nema-blacktiffany.webp"
S = 1024


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


def save_png(arr: np.ndarray, path: Path) -> None:
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA").save(path, optimize=True)
    print(f"  wrote {path.name}")


INK = np.array([16, 16, 18], dtype=np.float32)
FIELD_RGB = np.array([248, 248, 250], dtype=np.float32)
TIFFANY = np.array([0, 212, 254], dtype=np.float32)
# Official wordmark lives below the film wrap (Si- top ≈ y 764).
TYPE_Y = 756


def flatten_rgba(rgba: np.ndarray, field_rgb: np.ndarray | None = None) -> np.ndarray:
    a = rgba[..., 3:4] / 255.0
    ground = FIELD_RGB if field_rgb is None else field_rgb
    return rgba[..., :3] * a + ground * (1.0 - a)


def dilate(mask: np.ndarray, k: int = 5) -> np.ndarray:
    k = max(3, k | 1)
    return (
        np.array(
            Image.fromarray((mask.astype(np.uint8) * 255), "L").filter(ImageFilter.MaxFilter(k))
        )
        > 127
    )


def morph_close(mask: np.ndarray, k: int) -> np.ndarray:
    """Seal sprocket gaps without fattening the outer clapper silhouette."""
    k = max(3, k | 1)
    im = Image.fromarray((mask.astype(np.uint8) * 255), "L")
    im = im.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
    return np.array(im) > 127


def flood_outer_field(wall: np.ndarray) -> np.ndarray:
    """Flood the white field from inside the rim. `wall` is the sealed clapper."""
    canvas = np.zeros((S, S, 3), dtype=np.uint8)
    canvas[~wall] = (255, 255, 255)
    img = Image.fromarray(canvas, "RGB")
    seeds = []
    for x in range(64, S - 64, 8):
        seeds.extend(((x, 64), (x, 748)))
    for y in range(64, 750, 8):
        seeds.extend(((64, y), (S - 64, y)))
    for pt in seeds:
        if img.getpixel(pt)[0] > 200:
            ImageDraw.floodfill(img, pt, (255, 0, 0), thresh=8)
    out = np.array(img)
    return (out[..., 0] > 200) & (out[..., 1] < 40)


def film_rail_underside(cyan: np.ndarray) -> np.ndarray:
    """Smooth bottom of the film wrap, ignoring hanging sprocket teeth."""
    underside = np.zeros(S, dtype=np.float32)
    for x in range(S):
        ys = np.where(cyan[640:752, x])[0]
        if ys.size:
            underside[x] = 640 + int(ys.max())
    y = underside.copy()
    y[(y >= 728) | (y < 680)] = np.nan
    idx = np.arange(S)
    good = ~np.isnan(y)
    if int(good.sum()) < 8:
        return np.zeros(S, dtype=np.float32)
    filled = np.interp(idx, idx[good], y[good])
    k, pad = 41, 20
    p = np.pad(filled, pad, mode="edge")
    smooth = np.empty(S, dtype=np.float32)
    for i in range(S):
        smooth[i] = float(np.median(p[i : i + k]))
    return smooth


def build_whiteblack(src: np.ndarray, rim_src: Path | None = None) -> np.ndarray:
    """White/Black Si-nema RGBA: clap lid kept; red-marked areas go transparent.

    Punches the outer field, the muddy screen fill, and hanging film teeth to
    alpha 0. Play / AI / film stay official pixels with a vivid Tiffany edge.
    Official **Si-** matte → ink; **nema** stays Tiffany.
    """
    del rim_src
    yy = np.arange(S)[:, None]
    xx = np.arange(S)[None, :]
    rim = (yy < 54) | (yy > S - 54) | (xx < 54) | (xx > S - 54)
    lum = src.max(axis=-1)
    ch = chroma(src)
    cyan = is_cyan(src)
    graphic = np.zeros((S, S), dtype=bool)
    graphic[:TYPE_Y, :] = True
    metal = (lum > 108) & graphic

    core = (cyan | (lum > 88) | ((ch > 45) & (lum > 70))) & graphic
    wall = morph_close(core, 37) | rim | ~graphic
    field = flood_outer_field(wall)
    near_metal = dilate((lum > 100) | cyan, 15)
    field |= graphic & (yy < 340) & (lum < 78) & ~near_metal & ~rim

    film_zone = dilate(cyan & (yy > 530) & graphic, 15)
    screen = graphic & (yy >= 392) & (yy <= 620) & (xx >= 250) & (xx <= 800)
    screen &= (lum < 90) & ~cyan & ~dilate(metal, 5) & ~film_zone

    rail = film_rail_underside(cyan)
    hang = (
        graphic
        & (xx >= 155)
        & (xx < 530)
        & (rail[None, :] > 650)
        & (yy > (rail[None, :] + 4))
        & ~rim
    )

    keep_cyan = cyan & ~hang
    keep_metal = metal & ~screen & ~hang
    # Leftover dark board guts inside the wrap (still in the red paint-over).
    inner_void = (
        graphic
        & (yy >= 500)
        & (yy <= 655)
        & (xx >= 270)
        & (xx <= 700)
        & (lum < 75)
        & ~keep_cyan
        & ~keep_metal
        & ~dilate(cyan, 11)
    )
    punch = (
        (field | screen | hang | inner_void | ((~rim) & ~graphic))
        & ~keep_cyan
        & ~keep_metal
        & ~rim
    )

    pa = (
        np.array(
            Image.fromarray((punch.astype(np.uint8) * 255), "L").filter(
                ImageFilter.GaussianBlur(0.45)
            ),
            dtype=np.float32,
        )
        / 255.0
    )
    pa[rim] = 0.0
    pa[keep_cyan] = 0.0
    pa[keep_metal] = 0.0

    rgb = src.copy()
    if keep_cyan.any():
        px = rgb[keep_cyan]
        lumc = np.clip(px.mean(axis=-1, keepdims=True) / 255.0, 0, 1)
        vivid = TIFFANY * (0.50 + 0.60 * lumc)
        rgb[keep_cyan] = np.clip(px * 0.45 + vivid * 0.55, 0, 255)
    badge = keep_cyan & (yy >= 400) & (yy <= 590) & (xx >= 300) & (xx <= 760)
    edge = dilate(badge, 3) & ~badge & ~keep_metal & ~rim & graphic
    rgb[edge] = np.clip(rgb[edge] * 0.20 + TIFFANY * 0.80, 0, 255)
    pa[edge] = 0.0

    sat_rim = rim & (ch > 38) & (lum > 40)
    rgb[sat_rim] = np.array([22, 22, 24], dtype=np.float32)
    mag = is_magenta(src) & rim
    if mag.any():
        rgb[mag] = src[mag]

    band = ~graphic & ~rim
    gray = ch < 55
    si_cov = np.clip((lum - 20) / 185.0, 0, 1) * band * gray * ~cyan
    si_cov = (
        np.array(
            Image.fromarray((si_cov * 255).astype(np.uint8), "L").filter(
                ImageFilter.GaussianBlur(0.3)
            ),
            dtype=np.float32,
        )
        / 255.0
    )
    rgb = rgb * (1.0 - si_cov[..., None]) + INK * si_cov[..., None]
    # Letters are opaque; punched field behind them stays transparent.
    alpha = np.clip((1.0 - pa) * 255.0, 0, 255)
    alpha = np.maximum(alpha, si_cov * 255.0)
    alpha[keep_cyan] = 255.0
    alpha[keep_metal] = 255.0
    alpha[edge] = 255.0
    alpha[rim] = 255.0

    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    sharp = np.array(
        img.filter(ImageFilter.UnsharpMask(radius=1.15, percent=135, threshold=2)),
        dtype=np.float32,
    )
    obj = graphic & ~punch & ~rim
    rgb[obj] = sharp[obj]

    rgba = np.concatenate([rgb, alpha[..., None]], axis=-1)
    return rgba


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

    wb = build_whiteblack(official)
    save_png(wb, OUT / "sinema-whiteblack.png")
    save_jpg(flatten_rgba(wb), OUT / "sinema-whiteblack.jpg")


if __name__ == "__main__":
    main()
