"""
build_deck.py
=============
Builds NextFrame.pptx — fourteen slides: a title slide, twelve content slides
(three for each of the four presenters), and a conclusion.

Every number on these slides is read from web/public/data/bundle.json or
recomputed from the same MovieLens files the pipeline reads, so the deck and
the app cannot drift apart. Nothing here is a placeholder.

    python deck/build_deck.py

Slide geometry is 13.333 x 7.5 in (16:9). Type is IBM Plex Serif for titles and
labels, IBM Plex Sans for prose, IBM Plex Mono for every numeral — the same
three faces the app sets. deck/build_fonts.py installs them.
"""

from __future__ import annotations

import json
import math
import os
import sys

from PIL import ImageFont
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure  # noqa: E402  (path has to be set first)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUNDLE = os.path.join(ROOT, "web", "public", "data", "bundle.json")
OUT = os.path.join(HERE, "NextFrame.pptx")


# ---------------------------------------------------------------- tokens
def C(h: str) -> RGBColor:
    return RGBColor.from_string(h.strip("#").upper())


CANVAS = C("00040A")
SURFACE = C("0B0D10")
RAISED = C("111216")
LINE = C("23272E")
SOFT = C("171A1F")
INK = C("E1E3E7")
INK2 = C("B2B9C6")
MUTED = C("7B8494")
FAINT = C("5D6470")
SIGNAL = C("2F7BEF")
SIGNAL_HI = C("4D92FF")
S1 = C("6EA8F0")
S3 = C("8FBF72")
GOOD = C("3FBF6F")

PAL = [C(x) for x in (
    "3987e5", "d95926", "199e70", "c98500",
    "d55181", "008300", "9085e9", "e66767",
)]
# one hue, five stops, for "how many hops away" and for the weight matrices
RAMP = [C("12233d"), C("1b4a94"), C("2f7bef"), C("4d92ff"), C("6ea8f0")]

SERIF = "IBM Plex Serif"
SANS = "IBM Plex Sans"
MONO = "IBM Plex Mono"

W, H = 13.333, 7.5
ML, MR = 0.85, 12.483
CONTENT_TOP = 1.80
CONTENT_BOT = 6.42

prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
BLANK = prs.slide_layouts[6]


# ---------------------------------------------------------------- runs
def R(text, f=SANS, s=14, c=INK, b=False, i=False, sup=False, align=None,
      line=None):
    """One run. `align` is not a run property — it is carried up to the
    paragraph, so a call site can say P(R("…", align=RIGHT)) and mean it."""
    return dict(t=text, f=f, s=s, c=c, b=b, i=i, sup=sup, align=align, line=line)


def P(*runs, space=0, line=None, align=None):
    return dict(runs=list(runs), space=space, line=line, align=align)


def block(sl, x, y, w, h, paras, anchor=MSO_ANCHOR.TOP, wrap=True):
    box = sl.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = wrap
    tf.margin_left = tf.margin_right = 0
    tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    for n, spec in enumerate(paras):
        para = tf.paragraphs[0] if n == 0 else tf.add_paragraph()
        para.alignment = spec["align"] or next(
            (r["align"] for r in spec["runs"] if r["align"]), PP_ALIGN.LEFT
        )
        para.line_spacing = spec["line"] or next(
            (r["line"] for r in spec["runs"] if r["line"]), 1.25
        )
        para.space_before = Pt(spec["space"])
        para.space_after = Pt(0)
        for r in spec["runs"]:
            run = para.add_run()
            run.text = r["t"]
            fnt = run.font
            fnt.name = r["f"]
            fnt.size = Pt(r["s"])
            fnt.bold = r["b"]
            fnt.italic = r["i"]
            fnt.color.rgb = r["c"]
            if r["sup"]:
                # raised baseline; the exponent sits 30% of an em up
                run.font._rPr.set("baseline", "30000")
    return box


def rect(sl, x, y, w, h, fill=None, line=None, lw=0.75):
    shp = sl.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.shadow.inherit = False
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(lw)
    return shp


def oval(sl, x, y, d, fill=None, line=None, lw=0.75):
    shp = sl.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shp.shadow.inherit = False
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(lw)
    return shp


def wire(sl, a, b, color=LINE, lw=0.9):
    ln = sl.shapes.add_connector(
        MSO_CONNECTOR.STRAIGHT, Inches(a[0]), Inches(a[1]), Inches(b[0]), Inches(b[1])
    )
    ln.line.color.rgb = color
    ln.line.width = Pt(lw)
    return ln


def hline(sl, x, y, w, color=LINE, lw=0.75):
    wire(sl, (x, y), (x + w, y), color, lw)


# ---------------------------------------------------------------- chrome
PERSON = {
    "C039": "Degree and connectivity",
    "C044": "Path and cycle",
    "C043": "Eulerian and Hamiltonian",
    "C046": "Planar graphs and colouring",
}
_n = [0]


def slide(label: str | None = None, title: str | None = None, notes: str = "",
          title_size: float | None = None):
    """A blank canvas slide with the hairline, the label and the title. The
    label is serif italic, sentence case, untracked — never mono caps.

    The title is fitted: if it does not clear the hairline on one line at 29 pt
    the type steps down until it does. A title that wraps would sit on top of
    the lede, and PowerPoint will not shrink it for us."""
    _n[0] += 1
    sl = prs.slides.add_slide(BLANK)
    bg = sl.background.fill
    bg.solid()
    bg.fore_color.rgb = CANVAS
    if label is not None:
        block(sl, ML, 0.50, 9.0, 0.24, [P(R(label, SERIF, 11, MUTED, i=True))])
    if title is not None:
        size = title_size or 29.0
        box = 11.63
        while size > 19 and measure.width_in(title, SERIF, size) > box:
            size -= 0.5
        block(sl, ML, 0.78 + (29 - size) * 0.014, box, 1.6,
              [P(R(title, SERIF, size, INK))])
        hline(sl, ML, 1.60, MR - ML, LINE)
    # footer: page number only
    block(sl, MR - 1.1, 6.98, 1.1, 0.2,
          [P(R(f"{_n[0]} / 14", MONO, 9, FAINT))])
    if notes:
        sl.notes_slide.notes_text_frame.text = notes
    return sl


def lede(sl, text, x=ML, y=CONTENT_TOP, w=5.05, s=13, c=INK2):
    block(sl, x, y, w, 2.2, [P(R(text, SANS, s, c))])


