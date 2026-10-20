import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowsOutSimple, Minus, Plus } from '@phosphor-icons/react';
import type { Bundle } from '@/lib/data';
import { colorAt, fmtInt } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ForceCanvas } from '@/components/ForceCanvas';
import { buildAdjacency, movieIndex, reachSets } from '@/lib/store';
import { cn } from '@/lib/utils';

type Mode = 'genre' | 'degree' | 'component';

export default function GraphView({ data, uid }: { data: Bundle; uid: number }) {
  const adj = useMemo(() => buildAdjacency(data), [data]);
  const idx = useMemo(() => movieIndex(data), [data]);

  const [mode, setMode] = useState<Mode>('genre');
  const [blend, setBlend] = useState(0);
  const [edgeCut, setEdgeCut] = useState(5);
  const [minDegree, setMinDegree] = useState(8);
  const [genre, setGenre] = useState(-1);
  const [hlUid, setHlUid] = useState(uid);
  const [selected, setSelected] = useState(-1);
  const [counts, setCounts] = useState<[number, number]>([data.meta.movies, data.meta.edges]);
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    title: string;
    meta: string;
    sub: string;
  } | null>(null);
  const viewRef = useRef<{ x: number; y: number; k: number } | null>(null);
  const fitRef = useRef<() => void>(() => {});

  const highlight = useMemo(
    () => (hlUid < 0 ? null : reachSets(data, adj, hlUid)),
    [data, adj, hlUid],
  );

  const onHover = useCallback(
    (i: number, ev: { x: number; y: number } | null) => {
      if (i < 0 || !ev) return setTip(null);
      const m = data.movies[i];
      setTip({
        x: ev.x,
        y: ev.y,
        title: m.t,
        meta: `${m.y ?? 'n/a'} · degree ${m.gd} · audience ${fmtInt(m.d)} likes`,
        sub: m.gn.join(' / '),
      });
    },
    [data],
  );

  const sel = selected >= 0 ? data.movies[selected] : null;
  const neighbours = useMemo(() => {
    if (selected < 0) return [];
    return data.edges
      .filter(([a, c]) => a === selected || c === selected)
      .sort((a, c) => c[2] - a[2])
      .slice(0, 7);
  }, [data, selected]);

  const sortedUsers = useMemo(() => {
    const top = [...data.users].sort((a, b) => b.n - a.n).slice(0, 140);
    // the viewer carried in from onboarding may not be one of the busiest, and a
    // Select whose value is not in its list renders blank
    const cur = data.users.find((u) => u.id === hlUid);
    if (cur && !top.some((u) => u.id === cur.id)) top.unshift(cur);
    return top;
  }, [data.users, hlUid]);

  return (
    <div className="pt-8">
      <header className="grid grid-cols-1 items-end gap-8 border-b border-line pb-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <div>
          <div className="eyebrow">Whole catalogue · one graph</div>
          <h1 className="mt-3 max-w-[22ch] text-[clamp(27px,3.1vw,42px)] font-normal leading-[1.08] tracking-[-0.033em]">
            {fmtInt(data.meta.movies)} titles, {fmtInt(data.meta.edges)} similarity edges.
          </h1>
        </div>
        <p className="max-w-[52ch] text-[13px] leading-relaxed text-ink-2">
          Two titles are joined when they are rated highly by an overlapping audience, with Jaccard
          similarity as the weight. Positions are precomputed: a force layout on the left, a genre
          grid on the right. Drag, scroll to zoom, click a vertex.
        </p>
      </header>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative h-[min(72dvh,760px)] min-h-[460px] overflow-hidden border border-line bg-canvas">
          <ForceCanvas
            bundle={data}
            colourMode={mode}
            blend={blend / 100}
            edgeCut={edgeCut / 100}
            minDegree={minDegree}
            genreFilter={genre}
            highlight={highlight}
            selected={selected}
            onSelect={setSelected}
            onHover={onHover}
            onCounts={(v, e) => setCounts([v, e])}
            viewRef={viewRef}
            registerFit={(fn) => {
              fitRef.current = fn;
            }}
          />

          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
            <ModeSwitch mode={mode} setMode={setMode} />
            <div className="pointer-events-auto flex items-center gap-1 border border-line bg-canvas/90 p-1 backdrop-blur">
              <Button
                variant="quiet"
                size="icon"
                aria-label="Zoom in"
                onClick={() => zoom(viewRef, 1.35)}
              >
                <Plus size={13} weight="bold" />
              </Button>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Zoom out"
                onClick={() => zoom(viewRef, 1 / 1.35)}
              >
                <Minus size={13} weight="bold" />
              </Button>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Fit to view"
                onClick={() => fitRef.current()}
              >
                <ArrowsOutSimple size={13} weight="bold" />
              </Button>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2">
            <Legend data={data} mode={mode} />
            <span className="border border-line bg-canvas/90 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur">
              {fmtInt(counts[0])} v · {fmtInt(counts[1])} e
            </span>
          </div>

          {tip && (
            <div
              className="pointer-events-none fixed z-50 max-w-[260px] border border-[#2b3542] bg-canvas/97 px-2.5 py-2 shadow-[0_14px_36px_rgba(0,0,0,0.55)]"
              style={{
                left: tip.x + 14 + 260 > innerWidth ? tip.x - 274 : tip.x + 14,
                top: tip.y + 14 + 76 > innerHeight ? tip.y - 90 : tip.y + 14,
              }}
              role="status"
            >
              <div className="text-[12px] font-medium text-ink">{tip.title}</div>
              <div className="font-mono text-[10px] text-muted">{tip.meta}</div>
              <div className="font-mono text-[10px] text-faint">{tip.sub}</div>
            </div>
          )}
        </div>

        <aside className="grid gap-3">
          <Panel title="Layout" right="precomputed">
            <label className="grid gap-2">
              <span className="flex justify-between font-mono text-[9.5px] text-faint">
                <span>similarity</span>
                <span>genre grid</span>
              </span>
              <Slider
                value={[blend]}
                onValueChange={([v]) => setBlend(v)}
                max={100}
                step={1}
                aria-label="Layout blend"
              />
            </label>
            <p className="text-[11px] leading-relaxed text-muted">
              A real morph between two vertex placements. At zero, tightly connected titles cluster;
              at one, they sort into genre blocks.
            </p>
          </Panel>

          <Panel title="Filters" right={`${counts[0]} v`}>
            <label className="grid gap-2">
              <span className="flex justify-between font-mono text-[9.5px] text-faint">
                <span>min edge weight</span>
                <span className="text-ink-2">{(edgeCut / 100).toFixed(2)}</span>
              </span>
              <Slider
                value={[edgeCut]}
                onValueChange={([v]) => setEdgeCut(v)}
                min={5}
                max={50}
                step={1}
                aria-label="Minimum edge weight"
              />
            </label>
            <label className="grid gap-2">
              <span className="flex justify-between font-mono text-[9.5px] text-faint">
                <span>min degree</span>
                <span className="text-ink-2">{minDegree}</span>
              </span>
              <Slider
                value={[minDegree]}
                onValueChange={([v]) => setMinDegree(v)}
                min={8}
                max={36}
                step={1}
                aria-label="Minimum graph degree"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
                Genre
              </span>
              <Select value={String(genre)} onValueChange={(v) => setGenre(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">All genres</SelectItem>
                  {data.genres.map((g) => (
                    <SelectItem key={g.i} value={String(g.i)}>
                      {g.n} <span className="ml-1 font-mono text-[10px] text-faint">{g.c}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => {
                setEdgeCut(5);
                setMinDegree(8);
                setGenre(-1);
              }}
            >
              Reset filters
            </Button>
          </Panel>

          <Panel title="Trace a viewer">
            <Select value={String(hlUid)} onValueChange={(v) => setHlUid(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-1">No highlight</SelectItem>
                {sortedUsers.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    Viewer {u.id}{' '}
                    <span className="ml-1 font-mono text-[10px] text-faint">{u.n} titles</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {highlight ? (
              <div className="grid gap-1 font-mono text-[10.5px]">
                <Row k="liked" v={fmtInt(highlight.likes.size)} dot="#4d92ff" />
                <Row k="at 2 hops" v={fmtInt(highlight.hop2.size)} dot="#2a6ab0" />
                <Row k="at 3 hops" v={fmtInt(highlight.hop3.size)} dot="#1b3a5c" />
              </div>
            ) : (
              <p className="text-[11px] leading-relaxed text-muted">
                Marks one viewer's liked titles in blue and the rest of their reach by distance.
                Everything unreached recedes.
              </p>
            )}
          </Panel>

          <Panel
            title={sel ? 'Selected vertex' : 'Selected vertex'}
            right={selected >= 0 ? `#${selected}` : '—'}
          >
            {!sel ? (
              <p className="text-[11.5px] text-muted">Click a vertex to inspect it.</p>
            ) : (
              <div className="grid gap-2.5">
                <div>
                  <div className="text-[13px] font-medium leading-snug">{sel.t}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {sel.gn.map((g) => (
                      <span
                        key={g}
                        className="border border-line px-1.5 py-0.5 font-mono text-[9px] text-ink-2"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1">
                  <Row k="degree" v={String(sel.gd)} />
                  <Row k="audience" v={fmtInt(sel.d)} />
                  <Row k="component" v={String(sel.c)} />
                </div>
                <div className="grid gap-1 border-t border-line-soft pt-2">
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
                    Strongest neighbours
                  </div>
                  {neighbours.map(([a, c, w]) => {
                    const other = data.movies[a === selected ? c : a];
                    return (
                      <div key={`${a}-${c}`} className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[11px] text-ink-2">{other.t}</span>
                        <span className="tnum shrink-0 font-mono text-[10px] text-muted">
                          {w.toFixed(3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function zoom(ref: React.MutableRefObject<{ x: number; y: number; k: number } | null>, f: number) {
  const v = ref.current;
  if (!v) return;
  // the canvas owns its view; dispatch through a custom event it listens to
  ref.current = { ...v };
  document.dispatchEvent(new CustomEvent('graph-zoom', { detail: f }));
}

function ModeSwitch({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const opts: [Mode, string][] = [
    ['genre', 'Genre'],
    ['degree', 'Degree'],
    ['component', 'Component'],
  ];
  return (
    <div className="pointer-events-auto border border-line bg-canvas/90 p-1 backdrop-blur">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && setMode(v as Mode)}
        aria-label="Colour mode"
      >
        {opts.map(([id, label]) => (
          <ToggleGroupItem key={id} value={id} aria-label={`Colour by ${label.toLowerCase()}`}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function Legend({ data, mode }: { data: Bundle; mode: Mode }) {
  if (mode === 'degree') {
    return (
      <div className="flex items-center gap-2 border border-line bg-canvas/90 px-2 py-1.5 font-mono text-[9.5px] text-muted backdrop-blur">
        degree
        <span className="h-1.5 w-24 rounded-none bg-gradient-to-r from-[#21456f] to-[#a8cdf5]" />
      </div>
    );
  }
  if (mode === 'component') {
    return (
      <div className="flex items-center gap-2 border border-line bg-canvas/90 px-2 py-1.5 font-mono text-[9.5px] text-muted backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-none" style={{ background: data.palette[0] }} />
        one connected component
      </div>
    );
  }
  return (
    <div className="flex max-w-[540px] flex-wrap items-center gap-x-3 gap-y-1 border border-line bg-canvas/90 px-2 py-1.5 font-mono text-[9.5px] text-muted backdrop-blur">
      {data.genres.slice(0, 10).map((g) => (
        <span key={g.i} className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-none"
            style={{ background: colorAt(data.palette, g.i) }}
          />
          {g.n}
        </span>
      ))}
    </div>
  );
}

function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line-soft px-3.5 py-2">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-muted">{title}</h2>
        {right && <span className="font-mono text-[9.5px] text-faint">{right}</span>}
      </div>
      <div className="grid gap-3 p-3.5">{children}</div>
    </section>
  );
}

function Row({ k, v, dot }: { k: string; v: string; dot?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[11px] text-muted">
        {dot && <span className="h-1.5 w-1.5 rounded-none" style={{ background: dot }} />}
        {k}
      </span>
      <span className="tnum font-mono text-[10.5px] text-ink">{v}</span>
    </div>
  );
}
