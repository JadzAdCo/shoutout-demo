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


def morph(mask: np.ndarray, *, open_k: int = 0, close_k: int = 0) -> np.ndarray:
    img = Image.fromarray((mask.astype(np.uint8) * 255), "L")
    if open_k:
        img = img.filter(ImageFilter.MinFilter(open_k)).filter(ImageFilter.MaxFilter(open_k))
    if close_k:
        img = img.filter(ImageFilter.MaxFilter(close_k)).filter(ImageFilter.MinFilter(close_k))
    return np.array(img) > 127


def dilate(mask: np.ndarray, k: int = 5) -> np.ndarray:
    k = max(3, k | 1)
    return (
        np.array(
            Image.fromarray((mask.astype(np.uint8) * 255), "L").filter(ImageFilter.MaxFilter(k))
        )
        > 127
    )


def connected_border_field(black: np.ndarray) -> np.ndarray:
    """Outer black around the clapper — never seed inside the hanging filmstrip."""
    canvas = np.zeros((S, S, 3), dtype=np.uint8)
    canvas[black] = (255, 255, 255)
    img = Image.fromarray(canvas, "RGB")
    seeds = []
    # Above the clapper.
    for x in range(80, S - 80, 16):
        seeds.append((x, 88))
        seeds.append((x, 758))  # gap between filmstrip and wordmark
        seeds.append((x, 980))
    # Sides — stop above the filmstrip (film starts ~y 600).
    for y in range(88, 560, 16):
        seeds.append((80, y))
        seeds.append((S - 80, y))
    for pt in seeds:
        if img.getpixel(pt)[0] > 200:
            ImageDraw.floodfill(img, pt, (255, 0, 0), thresh=8)
    out = np.array(img)
    return (out[..., 0] > 200) & (out[..., 1] < 40)


def grow_field_into_glow(
    field: np.ndarray, lum: np.ndarray, protect: np.ndarray
) -> np.ndarray:
    """Eat only the soft halo. Do not nibble film rails or letter ink."""
    grown = field.copy()
    for _ in range(4):
        dil = np.array(
            Image.fromarray((grown.astype(np.uint8) * 255), "L").filter(ImageFilter.MaxFilter(3))
        ) > 127
        extra = dil & ~grown & ~protect & (lum < 36)
        if not extra.any():
            break
        grown |= extra
    return grown


def film_bottom_cut(xx: np.ndarray) -> np.ndarray:
    """Clip dangling sprocket cells; slightly higher at the far left/right."""
    t = np.clip(np.abs((xx - 500.0) / 360.0), 0.0, 1.0)
    return 712.0 * (1.0 - t * t) + 700.0 * (t * t)


def tighten_hanging_film(clapper: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Clip tongues; fill punched interiors in the bottom sprocket band only."""
    yy = np.arange(S, dtype=np.float32)[:, None]
    xx = np.arange(S, dtype=np.float32)[None, :]
    y_cut = film_bottom_cut(xx)
    film_band = (yy >= 640) & (yy < 790)
    kept = np.where(film_band, clapper & (yy <= y_cut), clapper)
    holes = np.zeros_like(clapper)
    for x in range(110, 930):
        if not kept[640:760, x].any():
            continue
        yc = int(round(float(y_cut[0, x])))
        band = slice(yc - 38, yc + 1)
        holes[band, x] = ~kept[band, x]
        kept[band, x] = True
    return kept, holes


def keep_connected_to(mask: np.ndarray, seed: tuple[int, int]) -> np.ndarray:
    """Drop isolated glow islands; keep the clapper + filmstrip."""
    canvas = np.zeros((S, S, 3), dtype=np.uint8)
    canvas[mask] = (255, 255, 255)
    img = Image.fromarray(canvas, "RGB")
    if img.getpixel(seed)[0] < 200:
        return mask
    ImageDraw.floodfill(img, seed, (255, 0, 0), thresh=8)
    out = np.array(img)
    return (out[..., 0] > 200) & (out[..., 1] < 40)


def paint_solid_letters(
    out: np.ndarray,
    src: np.ndarray,
    word: np.ndarray,
    field_rgb: np.ndarray,
    ink: np.ndarray,
) -> np.ndarray:
    """Solid **Si-** ink + Tiffany **nema**. Dilate cores so Search-size S keeps its bowl."""
    lum = src.max(axis=-1)
    cyan = is_cyan(src)
    white_core = word & (lum > 80) & ~cyan
    cyan_core = word & cyan
    # 11×11 dilate (~5 px) keeps the italic S bowl at Search / share-sheet size.
    si = dilate(white_core, 11) & word
    nema = dilate(cyan_core, 9) & word
    si &= ~nema
    out[si] = ink
    out[nema] = TIFFANY
    return out


def build_whiteblack(src: np.ndarray, rim_src: Path | None = None) -> np.ndarray:
    """White field, black **Si-**, Tiffany **nema**, sharp clapper (no glow halo)."""
    field_rgb = np.array([248, 248, 250], dtype=np.float32)
    ink = np.array([16, 16, 18], dtype=np.float32)
    yy = np.arange(S)[:, None]
    xx = np.arange(S)[None, :]
    rim = (yy < 54) | (yy > S - 54) | (xx < 54) | (xx > S - 54)
    word = (yy > 790) & (yy < S - 54) & (xx > 70) & (xx < 980)
    film = (yy >= 560) & (yy < 790) & (xx > 90) & (xx < 960)

    lum = src.max(axis=-1)
    black = is_near_black(src, 34)
    field = connected_border_field(black)
    # Never grow into the filmstrip — that ate the hanging bottom rail.
    field = grow_field_into_glow(field, lum, word | film)
    clapper = ~field & (yy < 790) & ~rim
    clapper = morph(clapper, open_k=0, close_k=3)
    clapper = keep_connected_to(clapper, (512, 470))
    # Re-attach hanging film pixels the flood may still have dropped.
    # Closed silhouette so sprocket interiors stay official-dark, not punched white.
    cyan = is_cyan(src)
    film_sil = film & ~rim & ((lum > 32) | cyan)
    film_sil = morph(film_sil, open_k=0, close_k=11)
    clapper |= film_sil
    clapper, holes = tighten_hanging_film(clapper)

    out = np.broadcast_to(field_rgb, src.shape).copy()
    sharp = np.array(
        Image.fromarray(np.clip(src, 0, 255).astype(np.uint8), "RGB").filter(
            ImageFilter.UnsharpMask(radius=1.4, percent=140, threshold=2)
        ),
        dtype=np.float32,
    )
    out[clapper] = sharp[clapper]
    # Punched sprocket interiors → navy so WB doesn't show a white bite.
    if holes.any():
        out[holes] = np.array([8, 22, 28], dtype=np.float32)

    sat_rim = rim & (chroma(src) > 38) & (lum > 40)
    out[sat_rim] = np.array([22, 22, 24], dtype=np.float32)
    mag = is_magenta(src) & rim
    if mag.any():
        out[mag] = src[mag]

    out = paint_solid_letters(out, src, word, field_rgb, ink)
    stray = (yy > 900) & (xx > 900) & is_cyan(out)
    if stray.any():
        out[stray] = field_rgb
    return out


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

    save_jpg(build_whiteblack(official, OUT / "sinema-whiteblack.jpg"), OUT / "sinema-whiteblack.jpg")


if __name__ == "__main__":
    main()