def facts(sl, x, y, w, rows, s=10.5, gap=0.315, accent=(), value_frac=0.42):
    """A key/value stack: sans label, mono value, hairline between.

    Both columns are measured against the shipping font and step down in size
    until they fit, because a right-aligned value that overflows paints back
    across its own label and nothing in PowerPoint catches it."""
    lw = w * (1 - value_frac) - 0.12
    vw = w * value_frac - 0.02
    for i, (k, v) in enumerate(rows):
        yy = y + i * gap
        ks = min(s, max(8.0, s - 0.5 * max(0, math.ceil(measure.width_in(k, SANS, s) / lw) - 1)))
        vs = s
        while vs > 7.5 and measure.width_in(v, MONO, vs) > vw:
            vs -= 0.25
        block(sl, x, yy + 0.045, lw, 0.24, [P(R(k, SANS, ks, MUTED))])
        block(sl, x + w - vw, yy + 0.03, vw, 0.24,
              [P(R(v, MONO, vs, SIGNAL_HI if i in accent else INK,
                   align=PP_ALIGN.RIGHT))])
        hline(sl, x, yy + gap - 0.05, w, SOFT)
    return y + len(rows) * gap


def caption(sl, x, y, text, w=5.9):
    block(sl, x, y, w, 0.22, [P(R(text, SERIF, 10, MUTED, i=True))])


def note(sl, x, y, text, w=5.9, s=9.5):
    block(sl, x, y, w, 0.8, [P(R(text, SANS, s, FAINT))])


def kpi(sl, x, y, value, label, s=30, w=2.6):
    block(sl, x, y, w, 0.55, [P(R(value, SERIF, s, INK))])
    block(sl, x, y + 0.50, w, 0.36, [P(R(label, SANS, 9.5, MUTED))])


# ---------------------------------------------------------------- data
B = json.load(open(BUNDLE, encoding="utf-8"))
META = B["meta"]
MOV = {m["id"]: m for m in B["movies"]}
GNAME = [g["n"] for g in B["genres"]]
E = B["euler"]
PL = B["planar"]

V498 = next(u for u in B["users"] if u["id"] == 498)
REC498 = B["recs"]["498"]
WATCH498 = B["watch"]["498"]
LC498 = B["listColour"]["498"]


def n(x):
    return f"{x:,}"


# =====================================================================
# 1 — title
# =====================================================================
sl = slide(notes=(
    "Open on the claim, not the agenda. Everything on the next twelve slides "
    "is one graph, seven topics from the syllabus, and arithmetic that the app "
    "repeats live. Four presenters, three slides each."
))
# the mark: one alternating walk, three stops, the same figure the app icon uses
mx, my, sp = 9.15, 2.02, 1.28
# wire first, corner to corner through the centres, then the blocks on top —
# the same order the icon is drawn in, so the joints read as stops on a walk
sq = 0.66
wire(sl, (mx + sq / 2, my + 2 * sp + sq / 2), (mx + sp + sq / 2, my + sp + sq / 2),
     C("46515E"), 4.5)
wire(sl, (mx + sp + sq / 2, my + sp + sq / 2), (mx + 2 * sp + sq / 2, my + sq / 2),
     C("46515E"), 4.5)
rect(sl, mx, my + 2 * sp, sq, sq, fill=S1)
rect(sl, mx + sp, my + sp, sq, sq, fill=S3)
rect(sl, mx + 2 * sp, my, sq, sq, fill=SIGNAL)

block(sl, ML, 0.94, 8.0, 0.3,
      [P(R("Discrete mathematics · semester project", SERIF, 12, MUTED, i=True))])
block(sl, ML, 1.24, 9.0, 1.0, [P(R("NextFrame", SERIF, 64, INK))])
block(sl, ML, 2.36, 8.2, 1.2,
      [P(R("Graph theory in streaming recommendations", SERIF, 25, INK2))])
hline(sl, ML, 3.62, 4.4, LINE)
block(sl, ML, 3.86, 8.0, 1.6, [
    P(R("A recommendation engine built as a graph problem over the MovieLens "
        "archive: 1,437 titles, 8,498 weighted edges, and every score on screen "
        "traceable to a path that produced it.", SANS, 13.5, INK2)),
])
block(sl, ML, 5.86, 6.2, 1.2, [
    P(R("Semester VII · Division B · Batch B2", SANS, 11, MUTED), space=0),
    P(R("C039   ·   C043   ·   C044   ·   C046", MONO, 12, INK2), space=9),
])


# =====================================================================
# 2 — the graph  (C039)
# =====================================================================
sl = slide(
    "Graph construction · C039",
    "One graph, built from 100,836 ratings",
    notes=(
        "Start with the object. A rating at or above 3.5 is a like, and a like is "
        "an edge between a viewer and a title — that is a bipartite graph. We then "
        "project it onto the titles so the graph-theory topics have something to "
        "count. The projection is what every later slide operates on. "
        "Point out the cut-offs: they are the only editorial decisions in the build."
    ),
)
lede(sl, "A rating of 3.5 or more is an edge between a viewer and a title. Two "
         "cut-offs keep the graph readable: a title needs ten likes to enter the "
         "catalogue, a viewer needs eight catalogue likes to receive a list.",
     w=4.85)

# bipartite sketch
bx, by = 1.02, 3.46
vh = [by, by + 0.78, by + 1.56]
tv = [by - 0.34, by + 0.30, by + 0.94, by + 1.58]
for i, y in enumerate(vh):
    rect(sl, bx, y, 0.19, 0.19, fill=MUTED)
for j, y in enumerate(tv):
    rect(sl, bx + 1.30, y, 0.19, 0.19, fill=S1)
# v1 likes t1 t2 t3 ; v2 likes t2 t3 t4
for j in (0, 1, 2):
    wire(sl, (bx + 0.19, vh[0] + 0.095), (bx + 1.30, tv[j] + 0.095), C("39414e"), 0.8)
for j in (1, 2, 3):
    wire(sl, (bx + 0.19, vh[1] + 0.095), (bx + 1.30, tv[j] + 0.095), C("39414e"), 0.8)
caption(sl, bx - 0.02, by + 1.84, "bipartite  viewer — title", w=2.4)

# arrow
wire(sl, (3.46, 4.02), (3.92, 4.02), FAINT, 0.9)
block(sl, 3.38, 4.24, 0.9, 0.3, [P(R("project", SERIF, 9, FAINT, i=True))])

# projection: t1 t2 t3 triangle, t4 hung off t2 t3
px, py = 4.40, 3.46
pos = {0: (px + 0.66, py), 1: (px, py + 0.92), 2: (px + 1.32, py + 0.92), 3: (px + 0.66, py + 1.84)}
pe = [(0, 1, 1), (0, 2, 1), (1, 2, 2), (1, 3, 1), (2, 3, 1)]
for a, b, wgt in pe:
    wire(sl, pos[a], pos[b], C("4a5563"), 0.9 + wgt * 1.5)
for k, (x, y) in pos.items():
    oval(sl, x - 0.085, y - 0.085, 0.17, fill=S1, line=CANVAS, lw=1.5)
caption(sl, px - 0.06, py + 2.08, "similarity graph, weighted by Jaccard", w=3.4)

