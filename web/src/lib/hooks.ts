import { useCallback, useEffect, useRef, useState } from 'react';

/** Shareable URL state: ?u=414&m=0&view=graph&v=... */
export function useUrlState<T extends string | number>(key: string, fallback: T) {
  const read = () => {
    const raw = new URLSearchParams(location.search).get(key);
    if (raw === null) return fallback;
    return (typeof fallback === 'number' ? Number(raw) : raw) as T;
  };
  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    const onPop = () => setValue(read());
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const put = useCallback(
    (v: T) => {
      setValue(v);
      const u = new URL(location.href);
      if (v === fallback || v === '' || v === null) u.searchParams.delete(key);
      else u.searchParams.set(key, String(v));
      history.replaceState(null, '', u);
    },
    [key],
  );

  return [value, put] as const;
}

/** Element size, observed. */
export function useSize<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize((s) =>
        Math.abs(s.w - width) > 0.5 || Math.abs(s.h - height) > 0.5 ? { w: width, h: height } : s,
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [ref, size] as const;
}

export const prefersReduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
