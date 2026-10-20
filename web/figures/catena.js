/**
 * Catena: a board with four stops strung by three wires. Every other stop is a
 * tall round post (a viewer), the rest a low square block (a title), so the
 * alternating walk reads from the shapes alone. At rest the middle post — the
 * co-liker, the one that turns a pair into a path — carries the bright cap.
 * The pointer picks a hop: its wire arches up and takes the bright, the cap
 * gives it up, and the two stops the hop joins rise a beat later, staggered
 * outward. The slider is the arch, in world units.
 *
 * The pattern: a strung row. The hit test reads the wires' resting screen
 * curves, which never move; the choice runs on the 700ms lift curve.
 */
const {
  Cam, clamp, facing, fit, lerp, mk, open, pointer, prism, proj, register,
  rings, solid, put, tween, tset, tval, tdone, disposer,
} = HL;

const N = 4, SPAN = 30, PR = 4.6, PH = 16, CR = 5.8, CH = 2.2;
const BK = 17, BH = 6.4, SAG = [2.2, 3.2, 2.6], LIFT = 3.4, STEP = 45;
const YS = [3, 0, 3, 0], BX0 = -9, BX1 = (N - 1) * SPAN + 9, BY0 = -11, BY1 = 12;

const isPost = (i) => i % 2 === 0;
const top = (i) => (isPost(i) ? PH : BH);
const edge = (i) => (isPost(i) ? PR + 1.2 : BK / 2 + 1.2);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let arch = value, act = -1;

  const C = Cam(45, 0.5, 2.9);
  fit(C, [
    [BX0, BY0, -6], [BX1, BY1, -6], [BX1, BY0, -6], [BX0, BY1, -6],
    [0, 3, PH + CH + LIFT], [(N - 1) * SPAN, 0, BH],
  ], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk('g', {}, svg);
  const [pr, pi] = rings(BX0, BY0, BX1, BY1, 8, 1.7);
  put(solid(g), prism(P, front, pr, pi, -6, 0));

  // Wires first: a stop's own body covers its wire end, which is how a strung
  // post really looks, and the row is flat so no wire crosses a near solid.
  const wires = SAG.map((s, j) => ({ j, el: mk('path', { class: 'nf' }, g), b: tween(0) }));

  const stops = YS.map((cy, i) => {
    const cx = i * SPAN;
    const gear = isPost(i)
      ? [
          { ring: rings(cx - PR, cy - PR, cx + PR, cy + PR, PR, 0.9), z0: 0, z1: PH },
          { ring: rings(cx - CR, cy - CR, cx + CR, cy + CR, CR, 0.9), z0: PH, z1: PH + CH },
        ]
      : [{ ring: rings(cx - BK / 2, cy - BK / 2, cx + BK / 2, cy + BK / 2, 3, 1.2), z0: 0, z1: BH }];
    const els = gear.map(() => solid(g));
    return {
      i, cx, cy, z: tween(0),
      parts: gear.map((q, k) => ({ ring: q.ring[0], inner: q.ring[1], z0: q.z0, z1: q.z1, el: els[k] })),
    };
  });

  const pin = (i, dir, now) => [stops[i].cx + dir * edge(i), stops[i].cy, top(i) + tval(stops[i].z, now)];

  /** A wire between two pins, its middle raised (or dropped) by `bow`, sampled through the camera. */
  function curve(a, b, bow) {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const s = k / 16, q = 4 * s * (1 - s) * bow;
      pts.push(P(lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s) + q));
    }
    return open(pts);
  }

  function draw(now) {
    for (const s of stops) {
      const z = tval(s.z, now);
      for (const p of s.parts) put(p.el, prism(P, front, p.ring, p.inner, p.z0 + z, p.z1 + z));
    }
    for (const w of wires) {
      const bow = lerp(-SAG[w.j], arch, tval(w.b, now));
      w.el.setAttribute('d', curve(pin(w.j, 1, now), pin(w.j + 1, -1, now), bow));
    }
  }

  // Hit test on the wires' resting screen curves: static, so nothing moves out from under the pointer.
  const rest = wires.map((w) => {
    const a = pin(w.j, 1, 0), b = pin(w.j + 1, -1, 0), pts = [];
    for (let k = 0; k <= 16; k++) {
      const s = k / 16;
      pts.push(P(lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s) - SAG[w.j] * 4 * s * (1 - s)));
    }
    return pts;
  });
  function near(p, pts) {
    let best = Infinity;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      const dx = bx - ax, dy = by - ay;
      const t = clamp(((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      best = Math.min(best, Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy));
    }
    return best;
  }
  function hit(p) {
    let j = -1, d = 22;
    rest.forEach((pts, k) => { const q = near(p, pts); if (q < d) { d = q; j = k; } });
    return j;
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const s of stops) if (!tdone(s.z, now)) moving = true;
    for (const w of wires) if (!tdone(w.b, now)) moving = true;
    if (moving) draw(now);
    return moving;
  });
  bag.add(B.unregister);

  const cap = stops[2].parts[1].el.sil;

  function setActive(j) {
    if (j === act) return;
    act = j;
    const now = performance.now(), from = j < 0 ? act : j;
    stops.forEach((s, i) => {
      const end = j >= 0 && (i === j || i === j + 1);
      tset(s.z, end ? LIFT : 0, now, Math.abs(i - from) * STEP);
    });
    wires.forEach((w, k) => {
      tset(w.b, j === k ? 1 : 0, now, Math.abs(k - from) * STEP);
      w.el.classList.toggle('hi', j === k);
    });
    cap.classList.toggle('hi', j < 0);
    read.textContent = j < 0 ? 'rest' : `hop ${j + 1}`;
    B.wake();
  }

  draw(0);
  cap.classList.add('hi');
  read.textContent = 'rest';

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { arch = v; if (act >= 0) { draw(performance.now()); B.wake(); } },
    destroy: bag.dispose,
  };
}

hairline({
  name: 'catena',
  means: 'Four stops strung by three wires: the hop under the pointer arches, and its ends rise after it.',
  rules: [1, 2, 4, 5],
  range: [3, 7, 12],
  tour: [[190, 200], [238, 150], [296, 200], null],
  mount,
});
