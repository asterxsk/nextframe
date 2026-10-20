"""Text measurement against the real font file.

PowerPoint does not shrink a title to fit; a long one simply runs past the
hairline and collides with the lede. Rather than eyeball every string, the
generator asks this module how wide a line will actually be, using the same
TTF the deck ships.
"""

from __future__ import annotations

import os
import unicodedata
from functools import lru_cache

from PIL import ImageFont

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")

FILES = {
    ("IBM Plex Serif", False): "IBMPlexSerif-Regular.ttf",
    ("IBM Plex Serif", True): "IBMPlexSerif-Italic.ttf",
    ("IBM Plex Mono", False): "IBMPlexMono-Regular.ttf",
    ("IBM Plex Mono Medium", False): "IBMPlexMono-Medium.ttf",
    ("IBM Plex Sans", False): "IBMPlexSans-Regular.ttf",
    ("IBM Plex Sans Medium", False): "IBMPlexSans-Medium.ttf",
}

# 1 pt of type at 1 in = 72 pt; PIL measures at pixels-per-em, so a size in
# points is measured at that size and converted at the end.
PX_PER_PT = 4.0


@lru_cache(maxsize=64)
def _font(family: str, italic: bool, size: float):
    path = os.path.join(FONTS, FILES[(family, italic)])
    return ImageFont.truetype(path, int(round(size * PX_PER_PT)))


def width_in(text: str, family: str, size: float, italic: bool = False) -> float:
    """Rendered width of one line, in inches."""
    fnt = _font(family, italic, size)
    return fnt.getlength(text) / PX_PER_PT / 72.0


def width_pt(text: str, family: str, size: float, italic: bool = False) -> float:
    return fnt_width(text, family, size, italic) / PX_PER_PT


def fnt_width(text: str, family: str, size: float, italic: bool = False) -> float:
    fnt = _font(family, italic, size)
    return fnt.getlength(text)


def wrap(text: str, family: str, size: float, box_in: float, italic: bool = False):
    """Greedy word wrap at the same width PowerPoint will use."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if width_in(trial, family, size, italic) <= box_in or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def n_lines(text: str, family: str, size: float, box_in: float, italic: bool = False) -> int:
    return len(wrap(text, family, size, box_in, italic))
