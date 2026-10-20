import { useEffect, useState } from 'react';
import type { Bundle } from './data';

let cache: Promise<Bundle> | null = null;

async function load(): Promise<Bundle> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/bundle.json`);
  if (!res.ok) throw new Error(`bundle.json returned HTTP ${res.status}`);
  const raw = (await res.json()) as Bundle;
  raw.movies.forEach((m) => {
    m.gn = m.g.map((i) => raw.genres[i]?.n ?? 'Other');
  });
  return raw;
}

export function useBundle() {
  const [data, setData] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cache ??= load();
    cache.then(setData).catch((e) => setError(String(e.message ?? e)));
  }, []);

  return { data, error };
}

export const movieIndex = (b: Bundle) => new Map(b.movies.map((m, i) => [m.id, i]));

export function buildAdjacency(b: Bundle) {
  const adj: number[][] = b.movies.map(() => []);
  for (const [a, c] of b.edges) {
    adj[a].push(c);
    adj[c].push(a);
  }
  return adj;
}

/** Titles at hop 1, 2 and 3 from a viewer's liked titles. */
export function reachSets(b: Bundle, adj: number[][], uid: number) {
  const idx = movieIndex(b);
  const likes = new Set(
    (b.users.find((u) => u.id === uid)?.likes ?? [])
      .map((id) => idx.get(id))
      .filter((i): i is number => i !== undefined),
  );
  const hop2 = new Set<number>();
  const hop3 = new Set<number>();
  for (const i of likes) for (const j of adj[i]) if (!likes.has(j)) hop2.add(j);
  for (const j of hop2) for (const k of adj[j]) if (!likes.has(k) && !hop2.has(k)) hop3.add(k);
  return { likes, hop2, hop3 };
}
