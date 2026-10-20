import { useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { BooksIcon, ChartBarIcon, GraphIcon, ArrowCounterClockwise } from '@phosphor-icons/react';
import { useBundle } from '@/lib/store';
import { fmtInt } from '@/lib/data';
import { useUrlState } from '@/lib/hooks';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import Onboarding from '@/views/Onboarding';
import CatalogView from '@/views/CatalogView';
import GraphView from '@/views/GraphView';
import TopicsView from '@/views/TopicsView';

const VIEWS = [
  { id: 'catalog', label: 'Catalogue', icon: BooksIcon },
  { id: 'graph', label: 'Graph', icon: GraphIcon },
  { id: 'stats', label: 'Stats', icon: ChartBarIcon },
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

  const restart = () => setOnboarded(false);
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
        <div className="mx-auto flex h-11 max-w-[1560px] items-center gap-5 px-4">
          <a href="#" className="flex shrink-0 items-center gap-2" aria-label="NextFrame home">
            <Mark />
            <span className="font-serif text-[15px] tracking-[-0.01em]">NextFrame</span>
            <span className="hidden border-l border-[#22272e] pl-2.5 font-mono text-[9.5px] uppercase tracking-[0.09em] text-faint lg:block">
              Discrete maths · graph theory
            </span>
          </a>

          {data && onboarded && (
            <>
              <Tabs.Root
                value={view}
                onValueChange={(v) => setView(v as ViewId)}
                className="h-full min-w-0 flex-1"
              >
                <TabsList className="scroll-thin h-full overflow-x-auto">
                  {VIEWS.map((v, i) => (
                    <TabsTrigger key={v.id} value={v.id} className="group shrink-0">
                      <span className="hidden font-mono text-[9px] text-faint group-data-[state=active]:text-signal sm:inline">
                        0{i + 1}
                      </span>
                      <v.icon size={12} weight="regular" />
                      <span>{v.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs.Root>

              {counts && (
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
            </>
          )}
          {data && !onboarded && (
            <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.09em] text-faint">
              Step 1 of 2 · taste
            </span>
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

        {data && !onboarded && <Onboarding data={data} onDone={finish} />}

        {data && onboarded && (
          <>
            <div className={cn(view === 'catalog' ? 'block' : 'hidden')}>
              <CatalogView
                data={data}
                uid={uid}
                setUid={setUid}
                sel={sel}
                setSel={setSel}
                onRestart={restart}
              />
            </div>
            <div className={cn(view === 'graph' ? 'block' : 'hidden')}>
              <GraphView data={data} uid={uid} />
            </div>
            <div className={cn(view === 'stats' ? 'block' : 'hidden')}>
              <TopicsView data={data} uid={uid} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

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
