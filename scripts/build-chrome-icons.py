#!/usr/bin/env python3
"""
Modular chrome icon builder (nightlife + traditional).

Architecture (one pipeline for all marks):
  1. RING     — build once, save to images/chrome/layers/ring-nightlife.png
  2. GRAPHIC  — extract once from a CLEAN source, save as *-graphic.png (no type, no ring)
  3. TYPE     — render ink-only under/over wordmark layers
  4. ASSEMBLE — black bg + graphic + under-type + ring + over-type
               traditional = black + graphic + full type (no ring)

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
VIP_X = 194
VIP_V = VIP_X * 2


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
            width=14,
        )
    bloom = np.array(ring.filter(ImageFilter.GaussianBlur(3.0)))
    bloom[:, :, 3] = (bloom[:, :, 3].astype(np.float32) * 0.35).astype(np.uint8)
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


def extract_vip_graphic() -> Path:
    """Lounge from f2e712b (+10% furniture); no type, no ring."""
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


def vip_wm():
    reser = glyph("reser", VIP_X, WHITE)
    IP = glyph("IP", VIP_X, WHITE)
    V = glyph("V", VIP_V, TIFFANY)
    ov_r = int(V.size[0] * 0.12)
    ov_i = int(V.size[0] * 0.18)
    pad = 6
    W = reser.size[0] + V.size[0] + IP.size[0] - ov_r - ov_i + pad * 2
    H = V.size[1] + pad * 2
    under = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vx = pad + reser.size[0] - ov_r
    vy = pad
    under.alpha_composite(reser, (pad, vy + V.size[1] - reser.size[1] - 2))
    under.alpha_composite(V, (vx, vy))
    over.alpha_composite(IP, (vx + V.size[0] - ov_i, vy + int(V.size[1] * 0.02)))
    combo = Image.alpha_composite(under, over)
    box = ink_bbox(combo, 10)
    ua = ink_only(np.array(under.crop((box[0], box[1], box[2] + 1, box[3] + 1))))
    oa = ink_only(np.array(over.crop((box[0], box[1], box[2] + 1, box[3] + 1))))
    Hh, Ww = box[3] - box[1] + 1, box[2] - box[0] + 1
    u2 = np.zeros((Hh, Ww, 4), np.uint8)
    o2 = np.zeros((Hh, Ww, 4), np.uint8)
    u2[: ua.shape[0], : ua.shape[1]] = ua
    o2[: oa.shape[0], : oa.shape[1]] = oa
    body = Image.alpha_composite(Image.fromarray(u2, "RGBA"), Image.fromarray(o2, "RGBA"))
    print(f"  TYPE VIP X={VIP_X} V={VIP_V} raw={body.size}")
    return fit_width(Image.fromarray(u2, "RGBA"), Image.fromarray(o2, "RGBA"), body)


def place_inside_ring(body, min_top: int, bias=6):
    """Search left+top so ALL ink stays inside R-2 and edge tips kiss ~R-10."""
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
            if mr > (R - 2):
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
    assert mr <= (R - 1), f"ink outside ring: maxR={mr}"
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


def traditional_from_nightlife(
    nightlife: Image.Image,
    graphic: Image.Image,
    under: Image.Image,
    over: Image.Image,
    left: int,
    top: int,
) -> Image.Image:
    """Traditional = same graphic + type + placement as nightlife; no gradient ring.

    Re-assembles identical layers without the ring (do not strip the ring off the
    finished nightlife frame — that permanently erases Fl where the ring covered it).
    """
    trad = assemble(graphic, under, over, left, top, nightlife=False)
    ta = np.array(trad.convert("RGBA"))
    yy, xx = np.indices((S, S))
    dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2)
    r, gch, bch = [ta[:, :, i].astype(int) for i in range(3)]
    sat = (np.maximum(np.maximum(r, gch), bch) - np.minimum(np.minimum(r, gch), bch)) > 40
    under_full = np.array(paste_type(under, left, top))
    over_full = np.array(paste_type(over, left, top))
    type_ink = (under_full[:, :, 3] > 20) | (over_full[:, :, 3] > 20)
    # Kill any leftover ring bloom from the graphic extract in the annulus
    crumb = (
        (dist > 468)
        & (dist < 505)
        & sat
        & ~type_ink
        & ~((r > 200) & (gch > 200) & (bch > 200))
        & ~((r < 100) & (gch > 150) & (bch > 180))
        & ~((r > 140) & (bch > 140) & (r > gch + 20))  # keep pink LED crumbs if any
    )
    ta[crumb, :3] = 0
    ta[:, :, 3] = 255
    # Verify graphic match vs nightlife outside the ring stroke
    na = np.array(nightlife.convert("RGBA"))
    ring = np.array(Image.open(LAYERS / "ring-nightlife.png").convert("RGBA"))[:, :, 3] > 20
    interior = (dist < 460) & ~ring
    hot = int(
        (
            (np.abs(na.astype(int) - ta.astype(int)).sum(axis=2) > 30) & interior
        ).sum()
    )
    print(f"  traditional interior vs nightlife hot={hot}")
    return Image.fromarray(ta, "RGBA")


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
    # Tall V=2X needs room ABOVE the peer baseline — min_top from furniture only.
    # Prefer tops near FloqCAST/djBOT when tips still kiss; do not force min≈fc_top
    # (that shoved tips past the arc and forced over-shrink / cut r·e).
    vip_min = graphic_bottom(g, 560) + 8
    peer_prefer = int((fc_top + dj_top) / 2) - 40
    for _ in range(8):
        try:
            left, top = place_inside_ring(body, vip_min, bias=2)
            # If we landed far above peers and still have width headroom, nudge min up
            if top < peer_prefer - 80 and body.size[0] <= MAX_WM_W:
                try:
                    left2, top2 = place_inside_ring(
                        body, max(vip_min, peer_prefer - 100), bias=2
                    )
                    left, top = left2, top2
                except AssertionError:
                    pass
            break
        except AssertionError:
            nw = int(body.size[0] * 0.95)
            under, over, body = fit_width(under, over, body, max_w=nw)
            print(f"  shrink to {body.size}")
    vip = assemble(g, under, over, left, top, nightlife=True)
    vip.convert("RGB").save(
        ROOT / "images/chrome/vip-nightlife.jpg", quality=98, subsampling=0
    )
    vip.save(ROOT / "images/review/actual-icons/vip-reserv-actual.png", optimize=True)
    trad = traditional_from_nightlife(vip, g, under, over, left, top)
    trad.convert("RGB").save(
        ROOT / "images/chrome/vip-traditional.jpg", quality=98, subsampling=0
    )

    # QA strip — nightlife vs traditional FloqCAST
    panel = Image.new("RGB", (900, 400), (0, 0, 0))
    d = ImageDraw.Draw(panel)
    panel.paste(
        Image.open(ROOT / "images/review/actual-icons/floqcast-v4-circle-silhouette.png")
        .convert("RGB")
        .resize((360, 360)),
        (40, 30),
    )
    panel.paste(
        Image.open(ROOT / "images/chrome/floqcast-traditional-green.png")
        .convert("RGB")
        .resize((360, 360)),
        (480, 30),
    )
    d.text((40, 8), "Nightlife", fill=(180, 180, 180))
    d.text((480, 8), "Traditional (= nightlife, no ring)", fill=(180, 180, 180))
    panel.save("/opt/cursor/artifacts/qa-modular-chrome.png")
    panel.save("/opt/cursor/artifacts/fc-nightlife-vs-traditional.png")

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


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ring-only", action="store_true")
    ap.add_argument("--graphics-only", action="store_true")
    args = ap.parse_args()
    if args.ring_only:
        ensure_ring()
        return
    if args.graphics_only:
        LAYERS.mkdir(parents=True, exist_ok=True)
        extract_floqcast_graphic()
        extract_djbot_graphic()
        extract_vip_graphic()
        return
    build_all()


if __name__ == "__main__":
    main()
