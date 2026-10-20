import { useCallback, useMemo, useState } from 'react';
import {
  ArrowClockwise,
  ArrowRight,
  ChartLine,
  GitBranch,
  Lightning,
  MagnifyingGlass,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import type { Bundle, Movie, Rec, User } from '@/lib/data';
import { colorAt, fmt2, fmt3, fmtInt } from '@/lib/data';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { NeighbourhoodCanvas } from '@/components/NeighbourhoodCanvas';
import { cn } from '@/lib/utils';

type Props = {
  data: Bundle;
  uid: number;
  setUid: (n: number) => void;
  sel: number;
  setSel: (n: number) => void;
  onRestart: () => void;
};

type Sort = 'score' | 'paths' | 'audience' | 'year';

/** The catalogue: a browsable list of every kept title, and the recommendation
 *  output for the viewer chosen on the way in. Sorting and filtering happen on
 *  the bundle the pipeline already scored, so nothing here invents a number. */
export default function CatalogView({ data, uid, setUid, sel, setSel, onRestart }: Props) {
  const [tab, setTab] = useState<'for-you' | 'browse'>('for-you');
  const [sort, setSort] = useState<Sort>('score');
  const [genre, setGenre] = useState(-1);
  const [q, setQ] = useState('');
  const [minYear, setMinYear] = useState(0);

  const byId = useMemo(() => new Map(data.movies.map((m) => [m.id, m])), [data.movies]);
  const user = data.users.find((u) => u.id === uid) ?? data.users[0];
  const recs = data.recs[String(user.id)] ?? [];
  const colours = data.listColour[String(user.id)]?.col ?? [];
  const current = recs[Math.min(sel, recs.length - 1)];

  const browse = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = data.movies.filter(
      (m) =>
        (genre < 0 || m.g.includes(genre)) &&
        (!minYear || (m.y ?? 0) >= minYear) &&
        (!s || m.t.toLowerCase().includes(s)),
    );
    const key: Record<Sort, (m: Movie) => number> = {
      score: (m) => m.gd,
      paths: (m) => m.gd,
      audience: (m) => m.d,
      year: (m) => m.y ?? 0,
    };
    const k = key[sort];
    return list.sort((a, b) => (sort === 'year' ? k(b) - k(a) : k(b) - k(a))).slice(0, 240);
  }, [data.movies, genre, minYear, q, sort]);

  // 2025–26 releases, outside the archive's rating window. Filtered the same
  // way, but every one of them shows "not in archive" where a score would go.
  const recent = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data.recent ?? []).filter(
      (m) =>
        (genre < 0 || m.g.includes(genre)) &&
        (!minYear || m.y >= minYear) &&
        (!s || m.t.toLowerCase().includes(s)),
    );
  }, [data.recent, genre, minYear, q]);

  return (
    <div className="pt-8">
      <header className="grid grid-cols-1 items-end gap-8 border-b border-line pb-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <div>
          <div className="flex items-center gap-3">
            <div className="eyebrow">Catalogue</div>
            <button
              onClick={onRestart}
              className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.07em] text-faint transition-colors hover:text-signal"
            >
              <ArrowClockwise size={10} weight="bold" />
              change taste
            </button>
          </div>
          <h1 className="mt-3 max-w-[21ch] text-[clamp(27px,3.1vw,42px)] font-normal leading-[1.08] tracking-[-0.02em]">
            {fmtInt(data.meta.movies)} titles, ranked for viewer{' '}
            <span className="text-[#8ec5ff]">{user.id}</span>.
          </h1>
        </div>
        <p className="max-w-[54ch] text-[13px] leading-relaxed text-ink-2">
          The list below is the scoring function's output over every candidate the graph can reach:
          paths first, then popularity damping and a novelty penalty. Browse switches to the whole
          kept catalogue, unfiltered by taste.
        </p>
      </header>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line-soft">
        <div className="flex items-center gap-0.5">
          {(
            [
              ['for-you', 'For you'],
              ['browse', 'Browse catalogue'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={cn(
                'px-3 py-2 text-[12.5px] transition-colors',
                tab === id
                  ? 'text-ink shadow-[inset_0_-1px_0_var(--color-signal)]'
                  : 'text-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[9.5px] text-faint sm:inline">
            {tab === 'for-you'
              ? `${recs.length} shown · ${fmtInt(recs[0]?.cand ?? 0)} candidates`
              : `${fmtInt(browse.length)} shown`}
          </span>
          <Select
            value={String(user.id)}
            onValueChange={(v) => {
              setUid(Number(v));
              setSel(0);
            }}
          >
            <SelectTrigger className="h-7 w-[168px] text-[11.5px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              {tiers(data.users).map((t) => (
                <SelectGroup key={t.label}>
                  <SelectLabel>{t.label}</SelectLabel>
                  {t.users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      Viewer {u.id}
                      <span className="ml-2 font-mono text-[10px] text-faint">{u.n}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5">
          {tab === 'for-you' ? (
            <section className="border border-line bg-surface">
              <ol className="p-2">
                {recs.map((r, i) => (
                  <RecRow
                    key={r.m}
                    rec={r}
                    index={i}
                    data={data}
                    colour={colorAt(data.palette, colours[i] ?? 0)}
                    selected={i === Math.min(sel, recs.length - 1)}
                    onSelect={() => setSel(i)}
                  />
                ))}
              </ol>
            </section>
          ) : (
            <section className="border border-line bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-2.5">
                <label className="flex min-w-0 flex-1 items-center gap-2 border border-[#2b3038] bg-raised px-2 py-1.5 focus-within:border-signal/70">
                  <MagnifyingGlass size={12} className="shrink-0 text-faint" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search titles"
                    aria-label="Search the catalogue"
                    className="w-full bg-transparent font-mono text-[11.5px] text-ink placeholder:text-faint focus:outline-none"
                  />
                </label>
                <Select value={String(genre)} onValueChange={(v) => setGenre(Number(v))}>
                  <SelectTrigger className="h-7 w-[130px] text-[11.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">All genres</SelectItem>
                    {data.genres.map((g) => (
                      <SelectItem key={g.i} value={String(g.i)}>
                        {g.n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                  <SelectTrigger className="h-7 w-[128px] text-[11.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">By degree</SelectItem>
                    <SelectItem value="audience">By audience</SelectItem>
                    <SelectItem value="year">Newest first</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 font-mono text-[10px] text-faint">
                  from
                  <input
                    type="number"
                    value={minYear || ''}
                    onChange={(e) => setMinYear(Number(e.target.value) || 0)}
                    placeholder="1900"
                    className="w-16 border border-[#2b3038] bg-raised px-1.5 py-1 font-mono text-[11px] text-ink focus:border-signal/70 focus:outline-none"
                    aria-label="Earliest year"
                  />
                </label>
                {(genre >= 0 || minYear > 0 || q) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setGenre(-1);
                      setMinYear(0);
                      setQ('');
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2">
                {browse.map((m) => {
                  const own = user.likes.includes(m.id);
                  return (
                    <li
                      key={m.id}
                      className="flex items-baseline gap-2 border-b border-line-soft px-3 py-2"
                    >
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0"
                        style={{ background: colorAt(data.palette, m.g[0] ?? 0) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] text-ink-2">
                          {m.t}
                          {m.y && <span className="ml-1.5 text-faint">{m.y}</span>}
                        </span>
                        <span className="font-mono text-[9px] text-faint">
                          {m.gn.slice(0, 2).join(' / ')}
                        </span>
                      </span>
                      {own && (
                        <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.06em] text-signal">
                          liked
                        </span>
                      )}
                      <span className="tnum shrink-0 font-mono text-[10px] text-muted">
                        {fmtInt(m.d)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {recent.length > 0 && (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-y border-line-soft bg-white/[0.015] px-3 py-2.5">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-muted">
                      Recent releases · {recent.length}
                    </span>
                    <span className="font-mono text-[9px] text-faint">
                      no ratings in the archive · listed, not scored
                    </span>
                  </div>
                  <p className="border-b border-line-soft px-3 py-2 text-[10.5px] leading-relaxed text-faint">
                    The MovieLens snapshot ends in 2018, so a 2025 or 2026 film has no audience here
                    — no degree, no similarity edges, and nothing the path count could reach. They
                    appear with their real year and genre and a blank score, because a zero would
                    read as a measurement.
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2">
                    {recent.map((m) => (
                      <li
                        key={`${m.t}-${m.y}`}
                        className="flex items-baseline gap-2 border-b border-line-soft px-3 py-2"
                      >
                        <span
                          className="mt-1 h-1.5 w-1.5 shrink-0 outline outline-1 outline-offset-1 outline-white/10"
                          style={{ background: colorAt(data.palette, m.g[0] ?? 0) }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-ink-2">{m.t}</span>
                          <span className="font-mono text-[9px] text-faint">
                            {m.y} · {m.g.map((g) => data.genres[g]?.n).join(' / ')}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.05em] text-faint">
                          {m.lang === 'Hindi' ? 'hindi' : m.lang.toLowerCase()}
                        </span>
                        <span className="shrink-0 font-mono text-[9.5px] text-faint">—</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="grid gap-5 xl:sticky xl:top-[60px]">
          <section className="border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted">
                Viewer {user.id}
              </h2>
              <span className="font-mono text-[9.5px] text-faint">{fmtInt(user.n)} likes</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-3.5">
              <Pair k="Top genre" v={data.genres[user.genres[0]]?.n ?? '—'} />
              <Pair k="Taste overlap" v={fmt3(user.echo)} />
              <Pair k="Reached, 1 hop" v={fmtInt(user.reach1)} />
              <Pair k="Reached, 2 hops" v={fmtInt(user.reach2)} />
              <Pair k="Reached, 3 hops" v={fmtInt(user.reach3)} />
              <Pair k="Unreached" v={fmtInt(user.unreached)} />
            </div>
          </section>

          <WhyPanel
            data={data}
            user={user}
            rec={current}
            rank={Math.min(sel, recs.length - 1)}
            recs={recs}
          />

          <section className="overflow-hidden border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted">
                Induced neighbourhood
              </h2>
              <span className="font-mono text-[9.5px] text-faint">
                {data.local[String(user.id)]?.nodes.length ?? 0} vertices
              </span>
            </div>
            <div className="h-[300px]">
              <NeighbourhoodCanvas
                bundle={data}
                uid={user.id}
                selectedMovie={current?.m ?? null}
                onPickRank={(rank) => setSel(rank)}
                onHover={() => {}}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function tiers(users: User[]) {
  const bands = [
    { min: 200, label: 'Heavy viewers' },
    { min: 80, label: 'Established viewers' },
    { min: 30, label: 'Casual viewers' },
    { min: 0, label: 'Light viewers' },
  ];
  const seen = new Set<number>();
  return bands.map((b, i) => {
    const upper = i === 0 ? Infinity : bands[i - 1].min;
    const list = users
      .filter((u) => u.n >= b.min && u.n < upper && !seen.has(u.id))
      .sort((a, z) => z.n - a.n);
    list.forEach((u) => seen.add(u.id));
    return { label: b.label, users: list };
  });
}

function RecRow({
  rec,
  index,
  data,
  colour,
  selected,
  onSelect,
}: {
  rec: Rec;
  index: number;
  data: Bundle;
  colour: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const m = data.movies.find((x) => x.id === rec.m);
  if (!m) return null;
  return (
    <li>
      <Button
        variant="ghost"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'group grid h-auto w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center justify-normal gap-3 px-2 py-2.5 text-left font-normal',
          selected
            ? 'bg-signal/[0.09] hover:bg-signal/[0.09] shadow-[inset_1px_0_0_var(--color-signal)]'
            : '',
        )}
      >
        <span
          className={cn(
            'tnum text-right font-mono text-[15px]',
            selected ? 'text-signal' : 'text-faint group-hover:text-muted',
          )}
        >
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium tracking-[-0.005em]">
            {m.t}
            {m.y && <span className="ml-1.5 font-normal text-faint">{m.y}</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted">
            <span className="h-1.5 w-1.5 shrink-0" style={{ background: colour }} />
            <span className="truncate">{m.gn.join(' / ')}</span>
            <span className="text-faint">·</span>
            <span className="shrink-0">{fmtInt(rec.cyc)} paths</span>
          </span>
        </span>
        <span className="tnum text-right font-mono text-[12.5px]">
          {rec.s.toFixed(2)}
          <span className="block text-[8.5px] uppercase tracking-[0.06em] text-faint">score</span>
        </span>
      </Button>
    </li>
  );
}

function WhyPanel({
  data,
  user,
  rec,
  rank,
  recs,
}: {
  data: Bundle;
  user: User;
  rec?: Rec;
  rank: number;
  recs: Rec[];
}) {
  if (!rec) return null;
  const m = data.movies.find((x) => x.id === rec.m)!;
  const novelty = 1 / (1 + rec.echo);
  const maxCyc = Math.max(...recs.map((r) => r.cycTerm), 0.001);
  const maxDamp = Math.max(...recs.map((r) => r.damp), 0.001);

  return (
    <section className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted">
          Why this title
        </h2>
        <span className="font-mono text-[9.5px] text-faint">
          #{rank + 1} / {recs.length}
        </span>
      </div>
      <div className="grid gap-3 p-3.5">
        <div>
          <div className="text-[14px] font-medium leading-snug tracking-[-0.01em]">
            {m.t}
            {m.y && <span className="ml-1.5 font-normal text-faint">{m.y}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {m.gn.map((g) => (
              <span
                key={g}
                className="border border-line px-1.5 py-0.5 font-mono text-[9px] text-ink-2"
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        <div className="border border-line-soft bg-canvas px-3 py-2 font-mono text-[11px] leading-[1.85] text-ink-2">
          <div>
            <span className="text-muted">score</span> = (1 + ln(1 +{' '}
            <span className="text-signal">P</span>)) × d<sup>α</sup> × 1/(1+
            <span className="text-signal">E</span>)
          </div>
          <div className="text-ink">
            &nbsp;&nbsp;= {rec.cycTerm.toFixed(3)} × {rec.damp.toFixed(3)} × {novelty.toFixed(3)}
          </div>
          <div className="text-signal">&nbsp;&nbsp;= {rec.s.toFixed(3)}</div>
        </div>

        <div className="grid gap-1.5">
          <Factor label="paths P" value={fmtInt(rec.cyc)} frac={rec.cycTerm / maxCyc} />
          <Factor label="audience d" value={fmtInt(rec.deg)} frac={rec.damp / maxDamp} alt />
          <Factor label="novelty" value={novelty.toFixed(3)} frac={novelty} />
          <Factor label="echo E" value={rec.echo.toFixed(2)} frac={rec.echo} alt />
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          {fmtInt(rec.cyc)} alternating paths of length three join viewer {user.id} to this title.{' '}
          {(rec.echo * 100).toFixed(0)}% of its audience already sits inside their one-hop set, so
          the novelty term is {novelty.toFixed(2)}.
        </p>

        <Separator />

        <div>
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
            Witness paths
          </div>
          <div className="grid gap-1.5">
            {rec.paths.slice(0, 3).map((p, i) => {
              const anchor = data.movies.find((x) => x.id === p.a);
              return (
                <div key={i} className="font-mono text-[10px] leading-relaxed text-ink-2">
                  <span className="text-signal">u{user.id}</span>
                  <ArrowRight size={8} weight="bold" className="mx-0.5 inline text-faint" />
                  <span>{anchor?.t.slice(0, 18)}</span>
                  <ArrowRight size={8} weight="bold" className="mx-0.5 inline text-faint" />
                  <span className="text-[#8ec5ff]">v{p.v}</span>
                  <ArrowRight size={8} weight="bold" className="mx-0.5 inline text-faint" />
                  <span>{m.t.slice(0, 18)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Factor({
  label,
  value,
  frac,
  alt,
}: {
  label: string;
  value: string;
  frac: number;
  alt?: boolean;
}) {
  return (
    <div className="grid grid-cols-[66px_minmax(0,1fr)_46px] items-center gap-2">
      <span className="font-mono text-[9px] text-muted">{label}</span>
      <span className="h-1 overflow-hidden bg-line-soft">
        <span
          className={cn('block h-full origin-left', alt ? 'bg-s9' : 'bg-signal')}
          style={{ width: `${Math.max(2, Math.min(100, frac * 100))}%` }}
        />
      </span>
      <span className="tnum text-right font-mono text-[10px] text-ink">{value}</span>
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line-soft pb-1">
      <span className="truncate text-[10.5px] text-muted">{k}</span>
      <span className="tnum shrink-0 font-mono text-[10.5px] text-ink">{v}</span>
    </div>
  );
}