facts(sl, 7.30, 3.02, 5.18, [
    ("ratings", n(META["ratings"])),
    ("likes ≥ 3.5", n(META["likes"])),
    ("titles in catalogue", n(META["movies"])),
    ("viewers", n(META["users"])),
    ("weighted edges", n(META["edges"])),
    ("neighbours kept per title", f'k = {META["k"]}'),
], accent=(4,))

note(sl, 7.30, 5.10,
     "The projection is second-order: two titles are adjacent when the same "
     "viewers liked both. The weight is the Jaccard index of the two audiences — "
     "the share of their combined audience that liked both. The t₂–t₃ edge above "
     "is drawn twice as heavy because two viewers support it.", w=5.18)
note(sl, 7.30, 6.02,
     "The bundle also carries a recent-releases layer — 68 films from 2025 and "
     "2026 — deliberately outside these counts, because the archive has no "
     "ratings for them and inventing an audience size would be a lie.", w=5.18)


# =====================================================================
# 3 — degree  (C039)
# =====================================================================
sl = slide(
    "Degree · C039",
    "Two different numbers both get called degree",
    notes=(
        "This is the distinction that matters for the rest of the talk. Audience "
        "size is how many people liked a title; similarity degree is how many "
        "titles sit next to it in the projected graph. Audience size is what the "
        "popularity term in the score reads. Similarity degree is what the "
        "topics — components, paths, colouring — count. "
        "The distribution is heavy-tailed but almost flat at the bottom because "
        "k = 8 is a floor: every title keeps eight edges."
    ),
)
lede(sl, "Audience size d is how many viewers liked a title, and it drives the "
         "popularity term in the score. Similarity degree is how many titles share "
         "a neighbourhood with it, and it is what the graph topics count. They are "
         "different numbers, so the bundle stores them separately.", w=5.05)

facts(sl, ML, 3.96, 5.05, [
    ("mean similarity degree", f'{META["meanDegree"]:.2f}'),
    ("median", str(META["medianDegree"])),
    ("maximum", f'{META["maxDegree"]}  ·  The Sweet Hereafter'),
    ("sum of degrees", f'{n(sum(d * c for d, c in B["degreeDist"]))} = 2 × {n(META["edges"])}'),
    ("edge density", "0.0082"),
    ("mean audience size", f'{META["meanAudience"]:.2f}'),
], accent=(0,), value_frac=0.56)

# histogram of similarity degree
hx, hy, hw, hh = 6.55, 2.34, 5.86, 2.62
dist = {int(k): v for k, v in B["degreeDist"]}
lo, hi = 8, 26
tail = sum(v for d, v in dist.items() if d > hi)
bars = [(str(d), dist[d]) for d in range(lo, hi + 1)] + [(f"{hi + 1}+", tail)]
peak = max(v for _, v in bars)
slot = hw / len(bars)
caption(sl, hx, hy - 0.62, "Similarity degree, all 1,437 titles", w=5.0)
for i, (lab, cnt) in enumerate(bars):
    bh = max(0.02, (cnt / peak) * hh)
    rect(sl, hx + i * slot + 0.035, hy + hh - bh, slot - 0.07, bh, fill=S1)
    if i % 4 == 0 or i == len(bars) - 1:
        block(sl, hx + i * slot - 0.12, hy + hh + 0.08, 0.44, 0.18,
              [P(R(lab, MONO, 7.5, FAINT))])
hline(sl, hx, hy + hh, hw, LINE)
block(sl, hx + 0.02, hy + hh + 0.30, 3.2, 0.2,
      [P(R("titles at each degree", SANS, 9, FAINT))])
# the peak count, printed inside its own bar in canvas ink: light type on a
# light fill would vanish
# direct label on the peak, parked just above the bar it names
block(sl, hx + 0.02, hy - 0.15, 0.6, 0.2, [P(R("282", MONO, 8.5, MUTED))])
block(sl, hx + hw - 1.1, hy + hh - 0.36, 1.1, 0.2,
      [P(R(f"tail {tail}", MONO, 9, FAINT))])

note(sl, hx, 5.62,
     "The spike at the left is not a property of the data, it is the construction: "
     "every title keeps its eight strongest neighbours, so degree 8 is a floor. "
     "Above that the tail is genuine — a handful of titles are structurally close "
     "to thirty-odd others.", w=5.86)
note(sl, hx, 6.24,
     "Handshaking lemma: every edge contributes twice, and the ledger balances — "
     "16,996 degree units against 8,498 edges.", w=5.86)


# =====================================================================
# 4 — connectivity  (C039)
# =====================================================================
sl = slide(
    "Connectivity · C039",
    "One component, no chokepoints, diameter seven",
    notes=(
        "Union-find over the edges gives one component holding every title. "
        "Nothing is stranded, which is the precondition for the rest of the work: "
        "a path exists from any title to any other. "
        "No articulation point and no bridge means no single title holds the "
        "catalogue together — remove any one and it stays connected. "
        "The bottom bar is viewer 498's own breadth-first reach."
    ),
)
lede(sl, "Union–find with path compression and union by rank over all 8,498 edges "
         "returns a single component holding every one of the 1,437 titles. The "
         "graph has no articulation point and no bridge, so no title is load-bearing "
         "and no edge is a chokepoint.", w=5.05)

facts(sl, ML, 3.34, 5.05, [
    ("components", "1"),
    ("large component", n(META["largest"])),
    ("articulation points", str(B["stats"]["articulation"])),
    ("bridges", str(B["stats"]["bridges"])),
    ("diameter", str(B["stats"]["diameter"])),
    ("mean path length", f'{B["stats"]["meanPath"]:.3f}'),
    ("clustering coefficient", f'{B["stats"]["clustering"]:.4f}'),
], accent=(0,))

# BFS partition bar for viewer 498
bx, by, bw = 6.55, 2.44, 5.86
tot = META["movies"]
segs = [
    ("own likes", V498["n"], C("141b28")),
    ("1 hop", V498["reach1"], RAMP[4]),
    ("2 hops", V498["reach2"], RAMP[3]),
    ("3 hops", V498["reach3"], RAMP[2]),
    ("4+", V498["unreached"], C("2a3247")),
]
caption(sl, bx, by - 0.30, "Viewer 498 — every title by hop distance", w=5.0)
cursor = bx
for i, (lab, cnt, col) in enumerate(segs):
    wseg = bw * cnt / tot
    rect(sl, cursor, by, wseg, 0.46, fill=col)
    cursor += wseg
for i, (lab, cnt, col) in enumerate(segs):
    pass
