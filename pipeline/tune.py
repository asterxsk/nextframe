import sys, math, csv, json
from collections import Counter, defaultdict
sys.path.insert(0, "pipeline")
import build_bundle as B

b = json.load(open("web/data/bundle.json", encoding="utf-8"))
movies = {m["id"]: m for m in b["movies"]}
GN = [g["n"] for g in b["genres"]]

# rebuild support/echo per user from the raw data so we can test variants fast
rr = B.read_csv("ratings.csv")
like_m = defaultdict(set); like_u = defaultdict(set)
for r in rr:
    if float(r["rating"]) >= 3.5:
        m, u = int(r["movieId"]), int(r["userId"])
        like_m[m].add(u); like_u[u].add(m)
cat = {m["id"] for m in b["movies"]}
users = {u["id"] for u in b["users"]}

def recs_for(u, alpha=0.35, beta=1.0, novelty="one_minus_echo"):
    Lu = like_u[u] & cat
    shared = Counter()
    for m in Lu:
        for v in like_m[m]:
            if v != u and v in users: shared[v] += 1
    nb = set(shared)
    cyc = Counter()
    for v, w in shared.items():
        for m in like_u[v] & cat:
            if m not in Lu:
                cyc[m] += w
    out = []
    for m, c in cyc.items():
        e = len(like_m[m] & nb) / len(like_m[m])
        nov = (1 - e) if novelty == "one_minus_echo" else 1 / (1 + e)
        s = (1 + math.log(1 + c)) * (len(like_m[m]) ** alpha) * (max(nov, 0.01) ** beta)
        out.append((s, c, e, m))
    out.sort(key=lambda t: (-t[0], -t[1], t[2]))
    return out[:12], Lu

for u in (1, 59, 414, 599):
    print("=" * 70)
    print("user", u, "likes", len(like_u[u] & cat), "top genres",
          Counter(g for m in (like_u[u] & cat) for g in movies[m]["g"]).most_common(3))
    for alpha, beta in ((0.35, 1.0), (0.5, 1.0), (0.5, 0.5), (0.7, 1.0)):
        rs, Lu = recs_for(u, alpha, beta)
        tops = []
        for s, c, e, m in rs[:8]:
            mm = movies[m]
            tops.append(f'{mm["t"][:22]}({"/".join(GN[g][:4] for g in mm["g"][:2])}|c{c}|e{e:.2f}|d{mm["d"]})')
        print(f"a={alpha} b={beta}:", "; ".join(tops))
