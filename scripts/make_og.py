#!/usr/bin/env python3
"""Render the 1200x630 social card used for link previews.

This is a designed promo graphic, not a screenshot: the mini chart plots the
real Chemistry Unit 1 boundary history and forecast, so the numbers on it are
the numbers the site shows.

Run: python3 scripts/make_og.py
"""
import json
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
BG = (7, 8, 13)
INK = (238, 241, 248)
MUTED = (154, 163, 184)
LINE = (35, 38, 52)

# Same six hues the chart uses, A downward.
SERIES = [(144, 133, 233), (25, 158, 112), (57, 135, 229), (201, 133, 0), (217, 89, 38), (213, 81, 129)]

BLOBS = [
    (120, -60, 620, (34, 211, 238), 0.20),
    (520, -80, 560, (79, 140, 255), 0.20),
    (1120, -40, 520, (167, 139, 250), 0.22),
    (1080, 380, 460, (244, 114, 182), 0.14),
    (60, 520, 520, (251, 113, 133), 0.12),
    (760, 640, 520, (251, 191, 36), 0.10),
]

FONTS = [
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial Bold.ttf',
]


def font(size, bold=True):
    for path in FONTS if bold else reversed(FONTS):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def mesh():
    """Soft radial colour blobs, the same palette as the site background."""
    base = Image.new('RGB', (W, H), BG)
    for cx, cy, radius, colour, strength in BLOBS:
        mask = Image.new('L', (W, H), 0)
        px = mask.load()
        for y in range(0, H, 2):
            for x in range(0, W, 2):
                d = math.hypot(x - cx, y - cy) / radius
                if d >= 1:
                    continue
                v = int(255 * strength * (1 - d) ** 2)
                px[x, y] = v
                if x + 1 < W:
                    px[x + 1, y] = v
                if y + 1 < H:
                    px[x, y + 1] = v
                    if x + 1 < W:
                        px[x + 1, y + 1] = v
        base = Image.composite(Image.new('RGB', (W, H), colour), base, mask)
    return base


def history(subject='Chemistry', code='WCH11'):
    data = json.load(open(os.path.join(ROOT, 'data', 'ial.json')))
    months = {'Jan': 1, 'Jun': 6, 'Oct': 10, 'Nov': 11}
    order = sorted(data['sessions'], key=lambda s: int(s.split()[1]) * 100 + months.get(s.split()[0], 0))
    out = {}
    for grade in ['a', 'b', 'c', 'd', 'e']:
        points = []
        for session in order[-10:]:
            units = data['sessions'][session].get(subject, {}).get('units', [])
            unit = next((u for u in units if u['code'] == code and not u['variant']), None)
            if unit and unit['raw'].get(grade):
                points.append(unit['raw'][grade])
        if len(points) >= 6:
            out[grade] = points
    return out


def chart(img, box):
    x0, y0, x1, y1 = box
    draw = ImageDraw.Draw(img, 'RGBA')
    draw.rounded_rectangle(box, 22, fill=(14, 16, 23), outline=(48, 52, 70), width=1)

    series = history()
    if not series:
        return
    values = [v for pts in series.values() for v in pts]
    lo, hi = min(values) - 4, max(values) + 4
    pad = 26
    px0, py0, px1, py1 = x0 + pad, y0 + 56, x1 - pad - 26, y1 - 28

    for i in range(4):
        gy = py0 + (py1 - py0) * i / 3
        draw.line([(px0, gy), (px1, gy)], fill=LINE, width=1)

    for si, (grade, pts) in enumerate(series.items()):
        colour = SERIES[si % len(SERIES)]
        n = len(pts)
        # The last point stands in for the forecast, drawn as a dashed reach.
        coords = [
            (px0 + (px1 - px0) * i / n, py1 - (py1 - py0) * (v - lo) / (hi - lo))
            for i, v in enumerate(pts)
        ]
        draw.line(coords, fill=colour, width=3, joint='curve')
        fx = px1
        fy = coords[-1][1] + (coords[-1][1] - coords[-2][1]) * 0.4
        for seg in range(4):
            a = seg / 4
            b = (seg + 0.55) / 4
            draw.line(
                [(coords[-1][0] + (fx - coords[-1][0]) * a, coords[-1][1] + (fy - coords[-1][1]) * a),
                 (coords[-1][0] + (fx - coords[-1][0]) * b, coords[-1][1] + (fy - coords[-1][1]) * b)],
                fill=colour, width=3)
        draw.ellipse([fx - 6, fy - 6, fx + 6, fy + 6], fill=colour, outline=(14, 16, 23), width=2)
        draw.text((fx + 12, fy - 11), grade.upper(), font=font(18), fill=INK)

    draw.text((x0 + pad, y0 + 20), 'Boundary trend and Jun 2026 forecast', font=font(19), fill=INK)


def mix(colour, base, amount):
    return tuple(int(b + (c - b) * amount) for c, b in zip(colour, base))


def chip(draw, x, y, text, colour):
    """Tinted pill. Alpha fills do not blend reliably here, so mix by hand."""
    f = font(20)
    w = draw.textlength(text, font=f)
    fill = mix(colour, (16, 18, 26), 0.14)
    edge = mix(colour, (16, 18, 26), 0.42)
    draw.rounded_rectangle([x, y, x + w + 32, y + 42], 21, fill=fill, outline=edge, width=1)
    draw.text((x + 16, y + 10), text, font=f, fill=mix(colour, (255, 255, 255), 0.35))
    return x + w + 44


def main():
    img = mesh().convert('RGBA')
    draw = ImageDraw.Draw(img, 'RGBA')

    draw.text((64, 58), 'EDEXCEL GRADE CALCULATOR', font=font(20), fill=(154, 163, 184))
    draw.text((64, 100), 'Your UMS, your grade,', font=font(62), fill=INK)
    draw.text((64, 168), 'and the easiest way up.', font=font(62), fill=(167, 139, 250))

    draw.text((64, 262), 'Every International A Level and International GCSE session', font=font(24, False), fill=MUTED)
    draw.text((64, 296), 'Pearson has published since 2014, October and November included.', font=font(24, False), fill=MUTED)

    x = 64
    x = chip(draw, x, 352, '32 IAL sessions', (45, 212, 191))
    chip(draw, x, 352, 'A* rule built in', (167, 139, 250))
    x = chip(draw, 64, 408, 'Next session forecast', (251, 191, 36))
    chip(draw, x, 408, 'Retake planner', (244, 114, 182))

    chart(img, (640, 330, 1136, 566))

    draw.text((64, 520), 'edexcel-grade-calc.vercel.app', font=font(28), fill=(56, 189, 248))
    draw.text((64, 566), 'Free. No sign up. Unofficial, so check against your statement of results.',
              font=font(18, False), fill=(120, 128, 148))

    out = os.path.join(ROOT, 'public', 'og.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.convert('RGB').save(out, 'PNG', optimize=True)
    print(f'wrote {out} ({os.path.getsize(out) // 1024} KB)')


if __name__ == '__main__':
    main()