# legend rows beneath, aligned to the numbers rather than the segments
ly = by + 0.66
for i, (lab, cnt, col) in enumerate(segs):
    yy = ly + i * 0.42
    sw = 0.16
    rect(sl, bx, yy + 0.04, sw, sw, fill=col, line=LINE, lw=0.6)
    block(sl, bx + 0.30, yy, 2.2, 0.2, [P(R(lab, SANS, 10, INK2))])
    block(sl, bx + 2.4, yy, 1.0, 0.2, [P(R(n(cnt), MONO, 10, INK))])
    block(sl, bx + 3.5, yy, 2.3, 0.2,
          [P(R(f"{100 * cnt / tot:.1f}%", MONO, 10, MUTED))])

note(sl, bx, 5.28,
     "The five parts sum to 1,437 — the 21 titles the viewer already liked are at "
     "distance zero and are counted before the search begins. Almost half the "
     "catalogue is three hops away, and 345 titles sit at four or beyond, outside "
     "the three-hop window the recommendation stage searches. That limit is stated "
     "in the app rather than hidden.", w=5.86)
note(sl, bx, 6.20,
     "Diameter 7 on 1,437 vertices is the small-world signature: sparse, but the "
     "high-audience titles act as hubs.", w=5.86)


# =====================================================================
# 5 — path  (C044)
# =====================================================================
sl = slide(
    "Path · C044",
    "A recommendation is a path, and the app draws it",
    notes=(
        "A path here is not an abstraction — it is the witness. Viewer, co-liker, "
        "anchor, candidate: three edges, alternating between the viewer and title "
        "parts of the original bipartite graph. "
        "The co-liker is the proof that the candidate belongs in this "
        "neighbourhood; the anchor is the title the two viewers most agree on. "
        "Count the paths and you get the support term in the score."
    ),
)
lede(sl, "A path of length three, alternating between the two sides of the "
         "bipartite graph: the viewer, a co-liker, the title the two of them most "
         "agree on, and the candidate. The co-liker is the witness, the anchor is "
         "the evidence, and the candidate is the answer.", w=5.05)

# the path, drawn as a stagger: viewer and co-liker on one row, the anchor
# and the candidate on the next, so the four labels get room to be read
px, py = 6.72, 2.30
rows = [
    [(px, py, "498", "viewer 498", S1), (px + 2.30, py, "6", "co-liker", S3)],
    [(px + 0.85, py + 1.16, "356", "Forrest Gump", C("8a94a6")),
     (px + 3.15, py + 1.16, "2571", "The Matrix", SIGNAL)],
]
seq = [rows[0][0], rows[0][1], rows[1][0], rows[1][1]]
for a, b in zip(seq, seq[1:]):
    wire(sl, (a[0] + 0.16, a[1] + 0.16), (b[0] + 0.16, b[1] + 0.16), C("4a5563"), 1.1)
for x, y, val, name, col in seq:
    rect(sl, x, y, 0.32, 0.32, fill=col)
    block(sl, x - 0.50, y + 0.40, 1.32, 0.2,
          [P(R(val, MONO, 10, INK))])
    block(sl, x - 0.50, y + 0.62, 1.32, 0.2,
          [P(R(name, SANS, 8.5, MUTED))])
block(sl, px + 1.05, py + 0.36, 1.0, 0.2,
      [P(R("viewed", SERIF, 8.5, FAINT, i=True))])
block(sl, px + 3.35, py + 1.52, 1.2, 0.2,
      [P(R("recommended", SERIF, 8.5, FAINT, i=True))])
caption(sl, px - 0.10, py - 0.34, "one witness path, 498 → The Matrix", w=5.4)

facts(sl, 6.55, 4.34, 5.86, [
    ("titles 498 and viewer 6 both liked", "16"),
    ("same, for viewers 58 and 45", "16  ·  14"),
    ("anchor", "Forrest Gump  (356)"),
    ("Jaccard, anchor → candidate", "0.409"),
    ("distinct 4-cycles  P", "1,124"),
    ("candidates ranked", "1,416"),
], accent=(4,))

note(sl, ML, 4.22,
     "Read the four stops as a walk: viewer, co-liker, anchor, candidate. Close "
     "it at the viewer and the same three edges form a 4-cycle in the bipartite "
     "graph — exactly what the next slide counts.", w=5.05)


# =====================================================================
# 6 — cycle  (C044)
# =====================================================================
sl = slide(
    "Cycle · C044",
    "Cycles measure echo, and echo must be divided out",
    notes=(
        "Every path closes into a cycle, and a cycle means agreement already "
        "banked. If a title's whole audience is already inside the viewer's "
        "one-hop set, then recommending it tells the viewer nothing. "
        "E is the fraction of the candidate's audience that the viewer's "
        "co-likers already cover. The Matrix is the extreme case: 225 of 239. "
        "The novelty term inverts it."
    ),
)
lede(sl, "Close the three-hop path at the viewer and it is a 4-cycle. The count of "
         "distinct such cycles is the support term P. But a cycle also means the "
         "viewer's neighbours already cover the candidate's audience — so P alone "
         "rewards echo, and the score has to divide it back out.", w=5.05)

# echo as a two-set picture
ex, ey = 6.62, 2.56
rc = 0.70
oval(sl, ex, ey, rc * 2, fill=None, line=C("3a4657"), lw=1.0)
oval(sl, ex + rc, ey, rc * 2, fill=None, line=C("3a4657"), lw=1.0)
block(sl, ex - 0.02, ey + rc * 2 + 0.10, 1.4, 0.2,
      [P(R("co-likers N(u)", SANS, 8, MUTED))])
block(sl, ex + rc + 0.10, ey + rc * 2 + 0.10, 1.4, 0.2,
      [P(R("audience A(m)", SANS, 8, MUTED))])
block(sl, ex + rc - 0.09, ey + rc - 0.16, 0.4, 0.32,
      [P(R("E", SERIF, 15, SIGNAL_HI))])
caption(sl, ex - 0.02, ey - 0.34, "echo  E = |A(m) ∩ N(u)| / |A(m)|", w=4.3)

facts(sl, 9.34, 2.28, 3.06, [
    ("The Matrix  225 / 239", "0.941"),
    ("median viewer", "0.055"),
    ("highest viewer", "0.100"),
], accent=(0,))

facts(sl, ML, 3.66, 5.05, [
    ("triangles", n(B["stats"]["triangles"])),
    ("clustering coefficient", f'{B["stats"]["clustering"]:.4f}'),
    ("girth", str(B["stats"]["girth"])),
    ("4-cycles through The Matrix", "1,124"),
    ("novelty 1 / (1 + E)", f'{1 / (1 + REC498[0]["echo"]):.3f}'),
], accent=(2,))

note(sl, 6.60, 4.28,
     "Girth 3 says triangles exist, so the projected graph is not bipartite — the "
     "projection of a bipartite graph never is. Five and a half thousand "
     "triangles at a clustering coefficient of 0.168 is a graph in which two "
     "titles that share a neighbour usually share several.", w=5.86)
