import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import type { Bundle } from '@/lib/data';
import { colorAt, fmtInt } from '@/lib/data';
import { prefersReduced, useSize } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The presentation from deck/build_deck.py, rendered as markup rather than
 * pictures of a pptx: the type stays selectable and every figure is drawn from
 * the bundle the rest of the app reads. The slide canvas is a fixed 1280 × 720
 * (13.333 × 7.5 in at 96 dpi) and is scaled as one object, so a slide never
 * reflows on a narrow screen.
 */

const BASE_W = 1280;
const BASE_H = 720;
const ML = 81.6;
const RIGHT = 1198.4;
const CONTENT_TOP = 172.8;
const VIEWER = 498;
const REDUCED = prefersReduced();

type SlideProps = { data: Bundle; page: number };

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Measured line count for a string at a given width, using the font the deck
 * already loaded. Returns null when there is no canvas (the caller then falls
 * back to a character estimate), so this never throws during a render.
 */
function measureLines() {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return null;
    ctx.font = '400 13.3px "Plex Sans", ui-sans-serif, system-ui, sans-serif';
    return (text: string, width: number) => {
      const words = text.split(' ');
      let lines = 1;
      let cur = '';
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(next).width <= width || !cur) cur = next;
        else {
          lines++;
          cur = w;
        }
      }
      return lines;
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- motion */

/** Staggered entrance with no transition at all under reduced motion. */
const rise = (delay: number, y = 10) =>
  REDUCED
    ? {}
    : {
        initial: { opacity: 0, y },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay, ease: 'easeOut' as const },
      };

/** SVG wires: draw along their own length. */
const draw = (delay: number, duration = 0.7) =>
  REDUCED
    ? {}
    : {
        initial: { pathLength: 0 },
        animate: { pathLength: 1 },
        transition: { duration, delay, ease: 'easeInOut' as const },
      };

/** SVG labels: opacity only, so the `y` attribute is never overwritten. */
const fade = (delay: number) =>
  REDUCED
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.4, delay, ease: 'easeOut' as const },
      };

/** Vertices and other marks: pop in place. */
const pop = (delay: number, scale = 0.55) =>
  REDUCED
    ? {}
    : {
        initial: { opacity: 0, scale },
        animate: { opacity: 1, scale: 1 },
        transition: { duration: 0.36, delay, ease: 'backOut' as const },
      };

const svgOrigin = { transformBox: 'fill-box', transformOrigin: 'center' } as const;

/** A number that settles on its real value. */
function Count({
  to,
  decimals = 0,
  delay = 0,
  className,
}: {
  to: number;
  decimals?: number;
  delay?: number;
  className?: string;
}) {
  const [v, setV] = useState(REDUCED ? to : 0);
  useEffect(() => {
    if (REDUCED) return;
    let raf = 0;
    const start = performance.now() + delay * 1000;
    const tick = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - start) / 620));
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return <span className={cn('tnum', className)}>{decimals ? v.toFixed(decimals) : fmtInt(v)}</span>;
}

/* ------------------------------------------------------------------ shell */

function Frame({
  label,
  title,
  page,
  children,
}: {
  label?: string;
  title?: string;
  page: number;
  children: ReactNode;
}) {
  return (
    <div className="relative h-[720px] w-[1280px] overflow-hidden bg-canvas">
      {label && (
        <motion.div
          {...rise(0, 6)}
          className="absolute left-[81.6px] top-[46px] font-serif text-[15px] italic text-muted"
        >
          {label}
        </motion.div>
      )}
      {title && (
        <motion.h2
          {...rise(0.05, 8)}
          className="absolute left-[81.6px] top-[72px] w-[1116px] font-serif text-[38.7px] font-normal leading-[1.1] tracking-[-0.018em] text-ink"
        >
          {title}
        </motion.h2>
      )}
      <div className="absolute left-[81.6px] right-[81.6px] top-[153.6px] h-px bg-line" />
      <div className="absolute right-[81.6px] top-[668px] font-mono text-[12px] text-faint">
        {page} / 14
      </div>
      {children}
    </div>
  );
}

function Lede({
  children,
  x = ML,
  y = CONTENT_TOP,
  w = 484.8,
  delay = 0.12,
}: {
  children: ReactNode;
  x?: number;
  y?: number;
  w?: number;
  delay?: number;
}) {
  return (
    <motion.p
      {...rise(delay, 10)}
      className="absolute text-[17.3px] leading-[1.55] text-ink-2"
      style={{ left: x, top: y, width: w }}
    >
      {children}
    </motion.p>
  );
}

function Note({
  children,
  x,
  y,
  w,
  delay = 0.3,
}: {
  children: ReactNode;
  x: number;
  y: number;
  w: number;
  delay?: number;
}) {
  return (
    <motion.p
      {...rise(delay, 8)}
      className="absolute text-[12.6px] leading-[1.55] text-faint"
      style={{ left: x, top: y, width: w }}
    >
      {children}
    </motion.p>
  );
}

function Caption({
  children,
  x,
  y,
  w,
  delay = 0.18,
}: {
  children: ReactNode;
  x: number;
  y: number;
  w: number;
  delay?: number;
}) {
  return (
    <motion.div
      {...rise(delay, 6)}
      className="absolute font-serif text-[13.3px] italic text-muted"
      style={{ left: x, top: y, width: w }}
    >
      {children}
    </motion.div>
  );
}

/** Mono/sans advance estimates, so a long value steps down instead of
 *  painting back across its own label — the measurement `facts()` does in
 *  build_deck.py, approximated for the two shipping faces. */
const monoSize = (text: string, avail: number, max = 14) =>
  Math.max(9, Math.min(max, avail / Math.max(1, text.length * 0.6)));
const sansSize = (text: string, avail: number, max = 14) =>
  Math.max(9.5, Math.min(max, avail / Math.max(1, text.length * 0.53)));

