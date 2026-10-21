"""
build_bundle.py
===============
Discrete Mathematics semester project: Graph Theory in Streaming Recommendations.

Reads the real MovieLens "ml-latest-small" dataset (GroupLens, 100,836 ratings)
and computes, with the seven course topics, everything the web application shows:

    1. Degree            popularity of every title, degree distribution
    2. Connectivity      connected components, catalogue reachability per user
    3. Path              shortest alternating user -> item paths, path multiplicity
    4. Cycle             4-cycles as the same paths, echo / novelty measure
    5. Eulerian          genre transition multigraph, Eulerian playlist
    6. Hamiltonian       max-weight Hamiltonian watch order (exact, Held-Karp)
    7. Planar + Colouring genre map planarity, Tutte drawing, DSATUR colouring

Run:  python pipeline/build_bundle.py
"""

from __future__ import annotations

import csv
import json
import sys
import math
import os
import re
import time
from collections import Counter, defaultdict, deque

import networkx as nx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw", "ml-latest-small")
OUT = os.path.join(ROOT, "web", "public", "data", "bundle.json")

LIKE = 3.5            # rating >= this counts as a like -> an edge
MIN_MOVIE_LIKES = 10  # catalogue cut-off
MIN_USER_LIKES = 8    # a viewer needs this many catalogue likes to get a list
NEIGHBOURS = 8        # similarity edges kept per movie
SIM_FLOOR = 0.05      # minimum Jaccard similarity for an edge
REC_COUNT = 10
WATCH_COUNT = 10      # candidates in the Hamiltonian watch order
GENRE_EDGE_MIN = 6    # co-occurrence threshold for the genre map
ALPHA = 0.35          # degree damping exponent in the score
LAYOUT_K = 0.22       # spring constant for the full-graph layout
MINIFY = "--minify" in sys.argv


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def read_csv(name):
    with open(os.path.join(RAW, name), encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def parse_title(raw):
    m = re.match(r"^(.*?)\s*\((\d{4})\)\s*$", raw)
    return (m.group(1), int(m.group(2))) if m else (raw, None)


class DisjointSet:
    """Union-find with path compression and union by rank (topic 2)."""

    def __init__(self, items):
        self.parent = {x: x for x in items}
        self.rank = {x: 0 for x in items}

    def find(self, x):
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[x] != root:
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1
        return True


def hierholzer(nodes, adj):
    """Eulerian circuit as an ordered list of (from, to, movieId) traversals."""
    import copy

    work = {x: copy.copy(adj[x]) for x in nodes}
    start = next(x for x in nodes if work[x])
    stack = [(start, None, None)]
    circuit = []
    while stack:
        node, _, _ = stack[-1]
        if work[node]:
            nxt, mid = work[node].pop()
            for i, (back, back_id) in enumerate(work[nxt]):
                if back == node and back_id == mid:
                    work[nxt].pop(i)
                    break
            stack.append((nxt, mid, mid))
        else:
            stack.pop()
            if len(stack) >= 1 and stack[-1][2] is not None:
                pass
            circuit.append(stack[-1][:1] + (node,) if len(stack) >= 1 else ())
    # rebuild edges from the vertex stack instead
    return circuit


def euler_circuit(nodes, adj):
    """Hierholzer, returning traversals (u, v, movieId) in order."""
    work = {x: list(adj[x]) for x in nodes}
    start = next(x for x in nodes if work[x])
    stack = [start]
    edge_stack = []          # (u, v, movie)
    out = []
    while stack:
        u = stack[-1]
        if work[u]:
            v, mid = work[u].pop()
            for i, (back, back_id) in enumerate(work[v]):
                if back == u and back_id == mid:
                    work[v].pop(i)
                    break
            edge_stack.append((u, v, mid))
            stack.append(v)
        else:
            stack.pop()
            if edge_stack:
                out.append(edge_stack.pop())
    out.reverse()
    return out


def pair_odd_vertices(degrees, dist):
    """Greedy minimum pairing of odd-degree vertices: 2-approx route inspection."""
    odd = sorted(v for v, d in degrees.items() if d % 2 == 1)
    pairs = []
    while odd:
        a = odd.pop(0)
        i = min(range(len(odd)), key=lambda k: (dist.get((a, odd[k]), math.inf), odd[k]))
        b = odd.pop(i)
        pairs.append((a, b, dist.get((a, b), math.inf)))
    return pairs


def held_karp(n, weight):
    """Exact max-weight Hamiltonian path. dp[mask][j] = best path over mask ending at j."""
    full = 1 << n
    NEG = float("-inf")
    dp = [[NEG] * n for _ in range(full)]
    parent = [[-1] * n for _ in range(full)]
    for j in range(n):
        dp[1 << j][j] = 0.0
    for mask in range(full):
        row = dp[mask]
        for j in range(n):
            cur = row[j]
            if cur == NEG:
                continue
            for k in range(n):
                if mask & (1 << k):
                    continue
                val = cur + weight[j][k]
                nm = mask | (1 << k)
                if val > dp[nm][k]:
                    dp[nm][k] = val
                    parent[nm][k] = j
    last = full - 1
    best_j = max(range(n), key=lambda j: dp[last][j])
    order = []
    mask, j = last, best_j
    while j != -1:
        order.append(j)
        pj = parent[mask][j]
        mask ^= 1 << j
        j = pj
    order.reverse()
    return order, dp[last][best_j], full * n


def greedy_path(n, weight):
    """Nearest-neighbour baseline, best of every start vertex."""
    best = None
    for s in range(n):
        used = {s}
        order = [s]
        total = 0.0
        while len(order) < n:
            j = order[-1]
            k = max((x for x in range(n) if x not in used), key=lambda x: weight[j][x])
            total += weight[j][k]
            used.add(k)
            order.append(k)
        if best is None or total > best[1]:
            best = (order, total)
    return best


def dsatur(adj, nodes):
    """Greedy colouring with highest saturation degree first (topic 7)."""
    colours = {}
    while len(colours) < len(nodes):
        pick, key = None, None
        for v in nodes:
            if v in colours:
                continue
            sat = len({colours[u] for u in adj[v] if u in colours})
            k = (sat, len(adj[v]))
            if key is None or k > key:
                pick, key = v, k
        banned = {colours[u] for u in adj[pick] if u in colours}
        c = 0
        while c in banned:
            c += 1
        colours[pick] = c
    return colours, (max(colours.values()) + 1 if colours else 0)


def tutte_layout(G, embedding, iterations=6000):
    """Straight-line planar drawing (Tutte): outer face on a circle, interior
    vertices at the barycentre of their neighbours, iterated to convergence."""
    faces, seen = [], set()
    for u, v in G.edges():
        for a, b in ((u, v), (v, u)):
            if (a, b) in seen:
                continue
            f = embedding.traverse_face(a, b, mark_half_edges=seen)
            faces.append(list(f))
    outer = max(faces, key=len) if faces else list(G.nodes())
    pos = {}
    for i, v in enumerate(outer):
        ang = 2 * math.pi * i / len(outer)
        pos[v] = (math.cos(ang), math.sin(ang))
    inner = [v for v in G.nodes() if v not in pos]
    for k, v in enumerate(inner):
        ang = 2 * math.pi * k / max(1, len(inner))
        pos[v] = (0.5 * math.cos(ang), 0.5 * math.sin(ang))
    for _ in range(iterations):
        delta = 0.0
        for v in inner:
            nb = list(G.neighbors(v))
            if not nb:
                continue
            ax = sum(pos[u][0] for u in nb) / len(nb)
            ay = sum(pos[u][1] for u in nb) / len(nb)
            delta += abs(ax - pos[v][0]) + abs(ay - pos[v][1])
            pos[v] = (ax, ay)
        if delta < 1e-10:
            break
    return faces, outer, pos


def segments_cross(p1, p2, p3, p4):
    def orient(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    return (orient(p3, p4, p1) * orient(p3, p4, p2) < 0
            and orient(p1, p2, p3) * orient(p1, p2, p4) < 0)


def count_crossings(G, pos):
    edges = list(G.edges())
    hits = 0
    for i in range(len(edges)):
        a, b = edges[i]
        for j in range(i + 1, len(edges)):
            c, d = edges[j]
            if len({a, b, c, d}) < 4:
                continue
            if segments_cross(pos[a], pos[b], pos[c], pos[d]):
                hits += 1
    return hits


# ---------------------------------------------------------------------------
# recent releases
# ---------------------------------------------------------------------------

RECENT_CSV = os.path.join(ROOT, "data", "recent", "recent_films.csv")


def recent_layer(genre_names):
    """Films released after the MovieLens snapshot, listed and never scored.

    The archive ends in 2018, so a 2025 Bollywood release has no ratings here
    and therefore no audience, no similarity edges and no path count. Putting
    one into `movies` would mean inventing the numbers the whole project is
    about, so they travel in their own list: a real title, a real year, real
    genres, and three fields left explicitly empty. The UI never claims a zero
    as a measurement.

    They are selectable in the app, though. A picker addresses one by its
    position here (web/src/lib/data.ts turns that into a negative id), and the
    viewer match falls back to genre overlap — the one signal the archive does
    carry for a film it has never rated.
    """
    if not os.path.exists(RECENT_CSV):
        return []
    gidx = {g: i for i, g in enumerate(genre_names)}
    out = []
    with open(RECENT_CSV, encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            gs = [g for g in row["genres"].split("|") if g in gidx]
            out.append({
                "t": row["title"].strip(),
                "y": int(row["year"]),
                "g": [gidx[g] for g in gs],
                "lang": row["language"].strip(),
                "src": row["source"].strip(),
                # no ratings in the archive: these are null, not zero
                "d": None, "gd": None,
            })
    out.sort(key=lambda r: (-r["y"], r["t"]))
    return out


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    t0 = time.time()
    movies_raw = read_csv("movies.csv")
    ratings_raw = read_csv("ratings.csv")
    tags_raw = read_csv("tags.csv")

    likes_by_movie = defaultdict(set)
    likes_by_user = defaultdict(set)
    for r in ratings_raw:
        if float(r["rating"]) >= LIKE:
            m, u = int(r["movieId"]), int(r["userId"])
            likes_by_movie[m].add(u)
            likes_by_user[u].add(m)

    catalog = {m for m, s in likes_by_movie.items() if len(s) >= MIN_MOVIE_LIKES}
    catalog_users = {u for u, s in likes_by_user.items() if len(s & catalog) >= MIN_USER_LIKES}
    for u in list(likes_by_user):
        likes_by_user[u] &= catalog
        if not likes_by_user[u]:
            del likes_by_user[u]
    for m in list(likes_by_movie):
        likes_by_movie[m] &= catalog_users
        if not likes_by_movie[m]:
            del likes_by_movie[m]
    catalog &= set(likes_by_movie)

    movie_ids = sorted(catalog)
    user_ids = sorted(u for u in catalog_users if likes_by_user.get(u))
    n = len(movie_ids)
    index_of = {m: i for i, m in enumerate(movie_ids)}

    genre_names = [
        "Drama", "Comedy", "Thriller", "Action", "Romance", "Adventure", "Crime",
        "Sci-Fi", "Horror", "Fantasy", "Children", "Animation", "Mystery",
        "Documentary", "War", "Musical", "Western", "IMAX", "Film-Noir",
    ]
    gidx = {g: i for i, g in enumerate(genre_names)}

    meta = {}
    for row in movies_raw:
        m = int(row["movieId"])
        if m not in catalog:
            continue
        title, year = parse_title(row["title"])
        gs = [g for g in row["genres"].split("|") if g in gidx]
        meta[m] = {"t": title, "y": year, "g": [gidx[g] for g in gs]}

    tags_by_movie = defaultdict(list)
    for row in tags_raw:
        m = int(row["movieId"])
        if m in catalog:
            t = row["tag"].strip().lower()
            if t:
                tags_by_movie[m].append(t)
    tags_out = {str(m): [t for t, _ in Counter(ts).most_common(6)]
                for m, ts in tags_by_movie.items()}

    # --- 1. degree ---------------------------------------------------------
    # Two different numbers wear the name "degree" in this project, and the
    # bundle keeps them apart: `deg` is the audience size (how many viewers
    # liked a title), which drives the popularity damping; `G.degree` is the
    # similarity-graph degree, which the graph-theory topics count.
    deg = {m: len(likes_by_movie[m]) for m in movie_ids}
    mean_deg = sum(deg.values()) / n

    # --- similarity graph: Jaccard over co-likers --------------------------
    pair_count = Counter()
    for u in user_ids:
        ms = sorted(likes_by_user[u])
        for i in range(len(ms)):
            for j in range(i + 1, len(ms)):
                pair_count[(ms[i], ms[j])] += 1

    sim = defaultdict(dict)
    for (a, b), common in pair_count.items():
        j = common / (deg[a] + deg[b] - common)
        if j >= SIM_FLOOR:
            sim[a][b] = j
            sim[b][a] = j

    edge_set = set()
    for a in movie_ids:
        for b, w in sorted(sim[a].items(), key=lambda kv: (-kv[1], kv[0]))[:NEIGHBOURS]:
            edge_set.add((a, b) if a < b else (b, a))
    edges = [(a, b, sim[a][b]) for a, b in sorted(edge_set)]

    G = nx.Graph()
    G.add_nodes_from(movie_ids)
    G.add_weighted_edges_from(edges)

    gdeg = {m: G.degree(m) for m in movie_ids}
    gdeg_dist = Counter(gdeg.values())

    # --- 2. connectivity ---------------------------------------------------
    ds = DisjointSet(movie_ids)
    for a, b, _ in edges:
        ds.union(a, b)
    comp_root = {m: ds.find(m) for m in movie_ids}
    comp_sizes = Counter(comp_root.values())
    comp_roots = [c for c, _ in comp_sizes.most_common()]
    comp_index = {c: i for i, c in enumerate(comp_roots)}
    comp_of = {m: comp_index[comp_root[m]] for m in movie_ids}

    # --- reachability (BFS from each user's likes) -------------------------
    movie_nodes = list(G.nodes())
    reach_by_user = {}
    for u in user_ids:
        dist = {}
        dq = deque()
        for m in likes_by_user[u]:
            dist[m] = 0
            dq.append(m)
        while dq:
            x = dq.popleft()
            if dist[x] >= 3:
                continue
            for y in G[x]:
                if y not in dist:
                    dist[y] = dist[x] + 1
                    dq.append(y)
        reach_by_user[u] = dist

    # --- 3 + 4. paths / cycles per viewer ----------------------------------
    recs = {}
    viewer_stats = {}
    likers = {m: likes_by_movie[m] for m in movie_ids}

    for u in user_ids:
        Lu = likes_by_user[u]
        shared_with = Counter()          # co-liker -> #titles shared with u
        for m in Lu:
            for v in likers[m]:
                if v != u:
                    shared_with[v] += 1
        u_neighbourhood = set(shared_with)

        # support[m] = number of 4-cycles u-a-v-m-u  (== number of distinct
        # alternating user -> title -> viewer -> title paths to m)
        support = Counter()
        for m in movie_ids:
            if m in Lu:
                continue
            s = 0
            for v in likers[m]:
                w = shared_with.get(v)
                if w:
                    s += w
            if s:
                support[m] = s

        # echo[m]: share of the title's audience already inside u's 1-hop set
        echo = {}
        for m, _ in support.items():
            aud = likers[m]
            echo[m] = len(aud & u_neighbourhood) / len(aud)

        ranked = []
        for m, cyc in support.items():
            pop = deg[m] ** ALPHA
            nov = 1.0 / (1.0 + echo[m])
            cyc_term = 1.0 + math.log(1.0 + cyc)
            score = cyc_term * pop * nov
            ranked.append((score, cyc, m))
        ranked.sort(key=lambda t: (-t[0], -t[1], t[2]))

        # popularity-only baseline, for comparison
        pop_order = sorted(movie_ids, key=lambda m: (-deg[m], m))
        pop_rank = {m: i for i, m in enumerate(pop_order)}

        top = ranked[:REC_COUNT]
        rec_list = []
        ranked_rank = {m: k for k, (_, _, m) in enumerate(ranked)}
        ranked_total = len(ranked)
        for score, cyc, m in top:
            # clearest witnesses: co-likers with the most shared titles, then
            # the anchor title most similar to the candidate
            witnesses = sorted(shared_with.items(), key=lambda kv: (-kv[1], kv[0]))
            paths = []
            for v, w in witnesses[:3]:
                shared = likes_by_user[v] & Lu
                anchor = max(shared, key=lambda a: (sim[a].get(m, 0.0), deg[a]))
                pair_sim = sim[anchor].get(m, 0.0)
                paths.append({"v": v, "a": anchor, "n": w, "sj": round(pair_sim, 3)})
            rec_list.append({
                "m": m,
                "s": round(score, 4),
                "cyc": cyc,
                "deg": deg[m],
                "damp": round(deg[m] ** ALPHA, 3),
                "echo": round(echo[m], 3),
                "cycTerm": round(1.0 + math.log(1.0 + cyc), 3),
                "popRank": pop_rank[m],
                "rank": ranked_rank[m],
                "cand": ranked_total,
                "paths": paths,
            })
        recs[str(u)] = rec_list

        # viewer-level cycle metric: mean Jaccard to their own co-likers
        jac = []
        for v in u_neighbourhood:
            Lv = likes_by_user[v]
            union = len(Lv | Lu)
            jac.append(len(Lv & Lu) / union if union else 0.0)
        echo_u = round(sum(jac) / len(jac), 4) if jac else 0.0

        reach = reach_by_user[u]
        hop = {1: 0, 2: 0, 3: 0, 0: 0}
        for x, d in reach.items():
            if d in hop:
                hop[d] += 1
        viewer_stats[str(u)] = {
            "echo": echo_u,
            "reach1": hop[1],
            "reach2": hop[2],
            "reach3": hop[3],
            "unreached": n - len(reach),
            "components": sorted({comp_of[m] for m in Lu}),
        }

    # --- 5. Eulerian genre playlist ----------------------------------------
    trans = defaultdict(list)
    for m in movie_ids:
        g = meta[m]["g"]
        if len(g) < 2:
            continue
        a, b = sorted(g[:2])
        trans[a].append((b, m))
        trans[b].append((a, m))

    tg = nx.Graph()
    for a, nb in trans.items():
        for b, _ in nb:
            tg.add_edge(a, b)
    odd_vertices = sorted(a for a in trans if len(trans[a]) % 2 == 1)
    dist = {}
    for a in tg.nodes():
        for b, d in nx.single_source_shortest_path_length(tg, a).items():
            dist[(a, b)] = d
    pairs = pair_odd_vertices({a: len(trans[a]) for a in trans}, dist)

    aug = {a: list(nb) for a, nb in trans.items()}
    for a, b, _ in pairs:
        path = nx.shortest_path(tg, a, b)
        for x, y in zip(path, path[1:]):
            mid = next(m for nb2, m in aug[x] if nb2 == y)
            aug[x].append((y, mid))
            aug[y].append((x, mid))
    all_even = all(len(v) % 2 == 0 for v in aug.values())
    playlist_edges = euler_circuit(list(tg.nodes()), aug) if all_even else []

    # --- 6. Hamiltonian watch order ----------------------------------------
    watch = {}
    for u in user_ids:
        cand = [r["m"] for r in recs[str(u)][:WATCH_COUNT]]
        k = len(cand)
        if k < 4:
            continue
        W = [[0.0] * k for _ in range(k)]
        for i in range(k):
            for j in range(k):
                if i != j:
                    W[i][j] = sim[cand[i]].get(cand[j], 0.0)
        order, total, states = held_karp(k, W)
        gorder, gtotal = greedy_path(k, W)
        watch[str(u)] = {
            "order": [cand[i] for i in order],
            "w": round(total, 4),
            "greedy": [cand[i] for i in gorder],
            "gw": round(gtotal, 4),
            "states": states,
            "n": k,
            "pairwise": [[round(W[i][j], 3) for j in range(k)] for i in range(k)],
        }

    # --- 7. planar genre map + colouring -----------------------------------
    co = Counter()
    for m in movie_ids:
        gs = sorted(set(meta[m]["g"]))
        for i in range(len(gs)):
            for j in range(i + 1, len(gs)):
                co[(gs[i], gs[j])] += 1
    present = sorted({g for pair in co for g in pair})

    FULL = nx.Graph()
    FULL.add_nodes_from(present)
    for (a, b), c in co.items():
        if c >= GENRE_EDGE_MIN:
            FULL.add_edge(a, b, weight=c)
    full_planar, full_emb = nx.check_planarity(FULL)

    H = nx.Graph()
    H.add_nodes_from(present)
    kept = []
    for (a, b), c in sorted(co.items(), key=lambda kv: -kv[1]):
        if c < GENRE_EDGE_MIN:
            continue
        H.add_edge(a, b, weight=c)
        if not nx.check_planarity(H)[0]:
            H.remove_edge(a, b)
        else:
            kept.append((a, b, c))
    planar, emb = nx.check_planarity(H)
    faces, outer, pos = tutte_layout(H, emb)
    crossings = count_crossings(H, pos)

    colour_full, k_full = dsatur({x: set(FULL.neighbors(x)) for x in FULL.nodes()},
                                 sorted(FULL.nodes()))
    colour_planar, k_planar = dsatur({x: set(H.neighbors(x)) for x in H.nodes()},
                                     sorted(H.nodes()))

    # triangles in the full genre graph -> clique bound on the chromatic number
    clique = max((len(c) for c in nx.find_cliques(FULL)), default=1)
    clique_lb = max(clique, 2 if FULL.number_of_edges() else 1)

    # --- colouring the recommendation list --------------------------------
    list_colour = {}
    for u in user_ids:
        rec = recs[str(u)]
        ids = [r["m"] for r in rec]
        adj = {i: set() for i in range(len(ids))}
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                if set(meta[ids[i]]["g"]) & set(meta[ids[j]]["g"]):
                    adj[i].add(j)
                    adj[j].add(i)
        col, k = dsatur(adj, list(range(len(ids))))
        list_colour[str(u)] = {"col": [col[i] for i in range(len(ids))], "k": k}

    # --- graph-level statistics -------------------------------------------
    tri_per_node = nx.triangles(G)
    tri_total = sum(tri_per_node.values()) // 3
    clustering = nx.average_clustering(G)
    # girth by BFS bounded at 4: a triangle or a 4-cycle
    girth = None
    for src in movie_ids:
        dist = {src: 0}
        parent = {src: None}
        dq = deque([src])
        while dq and girth != 3:
            x = dq.popleft()
            for y in G[x]:
                if y not in dist:
                    dist[y] = dist[x] + 1
                    parent[y] = x
                    dq.append(y)
                elif parent[x] != y and parent[y] != x:
                    girth = min(girth or 99, dist[x] + dist[y] + 1)
        if girth == 3:
            break
    # exact diameter and mean path length on the largest component
    giant = max(nx.connected_components(G), key=len)
    sub = G.subgraph(giant)
    lengths = []
    ecc = 0
    for src in giant:
        d = nx.single_source_shortest_path_length(sub, src)
        ecc = max(ecc, max(d.values()))
        lengths.extend(d.values())
    diameter = ecc
    mean_path = sum(lengths) / len(lengths)
    art = len(list(nx.articulation_points(G)))
    bridges = len(list(nx.bridges(G)))
    assort = nx.degree_assortativity_coefficient(G)
    handshake = sum(deg.values())

    # --- graph layout (precomputed so the browser renders, not simulates) ---
    # Two coordinates per movie: a similarity spring layout (structure) and a
    # 16 x 10 genre grid (the library grid view). Nodes are drawn at
    #   p = (1 - t) * spring + t * grid
    # and t is animated in the UI.
    layout = [None] * n
    spring = nx.spring_layout(G, dim=2, k=LAYOUT_K, iterations=60, seed=7)
    sx = [spring[m][0] for m in movie_ids]
    sy = [spring[m][1] for m in movie_ids]

    # normalise spring coordinates to a 16:10 box
    def norm(vals):
        lo, hi = min(vals), max(vals)
        span = (hi - lo) or 1.0
        return [(v - lo) / span for v in vals]

    sx, sy = norm(sx), norm(sy)

    # grid: buckets by the movie's primary genre
    primary = Counter()
    for m in movie_ids:
        primary[meta[m]["g"][0] if meta[m]["g"] else -1] += 1
    buckets = defaultdict(list)
    for m in movie_ids:
        buckets[meta[m]["g"][0] if meta[m]["g"] else -1].append(m)
    grid_x, grid_y = {}, {}
    slots = sorted(buckets, key=lambda g: -len(buckets[g]))
    total_slots = n
    gx, gy = 0, 0
    for g in slots:
        members = sorted(buckets[g], key=lambda m: -deg[m])
        cols = math.ceil(math.sqrt(len(members) * 1.7))
        for k, m in enumerate(members):
            grid_x[m] = (gx + (k % cols)) / 92.0
            grid_y[m] = (gy + (k // cols)) / 58.0
        gx += cols + 2
        if gx > 78:
            gx = 0
            gy += math.ceil(len(members) / cols) + 2

    for i, m in enumerate(movie_ids):
        layout[i] = [round(sx[i], 4), round(sy[i], 4),
                     round(grid_x[m], 4), round(grid_y[m], 4)]

    # --- per-viewer induced subgraph (for the local graph view) -----------
    # Focused neighbourhood: the viewer's strongest 26 likes, the 10 candidates,
    # and the similarity edges between them. Enough to read the path structure.
    local = {}
    for u in user_ids:
        Lu = likes_by_user[u]
        rec = recs[str(u)]
        cand = [r["m"] for r in rec]
        owned = sorted(Lu, key=lambda m: (-deg[m], m))[:26]
        keep = owned + cand
        li = {m: k for k, m in enumerate(keep)}
        l_edges = set()
        for a in keep:
            inside = sorted((b for b in sim[a] if b in li),
                            key=lambda b: -sim[a][b])[:4]
            for b in inside:
                l_edges.add((li[a], li[b]) if li[a] < li[b] else (li[b], li[a]))
        l_edges = [[a, b, round(sim[keep[a]][keep[b]], 3)] for a, b in sorted(l_edges)]
        local[str(u)] = {
            "nodes": [{"m": m, "own": m in Lu} for m in keep],
            "edges": l_edges,
        }

    # --- bundle -------------------------------------------------------------
    palette = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181",
               "#008300", "#9085e9", "#e66767"]

    movies_out = [{
        "id": m, "t": meta[m]["t"], "y": meta[m]["y"], "g": meta[m]["g"],
        # d = audience size (viewers who liked it), gd = similarity-graph degree
        "d": deg[m], "gd": gdeg[m], "c": comp_of[m],
    } for m in movie_ids]

    def top_genres(u, k=3):
        gc = Counter()
        for m in likes_by_user[u]:
            for g in meta[m]["g"]:
                gc[g] += 1
        return [g for g, _ in gc.most_common(k)]

    users_out = [{
        "id": u, "n": len(likes_by_user[u]), "comp": comp_of[next(iter(likes_by_user[u]))],
        "likes": sorted(likes_by_user[u]),
        "top": sorted(likes_by_user[u], key=lambda m: -deg[m])[:4],
        "genres": top_genres(u),
        **viewer_stats[str(u)],
    } for u in user_ids]

    components = []
    for ci, root in enumerate(comp_roots):
        members = [m for m in movie_ids if comp_of[m] == ci]
        components.append({
            "i": ci, "n": len(members),
            "top": sorted(members, key=lambda m: -deg[m])[:4],
        })

    bundle = {
        "meta": {
            "dataset": "MovieLens ml-latest-small (GroupLens)",
            "ratings": len(ratings_raw),
            "moviesAll": 9742,
            "usersAll": 610,
            "movies": n,
            "users": len(user_ids),
            "likes": sum(deg.values()),
            "edges": len(edges),
            "meanAudience": round(mean_deg, 2),
            "medianAudience": sorted(deg.values())[n // 2],
            "maxAudience": max(deg.values()),
            "maxAudienceMovie": max(deg, key=deg.get),
            "minDegree": min(gdeg.values()),
            "meanDegree": round(sum(gdeg.values()) / n, 2),
            "medianDegree": sorted(gdeg.values())[n // 2],
            "maxDegree": max(gdeg.values()),
            "maxDegreeMovie": max(gdeg, key=gdeg.get),
            "components": len(comp_roots),
            "largest": components[0]["n"],
            "likeThreshold": LIKE,
            "simFloor": SIM_FLOOR,
            "k": NEIGHBOURS,
            "built": time.strftime("%Y-%m-%d"),
        },
        "genres": [{"i": i, "n": g, "c": sum(1 for m in movie_ids if i in meta[m]["g"])}
                   for i, g in enumerate(genre_names)],
        "movies": movies_out,
        "edges": [[index_of[a], index_of[b], round(w, 3)] for a, b, w in edges],
        "layout": layout,
        "local": local,
        "degreeDist": sorted([d, c] for d, c in gdeg_dist.items()),
        "stats": {
            "triangles": tri_total,
            "clustering": round(clustering, 4),
            "girth": girth,
            "diameter": diameter,
            "meanPath": round(mean_path, 3),
            "articulation": art,
            "bridges": bridges,
            "assortativity": round(assort, 4),
            "handshake": handshake,
            "topTriangles": sorted(
                ([m, tri_per_node[m], deg[m]] for m in movie_ids),
                key=lambda t: -t[1])[:8],
        },
        "components": components,
        "users": users_out,
        "recs": recs,
        "watch": watch,
        "listColour": list_colour,
        "tags": tags_out,
        "euler": {
            "vertices": [{"g": a, "deg": len(trans[a]), "n": genre_names[a]} for a in sorted(trans)],
            "edges": [[a, b, m] for a in sorted(trans) for b, m in trans[a] if a < b],
            "odd": odd_vertices,
            "pairs": [[a, b, d] for a, b, d in pairs],
            "playlist": [[a, b, m] for a, b, m in playlist_edges],
            "augmented": all_even,
            "connected": nx.is_connected(tg),
            "edgesBefore": sum(len(v) for v in trans.values()) // 2,
            "edgesAfter": sum(len(v) for v in aug.values()) // 2,
        },
        "planar": {
            "nodes": [{"g": x, "n": genre_names[x], "x": round(pos[x][0], 4),
                       "y": round(pos[x][1], 4), "col": colour_planar[x],
                       "colFull": colour_full[x], "deg": H.degree(x)} for x in sorted(H.nodes())],
            "edges": [[a, b, c] for a, b, c in kept],
            "v": H.number_of_nodes(), "e": H.number_of_edges(),
            "maxEdges": 3 * H.number_of_nodes() - 6,
            "crossings": crossings,
            "faces": len(faces) - 1,
            "eulerChar": H.number_of_nodes() - H.number_of_edges() + (len(faces) - 1),
            "colours": k_planar,
            "fullPlanar": bool(full_planar),
            "fullV": FULL.number_of_nodes(), "fullE": FULL.number_of_edges(),
            "fullColours": k_full,
            "clique": clique_lb,
        },
        "palette": palette,
        "recent": recent_layer(genre_names),
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if MINIFY:
        text = json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(bundle, ensure_ascii=False, indent=1)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(text)
    size = os.path.getsize(OUT)

    print(f"catalog    : {n} movies, {len(user_ids)} viewers, {sum(deg.values())} likes")
    print(f"graph      : {len(edges)} edges, mean degree {mean_deg:.2f}, "
          f"max {max(deg.values())}")
    print(f"components : {len(comp_roots)} (largest {components[0]['n']}, "
          f"{100*components[0]['n']/n:.1f}%)")
    print(f"euler      : odd {len(odd_vertices)}, augmented={all_even}, "
          f"playlist {len(playlist_edges)} steps")
    print(f"planar     : planar={planar}, {H.number_of_nodes()}v {H.number_of_edges()}e, "
          f"crossings={crossings}, full planar={full_planar}, "
          f"colours {k_planar} (full {k_full}, clique {clique_lb})")
    print(f"bundle     : {size/1024:.0f} KB -> {OUT}  ({time.time()-t0:.1f}s)")


if __name__ == "__main__":
    main()
