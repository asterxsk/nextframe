import { useEffect, useRef } from 'react';
import type { Bundle } from '@/lib/data';

type Props = {
  bundle: Bundle;
  colourMode: 'genre' | 'degree' | 'component';
  blend: number; // 0 similarity layout -> 1 genre grid
  edgeCut: number; // 0..1 minimum jaccard
  minDegree: number;
  genreFilter: number; // -1 = all
  highlight: { likes: Set<number>; hop2: Set<number>; hop3: Set<number> } | null;
  selected: number;
  onSelect: (i: number) => void;
  onHover: (i: number, ev: { x: number; y: number } | null) => void;
  onCounts: (visibleV: number, visibleE: number) => void;
  viewRef: React.MutableRefObject<{ x: number; y: number; k: number } | null>;
  registerFit: (fn: () => void) => void;
};

const SURFACE = '#00040a';

export function ForceCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<any>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  /* ------------------------------------------------------------- setup */
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const b = props.bundle;

    const st: any = {
      w: 1,
      h: 1,
      dpr: 1,
      ctx: null as CanvasRenderingContext2D | null,
      view: { x: 0, y: 0, k: 1 },
      fit: { x: 0, y: 0, k: 1 },
      blend: 0,
      blendFrom: 0,
      blendTo: 0,
      blendT0: 0,
      blendRaf: 0,
      hover: -1,
      selected: -1,
      dragging: false,
      moved: false,
      lx: 0,
      ly: 0,
      raf: 0,
      dirty: true,
      visible: new Uint8Array(b.movies.length).fill(1),
      visEdges: [] as number[],
      grid: null as Map<string, { x: number; y: number; i: number }[]> | null,
    };
    stateRef.current = st;
    st.ctx = canvas.getContext('2d');
    props.viewRef.current = st.view;

    const normalise = () => {
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (let i = 0; i < b.movies.length; i++) {
        const l = b.layout[i];
        for (const [x, y] of [
          [l[0], l[1]],
          [l[2], l[3]],
        ] as const) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      st.bounds = { x0, x1, y0, y1 };
    };
    normalise();

    const pos = (i: number) => {
      const l = b.layout[i];
      const t = st.blend;
      return [l[0] + (l[2] - l[0]) * t, l[1] + (l[3] - l[1]) * t];
    };
    st.pos = pos;

    const fit = () => {
      // bounds follow the current blend so Fit never frames empty space
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (let i = 0; i < b.movies.length; i++) {
        const [x, y] = pos(i);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const pad = 40;
      // a hidden view mounts at 0x0; without the floor the fit scale goes
      // negative and ctx.arc throws on a negative radius
      const k = Math.max(
        0.2,
        Math.min((st.w - pad * 2) / (x1 - x0 || 1), (st.h - pad * 2) / (y1 - y0 || 1)),
      );
      st.fit = {
        k,
        x: pad + (st.w - pad * 2 - (x1 - x0) * k) / 2 - x0 * k,
        y: pad + (st.h - pad * 2 - (y1 - y0) * k) / 2 - y0 * k,
      };
    };
    st.fitFn = fit;
    st.cell = 12 / Math.max(1, st.fit.k);
    st.resetView = () => {
      st.view = { ...st.fit };
      props.viewRef.current = st.view;
      st.dirty = true;
      draw();
    };
    props.registerFit(st.resetView);

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      st.dpr = Math.min(devicePixelRatio || 1, 2);
      st.w = Math.max(1, Math.round(r.width));
      st.h = Math.max(1, Math.round(r.height));
      canvas.width = st.w * st.dpr;
      canvas.height = st.h * st.dpr;
      canvas.style.width = `${st.w}px`;
      canvas.style.height = `${st.h}px`;
      st.ctx!.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      fit();
      st.cell = 12 / Math.max(1, st.fit.k);
      st.view = { ...st.fit };
      props.viewRef.current = st.view;
      st.grid = null;
      draw();
    };
    st.resize = resize;
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    /* --------------------------------------------------------- filters */
    st.applyFilters = () => {
      const p = propsRef.current;
      const need = p.minDegree;
      const gf = p.genreFilter;
      let count = 0;
      for (let i = 0; i < b.movies.length; i++) {
        const m = b.movies[i];
        const v = m.gd >= need && (gf < 0 || m.g.includes(gf)) ? 1 : 0;
        st.visible[i] = v;
        count += v;
      }
      const vis: number[] = [];
      for (let e = 0; e < b.edges.length; e++) {
        const [a, c, w] = b.edges[e];
        if (w >= p.edgeCut && st.visible[a] && st.visible[c]) vis.push(e);
      }
      st.visEdges = vis;
      st.grid = null;
      fit();
      st.cell = 12 / Math.max(1, st.fit.k);
      st.view = { ...st.fit };
      props.viewRef.current = st.view;
      draw();
      p.onCounts(count, vis.length);
    };
    st.applyFilters();

    /* ------------------------------------------------------------ draw */
    function draw() {
      const p = propsRef.current;
      const { ctx, w, h } = st;
      if (!ctx) return;
      ctx.save();
      ctx.fillStyle = SURFACE;
      ctx.fillRect(0, 0, w, h);
      ctx.translate(st.view.x, st.view.y);
      ctx.scale(st.view.k, st.view.k);
      const k = st.view.k;
      const hl = p.highlight;

      // edges in three alpha/weight buckets
      if (hl) {
        ctx.strokeStyle = 'rgba(96,108,122,0.09)';
        ctx.lineWidth = 0.5 / k;
        ctx.beginPath();
        for (const e of st.visEdges) {
          const [a, c] = b.edges[e];
          const pa = pos(a),
            pc = pos(c);
          ctx.moveTo(pa[0], pa[1]);
          ctx.lineTo(pc[0], pc[1]);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(77,146,255,0.55)';
        ctx.lineWidth = 1.1 / k;
        ctx.beginPath();
        for (const e of st.visEdges) {
          const [a, c] = b.edges[e];
          const touches =
            (hl.likes.has(a) && (hl.likes.has(c) || hl.hop2.has(c))) ||
            (hl.likes.has(c) && (hl.likes.has(a) || hl.hop2.has(a)));
          if (!touches) continue;
          const pa = pos(a),
            pc = pos(c);
          ctx.moveTo(pa[0], pa[1]);
          ctx.lineTo(pc[0], pc[1]);
        }
        ctx.stroke();
      } else {
        const buckets: [number, number, number][] = [
          [0.05, 0, 0.14],
          [0.075, 0.14, 0.27],
          [0.12, 0.27, 1.01],
        ];
        for (const [alpha, lo, hi] of buckets) {
          ctx.strokeStyle = `rgba(126,142,162,${alpha})`;
          ctx.lineWidth = (lo > 0.2 ? 0.75 : 0.5) / k;
          ctx.beginPath();
          for (const e of st.visEdges) {
            const [a, c, ww] = b.edges[e];
            if (ww < lo || ww >= hi) continue;
            const pa = pos(a),
              pc = pos(c);
            ctx.moveTo(pa[0], pa[1]);
            ctx.lineTo(pc[0], pc[1]);
          }
          ctx.stroke();
        }
      }

      // vertices, batched by exact fill
      const maxD = b.meta.maxDegree;
      const minD = b.meta.minDegree ?? 0;
      // degree spans a narrow range (8-36), so a ratio against the max keeps
      // every vertex in the top half of the ramp; normalise across the range
      const degT = (d: number) =>
        Math.log1p(Math.max(0, d - minD)) / Math.log1p(Math.max(1, maxD - minD));
      const groups = new Map<string, { r: number[]; xs: number[] }>();
      const push = (key: string, x: number, y: number, r: number) => {
        let g = groups.get(key);
        if (!g) groups.set(key, (g = { r: [], xs: [] }));
        g.r.push(r);
        g.xs.push(x, y);
      };

      for (let i = 0; i < b.movies.length; i++) {
        if (!st.visible[i]) continue;
        const m = b.movies[i];
        // radius is chosen in screen pixels and converted into layout units by
        // the view scale, so a vertex stays the same size when the graph zooms
        let r = (0.85 + 2.15 * degT(m.gd)) / k;
        let col = '#4d92ff';
        let alpha = 1;
        if (p.colourMode === 'genre') col = b.palette[m.g[0] % b.palette.length];
        else if (p.colourMode === 'degree') {
          const t = degT(m.gd);
          // sequential blue ramp, dark to bright, so the tail of hub vertices reads
          col = `rgb(${Math.round(30 + t * 132)},${Math.round(66 + t * 137)},${Math.round(112 + t * 131)})`;
        } else col = b.palette[m.c % b.palette.length];

        if (hl) {
          if (hl.likes.has(i)) {
            col = '#4d92ff';
            r *= 1.45;
          } else if (hl.hop2.has(i)) {
            col = '#2a6ab0';
            r *= 1.15;
          } else if (hl.hop3.has(i)) {
            col = '#1b3a5c';
          } else alpha = 0.14;
        }
        if (i === p.selected) {
          col = '#f2f5f8';
          r *= 1.7;
          alpha = 1;
        } else if (i === st.hover) {
          r *= 1.5;
          alpha = 1;
        }
        const pt = pos(i);
        push(alpha < 1 ? `${col}|${alpha}` : col, pt[0], pt[1], r);
      }

      for (const [key, g] of groups) {
        const [col, al] = key.split('|');
        ctx.globalAlpha = al ? Number(al) : 1;
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let n = 0; n < g.xs.length; n += 2) {
          ctx.moveTo(g.xs[n] + g.r[n / 2], g.xs[n + 1]);
          ctx.arc(g.xs[n], g.xs[n + 1], g.r[n / 2], 0, 6.28318);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (p.selected >= 0 && st.visible[p.selected]) {
        const pt = pos(p.selected);
        ctx.strokeStyle = '#8ec5ff';
        ctx.lineWidth = 1.5 / k;
        ctx.beginPath();
        const rr = 0.85 + 2.15 * degT(b.movies[p.selected].gd);
        ctx.arc(pt[0], pt[1], (rr * 1.7 + 3) / k, 0, 6.28318);
        ctx.stroke();
      }
      ctx.restore();
    }
    st.draw = draw;

    /* -------------------------------------------------------- picking */
    const pick = (mx: number, my: number) => {
      if (!st.grid) {
        const g = new Map<string, { x: number; y: number; i: number }[]>();
        for (let i = 0; i < b.movies.length; i++) {
          if (!st.visible[i]) continue;
          const [x, y] = pos(i);
          const key = `${Math.floor(x / st.cell)},${Math.floor(y / st.cell)}`;
          let arr = g.get(key);
          if (!arr) g.set(key, (arr = []));
          arr.push({ x, y, i });
        }
        st.grid = g;
      }
      const lx = (mx - st.view.x) / st.view.k;
      const ly = (my - st.view.y) / st.view.k;
      const rad = 9 / st.view.k;
      const cx = Math.floor(lx / st.cell),
        cy = Math.floor(ly / st.cell);
      let best = -1,
        bd = rad * rad;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const arr = st.grid.get(`${gx},${gy}`);
          if (!arr) continue;
          for (const it of arr) {
            const d = (it.x - lx) ** 2 + (it.y - ly) ** 2;
            if (d <= bd) {
              bd = d;
              best = it.i;
            }
          }
        }
      }
      return best;
    };

    /* --------------------------------------------------------- events */
    const onDown = (e: PointerEvent) => {
      st.dragging = true;
      st.moved = false;
      st.lx = e.clientX;
      st.ly = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (st.dragging) {
        const dx = e.clientX - st.lx,
          dy = e.clientY - st.ly;
        if (Math.abs(dx) + Math.abs(dy) > 2) st.moved = true;
        st.view.x += dx;
        st.view.y += dy;
        st.lx = e.clientX;
        st.ly = e.clientY;
        draw();
        return;
      }
      const hit = pick(e.clientX - r.left, e.clientY - r.top);
      if (hit !== st.hover) {
        st.hover = hit;
        canvas.style.cursor = hit >= 0 ? 'pointer' : 'grab';
        draw();
      }
      propsRef.current.onHover(hit, hit >= 0 ? { x: e.clientX, y: e.clientY } : null);
    };
    const onUp = () => {
      st.dragging = false;
      canvas.style.cursor = 'grab';
    };
    const onClick = (e: MouseEvent) => {
      if (st.moved) return;
      const r = canvas.getBoundingClientRect();
      const hit = pick(e.clientX - r.left, e.clientY - r.top);
      if (hit >= 0) propsRef.current.onSelect(hit);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left,
        my = e.clientY - r.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const k = Math.min(st.fit.k * 14, Math.max(st.fit.k * 0.7, st.view.k * factor));
      const s = k / st.view.k;
      st.view.x = mx - (mx - st.view.x) * s;
      st.view.y = my - (my - st.view.y) * s;
      st.view.k = k;
      draw();
    };
    const onLeave = () => {
      st.hover = -1;
      draw();
      propsRef.current.onHover(-1, null);
    };

    const onZoomEvent = (e: Event) => {
      const f = (e as CustomEvent<number>).detail;
      if (typeof f === 'number') st.zoomBy(f);
    };
    document.addEventListener('graph-zoom', onZoomEvent);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    st.setBlend = (target: number) => {
      cancelAnimationFrame(st.blendRaf);
      st.blendFrom = st.blend;
      st.blendTo = target;
      st.blendT0 = performance.now();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        st.blend = target;
        st.grid = null;
        draw();
        return;
      }
      const tick = (now: number) => {
        const t = Math.min(1, (now - st.blendT0) / 650);
        const e = t * t * (3 - 2 * t);
        st.blend = st.blendFrom + (st.blendTo - st.blendFrom) * e;
        st.grid = null;
        draw();
        if (t < 1) st.blendRaf = requestAnimationFrame(tick);
      };
      st.blendRaf = requestAnimationFrame(tick);
    };
    st.zoomBy = (f: number) => {
      const mx = st.w / 2,
        my = st.h / 2;
      const k = Math.min(st.fit.k * 14, Math.max(st.fit.k * 0.7, st.view.k * f));
      const s = k / st.view.k;
      st.view.x = mx - (mx - st.view.x) * s;
      st.view.y = my - (my - st.view.y) * s;
      st.view.k = k;
      draw();
    };

    draw();

    return () => {
      cancelAnimationFrame(st.blendRaf);
      ro.disconnect();
      document.removeEventListener('graph-zoom', onZoomEvent);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('wheel', onWheel);
      // free the backing store so repeated mounts do not leak
      canvas.width = 0;
      canvas.height = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.bundle]);

  /* ------------------------------------------------- react to prop changes */
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    st.selected = props.selected;
    st.grid = null;
    st.draw?.();
  }, [props.selected, props.highlight]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    st.applyFilters?.();
  }, [props.edgeCut, props.minDegree, props.genreFilter]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    st.setBlend?.(props.blend);
  }, [props.blend]);

  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    st.draw?.();
  }, [props.colourMode]);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-grab touch-none"
        aria-label="Similarity graph of the film catalogue"
      />
    </div>
  );
}
