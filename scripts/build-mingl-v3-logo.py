#!/usr/bin/env python3
"""Mingl v3 brand mark — clean vector + Search chrome tiles.

Source of truth: owner pack Mingl_Cursor_Logo_White_Teal_Purple_v3
(approved PNG is a noisy visual reference; this script writes real SVG paths).

  * Color master: white glossy people, teal/purple trim, white bubble,
    Min white / gl teal + TM. Transparent canvas. No orbit, no outer square.
  * Monochrome: currentColor, no tile border/background.
  * PNG exports: 128 / 256 / 512 / 1024 (transparent).
  * Search chrome JPGs: Site Chrome owns the enclosing tile (Si-nema rim
    on a black/pack field). The brand mark itself stays frameless.

Typography: Noto Sans Display Bold Italic outlined (permitted FLOQR family).
The noisy PNG uses an unknown heavy italic; this is the flagged approximation.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
CHROME = ROOT / "images/chrome"
SVG_DIR = CHROME / "mingl-svg"
EXPORTS = SVG_DIR / "exports"
LOGOS = SVG_DIR / "logos"
PACK = CHROME / "mingl-logo-v3"
RING_REF = CHROME / "sinema-nightlife.jpg"
FONT_PATH = "/usr/share/fonts/truetype/noto/NotoSansDisplay-BoldItalic.ttf"
CHROME_BIN = os.environ.get("CHROME_BIN", "/usr/bin/google-chrome")

S = 1024
SQ_CORNER = 88
RIM = 56
TEAL = "#03d8dc"
TEAL_DEEP = "#049ea8"
PURPLE = "#c43cf0"
PURPLE_DEEP = "#9b1fd4"
TIFFANY = (0, 212, 254)
WHITE = (255, 255, 255)
INK = "#1a1c22"


def glyph_d(font: TTFont, char: str, size: float, x: float, y: float) -> tuple[str, float]:
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    name = cmap[ord(char)]
    upem = font["head"].unitsPerEm
    scale = size / upem
    pen = SVGPathPen(glyph_set)
    tpen = TransformPen(pen, Transform(scale, 0, 0, -scale, x, y))
    glyph_set[name].draw(tpen)
    advance = glyph_set[name].width * scale
    return pen.getCommands(), advance


def wordmark_paths(size: float = 210, tracking: float = -10.0) -> dict:
    font = TTFont(FONT_PATH)
    x = 0.0
    parts = {"Min": [], "gl": [], "tm": []}
    baseline = 0.0
    for ch in "Min":
        d, adv = glyph_d(font, ch, size, x, baseline)
        parts["Min"].append(d)
        x += adv + tracking
    for ch in "gl":
        d, adv = glyph_d(font, ch, size, x, baseline)
        parts["gl"].append(d)
        x += adv + tracking
    tm_size = size * 0.28
    d, adv = glyph_d(font, "™", tm_size, x + size * 0.02, baseline - size * 0.62)
    parts["tm"].append(d)
    width = x + tm_size * 0.9
    return {"parts": parts, "width": width, "size": size}


def path_els(ds: list[str], fill: str, stroke: str, sw: float) -> str:
    bits = []
    for d in ds:
        bits.append(
            f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.2f}" '
            f'stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill"/>'
        )
    return "\n".join(bits)


def color_svg() -> str:
    wm = wordmark_paths(210, -12)
    # Wordmark sits fully under the people (approved PNG). ~700 wide, baseline ~958.
    wm_w = 690.0
    scale = wm_w / wm["width"]
    tx = (S - wm_w) / 2
    ty = 918
    min_paths = path_els(wm["parts"]["Min"], "#ffffff", INK, 14 / scale)
    gl_paths = path_els(wm["parts"]["gl"], TEAL, INK, 14 / scale)
    tm_paths = path_els(wm["parts"]["tm"], "#ffffff", INK, 8 / scale)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="Mingl logo">
  <title>Mingl</title>
  <desc>Three glossy people, conversation bubble, Mingl wordmark. Transparent canvas. No tile, no orbit.</desc>
  <defs>
    <radialGradient id="headTeal" cx="38%" cy="30%" r="72%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.52" stop-color="#f4ffff"/>
      <stop offset="1" stop-color="#9af6f8"/>
    </radialGradient>
    <radialGradient id="headPurple" cx="38%" cy="30%" r="72%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.48" stop-color="#fbf0ff"/>
      <stop offset="1" stop-color="#e0a4f8"/>
    </radialGradient>
    <linearGradient id="bodyTeal" x1="0.2" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#eefeff"/>
      <stop offset="1" stop-color="#6aeff2"/>
    </linearGradient>
    <linearGradient id="bodyPurple" x1="0.2" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.5" stop-color="#f7e9ff"/>
      <stop offset="1" stop-color="#d56af0"/>
    </linearGradient>
    <linearGradient id="bubbleFill" x1="0.15" y1="0" x2="0.95" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.62" stop-color="#f7ffff"/>
      <stop offset="1" stop-color="#c8fbff"/>
    </linearGradient>
    <linearGradient id="bubbleStroke" x1="0" y1="0.15" x2="1" y2="0.9">
      <stop offset="0" stop-color="{PURPLE}"/>
      <stop offset="0.42" stop-color="#d8b4ff"/>
      <stop offset="1" stop-color="{TEAL}"/>
    </linearGradient>
  </defs>

  <!-- Figures scaled up-canvas so the wordmark has a clear gap underneath. -->
  <g transform="translate(512 16) scale(0.90) translate(-512 -16)">
  <!-- Conversation bubble -->
  <g fill="none">
    <path d="M284 72H740a104 104 0 0 1 0 208H490l-92 78 18-78H284a104 104 0 0 1 0-208Z"
          fill="url(#bubbleFill)" stroke="url(#bubbleStroke)" stroke-width="14" stroke-linejoin="round"/>
    <g fill="#111318">
      <circle cx="430" cy="176" r="22"/>
      <circle cx="512" cy="176" r="22"/>
      <circle cx="594" cy="176" r="22"/>
    </g>
  </g>

  <!-- Rear people (teal trim) -->
  <g stroke="{TEAL}" stroke-width="14" stroke-linejoin="round">
    <circle cx="300" cy="428" r="90" fill="url(#headTeal)"/>
    <circle cx="724" cy="428" r="90" fill="url(#headTeal)"/>
    <path d="M108 678c0-118 86-186 192-186s192 68 192 186v22H108Z" fill="url(#bodyTeal)"/>
    <path d="M532 678c0-118 86-186 192-186s192 68 192 186v22H532Z" fill="url(#bodyTeal)"/>
  </g>
  <g fill="#ffffff" opacity="0.55">
    <ellipse cx="274" cy="402" rx="28" ry="18"/>
    <ellipse cx="698" cy="402" rx="28" ry="18"/>
    <ellipse cx="210" cy="560" rx="48" ry="22"/>
    <ellipse cx="634" cy="560" rx="48" ry="22"/>
  </g>

  <!-- Center person (purple trim), in front -->
  <g stroke="{PURPLE}" stroke-width="16" stroke-linejoin="round">
    <circle cx="512" cy="478" r="102" fill="url(#headPurple)"/>
    <path d="M292 710c0-124 96-192 220-192s220 68 220 192v20H292Z" fill="url(#bodyPurple)"/>
  </g>
  <g fill="#ffffff" opacity="0.62">
    <ellipse cx="478" cy="448" rx="34" ry="22"/>
    <ellipse cx="430" cy="600" rx="56" ry="24"/>
  </g>
  </g>

  <!-- Mingl™ — outlined Noto Sans Display Bold Italic (Min white / gl teal) -->
  <g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.5f})">
    {min_paths}
    {gl_paths}
    {tm_paths}
  </g>
</svg>
'''


def mono_svg() -> str:
    wm = wordmark_paths(210, -12)
    wm_w = 690.0
    scale = wm_w / wm["width"]
    tx = (S - wm_w) / 2
    ty = 918

    def fill_paths(ds: list[str]) -> str:
        return "\n".join(f'<path d="{d}"/>' for d in ds)

    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="Mingl logo" fill="currentColor">
  <title>Mingl</title>
  <desc>Monochrome Mingl mark for Site Chrome. Shape only — no tile, no background.</desc>
  <g transform="translate(512 16) scale(0.90) translate(-512 -16)">
  <path d="M284 72H740a104 104 0 0 1 0 208H490l-92 78 18-78H284a104 104 0 0 1 0-208Z"/>
  <g fill="var(--mingl-cutout, #000)">
    <circle cx="430" cy="176" r="22"/>
    <circle cx="512" cy="176" r="22"/>
    <circle cx="594" cy="176" r="22"/>
  </g>
  <circle cx="300" cy="428" r="90"/>
  <circle cx="724" cy="428" r="90"/>
  <path d="M108 678c0-118 86-186 192-186s192 68 192 186v22H108Z"/>
  <path d="M532 678c0-118 86-186 192-186s192 68 192 186v22H532Z"/>
  <circle cx="512" cy="478" r="102"/>
  <path d="M292 710c0-124 96-192 220-192s220 68 220 192v20H292Z"/>
  </g>
  <g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.5f})">
    {fill_paths(wm["parts"]["Min"])}
    {fill_paths(wm["parts"]["gl"])}
    {fill_paths(wm["parts"]["tm"])}
  </g>
</svg>
'''


def write_svgs() -> tuple[Path, Path]:
    LOGOS.mkdir(parents=True, exist_ok=True)
    color = LOGOS / "mingl-color-master.svg"
    mono = LOGOS / "mingl-chrome-monochrome.svg"
    color.write_text(color_svg(), encoding="utf-8")
    mono.write_text(mono_svg(), encoding="utf-8")
    print(f"  wrote {color.relative_to(ROOT)}")
    print(f"  wrote {mono.relative_to(ROOT)}")
    return color, mono


def chrome_shot(html: Path, png: Path, size: int) -> None:
    png.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        CHROME_BIN,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        f"--window-size={size},{size}",
        f"--screenshot={png}",
        f"file://{html}",
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=40)


def raster_with_alpha(svg_path: Path, size: int) -> Image.Image:
    """Dual-pass black/white Chrome shots → straight alpha PNG."""
    svg_text = svg_path.read_text(encoding="utf-8")
    # Inline the SVG so file:// does not need extra fetches.
    def page(bg: str) -> str:
        return (
            "<!doctype html><html><head><meta charset='utf-8'/>"
            f"<style>html,body{{margin:0;background:{bg};width:{size}px;height:{size}px;overflow:hidden}}"
            f"svg{{display:block;width:{size}px;height:{size}px}}</style></head><body>"
            + svg_text.replace('<?xml version="1.0" encoding="UTF-8"?>', "")
            + "</body></html>"
        )

    with tempfile.TemporaryDirectory(prefix="mingl-v3-") as tmp:
        tmp_p = Path(tmp)
        black_html = tmp_p / "black.html"
        white_html = tmp_p / "white.html"
        black_png = tmp_p / "black.png"
        white_png = tmp_p / "white.png"
        black_html.write_text(page("#000000"), encoding="utf-8")
        white_html.write_text(page("#ffffff"), encoding="utf-8")
        chrome_shot(black_html, black_png, size)
        chrome_shot(white_html, white_png, size)
        ck = np.array(Image.open(black_png).convert("RGB").resize((size, size), Image.Resampling.LANCZOS), dtype=np.float32)
        cw = np.array(Image.open(white_png).convert("RGB").resize((size, size), Image.Resampling.LANCZOS), dtype=np.float32)
    # Ck = src * a; Cw = src * a + 255 * (1-a)  →  a = 1 - (Cw-Ck)/255
    diff = np.clip(cw - ck, 0, 255)
    a = 1.0 - diff.mean(axis=-1) / 255.0
    a = np.clip(a, 0, 1)
    # Kill almost-empty pixels (screenshot dither).
    a = np.where(a < 0.04, 0.0, a)
    src = np.zeros_like(ck)
    mask = a > 0.04
    src[mask] = np.clip(ck[mask] / a[mask, None], 0, 255)
    rgba = np.dstack([src, np.clip(a * 255.0, 0, 255)])
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def export_pngs(master: Path) -> Path:
    EXPORTS.mkdir(parents=True, exist_ok=True)
    full = raster_with_alpha(master, 1024)
    # Trim residual 1px screenshot fringe on fully transparent rows/cols? Keep padding.
    out_1024 = EXPORTS / "mingl-logo-1024.png"
    full.save(out_1024, "PNG")
    print(f"  wrote {out_1024.relative_to(ROOT)}  bbox={full.getbbox()}")
    for n in (512, 256, 128):
        img = full.resize((n, n), Image.Resampling.LANCZOS)
        path = EXPORTS / f"mingl-logo-{n}.png"
        img.save(path, "PNG")
        print(f"  wrote {path.relative_to(ROOT)}")
    return out_1024


def apply_rim(
    rgb: np.ndarray,
    ring_path: Path | None = None,
    field: tuple[int, int, int] = (0, 0, 0),
) -> np.ndarray:
    src = ring_path or RING_REF
    if not src.exists():
        return rgb
    ring = np.array(Image.open(src).convert("RGB"), dtype=np.float32)
    rim = np.zeros((S, S), dtype=bool)
    rim[:RIM] = True
    rim[-RIM:] = True
    rim[:, :RIM] = True
    rim[:, -RIM:] = True
    field_arr = np.array(field, dtype=np.float32)
    gap = np.abs(ring - field_arr).max(axis=-1)
    pick = rim & (gap > 18)
    if pick.any():
        rgb = rgb.copy()
        rgb[pick] = ring[pick]
    return rgb


def composite_on_field(
    mark: Image.Image,
    field: tuple[int, int, int],
    ring_path: Path | None = None,
) -> np.ndarray:
    """Place the transparent mark inside the chrome square. Site Chrome owns the tile."""
    canvas = Image.new("RGBA", (S, S), (*field, 255))
    inner = S - 2 * RIM
    target = inner
    fitted = mark.resize((target, target), Image.Resampling.LANCZOS)
    x = (S - target) // 2
    y = (S - target) // 2
    canvas.alpha_composite(fitted, (x, y))
    rgb = np.array(canvas.convert("RGB"), dtype=np.float32)
    return apply_rim(rgb, ring_path, field)


def rgb_to_hsv(rgb: np.ndarray):
    x = rgb / 255.0
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    df = np.maximum(mx - mn, 1e-8)
    h = np.zeros_like(mx)
    rc = (mx - r) / df
    gc = (mx - g) / df
    bc = (mx - b) / df
    h = np.where(mx == r, (bc - gc), h)
    h = np.where(mx == g, 2.0 + (rc - bc), h)
    h = np.where(mx == b, 4.0 + (gc - rc), h)
    h = (h / 6.0) % 1.0
    s = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-8), 0.0)
    return h, s, mx


def is_near_white(rgb: np.ndarray, thr: int = 198) -> np.ndarray:
    return (rgb.min(axis=-1) > thr) & (np.ptp(rgb, axis=-1) < 58)


def is_cyan_hue(h: np.ndarray) -> np.ndarray:
    return (h >= 0.40) & (h < 0.70)


def is_mag_hue(h: np.ndarray) -> np.ndarray:
    return (h >= 0.70) | (h < 0.08)


def tint(mask: np.ndarray, v: np.ndarray, color, lo: float = 0.28, hi: float = 0.72) -> np.ndarray:
    scale = (lo + hi * v[mask])[..., None]
    return np.clip(np.array(color, dtype=np.float32) * scale, 0, 255)


def recolor(src: np.ndarray, *, mag, cyan, black=None) -> np.ndarray:
    """Recolor teal/purple accents only. Glossy white people / Min stay white."""
    out = src.copy()
    h, s, v = rgb_to_hsv(src)
    white = is_near_white(src)
    if black is not None:
        field = (v < 0.16) & (s < 0.38) & ~white
        out[field] = black
    chroma = (s >= 0.18) & ~white
    c = chroma & is_cyan_hue(h)
    m = chroma & is_mag_hue(h) & ~c
    leftover = chroma & ~c & ~m
    if c.any():
        out[c] = tint(c, v, cyan)
    if m.any():
        out[m] = tint(m, v, mag)
    if leftover.any():
        out[leftover] = tint(leftover, v, cyan)
    return out


def _dilate_bool(mask: np.ndarray, k: int = 3) -> np.ndarray:
    img = Image.fromarray((mask.astype(np.uint8) * 255), "L")
    return np.array(img.filter(ImageFilter.MaxFilter(k))) > 127


def invert_mark(mark: Image.Image) -> Image.Image:
    """White/Black: invert people / Min to ink, keep teal **gl** as Tiffany.

    A full luma invert turns teal into grey, which is why live WB Mingl lost
    the same Tiffany split FloqCAST / BOT DEE keep.
    """
    arr = np.array(mark).astype(np.float32)
    rgb, a = arr[..., :3], arr[..., 3]
    r, g, bch = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * bch
    # Wordmark band only — people teal trim must invert, not become Tiffany blobs.
    yy = np.arange(arr.shape[0], dtype=np.int32)[:, None]
    word = yy > int(arr.shape[0] * 0.68)
    cyan = (
        word
        & (bch > 130)
        & (g > 118)
        & (r < 165)
        & (bch > r + 16)
        & (g > r + 6)
        & (a > 36)
    )
    inv = np.clip((255.0 - y - 8.0) * 1.06, 0, 255)
    out_rgb = np.stack([inv, inv, inv], axis=-1)
    tiff = np.array(TIFFANY, dtype=np.float32)
    out_rgb[cyan] = tiff
    # Keep the dark outline on **gl** (inverted stroke would halo Tiffany).
    ink = (y < 78) & (a > 70) & _dilate_bool(cyan, 5) & ~cyan
    out_rgb[ink] = np.array([22, 24, 28], dtype=np.float32)
    return Image.fromarray(np.dstack([out_rgb, a]).astype(np.uint8), "RGBA")


def save_jpg(arr: np.ndarray, path: Path) -> None:
    # Full square like Si-nema. CSS `border-radius: 8.6%` (SQ_CORNER) rounds
    # the Search face — do not bake a black canvas under light chromes.
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").save(
        path, quality=96, subsampling=0
    )
    print(f"  wrote {path.name}")


def write_chrome_packs(mark: Image.Image) -> None:
    """Brand accents stay white/teal/purple on dark chromes. Only the tile field + rim change.
    White/Black inverts people / Min and keeps **gl** Tiffany."""
    nightlife = composite_on_field(mark, (0, 0, 0), CHROME / "sinema-nightlife.jpg")
    save_jpg(nightlife, CHROME / "mingl-nightlife.jpg")
    save_jpg(
        composite_on_field(mark, (0, 0, 0), CHROME / "sinema-blacktiffany.jpg"),
        CHROME / "mingl-blacktiffany.jpg",
    )
    save_jpg(
        composite_on_field(mark, (16, 16, 18), CHROME / "sinema-traditional.jpg"),
        CHROME / "mingl-traditional.jpg",
    )
    save_jpg(
        composite_on_field(mark, (18, 8, 28), CHROME / "sinema-purplewhite.jpg"),
        CHROME / "mingl-purplewhite.jpg",
    )
    save_jpg(
        composite_on_field(mark, (6, 12, 8), CHROME / "sinema-blackdarkgreen.jpg"),
        CHROME / "mingl-blackdarkgreen.jpg",
    )
    wb_field = (248, 248, 250)
    wb_path = CHROME / "mingl-whiteblack.jpg"
    save_jpg(
        composite_on_field(invert_mark(mark), wb_field, CHROME / "sinema-whiteblack.jpg"),
        wb_path,
    )
    corners = np.array(Image.open(wb_path).convert("RGB"))
    for y, x in ((0, 0), (0, -1), (-1, 0), (-1, -1)):
        if corners[y, x].min() < 200:
            raise SystemExit(
                f"{wb_path.name} corner {(y, x)}={tuple(corners[y, x])} is too dark "
                "(baked black wedge; CSS should round a light full square)"
            )


def copy_owner_pack() -> None:
    src = Path("/tmp/mingl-v3/Mingl_Cursor_Logo_v3")
    if not src.exists():
        print("  owner pack not in /tmp — skip copy")
        return
    PACK.mkdir(parents=True, exist_ok=True)
    (PACK / "assets").mkdir(exist_ok=True)
    (PACK / "prompts").mkdir(exist_ok=True)
    for rel in (
        "README.md",
        "assets/mingl-approved-reference.png",
        "assets/mingl-clean-vector-starter.svg",
        "assets/mingl-chrome-monochrome.svg",
        "prompts/CURSOR_MASTER_PROMPT.md",
    ):
        s = src / rel
        d = PACK / rel
        if s.exists():
            shutil.copy2(s, d)
    print(f"  owner pack at {PACK.relative_to(ROOT)}")


def small_size_qa(mark: Image.Image) -> None:
    """Paint the transparent mark on black at 32/48/64 for legibility check."""
    qa = Image.new("RGB", (320, 120), (8, 8, 12))
    dr = ImageDraw.Draw(qa)
    x = 16
    for n in (32, 48, 64):
        tile = Image.new("RGBA", (n, n), (0, 0, 0, 255))
        m = mark.resize((n, n), Image.Resampling.LANCZOS)
        tile.alpha_composite(m)
        qa.paste(tile.convert("RGB"), (x, 28))
        dr.text((x, 8), f"{n}px", fill=(180, 180, 190))
        x += n + 24
    out = EXPORTS / "mingl-logo-size-qa.png"
    qa.save(out)
    print(f"  wrote {out.relative_to(ROOT)}")


def main() -> None:
    print("Mingl v3 — clean vector + chrome tiles")
    copy_owner_pack()
    color, _mono = write_svgs()
    mark = export_pngs(color)
    mark_img = Image.open(mark).convert("RGBA")
    small_size_qa(mark_img)
    write_chrome_packs(mark_img)
    meta = {
        "source": "Mingl_Cursor_Logo_White_Teal_Purple_v3",
        "font": "Noto Sans Display Bold Italic (outlined)",
        "split": "Min white / gl teal + TM",
        "noOrbit": True,
        "noOuterSquareOnMark": True,
        "siteChromeOwnsTile": True,
    }
    (EXPORTS / "mingl-v3-meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print("done")


if __name__ == "__main__":
    main()
