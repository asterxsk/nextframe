import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MagnifyingGlass } from '@phosphor-icons/react';
import type { Bundle, Movie, User } from '@/lib/data';
import { colorAt, fmtInt } from '@/lib/data';
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
    const hit = new Set(chosen);
    const scored = data.users.map((u) => {
      const shared = u.likes.filter((id) => hit.has(id)).length;
      return { u, score: shared / hit.size, owned: shared, share: shared / hit.size };
    });
    // a viewer who liked all of them beats one who liked most of a longer history
    scored.sort((a, b) => b.owned - a.owned || b.score - a.score);
    return scored.filter((s) => s.owned > 0).slice(0, 40);
  }, [mode, picked, chosen, data.users, byId]);

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
                  one your recommendations come from.
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
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data.movies.slice(0, 8);
    return data.movies
      .filter((m) => m.t.toLowerCase().includes(s))
      .sort((a, b) => b.d - a.d)
      .slice(0, 12);
  }, [q, data.movies]);

  return (
    <div>
      <label className="flex items-center gap-2 border border-[#2b3038] bg-raised px-2.5 py-2 focus-within:border-signal/70">
        <MagnifyingGlass size={13} className="shrink-0 text-faint" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) {
              onAdd(results[0].id);
              setQ('');
            }
          }}
          placeholder="Search 1,437 titles"
          className="w-full bg-transparent font-mono text-[12px] text-ink placeholder:text-faint focus:outline-none"
          aria-label="Search the catalogue"
        />
      </label>

      {chosen.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {chosen.map((id) => {
            const m = data.movies.find((x) => x.id === id);
            return (
              <button
                key={id}
                onClick={() => onAdd(id)}
                className="group flex items-center gap-1.5 border border-[#2b3038] bg-raised px-1.5 py-1 text-[11px] text-ink-2 hover:border-[#3a414b] hover:text-ink"
              >
                <span className="truncate">{m?.t ?? id}</span>
                <span className="text-faint group-hover:text-signal">×</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="scroll-thin mt-2 grid max-h-[248px] gap-px overflow-y-auto border border-line-soft">
        {results.map((m) => {
          const on = pickedSet.has(m.id);
          return (
            <button
              key={m.id}
              onClick={() => onAdd(m.id)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 text-left transition-colors',
                on ? 'bg-signal/[0.12]' : 'bg-surface hover:bg-white/[0.04]',
              )}
            >
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                {m.t}
                {m.y && <span className="ml-1.5 text-faint">{m.y}</span>}
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
  matches: { u: User; score: number; owned: number; share: number }[];
  recs: { m: number; s: number; cyc: number }[];
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
      : chosen.map((id) => byId.get(id)?.t ?? id).join(', ');

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
                {mode === 'taste' ? 'in your genres' : 'you both liked'}{' '}
                <span className="text-ink">{fmtInt(matches[0]?.owned ?? 0)}</span>
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
              <span className="font-mono text-[9.5px] text-faint">top 3 of 1,275 scored</span>
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
              {matches.slice(0, 8).map(({ u, owned }) => (
                <button
                  key={u.id}
                  onClick={() => onDone(u.id)}
                  className="flex items-center gap-2 border border-line px-2 py-1 font-mono text-[10px] text-ink-2 transition-colors hover:border-[#3a414b] hover:text-ink"
                >
                  viewer {u.id}
                  <span className="text-faint">{owned}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