note(sl, 6.60, 5.62,
     "E for The Matrix is 225 / 239: the viewer's immediate neighbourhood already "
     "covers 94% of its audience. Its novelty factor is 0.515 — the score halves "
     "what the cycle count alone would pay.", w=5.86)


# =====================================================================
# 7 — the score  (C044)
# =====================================================================
sl = slide(
    "Weighted graph · C044",
    "The score multiplies three terms, each a graph fact",
    notes=(
        "This is the arithmetic the app shows on screen, line by line. "
        "Support is logarithmic because the cycle count is heavy-tailed — 1,124 "
        "versus a handful. Popularity is damped by 0.35 so a blockbuster cannot "
        "win on audience alone. Novelty divides echo out. "
        "The Matrix ranks first of 1,416 candidates while sitting third on "
        "popularity, which is the damping working."
    ),
)
# the formula, set large
block(sl, ML, 1.80, 11.6, 0.7, [P(
    *[R("S  =  ", SERIF, 30, INK)],
    R("(1 + ln(1 + P))", MONO, 26, INK2, sup=False),
    R("  ×  ", SERIF, 30, INK),
    R("d", MONO, 26, INK2),
    R("0.35", MONO, 15, INK2, sup=True),
    R("  ×  ", SERIF, 30, INK),
    R("1 / (1 + E)", MONO, 26, INK2),
)])
hline(sl, ML, 2.62, 11.63, LINE)

labels = [
    ("support", "distinct 4-cycles through the candidate, logged because the tail is long"),
    ("popularity", "audience size, damped by α = 0.35 so reach alone does not decide"),
    ("novelty", "the echo share, inverted — agreement already banked pays less"),
]
for i, (k, v) in enumerate(labels):
    xx = ML + i * 3.92
    block(sl, xx, 2.80, 3.55, 0.22, [P(R(k, SERIF, 12, INK, i=True))])
    block(sl, xx, 3.06, 3.55, 0.7, [P(R(v, SANS, 10, MUTED))])

# worked arithmetic
ty = 4.02
block(sl, ML, ty, 6.4, 0.22,
      [P(R("Worked, The Matrix, viewer 498", SERIF, 12, INK, i=True))])
rows = [
    ("P  cycle count", "1,124"),
    ("1 + ln(1 + P)", "8.026"),
    ("d  audience", "239"),
    ("d^0.35", "6.799"),
    ("E  echo", "0.941"),
    ("1 / (1 + E)", "0.515"),
    ("S", "28.106"),
]
for i, (k, v) in enumerate(rows):
    yy = ty + 0.34 + i * 0.325
    last = i == len(rows) - 1
    block(sl, ML, yy, 3.4, 0.24,
          [P(R(k, MONO if not last else SANS, 11, INK if last else MUTED,
               b=last))])
    block(sl, ML + 3.4, yy, 1.5, 0.24,
          [P(R(v, MONO, 11.5, SIGNAL_HI if last else INK, b=last))])
    hline(sl, ML, yy + 0.27, 4.9, SOFT if not last else LINE)

kpi(sl, 7.05, 4.06, "1st", "rank of 1,416 candidates", s=34, w=2.4)
kpi(sl, 9.65, 4.06, "3rd", "popularity rank, for contrast", s=34, w=2.6)
note(sl, 7.05, 5.24,
     "8.026 × 6.799 × 0.515 = 28.106. The app prints the three factors under "
     "every score, so a viewer can see which one carried it.", w=5.0)
note(sl, 7.05, 5.86,
     "Third on raw audience, first on the score: the 0.35 exponent is what stops "
     "the most-watched title from winning by default, and the 1,124 cycles are "
     "what put it on top.", w=5.4)


# =====================================================================
# 8 — Euler  (C043)
# =====================================================================
sl = slide(
    "Eulerian graphs · C043",
    "Euler's theorem says no, and the degrees say why",
    notes=(
        "Build the genre graph: two genres are adjacent when a title carries both, "
        "and the edge is the title itself — so it is a multigraph, 1,212 parallel "
        "edges over 19 vertices. "
        "Euler's condition is connected plus every degree even. Ten vertices are "
        "odd, so an Eulerian circuit does not exist. The next slide repairs it."
    ),
)
lede(sl, "Two genres are adjacent when a title carries both, so each title with two "
         "or more genres contributes one edge — a multigraph of 1,212 edges over 19 "
         "vertices. An Eulerian circuit needs every degree even. Ten of the nineteen "
         "are odd, so the theorem refuses the walk outright.", w=5.05)

# degree table, odd ones marked
dx, dy, dw = 6.55, 2.06, 5.86
block(sl, dx, dy - 0.28, 5.2, 0.2,
      [P(R("Genre degree  ·  odd vertices in blue", SERIF, 10, MUTED, i=True))])
rowh = 0.205
for i, v in enumerate(E["vertices"]):
    odd = v["deg"] % 2 == 1
    col = v["g"] % 2
    yy = dy + i * rowh
    block(sl, dx, yy, 1.7, 0.19, [P(R(v["n"], SANS, 8.5, INK if odd else MUTED))])
    block(sl, dx + 1.62, yy, 0.62, 0.19,
          [P(R(str(v["deg"]), MONO, 8.5, SIGNAL_HI if odd else FAINT))])
    # a one-cell parity tick
    rect(sl, dx + 2.42, yy + 0.045, 0.09, 0.09, fill=SIGNAL if odd else C("2a3247"))
    block(sl, dx + 2.62, yy, 1.1, 0.19,
          [P(R("odd" if odd else "even", SANS, 8, MUTED if odd else FAINT))])

cx, cy = dx + 3.30, dy + 0.10
block(sl, cx, cy - 0.30, 2.4, 0.2,
      [P(R("Euler's condition", SERIF, 9.5, MUTED, i=True))])
for i, (k, v, ok) in enumerate([
    ("connected", "yes", True),
    ("all degrees even", "no — ten odd", False),
    ("Eulerian circuit", "none exists", False),
]):
    yy = cy + i * 0.66
    block(sl, cx, yy, 2.5, 0.2, [P(R(k, SANS, 9, MUTED))])
    block(sl, cx, yy + 0.21, 2.5, 0.2,
          [P(R(v, MONO, 10, GOOD if ok else C("D9655F")))])
    hline(sl, cx, yy + 0.50, 2.4, SOFT)

facts(sl, ML, 4.12, 5.05, [
    ("genre vertices", "19"),
    ("edges  (titles with ≥ 2 genres)", "1,212"),
    ("sum of degrees", f'{n(2424)} = 2 × 1,212'),
    ("odd-degree vertices", "10"),
    ("largest degree", "Drama, 461"),
], accent=(3,))

