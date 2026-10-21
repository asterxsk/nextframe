# NextFrame

**[Open the app → asterxsk.github.io/nextframe](https://asterxsk.github.io/nextframe/)**

A recommendation engine built as a graph problem, for the Discrete Mathematics
semester project *Graph Theory in Streaming Recommendations* (Semester VII,
Division B, Batch B2 — C039, C043, C044, C046).

Movies are nodes and a shared audience is an edge. Every course topic answers a
different question about that graph, and every number in the app and the deck is
computed from the same MovieLens files — nothing on screen is illustrative.

| | |
|---|---|
| **App** | <https://asterxsk.github.io/nextframe/> |
| **Deck** | [`deck/NextFrame.pdf`](deck/NextFrame.pdf) · [`deck/NextFrame.pptx`](deck/NextFrame.pptx) |
| **Plan** | [`plan.txt`](plan.txt) · [`Graph_Theory_Streaming_Recommendations_Plan.pdf`](Graph_Theory_Streaming_Recommendations_Plan.pdf) |

## The seven topics

| Topic | What it does here | Where |
|---|---|---|
| **Degree** | Audience size of a title drives the damping term; similarity-graph degree is the popularity measure the topics count | catalogue, graph view, stats |
| **Connectivity** | Union–find over the similarity graph; per-viewer reachability at one, two and three hops | stats, graph view |
| **Path** | Shortest alternating viewer → title → viewer paths; path count is the signal a recommendation is built from | every recommendation row |
| **Cycle** | Four-cycles are the same alternating paths longer round, and `echo` — the share of a title's audience already in your one-hop neighbourhood — is the novelty penalty | the score, list colouring |
| **Eulerian** | Genre-transition multigraph, Eulerised, then a Hierholzer circuit as a playlist that changes genre smoothly | topics |
| **Hamiltonian** | Exact maximum-weight Hamiltonian path over ten candidates (Held–Karp) as a single watch order | topics |
| **Planar + colouring** | Genre map drawn as a planar graph (Tutte), four-coloured; DSATUR colouring keeps similar items off adjacent rows | topics, list colouring |

The score on every recommendation is
`(1 + log(1 + cycles)) · audience^0.35 · 1/(1 + echo)`: path support first,
popularity damped, novelty rewarded.

## Repository

```text
data/raw/ml-latest-small/   MovieLens ml-latest-small, committed (100,836 ratings)
data/recent/               2025–26 Hindi releases, outside the archive
pipeline/build_bundle.py   reads the CSVs, writes web/public/data/bundle.json
pipeline/tune.py           scratch sweeps for the damping and novelty exponents
web/                       the React app (Vite + Tailwind v4)
deck/                      the PowerPoint deck and its generator
```

The whole app is one generated file: `web/public/data/bundle.json` holds the
graph, the layouts, every viewer's recommendation list and the computed topic
statistics. The front end only renders it — no recommendation is calculated in
the browser. `deck/README.md` covers the deck's own rebuild.

### Rebuild the bundle

```sh
pip install -r pipeline/requirements.txt
python pipeline/build_bundle.py            # add --minify for the deploy build
```

### Run the app

```sh
cd web
npm install
npm run dev        # http://localhost:8123
npm run build      # production build into web/dist
```

Pushing to `main` deploys `web/dist` to GitHub Pages via
`.github/workflows/deploy.yml`. CI typechecks, then asserts that every
font the CSS references is actually published under the `/nextframe/` base path.

## The recent-releases layer

The MovieLens snapshot ends in September 2018, so a 2025 Hindi release has no
ratings in it: no audience, no similarity edges, no path count. Inventing those
numbers would fake the very thing the project measures. They therefore travel
in their own list in the bundle (`recent`) with real titles, years and genres,
and `d` / `gd` left `null` — and the UI never prints a zero where it has no
measurement.

They are still first-class in the app. Onboarding's title search lists them
alongside archive titles and they can be picked like any other film; because
the archive never rated them, the viewer match falls back to genre overlap —
the only signal the archive carries for a film it has never seen. The catalogue
keeps them in a separate "Recent releases · listed, not scored" block.

## Data

[MovieLens ml-latest-small](https://grouplens.org/datasets/movielens/) by
GroupLens Research, University of Minnesota: 610 users, 9,742 movies. The
pipeline keeps titles with at least 10 likes and viewers with at least 8, giving
1,437 titles and 585 viewers after filtering. Use is covered by the dataset's
own licence in `data/raw/ml-latest-small/README.txt`; no endorsement by
GroupLens or the University of Minnesota is implied.

Recent Hindi releases in `data/recent/recent_films.csv` were taken from
Wikipedia's "List of Hindi films of 2025" and "2026" pages, with year, genres
and language recorded per row.
