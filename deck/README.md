# Deck

Fourteen slides: a title slide, twelve content slides (three per presenter), a
conclusion. Every number is read from `web/public/data/bundle.json` or from the
same MovieLens files the pipeline reads, so the deck and the app cannot drift.

| File | What it is |
|---|---|
| `NextFrame.pptx` | the deck |
| `NextFrame.pdf` | the same deck, exported from PowerPoint, for a machine without Plex installed |
| `build_deck.py` | the generator — all layout and copy live here |
| `measure.py` | measures the shipping fonts so a title or a value can be fitted rather than guessed |
| `build_fonts.py` | turns the app's woff2 files into TTFs and registers them for the current user |
| `fonts/` | the eight generated TTFs |
| `render/` | slide PNGs, exported from PowerPoint, used to check each pass |

## Rebuild

```sh
python deck/build_fonts.py     # once per machine, per-user, no admin rights
python deck/build_deck.py      # writes NextFrame.pptx
```

`build_fonts.py` is idempotent: it rewrites the TTFs, copies them into
`%LOCALAPPDATA%\Microsoft\Windows\Fonts`, and points
`HKCU\Software\Microsoft\Windows NT\CurrentVersion\Fonts` at them. Deleting
those files undoes it.

## Structure

| Slides | Presenter | Topic |
|---|---|---|
| 2–4 | C039 | graph construction, degree, connectivity |
| 5–7 | C043 | path, cycle, the weighted score |
| 8–10 | C044 | Euler's condition, Eulerisation, Hamiltonian order |
| 11–13 | C046 | planarity, the planar drawing, colouring |

## Conventions

- Type is IBM Plex Serif for titles and labels, Plex Sans for prose, Plex Mono
  for every numeral — the three faces the app sets.
- Labels are serif italic, sentence case, untracked. Never tracked mono caps.
- Colours are the app's own tokens (`#00040a` canvas, `#2f7bef` signal) plus the
  validated categorical palette the charts use. The blue ramp encodes magnitude
  only.
- Diagrams are native PowerPoint shapes, not images, so any slide can be edited
  in place.
