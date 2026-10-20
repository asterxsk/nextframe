"""
build_fonts.py
==============
Turns the woff2 files already vendored for the web app into the static TTFs a
PowerPoint deck needs, then registers them for the current user.

The deck sets IBM Plex Serif / Sans / Mono, the same three faces the app uses.
None of them ship with Windows, so without this step PowerPoint silently
substitutes Cambria and Segoe and the deck stops looking like the product.
Installation is per-user (HKCU + %LOCALAPPDATA%\\Microsoft\\Windows\\Fonts):
no administrator rights, and deleting the files undoes it.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "node_modules")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fonts")

SERIF = os.path.join(WEB, "@fontsource", "ibm-plex-serif", "files")
MONO = os.path.join(WEB, "@fontsource", "ibm-plex-mono", "files")
SANS = os.path.join(WEB, "@fontsource-variable", "ibm-plex-sans", "files")

# (output name, source file, variable axis pin or None)
JOBS = [
    ("IBMPlexSerif-Regular.ttf", os.path.join(SERIF, "ibm-plex-serif-latin-400-normal.woff2"), None),
    ("IBMPlexSerif-Italic.ttf", os.path.join(SERIF, "ibm-plex-serif-latin-400-italic.woff2"), None),
    ("IBMPlexSerif-SemiBold.ttf", os.path.join(SERIF, "ibm-plex-serif-latin-600-normal.woff2"), None),
    ("IBMPlexMono-Regular.ttf", os.path.join(MONO, "ibm-plex-mono-latin-400-normal.woff2"), None),
    ("IBMPlexMono-Medium.ttf", os.path.join(MONO, "ibm-plex-mono-latin-500-normal.woff2"), None),
    ("IBMPlexSans-Regular.ttf", os.path.join(SANS, "ibm-plex-sans-latin-wght-normal.woff2"), 400),
    ("IBMPlexSans-Medium.ttf", os.path.join(SANS, "ibm-plex-sans-latin-wght-normal.woff2"), 500),
    ("IBMPlexSans-SemiBold.ttf", os.path.join(SANS, "ibm-plex-sans-latin-wght-normal.woff2"), 600),
]

# family name -> the files that make it up, for the registry
FAMILIES = {
    "IBM Plex Serif": [("IBM Plex Serif", "IBMPlexSerif-Regular.ttf"),
                       ("IBM Plex Serif Italic", "IBMPlexSerif-Italic.ttf"),
                       ("IBM Plex Serif SemiBold", "IBMPlexSerif-SemiBold.ttf")],
    "IBM Plex Mono": [("IBM Plex Mono", "IBMPlexMono-Regular.ttf"),
                      ("IBM Plex Mono Medium", "IBMPlexMono-Medium.ttf")],
    "IBM Plex Sans": [("IBM Plex Sans", "IBMPlexSans-Regular.ttf"),
                      ("IBM Plex Sans Medium", "IBMPlexSans-Medium.ttf"),
                      ("IBM Plex Sans SemiBold", "IBMPlexSans-SemiBold.ttf")],
}


# family, subfamily, weight class, output file — the name table has to be
# rewritten after instancing, because every instance of a variable font
# carries the *default* instance's names and Windows would register all three
# Sans weights as the same font.
NAMES = {
    "IBMPlexSerif-Regular.ttf": ("IBM Plex Serif", "Regular", 400),
    "IBMPlexSerif-Italic.ttf": ("IBM Plex Serif", "Italic", 400),
    "IBMPlexSerif-SemiBold.ttf": ("IBM Plex Serif SemiBold", "Regular", 600),
    "IBMPlexMono-Regular.ttf": ("IBM Plex Mono", "Regular", 400),
    "IBMPlexMono-Medium.ttf": ("IBM Plex Mono Medium", "Regular", 500),
    "IBMPlexSans-Regular.ttf": ("IBM Plex Sans", "Regular", 400),
    "IBMPlexSans-Medium.ttf": ("IBM Plex Sans Medium", "Regular", 500),
    "IBMPlexSans-SemiBold.ttf": ("IBM Plex Sans SemiBold", "Regular", 600),
}


def rename(font, family, style, weight):
    full = family if style == "Regular" else f"{family} {style}"
    postscript = full.replace(" ", "")
    # name IDs 1/2 are the Windows family and style; 4 is the full name and 6
    # the PostScript name. 16/17 must agree with 1/2 or GDI+ lists the family
    # twice.
    for rec in list(font["name"].names):
        if rec.nameID in (1, 2, 3, 4, 6, 16, 17, 21, 22):
            font["name"].removeNames(rec.nameID)
    for nid, text in ((1, family), (2, style), (4, full), (6, postscript),
                      (16, family), (17, style)):
        font["name"].setName(text, nid, 3, 1, 0x409)
        font["name"].setName(text, nid, 1, 0, 0)
    font["OS/2"].usWeightClass = weight
    # fsSelection: bit 0 ITALIC, bit 5 BOLD, bit 6 REGULAR. Getting these wrong
    # (an "italic" file flagged bold, a "regular" flagged neither) makes GDI
    # refuse the face and Windows silently falls back to a system font.
    sel = font["OS/2"].fsSelection & ~0b1100001
    if "Italic" in style:
        sel |= 0b1
    else:
        sel |= 0b1000000
    if weight >= 700:
        sel |= 0b100000
    font["OS/2"].fsSelection = sel
    font["head"].macStyle = (2 if "Italic" in style else 0) | (1 if weight >= 700 else 0)


def convert():
    os.makedirs(OUT, exist_ok=True)
    for name, src, pin in JOBS:
        font = TTFont(src)
        if pin is not None:
            font = instantiateVariableFont(font, {"wght": pin})
        # a static TTF should not advertise itself as variable
        font.flavor = None
        for tag in ("fvar", "gvar", "avar", "STAT", "HVAR"):
            if tag in font:
                del font[tag]
        rename(font, *NAMES[name])
        dst = os.path.join(OUT, name)
        font.save(dst)
        print(f"  {name:<28} {os.path.getsize(dst) // 1024:>4} KB  "
              f"{NAMES[name][0]} / {NAMES[name][1]}")


def install():
    """Copy into the per-user font folder and register each face."""
    dest = os.path.join(os.environ["LOCALAPPDATA"], "Microsoft", "Windows", "Fonts")
    os.makedirs(dest, exist_ok=True)
    reg = r"HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts"

    for family, faces in FAMILIES.items():
        for face, filename in faces:
            src = os.path.join(OUT, filename)
            copy = os.path.join(dest, filename)
            shutil.copyfile(src, copy)
            # full path, not just the file name: user-scope fonts are not on
            # the system font path, and the registry entry is how Windows
            # finds them at logon
            key = f"{face} (TrueType)"
            subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 f'New-ItemProperty -Path "{reg}" -Name "{key}" '
                 f'-Value "{copy}" -PropertyType String -Force | Out-Null'],
                check=True,
            )
            print(f"  registered {face}")
    print("\nRegistered for this user. Open the deck and the faces resolve; "
          "a machine without them substitutes Cambria / Segoe UI.")


if __name__ == "__main__":
    print("converting woff2 -> ttf")
    convert()
    if "--no-install" not in sys.argv:
        print("\ninstalling for the current user")
        install()
