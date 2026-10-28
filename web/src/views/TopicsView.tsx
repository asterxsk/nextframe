import { useMemo, useState } from 'react';
import {
  ArrowClockwise,
  ArrowRight,
  Circle,
  DotOutline,
  Info,
  Path,
  Target,
} from '@phosphor-icons/react';
import type { Bundle } from '@/lib/data';
import { colorAt, fmt1, fmt2, fmt3, fmtInt } from '@/lib/data';
import { BarChart, Heatmap } from '@/components/charts';
import { PathFigure } from '@/components/PathFigure';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function TopicsView({ data, uid }: { data: Bundle; uid: number }) {
  return (
    <div className="pt-8">
      <header className="grid grid-cols-1 items-end gap-8 border-b border-line pb-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <div>
          <div className="eyebrow">Course coverage</div>
          <h1 className="mt-3 max-w-[24ch] text-[clamp(27px,3.1vw,42px)] font-normal leading-[1.08] tracking-[-0.033em]">
            Seven topics. Seven answers about one graph.
          </h1>
        </div>
        <p className="max-w-[54ch] text-[13px] leading-relaxed text-ink-2">
          Every number here is computed from the archive, not illustrated. Ownership follows the
          project plan: C039 degree and connectivity, C044 path and cycle, C043 Eulerian and
          Hamiltonian, C046 planar and colouring.
        </p>
      </header>

      <div className="mt-6 grid gap-4">
        <DegreeTopic data={data} />
        <ConnectivityTopic data={data} />
        <PathTopic data={data} uid={uid} />
        <CycleTopic data={data} uid={uid} />
        <EulerTopic data={data} />
        <HamiltonTopic data={data} uid={uid} />
        <PlanarTopic data={data} uid={uid} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shell */

function Topic({
  n,
  owner,
  title,
  thesis,
  viz,
  facts,
  aside,
}: {
  n: number;
  owner: string;
  title: string;
  thesis: React.ReactNode;
  viz: React.ReactNode;
  facts: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <article className="grid overflow-hidden border border-line bg-surface lg:grid-cols-[236px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 border-line-soft p-5 lg:border-r">
        <div className="flex items-baseline gap-3">
          <span className="tnum font-mono text-[26px] leading-none text-faint">
            {String(n).padStart(2, '0')}
          </span>
          <span className="font-mono text-[9px] uppercase leading-tight tracking-[0.07em] text-signal/80">
            {owner}
          </span>
        </div>
        <h2 className="text-[17px] font-medium leading-snug tracking-[-0.015em]">{title}</h2>
        <p className="text-[12px] leading-relaxed text-ink-2">{thesis}</p>
        <div className="mt-auto grid gap-1.5 pt-3">{facts}</div>
      </div>
      <div className="grid gap-4 p-5">
        {viz}
        {aside}
      </div>
    </article>
  );
}

function Fact({ k, v, accent }: { k: string; v: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-1 last:border-0">
      <span className="text-[10.5px] leading-tight text-muted">{k}</span>
      <span
        className={cn('tnum shrink-0 font-mono text-[10.5px]', accent ? 'text-signal' : 'text-ink')}
      >
        {v}
      </span>
    </div>
  );
}

function Figure({
  title,
  right,
  children,
  footnote,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <section className="border border-line-soft bg-canvas/60">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-2">
        <h3 className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted">{title}</h3>
        {right && <span className="font-mono text-[9.5px] text-faint">{right}</span>}
      </div>
      <div className="p-3">{children}</div>
      {footnote && (
        <div className="border-t border-line-soft px-3 py-2 text-[10.5px] leading-relaxed text-muted">
          {footnote}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ 1 degree */

function DegreeTopic({ data }: { data: Bundle }) {
  const graphDeg = useMemo(() => {
    const d = new Array(data.movies.length).fill(0);
    for (const [a, c] of data.edges) {
      d[a]++;
      d[c]++;
    }
    return d;
  }, [data]);

  const hist = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of graphDeg) m.set(d, (m.get(d) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [graphDeg]);

  const top = useMemo(
    () =>
      data.movies
        .map((m, i) => ({ m, d: graphDeg[i] }))
        .sort((a, b) => b.d - a.d)
        .slice(0, 7),
    [data, graphDeg],
  );

  const sum = graphDeg.reduce((a, b) => a + b, 0);

  return (
    <Topic
      n={1}
      owner="C039 · degree"
      title="Degree ranks the catalogue"
      thesis={
        <>
          A title's graph degree counts the other titles it is linked to. Summed over every vertex
          it equals twice the edge count, which is the handshake lemma, and it is the number the
          score damps: popular titles must earn their place through paths, not through reach alone.
        </>
      }
      facts={
        <>
          <Fact k="Σ degree" v={fmtInt(sum)} />
          <Fact k="2 × edges" v={fmtInt(2 * data.edges.length)} accent />
          <Fact k="mean / median" v={`${fmt2(sum / graphDeg.length)} / ${median(graphDeg)}`} />
          <Fact k="max degree" v={fmtInt(Math.max(...graphDeg))} />
          <Fact k="min degree" v={String(Math.min(...graphDeg))} />
          <Fact k="isolated" v="0" />
        </>
      }
      viz={
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Figure
            title="Degree distribution"
            right={`${fmtInt(data.movies.length)} vertices · log count`}
          >
            <BarChart
              data={hist}
              colour="var(--color-s1)"
              log
              height={168}
              ariaLabel="Vertex degree distribution, log scaled counts"
              formatX={(v) => String(v)}
              xLabel="graph degree"
              formatTip={(x, y) => (
                <div className="font-mono text-[10.5px]">
                  <span className="text-ink">{fmtInt(y)}</span> titles with degree{' '}
                  <span className="text-ink">{x}</span>
                </div>
              )}
            />
          </Figure>
          <Figure title="Most connected titles">
            <div className="grid gap-1.5">
              {top.map(({ m, d }, i) => (
                <div
                  key={m.id}
                  className="grid grid-cols-[14px_minmax(0,1fr)_34px] items-baseline gap-2"
                >
                  <span className="font-mono text-[9px] text-faint">{i + 1}</span>
                  <span className="truncate text-[11.5px] text-ink-2">{m.t}</span>
                  <span className="tnum text-right font-mono text-[10.5px] text-ink">{d}</span>
                </div>
              ))}
            </div>
          </Figure>
        </div>
      }
    />
  );
}

/* ---------------------------------------------------------- 2 connectivity */

function ConnectivityTopic({ data }: { data: Bundle }) {
  const totals = useMemo(
    () =>
      data.users.reduce(
        (a, u) => {
          a[1] += u.reach1;
          a[2] += u.reach2;
          a[3] += u.reach3;
          a.un += u.unreached;
          return a;
        },
        { 1: 0, 2: 0, 3: 0, un: 0 } as Record<string | number, number>,
      ),
    [data.users],
  );
  const stranded = data.users.filter((u) => u.unreached > 0).length;

  return (
    <Topic
      n={2}
      owner="C039 · connectivity"
      title="Nobody is stranded"
      thesis={
        <>
          A union-find pass over the similarity edges returns one connected component, so any title
          is reachable from any other. The stronger claim needs the bipartite graph of viewers and
          titles: it is connected too, and it has no articulation vertex, so no single title or
          viewer can split the catalogue in two.
        </>
      }
      facts={
        <>
          <Fact k="components" v={String(data.meta.components)} accent />
          <Fact k="largest" v={`${fmtInt(data.meta.largest)} / ${fmtInt(data.meta.movies)}`} />
          <Fact k="articulation vertices" v={String(data.stats.articulation)} />
          <Fact k="bridges" v={String(data.stats.bridges)} />
          <Fact k="viewers not fully reached" v={`${stranded} / ${fmtInt(data.users.length)}`} />
          <Fact k="bridging vertices removed" v="would increase components" />
        </>
      }
      viz={
        <div className="grid gap-3 lg:grid-cols-2">
          <Figure title="Reach from a viewer's likes" right="summed over all viewers">
            <BarChart
              data={[
                [1, totals[1]],
                [2, totals[2]],
                [3, totals[3]],
              ]}
              colour="var(--color-s3)"
              height={150}
              ariaLabel="Titles reached at one, two and three hops, summed over viewers"
              formatX={(v) => `${v} hop${v > 1 ? 's' : ''}`}
            />
            <div className="mt-2 text-[10.5px] leading-relaxed text-muted">
              Summed across all {fmtInt(data.users.length)} viewers, {fmtInt(totals[1])} titles are
              one step away from something they liked. Only {fmtInt(totals.un)} title-viewer pairs
              lie beyond three hops.
            </div>
          </Figure>
          <Figure title="Why connectivity is a real result here" right="bipartite graph">
            <div className="grid gap-2">
              <ChainNote
                n="V ∪ U"
                label={`${fmtInt(data.movies.length + data.users.length)} vertices`}
                note="titles and viewers in one graph"
              />
              <ChainNote
                n="E"
                label={`${fmtInt(data.meta.likes)} like edges`}
                note="viewer rated title at or above threshold"
              />
              <ChainNote n="κ" label="1 component" note="union-find returns a single root" ok />
              <ChainNote
                n="cut"
                label="0 articulation vertices"
                note="removing any one vertex keeps it connected"
                ok
              />
            </div>
          </Figure>
        </div>
      }
    />
  );
}

function ChainNote({
  n,
  label,
  note,
  ok,
}: {
  n: string;
  label: string;
  note: string;
  ok?: boolean;
}) {
  return (
    <div className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-2.5 border border-line-soft px-2.5 py-1.5">
      <span className="text-center font-mono text-[11px] text-signal">{n}</span>
      <div>
        <div className={cn('text-[11.5px]', ok ? 'text-good' : 'text-ink')}>{label}</div>
        <div className="text-[10px] text-muted">{note}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 3 path */

function PathTopic({ data, uid }: { data: Bundle; uid: number }) {
  const vid = data.users.some((u) => u.id === uid) ? uid : data.users[0].id;
  const rec = data.recs[String(uid)]?.[0];
  const w = data.watch[String(uid)];
  const m = data.movies.find((x) => x.id === rec?.m);
  const anchor = data.movies.find((x) => x.id === rec?.paths[0]?.a);

  return (
    <Topic
      n={3}
      owner="C044 · path"
      title="Path length is relevance"
      thesis={
        <>
          A candidate is scored by how many alternating paths of length three join the viewer to it:
          viewer, title, co-liker, title. Read backwards the same walk closes into a 4-cycle in the
          bipartite graph, so path count and cycle count are the same number. Shorter routes mean
          closer matches, and the mean path length measures how tight the catalogue is.
        </>
      }
      facts={
        <>
          <Fact k="diameter" v={String(data.stats.diameter)} accent />
          <Fact k="mean shortest path" v={fmt3(data.stats.meanPath)} />
          <Fact k="path length in the score" v="3" />
          <Fact k="candidates scored, viewer 414" v={fmtInt(rec?.cand ?? 0)} />
          <Fact k="witness paths shown" v="3 per title" />
          <Fact k="alternating walk" v="U → T → U → T" />
        </>
      }
      viz={
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Figure title="The path that produced rank 1" right={`viewer ${uid}`}>
            <PathDiagram
              titles={[anchor?.t ?? '', m?.t ?? '']}
              viewer={uid}
              via={rec?.paths[0]?.v}
              shared={rec?.paths[0]?.n}
            />
          </Figure>
          <Figure title="Watch order weight matrix" right={`Held-Karp · ${w?.states ?? 0} states`}>
            {w ? (
              <div className="flex items-center justify-center">
                <Heatmap
                  matrix={w.pairwise}
                  labels={w.order.map((_, i) => String(i + 1))}
                  colour="#3987e5"
                  size={236}
                  valueLabel="Jaccard"
                  title="Watch order similarity matrix"
                />
              </div>
            ) : null}
            <div className="mt-2 text-[10.5px] leading-relaxed text-muted">
              Cell (i, j) is the similarity between the titles at positions i and j of the optimal
              order. The diagonal is empty by definition.
            </div>
          </Figure>
        </div>
      }
    />
  );
}

const HOPS = ['likes', 'co-likes', 'likes'];
const ROLES = ['you', 'anchor title', 'co-liker', 'candidate'];

/**
 * The alternating walk as a figure: four stops on a board, a post for a viewer
 * and a block for a title, strung by the three hops. Hovering a wire arches it
 * into the bright and rises the two stops it joins; the middle post carries
 * the bright cap at rest, because the co-liker is what makes this a path and
 * not a pair.
 */
function PathDiagram({
  titles,
  viewer,
  via,
  shared,
}: {
  titles: string[];
  viewer: number;
  via?: number;
  shared?: number;
}) {
  const [hop, setHop] = useState(-1);
  const names = [`u${viewer}`, titles[0], `v${via ?? '?'}`, titles[1]].map((n) =>
    n.length > 26 ? `${n.slice(0, 25)}…` : n,
  );
  const on = hop < 0 ? 1 : hop;

  return (
    <div>
      <PathFigure onHop={setHop} />
      <ol className="-mt-1 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line-soft pt-2.5">
        {names.map((n, i) => (
          <li
            key={i}
            className={cn(
              'grid grid-cols-[10px_minmax(0,1fr)] items-baseline gap-1.5 font-mono text-[10px] transition-colors',
              i === on || i === on + 1 ? 'text-ink' : 'text-faint',
            )}
          >
            <span
              className={cn(
                'mt-[5px] h-[3px] w-[7px]',
                i === on || i === on + 1 ? 'bg-signal' : 'bg-[#2b3038]',
              )}
            />
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate">{n}</span>
              <span className="shrink-0 text-[9px] text-faint">{ROLES[i]}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-center justify-between font-mono text-[9.5px] text-faint">
        <span>
          hop {on + 1} of 3 · {HOPS[on]}
        </span>
        <span>{shared ?? '—'} shared titles</span>
      </div>
      <div className="mt-1 text-[10.5px] leading-relaxed text-muted">
        The same three hops read backwards close into a 4-cycle, which is why the path count is also
        the cycle count.
      </div>
    </div>
  );
}

const short = (s: string) => (s.length > 9 ? `${s.slice(0, 8)}…` : s);

/* ------------------------------------------------------------------ 4 cycle */

function CycleTopic({ data, uid }: { data: Bundle; uid: number }) {
  const echoes = useMemo(() => data.users.map((u) => u.echo).sort((a, b) => a - b), [data.users]);
  const bins = useMemo(() => {
    const n = 12;
    const lo = 0,
      hi = 0.16;
    const out = new Array(n).fill(0);
    for (const v of echoes)
      out[Math.min(n - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * n)))]++;
    return out.map((c, i) => [lo + ((i + 0.5) / n) * (hi - lo), c] as [number, number]);
  }, [echoes]);

  const topTri = data.stats.topTriangles;

  return (
    <Topic
      n={4}
      owner="C044 · cycle"
      title="Cycles measure echo"
      thesis={
        <>
          Cycles are what a recommender must not over-reward. When a title's audience already sits
          inside the viewer's one-hop neighbourhood, every path to it is a closed loop through
          agreement, so recommending it adds nothing. Echo E is the mean Jaccard overlap with the
          viewer's co-likers, and the novelty factor divides it out.
        </>
      }
      facts={
        <>
          <Fact k="triangles" v={fmtInt(data.stats.triangles)} />
          <Fact k="clustering coefficient" v={fmt3(data.stats.clustering)} accent />
          <Fact k="girth" v={String(data.stats.girth)} />
          <Fact k="median viewer echo" v={fmt3(median(echoes))} />
          <Fact k="highest viewer echo" v={fmt3(echoes[echoes.length - 1])} />
          <Fact k="novelty term" v="1 / (1 + E)" />
        </>
      }
      viz={
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Figure title="Echo across viewers" right={`${fmtInt(data.users.length)} viewers`}>
            <BarChart
              data={bins}
              colour="var(--color-s5)"
              height={168}
              ariaLabel="Distribution of viewer echo scores"
              formatX={(v) => v.toFixed(2)}
              xLabel="mean Jaccard overlap with co-likers"
              formatTip={(x, y) => (
                <div className="font-mono text-[10.5px]">
                  <span className="text-ink">{fmtInt(y)}</span> viewers near{' '}
                  <span className="text-ink">{x.toFixed(2)}</span>
                </div>
              )}
            />
          </Figure>
          <Figure title="Most repetitive vertices" right="triangles">
            <div className="grid gap-1.5">
              {topTri.map(([id, tri, deg], i) => {
                const m = data.movies.find((x) => x.id === id);
                return (
                  <div
                    key={id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2"
                  >
                    <span className="truncate text-[11.5px] text-ink-2">
                      <span className="mr-1.5 font-mono text-[9px] text-faint">{i + 1}</span>
                      {m?.t}
                    </span>
                    <span className="tnum font-mono text-[10px] text-muted">
                      {tri} tri · d {deg}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 border border-line-soft px-2.5 py-2 text-[10.5px] leading-relaxed text-muted">
              A high triangle count means the title's co-likers also co-like each other. It is
              exactly the echo the novelty term penalises.
            </div>
          </Figure>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ 5 eulerian */

function EulerTopic({ data }: { data: Bundle }) {
  const eu = data.euler;
  const [step, setStep] = useState<number | null>(null);
  const [shown, setShown] = useState(90);

  return (
    <Topic
      n={5}
      owner="C043 · Eulerian"
      title="A playlist that uses every genre edge once"
      thesis={
        <>
          Make a multigraph whose vertices are genres and whose edges are titles, placed between a
          film's first two genres. An Eulerian circuit uses every edge exactly once, so the walk
          never repeats a title and always crosses a shared genre into the next. Ten vertices have
          odd degree, so the graph is not Eulerian yet: pairing the odd vertices by shortest path
          and duplicating those edges evens every degree, which is the route-inspection step.
        </>
      }
      facts={
        <>
          <Fact k="genre vertices" v={String(eu.vertices.length)} />
          <Fact k="edges before" v={fmtInt(eu.edgesBefore)} />
          <Fact k="odd-degree vertices" v={String(eu.odd.length)} accent />
          <Fact k="edges after pairing" v={fmtInt(eu.edgesAfter)} />
          <Fact k="all degrees even" v={eu.augmented ? 'yes' : 'no'} accent={eu.augmented} />
          <Fact k="circuit length" v={`${fmtInt(eu.playlist.length)} steps`} />
        </>
      }
      viz={
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Figure title="Genre transition multigraph" right={`${eu.odd.length} odd`}>
            <GenreGraph data={data} />
          </Figure>
          <Figure
            title="Eulerian playlist"
            right={`${fmtInt(eu.playlist.length)} steps`}
            footnote={
              <>
                Showing the first {shown} of {fmtInt(eu.playlist.length)} steps. Each row is one
                edge traversal: the genre it leaves, the film that carries it, and the genre it
                arrives in.
              </>
            }
          >
            <div className="grid gap-1.5">
              <Slider
                value={[shown]}
                onValueChange={([v]) => setShown(v)}
                min={10}
                max={eu.playlist.length}
                step={10}
                aria-label="Playlist length shown"
              />
              <div className="scroll-thin grid max-h-[250px] gap-px overflow-y-auto pr-1">
                {eu.playlist.slice(0, shown).map(([a, c, mid], i) => {
                  const m = data.movies.find((x) => x.id === mid);
                  return (
                    <Button
                      key={i}
                      variant="ghost"
                      onMouseEnter={() => setStep(i)}
                      onFocus={() => setStep(i)}
                      aria-pressed={step === i}
                      className={cn(
                        'grid h-auto w-full grid-cols-[34px_78px_minmax(0,1fr)] items-baseline justify-normal gap-2 px-1 py-1 text-left font-normal',
                        step === i ? 'bg-signal/[0.08] hover:bg-signal/[0.08]' : '',
                      )}
                    >
                      <span className="text-right font-mono text-[9px] text-faint">
                        {String(i + 1).padStart(3, '0')}
                      </span>
                      <span className="truncate font-mono text-[9.5px] text-muted">
                        {data.genres[a]?.n.slice(0, 6)}→{data.genres[c]?.n.slice(0, 6)}
                      </span>
                      <span className="truncate text-[11px] text-ink-2">{m?.t}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </Figure>
        </div>
      }
    />
  );
}

function GenreGraph({ data }: { data: Bundle }) {
  const eu = data.euler;
  const [hover, setHover] = useState<number | null>(null);
  const W = 400,
    H = 280;
  const n = eu.vertices.length;
  const pos = new Map<number, [number, number]>();
  eu.vertices.forEach((v, i) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    // an ellipse, not a circle: the viewBox is wider than it is tall and the
    // genre names need the horizontal room
    pos.set(v.g, [W / 2 + Math.cos(ang) * 138, H / 2 + Math.sin(ang) * 86]);
  });
  const maxDeg = Math.max(...eu.vertices.map((v) => v.deg));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Genre transition multigraph with odd-degree vertices marked"
    >
      {eu.edges.map(([a, c], i) => {
        const p1 = pos.get(a)!,
          p2 = pos.get(c)!;
        const oddEdge = eu.odd.includes(a) && eu.odd.includes(c);
        return (
          <line
            key={i}
            x1={p1[0]}
            y1={p1[1]}
            x2={p2[0]}
            y2={p2[1]}
            stroke={oddEdge ? 'rgba(77,146,255,0.26)' : 'rgba(126,142,162,0.16)'}
            strokeWidth={1}
          />
        );
      })}
      {eu.pairs.map(([a, c], i) => {
        const p1 = pos.get(a)!,
          p2 = pos.get(c)!;
        return (
          <line
            key={`p${i}`}
            x1={p1[0]}
            y1={p1[1]}
            x2={p2[0]}
            y2={p2[1]}
            stroke="var(--color-signal)"
            strokeWidth={1.2}
            strokeDasharray="4 3"
            opacity={hover === null ? 0.75 : 0.35}
          />
        );
      })}
      {eu.vertices.map((v) => {
        const [x, y] = pos.get(v.g)!;
        const odd = eu.odd.includes(v.g);
        const r = 4.5 + (v.deg / maxDeg) * 7;
        // labels sit outside the ring on the vertex's own radius, so they
        // never land on top of the edge bundle in the middle
        const ax = x - W / 2,
          ay = y - H / 2;
        const len = Math.hypot(ax, ay) || 1;
        const lx = x + (ax / len) * (r + 6);
        const ly = y + (ay / len) * (r + 6);
        const anchor = ax / len > 0.25 ? 'start' : ax / len < -0.25 ? 'end' : 'middle';
        return (
          <g key={v.g} onPointerEnter={() => setHover(v.g)} onPointerLeave={() => setHover(null)}>
            <text
              x={lx}
              y={ly + 2.6}
              textAnchor={anchor}
              fontSize={8.5}
              fontFamily="var(--font-mono)"
              fill={
                odd
                  ? 'var(--color-signal)'
                  : hover === v.g
                    ? 'var(--color-ink)'
                    : 'var(--color-muted)'
              }
              stroke="var(--color-canvas)"
              strokeWidth={2.6}
              paintOrder="stroke"
            >
              {data.genres[v.g]?.n.replace('Children', 'Child.')} {v.deg}
            </text>
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={odd ? 'var(--color-signal)' : 'var(--color-s1)'}
              stroke="var(--color-canvas)"
              strokeWidth={1.4}
            />
          </g>
        );
      })}
      <g transform="translate(8, 264)" fontFamily="var(--font-mono)" fontSize={8}>
        <circle cx={4} cy={0} r={3.4} fill="var(--color-signal)" />
        <text x={12} y={3} fill="var(--color-muted)">
          odd degree · {eu.odd.length}
        </text>
        <circle cx={118} cy={0} r={3.4} fill="var(--color-s1)" />
        <text x={126} y={3} fill="var(--color-muted)">
          even degree
        </text>
        <line
          x1={228}
          y1={0}
          x2={246}
          y2={0}
          stroke="var(--color-signal)"
          strokeDasharray="4 3"
          strokeWidth={1.2}
        />
        <text x={252} y={3} fill="var(--color-muted)">
          added pairing
        </text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------- 6 hamiltonian */

function HamiltonTopic({ data, uid }: { data: Bundle; uid: number }) {
  const vid = data.users.some((u) => u.id === uid) ? uid : data.users[0].id;
  const w = data.watch[String(uid)];
  if (!w) return null;
  const gain = w.w - w.gw;

  return (
    <Topic
      n={6}
      owner="C043 · Hamiltonian"
      title="A watch order with no filler between"
      thesis={
        <>
          The top ten candidates become a complete weighted graph, the weight on an edge being their
          similarity. A Hamiltonian path visits each candidate exactly once; maximising total weight
          along it orders the evening so consecutive titles stay related. At ten vertices the subset
          dynamic programme is exact, so the optimum can be compared against the greedy baseline
          rather than assumed.
        </>
      }
      facts={
        <>
          <Fact k="candidates" v={String(w.n)} />
          <Fact k="subset states" v={fmtInt(w.states)} />
          <Fact k="exact optimum" v={fmt2(w.w)} accent />
          <Fact k="greedy baseline" v={fmt2(w.gw)} />
          <Fact k="gap" v={`+${fmt2(gain)}`} />
          <Fact k="complexity" v="O(n² 2ⁿ)" />
        </>
      }
      viz={
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Figure
            title="Optimal order"
            right={`viewer ${uid}`}
            footnote={
              <>
                The right column is the similarity added by stepping to the next title. Summed,
                those ten values equal the optimum above.
              </>
            }
          >
            <div className="grid gap-1">
              {w.order.map((id, i) => {
                const m = data.movies.find((x) => x.id === id);
                const next = w.order[i + 1];
                const weight = next === undefined ? null : w.pairwise[i][i + 1];
                const greedyPos = w.greedy.indexOf(id);
                return (
                  <div
                    key={id}
                    className={cn(
                      'grid grid-cols-[20px_minmax(0,1fr)_auto] items-baseline gap-2 px-1 py-1',
                      greedyPos !== i && 'bg-s1/[0.06]',
                    )}
                  >
                    <span className="font-mono text-[9px] text-faint">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11.5px] text-ink-2">{m?.t}</span>
                      <span className="block font-mono text-[9px] text-faint">
                        {m?.gn.slice(0, 2).join(' / ')}
                      </span>
                    </span>
                    <span className="tnum font-mono text-[10px] text-muted">
                      {weight === null ? 'end' : `+${weight.toFixed(3)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Figure>
          <Figure title="Adjacency of the chosen order" right="Jaccard weights">
            <div className="flex justify-center">
              <Heatmap
                matrix={w.pairwise}
                labels={w.order.map((_, i) => String(i + 1))}
                colour="#3987e5"
                size={252}
                valueLabel="Jaccard"
                title="Watch order pairwise similarity"
              />
            </div>
            <div className="mt-2 text-[10.5px] leading-relaxed text-muted">
              Rows highlighted in the list are titles the greedy pass placed differently. The
              difference is small here, which is the honest result: greedy is often near-optimal on
              ten vertices, and the exact method is what proves it.
            </div>
          </Figure>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ 7 planar */

function PlanarTopic({ data, uid }: { data: Bundle; uid: number }) {
  const p = data.planar;
  const [hover, setHover] = useState<number | null>(null);
  const W = 400,
    H = 300;
  const xs = p.nodes.map((n) => n.x),
    ys = p.nodes.map((n) => n.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const pad = 66;
  const k = Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1));
  const tx = (x: number) => pad + (x - minX) * k + (W - pad * 2 - (maxX - minX) * k) / 2;
  const ty = (y: number) => pad + (y - minY) * k + (H - pad * 2 - (maxY - minY) * k) / 2;

  const rec = data.recs[String(uid)] ?? [];
  const listCol = data.listColour[String(uid)];

  return (
    <Topic
      n={7}
      owner="C046 · planar + colouring"
      title="A planar map and four colours"
      thesis={
        <>
          The genre co-occurrence graph is not planar: it contains a complete graph on five
          vertices, so no drawing can avoid crossings. Dropping the weakest edges until planarity
          returns gives a planar subgraph, drawn straight-line by Tutte's barycentric method with
          the outer face fixed on a circle. Euler's formula holds on that drawing, and
          saturation-degree colouring needs only four colours.
        </>
      }
      facts={
        <>
          <Fact k="full genre graph" v={`${p.fullV}v ${p.fullE}e`} />
          <Fact k="planar" v={p.fullPlanar ? 'yes' : 'no · K₅'} accent />
          <Fact k="planar subgraph" v={`${p.v}v ${p.e}e`} />
          <Fact k="crossings" v={String(p.crossings)} accent />
          <Fact k="Euler χ = V − E + F" v={`${p.v} − ${p.e} + ${p.faces} = ${p.eulerChar}`} />
          <Fact k="colours used" v={`${p.colours} planar / ${p.fullColours} full`} />
          <Fact k="clique lower bound" v={String(p.clique)} />
        </>
      }
      viz={
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Figure
            title="Planar genre map"
            right={`${p.v} vertices · ${p.e} edges · ${p.crossings} crossings`}
            footnote={
              <>
                Only the outer face is labelled on the drawing. Tutte's theorem fixes that face on
                the boundary and solves every interior vertex as a barycentre of its neighbours, so
                the interior geometry is the theorem's own output rather than a layout choice, and
                its vertices genuinely crowd the centre. Hover any name below to pick out its
                vertex.
              </>
            }
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              role="img"
              aria-label="Planar drawing of the genre co-occurrence graph"
            >
              {p.edges.map(([a, c, wt], i) => {
                const A = p.nodes.find((n) => n.g === a)!,
                  C = p.nodes.find((n) => n.g === c)!;
                return (
                  <line
                    key={i}
                    x1={tx(A.x)}
                    y1={ty(A.y)}
                    x2={tx(C.x)}
                    y2={ty(C.y)}
                    stroke={
                      hover !== null && (a === hover || c === hover)
                        ? 'rgba(77,146,255,0.7)'
                        : 'rgba(126,142,162,0.3)'
                    }
                    strokeWidth={0.7 + wt / 100}
                  />
                );
              })}
              {p.nodes.map((n) => {
                const vx = tx(n.x),
                  vy = ty(n.y);
                const cx0 = tx(0),
                  cy0 = ty(0);
                const ax = vx - cx0,
                  ay = vy - cy0;
                const len = Math.hypot(ax, ay);
                const outerR = Math.min((W - pad * 2) / 2, (H - pad * 2) / 2) * 0.9;
                // only the outer face gets a direct label: Tutte's interior
                // vertices sit within a few pixels of each other, so naming
                // them on the drawing would be a pile. The legend below names
                // every genre and highlights its vertex on hover.
                const isOuter = len > outerR;
                const d = isOuter ? 14 : 0;
                const ux = len < 1 ? 1 : ax / len,
                  uy = len < 1 ? 0 : ay / len;
                const lx = vx + ux * d,
                  ly = vy + uy * d;
                const anchor = ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle';
                const active = hover === n.g;
                return (
                  <g
                    key={n.g}
                    onPointerEnter={() => setHover(n.g)}
                    onPointerLeave={() => setHover(null)}
                  >
                    <circle
                      cx={vx}
                      cy={vy}
                      r={active ? 9.5 : isOuter ? 6.5 : 5}
                      fill={colorAt(data.palette, n.col)}
                      stroke={active ? 'var(--color-ink)' : 'var(--color-canvas)'}
                      strokeWidth={active ? 1.4 : 1.6}
                    />
                    {isOuter && (
                      <text
                        x={lx + (anchor === 'start' ? 2 : anchor === 'end' ? -2 : 0)}
                        y={ly + 2.8}
                        textAnchor={anchor}
                        fontSize={8.5}
                        fontFamily="var(--font-mono)"
                        fill={active ? 'var(--color-ink)' : 'var(--color-ink-2)'}
                        stroke="var(--color-canvas)"
                        strokeWidth={2.8}
                        paintOrder="stroke"
                      >
                        {data.genres[n.g]?.n}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[9px] sm:grid-cols-3">
              {p.nodes
                .slice()
                .sort(
                  (a, z) =>
                    a.col - z.col ||
                    (data.genres[a.g]?.n ?? '').localeCompare(data.genres[z.g]?.n ?? ''),
                )
                .map((n) => (
                  <Button
                    key={n.g}
                    variant="ghost"
                    onPointerEnter={() => setHover(n.g)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(n.g)}
                    onBlur={() => setHover(null)}
                    className={cn(
                      'flex h-auto w-full items-center justify-normal gap-1.5 px-1 py-0.5 text-left font-normal',
                      hover === n.g ? 'bg-white/[0.06] text-ink' : 'text-muted hover:text-ink-2',
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-none"
                      style={{ background: colorAt(data.palette, n.col) }}
                    />
                    <span className="truncate">{data.genres[n.g]?.n}</span>
                    <span className="ml-auto text-faint">{n.col + 1}</span>
                  </Button>
                ))}
            </div>
          </Figure>
          <Figure
            title="Colouring the recommendation list"
            right={`${listCol?.k ?? 0} colours`}
            footnote={
              <>
                Conflict graph on this viewer's top ten: two titles are adjacent when they share a
                genre. The colouring is a proper colouring, so an ordering exists in which no two
                similar titles are adjacent. It is drawn as a list because that is how the output is
                delivered.
              </>
            }
          >
            <div className="grid gap-1.5">
              {rec.map((r, i) => {
                const m = data.movies.find((x) => x.id === r.m);
                const c = colorAt(data.palette, listCol?.col[i] ?? 0);
                return (
                  <div
                    key={r.m}
                    className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2"
                  >
                    <span className="h-2.5 w-2.5 rounded-none" style={{ background: c }} />
                    <span className="truncate text-[11px] text-ink-2">{m?.t}</span>
                    <span className="font-mono text-[9px] text-faint">{m?.gn[0]}</span>
                  </div>
                );
              })}
            </div>
          </Figure>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ utils */

function median(arr: number[]) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
