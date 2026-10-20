import { useEffect, useRef } from 'react';
import HL from '@/lib/hairline';

const {
  Cam,
  clamp,
  facing,
  fit,
  lerp,
  mk,
  open,
  pointer,
  prism,
  proj,
  register,
  rings,
  solid,
  put,
  tween,
  tset,
  tval,
  tdone,
  disposer,
} = HL as any;

const N = 4,
  SPAN = 30,
  PR = 4.6,
  PH = 16,
  CR = 5.8,
  CH = 2.2;
const BK = 17,
  BH = 6.4,
  SAG = [2.2, 3.2, 2.6],
  LIFT = 3.4,
  STEP = 45;
const YS = [3, 0, 3, 0],
  BX0 = -9,
  BX1 = (N - 1) * SPAN + 9,
  BY0 = -11,
  BY1 = 12;
const ARCH = 7;

const isPost = (i: number) => i % 2 === 0;
const top = (i: number) => (isPost(i) ? PH : BH);
const edge = (i: number) => (isPost(i) ? PR + 1.2 : BK / 2 + 1.2);

type Tess = { u: number; v: number; nu: number; nv: number }[];

/**
 * Four stops on a board, every other one a tall post (a viewer) and the rest a
 * low block (a title), strung by three wires — the hops of an alternating
 * walk. The middle post carries the bright cap at rest: the co-liker is the
 * part that turns a pair into a path. Hover a wire and it arches into the
 * bright while the cap gives it up and the two stops it joins rise.
 */
