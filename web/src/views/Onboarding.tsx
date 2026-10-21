import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MagnifyingGlass } from '@phosphor-icons/react';
import type { Bundle, Movie, User } from '@/lib/data';
import { colorAt, fmtInt, recentId, titleById } from '@/lib/data';
import { prefersReduced } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MIN_PICKS = 3;
const MAX_PICKS = 6;

type Props = {
  data: Bundle;
  onDone: (uid: number) => void;
};

/**
 * Two ways in, one result. Either pick genres and the app finds the archive
 * viewer whose likes sit closest to those genres, or search a handful of
 * titles you already like and it finds the viewer who liked the most of them.
 * Either way the destination is a real profile already in the bundle, so every
 * recommendation that follows is computed rather than invented.
 */
export default function Onboarding({ data, onDone }: Props) {
  const [step, setStep] = useState<0 | 1>(0);
  const [mode, setMode] = useState<'taste' | 'titles'>('taste');
  const [picked, setPicked] = useState<number[]>([]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [q, setQ] = useState('');
  const [hover, setHover] = useState<number | null>(null);
  const matchRef = useRef<HTMLDivElement | null>(null);

  // step two renders under the picker, which puts it below the fold on a laptop
  useEffect(() => {
    if (step !== 1) return;
    matchRef.current?.scrollIntoView({
      behavior: prefersReduced() ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [step]);

  const byId = useMemo(() => new Map(data.movies.map((m) => [m.id, m])), [data.movies]);

  /** every viewer scoring, sorted, so the closer profile is always on top */
  const matches = useMemo(() => {
    if (mode === 'taste') {
      if (!picked.length) return null;
      const want = new Set(picked);
      const scored = data.users.map((u) => {
        // how much of this viewer's own history sits in the picked genres
        const owned = u.likes.reduce((n, id) => {
          const m = byId.get(id);
          return n + (m && m.g.some((g) => want.has(g)) ? 1 : 0);
        }, 0);
        const share = owned / Math.max(1, u.n);
        // and how much of their *top* genres you named, so a viewer whose whole
        // history happens to touch Drama does not win on breadth alone
        const tops = new Set(u.genres.slice(0, 5));
        let named = 0;
        for (const g of want) if (tops.has(g)) named++;
        const genreFit = named / (want.size + tops.size - named || 1);
        return { u, score: share * 0.6 + genreFit * 0.4, owned, share };
      });
      scored.sort((a, b) => b.score - a.score || b.owned - a.owned);
      return scored.slice(0, 40);
    }
    if (!chosen.length) return null;
    // A recent pick has no archive id to test for, so it is matched through
    // its genres: a viewer counts for it if they liked a title in those
    // genres, and the ranking then favours whoever watches that genre most.
    // `owned` stays the exact count — titles the viewer literally liked — so
    // the "you both liked" figure never claims a genre hit as a shared title.
    const hit = new Set(chosen.filter((id) => id > 0));
    const recentGenres = chosen
      .filter((id) => id < 0)
      .map((id) => new Set(data.recent[-id - 1]?.g ?? []));
    const scored = data.users.map((u) => {
      const owned = u.likes.filter((id) => hit.has(id)).length;
      let covered = 0;
      let affinity = 0;
      for (const want of recentGenres) {
        let n = 0;
        for (const id of u.likes) if (byId.get(id)?.g.some((g) => want.has(g))) n++;
        if (n) covered++;
        affinity += n / Math.max(1, u.n);
      }
      const score = (owned + covered) / chosen.length;
      return {
        u,
        score,
        owned,
        covered,
        // a genre-only hit is not a shared title, so the two rates differ
        share: owned / chosen.length,
        // exact shared titles first, then how much of the recent picks' genres
        // the viewer actually watches
        fit: owned + affinity,
      };
    });
    // a viewer who liked all of them beats one who liked most of a longer history
    scored.sort((a, b) => b.fit - a.fit || b.owned - a.owned);
    return scored.filter((s) => s.fit > 0).slice(0, 40);
  }, [mode, picked, chosen, data.users, data.recent, byId]);

  const best = matches?.[0]?.u ?? null;
  const recs = best ? (data.recs[String(best.id)] ?? []).slice(0, 3) : [];

  const canContinue = mode === 'taste' ? picked.length >= MIN_PICKS : chosen.length >= 1;

  const toggle = (list: number[], set: (v: number[]) => void, id: number, max: number) => {
    if (list.includes(id)) set(list.filter((x) => x !== id));
    else if (list.length < max) set([...list, id]);
  };

  return (
    <div className="mx-auto min-h-[calc(100dvh-45px)] max-w-[1240px] px-5 pb-20 pt-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <div className="lg:pt-6">
          <div className="eyebrow">Start here · no account, no survey</div>
          <h1 className="mt-4 max-w-[17ch] text-[clamp(30px,3.6vw,50px)] font-normal leading-[1.04] tracking-[-0.02em]">
            Tell it what you <span className="italic text-[#8ec5ff]">like</span>.
          </h1>
          <p className="mt-5 max-w-[42ch] text-[13.5px] leading-relaxed text-ink-2">
            Two ways in: choose the kinds of film you watch, or search for a few titles you already
            love. Either one resolves to a viewer from the MovieLens archive whose taste sits
            closest to yours, and the recommendations that follow are computed from that viewer's
            position in the similarity graph.
          </p>

          <div className="mt-8 border-t border-line-soft pt-5">
            <div className="grid gap-2 font-mono text-[10px] text-faint">
              <Step n={1} label="Pick a taste" active={step === 0 || canContinue} />
              <Step n={2} label="Meet your match" active={step === 1 && !!best} />
            </div>
          </div>
        </div>

        <div className="border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
            <div className="flex items-center gap-0.5">
              {(
                [
                  ['taste', 'By genre'],
                  ['titles', 'By title'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  aria-pressed={mode === id}
                  className={cn(
                    'px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.07em] transition-colors',
                    mode === id
                      ? 'bg-white/[0.06] text-ink shadow-[inset_0_-1px_0_var(--color-signal)]'
                      : 'text-muted hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="font-mono text-[9.5px] text-faint">
              {mode === 'taste'
                ? `${picked.length} / ${MAX_PICKS} genres`
                : `${chosen.length} title${chosen.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="p-4">
            {mode === 'taste' ? (
              <>
                <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
                  Pick at least {MIN_PICKS}. Sparse genres such as Documentary and Film-Noir are in
                  the archive but appear in very few titles.
                </p>
                <div className="grid grid-cols-2 gap-px bg-line-soft sm:grid-cols-3">
                  {data.genres.map((g) => {
                    const on = picked.includes(g.i);
                    return (
                      <button
                        key={g.i}
                        onClick={() => toggle(picked, setPicked, g.i, MAX_PICKS)}
                        aria-pressed={on}
                        onPointerEnter={() => setHover(g.i)}
                        onPointerLeave={() => setHover(null)}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-2 text-left text-[12px] transition-colors',
                          on
                            ? 'bg-signal/[0.12] text-ink'
                            : 'bg-surface text-ink-2 hover:bg-white/[0.04]',
                        )}
                      >
                        <span
                          className="h-2 w-2 shrink-0"
                          style={{ background: on ? '#4d92ff' : colorAt(data.palette, g.i) }}
                        />
                        <span className="truncate">{g.n}</span>
                        <span className="ml-auto font-mono text-[9.5px] text-faint">{g.c}</span>
                        {on && <Check size={11} weight="bold" className="shrink-0 text-signal" />}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <SearchBox
                  data={data}
                  q={q}
                  setQ={setQ}
                  chosen={chosen}
                  onAdd={(id) => toggle(chosen, setChosen, id, MAX_PICKS)}
                  picked={chosen}
                  pickedSet={new Set(chosen)}
                />
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
                  Draft a short watchlist. The archive viewer who shares the most of these is the
                  one your recommendations come from. 2025 and 2026 releases are selectable too —
                  the archive never rated them, so they match by genre.
                </p>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3">
            <span className="font-mono text-[9.5px] text-faint">
              {mode === 'taste'
                ? picked.length < MIN_PICKS
                  ? `pick ${MIN_PICKS - picked.length} more`
                  : 'ready'
                : chosen.length
                  ? 'ready'
                  : 'pick a title'}
            </span>
            <Button size="md" disabled={!canContinue} onClick={() => setStep(1)} className="gap-2">
              Find my match
              <ArrowRight size={11} weight="bold" />
            </Button>
          </div>
        </div>
      </div>

      {step === 1 && (
        <div ref={matchRef} className="scroll-mt-14">
          <Match
            data={data}
            best={best}
            matches={matches ?? []}
            recs={recs}
            picked={picked}
            chosen={chosen}
            mode={mode}
            onBack={() => setStep(0)}
            onDone={onDone}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ steps */

function Step({ n, label, active }: { n: number; label: string; active: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', active ? 'text-ink-2' : 'text-faint')}>
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center border font-mono text-[9px]',
          active ? 'border-signal/60 text-signal' : 'border-line',
        )}
      >
        {n}
      </span>
      {label}
    </div>
  );
}

function SearchBox({
  data,
  q,
  setQ,
  chosen,
  onAdd,
  pickedSet,
}: {
  data: Bundle;
  q: string;
  setQ: (v: string) => void;
  chosen: number[];
  onAdd: (id: number) => void;
  picked: number[];
  pickedSet: Set<number>;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const s = q.trim().toLowerCase();

  // One result list, not two: a 2025 film is as selectable as a 2005 one.
  // What differs is how the pick is matched (an archive id is shared with
  // viewers; a recent film is matched through its genres), so the row says
  // which and nothing is greyed out or made untouchable.
  const results = useMemo(() => {
    type Row = { key: string; id: number; t: string; y: number; gn: string[] };
    const fromArchive: Row[] = data.movies
      .filter((m) => !s || m.t.toLowerCase().includes(s))
      .sort((a, b) => b.d - a.d)
      .slice(0, s ? 12 : 6)
      .map((m) => ({ key: `m${m.id}`, id: m.id, t: m.t, y: m.y ?? 0, gn: m.gn }));
    const fromRecent: Row[] = data.recent
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => !s || m.t.toLowerCase().includes(s))
      .sort((a, b) => b.m.y - a.m.y || a.m.t.localeCompare(b.m.t))
      .slice(0, s ? 4 : 2)
      .map(({ m, i }) => ({
        key: `r${i}`,
        id: recentId(i),
        t: m.t,
        y: m.y,
        gn: m.g.map((g) => data.genres[g]?.n ?? 'Other'),
      }));
    return [...fromArchive, ...fromRecent];
  }, [s, data.movies, data.recent, data.genres]);

  const firstPick = results[0];

  return (
    <div>
      <label className="flex items-center gap-2 border border-[#2b3038] bg-raised px-2.5 py-2 focus-within:border-signal/70">
        <MagnifyingGlass size={13} className="shrink-0 text-faint" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && firstPick) {
              onAdd(firstPick.id);
              setQ('');
            }
          }}
          placeholder={`Search ${fmtInt(data.meta.movies + data.recent.length)} titles`}
          className="w-full bg-transparent font-mono text-[12px] text-ink placeholder:text-faint focus:outline-none"
          aria-label="Search the catalogue"
        />
      </label>

      {chosen.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {chosen.map((id) => (
            <button
              key={id}
              onClick={() => onAdd(id)}
              className="group flex items-center gap-1.5 border border-[#2b3038] bg-raised px-1.5 py-1 text-[11px] text-ink-2 hover:border-[#3a414b] hover:text-ink"
            >
              <span className="truncate">{titleById(data, id) ?? id}</span>
              {id < 0 && <span className="shrink-0 font-mono text-[8px] text-faint">genre match</span>}
              <span className="text-faint group-hover:text-signal">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="scroll-thin mt-2 grid max-h-[248px] gap-px overflow-y-auto border border-line-soft">
        {results.map((m) => {
          const on = pickedSet.has(m.id);
          return (
            <button
              key={m.key}
              onClick={() => onAdd(m.id)}
              aria-pressed={on}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 text-left transition-colors',
                on ? 'bg-signal/[0.12]' : 'bg-surface hover:bg-white/[0.04]',
              )}
            >
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                {m.t}
                <span className="ml-1.5 text-faint">{m.y}</span>
              </span>
              <span className="shrink-0 font-mono text-[9px] text-faint">
                {m.gn.slice(0, 2).join(' / ')}
              </span>
              {on && <Check size={11} weight="bold" className="shrink-0 text-signal" />}
            </button>
          );
        })}
        {!results.length && (
          <div className="px-2 py-4 text-center font-mono text-[10.5px] text-faint">
            no title matches that
          </div>
        )}
      </div>

      {chosen.some((id) => id < 0) && (
        <p className="mt-2 border-l-2 border-signal/40 pl-2 font-mono text-[10px] leading-relaxed text-faint">
          A 2025+ pick is released after the archive ends, so no viewer rated it. It counts by genre:
          the match goes to the archive viewers who liked the most titles in that genre. Every
          recommendation that follows is still computed from real ratings.
        </p>
      )}
    </div>
  );
}

function Match({
  data,
  best,
  matches,
  recs,
  picked,
  chosen,
  mode,
  onBack,
  onDone,
}: {
  data: Bundle;
  best: User | null;
  matches: { u: User; score: number; owned: number; covered?: number; share: number }[];
  recs: { m: number; s: number; cyc: number; cand: number }[];
  picked: number[];
  chosen: number[];
  mode: 'taste' | 'titles';
  onBack: () => void;
  onDone: (uid: number) => void;
}) {
  if (!best) return null;
  const byId = new Map(data.movies.map((m) => [m.id, m]));
  const shared =
    mode === 'taste'
      ? picked.map((g) => `${data.genres[g]?.n} (${data.genres[g]?.c})`).join(', ')
      : chosen.map((id) => titleById(data, id) ?? id).join(', ');

  // With a 2025+ pick there may be no title the viewer literally shares, only
  // genre overlap. Label whichever number is actually being shown.
  const top = matches[0];
  const genreOnly = mode === 'titles' && !top?.owned && (top?.covered ?? 0) > 0;
  const matchLabel = mode === 'taste' || genreOnly ? 'in your genres' : 'you both liked';
  const matchValue =
    mode === 'taste' ? (top?.owned ?? 0) : genreOnly ? (top?.covered ?? 0) : (top?.owned ?? 0);

  return (
    <div className="mt-10 border-t border-line pt-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-faint">
            You said you like
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{shared}</p>

          <div className="mt-5 border border-line bg-surface px-4 py-3">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-faint">
              Closest archive viewer
            </div>
            <div className="mt-1.5">
              <span className="font-serif text-[28px] leading-none text-ink">Viewer {best.id}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10.5px]">
              <span className="text-muted">
                likes <span className="text-ink">{fmtInt(best.n)}</span>
              </span>
              <span className="text-muted">
                {matchLabel} <span className="text-ink">{fmtInt(matchValue)}</span>
              </span>
              <span className="text-muted">
                top genre <span className="text-ink">{data.genres[best.genres[0]]?.n ?? '—'}</span>
              </span>
              <span className="text-muted">
                your share{' '}
                <span className="text-ink">{((matches[0]?.share ?? 0) * 100).toFixed(0)}%</span>
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => onDone(best.id)} className="gap-2">
              Open my recommendations
              <ArrowRight size={11} weight="bold" />
            </Button>
            <Button variant="ghost" onClick={onBack} className="gap-1.5">
              <ArrowLeft size={11} weight="bold" />
              Pick again
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <section className="border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted">
                What we would start you on
              </h2>
              <span className="font-mono text-[9.5px] text-faint">
                top 3 of {fmtInt(recs[0]?.cand ?? 0)} scored
              </span>
            </div>
            <ol className="p-2">
              {recs.map((r, i) => {
                const m = byId.get(r.m);
                if (!m) return null;
                return (
                  <li
                    key={r.m}
                    className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 px-2 py-2"
                  >
                    <span className="tnum text-right font-mono text-[14px] text-signal">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-ink">{m.t}</span>
                      <span className="font-mono text-[9.5px] text-faint">
                        {m.gn.slice(0, 3).join(' / ')} · {fmtInt(r.cyc)} paths
                      </span>
                    </span>
                    <span className="tnum font-mono text-[12px] text-ink-2">{r.s.toFixed(2)}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="border border-line bg-surface">
            <div className="border-b border-line-soft px-4 py-2.5">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted">
                Nearest neighbours in taste
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5 p-3">
              {matches.slice(0, 8).map(({ u, owned, covered }) => (
                <button
                  key={u.id}
                  onClick={() => onDone(u.id)}
                  className="flex items-center gap-2 border border-line px-2 py-1 font-mono text-[10px] text-ink-2 transition-colors hover:border-[#3a414b] hover:text-ink"
                >
                  viewer {u.id}
                  {/* with only a 2025+ pick nothing is shared by id; show the genre count instead */}
                  <span className="text-faint">
                    {owned > 0 || !covered ? owned : `${covered} by genre`}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
