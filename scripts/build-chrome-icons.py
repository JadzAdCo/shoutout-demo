#!/usr/bin/env python3
"""
Modular chrome icon builder (nightlife + traditional).

Architecture (one pipeline for all marks):
  1. RING     — build once, save to images/chrome/layers/ring-nightlife.png
  2. GRAPHIC  — extract once from a CLEAN source, save as *-graphic.png (no type, no ring)
  3. TYPE     — render ink-only under/over wordmark layers
  4. ASSEMBLE — black bg + graphic + under-type + ring + over-type
  5. TRADITIONAL — same nightlife frame (ring + sizes + positions); recolor non-type
               pixels to charcoal/silver. Verbiage (white + tiffany accents) untouched.

Never hard-clear the graphic when swapping type. Only replace type layers.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
LAYERS = ROOT / "images/chrome/layers"
FONT = "/usr/share/fonts/truetype/noto/NotoSansDisplay-Bold.ttf"
TIFFANY = (0, 212, 254, 255)
WHITE = (255, 255, 255, 255)
# VIP thin border theme: Tiffany blue + light purple (not thick ShoutOut neon)
VIP_BORDER_PURPLE = (196, 140, 255, 255)  # light purple line on white letters
VIP_BORDER_TIFFANY = (0, 212, 254, 255)  # tiffany line on V
SHEAR = 0.286
S = 1024
CX = CY = 512
R = 490
# Tips must stay in [R-14, R-2] — never outside the ring (avoids cut letters)
TIP_TARGET = R - 10
MAX_WM_W = 720  # safe width so both tips can kiss without clipping

# Type targets (from icon-chrome-build.mdc)
FC_H = 200
DJ_H = 204
# VIP reser/IP: Floq height +20%, then −10% (user); tiffany V = original 2× VIP_X (388)
VIP_TEXT_H = int(round(FC_H * 1.20 * 0.90))  # 216 — baseline for IP
# Nightlife v28: reser −10% again; IP stays upper-line at VIP_TEXT_H
VIP_RESER_H = int(round(VIP_TEXT_H * 0.90))  # ~194
VIP_IP_H = VIP_TEXT_H
# v29: V −7.5% from restored 388
VIP_V = int(round(194 * 2 * 0.925))  # ~359
# Chord must fit the lower arc so reser+V tips can kiss ≈ R-10 (not overhang)
VIP_MAX_W = 720
# Furniture: v28 ×1.20; v29 +10%; v30 +~8%; v31 slight pull-up for raised mark
VIP_FURN_SCALE = 1.20 * 1.10 * 1.05  # ~1.386
VIP_FURN_DOWN = 118
# Thin border line only (1–2px) — no thick neon bloom
VIP_LINE_OUTER = 2
VIP_LINE_INNER = 1
# Wordmark: bias whole mark right when placing (px)
VIP_PLACE_RIGHT = 42
# v31: thinner ring stroke; wordmark raised so over-type clears lower arc
RING_STROKE = 8  # was 14
# Over-type just clears inner ring; "re" stays under the stroke
VIP_TIP_TARGET = R - (RING_STROKE // 2) - 6  # ~ just inside thin ring
VIP_FURN_GAP = 14  # min px between furniture bottom and wordmark top


def git_show(rev: str, path: str, dest: Path) -> None:
    dest.write_bytes(subprocess.check_output(["git", "show", f"{rev}:{path}"]))


def shear_rgba(img, shear, cy, crop=True):
    w, h = img.size
    pad = int(abs(shear) * h) + 8
    canvas = Image.new("RGBA", (w + 2 * pad, h), (0, 0, 0, 0))
    canvas.paste(img, (pad, 0), img)
    out = canvas.transform(
        canvas.size,
        Image.AFFINE,
        (1.0, shear, -shear * cy, 0.0, 1.0, 0.0),
        resample=Image.Resampling.BICUBIC,
    )
    if not crop:
        return out
    bb = out.getbbox()
    return out.crop(bb) if bb else out


def finish(img, by, crop=True):
    img = img.resize(
        (img.size[0], max(1, int(round(img.size[1] * 1.10)))), Image.Resampling.LANCZOS
    )
    return shear_rgba(img, SHEAR, by * 1.10, crop=crop)


def ink_bbox(img, thr=12):
    a = np.array(img)
    ys, xs = np.where(a[:, :, 3] > thr)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def ink_only(a, thr=8):
    a = a.copy()
    bright = (a[:, :, 0] > 25) | (a[:, :, 1] > 25) | (a[:, :, 2] > 25)
    a[~((a[:, :, 3] > thr) & bright)] = (0, 0, 0, 0)
    return a


def render_upright(text, size, fill):
    font = ImageFont.truetype(FONT, int(size))
    bb = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox(
        (0, 0), text, font=font, anchor="ls"
    )
    tw, th = max(1, bb[2] - bb[0]), max(1, bb[3] - bb[1])
    pad = 64
    tmp = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    y0 = pad + th
    ImageDraw.Draw(tmp).text((pad - bb[0], y0), text, font=font, fill=fill, anchor="ls")
    return tmp, float(y0)


def glyph(text, size, fill):
    u, by = render_upright(text, size, fill)
    g = Image.fromarray(ink_only(np.array(finish(u, by))), "RGBA")
    x0, y0, x1, y1 = ink_bbox(g, 10)
    return g.crop((x0, y0, x1 + 1, y1 + 1))


def _dilate_mask(mask: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return mask
    return (
        np.array(
            Image.fromarray((mask.astype(np.uint8) * 255)).filter(
                ImageFilter.MaxFilter(2 * radius + 1)
            )
        )
        > 0
    )


def _erode_mask(mask: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return mask
    return (
        np.array(
            Image.fromarray((mask.astype(np.uint8) * 255)).filter(
                ImageFilter.MinFilter(2 * radius + 1)
            )
        )
        > 0
    )


def thin_border_glyph(fill_img: Image.Image, *, kind: str) -> Image.Image:
    """Thin line border — Tiffany blue + light purple (no thick neon bloom).

    kind=\"white\": white fill + light-purple outline (reser / IP).
    kind=\"cyan\":  tiffany fill + thin tiffany/light-purple outline (V).
    """
    src = fill_img.convert("RGBA")
    a = np.array(src)
    if not (a[:, :, 3] > 20).any():
        return src
    pad = VIP_LINE_OUTER + 3
    canvas = Image.new("RGBA", (src.size[0] + pad * 2, src.size[1] + pad * 2), (0, 0, 0, 0))
    canvas.paste(src, (pad, pad), src)
    ca = np.array(canvas)
    core = ca[:, :, 3] > 20
    dil = _dilate_mask(core, VIP_LINE_OUTER)
    ring = dil & ~core
    out = np.zeros_like(ca)
    if kind == "white":
        out[ring] = VIP_BORDER_PURPLE
        out[core] = WHITE
    else:
        # Tiffany fill; outline mixes tiffany + light purple for the dual theme
        out[ring] = VIP_BORDER_TIFFANY
        # Soften outer edge with a 1px light-purple fringe
        fringe = _dilate_mask(core, VIP_LINE_OUTER + 1) & ~dil
        out[fringe] = VIP_BORDER_PURPLE
        out[core] = TIFFANY
        # Hairline white inner rim
        white_rim = core & ~_erode_mask(core, VIP_LINE_INNER)
        out[white_rim] = WHITE
    g = Image.fromarray(out, "RGBA")
    x0, y0, x1, y1 = ink_bbox(g, 8)
    return g.crop((x0, y0, x1 + 1, y1 + 1))


# ── 1. RING (once) ──────────────────────────────────────────────


def build_ring() -> Image.Image:
    ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    stops = [
        (0.0, (244, 70, 200)),
        (0.2, (160, 80, 255)),
        (0.4, (70, 170, 255)),
        (0.55, (38, 220, 255)),
        (0.75, (120, 130, 255)),
        (0.9, (200, 80, 230)),
        (1.0, (244, 70, 200)),
    ]

    def lerp(a, b, t):
        return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

    def color_at(t):
        t %= 1
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                u = (t - t0) / (t1 - t0)
                u = u * u * (3 - 2 * u)
                return lerp(c0, c1, u)
        return stops[0][1]

    for a0 in range(0, 360):
        rd.arc(
            [CX - R, CY - R, CX + R, CY + R],
            start=a0 - 90,
            end=a0 - 90 + 2,
            fill=(*color_at(a0 / 360), 255),
            width=RING_STROKE,
        )
    bloom = np.array(ring.filter(ImageFilter.GaussianBlur(2.0)))
    bloom[:, :, 3] = (bloom[:, :, 3].astype(np.float32) * 0.28).astype(np.uint8)
    return Image.alpha_composite(Image.fromarray(bloom, "RGBA"), ring)


def ensure_ring() -> Path:
    LAYERS.mkdir(parents=True, exist_ok=True)
    path = LAYERS / "ring-nightlife.png"
    build_ring().save(path, optimize=True)
    print(f"RING → {path}")
    return path


# ── 2. GRAPHIC extract (once per mark, from CLEAN source) ───────


def strip_ring_only(img: Image.Image) -> Image.Image:
    """Remove ring/bloom only — keep interior graphic intact."""
    a = np.array(img.convert("RGBA"))
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    r, g, b, al = [a[:, :, i].astype(np.int16) for i in range(4)]
    sat = (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) > 40
    # Ring annulus only
    a[(dist > 468) & (dist < 512) & sat] = (0, 0, 0, 255)
    # Outside ring → black
    a[dist > 500] = (0, 0, 0, 255)
    return Image.fromarray(a, "RGBA")


def strip_type_band(img: Image.Image, y_min: int, protect_cyan_led=False) -> Image.Image:
    """Clear wordmark ink in lower band ONLY. Never touch upper graphic."""
    a = np.array(img.convert("RGBA"))
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    r, g, b, al = [a[:, :, i].astype(np.int16) for i in range(4)]
    band = (yy >= y_min) & (dist < 500)
    white = (al > 25) & (r > 185) & (g > 185) & (b > 185) & band
    green = (al > 25) & (g > 130) & (r < 190) & (b < 140) & (g > r + 10) & band
    tiffany = (al > 25) & (r < 100) & (g > 150) & (b > 185) & band
    if protect_cyan_led:
        # Only clear tiffany adjacent to white (accent T), not LED cyan
        near = (
            np.array(
                Image.fromarray((white.astype(np.uint8) * 255)).filter(
                    ImageFilter.MaxFilter(25)
                )
            )
            > 0
        )
        tiffany &= near
    mask = white | green | tiffany
    m = Image.fromarray((mask.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(9))
    a[(np.array(m) > 0) & band] = (0, 0, 0, 255)
    return Image.fromarray(a, "RGBA")


def extract_floqcast_graphic() -> Path:
    """Restore LED/phone/signal/arrow from last-good commit; no type, no ring.

    Upper graphic (y < 700) is copied untouched after ring strip — never run
    MaxFilter type wipes into the phone/LED (that ate the silhouette bottom).
    """
    src = LAYERS / "_src-floqcast-good.png"
    git_show(
        "ef50cfe",
        "images/review/actual-icons/floqcast-v4-circle-silhouette.png",
        src,
    )
    g = strip_ring_only(Image.open(src))
    a = np.array(g.convert("RGBA"))
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    r, gch, b, al = [a[:, :, i].astype(np.int16) for i in range(4)]
    # Wordmark only — phones/LED end above this line on ef50cfe
    band = (yy >= 720) & (dist < 498)
    white = (al > 20) & (r > 175) & (gch > 175) & (b > 175) & band
    accent = (al > 20) & (r < 120) & (gch > 140) & (b > 170) & band
    # Tight dilate — do not reach up into the LED
    m = Image.fromarray(((white | accent).astype(np.uint8) * 255)).filter(
        ImageFilter.MaxFilter(5)
    )
    a[(np.array(m) > 0) & band] = (0, 0, 0, 255)
    g = Image.fromarray(a, "RGBA")
    out = LAYERS / "floqcast-graphic.png"
    g.save(out, optimize=True)
    upper = (
        (a[:, :, 3] > 40)
        & (dist < 450)
        & (yy < 700)
        & ((a[:, :, 0] > 30) | (a[:, :, 1] > 30) | (a[:, :, 2] > 30))
    )
    phone = (
        (xx > 120)
        & (xx < 420)
        & (yy > 80)
        & (yy < 620)
        & (dist < 450)
        & ((a[:, :, 0] > 30) | (a[:, :, 1] > 30) | (a[:, :, 2] > 30))
        & (a[:, :, 3] > 40)
    )
    print(
        f"GRAPHIC floqcast → {out} upper_ink={int(upper.sum())} phone_ink={int(phone.sum())}"
    )
    return out


def extract_djbot_graphic() -> Path:
    """DJ set from f92b041 nightlife (raised set, no type)."""
    src = LAYERS / "_src-djbot.png"
    git_show("f92b041", "images/chrome/floqbot-nightlife.png", src)
    g = strip_ring_only(Image.open(src))
    g = strip_type_band(g, y_min=520, protect_cyan_led=False)
    # Kill mid stray tiffany
    a = np.array(g)
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    tiff = (a[:, :, 0] < 100) & (a[:, :, 1] > 150) & (a[:, :, 2] > 180) & (a[:, :, 3] > 20)
    a[tiff & (yy > 500) & (dist < 450)] = (0, 0, 0, 255)
    g = Image.fromarray(a, "RGBA")
    out = LAYERS / "djbot-graphic.png"
    g.save(out, optimize=True)
    print(f"GRAPHIC djbot → {out}")
    return out


def scale_vip_furniture(g: Image.Image, scale: float, down: int) -> Image.Image:
    """Enlarge lounge inside the ring and nudge down — clear of top stroke and wordmark band."""
    a = np.array(g.convert("RGBA"))
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    # Keep only interior content (inside ring)
    content = (
        ((a[:, :, 0] > 18) | (a[:, :, 1] > 18) | (a[:, :, 2] > 18))
        & (a[:, :, 3] > 20)
        & (dist < (R - 18))
    )
    if not content.any():
        return g
    ys, xs = np.where(content)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    crop = g.crop((x0, y0, x1, y1))
    nw = max(1, int(round(crop.size[0] * scale)))
    nh = max(1, int(round(crop.size[1] * scale)))
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    # Center horizontally; vertical: prior center + down nudge, then clamp
    # Top clearance: stay below inner ring (clear of stroke)
    top_clear = CY - (R - 44)
    # Lower furniture toward wordmark; leave band for raised v31 wordmark
    bottom_cap = 708
    cx_f = (x0 + x1) / 2.0
    cy_f = (y0 + y1) / 2.0
    left = int(round(cx_f - nw / 2.0))
    # Prefer the down nudge; clamp so bottom ≤ bottom_cap and top ≥ top_clear
    top = int(round(cy_f - nh / 2.0 + down))
    if top + nh > bottom_cap:
        top = bottom_cap - nh
    if top < top_clear:
        fit_h = bottom_cap - top_clear
        if nh > fit_h and fit_h > 80:
            shrink = fit_h / float(nh)
            nw2 = max(1, int(round(nw * shrink)))
            nh2 = max(1, int(round(nh * shrink)))
            scaled = scaled.resize((nw2, nh2), Image.Resampling.LANCZOS)
            nw, nh = nw2, nh2
            left = int(round(cx_f - nw / 2.0))
        top = max(top_clear, bottom_cap - nh)
    left = max(CX - (R - 28), min(left, CX + (R - 28) - nw))
    out = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    out.alpha_composite(scaled, (left, top))
    oa = np.array(out)
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    oa[dist > (R - 16)] = (0, 0, 0, 255)
    print(
        f"  furniture ×{scale:.2f} down={down} bbox=({left},{top},{left+nw},{top+nh}) "
        f"top_clear={top_clear} bottom_cap={bottom_cap}"
    )
    return Image.fromarray(oa, "RGBA")


def extract_vip_graphic() -> Path:
    """Lounge from f2e712b (+10% baked); v28 ×1.20 + down nudge; no type, no ring."""
    src = LAYERS / "_src-vip.jpg"
    git_show("f2e712b", "images/chrome/vip-nightlife.jpg", src)
    g = strip_ring_only(Image.open(src).convert("RGBA"))
    # Clear type carefully — keep red
    a = np.array(g)
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    r, gch, b, al = [a[:, :, i].astype(np.int16) for i in range(4)]
    band = (yy >= 540) & (dist < 500)
    white = (al > 25) & (r > 185) & (gch > 185) & (b > 185) & band
    tiffany = (al > 25) & (r < 100) & (gch > 150) & (b > 185) & band
    red = (r > 80) & (r > gch + 25) & (r > b + 25)
    mask = (white | tiffany) & ~red
    m = Image.fromarray((mask.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(9))
    a[(np.array(m) > 0) & band] = (0, 0, 0, 255)
    g = Image.fromarray(a, "RGBA")
    g = scale_vip_furniture(g, VIP_FURN_SCALE, VIP_FURN_DOWN)
    out = LAYERS / "vip-graphic.png"
    g.save(out, optimize=True)
    print(f"GRAPHIC vip → {out}")
    return out


# ── 3. TYPE layers ──────────────────────────────────────────────


def fit_width(under, over, body, max_w=MAX_WM_W):
    if body.size[0] <= max_w:
        return under, over, body
    ratio = max_w / body.size[0]
    nw, nh = max_w, max(1, int(round(body.size[1] * ratio)))

    def fix(im):
        im = im.resize((nw, nh), Image.Resampling.LANCZOS)
        a = np.array(im)
        ink = a[:, :, 3] > 15
        a[~ink] = (0, 0, 0, 0)
        w = ink & (a[:, :, 0] > 180) & (a[:, :, 1] > 180) & (a[:, :, 2] > 180)
        t = ink & (a[:, :, 1] > 140) & (a[:, :, 2] > 180) & (a[:, :, 0] < 120)
        a[w, :3] = 255
        a[w, 3] = 255
        a[t, 0] = TIFFANY[0]
        a[t, 1] = TIFFANY[1]
        a[t, 2] = TIFFANY[2]
        a[t, 3] = 255
        return Image.fromarray(a, "RGBA")

    print(f"  fit_width {body.size} → ({nw},{nh})")
    return fix(under), fix(over), fix(body)


def accent_wm(full, before_t, under_text, size, target_h, fit=True):
    """Shared-canvas wordmark: under_text under ring; rest over; final letter = tiffany T.

    Never paint a lone "T" at the string origin — that stamps a ghost T on the first letter.
    T is the shared-canvas remainder after before_t (FloqCAS / djBO).
    """
    for _ in range(8):
        u, by = render_upright(full, size, WHITE)
        size = int(
            max(50, min(280, round(size * target_h / max(1, finish(u, by).size[1]))))
        )
    full_u, by = render_upright(full, size, WHITE)
    font = ImageFont.truetype(FONT, int(size))
    bb = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox(
        (0, 0), full, font=font, anchor="ls"
    )
    pad = 64
    y0 = pad + (bb[3] - bb[1])
    origin = (pad - bb[0], y0)

    def layer(text):
        im = Image.new("RGBA", full_u.size, (0, 0, 0, 0))
        ImageDraw.Draw(im).text(origin, text, font=font, fill=WHITE, anchor="ls")
        return finish(im, by, crop=False)

    full_f = finish(full_u, by, crop=False)
    pre_f = layer(before_t)  # FloqCAS / djBO
    under_f = layer(under_text)  # F / d
    x0, y0b, x1, y1 = ink_bbox(full_f, 12)
    box = (x0, y0b, x1 + 1, y1 + 1)
    fa = np.array(full_f.crop(box))
    pa = np.array(pre_f.crop(box))
    ua = np.array(under_f.crop(box))
    ink = fa[:, :, 3] > 20
    # T = ink present in full but not in before_t (rightmost letter only)
    pre_a = np.array(Image.fromarray(pa[:, :, 3]).filter(ImageFilter.MaxFilter(3)))
    tmask = ink & (pre_a < 10)
    xs = np.where(tmask)[1]
    if len(xs):
        # Drop any stray left-side noise; keep the right-hand T cluster
        tmask[:, : int(np.percentile(xs, 8))] = False
    tmask = (
        np.array(
            Image.fromarray((tmask.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(3))
        )
        > 127
    ) & ink
    # Under = under_text only (F / d)
    umask = np.array(Image.fromarray(ua[:, :, 3]).filter(ImageFilter.MaxFilter(3))) > 25
    umask &= ink & ~tmask
    # Over = loqCAS… + T (everything not under)
    omask = ink & ~umask
    under = np.zeros_like(fa)
    over = np.zeros_like(fa)
    under[umask] = (255, 255, 255, 255)
    over[omask] = (255, 255, 255, 255)
    # T is pure tiffany in OVER only — never leave a white T under it
    over[tmask, 0] = TIFFANY[0]
    over[tmask, 1] = TIFFANY[1]
    over[tmask, 2] = TIFFANY[2]
    over[tmask, 3] = 255
    under[tmask] = (0, 0, 0, 0)  # belt-and-suspenders: no T under the ring
    U = Image.fromarray(ink_only(under), "RGBA")
    O = Image.fromarray(ink_only(over), "RGBA")
    B = Image.alpha_composite(U, O)
    print(
        f"  TYPE '{full}' size={size} {B.size} under={int(umask.sum())} "
        f"over={int(omask.sum())} T={int(tmask.sum())}"
    )
    if fit:
        return fit_width(U, O, B)
    return U, O, B


def floqcast_wm():
    """Floq at FC_H; CAST at +15% point size. Fl under ring; oq+CAST over (T tiffany)."""
    size_f = 170
    for _ in range(8):
        u, by = render_upright("Floq", size_f, WHITE)
        size_f = int(
            max(50, min(280, round(size_f * FC_H / max(1, finish(u, by).size[1]))))
        )
    size_c = int(round(size_f * 1.15))

    # --- Floq: shared-canvas Fl under / oq over (same method as accent_wm) ---
    font_f = ImageFont.truetype(FONT, int(size_f))
    floq_u, by_f = render_upright("Floq", size_f, WHITE)
    pad = 64
    bb = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox(
        (0, 0), "Floq", font=font_f, anchor="ls"
    )
    origin_f = (pad - bb[0], pad + (bb[3] - bb[1]))

    def layer_f(text):
        im = Image.new("RGBA", floq_u.size, (0, 0, 0, 0))
        ImageDraw.Draw(im).text(origin_f, text, font=font_f, fill=WHITE, anchor="ls")
        return finish(im, by_f, crop=False)

    full_f = finish(floq_u, by_f, crop=False)
    fl_f = layer_f("Fl")
    x0, y0b, x1, y1 = ink_bbox(full_f, 12)
    box = (x0, y0b, x1 + 1, y1 + 1)
    fa = np.array(full_f.crop(box))
    fla = np.array(fl_f.crop(box))
    ink = fa[:, :, 3] > 20
    flmask = (
        np.array(Image.fromarray(fla[:, :, 3]).filter(ImageFilter.MaxFilter(5))) > 20
    ) & ink
    floq_under = np.zeros_like(fa)
    floq_over = np.zeros_like(fa)
    floq_under[flmask] = (255, 255, 255, 255)
    floq_over[ink & ~flmask] = (255, 255, 255, 255)
    FU = Image.fromarray(ink_only(floq_under), "RGBA")
    FO = Image.fromarray(ink_only(floq_over), "RGBA")
    floq_body = Image.fromarray(ink_only(fa), "RGBA")
    print(f"  Floq split under={int(flmask.sum())} over={int((ink & ~flmask).sum())}")

    # --- CAST at +15%: CAS white + T fully tiffany (no white fringe) ---
    font_c = ImageFont.truetype(FONT, int(size_c))
    cast_u, by_c = render_upright("CAST", size_c, WHITE)
    bb_c = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox(
        (0, 0), "CAST", font=font_c, anchor="ls"
    )
    origin_c = (pad - bb_c[0], pad + (bb_c[3] - bb_c[1]))

    def layer_c(text, fill=WHITE):
        im = Image.new("RGBA", cast_u.size, (0, 0, 0, 0))
        ImageDraw.Draw(im).text(origin_c, text, font=font_c, fill=fill, anchor="ls")
        return finish(im, by_c, crop=False)

    full_c = finish(cast_u, by_c, crop=False)
    pre_c = layer_c("CAS")
    # T = shared-canvas remainder after CAS (never paint lone "T" at origin — that hits left)
    cx0, cy0, cx1, cy1 = ink_bbox(full_c, 12)
    cbox = (cx0, cy0, cx1 + 1, cy1 + 1)
    ca = np.array(full_c.crop(cbox))
    pa = np.array(pre_c.crop(cbox))
    cink = ca[:, :, 3] > 15
    pre_a = np.array(Image.fromarray(pa[:, :, 3]).filter(ImageFilter.MaxFilter(5)))
    tmask = cink & (pre_a < 8)
    xs = np.where(tmask)[1]
    if len(xs):
        tmask[:, : int(np.percentile(xs, 5))] = False
    # Dilate T mask so antialias fringe is included, then force solid tiffany
    tmask = (
        np.array(
            Image.fromarray((tmask.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(9))
        )
        > 0
    ) & (ca[:, :, 3] > 8)
    cast_over = np.zeros_like(ca)
    cast_over[cink] = (255, 255, 255, 255)
    cast_over[tmask, 0] = TIFFANY[0]
    cast_over[tmask, 1] = TIFFANY[1]
    cast_over[tmask, 2] = TIFFANY[2]
    cast_over[tmask, 3] = 255
    # Kill any remaining near-white pixels inside dilated T (full tiffany cover)
    near_white_t = (
        tmask
        & (cast_over[:, :, 0] > 140)
        & (cast_over[:, :, 1] > 140)
        & (cast_over[:, :, 2] > 140)
    )
    cast_over[near_white_t, 0] = TIFFANY[0]
    cast_over[near_white_t, 1] = TIFFANY[1]
    cast_over[near_white_t, 2] = TIFFANY[2]
    cast_over[near_white_t, 3] = 255
    CAST = Image.fromarray(ink_only(cast_over), "RGBA")
    # Verify: zero white inside T cluster
    _ta = np.array(CAST)
    _tw = (
        (_ta[:, :, 3] > 20)
        & (_ta[:, :, 0] > 200)
        & (_ta[:, :, 1] > 200)
        & (_ta[:, :, 2] > 200)
    )
    _tt = (
        (_ta[:, :, 3] > 20)
        & (_ta[:, :, 0] < 100)
        & (_ta[:, :, 1] > 150)
        & (_ta[:, :, 2] > 180)
    )
    if _tt.any():
        _td = np.array(
            Image.fromarray((_tt.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(7))
        ) > 0
        _ghost = _tw & _td
        if _ghost.any():
            _ta[_ghost, 0] = TIFFANY[0]
            _ta[_ghost, 1] = TIFFANY[1]
            _ta[_ghost, 2] = TIFFANY[2]
            CAST = Image.fromarray(_ta, "RGBA")
            print(f"  CAST T: forced tiffany on {int(_ghost.sum())} fringe px")

    # Baseline-align: Floq ink top→baseline ≈ "Flo" height; CAST sits on that baseline
    flo_cap_h = glyph("Flo", size_f, WHITE).size[1]
    gap = max(2, int(size_f * 0.03))
    W = floq_body.size[0] + gap + CAST.size[0]
    # top padding if CAST caps taller than Floq caps
    cast_above = max(0, CAST.size[1] - flo_cap_h)
    H = cast_above + floq_body.size[1]
    under = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fy = cast_above
    # CAST bottom = Floq baseline = fy + flo_cap_h
    cy = fy + flo_cap_h - CAST.size[1]
    under.alpha_composite(FU, (0, fy + (floq_body.size[1] - FU.size[1])))
    over.alpha_composite(FO, (0, fy + (floq_body.size[1] - FO.size[1])))
    over.alpha_composite(CAST, (floq_body.size[0] + gap, cy))

    body = Image.alpha_composite(under, over)
    box = ink_bbox(body, 10)
    U = Image.fromarray(
        ink_only(np.array(under.crop((box[0], box[1], box[2] + 1, box[3] + 1)))), "RGBA"
    )
    O = Image.fromarray(
        ink_only(np.array(over.crop((box[0], box[1], box[2] + 1, box[3] + 1)))), "RGBA"
    )
    B = Image.alpha_composite(U, O)
    print(
        f"  TYPE FloqCAST Floq={size_f}/{floq_body.size} CAST={size_c}/{CAST.size} "
        f"(+15%) body={B.size} under={int(np.array(U)[:,:,3].sum()>0)}"
    )
    return U, O, B


def _fill_right_edge(img: Image.Image, *, kind: str) -> int:
    """Right edge of fill core (ignore thin border fringe for spacing)."""
    a = np.array(img.convert("RGBA"))
    r, g, b, al = (a[:, :, i].astype(int) for i in range(4))
    if kind == "white":
        core = (al > 40) & (r > 200) & (g > 200) & (b > 200)
    else:
        core = (al > 40) & (r < 100) & (g > 150) & (b > 180)
    if not core.any():
        core = al > 40
    return int(np.where(core)[1].max())


def _fill_left_edge(img: Image.Image, *, kind: str) -> int:
    a = np.array(img.convert("RGBA"))
    r, g, b, al = (a[:, :, i].astype(int) for i in range(4))
    if kind == "white":
        core = (al > 40) & (r > 200) & (g > 200) & (b > 200)
    else:
        core = (al > 40) & (r < 100) & (g > 150) & (b > 180)
    if not core.any():
        core = al > 40
    return int(np.where(core)[1].min())


def _split_reser_under(reser_body: Image.Image, size: int, under_letters: str):
    """Split bordered 'reser' into under (r or re) / over (rest) via shared-canvas mask."""
    # Rebuild upright+shear letter mask at same point size, then map onto bordered body
    u_full, by = render_upright("reser", size, WHITE)
    full = finish(u_full, by, crop=False)
    font = ImageFont.truetype(FONT, int(size))
    bb = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox(
        (0, 0), "reser", font=font, anchor="ls"
    )
    origin = (64 - bb[0], 64 + (bb[3] - bb[1]))

    def layer(text):
        im = Image.new("RGBA", u_full.size, (0, 0, 0, 0))
        ImageDraw.Draw(im).text(origin, text, font=font, fill=WHITE, anchor="ls")
        return finish(im, by, crop=False)

    box = ink_bbox(full, 10)
    fa = np.array(full.crop(box))
    under_f = layer(under_letters)
    ua = np.array(under_f.crop(box))
    ink = fa[:, :, 3] > 20
    umask = (
        np.array(Image.fromarray(ua[:, :, 3]).filter(ImageFilter.MaxFilter(7))) > 20
    ) & ink
    # Map mask onto bordered reser_body (same aspect after ink crop)
    # Scale umask to reser_body size
    mask_img = Image.fromarray((umask.astype(np.uint8) * 255)).resize(
        reser_body.size, Image.Resampling.NEAREST
    )
    um = np.array(mask_img) > 40
    # Dilate slightly so AA/border fringe of under letters stays under
    um = (
        np.array(
            Image.fromarray((um.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(5))
        )
        > 0
    )
    ra = np.array(reser_body.convert("RGBA"))
    rink = ra[:, :, 3] > 20
    um = um & rink
    under = np.zeros_like(ra)
    over = ra.copy()
    under[um] = ra[um]
    over[um] = (0, 0, 0, 0)
    RU = Image.fromarray(under, "RGBA")
    RO = Image.fromarray(over, "RGBA")
    return RU, RO, int(um.sum())


def vip_wm(under_letters: str = "re"):
    """reserVIP — IP top-aligned to V; 're' UNDER ring; rest OVER.

    v31: only 're' under ring; thinner ring; wordmark raised to clear lower arc.
    """
    V = thin_border_glyph(glyph("V", VIP_V, TIFFANY), kind="cyan")
    # reser↔V reference gap; IP tighter so optical gap matches r↔V (IP is smaller/higher)
    SIDE_GAP_R = 16
    SIDE_GAP_IP = 11
    gap_pad = 8
    left_slack = 12

    def build_reser(target_h: int):
        size = 160
        for _ in range(8):
            u, by = render_upright("reser", size, WHITE)
            size = int(
                max(50, min(280, round(size * target_h / max(1, finish(u, by).size[1]))))
            )
        reser_body = thin_border_glyph(glyph("reser", size, WHITE), kind="white")
        RU, RO, n = _split_reser_under(reser_body, size, under_letters)
        return size, RU, RO, reser_body, n

    def build_ip(target_h: int):
        size = 160
        for _ in range(8):
            g = glyph("IP", size, WHITE)
            size = int(max(50, min(280, round(size * target_h / max(1, g.size[1])))))
        return size, thin_border_glyph(glyph("IP", size, WHITE), kind="white")

    reser_h_target = VIP_RESER_H
    ip_h_target = VIP_IP_H
    size = RU = RO = reser_body = remask_n = None
    ip_size = IP = None
    for _ in range(22):
        size, RU, RO, reser_body, remask_n = build_reser(reser_h_target)
        ip_size, IP = build_ip(ip_h_target)
        need = (
            reser_body.size[0]
            + V.size[0]
            + IP.size[0]
            + SIDE_GAP_R
            + SIDE_GAP_IP
            + gap_pad * 2
            + left_slack
        )
        if need <= VIP_MAX_W + 40:
            break
        reser_h_target = max(110, int(reser_h_target * 0.93))
        ip_h_target = max(120, int(ip_h_target * 0.93))
    else:
        print(f"  WARN VIP chord still wide after shrink loop need={need}")

    reser_h = reser_body.size[1]
    H = max(V.size[1], reser_h) + gap_pad * 2
    v_l = _fill_left_edge(V, kind="cyan")
    v_r = _fill_right_edge(V, kind="cyan")
    reser_r = _fill_right_edge(reser_body, kind="white")
    ip_l = _fill_left_edge(IP, kind="white")
    rx = gap_pad + left_slack
    vx = rx + reser_r + SIDE_GAP_R - v_l
    ix = vx + v_r + SIDE_GAP_IP - ip_l
    W = max(
        ix + IP.size[0] + gap_pad,
        vx + V.size[0] + gap_pad,
        rx + reser_body.size[0] + gap_pad,
    )
    under = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vy = gap_pad + (H - gap_pad * 2 - V.size[1])
    iy = vy
    ry = gap_pad + (H - gap_pad * 2 - reser_h)
    under.alpha_composite(RU, (rx, ry))
    over.alpha_composite(RO, (rx, ry))
    over.alpha_composite(V, (vx, vy))
    over.alpha_composite(IP, (ix, iy))
    body = Image.alpha_composite(under, over)
    box = ink_bbox(body, 8)

    def crop_keep(im):
        return im.crop((box[0], box[1], box[2] + 1, box[3] + 1))

    U = crop_keep(under)
    O = crop_keep(over)
    B = Image.alpha_composite(U, O)
    ba = np.array(B)
    ink = ba[:, :, 3] > 20
    white = ink & (ba[:, :, 0] > 200)
    tiffany = ink & (ba[:, :, 0] < 100) & (ba[:, :, 1] > 150) & (ba[:, :, 2] > 180)
    if tiffany.any() and white.any():
        vxs = np.where(tiffany)[1]
        vl, vr = int(vxs.min()), int(vxs.max())
        reser_w = white & (np.arange(ba.shape[1])[None, :] < vl)
        ip_w = white & (np.arange(ba.shape[1])[None, :] > vr)
        g_rv = (vl - int(np.where(reser_w)[1].max())) if reser_w.any() else -1
        g_vi = (int(np.where(ip_w)[1].min()) - vr) if ip_w.any() else -1
    else:
        g_rv = g_vi = -1
    # Fit chord width, then a touch smaller so over-type clears the thin ring
    fit = 1.0
    if B.size[0] > VIP_MAX_W:
        fit = VIP_MAX_W / float(B.size[0])
    fit *= 0.92  # v31: slightly smaller mark → clears lower arc when raised
    if fit < 0.999:
        nw = max(1, int(round(B.size[0] * fit)))
        nh = max(1, int(round(B.size[1] * fit)))
        U = U.resize((nw, nh), Image.Resampling.LANCZOS)
        O = O.resize((nw, nh), Image.Resampling.LANCZOS)
        B = Image.alpha_composite(U, O)
        print(f"  VIP chord-fit ×{fit:.3f} → body={B.size}")
    wa = np.array(B)
    ww = (wa[:, :, 3] > 20) & (wa[:, :, 0] > 200)
    wh_h = int(np.where(ww)[0].max() - np.where(ww)[0].min()) + 1 if ww.any() else 0
    tv = (wa[:, :, 3] > 20) & (wa[:, :, 0] < 100) & (wa[:, :, 1] > 150) & (wa[:, :, 2] > 180)
    vh = int(np.where(tv)[0].max() - np.where(tv)[0].min()) + 1 if tv.any() else 0
    purp = (wa[:, :, 3] > 20) & (wa[:, :, 0] > 140) & (wa[:, :, 2] > 180) & (wa[:, :, 1] < 180)
    print(
        f"  TYPE VIP reser size={size} IP size={ip_size} under='{under_letters}' n={remask_n} "
        f"gap_reser_V={g_rv} gap_V_IP={g_vi} SIDE_GAP_R/IP={SIDE_GAP_R}/{SIDE_GAP_IP} "
        f"white_h={wh_h} V={VIP_V} tiffany_h={vh} purple_line={int(purp.sum())} "
        f"body={B.size} thin-border=tiffany+purple"
    )
    return U, O, B


def place_inside_ring(body, min_top: int, bias=6, max_r=None):
    """Search left+top so edge tips kiss ~R-10. max_r defaults to R-2 (strict)."""
    cap = (R - 2) if max_r is None else float(max_r)
    ba = np.array(body)
    ink = ba[:, :, 3] > 40
    ys, xs = np.where(ink)
    lx, rx = int(xs.min()), int(xs.max())
    ly = int(ys[xs == lx].mean())
    ry = int(ys[xs == rx].mean())
    # Sample edge ink for max-radial check (full mask is slow in the inner loop)
    edge = ink.copy()
    edge[1:-1, 1:-1] = ink[1:-1, 1:-1] & ~(
        ink[:-2, 1:-1] & ink[2:, 1:-1] & ink[1:-1, :-2] & ink[1:-1, 2:]
    )
    ey, ex = np.where(edge)
    center_left = max(8, (S - body.size[0]) // 2 + bias)
    span = max(120, body.size[0] // 4)
    left_lo = max(8, center_left - span)
    left_hi = min(S - body.size[0] - 8, center_left + span)

    def tips(left, t):
        return (
            float(np.hypot(left + lx - CX, t + ly - CY)),
            float(np.hypot(left + rx - CX, t + ry - CY)),
        )

    def max_radial(left, t):
        return float(
            np.sqrt((ex + left - CX) ** 2 + (ey + t - CY) ** 2).max()
        )

    best_left, best_top, score = center_left, min_top, 1e18
    for left in range(left_lo, left_hi + 1, 2):
        for t in range(min_top, S - body.size[1] - 4):
            mr = max_radial(left, t)
            if mr > cap:
                continue
            dl, dr = tips(left, t)
            sc = abs(dl - TIP_TARGET) + abs(dr - TIP_TARGET)
            if min(dl, dr) < (R - 36):
                sc += ((R - 36) - min(dl, dr)) * 1.5
            sc += abs(dl - dr) * 0.35
            # Prefer max radial near tip target (true kiss, not just X-extremes)
            sc += abs(mr - TIP_TARGET) * 0.5
            if sc < score:
                score, best_left, best_top = sc, left, t
    dl, dr = tips(best_left, best_top)
    mr = max_radial(best_left, best_top)
    print(
        f"  place left={best_left} top={best_top} tips=({dl:.1f},{dr:.1f}) "
        f"maxR={mr:.1f} score={score:.1f}"
    )
    assert mr <= (cap + 1), f"ink outside ring: maxR={mr} cap={cap}"
    return best_left, best_top


def paste_type(layer: Image.Image, left: int, top: int) -> Image.Image:
    """Full-canvas type layer — do NOT circular-mask; F/T tips must stay visible."""
    full = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    full.alpha_composite(layer, (left, top))
    return full


def force_tiffany_T(img: Image.Image, left: int, top: int, over: Image.Image) -> Image.Image:
    """Ensure every T ink pixel is solid tiffany — no white fringe/ghost."""
    a = np.array(img.convert("RGBA"))
    ov = np.array(paste_type(over, left, top))
    t_src = (
        (ov[:, :, 3] > 15)
        & (ov[:, :, 0] < 120)
        & (ov[:, :, 1] > 140)
        & (ov[:, :, 2] > 170)
    )
    if not t_src.any():
        return img
    t_dil = (
        np.array(
            Image.fromarray((t_src.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(11))
        )
        > 0
    )
    white = (a[:, :, 0] > 180) & (a[:, :, 1] > 180) & (a[:, :, 2] > 180)
    # Recolor only over-layer T footprint (+ white ghosts on that footprint)
    hit = (t_dil & t_src) | (t_dil & white & (ov[:, :, 3] > 15))
    a[hit, 0] = TIFFANY[0]
    a[hit, 1] = TIFFANY[1]
    a[hit, 2] = TIFFANY[2]
    a[hit, 3] = 255
    print(f"  force_tiffany_T px={int(hit.sum())}")
    return Image.fromarray(a, "RGBA")


def type_protect_mask(under: Image.Image, over: Image.Image, left: int, top: int) -> np.ndarray:
    """Verbiage footprint — slightly dilated so AA edges stay untouched."""
    under_full = np.array(paste_type(under, left, top))
    over_full = np.array(paste_type(over, left, top))
    ink = (under_full[:, :, 3] > 12) | (over_full[:, :, 3] > 12)
    return (
        np.array(
            Image.fromarray((ink.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(5))
        )
        > 0
    )


def ensure_traditional_ring() -> Path:
    """Charcoal/silver ring — same stroke as nightlife, mono chrome colors."""
    dst = LAYERS / "ring-traditional.png"
    nl = Image.open(LAYERS / "ring-nightlife.png").convert("RGBA")
    a = np.array(nl)
    r, g, b = a[:, :, 0].astype(np.float32), a[:, :, 1].astype(np.float32), a[:, :, 2].astype(
        np.float32
    )
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    # Charcoal → silver chrome stroke (readable on black, no neon)
    silver = np.clip(70.0 + lum * 0.70, 48, 230)
    out = a.copy()
    m = a[:, :, 3] > 8
    out[m, 0] = out[m, 1] = out[m, 2] = silver[m].astype(np.uint8)
    Image.fromarray(out, "RGBA").save(dst, optimize=True)
    print(f"RING traditional → {dst}")
    return dst


def traditional_from_nightlife(
    nightlife: Image.Image,
    graphic: Image.Image,
    under: Image.Image,
    over: Image.Image,
    left: int,
    top: int,
) -> Image.Image:
    """Traditional = identical layout/sizes/positions as nightlife; color scheme only.

    Keeps the ring. Recolors phones / signals / silhouette / ring stroke to black–
    charcoal–silver. Verbiage (white + tiffany accents) is untouched.
    """
    ensure_traditional_ring()
    # Layer 0: full-canvas black UNDER everything — never circular-wipe type tips (F/L/T).
    base = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    ga = np.array(graphic.convert("RGBA"))
    gr, gg, gb = ga[:, :, 0].astype(np.float32), ga[:, :, 1].astype(np.float32), ga[
        :, :, 2
    ].astype(np.float32)
    glum = 0.299 * gr + 0.587 * gg + 0.114 * gb
    # Bright neon linework → charcoal/silver; soft fills stay transparent → black shows through
    LINE_MIN = 42.0
    gsilver = np.clip(40.0 + glum * 0.85, 0, 230)
    gout = np.zeros_like(ga)
    line = (glum >= LINE_MIN) & (ga[:, :, 3] > 8)
    gout[line, 0] = gout[line, 1] = gout[line, 2] = gsilver[line].astype(np.uint8)
    gout[line, 3] = 255
    # Layer 1: graphic linework only
    base.alpha_composite(Image.fromarray(gout, "RGBA"), (0, 0))
    # Soft-fill crush on graphic only (before type) — disc interior stays black
    ba = np.array(base)
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    ring = np.array(Image.open(LAYERS / "ring-nightlife.png").convert("RGBA"))[:, :, 3] > 20
    r, gch, bch = ba[:, :, 0].astype(int), ba[:, :, 1].astype(int), ba[:, :, 2].astype(int)
    lum = (0.299 * r + 0.587 * gch + 0.114 * bch).astype(np.float32)
    inside = (dist < (R - 6)) & ~ring
    soft_fill = inside & (lum > 0) & (lum < 58)
    ba[soft_fill, 0] = ba[soft_fill, 1] = ba[soft_fill, 2] = 0
    ba[soft_fill, 3] = 255
    base = Image.fromarray(ba, "RGBA")
    # Layer 2: under type (Fl) — tips may extend outside the ring
    base = Image.alpha_composite(base, paste_type(under, left, top))
    # Layer 3: silver ring
    base = Image.alpha_composite(
        base, Image.open(LAYERS / "ring-traditional.png").convert("RGBA")
    )
    # Layer 4: over type (oqCAST + tiffany T) — tips may extend outside the ring
    base = Image.alpha_composite(base, paste_type(over, left, top))
    out = np.array(base)
    out[:, :, 3] = 255

    # Leftover neon on graphic (never touch type) → charcoal
    protect = type_protect_mask(under, over, left, top)
    r, gch, bch = out[:, :, 0].astype(int), out[:, :, 1].astype(int), out[:, :, 2].astype(int)
    lum = (0.299 * r + 0.587 * gch + 0.114 * bch).astype(np.float32)
    sat = (np.maximum(np.maximum(r, gch), bch) - np.minimum(np.minimum(r, gch), bch)) > 28
    fix = sat & ~protect & ~ring & (lum >= LINE_MIN)
    if fix.any():
        silver = np.clip(40.0 + lum * 0.85, 0, 230).astype(np.uint8)
        out[fix, 0] = out[fix, 1] = out[fix, 2] = silver[fix]

    # Re-stamp type last so F/L/T tips outside the ring cannot be nicked
    stamped = Image.fromarray(out, "RGBA")
    stamped = Image.alpha_composite(stamped, paste_type(under, left, top))
    stamped = Image.alpha_composite(stamped, paste_type(over, left, top))
    out = np.array(stamped)
    # Exact tip parity with nightlife: copy nightlife type ink
    # (white / tiffany / ShoutOut magenta neon border) onto trad
    na = np.array(nightlife.convert("RGBA"))
    nr, ng, nb = na[:, :, 0].astype(int), na[:, :, 1].astype(int), na[:, :, 2].astype(int)
    typeish = (
        ((nr > 200) & (ng > 200) & (nb > 200))
        | ((nr < 120) & (ng > 150) & (nb > 180))
        | ((nr > 140) & (nb > 180) & (ng < 190) & (nb > ng))  # light-purple thin border
    ) & (yy > 650)
    typeish = (
        np.array(
            Image.fromarray((typeish.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(3))
        )
        > 0
    )
    # Only copy nightlife type onto the verbiage footprint — never ring annulus
    # (prevents tiffany/purple nightlife ring leaking into traditional silver stroke)
    typeish = typeish & protect
    out[typeish] = na[typeish]
    out[:, :, 3] = 255

    # Re-stamp traditional silver ring on ring pixels not covered by type
    trad_ring = np.array(Image.open(LAYERS / "ring-traditional.png").convert("RGBA"))
    ring_px = trad_ring[:, :, 3] > 20
    restamp = ring_px & ~protect
    out[restamp] = trad_ring[restamp]
    out[:, :, 3] = 255

    tip_out = typeish & (dist > R)
    tip_ink = tip_out & (
        (out[:, :, 0] > 40) | (out[:, :, 1] > 40) | (out[:, :, 2] > 40)
    )
    # QA: ring annulus should stay near-mono (no neon cyan/magenta leftovers)
    rr, rg, rb = out[:, :, 0].astype(int), out[:, :, 1].astype(int), out[:, :, 2].astype(int)
    ring_sat = ring_px & ~protect & (
        (np.maximum(np.maximum(rr, rg), rb) - np.minimum(np.minimum(rr, rg), rb)) > 40
    )
    print(
        f"  traditional charcoal: line={int(line.sum())} soft→black={int(soft_fill.sum())} "
        f"tips_outside_ring={int(tip_ink.sum())} ring_px={int(ring.sum())} "
        f"ring_restamp={int(restamp.sum())} ring_neon_left={int(ring_sat.sum())}"
    )
    return Image.fromarray(out, "RGBA")


# ── 4. ASSEMBLE ─────────────────────────────────────────────────


def assemble(graphic: Image.Image, under, over, left, top, nightlife=True) -> Image.Image:
    """bg → under (F) → ring → over (loqCAST + tiffany T).

    No circular black wipe on type — that was covering F/T tips outside the ring.
    F stays under the ring at the intersection; full T paints on top of the ring.
    """
    base = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    base.alpha_composite(graphic.convert("RGBA"), (0, 0))
    base = Image.alpha_composite(base, paste_type(under, left, top))
    if nightlife:
        ring = Image.open(LAYERS / "ring-nightlife.png").convert("RGBA")
        base = Image.alpha_composite(base, ring)
    base = Image.alpha_composite(base, paste_type(over, left, top))
    out = np.array(base)
    out[:, :, 3] = 255
    return Image.fromarray(out, "RGBA")


def graphic_bottom(graphic: Image.Image, y_cap=700) -> int:
    a = np.array(graphic)
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    content = (
        ((a[:, :, 0] > 30) | (a[:, :, 1] > 30) | (a[:, :, 2] > 30))
        & (a[:, :, 3] > 40)
        & (dist < 450)
        & (yy < y_cap)
    )
    return int(np.where(content)[0].max()) if content.any() else 560


def place_floqcast_q_kiss(body, min_top: int, bias=4):
    """Drop FloqCAST so the q descender barely kisses the bottom ring (inner edge)."""
    ba = np.array(body)
    ink = ba[:, :, 3] > 40
    ys, xs = np.where(ink)
    # q sits in the left-center of "FloqCAST" — take bottom ink in that x band
    x_lo = int(np.percentile(xs, 20))
    x_hi = int(np.percentile(xs, 45))
    q_band = ink & (np.arange(ba.shape[1])[None, :] >= x_lo) & (
        np.arange(ba.shape[1])[None, :] <= x_hi
    )
    qys, qxs = np.where(q_band)
    if len(qys) == 0:
        qys, qxs = ys, xs
    bot = int(qys.max())
    qx = int(qxs[qys == bot].mean())
    edge = ink.copy()
    edge[1:-1, 1:-1] = ink[1:-1, 1:-1] & ~(
        ink[:-2, 1:-1] & ink[2:, 1:-1] & ink[1:-1, :-2] & ink[1:-1, 2:]
    )
    ey, ex = np.where(edge)
    center_left = max(8, (S - body.size[0]) // 2 + bias)
    # q on bottom arc. Side F/T may cross the stroke (F under / T over);
    # assemble clips past R+6 so nothing draws outside the ring.
    Q_TARGET = R - 4
    best_left, best_top, score = center_left, min_top, 1e18
    for left in range(max(8, center_left - 80), min(S - body.size[0] - 8, center_left + 80) + 1, 2):
        for t in range(min_top, S - body.size[1] - 4):
            qd = float(np.hypot(left + qx - CX, t + bot - CY))
            # Keep q on/just inside the stroke — not past outer edge
            if qd > (R + 4):
                continue
            mr = float(np.sqrt((ex + left - CX) ** 2 + (ey + t - CY) ** 2).max())
            sc = abs(qd - Q_TARGET) * 3.0
            # Mild preference to not fling side tips absurdly far outside
            if mr > (R + 30):
                sc += (mr - (R + 30)) * 0.15
            if sc < score:
                score, best_left, best_top = sc, left, t
    qd = float(np.hypot(best_left + qx - CX, best_top + bot - CY))
    mr = float(
        np.sqrt((ex + best_left - CX) ** 2 + (ey + best_top - CY) ** 2).max()
    )
    print(
        f"  place FloqCAST q-kiss left={best_left} top={best_top} "
        f"q_dist={qd:.1f} maxR={mr:.1f} score={score:.1f}"
    )
    assert score < 1e17, "FloqCAST q-kiss placement failed"
    return best_left, best_top


def build_all():
    LAYERS.mkdir(parents=True, exist_ok=True)
    ensure_ring()
    fc_g = extract_floqcast_graphic()
    dj_g = extract_djbot_graphic()
    vip_g = extract_vip_graphic()

    # FloqCAST
    print("=== assemble FloqCAST ===")
    g = Image.open(fc_g)
    # Floq base size; CAST +15%; Fl under ring; oq + CAST over (T tiffany)
    under, over, body = floqcast_wm()
    left, top = place_floqcast_q_kiss(body, graphic_bottom(g, 700) + 8, bias=4)
    fc = assemble(g, under, over, left, top, nightlife=True)
    fc = force_tiffany_T(fc, left, top, over)
    fc.save(ROOT / "images/review/actual-icons/floqcast-v4-circle-silhouette.png", optimize=True)
    # Site chrome pack (Search + floqr-chrome-scheme ICON_PACK)
    fc.convert("RGB").save(
        ROOT / "images/chrome/floqcast-nightlife.jpg", quality=98, subsampling=0
    )
    yy, xx = np.indices((S, S))
    c = np.where(((xx // 16) + (yy // 16)) % 2 == 0, 50, 28).astype(np.uint8)
    Image.alpha_composite(
        Image.fromarray(np.dstack([c, c, c, np.full_like(c, 255)]), "RGBA"), fc
    ).save(ROOT / "images/review/actual-icons/floqcast-v4-circle-silhouette-preview.png")
    # Traditional = 100% same layers/placement as nightlife, only omit the gradient ring
    trad = traditional_from_nightlife(fc, g, under, over, left, top)
    trad = force_tiffany_T(trad, left, top, over)
    trad.save(ROOT / "images/chrome/floqcast-traditional-green.png", optimize=True)
    trad.convert("RGB").save(
        ROOT / "images/chrome/floqcast-traditional.jpg", quality=98, subsampling=0
    )
    trad.save(ROOT / "images/review/actual-icons/floqcast-traditional.png", optimize=True)
    shutil.copy(
        ROOT / "images/chrome/floqcast-traditional-green.png",
        ROOT / "images/review/actual-icons/floqcast-traditional-green.png",
    )
    fc_top = top

    # djBOT
    print("=== assemble djBOT ===")
    g = Image.open(dj_g)
    under, over, body = accent_wm("djBOT", "djBO", "d", 155, DJ_H)
    # Independent of FloqCAST top (FloqCAST sits lower for q-kiss)
    left, top = place_inside_ring(body, graphic_bottom(g, 650) + 28, bias=8)
    dj = assemble(g, under, over, left, top, nightlife=True)
    dj.save(ROOT / "images/chrome/floqbot-nightlife.png", optimize=True)
    dj.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS).save(
        ROOT / "images/review/floqbot-nightlife-preview.jpg", quality=92
    )
    trad = traditional_from_nightlife(dj, g, under, over, left, top)
    trad.save(ROOT / "images/chrome/floqbot-traditional-green.png", optimize=True)
    # White-T traditional variant (tiffany → white) for legacy pack
    ta = np.array(trad)
    yy, xx = np.indices((S, S))
    tm = (
        (ta[:, :, 0] < 80)
        & (ta[:, :, 1] > 170)
        & (ta[:, :, 2] > 200)
        & (ta[:, :, 3] > 40)
        & (yy > top - 5)
    )
    ta[tm, :3] = 255
    Image.fromarray(ta, "RGBA").save(
        ROOT / "images/chrome/floqbot-traditional.png", optimize=True
    )
    # GIF platter restamp
    git_show("eb8693d", "images/chrome/floqbot-nightlife-spin.gif", LAYERS / "_spin.gif")
    still = np.array(dj.convert("RGBA"))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    set_bottom = graphic_bottom(g, 650)
    bright = (
        ((still[:, :, 0] > 50) | (still[:, :, 1] > 50) | (still[:, :, 2] > 70))
        & (yy < set_bottom)
        & (xx > 500)
        & (dist < 450)
    )
    pcx = int(np.where(bright)[1].mean()) if bright.any() else 700
    pcy = int(np.where(bright)[0].mean()) if bright.any() else 320
    ocx, ocy, pr = 680, 480, 140
    dx_m, dy_m = pcx - ocx, pcy - ocy
    platter = ((xx - pcx) ** 2 + (yy - pcy) ** 2) < pr**2
    gif = Image.open(LAYERS / "_spin.gif")
    durs, frames = [], []
    gif.seek(0)
    f0 = np.array(gif.convert("RGBA"))
    for i in range(gif.n_frames):
        gif.seek(i)
        fa = np.array(gif.convert("RGBA"))
        durs.append(gif.info.get("duration", 40))
        fr = still.copy()
        src_pl = ((xx - ocx) ** 2 + (yy - ocy) ** 2) < (pr + 25) ** 2
        motion = src_pl & (np.abs(fa.astype(int) - f0.astype(int)).sum(axis=2) > 25)
        ys, xs_ = np.where(motion)
        yd, xd = ys + dy_m, xs_ + dx_m
        ok = (yd >= 0) & (yd < S) & (xd >= 0) & (xd < S) & platter[yd, xd]
        fr[yd[ok], xd[ok]] = fa[ys[ok], xs_[ok]]
        frames.append(Image.fromarray(fr, "RGBA"))
    gif.close()
    dst = ROOT / "images/chrome/floqbot-nightlife-spin.gif"
    frames[0].save(
        dst, save_all=True, append_images=frames[1:], duration=durs, loop=0, disposal=2
    )
    small = [f.resize((512, 512), Image.Resampling.LANCZOS) for f in frames]
    small[0].save(
        ROOT / "images/review/floqbot-nightlife-spin-512.gif",
        save_all=True,
        append_images=small[1:],
        duration=durs,
        loop=0,
        disposal=2,
    )
    shutil.copy(dst, ROOT / "images/review/floqbot-nightlife-spin.gif")
    dj_top = top

    # VIP
    print("=== assemble VIP ===")
    g = Image.open(vip_g)
    under, over, body = vip_wm()
    # v28: IP upper / reser lower; reser+V bottoms barely kiss lower arc (≈ R-10).
    # Do NOT run place_inside_ring shrink loop — that crushed reser/IP.
    furn_bottom = graphic_bottom(g, 640)
    vip_min = furn_bottom + 14  # gap so furniture never touches V/IP
    left = max(4, (S - body.size[0]) // 2)
    top = min(max(vip_min, S - body.size[1] - 40), S - body.size[1] - 4)
    ba = np.array(body)
    ink = ba[:, :, 3] > 40
    ys, xs = np.where(ink)
    # Bottom tips of reser (left) and V (center) should kiss ≈ R-10
    x_med = int(np.median(xs)) if len(xs) else body.size[0] // 2
    left_band = ink & (np.arange(ba.shape[1])[None, :] < x_med)
    v_band = ink & (np.arange(ba.shape[1])[None, :] >= x_med)
    def bottom_tip(band):
        bys, bxs = np.where(band)
        if not len(bys):
            return int(ys.max()), int(xs[ys == ys.max()].mean())
        bot = int(bys.max())
        return bot, int(bxs[bys == bot].mean())
    reser_bot, reser_bx = bottom_tip(left_band)
    v_bot, v_bx = bottom_tip(v_band)
    best_t, best_sc = top, 1e18
    for t in range(top, S - body.size[1] - 2, 1):
        rd_r = float(np.hypot(left + reser_bx - CX, t + reser_bot - CY))
        rd_v = float(np.hypot(left + v_bx - CX, t + v_bot - CY))
        # Prefer both tips just inside the stroke; reject far outside
        if max(rd_r, rd_v) > (R + 6):
            continue
        sc = abs(rd_r - TIP_TARGET) + abs(rd_v - TIP_TARGET)
        if sc < best_sc:
            best_sc, best_t = sc, t
    top = best_t
    print(
        f"  place VIP left={left} top={top} body={body.size} furn_bottom={furn_bottom} "
        f"kiss_score={best_sc:.1f} reser_bot={reser_bot} v_bot={v_bot}"
    )
    vip = assemble(g, under, over, left, top, nightlife=True)
    vip.convert("RGB").save(
        ROOT / "images/chrome/vip-nightlife.jpg", quality=98, subsampling=0
    )
    vip.save(ROOT / "images/review/actual-icons/vip-reserv-actual.png", optimize=True)
    trad = traditional_from_nightlife(vip, g, under, over, left, top)
    trad.convert("RGB").save(
        ROOT / "images/chrome/vip-traditional.jpg", quality=98, subsampling=0
    )

    # QA strip — VIP nightlife (reser +20%, re under) + FloqCAST ref
    panel = Image.new("RGB", (900, 400), (0, 0, 0))
    d = ImageDraw.Draw(panel)
    panel.paste(
        Image.open(ROOT / "images/chrome/vip-nightlife.jpg").convert("RGB").resize((360, 360)),
        (40, 30),
    )
    panel.paste(
        Image.open(ROOT / "images/review/actual-icons/floqcast-v4-circle-silhouette.png")
        .convert("RGB")
        .resize((360, 360)),
        (480, 30),
    )
    d.text((40, 8), "VIP v28: IP upper / reser−10% lower / furn×1.20", fill=(180, 180, 180))
    d.text((480, 8), "FloqCAST nightlife (type ref)", fill=(180, 180, 180))
    panel.save("/opt/cursor/artifacts/qa-modular-chrome.png")
    panel.save("/opt/cursor/artifacts/vip-vs-floqcast-type.png")
    panel.save("/opt/cursor/artifacts/vip-nightlife-v28.png")

    # Verify VIP tips inside
    a = np.array(vip.convert("RGB"))
    r, gch, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    white = (r > 210) & (gch > 210) & (b > 210) & (yy > 550)
    out = white & (dist > 490)
    print(f"VERIFY VIP white outside R: {int(out.sum())}")
    # FloqCAST upper ink
    a = np.array(fc)
    upper = (
        (a[:, :, 3] > 40)
        & (dist < 450)
        & (yy < 650)
        & ((a[:, :, 0] > 30) | (a[:, :, 1] > 30) | (a[:, :, 2] > 30))
    )
    print(f"VERIFY FloqCAST upper_ink={int(upper.sum())}")
    print("DONE — layers in", LAYERS)


def _place_vip_wordmark(body, furn_bottom: int, over: Image.Image | None = None):
    """Raise mark so over-type clears lower ring; bias right (VIP_PLACE_RIGHT).

    Tips are measured on the OVER layer only (ser + V + IP) so under-layer
    're' may still sit in the ring stroke. Furniture gap ≥ VIP_FURN_GAP.
    """
    vip_min = furn_bottom + VIP_FURN_GAP
    left0 = max(4, (S - body.size[0]) // 2 + VIP_PLACE_RIGHT)
    # Measure from over layer (excludes under 're')
    src = over if over is not None else body
    ba = np.array(src)
    # Align over crop to body bbox if sizes match after vip_wm crop
    if over is not None and over.size != body.size:
        ba = np.array(body)  # fallback
    ink = ba[:, :, 3] > 40
    ys, xs = np.where(ink)
    if not len(ys):
        return left0, vip_min, -1.0, vip_min
    r, g, b, al = (ba[:, :, i].astype(int) for i in range(4))
    tiffany = ink & (r < 100) & (g > 150) & (b > 180)
    white = ink & (r > 200) & (g > 200) & (b > 200)
    if tiffany.any():
        v_band = tiffany
        vl = int(np.where(tiffany)[1].min())
        over_left = white & (np.arange(ba.shape[1])[None, :] < vl)
    else:
        x_med = int(np.median(xs))
        v_band = ink & (np.arange(ba.shape[1])[None, :] >= x_med)
        over_left = white & (np.arange(ba.shape[1])[None, :] < x_med)

    def bottom_tip(band):
        bys, bxs = np.where(band)
        if not len(bys):
            return int(ys.max()), int(xs[ys == ys.max()].mean())
        bot = int(bys.max())
        return bot, int(bxs[bys == bot].mean())

    v_bot, v_bx = bottom_tip(v_band)
    ol_bot, ol_bx = bottom_tip(over_left) if over_left.any() else (v_bot, v_bx)
    # Also track IP / right white tip
    if tiffany.any():
        vr = int(np.where(tiffany)[1].max())
        over_right = white & (np.arange(ba.shape[1])[None, :] > vr)
    else:
        over_right = np.zeros_like(ink)
    or_bot, or_bx = bottom_tip(over_right) if over_right.any() else (v_bot, v_bx)

    best_t, best_left, best_sc = vip_min, left0, 1e18
    ring_inner = R - (RING_STROKE / 2.0) - 3.0
    # Sample over-edge ink for a real max-radial check (catches IP / V sides)
    edge = ink.copy()
    edge[1:-1, 1:-1] = ink[1:-1, 1:-1] & ~(
        ink[:-2, 1:-1] & ink[2:, 1:-1] & ink[1:-1, :-2] & ink[1:-1, 2:]
    )
    ey, ex = np.where(edge)
    if not len(ey):
        ey, ex = ys, xs

    def max_radial(L, t):
        return float(np.sqrt((ex + L - CX) ** 2 + (ey + t - CY) ** 2).max())

    for L in range(max(4, left0 - 48), min(S - body.size[0] - 4, left0 + 96) + 1, 2):
        max_t = S - body.size[1] - 2
        for t in range(vip_min, max_t + 1, 1):
            mr = max_radial(L, t)
            # Hard: over footprint must clear the stroke (sit inside the disc)
            if mr > ring_inner + 1.5:
                continue
            rd_v = float(np.hypot(L + v_bx - CX, t + v_bot - CY))
            rd_ol = float(np.hypot(L + ol_bx - CX, t + ol_bot - CY))
            rd_or = float(np.hypot(L + or_bx - CX, t + or_bot - CY))
            # Prefer tips just clearing the inner edge (slight raise — not deep inside)
            sc = (
                abs(rd_v - VIP_TIP_TARGET) * 2.0
                + abs(rd_ol - VIP_TIP_TARGET) * 1.0
                + abs(rd_or - VIP_TIP_TARGET) * 0.8
                + abs(mr - ring_inner) * 1.5
            )
            sc -= (L - left0) * 0.02
            if sc < best_sc:
                best_sc, best_t, best_left = sc, t, L
    if best_sc >= 1e17:
        best_left, best_t, best_sc = left0, vip_min, -1.0
    return best_left, best_t, best_sc, vip_min


def shiny_chrome_tone(
    lum: np.ndarray, yy: np.ndarray, xx: np.ndarray, *, for_type: bool = False
) -> np.ndarray:
    """Silverish / chromy shiny-black tone map (0–255 grey)."""
    ang = np.arctan2(yy.astype(np.float32) - CY, xx.astype(np.float32) - CX)
    # Soft highlight along upper-left → lower-right (chrome sheen)
    sheen = (np.cos(ang - 0.7) * 0.5 + 0.5) ** 2.4
    if for_type:
        # Darker chrome-black body; silver only on specular edge
        base = np.clip(12.0 + lum * 0.10, 10, 36)
        hi = np.clip(base + sheen * 95.0 + (lum / 255.0) * 18.0, 12, 155)
    else:
        base = np.clip(18.0 + lum * 0.22, 14, 55)
        hi = np.clip(base + sheen * 130.0 + (lum / 255.0) * 35.0, 16, 200)
    return hi.astype(np.float32)


def to_white_black(
    src: Path,
    dst: Path,
    *,
    keep_tiffany_v: bool = False,
    tip_preserve: bool = False,
    ring_stroke: int = 5,
) -> None:
    """Light theme: white field + shiny chrome-black fonts/borders/ring.

    tip_preserve: FloqCAST-style — never white-halo the ring over Fl/T tips;
    stamp outside-ring type last so tips stay visible on white.
    """
    im = Image.open(src).convert("RGBA")
    a = np.array(im)
    r, g, b, al = [a[:, :, i].astype(np.float32) for i in range(4)]
    yy, xx = np.indices(a.shape[:2])
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    near_black = (lum < 28) & (al > 8)
    white = (r > 200) & (g > 200) & (b > 200) & (al > 20)
    # Broad cyan / tiffany (fill + glow / AA)
    tiffany = (b > 150) & (g > 120) & (b > r + 40) & (g > r + 20) & (al > 15)
    magenta = (r > 140) & (b > 140) & (g < 140) & (al > 20)
    sat = (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) > 40
    neon = sat & (al > 20) & ~tiffany
    purple_border = (r > 140) & (b > 180) & (g < 190) & (b > g) & (al > 20)
    # Type ink anywhere in lower band (incl. tips outside the ring)
    grey_type = (
        (al > 20)
        & (yy > 520)
        & (np.abs(r - g) < 28)
        & (np.abs(g - b) < 28)
        & (lum > 60)
        & (lum < 230)
    )

    out = np.zeros_like(a)
    out[:, :, 0] = out[:, :, 1] = out[:, :, 2] = 255
    out[:, :, 3] = 255

    chrome = shiny_chrome_tone(lum, yy, xx)

    # Font mask first (tips included) — drives wipe + stamp order
    font_mask = white | purple_border | magenta | grey_type | (neon & (yy > 520)) | tiffany
    font_mask = (
        np.array(
            Image.fromarray((font_mask.astype(np.uint8) * 255)).filter(
                ImageFilter.MaxFilter(5 if tip_preserve else 3)
            )
        )
        > 0
    )
    font_chrome = shiny_chrome_tone(np.maximum(lum, 120), yy, xx, for_type=True)

    # Graphic linework inside disc → chrome black (furniture / marks)
    graphic = (al > 20) & ~near_black & ~white & ~tiffany & (dist < (R - 6)) & ~font_mask
    for c in range(3):
        out[:, :, c] = np.where(graphic, chrome, out[:, :, c])

    # Type under the ring (full glyph first)
    for c in range(3):
        out[:, :, c] = np.where(font_mask, font_chrome, out[:, :, c])
    if keep_tiffany_v:
        cool = np.clip(font_chrome * 0.90, 14, 160)
        out[:, :, 0] = np.where(tiffany, cool * 0.50, out[:, :, 0])
        out[:, :, 1] = np.where(tiffany, np.clip(cool * 0.70 + 22, 16, 140), out[:, :, 1])
        out[:, :, 2] = np.where(tiffany, np.clip(cool * 0.80 + 32, 18, 150), out[:, :, 2])

    # Smaller shiny chrome-black ring — no white AA halo
    wb_stroke = max(2, int(ring_stroke))
    wb_half = wb_stroke / 2.0
    ring_mask = (np.abs(dist - R) <= wb_half) & (dist > 0)
    ring_chrome = shiny_chrome_tone(np.full_like(lum, 160.0), yy, xx)
    ring_chrome = np.clip(ring_chrome * 1.30 + 22, 24, 190)
    # Soft dark AA only (never blend toward white — that erased Fl/T)
    ring_aa = (np.abs(dist - R) <= (wb_half + 0.7)) & ~ring_mask
    for c in range(3):
        out[:, :, c] = np.where(ring_mask, ring_chrome, out[:, :, c])
        out[:, :, c] = np.where(
            ring_aa & ~font_mask, np.clip(ring_chrome * 0.65, 20, 160), out[:, :, c]
        )

    # Outside ring → pure white, but NEVER wipe type tips
    outside = dist > (R + wb_half + 0.5)
    wipe = outside & ~font_mask
    out[wipe] = (255, 255, 255, 255)

    # Tips outside / grazing the outer edge — stamp last over white + ring AA
    tips = font_mask & (dist >= (R - wb_half * 0.25))
    if tip_preserve:
        # All tip/over type above the ring AA; solid ring still covers true under-ink
        over_type = font_mask & ~ring_mask
        for c in range(3):
            out[:, :, c] = np.where(over_type, font_chrome, out[:, :, c])
        # Re-apply solid ring so Fl under-chord stays tucked
        for c in range(3):
            out[:, :, c] = np.where(ring_mask, ring_chrome, out[:, :, c])
        # Final tip pass: anything outside the solid stroke always wins
        tip_out = font_mask & (dist > (R + wb_half))
        for c in range(3):
            out[:, :, c] = np.where(tip_out, font_chrome, out[:, :, c])
        if keep_tiffany_v:
            cool = np.clip(font_chrome * 0.90, 14, 160)
            out[:, :, 0] = np.where(tiffany & tip_out, cool * 0.50, out[:, :, 0])
            out[:, :, 1] = np.where(
                tiffany & tip_out, np.clip(cool * 0.70 + 22, 16, 140), out[:, :, 1]
            )
            out[:, :, 2] = np.where(
                tiffany & tip_out, np.clip(cool * 0.80 + 32, 18, 150), out[:, :, 2]
            )
    else:
        for c in range(3):
            out[:, :, c] = np.where(tips, font_chrome, out[:, :, c])
        if keep_tiffany_v:
            cool = np.clip(font_chrome * 0.90, 14, 160)
            out[:, :, 0] = np.where(tiffany & tips, cool * 0.50, out[:, :, 0])
            out[:, :, 1] = np.where(
                tiffany & tips, np.clip(cool * 0.70 + 22, 16, 140), out[:, :, 1]
            )
            out[:, :, 2] = np.where(
                tiffany & tips, np.clip(cool * 0.80 + 32, 18, 150), out[:, :, 2]
            )

    Image.fromarray(out.astype(np.uint8), "RGBA").convert("RGB").save(
        dst, quality=96, subsampling=0
    )
    print(f"  whiteBlack chrome → {dst.name} tip_preserve={tip_preserve} ring={wb_stroke}px")


def build_floqcast_whiteblack() -> Path:
    """FloqCAST White/Black from layers — Fl/T tips never wiped by white outside ring.

    Order: white bg → chrome graphic → under type (Fl) → thin shiny black ring → over type (oqCAST+T).
    """
    LAYERS.mkdir(parents=True, exist_ok=True)
    ensure_ring()
    g = Image.open(extract_floqcast_graphic())
    under, over, body = floqcast_wm()
    left, top = place_floqcast_q_kiss(body, graphic_bottom(g, 700) + 8, bias=4)
    print(f"  FloqCAST WB place left={left} top={top} body={body.size}")

    wb_stroke = 3  # small shiny-black ring
    wb_half = wb_stroke / 2.0
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    # Darker chrome-black type for white field contrast
    font_chrome = shiny_chrome_tone(np.full((S, S), 160.0, np.float32), yy, xx, for_type=True)
    font_chrome = np.clip(font_chrome * 0.72, 10, 110)

    base = Image.new("RGBA", (S, S), (255, 255, 255, 255))

    # Graphic → chrome linework on white
    ga = np.array(g.convert("RGBA"))
    gr, gg, gb, gal = (ga[:, :, i].astype(np.float32) for i in range(4))
    glum = 0.299 * gr + 0.587 * gg + 0.114 * gb
    chrome = shiny_chrome_tone(glum, yy, xx)
    gout = np.zeros_like(ga)
    line = (glum >= 30) & (gal > 8) & (dist < (R - 4))
    gout[line, 0] = gout[line, 1] = gout[line, 2] = chrome[line]
    gout[line, 3] = 255
    base.alpha_composite(Image.fromarray(gout, "RGBA"))

    def type_layer(im: Image.Image) -> Image.Image:
        a = np.array(paste_type(im, left, top))
        ink = a[:, :, 3] > 20
        out = np.zeros_like(a)
        for c in range(3):
            out[:, :, c] = np.where(ink, font_chrome, 0)
        out[:, :, 3] = np.where(ink, 255, 0)
        return Image.fromarray(out, "RGBA")

    # Under (Fl) → thin shiny-black ring → over (oqCAST + T)
    base.alpha_composite(type_layer(under))
    # Shiny black ring: dark body + silver specular (not light grey)
    ring_chrome = shiny_chrome_tone(np.full((S, S), 200.0, np.float32), yy, xx)
    ring_chrome = np.clip(12.0 + ring_chrome * 0.35, 14, 95)
    ra = np.zeros((S, S, 4), np.uint8)
    ring_mask = np.abs(dist - R) <= wb_half
    for c in range(3):
        ra[:, :, c] = np.where(ring_mask, ring_chrome, 0).astype(np.uint8)
    ra[:, :, 3] = np.where(ring_mask, 255, 0).astype(np.uint8)
    base.alpha_composite(Image.fromarray(ra, "RGBA"))
    base.alpha_composite(type_layer(over))

    out = np.array(base)
    out[:, :, 3] = 255
    # Outside white — but keep any type ink that extends past the ring (Fl / T tips)
    type_ink = (np.array(type_layer(under))[:, :, 3] > 20) | (
        np.array(type_layer(over))[:, :, 3] > 20
    )
    outside = dist > (R + wb_half + 0.5)
    out[outside & ~type_ink, :3] = 255
    # Final tip stamp over white field
    tips = type_ink & (dist > (R + wb_half))
    for c in range(3):
        out[:, :, c] = np.where(tips, font_chrome, out[:, :, c])

    dst = ROOT / "images/chrome/floqcast-whiteblack.jpg"
    Image.fromarray(out, "RGBA").convert("RGB").save(dst, quality=96, subsampling=0)
    preview = Image.fromarray(out, "RGBA").convert("RGB").resize((640, 640), Image.Resampling.LANCZOS)
    preview.save("/opt/cursor/artifacts/floqcast-wb-full-fixed.png", quality=95)
    Image.fromarray(out, "RGBA").convert("RGB").crop((0, 600, 360, 1024)).resize(
        (360, 424), Image.Resampling.LANCZOS
    ).save("/opt/cursor/artifacts/floqcast-wb-fl-fixed.png", quality=95)
    Image.fromarray(out, "RGBA").convert("RGB").crop((660, 600, 1024, 1024)).resize(
        (364, 424), Image.Resampling.LANCZOS
    ).save("/opt/cursor/artifacts/floqcast-wb-t-fixed.png", quality=95)
    print(
        f"  FloqCAST WB tips outside={int(tips.sum())} ring={wb_stroke}px → {dst.name}"
    )
    return dst


def recolor_vip_ring(src: Path, dst: Path, mode: str) -> None:
    """Theme VIP ring only (blackTiffany / blackDarkGreen)."""
    im = Image.open(src).convert("RGBA")
    a = np.array(im)
    r, g, b, al = [a[:, :, i].astype(np.float32) for i in range(4)]
    yy, xx = np.indices(a.shape[:2])
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    half = RING_STROKE // 2 + 3
    ring = (al > 20) & (dist >= (R - half - 4)) & (dist <= (R + half + 2))
    out = a.copy()
    ang = (np.arctan2(yy - CY, xx - CX) + np.pi) / (2 * np.pi)
    if mode == "tiffany":
        tr = 0 * (1 - ang) + 196 * ang
        tg = 212 * (1 - ang) + 140 * ang
        tb = 254 * (1 - ang) + 255 * ang
        out[ring, 0], out[ring, 1], out[ring, 2] = tr[ring], tg[ring], tb[ring]
    elif mode == "forest":
        tr = 20 * (1 - ang) + 34 * ang
        tg = 60 * (1 - ang) + 139 * ang
        tb = 30 * (1 - ang) + 34 * ang
        out[ring, 0], out[ring, 1], out[ring, 2] = tr[ring], tg[ring], tb[ring]
    Image.fromarray(out.astype(np.uint8), "RGBA").convert("RGB").save(
        dst, quality=96, subsampling=0
    )
    print(f"  VIP ring {mode} → {dst.name}")


def export_theme_vip_packs() -> None:
    """Derive Black Tiffany / Black Dark Green / White-Black from nightlife+traditional."""
    out = ROOT / "images/chrome"
    nl = out / "vip-nightlife.jpg"
    trad = out / "vip-traditional.jpg"
    recolor_vip_ring(nl, out / "vip-blacktiffany.jpg", "tiffany")
    recolor_vip_ring(nl, out / "vip-blackdarkgreen.jpg", "forest")
    # Full whiteblack pack — fonts + borders use shiny chrome black
    # FloqCAST WB from layers (preserves Fl/T tips) — not flat JPG convert
    build_floqcast_whiteblack()
    pairs = [
        ("vip-traditional.jpg", "vip-whiteblack.jpg", False, False, 5),
        ("shoutout-traditional-green.png", "shoutout-whiteblack.png", False, False, 5),
        ("floqai-traditional.jpg", "floqai-whiteblack.jpg", False, False, 5),
        ("bartr-traditional.jpg", "bartr-whiteblack.jpg", False, False, 5),
        ("rydr-traditional.jpg", "rydr-whiteblack.jpg", False, False, 5),
    ]
    for src_name, dst_name, keep_t, tip_p, stroke in pairs:
        src = out / src_name
        if not src.exists():
            print(f"  SKIP missing {src_name}")
            continue
        to_white_black(
            src,
            out / dst_name,
            keep_tiffany_v=keep_t,
            tip_preserve=tip_p,
            ring_stroke=stroke,
        )


def build_vip_only():
    """Rebuild VIP nightlife + traditional + theme variants."""
    LAYERS.mkdir(parents=True, exist_ok=True)
    ensure_ring()
    ensure_traditional_ring()
    vip_g = extract_vip_graphic()
    print("=== assemble VIP v31 (thin ring, re under, raised mark) ===")
    g = Image.open(vip_g)
    under_letters = "re"  # only "re" under the ring
    under, over, body = vip_wm(under_letters=under_letters)
    furn_bottom = graphic_bottom(g, 720)
    left, top, best_sc, vip_min = _place_vip_wordmark(body, furn_bottom, over=over)
    print(
        f"  place VIP left={left} top={top} body={body.size} furn_bottom={furn_bottom} "
        f"kiss_score={best_sc:.1f} gap={top - furn_bottom} under={under_letters} "
        f"ring_stroke={RING_STROKE} tip_target={VIP_TIP_TARGET}"
    )
    if top - furn_bottom < VIP_FURN_GAP:
        print(f"  WARN furniture/type gap {top - furn_bottom} < {VIP_FURN_GAP}")
    vip = assemble(g, under, over, left, top, nightlife=True)
    vip.convert("RGB").save(
        ROOT / "images/chrome/vip-nightlife.jpg", quality=98, subsampling=0
    )
    (ROOT / "images/review/actual-icons").mkdir(parents=True, exist_ok=True)
    vip.save(ROOT / "images/review/actual-icons/vip-reserv-actual.png", optimize=True)
    trad = traditional_from_nightlife(vip, g, under, over, left, top)
    trad.convert("RGB").save(
        ROOT / "images/chrome/vip-traditional.jpg", quality=98, subsampling=0
    )
    export_theme_vip_packs()
    preview = vip.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
    preview.save("/opt/cursor/artifacts/vip-nightlife-v31.png", quality=95)
    trad.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS).save(
        "/opt/cursor/artifacts/vip-traditional-v31.png", quality=95
    )
    Image.open(ROOT / "images/chrome/vip-whiteblack.jpg").resize(
        (512, 512), Image.Resampling.LANCZOS
    ).save("/opt/cursor/artifacts/vip-white-black-v31.png", quality=95)
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    a = np.array(vip.convert("RGB"))
    r, gch, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    white = (r > 210) & (gch > 210) & (b > 210) & (yy > 550)
    print(f"VERIFY VIP white outside R: {int((white & (dist > 490)).sum())}")
    ua = np.array(paste_type(under, left, top))
    half = RING_STROKE // 2 + 2
    under_on_ring = (ua[:, :, 3] > 40) & (dist > (R - half - 2)) & (dist < (R + half + 2))
    print(f"VERIFY under-ring ink px={int(under_on_ring.sum())}")
    # Over tips should mostly clear the ring annulus
    oa = np.array(paste_type(over, left, top))
    over_on_ring = (oa[:, :, 3] > 40) & (dist > (R - half)) & (dist < (R + half))
    print(f"VERIFY over-on-ring ink px={int(over_on_ring.sum())} (lower is better)")
    print("DONE VIP-only —", ROOT / "images/chrome/vip-nightlife.jpg")


# BOT DEE: ShoutOut-scale stacked mark (BOT white / DEE tiffany), thin borders.
# Letter height ≥ SHOUT (~198); stacked footprint fills lower chord like ShoutOut.
BOTDEE_TEXT = 268  # ShoutOut-weight stack (SHOUT≈198 / OUT≈157 → block ~380+)
BOTDEE_BOT_SCALE = 1.30  # vs prior streetBOT left-bot bbox (~311×399)
BOTDEE_MAX_W = 600
BOTDEE_MAX_H = 440
# Nudge headphones-bot down from top stroke (px after ×1.30 place)
BOTDEE_BOT_DOWN = 26
# Nudge "BOT" wordmark line down toward DEE (px at render size; survives crop)
BOTDEE_TYPE_BOT_DOWN = 22
# Stagger: BOT left, DEE right (px at render size) — make offset obvious
BOTDEE_BOT_X = -48
BOTDEE_DEE_X = 48


def _strip_botdee_signal_tray(img: Image.Image) -> Image.Image:
    """Remove equalizer / signal bars under the eyes (cyan U-tray + bars)."""
    a = np.array(img.convert("RGBA"))
    yy, xx = np.indices(a.shape[:2])
    r, gc, b, al = (
        a[:, :, 0].astype(int),
        a[:, :, 1].astype(int),
        a[:, :, 2].astype(int),
        a[:, :, 3],
    )
    ink = ((r > 25) | (gc > 25) | (b > 25)) & (al > 20)
    if not ink.any():
        return img
    ys, xs = np.where(ink)
    bx0, bx1 = int(xs.min()), int(xs.max())
    by0, by1 = int(ys.min()), int(ys.max())
    cx = (bx0 + bx1) // 2
    # Eyes = cyan disks in the center band (not side headphone cups)
    eye = (
        (r < 100)
        & (gc > 140)
        & (b > 180)
        & (al > 40)
        & (np.abs(xx - cx) < 90)
        & (yy > by0 + 40)
        & (yy < by0 + int((by1 - by0) * 0.55))
    )
    if not eye.any():
        print("  WARN botdee: eyes not found — signal tray left intact")
        return img
    eye_bottom = int(np.where(eye)[0].max())
    # Wipe everything under the eyes in the center band (equalizer / tray / ghosts)
    sy0 = eye_bottom - 4
    sy1 = by1 + 12
    sx0, sx1 = cx - 130, cx + 130
    mask = (yy >= sy0) & (yy <= sy1) & (xx >= sx0) & (xx <= sx1)
    a[mask] = (0, 0, 0, 255)
    # Second pass: any saturated / non-black ink still under the eyes (never touch headphones at sides)
    leftover = (
        (yy > eye_bottom - 2)
        & (yy < by1 + 20)
        & (np.abs(xx - cx) < 140)
        & (a[:, :, 3] > 10)
        & (
            (a[:, :, 0] > 18)
            | (a[:, :, 1] > 18)
            | (a[:, :, 2] > 18)
        )
    )
    a[leftover] = (0, 0, 0, 255)
    print(
        f"  botdee signal tray cleared bbox=({sx0},{sy0},{sx1},{sy1}) "
        f"leftover={int(leftover.sum())}"
    )
    return Image.fromarray(a, "RGBA")


def extract_botdee_graphic() -> Path:
    """Headphones bot only — no turntable / signal tray; centered; ×1.30; nudged down."""
    dj_path = extract_djbot_graphic()
    g = Image.open(dj_path).convert("RGBA")
    a = np.array(g)
    yy, xx = np.indices((S, S))
    ink = (
        ((a[:, :, 0] > 25) | (a[:, :, 1] > 25) | (a[:, :, 2] > 25))
        & (a[:, :, 3] > 20)
        & (yy < 520)
    )
    cols = ink.sum(axis=0)
    # Gap between bot and turntable (~403–429)
    cut = 403
    for x in range(360, 480):
        if cols[x] == 0 and cols[x : x + 8].sum() == 0:
            cut = x
            break
    bot_m = ink & (xx < cut)
    if not bot_m.any():
        raise RuntimeError("BOT DEE: bot ink not found left of turntable gap")
    ys, xs = np.where(bot_m)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    pad = 6
    crop = g.crop(
        (max(0, x0 - pad), max(0, y0 - pad), min(S, x1 + pad), min(S, y1 + pad))
    )
    # Scale ×1.30 from pre-tray figure, then strip tray and tight-crop the head
    cw, ch = crop.size
    scale = (399 * BOTDEE_BOT_SCALE) / max(1, ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    scaled = _strip_botdee_signal_tray(scaled)
    sa = np.array(scaled)
    sink = (
        ((sa[:, :, 0] > 25) | (sa[:, :, 1] > 25) | (sa[:, :, 2] > 25))
        & (sa[:, :, 3] > 20)
    )
    if sink.any():
        sys_, sxs = np.where(sink)
        scaled = scaled.crop(
            (int(sxs.min()), int(sys_.min()), int(sxs.max()) + 1, int(sys_.max()) + 1)
        )
        nw, nh = scaled.size

    top_clear = CY - (R - 36)
    # Wordmark band below; bot upper-central, nudged down
    bottom_cap = 560
    fit_h = bottom_cap - top_clear
    if nh > fit_h and fit_h > 80:
        shrink = fit_h / float(nh)
        nw = max(1, int(round(nw * shrink)))
        nh = max(1, int(round(nh * shrink)))
        scaled = scaled.resize((nw, nh), Image.Resampling.LANCZOS)
        print(f"  BOT DEE bot shrink-to-fit ×{shrink:.3f} → {nw}x{nh}")

    left = (S - nw) // 2
    top = top_clear + max(0, (fit_h - nh) // 2) + BOTDEE_BOT_DOWN
    if top + nh > bottom_cap:
        top = bottom_cap - nh
    top = max(top_clear, top)

    out = Image.new("RGBA", (S, S), (0, 0, 0, 255))
    out.alpha_composite(scaled, (left, top))
    oa = np.array(out)
    # Kill faint gray ghost strokes (not bright neon head/headphones/eyes)
    br = oa[:, :, 0].astype(int)
    bg = oa[:, :, 1].astype(int)
    bb = oa[:, :, 2].astype(int)
    faint = (
        ((br > 8) | (bg > 8) | (bb > 8))
        & (br < 90)
        & (bg < 90)
        & (bb < 90)
        & (oa[:, :, 3] > 0)
    )
    # Keep pink antenna tip
    pink = (br > 140) & (bg < 120) & (bb > 100)
    oa[faint & ~pink] = (0, 0, 0, 255)
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    oa[dist > (R - 16)] = (0, 0, 0, 255)
    dst = LAYERS / "botdee-graphic.png"
    Image.fromarray(oa, "RGBA").save(dst, optimize=True)
    print(
        f"GRAPHIC botdee → {dst} cut={cut} crop={cw}x{ch} head={nw}x{nh} "
        f"@({left},{top}) scale≈{BOTDEE_BOT_SCALE} down={BOTDEE_BOT_DOWN}"
    )
    return dst


def botdee_wm():
    """Stacked BOT (white thin border) / DEE (tiffany thin border) — no hyphen.

    BOT nudged left, DEE nudged right for a staggered stack.
    """
    size = BOTDEE_TEXT
    top_g = thin_border_glyph(glyph("BOT", size, WHITE), kind="white")
    dee_g = thin_border_glyph(glyph("DEE", size, TIFFANY), kind="cyan")
    gap = max(2, int(size * 0.012))
    bot_down = BOTDEE_TYPE_BOT_DOWN
    # Widen canvas so left/right stagger does not clip
    pad_x = max(abs(BOTDEE_BOT_X), abs(BOTDEE_DEE_X)) + 8
    W = max(top_g.size[0], dee_g.size[0]) + pad_x * 2
    H = bot_down + top_g.size[1] + gap + dee_g.size[1]
    bot_x = (W - top_g.size[0]) // 2 + BOTDEE_BOT_X
    dee_x = (W - dee_g.size[0]) // 2 + BOTDEE_DEE_X
    # All type over the ring (ShoutOut-style weight); empty under for assemble order
    under = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    over.alpha_composite(top_g, (bot_x, bot_down))
    over.alpha_composite(dee_g, (dee_x, bot_down + top_g.size[1] + gap))
    body = Image.alpha_composite(under, over)
    # Keep top padding so BOT stays nudged down (don't crop y0 to ink)
    x0, _y0, x1, y1 = ink_bbox(body, 10)
    box = (x0, 0, x1, y1)
    U = Image.fromarray(
        ink_only(np.array(under.crop((box[0], box[1], box[2] + 1, box[3] + 1)))), "RGBA"
    )
    O = Image.fromarray(
        ink_only(np.array(over.crop((box[0], box[1], box[2] + 1, box[3] + 1)))), "RGBA"
    )
    B = Image.alpha_composite(U, O)
    print(
        f"  TYPE BOT DEE size={size} BOT={top_g.size} DEE={dee_g.size} body={B.size} "
        f"bot_down={bot_down} bot_x={BOTDEE_BOT_X} dee_x={BOTDEE_DEE_X} "
        f"(thin border; DEE tiffany; no hyphen; staggered)"
    )
    # Match ShoutOut text-block footprint (~528×380) inside the lower chord
    need_w = B.size[0] > BOTDEE_MAX_W
    need_h = B.size[1] > BOTDEE_MAX_H
    if need_w or need_h:
        rw = BOTDEE_MAX_W / max(1, B.size[0])
        rh = BOTDEE_MAX_H / max(1, B.size[1])
        ratio = min(rw, rh, 1.0)
        nw = max(1, int(round(B.size[0] * ratio)))
        nh = max(1, int(round(B.size[1] * ratio)))

        def _rz(im):
            im = im.resize((nw, nh), Image.Resampling.LANCZOS)
            a = np.array(im)
            # Keep thin-border colors (white / tiffany / purple); drop dust only
            ink = a[:, :, 3] > 18
            bright = (a[:, :, 0] > 20) | (a[:, :, 1] > 20) | (a[:, :, 2] > 20)
            a[~(ink & bright)] = (0, 0, 0, 0)
            return Image.fromarray(a, "RGBA")

        U, O = _rz(U), _rz(O)
        B = Image.alpha_composite(U, O)
        print(f"  TYPE BOT-DEE fit → {B.size} (max {BOTDEE_MAX_W}x{BOTDEE_MAX_H})")
    return U, O, B


def place_botdee_mark(body, min_top: int):
    """Center BOT-DEE like ShoutOut — large interior fill; lower tips kiss the arc."""
    ba = np.array(body)
    ink = ba[:, :, 3] > 40
    ys, xs = np.where(ink)
    bot = int(ys.max())
    left = max(8, (S - body.size[0]) // 2)
    # Bottom of DEE near inner ring; keep mark high enough to read as ShoutOut-scale
    target = R - 4
    best_top, score = min_top, 1e18
    for t in range(max(8, min_top - 40), S - body.size[1] - 2):
        qd = float(np.hypot(left + body.size[0] / 2 - CX, t + bot - CY))
        if qd > (R + 10):
            continue
        sc = abs(qd - target) * 2.0
        # Strong preference for higher placement (ShoutOut fills the disc)
        sc += max(0, t - 500) * 0.08
        if sc < score:
            score, best_top = sc, t
    print(
        f"  place BOT-DEE mark left={left} top={best_top} "
        f"bot_dist={np.hypot(left + body.size[0] / 2 - CX, best_top + bot - CY):.1f}"
    )
    return left, best_top


def build_botdee_whiteblack(
    under, over, left: int, top: int, graphic: Image.Image
) -> Path:
    """BOT-DEE White/Black — tip-safe; keep tiffany DEE (not chrome-washed)."""
    wb_stroke = 3
    wb_half = wb_stroke / 2.0
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    font_chrome = shiny_chrome_tone(
        np.full((S, S), 160.0, np.float32), yy, xx, for_type=True
    )
    font_chrome = np.clip(font_chrome * 0.72, 10, 110)

    base = Image.new("RGBA", (S, S), (255, 255, 255, 255))
    ga = np.array(graphic.convert("RGBA"))
    gr, gg, gb, gal = (ga[:, :, i].astype(np.float32) for i in range(4))
    glum = 0.299 * gr + 0.587 * gg + 0.114 * gb
    chrome = shiny_chrome_tone(glum, yy, xx)
    gout = np.zeros_like(ga)
    line = (glum >= 30) & (gal > 8) & (dist < (R - 4))
    gout[line, 0] = gout[line, 1] = gout[line, 2] = chrome[line]
    gout[line, 3] = 255
    base.alpha_composite(Image.fromarray(gout, "RGBA"))

    def type_layer(im: Image.Image) -> Image.Image:
        a = np.array(paste_type(im, left, top))
        ink = a[:, :, 3] > 20
        tiffany = (
            ink
            & (a[:, :, 0] < 120)
            & (a[:, :, 1] > 140)
            & (a[:, :, 2] > 170)
        )
        out = np.zeros_like(a)
        for c in range(3):
            out[:, :, c] = np.where(ink, font_chrome, 0)
        out[tiffany, 0] = TIFFANY[0]
        out[tiffany, 1] = TIFFANY[1]
        out[tiffany, 2] = TIFFANY[2]
        out[:, :, 3] = np.where(ink, 255, 0)
        return Image.fromarray(out, "RGBA")

    base.alpha_composite(type_layer(under))
    ring_chrome = shiny_chrome_tone(np.full((S, S), 200.0, np.float32), yy, xx)
    ring_chrome = np.clip(12.0 + ring_chrome * 0.35, 14, 95)
    ra = np.zeros((S, S, 4), np.uint8)
    ring_mask = np.abs(dist - R) <= wb_half
    for c in range(3):
        ra[:, :, c] = np.where(ring_mask, ring_chrome, 0).astype(np.uint8)
    ra[:, :, 3] = np.where(ring_mask, 255, 0).astype(np.uint8)
    base.alpha_composite(Image.fromarray(ra, "RGBA"))
    over_t = type_layer(over)
    base.alpha_composite(over_t)

    out = np.array(base)
    out[:, :, 3] = 255
    under_t = type_layer(under)
    type_ink = (np.array(under_t)[:, :, 3] > 20) | (np.array(over_t)[:, :, 3] > 20)
    outside = dist > (R + wb_half + 0.5)
    out[outside & ~type_ink, :3] = 255
    tips = type_ink & (dist > (R + wb_half))
    # Tip stamp: chrome for white letters; keep tiffany for DEE
    oa = np.array(over_t)
    tip_tiff = (
        tips
        & (oa[:, :, 3] > 20)
        & (oa[:, :, 0] < 120)
        & (oa[:, :, 1] > 140)
        & (oa[:, :, 2] > 170)
    )
    for c in range(3):
        out[:, :, c] = np.where(tips, font_chrome, out[:, :, c])
    out[tip_tiff, 0] = TIFFANY[0]
    out[tip_tiff, 1] = TIFFANY[1]
    out[tip_tiff, 2] = TIFFANY[2]

    dst = ROOT / "images/chrome/botdee-whiteblack.jpg"
    Image.fromarray(out, "RGBA").convert("RGB").save(dst, quality=96, subsampling=0)
    Image.fromarray(out, "RGBA").convert("RGB").save(
        ROOT / "images/chrome/floqai-whiteblack.jpg", quality=96, subsampling=0
    )
    # Legacy streetbot path (redirect)
    Image.fromarray(out, "RGBA").convert("RGB").save(
        ROOT / "images/chrome/streetbot-whiteblack.jpg", quality=96, subsampling=0
    )
    print(f"  BOT-DEE WB tips outside={int(tips.sum())} ring={wb_stroke}px → {dst.name}")
    return dst


def build_botdee_only():
    """BOT-DEE — centered headphones bot ×1.30; ShoutOut-scale thin-border mark."""
    LAYERS.mkdir(parents=True, exist_ok=True)
    ensure_ring()
    ensure_traditional_ring()
    g_path = extract_botdee_graphic()
    print("=== assemble BOT-DEE (ShoutOut-scale type, centered bot) ===")
    g = Image.open(g_path)
    under, over, body = botdee_wm()
    left, top = place_botdee_mark(body, graphic_bottom(g, 560) + 22)
    print(f"  place BOT-DEE left={left} top={top} body={body.size}")
    sb = assemble(g, under, over, left, top, nightlife=True)
    out = ROOT / "images/chrome"
    sb.convert("RGB").save(out / "botdee-nightlife.jpg", quality=98, subsampling=0)
    sb.convert("RGB").save(out / "streetbot-nightlife.jpg", quality=98, subsampling=0)
    sb.save(out / "floqai-nightlife.png", optimize=True)
    sb.convert("RGB").save(out / "floqbot-nightlife.png", optimize=True)
    trad = traditional_from_nightlife(sb, g, under, over, left, top)
    trad.convert("RGB").save(out / "botdee-traditional.jpg", quality=98, subsampling=0)
    trad.convert("RGB").save(out / "streetbot-traditional.jpg", quality=98, subsampling=0)
    trad.convert("RGB").save(out / "floqai-traditional.jpg", quality=98, subsampling=0)
    trad.save(out / "floqbot-traditional-green.png", optimize=True)
    build_botdee_whiteblack(under, over, left, top, g)
    preview = sb.convert("RGB").resize((640, 640), Image.Resampling.LANCZOS)
    preview.save("/opt/cursor/artifacts/botdee-nightlife.png", quality=95)
    trad.convert("RGB").resize((640, 640), Image.Resampling.LANCZOS).save(
        "/opt/cursor/artifacts/botdee-traditional.png", quality=95
    )
    Image.open(out / "botdee-whiteblack.jpg").resize(
        (640, 640), Image.Resampling.LANCZOS
    ).save("/opt/cursor/artifacts/botdee-whiteblack.png", quality=95)
    # Side-by-side vs ShoutOut for size check
    so = Image.open(out / "shoutout-nightlife.png").convert("RGB").resize(
        (640, 640), Image.Resampling.LANCZOS
    )
    cmp = Image.new("RGB", (640 * 2 + 24, 700), (20, 20, 24))
    cmp.paste(so, (0, 40))
    cmp.paste(preview, (640 + 24, 40))
    d = ImageDraw.Draw(cmp)
    try:
        fnt = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22
        )
    except Exception:
        fnt = ImageFont.load_default()
    d.text((16, 8), "ShoutOut (type size ref)", fill=(230, 230, 235), font=fnt)
    d.text((640 + 40, 8), "BOT DEE", fill=(230, 230, 235), font=fnt)
    cmp.save("/opt/cursor/artifacts/botdee-vs-shoutout.png", quality=95)

    pack = [
        ("VIP", "vip-whiteblack.jpg"),
        ("ShoutOut", "shoutout-whiteblack.png"),
        ("BOT DEE", "botdee-whiteblack.jpg"),
        ("FloqCast", "floqcast-whiteblack.jpg"),
        ("BartR", "bartr-whiteblack.jpg"),
        ("RydR", "rydr-whiteblack.jpg"),
    ]
    cell, pad = 260, 12
    W = pad + (cell + pad) * len(pack)
    H = cell + 56
    c = Image.new("RGB", (W, H), (245, 245, 247))
    d = ImageDraw.Draw(c)
    try:
        fnt = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18
        )
    except Exception:
        fnt = ImageFont.load_default()
    d.text(
        (pad, 6),
        "White/Black pack — BOT DEE (was streetBOT / FloqAi)",
        fill=(30, 30, 35),
        font=fnt,
    )
    for i, (lab, fn) in enumerate(pack):
        x = pad + i * (cell + pad)
        im = Image.open(out / fn).convert("RGB").resize(
            (cell, cell), Image.Resampling.LANCZOS
        )
        d.rectangle([x - 1, 30 - 1, x + cell, 30 + cell], outline=(40, 40, 45), width=2)
        c.paste(im, (x, 30))
        d.text((x + 8, 30 + cell + 4), lab, fill=(40, 40, 45), font=fnt)
    c.save("/opt/cursor/artifacts/whiteblack-botdee-pack-strip.png", quality=95)
    print("DONE BOT-DEE —", out / "botdee-nightlife.jpg")


# Back-compat aliases
build_streetbot_only = build_botdee_only


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ring-only", action="store_true")
    ap.add_argument("--graphics-only", action="store_true")
    ap.add_argument("--vip-only", action="store_true", help="Rebuild VIP nightlife+traditional only")
    ap.add_argument(
        "--botdee-only",
        action="store_true",
        help="Rebuild BOT-DEE chrome + floqAi pack slots",
    )
    ap.add_argument(
        "--streetbot-only",
        action="store_true",
        help="Alias for --botdee-only",
    )
    ap.add_argument(
        "--floqcast-wb-only",
        action="store_true",
        help="Rebuild FloqCAST White/Black only (layer assemble, tip-safe)",
    )
    args = ap.parse_args()
    if args.ring_only:
        ensure_ring()
        return
    if args.graphics_only:
        LAYERS.mkdir(parents=True, exist_ok=True)
        extract_floqcast_graphic()
        extract_djbot_graphic()
        extract_botdee_graphic()
        extract_vip_graphic()
        return
    if args.vip_only:
        build_vip_only()
        return
    if args.botdee_only or args.streetbot_only:
        build_botdee_only()
        return
    if args.floqcast_wb_only:
        build_floqcast_whiteblack()
        return
    build_all()


if __name__ == "__main__":
    main()
