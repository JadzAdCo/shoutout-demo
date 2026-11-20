#!/usr/bin/env python3
"""Si-nema Search chrome — vector mark, Site Chrome fills, transparent voids.

Approved FloqMedia official mark (`images/chrome/official/si-nema-blacktiffany.webp`)
is the layout reference only. This script draws a real SVG clapper + film + wordmark
so every graphic and letter can take a Site Chrome fill. Former black regions
(screen, sprocket holes, lid/jaw stripe gaps, hinge centers, hanging film,
outer field) stay transparent — never painted black.

Typography: Noto Sans Display Bold Italic (FLOQR family), outlined.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images/chrome"
OFFICIAL = OUT / "official/si-nema-blacktiffany.webp"
SVG_DIR = OUT / "sinema-svg"
LOGOS = SVG_DIR / "logos"
EXPORTS = SVG_DIR / "exports"
FONT_PATH = "/usr/share/fonts/truetype/noto/NotoSansDisplay-BoldItalic.ttf"
SCALE = 2  # draw at 2048 then downsample for crisp Search edges

S = 1024
RIM = 56
TIFFANY = "#00d4fe"
INK_WB = "#1a1c22"
FIELD_WB = (248, 248, 250)

# Site Chrome palettes. `field` is the tile only (JPG packs). The mark itself
# never uses #000 — voids are omitted so the field (or real alpha) shows.
PACKS = {
    "nightlife": {
        "field": (0, 0, 0),
        "ink": "#ffffff",
        "accent": TIFFANY,
        "metal": "#e8eef6",
        "metalDark": "#9aa7b8",
        "rim": "official",
        "fmt": "jpg",
    },
    "blackTiffany": {
        "field": (0, 0, 0),
        "ink": "#ffffff",
        "accent": TIFFANY,
        "metal": "#e8eef6",
        "metalDark": "#7ad4ea",
        "rim": "official",
        "fmt": "jpg",
    },
    "traditional": {
        "field": (18, 18, 20),
        "ink": "#f3f3f5",
        "accent": "#c8c8d0",
        "metal": "#d8dce4",
        "metalDark": "#8a8f99",
        "rim": "official",
        "fmt": "jpg",
    },
    "purpleWhite": {
        "field": (18, 8, 28),
        "ink": "#ffffff",
        "accent": "#f472b6",
        "metal": "#efe4f6",
        "metalDark": "#c084fc",
        "rim": "official",
        "fmt": "jpg",
    },
    "blackDarkGreen": {
        "field": (6, 12, 8),
        "ink": "#ffffff",
        "accent": "#5ac783",
        "metal": "#d5eadc",
        "metalDark": "#2e8a5a",
        "rim": "official",
        "fmt": "jpg",
    },
    "whiteBlack": {
        "field": None,  # transparent tile
        "ink": INK_WB,
        "accent": TIFFANY,
        "metal": "#d8dde6",
        "metalDark": "#5c6370",
        "rim": "floqcast-wb",
        "fmt": "png",
    },
}


def glyph_d(font: TTFont, char: str, size: float, x: float, y: float) -> tuple[str, float]:
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    name = cmap[ord(char)]
    upem = font["head"].unitsPerEm
    scale = size / upem
    pen = SVGPathPen(glyph_set)
    tpen = TransformPen(pen, Transform(scale, 0, 0, -scale, x, y))
    glyph_set[name].draw(tpen)
    return pen.getCommands(), glyph_set[name].width * scale


def word_paths(text: str, size: float, tracking: float = -8.0) -> tuple[list[str], float]:
    font = TTFont(FONT_PATH)
    x = 0.0
    ds: list[str] = []
    for ch in text:
        d, adv = glyph_d(font, ch, size, x, 0.0)
        ds.append(d)
        x += adv + tracking
    return ds, x


def rrect(x: float, y: float, w: float, h: float, r: float) -> str:
    r = min(r, w / 2.0, h / 2.0)
    return (
        f"M {x + r:.2f} {y:.2f} H {x + w - r:.2f} "
        f"A {r:.2f} {r:.2f} 0 0 1 {x + w:.2f} {y + r:.2f} "
        f"V {y + h - r:.2f} A {r:.2f} {r:.2f} 0 0 1 {x + w - r:.2f} {y + h:.2f} "
        f"H {x + r:.2f} A {r:.2f} {r:.2f} 0 0 1 {x:.2f} {y + h - r:.2f} "
        f"V {y + r:.2f} A {r:.2f} {r:.2f} 0 0 1 {x + r:.2f} {y:.2f} Z"
    )


def stripe_cutouts(w: float, h: float, pitch: float = 54.0, bar: float = 26.0, slant: float = 38.0) -> str:
    """Diagonal gaps (the old black clapper stripes). Cutouts, not fills."""
    parts: list[str] = []
    x = -h - pitch
    while x < w + h + pitch:
        x0, x1 = x, x + bar
        parts.append(
            f"M {x0:.2f} {-2:.2f} L {x1:.2f} {-2:.2f} "
            f"L {x1 + slant:.2f} {h + 2:.2f} L {x0 + slant:.2f} {h + 2:.2f} Z"
        )
        x += pitch
    return " ".join(parts)


def ellipse_ring(cx: float, cy: float, rx: float, ry: float, t: float) -> str:
    """Evenodd elliptical annulus (outer then inner)."""
    ox, oy = rx, ry
    ix, iy = rx - t, ry - t

    def ring(ax: float, ay: float) -> str:
        return (
            f"M {cx + ax:.2f} {cy:.2f} "
            f"A {ax:.2f} {ay:.2f} 0 1 1 {cx - ax:.2f} {cy:.2f} "
            f"A {ax:.2f} {ay:.2f} 0 1 1 {cx + ax:.2f} {cy:.2f} Z"
        )

    return ring(ox, oy) + " " + ring(ix, iy)


def sprocket_holes(cx: float, cy: float, rx: float, ry: float, n: int = 14) -> str:
    """Rounded sprocket punches along the lower wrap only — no hanging teeth."""
    parts: list[str] = []
    # t = 0 at the right; pi/2 at the bottom. Keep the visible belt.
    t0, t1 = 0.12 * math.pi, 0.88 * math.pi
    for i in range(n):
        t = t0 + (t1 - t0) * i / (n - 1)
        x = cx + rx * math.cos(t)
        y = cy + ry * math.sin(t)
        if y < cy - 8:
            continue
        w, h, r = 28.0, 22.0, 5.0
        ang = t + math.pi / 2.0
        ca, sa = math.cos(ang), math.sin(ang)
        hw, hh = w / 2.0, h / 2.0
        corners = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
        pts = []
        for px, py in corners:
            pts.append((x + px * ca - py * sa, y + px * sa + py * ca))
        # Approximate a rounded rect as a polygon — Search size is 96px.
        d = f"M {pts[0][0]:.2f} {pts[0][1]:.2f} "
        d += " ".join(f"L {p[0]:.2f} {p[1]:.2f}" for p in pts[1:])
        d += " Z"
        parts.append(d)
    return " ".join(parts)


def path_els(ds: list[str], fill: str) -> str:
    return "\n".join(
        f'<path d="{d}" fill="{fill}"/>' for d in ds
    )


def build_svg(pal: dict) -> str:
    ink, accent, metal, md = pal["ink"], pal["accent"], pal["metal"], pal["metalDark"]
    si, si_w = word_paths("Si-", 208, -10)
    nema, nema_w = word_paths("nema", 208, -10)
    ai, _ = word_paths("AI", 72, 2)
    wm_w = si_w + 6 + nema_w
    wm_x = (S - wm_w) / 2.0
    wm_y = 912

    lid_w, lid_h, lid_r = 548.0, 72.0, 22.0
    stick_x, stick_y = 268.0, 332.0
    lid_shape = rrect(0, 0, lid_w, lid_h, lid_r)
    lid_bars = lid_shape + " " + stripe_cutouts(lid_w, lid_h)

    film_d = ellipse_ring(512, 548, 318, 132, 46) + " " + sprocket_holes(512, 548, 295, 109, 13)

    play = "M 392 418 L 392 542 L 508 480 Z"
    play_inner = "M 412 448 L 412 512 L 468 480 Z"

    hinge = rrect(232, 292, 92, 228, 32)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="Si-nema logo">
  <title>Si-nema</title>
  <desc>Vector clapper, film wrap, Si-nema wordmark. Transparent canvas. Screen, sprockets, stripe gaps, and hinge centers are holes — no black fills. Site Chrome owns ink/accent/metal.</desc>

  <!-- Film belt (accent fill, sprocket holes punched). Tight wrap — no hanging teeth. -->
  <path fill="{accent}" fill-rule="evenodd" d="{film_d}"/>

  <!-- Clapper body: metal frame only. Interior = screen hole (transparent). -->
  <rect x="258" y="392" width="534" height="228" rx="26" ry="26"
        fill="none" stroke="{metal}" stroke-width="22"/>
  <rect x="258" y="392" width="534" height="228" rx="26" ry="26"
        fill="none" stroke="{md}" stroke-width="6"/>

  <!-- Play / AI live in the hole; accent fill, inner play cut so it is not a black slab. -->
  <path fill="{accent}" fill-rule="evenodd" d="{play} {play_inner}"/>
  <g transform="translate(548 508)">{path_els(ai, accent)}</g>

  <!-- Hinge housing (metal). Screw centers are rings — transparent, not black. -->
  <path d="{hinge}" fill="{metal}"/>
  <circle cx="278" cy="352" r="15" fill="none" stroke="{md}" stroke-width="8"/>
  <circle cx="278" cy="438" r="15" fill="none" stroke="{md}" stroke-width="8"/>

  <!-- Lower jaw (striped metal, gaps transparent). -->
  <g transform="translate({stick_x:.2f} {stick_y:.2f})">
    <clipPath id="stickShape"><path d="{lid_shape}"/></clipPath>
    <path fill="{metal}" fill-rule="evenodd" clip-path="url(#stickShape)" d="{lid_bars}"/>
  </g>

  <!-- Open lid. -->
  <g transform="translate(262 318) rotate(-27 24 36)">
    <clipPath id="lidShape"><path d="{lid_shape}"/></clipPath>
    <path fill="{metal}" fill-rule="evenodd" clip-path="url(#lidShape)" d="{lid_bars}"/>
  </g>

  <!-- Wordmark: Si- = chrome ink, nema = chrome accent. Outlined glyphs, not a bitmap. -->
  <g transform="translate({wm_x:.2f} {wm_y:.2f})">
    {path_els(si, ink)}
    <g transform="translate({si_w + 6:.2f} 0)">{path_els(nema, accent)}</g>
  </g>
</svg>
'''


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def paste_mask(canvas: Image.Image, mask: Image.Image, color: tuple[int, int, int]) -> None:
    layer = Image.new("RGBA", canvas.size, (*color, 255))
    clear = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    canvas.alpha_composite(Image.composite(layer, clear, mask))


def striped_stick_mask(w: float, h: float, r: float) -> Image.Image:
    """Metal bars with transparent diagonal gaps (the old black stripes)."""
    k = SCALE
    pad = int(80 * k)
    im = Image.new("L", (int(w * k) + pad * 2, int(h * k) + pad * 2), 0)
    d = ImageDraw.Draw(im)
    box = [pad, pad, pad + w * k, pad + h * k]
    d.rounded_rectangle(box, radius=r * k, fill=255)
    pitch, bar, slant = 50.0 * k, 32.0 * k, 34.0 * k
    x = -h * k - pitch
    while x < w * k + h * k + pitch:
        quad = [
            (pad + x, pad - 4),
            (pad + x + bar, pad - 4),
            (pad + x + bar + slant, pad + h * k + 4),
            (pad + x + slant, pad + h * k + 4),
        ]
        d.polygon(quad, fill=0)
        x += pitch
    # Solid hinge cap so the lid stays attached; metal outline ties the bars.
    d.rounded_rectangle([pad, pad, pad + 78 * k, pad + h * k], radius=r * k, fill=255)
    d.rounded_rectangle(box, radius=r * k, outline=255, width=max(4, int(5 * k)))
    return im


def film_mask(n: int, k: float, front_only: bool) -> Image.Image:
    """Elliptical film belt. Screen interior punched so the hole stays empty."""
    film = Image.new("L", (n, n), 0)
    fd = ImageDraw.Draw(film)
    cx, cy, rx, ry, t = 512 * k, 560 * k, 300 * k, 118 * k, 44 * k
    fd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    fd.ellipse([cx - (rx - t), cy - (ry - t), cx + (rx - t), cy + (ry - t)], fill=0)
    fd.rounded_rectangle([270 * k, 400 * k, 780 * k, 600 * k], radius=18 * k, fill=0)
    frx, fry = 278 * k, 96 * k
    t0, t1 = 0.18 * math.pi, 0.82 * math.pi
    holes = 11
    for i in range(holes):
        ang = t0 + (t1 - t0) * i / (holes - 1)
        x = cx + frx * math.cos(ang)
        y = cy + fry * math.sin(ang)
        w, h = 26 * k, 20 * k
        rot = ang + math.pi / 2.0
        ca, sa = math.cos(rot), math.sin(rot)
        hw, hh = w / 2.0, h / 2.0
        corners = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
        pts = [(x + px * ca - py * sa, y + px * sa + py * ca) for px, py in corners]
        fd.polygon(pts, fill=0)
    if front_only:
        fd.rectangle([0, 0, n, int(530 * k)], fill=0)
    else:
        fd.rectangle([0, int(530 * k), n, n], fill=0)
    return film


def jaw_on_canvas(n: int, k: float, x: float, y: float, angle: float) -> Image.Image:
    """Striped clapper stick on the full canvas, rotated about the hinge."""
    lid_w, lid_h, lid_r = 520.0, 70.0, 20.0
    local = striped_stick_mask(lid_w, lid_h, lid_r)
    layer = Image.new("L", (n, n), 0)
    pad = int(80 * k)
    layer.paste(local, (int(x * k) - pad, int(y * k) - pad))
    if angle:
        hx, hy = (x + 22) * k, (y + 35) * k
        layer = layer.rotate(angle, center=(hx, hy), resample=Image.Resampling.BICUBIC, fillcolor=0)
    return layer


def raster_mark(pal: dict) -> Image.Image:
    """Paint the SVG geometry with Pillow at 2×, then downsample. Voids stay alpha 0."""
    k = SCALE
    n = S * k
    canvas = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    metal, md = hex_rgb(pal["metal"]), hex_rgb(pal["metalDark"])
    accent, ink = hex_rgb(pal["accent"]), hex_rgb(pal["ink"])

    paste_mask(canvas, film_mask(n, k, front_only=False), accent)

    body = Image.new("L", (n, n), 0)
    bd = ImageDraw.Draw(body)
    frame = [270 * k, 378 * k, 782 * k, 612 * k]
    bd.rounded_rectangle(frame, radius=24 * k, outline=255, width=int(20 * k))
    paste_mask(canvas, body, metal)
    edge = Image.new("L", (n, n), 0)
    ImageDraw.Draw(edge).rounded_rectangle(frame, radius=24 * k, outline=255, width=int(6 * k))
    paste_mask(canvas, edge, md)

    play = Image.new("L", (n, n), 0)
    pd = ImageDraw.Draw(play)
    pd.polygon([(388 * k, 430 * k), (388 * k, 560 * k), (512 * k, 495 * k)], fill=255)
    pd.polygon([(412 * k, 458 * k), (412 * k, 532 * k), (476 * k, 495 * k)], fill=0)
    paste_mask(canvas, play, accent)
    font_ai = ImageFont.truetype(FONT_PATH, int(86 * k))
    ImageDraw.Draw(canvas).text((548 * k, 528 * k), "AI", font=font_ai, fill=(*accent, 255), anchor="ls")

    paste_mask(canvas, film_mask(n, k, front_only=True), accent)
    paste_mask(canvas, jaw_on_canvas(n, k, 286, 322, 0), metal)
    paste_mask(canvas, jaw_on_canvas(n, k, 286, 304, 24), metal)

    hinge = Image.new("L", (n, n), 0)
    hd = ImageDraw.Draw(hinge)
    hd.rounded_rectangle([238 * k, 268 * k, 338 * k, 500 * k], radius=34 * k, fill=255)
    paste_mask(canvas, hinge, metal)
    rings = Image.new("L", (n, n), 0)
    rd = ImageDraw.Draw(rings)
    for cy_s in (328, 430):
        bbox = [288 * k - 16 * k, cy_s * k - 16 * k, 288 * k + 16 * k, cy_s * k + 16 * k]
        rd.ellipse(bbox, outline=255, width=int(8 * k))
    paste_mask(canvas, rings, md)

    font = ImageFont.truetype(FONT_PATH, int(208 * k))
    td = ImageDraw.Draw(canvas)
    si, nema = "Si-", "nema"
    si_w = font.getlength(si)
    wm_w = si_w + 6 * k + font.getlength(nema)
    wm_x = (n - wm_w) / 2.0
    wm_y = 912 * k
    td.text((wm_x, wm_y), si, font=font, fill=(*ink, 255), anchor="ls")
    td.text((wm_x + si_w + 6 * k, wm_y), nema, font=font, fill=(*accent, 255), anchor="ls")

    return canvas.resize((S, S), Image.Resampling.LANCZOS)


def assert_no_black_fills(mark: Image.Image, name: str) -> None:
    arr = np.array(mark)
    rgb, a = arr[..., :3], arr[..., 3]
    opaque = a > 200
    black = opaque & (rgb.max(axis=-1) < 14)
    frac = float(black.mean()) if opaque.any() else 0.0
    if frac > 0.0008:
        raise SystemExit(f"{name}: opaque near-black fills cover {frac:.4%} of the mark")


def apply_rim(rgb: np.ndarray, rim_src: Path, field: tuple[int, int, int] | None) -> np.ndarray:
    if not rim_src.exists():
        return rgb
    ring = np.array(Image.open(rim_src).convert("RGB").resize((S, S), Image.Resampling.LANCZOS), dtype=np.float32)
    rim = np.zeros((S, S), dtype=bool)
    rim[:RIM] = True
    rim[-RIM:] = True
    rim[:, :RIM] = True
    rim[:, -RIM:] = True
    if field is None:
        field_arr = np.array(FIELD_WB, dtype=np.float32)
    else:
        field_arr = np.array(field, dtype=np.float32)
    gap = np.abs(ring - field_arr).max(axis=-1)
    pick = rim & (gap > 18)
    if pick.any():
        rgb = rgb.copy()
        rgb[pick] = ring[pick]
    return rgb


def composite_mark(
    mark: Image.Image,
    field: tuple[int, int, int] | None,
    rim_src: Path,
) -> np.ndarray:
    if field is None:
        # Frameless mark: Site Chrome / Search tile owns the square. No baked rim.
        return np.array(mark, dtype=np.float32)
    canvas = Image.new("RGBA", (S, S), (*field, 255))
    canvas.alpha_composite(mark)
    rgb = np.array(canvas.convert("RGB"), dtype=np.float32)
    return apply_rim(rgb, rim_src, field)


def save_jpg(arr: np.ndarray, path: Path) -> None:
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").save(
        path, quality=96, subsampling=0
    )
    print(f"  wrote {path.name}")


def save_png(arr: np.ndarray, path: Path) -> None:
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA").save(path, optimize=True)
    print(f"  wrote {path.name}")


def flatten_rgba(rgba: np.ndarray, field_rgb: tuple[int, int, int] = FIELD_WB) -> np.ndarray:
    a = rgba[..., 3:4] / 255.0
    ground = np.array(field_rgb, dtype=np.float32)
    return rgba[..., :3] * a + ground * (1.0 - a)


def rim_source(kind: str) -> Path:
    if kind == "floqcast-wb":
        return OUT / "floqcast-whiteblack.png"
    return OFFICIAL


JPG_NAME = {
    "nightlife": "sinema-nightlife.jpg",
    "blackTiffany": "sinema-blacktiffany.jpg",
    "traditional": "sinema-traditional.jpg",
    "purpleWhite": "sinema-purplewhite.jpg",
    "blackDarkGreen": "sinema-blackdarkgreen.jpg",
}


def main() -> None:
    import sys

    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]
    if not Path(FONT_PATH).exists():
        raise SystemExit(f"missing font {FONT_PATH}")
    LOGOS.mkdir(parents=True, exist_ok=True)
    EXPORTS.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    master = build_svg(PACKS["nightlife"])
    (LOGOS / "sinema-color-master.svg").write_text(master, encoding="utf-8")
    print(f"  wrote {LOGOS.relative_to(ROOT)}/sinema-color-master.svg")

    for name, pal in PACKS.items():
        if only and name != only:
            continue
        svg = build_svg(pal)
        (LOGOS / f"sinema-{name}.svg").write_text(svg, encoding="utf-8")
        mark = raster_mark(pal)
        assert_no_black_fills(mark, name)
        mark.save(EXPORTS / f"sinema-{name}-1024.png", "PNG")
        print(f"  raster {name} bbox={mark.getbbox()}")
        composed = composite_mark(mark, pal["field"], rim_source(pal["rim"]))
        if pal["fmt"] == "png":
            save_png(composed, OUT / "sinema-whiteblack.png")
            save_jpg(flatten_rgba(composed), OUT / "sinema-whiteblack.jpg")
        else:
            save_jpg(composed, OUT / JPG_NAME[name])
    print("done")


if __name__ == "__main__":
    main()
