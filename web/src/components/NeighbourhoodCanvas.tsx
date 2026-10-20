import { useEffect, useMemo, useRef } from 'react';
import type { Bundle } from '@/lib/data';

type Props = {
  bundle: Bundle;
  uid: number;
  selectedMovie: number | null;
  onPickRank: (rank: number) => void;
  onHover: (movieId: number | null, ev: { x: number; y: number } | null) => void;
};

/**
 * The viewer's neighbourhood: their liked titles, the recommended candidates,
 * and the similarity edges inside that induced subgraph. Laid out once per
 * viewer with a bounded force relaxation, then drawn statically.
 */
export function NeighbourhoodCanvas({ bundle, uid, selectedMovie, onPickRank, onHover }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<any>(null);

  const model = useMemo(() => {
    const loc = bundle.local[String(uid)];
    const recs = bundle.recs[String(uid)] ?? [];
    if (!loc || !loc.nodes.length) return null;
    const candRank = new Map(recs.map((r, i) => [r.m, i]));
    const byId = new Map(bundle.movies.map((m) => [m.id, m]));
    const n = loc.nodes.length;
    const owned = loc.nodes.filter((x) => x.own).length;

    const nodes = loc.nodes.map((x, i) => {
      const rank = candRank.get(x.m);
      const isCand = rank !== undefined;
      const ang = isCand
        ? (rank! / Math.max(1, recs.length)) * Math.PI * 2
        : (i / Math.max(1, owned)) * Math.PI * 2 + 0.6;
      const rad = isCand ? 1.0 : 0.5;
      const mv = byId.get(x.m);
      return {
        i,
        m: x.m,
        own: x.own,
        cand: isCand,
        rank: rank ?? -1,
        title: mv?.t ?? `#${x.m}`,
        genres: mv?.gn ?? [],
        deg: mv?.gd ?? 0,
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad,
        vx: 0,
        vy: 0,
        r: isCand ? 4.6 : 2.0 + Math.min(2.0, Math.log1p(mv?.gd ?? 1) * 0.26),
      };
    });

    // deterministic relaxation: repulsion + springs + ring pull
    const links = loc.edges.map(([a, c, w]) => ({ a, b: c, w }));
    for (let it = 0; it < 340; it++) {
      const cool = 1 - it / 340;
      for (let i = 0; i < n; i++) {
        const A = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const B = nodes[j];
          let dx = A.x - B.x;
          let dy = A.y - B.y;
          let d2 = dx * dx + dy * dy || 1e-4;
          if (d2 > 0.14) continue;
          const f = 0.0014 / d2;
          const d = Math.sqrt(d2);
          dx /= d;
          dy /= d;
          A.vx += dx * f;
          A.vy += dy * f;
          B.vx -= dx * f;
          B.vy -= dy * f;
        }
      }
      for (const l of links) {
        const A = nodes[l.a],
          B = nodes[l.b];
        const dx = B.x - A.x,
          dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 1e-3;
        const target = 0.27 - l.w * 0.11;
        const f = (d - target) * (0.085 + l.w * 0.1);
        A.vx += (dx / d) * f;
        A.vy += (dy / d) * f;
        B.vx -= (dx / d) * f;
        B.vy -= (dy / d) * f;
      }
      for (const P of nodes) {
        const len = Math.hypot(P.x, P.y) || 1e-3;
        const want = P.cand ? 0.95 : 0.5;
        P.vx += (P.x / len) * (want - len) * 0.045;
        P.vy += (P.y / len) * (want - len) * 0.045;
        P.x += P.vx * 0.42;
        P.y += P.vy * 0.42;
        P.vx *= 0.4;
        P.vy *= 0.4;
        // keep the ring honest at the end of the run
        if (it === 339) {
          P.x = (P.x / len) * want;
          P.y = (P.y / len) * want;
        }
      }
      void cool;
    }
    return { nodes, links };
  }, [bundle, uid]);

  /* ----------------------------------------------------------- draw */
  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#090b0e';
      ctx.fillRect(0, 0, w, h);

      if (!model) {
        ctx.fillStyle = '#5a6472';
        ctx.font = "12px 'Geist', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('No neighbourhood for this viewer.', w / 2, h / 2);
        stateRef.current = null;
        return;
      }

      const pad = 38;
      // hidden views mount at 0x0; keep the scale positive
      const k = Math.max(1, Math.min((w - pad * 2) / 2.12, (h - pad * 2) / 2.12));
      const cx = w / 2,
        cy = h / 2;
      const sx = (x: number) => cx + x * k;
      const sy = (y: number) => cy + y * k;
      stateRef.current = { model, k, cx, cy, w, h };

      const sel = model.nodes.find((n) => n.m === selectedMovie);

      // links
      ctx.lineCap = 'round';
      for (const l of model.links) {
        const A = model.nodes[l.a],
          B = model.nodes[l.b];
        const hot = sel && (A === sel || B === sel);
        ctx.strokeStyle = hot ? 'rgba(77,146,255,0.85)' : `rgba(126,142,162,${0.07 + l.w * 0.45})`;
        ctx.lineWidth = hot ? 1.5 : 0.5 + l.w * 1.1;
        ctx.beginPath();
        ctx.moveTo(sx(A.x), sy(A.y));
        ctx.lineTo(sx(B.x), sy(B.y));
        ctx.stroke();
      }

      // outer ring guide, a real structural hint: candidates sit on it
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(77,146,255,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.95 * k, 0, 6.28318);
      ctx.stroke();
      ctx.setLineDash([]);

      // nodes
      for (const P of model.nodes) {
        const isSel = sel === P;
        const x = sx(P.x),
          y = sy(P.y);
        const rad = P.r * (isSel ? 1.3 : 1);

        if (P.cand) {
          ctx.fillStyle = '#17110a';
          ctx.beginPath();
          ctx.arc(x, y, rad + 2.2, 0, 6.28318);
          ctx.fill();
          ctx.strokeStyle = isSel ? '#cfe4ff' : 'rgba(77,146,255,0.75)';
          ctx.lineWidth = isSel ? 1.8 : 1.1;
          ctx.stroke();
        }
        ctx.fillStyle = P.cand ? '#4d92ff' : '#8b94a3';
        ctx.globalAlpha = P.cand ? 1 : 0.85;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, 6.28318);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (isSel && !P.cand) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(x, y, rad + 3.6, 0, 6.28318);
          ctx.stroke();
        }
      }

      // rank numerals inside candidates
      ctx.font = "600 8.5px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#17110a';
      for (const P of model.nodes) {
        if (!P.cand) continue;
        ctx.fillText(String(P.rank + 1), sx(P.x), sy(P.y) + 0.3);
      }

      // direct labels for the owned ring, only where they fit
      if (k > 120) {
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillStyle = '#7b8796';
        ctx.textBaseline = 'top';
        for (const P of model.nodes) {
          if (P.cand) continue;
          const x = sx(P.x),
            y = sy(P.y);
          const label = P.title.length > 18 ? `${P.title.slice(0, 17)}…` : P.title;
          const tw = ctx.measureText(label).width;
          if (x + tw / 2 > w - 4 || x - tw / 2 < 4) continue;
          ctx.fillText(label, x, y + P.r + 3);
        }
      }
    };

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);

    const pick = (clientX: number, clientY: number) => {
      const s = stateRef.current;
      if (!s) return null;
      const r = canvas.getBoundingClientRect();
      const mx = clientX - r.left,
        my = clientY - r.top;
      let best: any = null;
      let bd = 15 * 15;
      for (const P of s.model.nodes) {
        const d = (s.cx + P.x * s.k - mx) ** 2 + (s.cy + P.y * s.k - my) ** 2;
        if (d < bd) {
          bd = d;
          best = P;
        }
      }
      return best;
    };

    const move = (e: PointerEvent) => {
      const hit = pick(e.clientX, e.clientY);
      canvas.style.cursor = hit ? 'pointer' : 'default';
      onHover(hit ? hit.m : null, hit ? { x: e.clientX, y: e.clientY } : null);
    };
    const click = (e: MouseEvent) => {
      const hit = pick(e.clientX, e.clientY);
      if (!hit) return;
      if (hit.cand) onPickRank(hit.rank);
    };
    const leave = () => onHover(null, null);

    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('click', click);
    canvas.addEventListener('pointerleave', leave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('click', click);
      canvas.removeEventListener('pointerleave', leave);
    };
  }, [model, selectedMovie, onHover, onPickRank]);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        aria-label="Viewer neighbourhood graph"
      />
    </div>
  );
}