export function PathFigure({ onHop }: { onHop?: (hop: number) => void }) {
  const stage = useRef<HTMLDivElement | null>(null);
  // kept in a ref so a new callback from the parent does not rebuild the scene
  const cb = useRef(onHop);
  cb.current = onHop;
  const hop = useRef(-1);

  useEffect(() => {
    const host = stage.current;
    if (!host) return;
    HL.inject(document);

    const svg = mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, host);
    const live = mk('div', { 'data-hairline-live': '' }, host);
    const read = { textContent: 'rest' };
    const bag = disposer();
    const arch = ARCH;
    let act = -1;

    const C = Cam(45, 0.5, 2.9);
    fit(
      C,
      [
        [BX0, BY0, -6],
        [BX1, BY1, -6],
        [BX1, BY0, -6],
        [BX0, BY1, -6],
        [0, 3, PH + CH + LIFT],
        [(N - 1) * SPAN, 0, BH],
      ],
      200,
      166,
    );
    const P = proj(C),
      front = facing(C);

    const g = mk('g', {}, svg);
    const [pr, pi] = rings(BX0, BY0, BX1, BY1, 8, 1.7);
    put(solid(g), prism(P, front, pr, pi, -6, 0));

    // wires first: each stop's body then covers its own wire end
    const wires = SAG.map((s: number, j: number) => ({
      j,
      el: mk('path', { class: 'nf' }, g),
      b: tween(0),
    }));

    const stops = YS.map((cy: number, i: number) => {
      const cx = i * SPAN;
      const gear = isPost(i)
        ? [
            { ring: rings(cx - PR, cy - PR, cx + PR, cy + PR, PR, 0.9), z0: 0, z1: PH },
            { ring: rings(cx - CR, cy - CR, cx + CR, cy + CR, CR, 0.9), z0: PH, z1: PH + CH },
          ]
        : [
            {
              ring: rings(cx - BK / 2, cy - BK / 2, cx + BK / 2, cy + BK / 2, 3, 1.2),
              z0: 0,
              z1: BH,
            },
          ];
      const els = gear.map(() => solid(g));
      return {
        i,
        cx,
        cy,
        z: tween(0),
        parts: gear.map((q: any, k: number) => ({
          ring: q.ring[0] as Tess,
          inner: q.ring[1] as Tess,
          z0: q.z0,
          z1: q.z1,
          el: els[k],
        })),
      };
    });

    const pin = (i: number, dir: number, now: number) => [
      stops[i].cx + dir * edge(i),
      stops[i].cy,
      top(i) + tval(stops[i].z, now),
    ];

    function curve(a: number[], b: number[], bow: number) {
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const s = k / 16,
          q = 4 * s * (1 - s) * bow;
        pts.push(P(lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s) + q));
      }
      return open(pts);
    }

    function draw(now: number) {
      for (const s of stops) {
        const z = tval(s.z, now);
        for (const p of s.parts) put(p.el, prism(P, front, p.ring, p.inner, p.z0 + z, p.z1 + z));
      }
      for (const w of wires) {
        const bow = lerp(-SAG[w.j], arch, tval(w.b, now));
        w.el.setAttribute('d', curve(pin(w.j, 1, now), pin(w.j + 1, -1, now), bow));
      }
    }

    // hit test against the wires' resting screen curves: static, so the choice
    // never moves out from under the pointer
    const rest = wires.map((w: any) => {
      const a = pin(w.j, 1, 0),
        b = pin(w.j + 1, -1, 0),
        pts = [];
      for (let k = 0; k <= 16; k++) {
        const s = k / 16;
        pts.push(
          P(
            lerp(a[0], b[0], s),
            lerp(a[1], b[1], s),
            lerp(a[2], b[2], s) - SAG[w.j] * 4 * s * (1 - s),
          ),
        );
      }
      return pts;
    });

    function near(p: number[], pts: number[][]) {
      let best = Infinity;
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, ay] = pts[k],
          [bx, by] = pts[k + 1];
        const dx = bx - ax,
          dy = by - ay;
        const t = clamp(((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        best = Math.min(best, Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy));
      }
      return best;
    }

    function hit(p: number[]) {
      let j = -1,
        d = 22;
      rest.forEach((pts: number[][], k: number) => {
        const q = near(p, pts);
        if (q < d) {
          d = q;
          j = k;
        }
      });
      return j;
    }

    const B = register(stage.current, (_dt: number, now: number) => {
      let moving = false;
      for (const s of stops) if (!tdone(s.z, now)) moving = true;
      for (const w of wires) if (!tdone(w.b, now)) moving = true;
      if (moving) draw(now);
      return moving;
    });
    bag.add(B.unregister);

    const cap = stops[2].parts[1].el.sil;
    const say = (t: string) => {
      read.textContent = t;
      live.textContent = t;
    };

    function setActive(j: number) {
      if (j === act) return;
      act = j;
      const now = performance.now(),
        from = j < 0 ? act : j;
      stops.forEach((s: any, i: number) => {
        const end = j >= 0 && (i === j || i === j + 1);
        tset(s.z, end ? LIFT : 0, now, Math.abs(i - from) * STEP);
      });
      wires.forEach((w: any, k: number) => {
        tset(w.b, j === k ? 1 : 0, now, Math.abs(k - from) * STEP);
        w.el.classList.toggle('hi', j === k);
      });
      cap.classList.toggle('hi', j < 0);
      say(j < 0 ? 'rest' : `hop ${j + 1}`);
      B.wake();
    }

    draw(0);
    cap.classList.add('hi');
    say('rest');

    bag.add(
      pointer(stage.current, {
        move: (p: number[]) => {
          const j = hit(p);
          setActive(j);
          if (j !== hop.current) {
            hop.current = j;
            cb.current?.(j);
          }
        },
        leave: () => {
          setActive(-1);
          if (hop.current !== -1) {
            hop.current = -1;
            cb.current?.(-1);
          }
        },
      }),
    );
    // React runs this effect twice in development: leave nothing behind, or an
    // empty svg sits over the live one
    bag.add(() => {
      svg.remove();
      live.remove();
    });

    return () => bag.dispose();
  }, []);

  return (
    <div
      ref={stage}
      data-hairline="catena"
      data-hairline-theme="dark"
      className="mx-auto max-w-[440px]"
    />
  );
}