function Facts({
  x,
  y,
  w,
  rows,
  accent = [],
  gap = 30.24,
  valueFrac = 0.42,
  delay = 0.2,
}: {
  x: number;
  y: number;
  w: number;
  rows: [string, ReactNode][];
  accent?: number[];
  gap?: number;
  valueFrac?: number;
  delay?: number;
}) {
  const labelW = w * (1 - valueFrac) - 14;
  const valueW = w * valueFrac - 4;
  return (
    <div className="absolute" style={{ left: x, top: y, width: w }}>
      {rows.map(([k, v], i) => {
        const text = typeof v === 'string' || typeof v === 'number' ? String(v) : '';
        return (
          <motion.div
            key={k}
            {...rise(delay + i * 0.035, 6)}
            className="relative flex items-baseline justify-between"
            style={{ height: gap, gap: 12 }}
          >
            <span
              className="min-w-0 whitespace-nowrap text-muted"
              style={{ fontSize: sansSize(k, labelW) }}
            >
              {k}
            </span>
            <span
              className={cn(
                'tnum shrink-0 whitespace-nowrap text-right font-mono',
                accent.includes(i) ? 'text-signal-hi' : 'text-ink',
              )}
              style={{ fontSize: text ? monoSize(text, valueW) : 14 }}
            >
              {v}
            </span>
            <span
              aria-hidden
              className="absolute left-0 h-px bg-line-soft"
              style={{ top: gap - 1, width: w }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function Kpi({
  x,
  y,
  value,
  label,
  size = 30,
  delay = 0.35,
}: {
  x: number;
  y: number;
  value: ReactNode;
  label: string;
  size?: number;
  delay?: number;
}) {
  return (
    <motion.div {...rise(delay, 8)} className="absolute" style={{ left: x, top: y }}>
      <div className="font-serif leading-none text-ink" style={{ fontSize: size * 1.333 }}>
        {value}
      </div>
      <div className="mt-2 text-[12.6px] text-muted">{label}</div>
    </motion.div>
  );
}

/* ------------------------------------------------------------- 1 · title */

function TitleSlide({ page }: SlideProps) {
  const sq = 63.4;
  const sp = 122.9;
  const mx = 878.4;
  const my = 193.9;
  const a = { x: mx + sq / 2, y: my + 2 * sp + sq / 2 };
  const b = { x: mx + sp + sq / 2, y: my + sp + sq / 2 };
  const c = { x: mx + 2 * sp + sq / 2, y: my + sq / 2 };

  return (
    <Frame page={page}>
      <svg className="absolute inset-0" width={BASE_W} height={BASE_H} aria-hidden>
        <motion.path
          {...draw(0.3, 0.5)}
          d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
          stroke="var(--color-faint)"
          strokeWidth={4.5}
        />
        <motion.path
          {...draw(0.55, 0.5)}
          d={`M ${b.x} ${b.y} L ${c.x} ${c.y}`}
          stroke="var(--color-faint)"
          strokeWidth={4.5}
        />
      </svg>
      <motion.div
        {...pop(0.4)}
        className="absolute bg-s1"
        style={{ left: mx, top: my + 2 * sp, width: sq, height: sq }}
      />
      <motion.div
        {...pop(0.65)}
        className="absolute bg-s3"
        style={{ left: mx + sp, top: my + sp, width: sq, height: sq }}
      />
      <motion.div
        {...pop(0.9)}
        className="absolute bg-signal"
        style={{ left: mx + 2 * sp, top: my, width: sq, height: sq }}
      />

      <motion.div
        {...rise(0.02, 6)}
        className="absolute left-[81.6px] top-[88px] font-serif text-[16px] italic text-muted"
      >
        Discrete mathematics · semester project
      </motion.div>
      <motion.div
        {...rise(0.08, 8)}
        className="absolute left-[81.6px] top-[112px] font-serif text-[85.3px] leading-[1.05] tracking-[-0.025em] text-ink"
      >
        NextFrame
      </motion.div>
      <motion.div
        {...rise(0.16, 8)}
        className="absolute left-[81.6px] top-[220px] w-[787px] font-serif text-[33.3px] leading-[1.2] text-ink-2"
      >
        Graph theory in streaming recommendations
      </motion.div>
      <motion.div
        {...rise(0.22)}
        className="absolute left-[81.6px] top-[347.5px] h-px w-[422.4px] bg-line"
      />
      <motion.p
        {...rise(0.28, 8)}
        className="absolute left-[81.6px] top-[368px] w-[768px] text-[18px] leading-[1.55] text-ink-2"
      >
        A recommendation engine built as a graph problem over the MovieLens archive: 1,437 titles,
        8,498 weighted edges, and every score on screen traceable to a path that produced it.
      </motion.p>
      <motion.div
        {...rise(0.36, 6)}
        className="absolute left-[81.6px] top-[560px] text-[14.7px] text-muted"
      >
        Semester VII · Division B · Batch B2
      </motion.div>
      <motion.div
        {...rise(0.42, 6)}
        className="absolute left-[81.6px] top-[588px] font-mono text-[16px] text-ink-2"
      >
        C039 · C043 · C044 · C046
      </motion.div>
    </Frame>
  );
}

/* ---------------------------------------------------- 2 · graph construction */

function GraphSlide({ data, page }: SlideProps) {
  const m = data.meta;
  const vh = [52.2, 127.1, 202.0];
  const tv = [19.5, 81.6, 143.5, 203.8];
  const bx = 16.3;
  const tx = 141.1;
  const node = 18.2;
  const proj = [
    { x: 95.8, y: 32.2 },
    { x: 32.4, y: 120.5 },
    { x: 159.1, y: 120.5 },
    { x: 95.8, y: 208.8 },
  ];
  const pe: [number, number, number][] = [
    [0, 1, 1],
    [0, 2, 1],
    [1, 2, 2],
    [1, 3, 1],
    [2, 3, 1],
  ];
  const bip: [number, number][] = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [1, 2],
    [1, 3],
  ];

  return (
    <Frame page={page} label="Graph construction · C039" title="One graph, built from 100,836 ratings">
      <Lede w={465.6}>
        A rating of 3.5 or more is an edge between a viewer and a title. Two cut-offs keep the graph
        readable: a title needs ten likes to enter the catalogue, a viewer needs eight catalogue
        likes to receive a list.
      </Lede>

      <svg
        className="absolute"
        style={{ left: ML, top: 280 }}
        width={360}
        height={300}
        viewBox="0 0 360 300"
        role="img"
        aria-label="Bipartite sketch of viewers and titles"
      >
        {bip.map(([v, t], i) => (
          <motion.path
            key={`${v}-${t}`}
            {...draw(0.24 + i * 0.05, 0.4)}
            d={`M ${bx + node} ${vh[v] + node / 2} L ${tx} ${tv[t] + node / 2}`}
            stroke="var(--color-line)"
            strokeWidth={1.1}
          />
        ))}
        {vh.map((y, i) => (
          <motion.rect
            key={i}
            {...pop(0.2 + i * 0.06, 0.4)}
            style={svgOrigin}
            x={bx}
            y={y}
            width={node}
            height={node}
            fill="var(--color-muted)"
          />
        ))}
        {tv.map((y, i) => (
          <motion.rect
            key={i}
            {...pop(0.3 + i * 0.06, 0.4)}
            style={svgOrigin}
            x={tx}
            y={y}
            width={node}
            height={node}
            fill="var(--color-s1)"
          />
        ))}
      </svg>
      <Caption x={96} y={508.8} w={230}>
        bipartite&nbsp; viewer — title
      </Caption>

      <svg
        className="absolute"
        style={{ left: 300, top: 356 }}
        width={90}
        height={60}
        viewBox="0 0 90 60"
        aria-hidden
      >
        <motion.path
          {...draw(0.62, 0.35)}
          d="M 32 26 L 62 26"
          stroke="var(--color-faint)"
          strokeWidth={1.2}
        />
        <path d="M 62 26 l -5 -3 M 62 26 l -5 3" stroke="var(--color-faint)" strokeWidth={1.2} />
      </svg>
      <motion.div
        {...rise(0.66, 4)}
        className="absolute left-[315px] top-[400px] font-serif text-[12px] italic text-faint"
      >
        project
      </motion.div>

      <svg
        className="absolute"
        style={{ left: 390, top: 300 }}
        width={260}
        height={260}
        viewBox="0 0 260 260"
        role="img"
        aria-label="Weighted similarity graph on four titles"
      >
        {pe.map(([a, b, wgt], i) => (
          <motion.path
            key={i}
            {...draw(0.5 + i * 0.07, 0.45)}
            d={`M ${proj[a].x} ${proj[a].y} L ${proj[b].x} ${proj[b].y}`}
            stroke="var(--color-faint)"
            strokeOpacity={0.6}
            strokeWidth={1.2 + wgt * 1.7}
          />
        ))}
        {proj.map((p, i) => (
          <motion.circle
            key={i}
            {...pop(0.68 + i * 0.07)}
            style={svgOrigin}
            cx={p.x}
            cy={p.y}
            r={8.2}
            fill="var(--color-s1)"
            stroke="var(--color-canvas)"
            strokeWidth={2}
          />
        ))}
      </svg>
      <Caption x={416} y={531.8} w={330}>
        similarity graph, weighted by Jaccard
      </Caption>

      <Facts
        x={700.8}
        y={289.9}
        w={497.3}
        valueFrac={0.42}
        accent={[4]}
        delay={0.24}
        rows={[
          ['ratings', fmtInt(m.ratings)],
          ['likes ≥ 3.5', fmtInt(m.likes)],
          ['titles in catalogue', fmtInt(m.movies)],
          ['viewers', fmtInt(m.users)],
          ['weighted edges', fmtInt(m.edges)],
          ['neighbours kept per title', `k = ${m.k}`],
        ]}
      />

      <Note x={700.8} y={489.6} w={497.3} delay={0.42}>
        The projection is second-order: two titles are adjacent when the same viewers liked both. The
        weight is the Jaccard index of the two audiences — the share of their combined audience that
        liked both. The t₂–t₃ edge above is drawn twice as heavy because two viewers support it.
      </Note>
      <Note x={700.8} y={577.9} w={497.3} delay={0.48}>
        The bundle also carries a recent-releases layer — {data.recent.length} films from 2025 and
        2026 — deliberately outside these counts, because the archive has no ratings for them and
        inventing an audience size would be a lie.
      </Note>
    </Frame>
  );
}

/* ------------------------------------------------------------ 3 · degree */

function DegreeSlide({ data, page }: SlideProps) {
  const m = data.meta;
  const dist = new Map<number, number>(data.degreeDist as [number, number][]);
  const lo = 8;
  const hi = 26;
  let tail = 0;
  for (const [d, c] of dist) if (d > hi) tail += c;
  const bars: [string, number][] = [];
  for (let d = lo; d <= hi; d++) bars.push([String(d), dist.get(d) ?? 0]);
  bars.push([`${hi + 1}+`, tail]);
  const peak = Math.max(...bars.map(([, c]) => c));
  const slot = 562.6 / bars.length;
  const H = 251.5;

  return (
    <Frame page={page} label="Degree · C039" title="Two different numbers both get called degree">
      <Lede w={484.8}>
        Audience size d is how many viewers liked a title, and it drives the popularity term in the
        score. Similarity degree is how many titles share a neighbourhood with it, and it is what the
        graph topics count. They are different numbers, so the bundle stores them separately.
      </Lede>

      <Facts
        x={ML}
        y={380.2}
        w={484.8}
        valueFrac={0.56}
        accent={[0]}
        rows={[
          ['mean similarity degree', m.meanDegree.toFixed(2)],
          ['median', String(m.medianDegree)],
          ['maximum', `${m.maxDegree}  ·  The Sweet Hereafter`],
          ['sum of degrees', `${fmtInt(data.stats.handshake)} = 2 × ${fmtInt(m.edges)}`],
          ['edge density', '0.0082'],
          ['mean audience size', m.meanAudience.toFixed(2)],
        ]}
      />

      <Caption x={628.8} y={165.1} w={480}>
        Similarity degree, all {fmtInt(m.movies)} titles
      </Caption>
      <div className="absolute" style={{ left: 628.8, top: 224.6, width: 562.6, height: H }}>
        {bars.map(([lab, cnt], i) => {
          const h = Math.max(2, (cnt / peak) * H);
          return (
            <motion.div
              key={lab}
              className="absolute bottom-0 bg-s1"
              style={{
                left: i * slot + 3.4,
                width: slot - 6.7,
                height: h,
                transformOrigin: 'bottom',
              }}
              initial={REDUCED ? undefined : { scaleY: 0 }}
              animate={REDUCED ? undefined : { scaleY: 1 }}
              transition={
                REDUCED ? undefined : { duration: 0.5, delay: 0.22 + i * 0.022, ease: 'easeOut' }
              }
            />
          );
        })}
        {bars.map(([lab], i) =>
          i % 4 === 0 || i === bars.length - 1 ? (
            <span
              key={`l-${lab}`}
              className="absolute font-mono text-[10px] text-faint"
              style={{ left: i * slot - 10, top: H + 9, width: 44, textAlign: 'center' }}
            >
              {lab}
            </span>
          ) : null,
        )}
      </div>
      <div className="absolute" style={{ left: 628.8, top: 476.1, width: 562.6 }}>
        <div className="h-px bg-line" />
      </div>
      <motion.div
        {...rise(0.2, 4)}
        className="absolute left-[630.8px] top-[208px] font-mono text-[11.3px] text-muted"
      >
        {peak}
      </motion.div>
      <div className="absolute left-[632px] top-[505px] text-[12px] text-faint">
        titles at each degree
      </div>
      <motion.div
        {...rise(0.5, 4)}
        className="absolute left-[1080px] top-[447px] w-[106px] text-right font-mono text-[12px] text-faint"
      >
        tail {tail}
      </motion.div>

      <Note x={628.8} y={539.5} w={562.6} delay={0.44}>
        The spike at the left is not a property of the data, it is the construction: every title keeps
        its eight strongest neighbours, so degree 8 is a floor. Above that the tail is genuine — a
        handful of titles are structurally close to thirty-odd others.
      </Note>
      <Note x={628.8} y={599} w={562.6} delay={0.5}>
        Handshaking lemma: every edge contributes twice, and the ledger balances — 16,996 degree units
        against 8,498 edges.
      </Note>
    </Frame>
  );
}

/* ------------------------------------------------------ 4 · connectivity */

function ConnectivitySlide({ data, page }: SlideProps) {
  const u = data.users.find((x) => x.id === VIEWER);
  const total = data.meta.movies;
  const segs: [string, number, string][] = [
    ['own likes', u?.n ?? 0, 'bg-line-soft'],
    ['1 hop', u?.reach1 ?? 0, 'bg-s1'],
    ['2 hops', u?.reach2 ?? 0, 'bg-signal-hi'],
    ['3 hops', u?.reach3 ?? 0, 'bg-signal'],
    ['4+', u?.unreached ?? 0, 'bg-line'],
  ];
  let cursor = 0;

  return (
    <Frame
      page={page}
      label="Connectivity · C039"
      title="One component, no chokepoints, diameter seven"
    >
      <Lede w={484.8}>
        Union–find with path compression and union by rank over all {fmtInt(data.meta.edges)} edges
        returns a single component holding every one of the {fmtInt(data.meta.movies)} titles. The
        graph has no articulation point and no bridge, so no title is load-bearing and no edge is a
        chokepoint.
      </Lede>

      <Facts
        x={ML}
        y={320.6}
        w={484.8}
        accent={[0]}
        rows={[
          ['components', '1'],
          ['large component', fmtInt(data.meta.largest)],
          ['articulation points', String(data.stats.articulation)],
          ['bridges', String(data.stats.bridges)],
          ['diameter', String(data.stats.diameter)],
          ['mean path length', data.stats.meanPath.toFixed(3)],
          ['clustering coefficient', data.stats.clustering.toFixed(4)],
        ]}
      />

      <Caption x={628.8} y={205.4} w={480}>
        Viewer {VIEWER} — every title by hop distance
      </Caption>
      <div className="absolute" style={{ left: 628.8, top: 234.2, width: 562.6, height: 44.2 }}>
        {segs.map(([lab, cnt, col]) => {
          const w = (562.6 * cnt) / Math.max(1, total);
          const left = cursor;
          cursor += w;
          return (
            <motion.div
              key={lab}
              className={cn('absolute top-0 h-full', col)}
              style={{ left, width: w, transformOrigin: 'left' }}
              initial={REDUCED ? undefined : { scaleX: 0 }}
              animate={REDUCED ? undefined : { scaleX: 1 }}
              transition={
                REDUCED ? undefined : { duration: 0.55, delay: 0.24 + segs.findIndex((s) => s[0] === lab) * 0.06, ease: 'easeOut' }
              }
            />
          );
        })}
      </div>

      {segs.map(([lab, cnt, col], i) => (
        <motion.div
          key={lab}
          {...rise(0.4 + i * 0.05, 5)}
          className="absolute grid items-baseline font-mono text-[13.3px]"
          style={{ left: 628.8, top: 297.6 + i * 40.3, width: 562.6, gridTemplateColumns: '1fr auto auto' }}
        >
          <span className="flex items-center gap-2.5">
            <span className={cn('h-[15.4px] w-[15.4px] border border-line', col)} />
            <span className="text-[13.3px] font-sans text-ink-2">{lab}</span>
          </span>
          <span className="tnum pr-10 text-ink">{fmtInt(cnt)}</span>
          <span className="tnum w-[80px] text-right text-muted">
            {((100 * cnt) / Math.max(1, total)).toFixed(1)}%
          </span>
        </motion.div>
      ))}

      <Note x={628.8} y={506.9} w={562.6} delay={0.46}>
        The five parts sum to {fmtInt(total)} — the {fmtInt(u?.n ?? 0)} titles the viewer already
        liked are at distance zero and are counted before the search begins. Almost half the catalogue is three hops away, and {fmtInt(u?.unreached ?? 0)} titles
        sit at four or beyond, outside the three-hop window the recommendation stage searches. That
        limit is stated in the app rather than hidden.
      </Note>
      <Note x={628.8} y={595.2} w={562.6} delay={0.52}>
        Diameter {data.stats.diameter} on {fmtInt(total)} vertices is the small-world signature:
        sparse, but the high-audience titles act as hubs.
      </Note>
    </Frame>
  );
}

/* -------------------------------------------------------------- 5 · path */

function PathSlide({ data, page }: SlideProps) {
  const rec = data.recs[String(VIEWER)]?.[0];
  const anchor = data.movies.find((m) => m.id === 356);
  const candidate = data.movies.find((m) => m.id === 2571);
  const blocks = [
    { x: 645.1, y: 220.8, val: String(VIEWER), name: `viewer ${VIEWER}`, cls: 'bg-s1', delay: 0.22 },
    { x: 865.9, y: 220.8, val: '6', name: 'co-liker', cls: 'bg-s3', delay: 0.32 },
    { x: 726.7, y: 332.2, val: '356', name: anchor?.t ?? 'anchor', cls: 'bg-muted', delay: 0.5 },
    {
      x: 947.5,
      y: 332.2,
      val: '2571',
      name: candidate?.t ?? 'candidate',
      cls: 'bg-signal',
      delay: 0.6,
    },
  ];
  const centres = blocks.map((b) => ({ x: b.x + 15.4, y: b.y + 15.4 }));

  return (
    <Frame
      page={page}
      label="Path · C043"
      title="A recommendation is a path, and the app draws it"
    >
      <Lede w={484.8}>
        A path of length three, alternating between the two sides of the bipartite graph: the viewer,
        a co-liker, the title the two of them most agree on, and the candidate. The co-liker is the
        witness, the anchor is the evidence, and the candidate is the answer.
      </Lede>

      <Caption x={635.5} y={188.2} w={520} delay={0.16}>
        one witness path, {VIEWER} → {candidate?.t ?? 'candidate'}
      </Caption>

      <svg className="absolute inset-0" width={BASE_W} height={BASE_H} aria-hidden>
        {[
          [0, 1],
          [1, 2],
          [2, 3],
        ].map(([a, b], i) => (
          <motion.path
            key={i}
            {...draw(0.3 + i * 0.16, 0.45)}
            d={`M ${centres[a].x} ${centres[a].y} L ${centres[b].x} ${centres[b].y}`}
            stroke="var(--color-faint)"
            strokeWidth={1.6}
          />
        ))}
      </svg>

      {blocks.map((b) => (
        <div key={b.val} className="absolute" style={{ left: b.x, top: b.y }}>
          <motion.div
            {...pop(b.delay)}
            className={cn('h-[30.7px] w-[30.7px]', b.cls)}
          />
          <motion.div
            {...rise(b.delay + 0.08, 5)}
            className="absolute -left-[48px] top-[38px] w-[127px] font-mono text-[13.3px] text-ink"
          >
            {b.val}
          </motion.div>
          <motion.div
            {...rise(b.delay + 0.12, 5)}
            className="absolute -left-[48px] top-[59px] w-[127px] text-[11.3px] text-muted"
          >
            {b.name}
          </motion.div>
        </div>
      ))}
      <motion.div
        {...rise(0.5, 4)}
        className="absolute left-[745px] top-[255px] font-serif text-[11.3px] italic text-faint"
      >
        viewed
      </motion.div>
      <motion.div
        {...rise(0.72, 4)}
        className="absolute left-[965px] top-[367px] font-serif text-[11.3px] italic text-faint"
      >
        recommended
      </motion.div>

      <Facts
        x={628.8}
        y={416.6}
        w={562.6}
        accent={[4]}
        delay={0.44}
        rows={[
          [
            `titles ${VIEWER} and viewer ${rec?.paths[0]?.v ?? 6} both liked`,
            String(rec?.paths[0]?.n ?? 16),
          ],
          ['same, for viewers 58 and 45', '16  ·  14'],
          ['anchor', `${anchor?.t ?? 'Forrest Gump'}  (356)`],
          ['Jaccard, anchor → candidate', (rec?.paths[0]?.sj ?? 0.409).toFixed(3)],
          ['distinct 4-cycles  P', fmtInt(rec?.cyc ?? 0)],
          ['candidates ranked', fmtInt(rec?.cand ?? 0)],
        ]}
      />

      <Note x={ML} y={405.1} w={484.8} delay={0.4}>
        Read the four stops as a walk: viewer, co-liker, anchor, candidate. Close it at the viewer and
        the same three edges form a 4-cycle in the bipartite graph — exactly what the next slide
        counts.
      </Note>
    </Frame>
  );
}

/* ------------------------------------------------------------- 6 · cycle */

function CycleSlide({ data, page }: SlideProps) {
  const rec = data.recs[String(VIEWER)]?.[0];
  const echoes = data.users.map((u) => u.echo).sort((a, b) => a - b);
  const median = echoes.length ? echoes[Math.floor(echoes.length / 2)] : 0;
  const highest = echoes.length ? echoes[echoes.length - 1] : 0;
  const covered = rec ? Math.round(rec.echo * rec.deg) : 0;

  return (
    <Frame
      page={page}
      label="Cycle · C043"
      title="Cycles measure echo, and echo must be divided out"
    >
      <Lede w={484.8}>
        Close the three-hop path at the viewer and it is a 4-cycle. The count of distinct such cycles
        is the support term P. But a cycle also means the viewer's neighbours already cover the
        candidate's audience — so P alone rewards echo, and the score has to divide it back out.
      </Lede>

      <Caption x={633.5} y={199.7} w={420} delay={0.16}>
        echo&nbsp; E = |A(m) ∩ N(u)| / |A(m)|
      </Caption>
      <svg
        className="absolute"
        style={{ left: 600, top: 220 }}
        width={280}
        height={180}
        viewBox="0 0 280 180"
        role="img"
        aria-label="Echo as the overlap between a viewer's co-likers and a title's audience"
      >
        <motion.circle
          {...draw(0.24, 0.8)}
          cx={102.7}
          cy={93}
          r={67.2}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={1.4}
        />
        <motion.circle
          {...draw(0.4, 0.8)}
          cx={169.9}
          cy={93}
          r={67.2}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={1.4}
        />
        <motion.text
          {...pop(0.9, 0.7)}
          style={svgOrigin}
          x={94}
          y={85}
          fontFamily="var(--font-serif)"
          fontSize={20}
          fill="var(--color-signal-hi)"
        >
          E
        </motion.text>
      </svg>
      <motion.div
        {...rise(0.44, 5)}
        className="absolute left-[633.6px] top-[389.8px] w-[140px] text-[10.7px] text-muted"
      >
        co-likers N(u)
      </motion.div>
      <motion.div
        {...rise(0.5, 5)}
        className="absolute left-[712.3px] top-[389.8px] w-[140px] text-[10.7px] text-muted"
      >
        audience A(m)
      </motion.div>

      <Facts
        x={896.6}
        y={218.9}
        w={293.8}
        valueFrac={0.42}
        accent={[0]}
        delay={0.24}
        rows={[
          [`The Matrix  ${covered} / ${rec?.deg ?? 0}`, (rec?.echo ?? 0).toFixed(3)],
          ['median viewer', median.toFixed(3)],
          ['highest viewer', highest.toFixed(3)],
        ]}
      />

      <Facts
        x={ML}
        y={351.4}
        w={484.8}
        accent={[2]}
        delay={0.3}
        rows={[
          ['triangles', fmtInt(data.stats.triangles)],
          ['clustering coefficient', data.stats.clustering.toFixed(4)],
          ['girth', String(data.stats.girth)],
          ['4-cycles through The Matrix', fmtInt(rec?.cyc ?? 0)],
          ['novelty 1 / (1 + E)', (1 / (1 + (rec?.echo ?? 0))).toFixed(3)],
        ]}
      />

      <Note x={633.6} y={410.9} w={562.6} delay={0.46}>
        Girth {data.stats.girth} says triangles exist, so the projected graph is not bipartite — the
        projection of a bipartite graph never is. {fmtInt(data.stats.triangles)} triangles at a
        clustering coefficient of {data.stats.clustering.toFixed(3)} is a graph in which two titles
        that share a neighbour usually share several.
      </Note>
      <Note x={633.6} y={539.5} w={562.6} delay={0.52}>
        E for The Matrix is {covered} / {rec?.deg ?? 0}: the viewer's immediate neighbourhood already
        covers {(100 * (rec?.echo ?? 0)).toFixed(0)}% of its audience. Its novelty factor is{' '}
        {(1 / (1 + (rec?.echo ?? 0))).toFixed(3)} — the score halves what the cycle count alone would
        pay.
      </Note>
    </Frame>
  );
}

/* ------------------------------------------------------------- 7 · score */

function ScoreSlide({ data, page }: SlideProps) {
  const rec = data.recs[String(VIEWER)]?.[0];
  const cyc = rec?.cyc ?? 0;
  const deg = rec?.deg ?? 0;
  const echo = rec?.echo ?? 0;
  const novelty = 1 / (1 + echo);
  const ord = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
  const rank = (rec?.rank ?? 0) + 1;

  const labels = [
    ['support', 'distinct 4-cycles through the candidate, logged because the tail is long'],
    ['popularity', 'audience size, damped by α = 0.35 so reach alone does not decide'],
    ['novelty', 'the echo share, inverted — agreement already banked pays less'],
  ];
  const rows: [string, string, boolean][] = [
    ['P  cycle count', fmtInt(cyc), false],
    ['1 + ln(1 + P)', (rec?.cycTerm ?? 0).toFixed(3), false],
    ['d  audience', String(deg), false],
    ['d^0.35', (rec?.damp ?? 0).toFixed(3), false],
    ['E  echo', echo.toFixed(3), false],
    ['1 / (1 + E)', novelty.toFixed(3), false],
    ['S', (rec?.s ?? 0).toFixed(3), true],
  ];

  return (
    <Frame
      page={page}
      label="Weighted graph · C043"
      title="The score multiplies three terms, each a graph fact"
    >
      <motion.div
        {...rise(0.12, 8)}
        className="absolute left-[81.6px] top-[164px] flex items-baseline whitespace-nowrap"
      >
        <span className="font-serif text-[40px] text-ink">S&nbsp;&nbsp;=&nbsp;&nbsp;</span>
        <span className="font-mono text-[34.7px] text-ink-2">(1 + ln(1 + P))</span>
        <span className="font-serif text-[40px] text-ink">&nbsp;&nbsp;×&nbsp;&nbsp;</span>
        <span className="font-mono text-[34.7px] text-ink-2">d</span>
        <sup className="font-mono text-[20px] text-ink-2">0.35</sup>
        <span className="font-serif text-[40px] text-ink">&nbsp;&nbsp;×&nbsp;&nbsp;</span>
        <span className="font-mono text-[34.7px] text-ink-2">1 / (1 + E)</span>
      </motion.div>
      <motion.div {...rise(0.18)} className="absolute left-[81.6px] top-[251.5px] h-px w-[1116px] bg-line" />

      {labels.map(([k, v], i) => (
        <motion.div
          key={k}
          {...rise(0.24 + i * 0.06, 6)}
          className="absolute"
          style={{ left: ML + i * 376.3, top: 268.8, width: 340.8 }}
        >
          <div className="font-serif text-[16px] italic text-ink">{k}</div>
          <div className="mt-[7px] text-[13.3px] leading-[1.5] text-muted">{v}</div>
        </motion.div>
      ))}

      <motion.div
        {...rise(0.3, 6)}
        className="absolute left-[81.6px] top-[385.9px] font-serif text-[16px] italic text-ink"
      >
        Worked, The Matrix, viewer {VIEWER}
      </motion.div>
      {rows.map(([k, v, last], i) => (
        <motion.div
          key={k}
          {...rise(0.36 + i * 0.05, 5)}
          className="absolute grid items-baseline"
          style={{
            left: ML,
            top: 418.6 + i * 31.2,
            width: 470.4,
            gridTemplateColumns: '326.4px 144px',
          }}
        >
          <span
            className={cn(
              last ? 'text-[14.7px] font-medium text-ink' : 'font-mono text-[14.7px] text-muted',
            )}
          >
            {k}
          </span>
          {last ? (
            <span className="tnum text-right font-mono text-[15.3px] font-medium text-signal-hi">
              <Count to={rec?.s ?? 0} decimals={3} delay={0.75} />
            </span>
          ) : (
            <span className="tnum text-right font-mono text-[15.3px] text-ink">{v}</span>
          )}
          <span
            aria-hidden
            className={cn('absolute left-0 h-px', last ? 'bg-line' : 'bg-line-soft')}
            style={{ top: 26, width: 470.4 }}
          />
        </motion.div>
      ))}

      <Kpi x={676.8} y={389.8} value={ord(rank)} label={`rank of ${fmtInt(rec?.cand ?? 0)} candidates`} size={34} delay={0.5} />
      <Kpi
        x={926.4}
        y={389.8}
        value={ord(rec?.popRank ?? 3)}
        label="popularity rank, for contrast"
        size={34}
        delay={0.58}
      />
      <Note x={676.8} y={503} w={480} delay={0.54}>
        {(rec?.cycTerm ?? 0).toFixed(3)} × {(rec?.damp ?? 0).toFixed(3)} × {novelty.toFixed(3)} ={' '}
        {(rec?.s ?? 0).toFixed(3)}. The app prints the three factors under every score, so a viewer
        can see which one carried it.
      </Note>
      <Note x={676.8} y={562.6} w={518} delay={0.6}>
        Third on raw audience, first on the score: the 0.35 exponent is what stops the most-watched
        title from winning by default, and the {fmtInt(cyc)} cycles are what put it on top.
      </Note>
    </Frame>
  );
}

/* ------------------------------------------------------------- 8 · Euler */

function EulerSlide({ data, page }: SlideProps) {
  const eu = data.euler;
  const dx = 628.8;
  const dy = 197.8;
  const cx = 945.6;
  const cy = 207.4;
  const largest = [...eu.vertices].sort((a, b) => b.deg - a.deg)[0];
  const oddCount = eu.odd.length;

  return (
    <Frame
      page={page}
      label="Eulerian graphs · C044"
      title="Euler's theorem says no, and the degrees say why"
    >
      <Lede w={484.8}>
        Two genres are adjacent when a title carries both, so each title with two or more genres
        contributes one edge — a multigraph of {fmtInt(eu.edgesBefore)} edges over {eu.vertices.length}{' '}
        vertices. An Eulerian circuit needs every degree even. Ten of the nineteen are odd, so the
        theorem refuses the walk outright.
      </Lede>

      <Caption x={628.8} y={170.9} w={500} delay={0.16}>
        Genre degree · odd vertices in blue
      </Caption>
      <div className="absolute" style={{ left: dx, top: dy, width: 300 }}>
        {eu.vertices.map((v, i) => {
          const odd = v.deg % 2 === 1;
          return (
            <motion.div
              key={v.g}
              {...rise(0.2 + i * 0.012, 4)}
              className="absolute grid items-center"
              style={{
                left: 0,
                top: i * 19.68,
                width: 300,
                height: 19.68,
                gridTemplateColumns: '155.5px 59.5px 8.6px 70px',
                columnGap: 8,
              }}
            >
              <span className={cn('truncate text-[11.3px]', odd ? 'text-ink' : 'text-muted')}>
                {v.n}
              </span>
              <span
                className={cn('tnum font-mono text-[11.3px]', odd ? 'text-signal-hi' : 'text-faint')}
              >
                {v.deg}
              </span>
              <motion.span
                className={cn('h-[8.6px] w-[8.6px]', odd ? 'bg-signal' : 'bg-line')}
                initial={REDUCED ? undefined : { opacity: 0, scale: 0.4 }}
                animate={REDUCED ? undefined : { opacity: 1, scale: 1 }}
                transition={REDUCED ? undefined : { duration: 0.3, delay: 0.34 + i * 0.018 }}
              />
              <span className={cn('text-[10.7px]', odd ? 'text-muted' : 'text-faint')}>
                {odd ? 'odd' : 'even'}
              </span>
            </motion.div>
          );
        })}
      </div>

      <Caption x={945.6} y={178.6} w={240} delay={0.2}>
        Euler's condition
      </Caption>
      {[
        ['connected', 'yes', true],
        ['all degrees even', `no — ${oddCount === 10 ? 'ten' : String(oddCount)} odd`, false],
        ['Eulerian circuit', 'none exists', false],
      ].map(([k, v, ok], i) => (
        <motion.div
          key={k as string}
          {...rise(0.28 + i * 0.07, 5)}
          className="absolute"
          style={{ left: cx, top: cy + i * 63.4, width: 240 }}
        >
          <div className="text-[12px] text-muted">{k as string}</div>
          <div
            className={cn('mt-[7px] font-mono text-[13.3px]', ok ? 'text-good' : 'text-bad')}
          >
            {v as string}
          </div>
          <div className="mt-[12px] h-px w-[230.4px] bg-line-soft" />
        </motion.div>
      ))}

      <Facts
        x={ML}
        y={395.5}
        w={484.8}
        gap={28.8}
        accent={[3]}
        delay={0.32}
        rows={[
          ['genre vertices', String(eu.vertices.length)],
          ['edges  (titles with ≥ 2 genres)', fmtInt(eu.edgesBefore)],
          ['sum of degrees', `${fmtInt(2 * eu.edgesBefore)} = 2 × ${fmtInt(eu.edgesBefore)}`],
          ['odd-degree vertices', String(oddCount)],
          ['largest degree', `${largest?.n ?? '—'}, ${largest?.deg ?? 0}`],
        ]}
      />

      <Note x={ML} y={549.1} w={484.8} delay={0.46}>
        By the handshaking lemma the number of odd vertices must be even, and ten is. That parity is
        not a coincidence and not a problem — it is the exact quantity the next slide has to spend
        edges on.
      </Note>
    </Frame>
  );
}

/* ------------------------------------------------------ 9 · Eulerisation */

function EulerPairSlide({ data, page }: SlideProps) {
  const eu = data.euler;
  const added = eu.pairs.reduce((n, [, , d]) => n + d, 0);
  const walk =
    eu.playlist.length > 0
      ? [
          data.genres[eu.playlist[0][0]]?.n,
          ...eu.playlist.slice(0, 8).map(([, t]) => data.genres[t]?.n),
        ]
      : [];

  return (
    <Frame
      page={page}
      label="Eulerian graphs · C044"
      title="Ten odd vertices, five pairs, nine duplicated edges"
    >
      <Lede w={484.8}>
        Pair the ten odd vertices by shortest distance in the underlying simple graph, then duplicate
        every edge along each connecting path. Parity flips at both ends of the path, all degrees
        become even, and Hierholzer's algorithm returns the circuit.
      </Lede>

      <Caption x={ML} y={330.2} w={400} delay={0.16}>
        Odd pairing · distance added
      </Caption>
      <div className="absolute" style={{ left: ML, top: 357.1, width: 480 }}>
        {eu.pairs.map(([a, b, d], i) => (
          <motion.div
            key={`${a}-${b}`}
            {...rise(0.22 + i * 0.06, 5)}
            className="relative flex items-baseline justify-between"
            style={{ height: 28.8, width: 393.6 }}
          >
            <span className="text-[13.3px] text-ink-2">
              {data.genres[a]?.n} — {data.genres[b]?.n}
            </span>
            <span className="tnum font-mono text-[13.3px] text-ink">
              +{d} edge{d > 1 ? 's' : ''}
            </span>
            <span aria-hidden className="absolute left-0 h-px w-[393.6px] bg-line-soft" style={{ top: 24 }} />
          </motion.div>
        ))}
        <motion.div
          {...rise(0.6, 5)}
          className="mt-[5.8px] flex items-baseline justify-between"
          style={{ width: 393.6 }}
        >
          <span className="text-[12.6px] text-muted">total added</span>
          <span className="tnum font-mono text-[13.3px] text-signal-hi">+{added}</span>
        </motion.div>
      </div>

      <Facts
        x={628.8}
        y={201.6}
        w={562.6}
        accent={[3]}
        delay={0.26}
        rows={[
          ['edges before', fmtInt(eu.edgesBefore)],
          ['odd vertices', `${eu.odd.length}  →  ${eu.pairs.length} pairs`],
          ['edges duplicated', String(added)],
          ['edges after', fmtInt(eu.edgesAfter)],
          ['all degrees even', eu.augmented ? 'yes' : 'no'],
          ['circuit length', `${fmtInt(eu.edgesAfter)} traversals`],
          ['output', 'a playlist that alternates genres'],
        ]}
      />

      <Note x={628.8} y={433.9} w={562.6} delay={0.46}>
        A circuit is a closed walk that uses every edge exactly once — so the playlist never repeats
        a title, and consecutive titles always share a genre because the walk moves along a genre
        edge.
      </Note>

      <Caption x={628.8} y={510.7} w={500} delay={0.5}>
        the circuit's first eight hops
      </Caption>
      <motion.div
        {...rise(0.54)}
        className="absolute left-[628.8px] top-[535.7px] w-[562.6px] font-mono text-[13.3px] leading-[1.5] text-ink-2"
      >
        {walk.filter(Boolean).join('  →  ')}
      </motion.div>
      <Note x={628.8} y={595.2} w={562.6} delay={0.56}>
        Every hop crosses a genre edge, so the playlist can only move to a neighbouring genre — the
        alternation is the walk, not a rule added on top. Hierholzer runs in time linear in the edges.
      </Note>
    </Frame>
  );
}

/* ----------------------------------------------------- 10 · Hamiltonian */

function HamiltonianSlide({ data, page }: SlideProps) {
  const w = data.watch[String(VIEWER)];
  const cell = 23.52;
  const mx = 604.8;
  const my = 230.4;
  const RAMP = ['bg-signal-dim', 'bg-signal/40', 'bg-signal', 'bg-signal-hi', 'bg-s1'];
  const gain = w ? w.w - w.gw : 0;

  return (
    <Frame
      page={page}
      label="Hamiltonian graphs · C044"
      title="A watch order is a Hamiltonian path over the top ten"
    >
      <Lede w={470.4}>
        Same ten candidates, different question: visit every candidate exactly once, maximising the
        total similarity along the way. Held–Karp is exact and costs n² · 2ⁿ —{' '}
        {fmtInt(w?.states ?? 0)} states for n = 10, which is why the list is ten long.
      </Lede>

      <Caption x={578.8} y={176.6} w={420} delay={0.14}>
        Pairwise Jaccard, the ten candidates
      </Caption>
      {w && (
        <div className="absolute" style={{ left: mx, top: my, width: cell * 10, height: cell * 10 }}>
          {w.pairwise.map((row, i) =>
            row.map((v, j) => {
              const idx = i === j ? -1 : Math.min(4, Math.floor(v / 0.14));
              return (
                <motion.div
                  key={`${i}-${j}`}
                  className={cn('absolute', idx < 0 ? 'bg-raised' : RAMP[idx])}
                  style={{ left: j * cell, top: i * cell, width: cell - 1.2, height: cell - 1.2 }}
                  initial={REDUCED ? undefined : { opacity: 0 }}
                  animate={REDUCED ? undefined : { opacity: 1 }}
                  transition={
                    REDUCED
                      ? undefined
                      : { duration: 0.32, delay: 0.2 + (i + j) * 0.016, ease: 'easeOut' }
                  }
                />
              );
            }),
          )}
        </div>
      )}
      {w &&
        w.order.map((_, i) => (
          <span
            key={`r${i}`}
            className="absolute font-mono text-[9.3px] text-faint"
            style={{ left: mx - 23, top: my + i * cell + 6, width: 18, textAlign: 'right' }}
          >
            {i + 1}
          </span>
        ))}
      {w &&
        w.order.map((_, i) => (
          <span
            key={`c${i}`}
            className="absolute font-mono text-[9.3px] text-faint"
            style={{ left: mx + i * cell, top: my - 19, width: cell, textAlign: 'center' }}
          >
            {i + 1}
          </span>
        ))}

      <Caption x={872.6} y={176.6} w={200} delay={0.18}>
        The order
      </Caption>
      {w &&
        w.order.map((id, i) => {
          const m = data.movies.find((x) => x.id === id);
          let t = m?.t ?? String(id);
          if (t.length > 34) t = `${t.slice(0, 33)}…`;
          return (
            <motion.div
              key={id}
              {...rise(0.34 + i * 0.035, 4)}
              className="absolute flex items-baseline gap-2"
              style={{ left: 872.6, top: my + i * 22.3, width: 300 }}
            >
              <span className="w-[25px] shrink-0 font-mono text-[10.7px] text-faint">{i + 1}</span>
              <span className="truncate text-[10.9px] text-ink-2">{t}</span>
            </motion.div>
          );
        })}

      <Facts
        x={604.8}
        y={514.6}
        w={585.6}
        gap={28.8}
        delay={0.42}
        rows={[
          ['optimal total weight', (w?.w ?? 0).toFixed(3)],
          ['nearest-neighbour baseline', (w?.gw ?? 0).toFixed(3)],
          ['the exact method gains', `+${((100 * gain) / Math.max(1e-9, w?.gw ?? 1)).toFixed(1)}%`],
          ['states searched', fmtInt(w?.states ?? 0)],
        ]}
      />

      <Kpi
        x={ML}
        y={403.2}
        value={
          <>
            {w?.n ?? 10} · 2<sup className="text-[18px]">10</sup>
          </>
        }
        label={`states for n = ${w?.n ?? 10}`}
        size={27}
        delay={0.36}
      />
      <Note x={ML} y={489.6} w={470.4} delay={0.44}>
        The DP state is (set visited, last vertex): the best path over that subset ending there. Every
        state extends by one unvisited vertex, and the full table answers the question exactly rather
        than approximately.
      </Note>
      <Note x={ML} y={572.2} w={470.4} delay={0.5}>
        Ten is a design choice, not a limitation of the idea — the state count doubles with every
        extra candidate.
      </Note>
    </Frame>
  );
}

/* ---------------------------------------------------------- 11 · planarity */

function PlanarSlide({ data, page }: SlideProps) {
  const p = data.planar;
  const ceiling = 3 * p.fullV - 6;
  const excess = p.fullE - ceiling;
  const kx = 825.6;
  const ky = 347.5;
  const r = 122.9;
  const names = ['Drama', 'Comedy', 'Thriller', 'Action', 'Romance'];
  const nodes = names.map((_, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: kx + r * Math.cos(ang), y: ky + r * Math.sin(ang), ang };
  });
  const OX = 640;
  const OY = 190;

  return (
    <Frame
      page={page}
      label="Planar graphs · C046"
      title="The genre graph cannot be drawn without crossings"
    >
      <Lede w={484.8}>
        Drop the multiplicities and keep an edge when two genres co-occur in at least six titles:{' '}
        {p.fullV} vertices, {p.fullE} edges. Every planar graph with v ≥ 3 obeys e ≤ 3v − 6. The
        ceiling here is {ceiling}, and the graph has {p.fullE}.
      </Lede>

      <motion.div {...rise(0.2, 8)} className="absolute left-[81.6px] top-[326.4px] font-mono">
        <div className="text-[29.3px] text-ink">e&nbsp;&nbsp;≤&nbsp;&nbsp;3v − 6</div>
        <div className="mt-[10px] text-[29.3px] text-bad">
          {p.fullE}&nbsp;&nbsp;≤&nbsp;&nbsp;{3 * p.fullV} − 6 = {ceiling}
        </div>
      </motion.div>
      <motion.div
        {...rise(0.3, 6)}
        className="absolute left-[81.6px] top-[433.9px] w-[484.8px] font-serif text-[16px] italic text-bad"
      >
        false, so the graph is not planar
      </motion.div>

      <Facts
        x={ML}
        y={489.6}
        w={484.8}
        gap={28.8}
        accent={[0]}
        delay={0.34}
        rows={[
          ['vertices / edges', `${p.fullV} / ${p.fullE}`],
          ['planar ceiling 3v − 6', String(ceiling)],
          ['excess', String(excess)],
          ['Kuratowski', 'K₅ witness'],
          ['largest clique', `K${p.clique === 9 ? '₉' : p.clique}`],
        ]}
      />

      <Caption x={662.4} y={163.2} w={460} delay={0.16}>
        K₅ inside it — the Kuratowski witness
      </Caption>
      <svg
        className="absolute"
        style={{ left: OX, top: OY }}
        width={370}
        height={320}
        viewBox="0 0 370 320"
        role="img"
        aria-label="Complete graph on five vertices, the Kuratowski witness"
      >
        {nodes.map((a, i) =>
          nodes.slice(i + 1).map((b, j) => (
            <motion.path
              key={`${i}-${j}`}
              {...draw(0.26 + (i + j) * 0.05, 0.4)}
              d={`M ${a.x - OX} ${a.y - OY} L ${b.x - OX} ${b.y - OY}`}
              stroke="var(--color-faint)"
              strokeOpacity={0.55}
              strokeWidth={1.2}
            />
          )),
        )}
        {nodes.map((n, i) => {
          const lx = kx + (r + 26.9) * Math.cos(n.ang);
          const ly = ky + (r + 26.9) * Math.sin(n.ang);
          const anchor = Math.cos(n.ang) > 0.3 ? 'start' : Math.cos(n.ang) < -0.3 ? 'end' : 'middle';
          return (
            <g key={i}>
              <motion.circle
                {...pop(0.5 + i * 0.07)}
                style={svgOrigin}
                cx={n.x - OX}
                cy={n.y - OY}
                r={6.7}
                fill="var(--color-s1)"
                stroke="var(--color-canvas)"
                strokeWidth={1.8}
              />
              <motion.text
                {...fade(0.56 + i * 0.07)}
                x={lx - OX}
                y={ly - OY + 4}
                textAnchor={anchor}
                fontFamily="var(--font-sans)"
                fontSize={11.3}
                fill="var(--color-ink-2)"
              >
                {names[i]}
              </motion.text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/* --------------------------------------------------------- 12 · Tutte map */

function TutteSlide({ data, page }: SlideProps) {
  const p = data.planar;
  const gx = 628.8;
  const gy = 188.2;
  const gw = 556.8;
  const gh = 380.2;
  const xs = p.nodes.map((n) => n.x);
  const ys = p.nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const k = Math.min(gw / (maxX - minX + 1e-9), gh / (maxY - minY + 1e-9));
  const TX = (x: number) => gw / 2 + (x - (maxX + minX) / 2) * k * 0.94;
  const TY = (y: number) => gh / 2 - (y - (maxY + minY) / 2) * k * 0.94;

  return (
    <Frame
      page={page}
      label="Planar graphs · C046"
      title="Keep the heavy edges, and four colours suffice"
    >
      <Lede w={484.8}>
        Keep the heaviest edges in descending co-occurrence order and discard any edge that breaks
        planarity: {p.e} survive, {p.fullE - p.e} go. Tutte's barycentric method then places every
        interior vertex at the average of its neighbours, with the outer face pinned on a circle.
      </Lede>

      <Facts
        x={ML}
        y={357.1}
        w={484.8}
        accent={[0, 3]}
        delay={0.24}
        rows={[
          ['planar subgraph', `${p.v} vertices · ${p.e} edges`],
          ['crossings in the drawing', String(p.crossings)],
          ['faces  F', String(p.faces)],
          ['Euler  V − E + F', `${p.v} − ${p.e} + ${p.faces} = ${p.eulerChar}`],
          ['colours  DSATUR', `${p.colours}  (planar)`],
          ['largest clique', 'K₄  →  χ = 4 exactly'],
        ]}
      />

      <svg
        className="absolute"
        style={{ left: gx, top: gy }}
        width={gw}
        height={gh}
        viewBox={`0 0 ${gw} ${gh}`}
        role="img"
        aria-label="Tutte barycentric drawing of the planar genre graph"
      >
        {p.edges.map(([a, b], i) => {
          const A = p.nodes.find((n) => n.g === a);
          const B = p.nodes.find((n) => n.g === b);
          if (!A || !B) return null;
          return (
            <motion.path
              key={i}
              {...draw(0.2 + i * 0.014, 0.5)}
              d={`M ${TX(A.x)} ${TY(A.y)} L ${TX(B.x)} ${TY(B.y)}`}
              stroke="var(--color-faint)"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          );
        })}
        {p.nodes.map((n, i) => {
          const cx = TX(n.x);
          const cy = TY(n.y);
          const outer = Math.abs(n.x) > 0.9 || Math.abs(n.y) > 0.9;
          const dxn = n.x > 0.5 ? 1 : n.x < -0.5 ? -1 : 0;
          return (
            <g key={n.g}>
              <motion.circle
                {...pop(0.36 + i * 0.032)}
                style={svgOrigin}
                cx={cx}
                cy={cy}
                r={6.2}
                fill={colorAt(data.palette, n.col)}
                stroke="var(--color-canvas)"
                strokeWidth={1.6}
              />
              {outer && (
                <motion.text
                  {...fade(0.62 + i * 0.025)}
                  x={cx + (dxn >= 0 ? 9.6 : -9.6)}
                  y={cy + 3.4}
                  textAnchor={dxn >= 0 ? 'start' : 'end'}
                  fontFamily="var(--font-sans)"
                  fontSize={10.7}
                  fill="var(--color-ink-2)"
                >
                  {n.n}
                </motion.text>
              )}
            </g>
          );
        })}
      </svg>
      <Caption x={628.8} y={568.5} w={560} delay={0.5}>
        Tutte drawing · {p.v} vertices, {p.e} edges, {p.crossings} crossings, {p.colours} colours
      </Caption>
      <Note x={628.8} y={593.5} w={562.6} delay={0.56}>
        The interior crowds because every inner vertex is a barycentre of its neighbours — the drawing
        is the theorem, not a layout choice.
      </Note>
    </Frame>
  );
}

/* --------------------------------------------------------- 13 · colouring */

function ColourSlide({ data, page }: SlideProps) {
  const recs = data.recs[String(VIEWER)] ?? [];
  const lc = data.listColour[String(VIEWER)];
  const p = data.planar;

  // Row geometry, measured rather than assumed: one of the ten titles is long
  // enough to need two lines in its column, so its row is taller and the rule
  // below it moves down with it. A fixed pitch would cut through that line.
  const { rowY, rowH } = useMemo(() => {
    // Column widths and row pitch are the pptx's own (TXW 3.10 in, ROW_H
    // 0.392 in, LINE_H 0.208 in at 96 dpi), so exactly one title wraps and the
    // tenth row still clears the closing note at y=595.
    const TITLE_W = 297.6;
    const LINE = 19.97;
    const PAD = 37.63;
    const measure = measureLines();
    const y: number[] = [];
    const h: number[] = [];
    let top = 186.2;
    for (const r of recs.slice(0, 10)) {
      const t = data.movies.find((x) => x.id === r.m)?.t ?? '';
      const lines = measure ? measure(t, TITLE_W) : Math.ceil(t.length / 38);
      const height = PAD + (Math.max(1, lines) - 1) * LINE;
      y.push(top);
      h.push(height);
      top += height;
    }
    return { rowY: y, rowH: h };
  }, [recs, data.movies]);

  return (
    <Frame
      page={page}
      label="Graph colouring · C046"
      title="Colour the list so no two neighbours are adjacent"
    >
      <Lede w={484.8}>
        The conflict graph on one viewer's top ten: two titles are adjacent when they share a genre.
        A proper colouring is a proof that an ordering exists in which no two similar titles sit next
        to each other.
      </Lede>

      <Facts
        x={ML}
        y={316.8}
        w={484.8}
        valueFrac={0.44}
        accent={[2]}
        delay={0.24}
        rows={[
          ['vertices', String(recs.length || 10)],
          ['adjacency', 'share a genre'],
          ['colours  DSATUR', String(lc?.k ?? 7)],
          ['largest clique', 'K₇  →  χ = 7 exactly'],
          ['most conflicted', 'Fight Club, 9'],
          ['genre graph, planar', `${p.colours} colours`],
          ['genre graph, full', `${p.fullColours} colours`],
          ['full-graph clique', `K${p.clique === 9 ? '₉' : p.clique}`],
        ]}
      />
      <Note x={ML} y={577.9} w={484.8} delay={0.46}>
        Seven is not just what the heuristic happened to find: the seven titles in the clique all
        share Action, so any proper colouring needs seven, and DSATUR lands exactly on the bound.
      </Note>

      <Caption x={628.8} y={161.2} w={520} delay={0.14}>
        Viewer {VIEWER}'s top ten, in order, by colour
      </Caption>
      <div className="absolute left-[1096.8px] top-[161px] w-[60px] text-right font-serif text-[12px] italic text-faint">
        colour
      </div>
      {/* Rows are stacked from their own measured height, the way the pptx
          does it: a title that needs two lines makes its row taller and pushes
          the rule down with it, rather than being cut at a fixed pitch. */}
      {recs.slice(0, 10).map((r, i) => {
        const m = data.movies.find((x) => x.id === r.m);
        const col = colorAt(data.palette, lc?.col?.[i] ?? 0);
        // already accumulated by ROWS above; read the row's own slice
        return (
          <motion.div
            key={r.m}
            {...rise(0.26 + i * 0.045, 5)}
            className="absolute"
            style={{ left: 628.8, top: rowY[i], width: 528, height: rowH[i] }}
          >
            <motion.span
              className="absolute left-0 top-[4px] h-[14.4px] w-[14.4px]"
              style={{ background: col }}
              initial={REDUCED ? undefined : { scale: 0 }}
              animate={REDUCED ? undefined : { scale: 1 }}
              transition={
                REDUCED ? undefined : { duration: 0.34, delay: 0.3 + i * 0.045, ease: 'backOut' }
              }
            />
            {/* The title column wraps instead of truncating: one of the ten
                is long enough that an ellipsis would eat the part that
                identifies it, and a wrapped row only costs a line. */}
            <span className="absolute left-[28.8px] top-0 w-[297.6px] text-[13.3px] leading-[1.45] text-ink-2">
              {m?.t}
            </span>
            <span className="absolute left-[328.3px] top-[2px] w-[163.2px] truncate text-[10.7px] text-faint">
              {m?.gn.slice(0, 2).join(' · ')}
            </span>
            <span className="absolute left-[495.4px] top-0 w-[32.6px] text-right font-mono text-[12px] text-muted">
              {(lc?.col?.[i] ?? 0) + 1}
            </span>
            <span
              aria-hidden
              className="absolute left-0 h-px w-[528px] bg-line-soft"
              style={{ top: rowH[i] - 1 }}
            />
          </motion.div>
        );
      })}
      <Note x={628.8} y={595.2} w={562.6} delay={0.6}>
        Seven colours for ten titles: the constraint is tight enough that a greedy pass cannot do
        better than the clique demands.
      </Note>
    </Frame>
  );
}

/* --------------------------------------------------------- 14 · conclusion */

function ConclusionSlide({ data, page }: SlideProps) {
  const w = data.watch[String(VIEWER)];
  const rows: [string, string, string][] = [
    ['Degree', 'audience size and similarity degree, kept apart', `${data.meta.meanDegree.toFixed(2)} mean`],
    ['Connectivity', 'one component, no bridge, diameter 7', `${fmtInt(data.meta.movies)} reached`],
    ['Path', 'three-hop witness paths as support', '1,416 candidates'],
    ['Cycle', '4-cycles and echo, divided back out', `C ${data.stats.clustering.toFixed(3)} · ${fmtInt(data.stats.triangles)} tri`],
    ['Eulerian', '10 odd vertices, 5 pairs, 9 edges added', `${fmtInt(data.euler.edgesAfter)} traversals`],
    ['Hamiltonian', 'exact max-weight order by Held–Karp', `${(w?.w ?? 0).toFixed(3)} vs ${(w?.gw ?? 0).toFixed(3)}`],
    ['Planar + colouring', 'K₅ blocks it; 4 colours after pruning', `χ = ${data.planar.colours}, tight`],
  ];

  return (
    <Frame page={page} label="Conclusion" title="Seven topics, one graph, seven answers">
      <Caption x={ML} y={165.1} w={500} delay={0.12}>
        Topic · what it answered · the number
      </Caption>

      {rows.map(([a, b, c], i) => (
        <motion.div
          key={a}
          {...rise(0.2 + i * 0.055, 5)}
          className="absolute"
          style={{ left: ML, top: 192 + i * 42.24, width: 907.2 }}
        >
          <div className="grid items-baseline" style={{ gridTemplateColumns: '201.6px 523.2px 182.4px' }}>
            <span className="text-[14.7px] text-ink">{a}</span>
            <span className="text-[13.3px] leading-[1.4] text-muted">{b}</span>
            <span className="tnum text-right font-mono text-[12.7px] text-signal-hi">{c}</span>
          </div>
          <span
            aria-hidden
            className={cn('absolute left-0 h-px w-[907.2px]', i < rows.length - 1 ? 'bg-line-soft' : 'bg-line')}
            style={{ top: 34.6 }}
          />
        </motion.div>
      ))}

      <motion.div
        {...rise(0.34, 6)}
        className="absolute left-[1012.8px] top-[165.1px] font-serif text-[14.7px] text-muted"
      >
        Limits
      </motion.div>
      <motion.div
        {...rise(0.4, 6)}
        className="absolute left-[1012.8px] top-[195.8px] w-[187.2px] space-y-[9px] text-[12px] leading-[1.5] text-ink-2"
      >
        <p>{fmtInt(data.meta.users)} viewers is a sample, not a platform.</p>
        <p>
          Recommendations search three hops out; {fmtInt(data.users.find((u) => u.id === VIEWER)?.unreached ?? 0)}{' '}
          titles sit beyond that.
        </p>
        <p>
          The archive ends in 2018. Recent releases are carried separately, without audience figures.
        </p>
      </motion.div>

      <motion.p
        {...rise(0.48, 8)}
        className="absolute left-[81.6px] top-[514.6px] w-[902.4px] font-serif text-[17.3px] leading-[1.5] text-ink"
      >
        Nothing here is illustrated. Every number on these slides is computed from 100,836 ratings and
        printed in the app, next to the paths that produced it.
      </motion.p>
      <motion.div {...rise(0.54)} className="absolute left-[81.6px] top-[602.9px] h-px w-[907.2px] bg-line" />
      <motion.div
        {...rise(0.58, 4)}
        className="absolute left-[81.6px] top-[616.3px] w-[907.2px] font-mono text-[11.3px] text-faint"
      >
        C039&nbsp; degree, connectivity&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; C043&nbsp; path, cycle
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; C044&nbsp; Eulerian, Hamiltonian &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        C046&nbsp; planar, colouring
      </motion.div>
    </Frame>
  );
}

/* -------------------------------------------------------------- the deck */

const SLIDES: ((p: SlideProps) => ReactElement)[] = [
  TitleSlide,
  GraphSlide,
  DegreeSlide,
  ConnectivitySlide,
  PathSlide,
  CycleSlide,
  ScoreSlide,
  EulerSlide,
  EulerPairSlide,
  HamiltonianSlide,
  PlanarSlide,
  TutteSlide,
  ColourSlide,
  ConclusionSlide,
];

const LABELS = [
  'Title',
  'Graph construction',
  'Degree',
  'Connectivity',
  'Path',
  'Cycle',
  'The score',
  'Eulerian',
  'Eulerisation',
  'Hamiltonian',
  'Planarity',
  'Tutte drawing',
  'Colouring the list',
  'Conclusion',
];

export default function DeckView({
  data,
  active = true,
  onStart,
}: {
  data: Bundle;
  active?: boolean;
  /** leave the deck for the onboarding, before a taste is chosen */
  onStart?: () => void;
}) {
  const [i, setI] = useState(0);
  const [stage, size] = useSize<HTMLDivElement>();
  const n = SLIDES.length;

  // A tab click leaves focus on the tab strip, where the arrows belong to the
  // tabs; the slide stage takes it back so ← and → drive the deck.
  useEffect(() => {
    if (!active) return;
    // Coming in from the tab strip leaves focus on the tab, where ← and →
    // switch views; move it to the stage so the deck owns the arrows. A direct
    // load keeps whatever focus the page started with.
    if (!document.activeElement?.closest('[role="tablist"]')) return;
    // after the click has settled, so the strip's own arrow handling has run
    const id = setTimeout(() => stage.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(id);
  }, [active]);

  const step = (f: (v: number) => number) =>
    setI((v) => Math.max(0, Math.min(n - 1, f(v))));

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, [contenteditable="true"], [role="tablist"]'))) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        step((v) => v + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step((v) => v - 1);
      } else if (e.code === 'Space') {
        e.preventDefault();
        step((v) => (e.shiftKey ? v - 1 : v + 1));
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [n, active]);

  const Slide = SLIDES[i];
  const scale = size.w > 0 ? size.w / BASE_W : 1;

  return (
    <div className="pt-5">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line-soft pb-2.5">
        <div className="eyebrow">Presentation · C039 – C046</div>
        <div className="flex items-center gap-4 font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
          <span className="hidden sm:inline">← → to move · space to advance</span>
          {onStart && (
            <button
              onClick={onStart}
              className="uppercase tracking-[0.08em] text-faint transition-colors hover:text-signal"
            >
              Pick a taste instead
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <div
          ref={stage}
          tabIndex={-1}
          className="relative w-full overflow-hidden border border-line bg-canvas outline-none"
          style={{
            width: 'min(100%, calc((100dvh - 210px) * 16 / 9))',
            aspectRatio: '16 / 9',
          }}
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${n}: ${LABELS[i]}`}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})` }}
          >
            <div key={i}>
              <Slide data={data} page={i + 1} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-3 flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft pt-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => step((v) => v - 1)}
            disabled={i === 0}
            aria-label="Previous slide"
          >
            <ArrowLeft size={12} weight="bold" />
          </Button>
          <span className="tnum min-w-[64px] text-center font-mono text-[10.5px] text-muted" aria-live="polite">
            {pad2(i + 1)} / {n}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => step((v) => v + 1)}
            disabled={i === n - 1}
            aria-label="Next slide"
          >
            <ArrowRight size={12} weight="bold" />
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-0.5">
          {SLIDES.map((_, d) => (
            <button
              key={d}
              onClick={() => setI(d)}
              aria-label={`Slide ${d + 1}: ${LABELS[d]}`}
              aria-current={d === i ? 'step' : undefined}
              className="group flex h-4 w-4 items-center justify-center"
            >
              <span
                className={cn(
                  'block h-2 w-2 transition-colors',
                  d === i ? 'bg-signal' : 'bg-line group-hover:bg-muted',
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
