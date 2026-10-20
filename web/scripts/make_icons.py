"""Raster copies of icon.svg for the browsers that will not take an SVG favicon.

Same geometry as the SVG: a three-stop alternating walk, viewer -> title ->
candidate, on the app's near-black. Regenerate with `python web/scripts/make_icons.py`.
"""
from PIL import Image, ImageDraw
import os

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
BG = "#00040a"
WIRE = "#46515e"
STOPS = [(46, 346, "#6ea8f0"), (196, 196, "#8fbf72"), (346, 46, "#2f7bef")]
LINE = [(166, 406), (256, 256), (406, 166)]


def draw(size):
    # 4x then downscale, so the edges are clean at 16 and 32 px
    s = size * 4
    k = s / 512
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    w = max(1, round(20 * k))
    for (x1, y1), (x2, y2) in zip(LINE, LINE[1:]):
        d.line([(x1 * k, y1 * k), (x2 * k, y2 * k)], fill=WIRE, width=w)
    for x, y, col in STOPS:
        d.rectangle([x * k, y * k, (x + 120) * k, (y + 120) * k], fill=col)
    return img.resize((size, size), Image.LANCZOS)


for name, size in [("icon-512.png", 512), ("apple-touch-icon.png", 180), ("favicon-32.png", 32)]:
    draw(size).save(os.path.join(HERE, name), optimize=True)
    print("wrote", name)
