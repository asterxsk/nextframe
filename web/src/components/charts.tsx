import { useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Small chart primitives. All of them are SVG, all of them expose a hover
 * layer, and none of them draw a filled track behind a bar.
 */

type Rect = { x: number; y: number; w: number; h: number };

const PAD = { l: 34, r: 8, t: 10, b: 22 };

export function useHover<T>() {
  const [hover, setHover] = useState<T | null>(null);
  return [hover, setHover] as const;
}

/* ------------------------------------------------------------------ bars */

export function BarChart({
  data,
  height = 170,
  colour,
  log = false,
  xLabel,
  yUnit,
  formatX = (v: number) => String(v),
  formatTip,
  ariaLabel,
}: {
  data: [number, number][];
  height?: number;
  colour: string;
  log?: boolean;
  xLabel?: string;
  yUnit?: string;
  formatX?: (v: number) => string;
  formatTip?: (x: number, y: number) => React.ReactNode;
  ariaLabel: string;
}) {
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(240, w);
  const H = height;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const maxY = Math.max(1, ...data.map((d) => d[1]));
  const yOf = (v: number) => PAD.t + ih - (log ? Math.log1p(v) / Math.log1p(maxY) : v / maxY) * ih;
  const step = iw / Math.max(1, data.length);
  const bw = Math.max(1, step - Math.max(1, step * 0.18));

  useMemo(() => {
    if (!wrap) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [wrap]);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = log ? Math.round(Math.expm1(f * Math.log1p(maxY))) : Math.round(f * maxY);
    return { f, v, y: PAD.t + ih - f * ih };
  });

  return (
    <div ref={setWrap} className="relative w-full" onPointerLeave={() => setHover(null)}>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="block overflow-visible"
      >
        {ticks.map((t) => (
          <g key={t.f}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={t.y}
              y2={t.y}
              stroke="var(--color-line-soft)"
              strokeDasharray={t.f === 0 ? undefined : '2 3'}
            />
            <text
              x={PAD.l - 6}
              y={t.y + 3}
              textAnchor="end"
              fontSize={9}
              fontFamily="var(--font-mono)"
              fill="var(--color-faint)"
            >
              {t.v >= 1000 ? `${(t.v / 1000).toFixed(1)}k` : t.v}
            </text>
          </g>
        ))}

        {data.map(([x, v], i) => {
          const y = yOf(v);
          const bx = PAD.l + i * step + (step - bw) / 2;
          const on = hover === i;
          return (
            <g key={i}>
              <rect
                x={PAD.l + i * step}
                y={PAD.t}
                width={step}
                height={ih}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
              />
              <rect
                x={bx}
                y={y}
                width={bw}
                height={Math.max(0.6, PAD.t + ih - y)}
                rx={0}
                fill={colour}
                opacity={hover === null || on ? 1 : 0.42}
                style={{ transition: 'opacity 140ms' }}
              />
            </g>
          );
        })}

        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={PAD.t + ih}
          y2={PAD.t + ih}
          stroke="var(--color-line)"
        />

        {/* first, middle and last x labels only, so they never collide */}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i, k) => {
          const d = data[i];
          if (!d) return null;
          return (
            <text
              key={k}
              x={PAD.l + i * step + step / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize={9}
              fontFamily="var(--font-mono)"
              fill="var(--color-faint)"
            >
              {formatX(d[0])}
            </text>
          );
        })}
      </svg>

      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute z-20 rounded-none border border-line bg-canvas px-2 py-1 text-[11px] shadow-lg"
          style={{
            left: `${((PAD.l + hover * step + step / 2) / W) * 100}%`,
            top: 0,
            transform: 'translateX(-50%)',
          }}
        >
          {formatTip ? (
            formatTip(data[hover][0], data[hover][1])
          ) : (
            <span className="font-mono text-ink">
              {formatX(data[hover][0])}: {data[hover][1]}
              {yUnit ? ` ${yUnit}` : ''}
            </span>
          )}
        </div>
      )}
      {xLabel && (
        <div className="mt-1 font-mono text-[9.5px] tracking-wide text-faint">{xLabel}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ heatmap */

export function Heatmap({
  matrix,
  labels,
  colour,
  size = 300,
  title,
  valueLabel = 'similarity',
}: {
  matrix: number[][];
  labels: string[];
  colour: string;
  size?: number;
  title?: string;
  valueLabel?: string;
}) {
  const n = matrix.length;
  const pad = labels.length ? 46 : 4;
  const cell = (size - pad) / Math.max(1, n);
  const max = Math.max(0.0001, ...matrix.flat());
  const [hover, setHover] = useState<[number, number] | null>(null);

  const hex = colour.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b2 = parseInt(hex.slice(4, 6), 16);

  return (
    <div className="relative">
      <svg width={size} height={size} role="img" aria-label={title ?? 'matrix'}>
        {labels.map((lab, i) => (
          <text
            key={`r${i}`}
            x={pad - 5}
            y={pad + i * cell + cell / 2 + 3}
            textAnchor="end"
            fontSize={9}
            fontFamily="var(--font-mono)"
            fill="var(--color-muted)"
          >
            {i + 1}
          </text>
        ))}
        {labels.map((lab, i) => (
          <text
            key={`c${i}`}
            x={pad + i * cell + cell / 2}
            y={pad - 5}
            textAnchor="middle"
            fontSize={9}
            fontFamily="var(--font-mono)"
            fill="var(--color-muted)"
          >
            {i + 1}
          </text>
        ))}
        {matrix.map((row, i) =>
          row.map((v, j) => {
            const t = Math.pow(v / max, 0.72);
            const on = hover && hover[0] === i && hover[1] === j;
            return (
              <rect
                key={`${i}-${j}`}
                x={pad + j * cell}
                y={pad + i * cell}
                width={cell - 1.5}
                height={cell - 1.5}
                rx={0}
                fill={i === j ? 'transparent' : `rgba(${r},${g},${b2},${0.06 + t * 0.9})`}
                stroke={on ? 'var(--color-ink)' : 'transparent'}
                strokeWidth={1}
                onPointerEnter={() => setHover([i, j])}
                onPointerLeave={() => setHover(null)}
              />
            );
          }),
        )}
      </svg>
      {hover && (
        <div className="absolute right-0 top-0 rounded-none border border-line bg-canvas px-2 py-1 font-mono text-[10.5px] text-ink-2">
          {hover[0] + 1}–{hover[1] + 1} · {matrix[hover[0]][hover[1]].toFixed(3)}
          <span className="text-faint"> {valueLabel}</span>
        </div>
      )}
    </div>
  );
}
