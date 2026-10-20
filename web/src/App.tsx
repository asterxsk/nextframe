import { useEffect, useMemo, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import {
  BooksIcon,
  ChartBarIcon,
  GraphIcon,
  ArrowCounterClockwise,
  Presentation,
} from '@phosphor-icons/react';
import { useBundle } from '@/lib/store';
import { fmtInt } from '@/lib/data';
import { useUrlState } from '@/lib/hooks';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import Onboarding from '@/views/Onboarding';
import CatalogView from '@/views/CatalogView';
import GraphView from '@/views/GraphView';
import TopicsView from '@/views/TopicsView';
import DeckView from '@/views/DeckView';

const VIEWS = [
  { id: 'catalog', label: 'Catalogue', icon: BooksIcon },
  { id: 'graph', label: 'Graph', icon: GraphIcon },
  { id: 'stats', label: 'Stats', icon: ChartBarIcon },
  { id: 'deck', label: 'Deck', icon: Presentation },
] as const;

export type ViewId = (typeof VIEWS)[number]['id'];

const DEFAULT_UID = 414;

export default function App() {
  const { data, error } = useBundle();
  const [view, setView] = useUrlState<ViewId>('view', 'catalog');
  const [uid, setUid] = useUrlState<number>('u', DEFAULT_UID);
  const [sel, setSel] = useUrlState<number>('m', 0);
  // An untouched `?u=` means the visitor has not answered the onboarding yet.
  const [onboarded, setOnboarded] = useState(() => new URLSearchParams(location.search).has('u'));
  // A bare link lands on the onboarding. Any shared view link before a taste
  // is chosen resolves to the deck — the only view there is to show — and the
  // URL is rewritten to say so rather than keeping a dead view name.
  const [deckOpen, setDeckOpen] = useState(() => {
    const p = new URLSearchParams(location.search);
    return !p.has('u') && p.has('view');
  });
  const [otherView] = useState(() => {
    const p = new URLSearchParams(location.search);
    return !p.has('u') && p.has('view') && p.get('view') !== 'deck';
  });
  useEffect(() => {
    if (otherView) setView('deck');
  }, [otherView, setView]);
  const openDeck = () => {
    setDeckOpen(true);
    setView('deck');
  };
  const closeDeck = () => {
    setDeckOpen(false);
    // back to the plain onboarding URL, not to a view a visitor cannot see
    if (!onboarded) setView('catalog');
  };
  const shown: ViewId = onboarded ? view : 'deck';
  // Onboarding is the default landing surface; the deck is an alternative to it.
  const deckVisible = onboarded ? view === 'deck' : deckOpen;

  // At 360 px four tabs scroll; keep the selected one in view rather than
  // letting it sit off the right edge of the strip.
  const tabsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const list = tabsRef.current;
    const el = list?.querySelector<HTMLElement>('[data-state="active"]');
    if (!list || !el) return;
    // Once now, and again whenever the strip re-measures — the webfonts arrive
    // after first paint and change every tab's width. The active tab must not
    // sit clipped on the right edge.
    const reveal = () => {
      // Centre the active tab: at 320 px the strip is only twice a tab wide, so
      // any scroll leaves a neighbour half in view at one edge or the other.
      const a = el.getBoundingClientRect();
      const b = list.getBoundingClientRect();
      const want = list.scrollLeft + (a.left - b.left) - (b.width - a.width) / 2;
      list.scrollLeft = Math.max(0, Math.min(want, list.scrollWidth - list.clientWidth));
    };
    reveal();
    const raf = requestAnimationFrame(reveal);
    const ro = new ResizeObserver(reveal);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [shown, onboarded, data]);

  const restart = () => {
    setOnboarded(false);
    setDeckOpen(false);
    setView('catalog');
  };
  const finish = (id: number) => {
    setUid(id);
    setSel(0);
    setOnboarded(true);
  };
  const counts = useMemo(
    () =>
      data
        ? {
            v: fmtInt(data.meta.movies),
            e: fmtInt(data.meta.edges),
            c: String(data.planar.colours),
          }
        : null,
    [data],
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-[#1b1f25] bg-canvas/95 backdrop-blur-xl">
        <div className="mx-auto flex h-11 max-w-[1560px] items-center gap-2 px-4 sm:gap-5">
          <a href="#" className="flex shrink-0 items-center gap-2" aria-label="NextFrame home">
            <Mark />
            <span className="font-serif text-[15px] tracking-[-0.01em] max-[480px]:hidden">NextFrame</span>
            <span className="hidden border-l border-[#22272e] pl-2.5 font-mono text-[9.5px] uppercase tracking-[0.09em] text-faint lg:block">
              Discrete maths · graph theory
            </span>
          </a>

          {data && (
            <>
              <Tabs.Root
                value={shown}
                onValueChange={(v) => {
                  setView(v as ViewId);
                  if (!onboarded) setDeckOpen(true);
                }}
                className="h-full min-w-0 flex-1"
              >
                <TabsList
                  ref={tabsRef}
                  // A scroll strip with a hard edge clips a tab mid-word, which
                  // reads as a rendering fault rather than as "scroll for more".
                  // Fading the edge says the same thing without the fragment.
                  className="scroll-thin h-full overflow-x-auto [mask-image:linear-gradient(to_right,transparent_0,#000_10px,#000_calc(100%-10px),transparent_100%)]"
                >
                  {VIEWS.filter((v) => onboarded || v.id === 'deck').map((v) => (
                    <TabsTrigger
                      key={v.id}
                      value={v.id}
                      aria-label={v.label}
                      // Below ~480 px four labelled tabs overflow the strip and
                      // a half-clipped word reads as a rendering fault. The icon
                      // alone fits down to 320 px; the aria-label keeps the
                      // accessible name.
                      className="group shrink-0 whitespace-nowrap max-[380px]:flex-1 max-[380px]:shrink max-[380px]:justify-center max-[380px]:gap-0"
                      // the lone tab is already selected before onboarding, so
                      // Radix has no change to report and the click opens it
                      onClick={onboarded ? undefined : openDeck}
                    >
                      <span className="hidden font-mono text-[9px] text-faint group-data-[state=active]:text-signal sm:inline">
                        {pad2(VIEWS.indexOf(v) + 1)}
                      </span>
                      <v.icon size={12} weight="regular" />
                      <span className="max-[380px]:hidden">{v.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs.Root>

              {onboarded && counts && (
                <div className="hidden items-center gap-3 font-mono text-[10px] text-muted md:flex">
                  <Metric label="V" value={counts.v} />
                  <span className="text-[#22272e]">|</span>
                  <Metric label="E" value={counts.e} />
                  <span className="text-[#22272e]">|</span>
                  <Metric label="χ" value={counts.c} />
                  <button
                    onClick={restart}
                    title="Change your taste"
                    aria-label="Change your taste"
                    className="ml-1 text-faint transition-colors hover:text-signal"
                  >
                    <ArrowCounterClockwise size={12} weight="bold" />
                  </button>
                </div>
              )}
              {!onboarded && (
                <span className="ml-auto shrink-0 font-mono text-[9.5px] uppercase tracking-[0.09em] text-faint max-sm:hidden">
                  Step 1 of 2 · taste
                </span>
              )}
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1560px] px-5 pb-24">
        {error && (
          <div className="mx-auto mt-24 max-w-lg border border-bad/30 bg-bad/5 p-6 text-center">
            <div className="font-mono text-[11px] uppercase tracking-widest text-bad">
              Bundle missing
            </div>
            <p className="mt-2 text-[13px] text-ink-2">{error}</p>
            <div className="mt-4 border border-line bg-canvas px-3 py-2 text-left font-mono text-[11px] text-muted">
              python pipeline/build_bundle.py --minify
              <br />
              npm run dev
            </div>
          </div>
        )}

        {!data && !error && <Boot />}

        {data && (
          <>
            <div className={cn(!onboarded && !deckOpen ? 'block' : 'hidden')}>
              <Onboarding data={data} onDone={finish} />
            </div>
            <div className={cn(shown === 'catalog' ? 'block' : 'hidden')}>
              {onboarded && (
                <CatalogView
                  data={data}
                  uid={uid}
                  setUid={setUid}
                  sel={sel}
                  setSel={setSel}
                  onRestart={restart}
                />
              )}
            </div>
            <div className={cn(shown === 'graph' ? 'block' : 'hidden')}>
              {onboarded && <GraphView data={data} uid={uid} />}
            </div>
            <div className={cn(shown === 'stats' ? 'block' : 'hidden')}>
              {onboarded && <TopicsView data={data} uid={uid} />}
            </div>
            <div className={cn(deckVisible ? 'block' : 'hidden')}>
              <DeckView
                data={data}
                active={deckVisible}
                onStart={onboarded ? undefined : closeDeck}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-faint">{label}</span>
      <span className="tnum text-ink-2">{value}</span>
    </span>
  );
}

function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3 14.5 8 9.4M10 7.4 15 2.6" stroke="#3a424d" strokeWidth="1.2" />
      <rect x="1.6" y="13.2" width="2.8" height="2.8" fill="#6ea8f0" />
      <rect x="13.6" y="1.2" width="2.8" height="2.8" fill="#2f7bef" />
      <rect x="7.6" y="6" width="2.8" height="2.8" fill="#8fbf72" />
    </svg>
  );
}

function Boot() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        Reading the graph
      </div>
      <div className="h-px w-52 overflow-hidden bg-line">
        <div className="h-full w-1/3 animate-[slide_1.15s_ease-in-out_infinite] bg-signal" />
      </div>
      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}`}</style>
    </div>
  );
}