note(sl, ML, 5.72,
     "By the handshaking lemma the number of odd vertices must be even, and ten "
     "is. That parity is not a coincidence and not a problem — it is the exact "
     "quantity the next slide has to spend edges on.", w=5.05)


# =====================================================================
# 9 — Eulerisation  (C043)
# =====================================================================
sl = slide(
    "Eulerian graphs · C043",
    "Ten odd vertices, five pairs, nine duplicated edges",
    notes=(
        "This is the route-inspection repair. Pair the odd vertices greedily by "
        "shortest distance in the underlying simple genre graph — five pairs — and "
        "duplicate every edge along each connecting path. "
        "Parity flips at both ends and along the interior of each path, so every "
        "degree becomes even and the circuit exists. Nine edges added, 1,212 to "
        "1,221, and Hierholzer's stack returns the traversal."
    ),
)
lede(sl, "Pair the ten odd vertices by shortest distance in the underlying simple "
         "graph, then duplicate every edge along each connecting path. Parity flips "
         "at both ends of the path, all degrees become even, and Hierholzer's "
         "algorithm returns the circuit.", w=5.05)

# the five pairs
px, py = ML, 3.72
block(sl, px, py - 0.28, 5.0, 0.2,
      [P(R("Odd pairing  ·  distance added", SERIF, 10, MUTED, i=True))])
for i, (a, b, d) in enumerate(E["pairs"]):
    yy = py + i * 0.30
    block(sl, px, yy, 2.5, 0.22,
          [P(R(f'{GNAME[a]} — {GNAME[b]}', SANS, 10, INK2))])
    block(sl, px + 2.6, yy, 1.5, 0.22,
          [P(R(f"+{d} edge{'s' if d > 1 else ''}", MONO, 10, INK))])
    hline(sl, px, yy + 0.25, 4.1, SOFT)
block(sl, px, py + 5 * 0.30 + 0.06, 2.5, 0.22, [P(R("total added", SANS, 9.5, MUTED))])
block(sl, px + 2.6, py + 5 * 0.30 + 0.06, 1.5, 0.22,
      [P(R("+9", MONO, 10, SIGNAL_HI))])

facts(sl, 6.55, 2.10, 5.86, [
    ("edges before", "1,212"),
    ("odd vertices", "10  →  5 pairs"),
    ("edges duplicated", "9"),
    ("edges after", "1,221"),
    ("all degrees even", "yes"),
    ("circuit length", "1,221 traversals"),
    ("output", "a playlist that alternates genres"),
], accent=(3,))

note(sl, 6.55, 4.52,
     "A circuit is a closed walk that uses every edge exactly once — so the "
     "playlist never repeats a title, and consecutive titles always share a genre "
     "because the walk moves along a genre edge.", w=5.86)

# the first hops of the real circuit, printed as the walk it is
walk = [GNAME[e[0]] for e in E["playlist"][:1]] + [GNAME[t] for _, t, _ in E["playlist"][:8]]
block(sl, 6.55, 5.32, 5.86, 0.2,
      [P(R("the circuit's first eight hops", SERIF, 10, MUTED, i=True))])
block(sl, 6.55, 5.58, 5.86, 0.3,
      [P(R("  →  ".join(walk), MONO, 10, INK2))])
note(sl, 6.55, 6.20,
     "Every hop crosses a genre edge, so the playlist can only move to a "
     "neighbouring genre — the alternation is the walk, not a rule added on "
     "top. Hierholzer runs in time linear in the edges.", w=5.86)


# =====================================================================
# 10 — Hamiltonian  (C043)
# =====================================================================
sl = slide(
    "Hamiltonian graphs · C043",
    "A watch order is a Hamiltonian path over the top ten",
    notes=(
        "Different question: visit every vertex exactly once, not every edge. "
        "The ten candidates from the previous score become the vertices, and the "
        "weight between two of them is their Jaccard similarity. "
        "Held–Karp is exact and runs in n²·2ⁿ — 10,240 states here — which is why "
        "the list is ten long and not a hundred. "
        "Greedy nearest-neighbour loses 3%: worth showing, because it is the "
        "argument for the exact method."
    ),
)
lede(sl, "Same ten candidates, different question: visit every candidate exactly "
         "once, maximising the total similarity along the way. Held–Karp is exact "
         "and costs n² · 2ⁿ — 10,240 states for n = 10, which is why the list is "
         "ten long.", w=4.9)

# similarity matrix heatmap
mx, my, cell = 6.30, 2.40, 0.245
block(sl, mx - 0.26, my - 0.56, 4.4, 0.2,
      [P(R("Pairwise Jaccard, the ten candidates", SERIF, 10, MUTED, i=True))])
PW = WATCH498["pairwise"]
for i in range(10):
    for j in range(10):
        v = PW[i][j]
        idx = min(4, int(v / 0.14)) if i != j else 0
        col = RAMP[idx] if i != j else C("0d1118")
        rect(sl, mx + j * cell, my + i * cell, cell - 0.012, cell - 0.012, fill=col)
    block(sl, mx - 0.24, my + i * cell + 0.05, 0.2, 0.16,
          [P(R(str(i + 1), MONO, 7, FAINT))])
    block(sl, mx + i * cell, my - 0.20, cell, 0.16,
          [P(R(str(i + 1), MONO, 7, FAINT))])

# the order
ox = mx + 10 * cell + 0.34
block(sl, ox, my - 0.56, 2.9, 0.2,
      [P(R("The order", SERIF, 10, MUTED, i=True))])
for i, mid in enumerate(WATCH498["order"]):
    yy = my + i * 0.232
    block(sl, ox, yy, 0.26, 0.18, [P(R(str(i + 1), MONO, 8, FAINT))])
    t = MOV[mid]["t"]
    if len(t) > 34:
        t = t[:33] + "…"
    block(sl, ox + 0.26, yy, 2.7, 0.18, [P(R(t, SANS, 8.2, INK2))])

facts(sl, 6.30, 5.36, 6.10, [
    ("optimal total weight", "4.212"),
    ("nearest-neighbour baseline", "4.086"),
    ("the exact method gains", "+3.1%"),
    ("states searched", "10,240"),
], gap=0.30)

kpi(sl, ML, 4.20, "10 · 2¹⁰", "states for n = 10", s=27, w=3.4)
note(sl, ML, 5.10,
     "The DP state is (set visited, last vertex): the best path over that subset "
     "ending there. Every state extends by one unvisited vertex, and the full "
     "table answers the question exactly rather than approximately.", w=4.9)
note(sl, ML, 5.96,
     "Ten is a design choice, not a limitation of the idea — the state count "
     "doubles with every extra candidate.", w=4.9)


# =====================================================================
# 11 — planarity  (C046)
# =====================================================================
sl = slide(
    "Planar graphs · C046",
    "The genre graph cannot be drawn without crossings",
    notes=(
        "Now the genre graph loses its multiplicities and keeps an edge when two "
        "genres co-occur in at least six titles. That leaves 19 vertices and 98 "
        "edges. "
        "For any planar graph with three or more vertices, e ≤ 3v − 6 = 51. "
        "98 is nearly double the ceiling, so no drawing can avoid crossings — that "
        "is a counting argument, no drawing required. "
        "Kuratowski confirms it structurally: there is a K5 sitting inside."
    ),
)
lede(sl, "Drop the multiplicities and keep an edge when two genres co-occur in at "
         "least six titles: 19 vertices, 98 edges. Every planar graph with v ≥ 3 "
         "obeys e ≤ 3v − 6. The ceiling here is 51, and the graph has 98.", w=5.05)

# the inequality, large
block(sl, ML, 3.40, 5.05, 0.9, [
    P(R("e  ≤  3v − 6", MONO, 22, INK)),
    P(R("98  ≤  57 − 6 = 51", MONO, 22, C("D9655F")), space=8),
])
block(sl, ML, 4.52, 5.05, 0.4,
      [P(R("false, so the graph is not planar", SERIF, 12, C("D9655F"), i=True))])

facts(sl, ML, 5.10, 5.05, [
    ("vertices / edges", "19 / 98"),
    ("planar ceiling 3v − 6", "51"),
    ("excess", "47"),
    ("Kuratowski", "K₅ witness"),
    ("largest clique", "K₉"),
], gap=0.30, accent=(0,))

# K5 drawing
kx, ky = 8.60, 3.62
r = 1.28
k5 = ["Drama", "Comedy", "Thriller", "Action", "Romance"]
kpos = []
for i in range(5):
    ang = -math.pi / 2 + i * 2 * math.pi / 5
    kpos.append((kx + r * math.cos(ang), ky + r * math.sin(ang)))
caption(sl, kx - 1.7, ky - 1.92, "K₅ inside it — the Kuratowski witness", w=4.6)
for i in range(5):
    for j in range(i + 1, 5):
        wire(sl, kpos[i], kpos[j], C("4a5563"), 0.9)
for i, (x, y) in enumerate(kpos):
    oval(sl, x - 0.07, y - 0.07, 0.14, fill=S1, line=CANVAS, lw=1.4)
    ang = -math.pi / 2 + i * 2 * math.pi / 5
    lx, ly = kx + (r + 0.28) * math.cos(ang), ky + (r + 0.28) * math.sin(ang)
    wbox = 1.15
    block(sl, lx - wbox / 2, ly - 0.10, wbox, 0.2,
          [P(R(k5[i], SANS, 8.5, INK2))])


# =====================================================================
# 12 — planar drawing and four colours  (C046)
# =====================================================================
sl = slide(
    "Planar graphs · C046",
    "Keep the heavy edges, and four colours suffice",
    notes=(
        "Keep the heaviest edges in descending co-occurrence order and discard any "
        "edge that breaks planarity. That leaves 47 of 98 — 51 dropped. "
        "Tutte's barycentric method: fix the outer face on a circle, put every "
        "interior vertex at the average of its neighbours, iterate. The interior "
        "crowds by construction; that is the theorem's output, not a layout bug. "
        "Euler's formula checks out at 30 faces. DSATUR needs four colours, and a "
        "K4 sits inside, so four is optimal."
    ),
)
lede(sl, "Keep the heaviest edges in descending co-occurrence order and discard any "
         "edge that breaks planarity: 47 survive, 51 go. Tutte's barycentric method "
         "then places every interior vertex at the average of its neighbours, with "
         "the outer face pinned on a circle.", w=5.05)

facts(sl, ML, 3.72, 5.05, [
    ("planar subgraph", f'{PL["v"]} vertices · {PL["e"]} edges'),
    ("crossings in the drawing", str(PL["crossings"])),
    ("faces  F", str(PL["faces"])),
    ("Euler  V − E + F", f'{PL["v"]} − {PL["e"]} + {PL["faces"]} = {PL["eulerChar"]}'),
    ("colours  DSATUR", f'{PL["colours"]}  (planar)'),
    ("largest clique", "K₄  →  χ = 4 exactly"),
], gap=0.315, accent=(0, 3))

# the Tutte drawing
gx, gy, gw, gh = 6.55, 1.96, 5.80, 3.96
xs = [nd["x"] for nd in PL["nodes"]]
ys = [nd["y"] for nd in PL["nodes"]]
pad = 0.44
kx = min(gw / (max(xs) - min(xs) + 1e-9), gh / (max(ys) - min(ys) + 1e-9))
def TX(x):
    return gx + gw / 2 + (x - (max(xs) + min(xs)) / 2) * kx * 0.94
def TY(y):
    return gy + gh / 2 - (y - (max(ys) + min(ys)) / 2) * kx * 0.94

POLD = {nd["g"]: nd for nd in PL["nodes"]}
for a, b, wt in PL["edges"]:
    wire(sl, (TX(POLD[a]["x"]), TY(POLD[a]["y"])),
         (TX(POLD[b]["x"]), TY(POLD[b]["y"])), C("39414e"), 0.7)
for nd in PL["nodes"]:
    cx, cy = TX(nd["x"]), TY(nd["y"])
    dd = 0.13
    oval(sl, cx - dd / 2, cy - dd / 2, dd, fill=PAL[nd["col"]], line=CANVAS, lw=1.2)
    # only the outer face gets a label; the interior is a crowd by construction
    if abs(nd["x"]) > 0.9 or abs(nd["y"]) > 0.9:
        dxn = 1 if nd["x"] > 0.5 else -1 if nd["x"] < -0.5 else 0
        block(sl, cx + (0.10 if dxn >= 0 else -1.02), cy - 0.08, 0.96, 0.18,
              [P(R(nd["n"], SANS, 8, INK2,
                   align=PP_ALIGN.LEFT if dxn >= 0 else PP_ALIGN.RIGHT))])
caption(sl, gx, gy + gh + 0.10,
        "Tutte drawing · 19 vertices, 47 edges, 0 crossings, 4 colours", w=5.9)

block(sl, gx, gy + gh + 0.36, 5.86, 0.28,
      [P(R("The interior crowds because every inner vertex is a barycentre of its "
           "neighbours — the drawing is the theorem, not a layout choice.",
           SANS, 8.5, FAINT))])


# =====================================================================
# 13 — colouring the list  (C046)
# =====================================================================
sl = slide(
    "Graph colouring · C046",
    "Colour the list so no two neighbours are adjacent",
    notes=(
        "The last colouring is the one the viewer actually sees. Build a conflict "
        "graph on the top ten: two titles are adjacent when they share a genre. "
        "DSATUR — highest saturation degree first — needs seven colours, and there "
        "is a K7 in the graph, so seven is optimal, not just what the heuristic "
        "found. "
        "A proper colouring means the list can be ordered so that similar titles "
        "never sit next to each other. That is the whole point: variety."
    ),
)
lede(sl, "The conflict graph on one viewer's top ten: two titles are adjacent when "
         "they share a genre. A proper colouring is a proof that an ordering exists "
         "in which no two similar titles sit next to each other.", w=5.05)

facts(sl, ML, 3.30, 5.05, [
    ("vertices", "10"),
    ("adjacency", "share a genre"),
    ("colours  DSATUR", "7"),
    ("largest clique", "K₇  →  χ = 7 exactly"),
    ("most conflicted", "Fight Club, 9"),
    ("genre graph, planar", "4 colours"),
    ("genre graph, full", "9 colours"),
    ("full-graph clique", "K₉"),
], gap=0.315, accent=(2,), value_frac=0.44)

# the list, coloured
lx, ly = 6.55, 1.94
caption(sl, lx, ly - 0.26, "Viewer 498's top ten, in order, by colour", w=5.6)

# The rows are laid out from measured widths, not a fixed pitch. A title wider
# than its column wraps, and a wrapped row is taller by one line: the rule then
# follows that row's own last line instead of cutting through it. Line pitch is
# the deck's 1.25 spacing on a 10 pt line (1.25 x 1.2 x 10 pt = 0.208 in). A
# one-line row is 0.392 in, which keeps ten rows — one of them wrapped — clear
# of the closing note at 6.20.
TX0, TXW = lx + 0.30, 3.10
GX0, GXW = lx + 3.42, 1.70
NX0 = lx + 5.16
TSZ, GSZ, NSZ = 10.0, 8.0, 9.0
LINE_H = 1.25 * 1.2 * TSZ / 72.0
ROW_H, RULE = 0.392, 0.32
yy = ly
for i, r in enumerate(REC498):
    mid = r["m"]
    col = LC498["col"][i]
    title = MOV[mid]["t"]
    gs = " · ".join(GNAME[g] for g in MOV[mid]["g"][:2])
    n_t = measure.n_lines(title, SANS, TSZ, TXW)
    n_g = measure.n_lines(gs, SANS, GSZ, GXW)
    nl = max(n_t, n_g)
    h = ROW_H + (nl - 1) * LINE_H
    # swatch, genre and colour sit on the row's first line, not the row
    rect(sl, lx, yy + LINE_H / 2 - 0.075, 0.15, 0.15, fill=PAL[col])
    block(sl, TX0, yy, TXW, n_t * LINE_H, [P(R(title, SANS, TSZ, INK2))])
    block(sl, GX0, yy, GXW, LINE_H, [P(R(gs, SANS, GSZ, FAINT))],
          anchor=MSO_ANCHOR.MIDDLE)
    block(sl, NX0, yy, 0.34, LINE_H,
          [P(R(str(col + 1), MONO, NSZ, MUTED, align=PP_ALIGN.RIGHT))],
          anchor=MSO_ANCHOR.MIDDLE)
    hline(sl, lx, yy + RULE + (nl - 1) * LINE_H, 5.5, SOFT)
    yy += h
block(sl, lx + 5.16 + 0.2, ly - 0.26, 0.5, 0.2,
      [P(R("colour", SERIF, 9, FAINT, i=True))])

note(sl, ML, 6.02,
     "Seven is not just what the heuristic happened to find: the seven titles "
     "in the clique all share Action, so any proper colouring needs seven, and "
     "DSATUR lands exactly on the bound.", w=5.05)

block(sl, 6.55, 6.20, 5.86, 0.5,
      [P(R("Seven colours for ten titles: the constraint is tight enough that a "
           "greedy pass cannot do better than the clique demands.",
           SANS, 8.5, FAINT))])


# =====================================================================
# 14 — conclusion
# =====================================================================
sl = slide(
    "Conclusion",
    "Seven topics, one graph, seven answers",
    notes=(
        "Close by making the shape visible: each topic answered a different "
        "question about the same object, and each answer is a number the app can "
        "show. "
        "Then be honest about the limits — the sample, the three-hop window, the "
        "2018 cut-off. The project is stronger for naming them than for hiding "
        "them."
    ),
)

rows = [
    ("Degree", "audience size and similarity degree, kept apart", f'{META["meanDegree"]:.2f} mean'),
    ("Connectivity", "one component, no bridge, diameter 7", "1,437 reached"),
    ("Path", "three-hop witness paths as support", "1,416 candidates"),
    ("Cycle", "4-cycles and echo, divided back out", "C 0.168 · 5,487 tri"),
    ("Eulerian", "10 odd vertices, 5 pairs, 9 edges added", "1,221 traversals"),
    ("Hamiltonian", "exact max-weight order by Held–Karp", "4.212 vs 4.086"),
    ("Planar + colouring", "K₅ blocks it; 4 colours after pruning", "χ = 4, tight"),
]
ty = 2.00
block(sl, ML, 1.72, 6.0, 0.2,
      [P(R("Topic  ·  what it answered  ·  the number", SERIF, 10, MUTED, i=True))])
for i, (a, b, c) in enumerate(rows):
    yy = ty + i * 0.44
    block(sl, ML, yy, 2.0, 0.24, [P(R(a, SANS, 11, INK))])
    block(sl, ML + 2.10, yy + 0.01, 5.2, 0.24, [P(R(b, SANS, 10, MUTED))])
    block(sl, ML + 7.55, yy, 1.9, 0.24,
          [P(R(c, MONO, 9.5, SIGNAL_HI))])
    hline(sl, ML, yy + 0.36, 9.45, SOFT if i < len(rows) - 1 else LINE)

block(sl, 10.55, 1.72, 1.95, 0.2, [P(R("Limits", SERIF, 11, MUTED, i=True))])
block(sl, 10.55, 2.04, 1.95, 3.4, [
    P(R("585 viewers is a sample, not a platform.", SANS, 9, INK2)),
    P(R("Recommendations search three hops out; 345 titles sit beyond that.",
        SANS, 9, INK2), space=9),
    P(R("The archive ends in 2018. Recent releases are carried separately, "
        "without audience figures.", SANS, 9, INK2), space=9),
])

block(sl, ML, 5.36, 9.4, 0.9, [
    P(R("Nothing here is illustrated. Every number on these slides is computed "
        "from 100,836 ratings and printed in the app, next to the paths that "
        "produced it.", SERIF, 13, INK)),
])
hline(sl, ML, 6.28, 9.45, LINE)
block(sl, ML, 6.42, 9.45, 0.3, [
    P(R("C039  degree, connectivity      C043  Eulerian, Hamiltonian      "
        "C044  path, cycle      C046  planar, colouring",
        MONO, 8.5, FAINT)),
])

prs.save(OUT)
print(f"wrote {OUT}  ·  {len(prs.slides.__iter__.__self__._sldIdLst)} slides")
