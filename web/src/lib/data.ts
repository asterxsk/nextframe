/* Typed view over the bundle produced by pipeline/build_bundle.py. */

export type Movie = {
  id: number;
  t: string;
  y: number | null;
  g: number[];
  gn: string[];
  /** audience size: viewers who rated this title a like */
  d: number;
  /** degree in the similarity graph */
  gd: number;
  c: number;
};

export type RecPath = { v: number; a: number; n: number; sj: number };

export type Rec = {
  m: number;
  s: number;
  cyc: number;
  deg: number;
  damp: number;
  echo: number;
  cycTerm: number;
  popRank: number;
  rank: number;
  cand: number;
  paths: RecPath[];
};

export type User = {
  id: number;
  n: number;
  comp: number;
  likes: number[];
  top: number[];
  genres: number[];
  echo: number;
  reach1: number;
  reach2: number;
  reach3: number;
  unreached: number;
  components: number[];
};

export type Bundle = {
  meta: {
    dataset: string;
    ratings: number;
    moviesAll: number;
    usersAll: number;
    movies: number;
    users: number;
    likes: number;
    edges: number;
    meanAudience: number;
    medianAudience: number;
    maxAudience: number;
    maxAudienceMovie: number;
    minDegree: number;
    meanDegree: number;
    medianDegree: number;
    maxDegree: number;
    maxDegreeMovie: number;
    components: number;
    largest: number;
    likeThreshold: number;
    simFloor: number;
    k: number;
    built: string;
  };
  genres: { i: number; n: string; c: number }[];
  movies: Movie[];
  edges: [number, number, number][];
  layout: [number, number, number, number][];
  degreeDist: [number, number][];
  components: { i: number; n: number; top: number[] }[];
  users: User[];
  recs: Record<string, Rec[]>;
  watch: Record<
    string,
    {
      order: number[];
      w: number;
      greedy: number[];
      gw: number;
      states: number;
      n: number;
      pairwise: number[][];
    }
  >;
  listColour: Record<string, { col: number[]; k: number }>;
  tags: Record<string, string[]>;
  local: Record<
    string,
    { nodes: { m: number; own: boolean }[]; edges: [number, number, number][] }
  >;
  stats: {
    triangles: number;
    clustering: number;
    girth: number;
    diameter: number;
    meanPath: number;
    articulation: number;
    bridges: number;
    assortativity: number;
    handshake: number;
    topTriangles: [number, number, number][];
  };
  euler: {
    vertices: { g: number; deg: number; n: string }[];
    edges: [number, number, number][];
    odd: number[];
    pairs: [number, number, number][];
    playlist: [number, number, number][];
    augmented: boolean;
    connected: boolean;
    edgesBefore: number;
    edgesAfter: number;
  };
  planar: {
    nodes: {
      g: number;
      n: string;
      x: number;
      y: number;
      col: number;
      colFull: number;
      deg: number;
    }[];
    edges: [number, number, number][];
    v: number;
    e: number;
    maxEdges: number;
    crossings: number;
    faces: number;
    eulerChar: number;
    colours: number;
    fullPlanar: boolean;
    fullV: number;
    fullE: number;
    fullColours: number;
    clique: number;
  };
  palette: string[];
  /**
   * Releases after the archive's last rating. These carry no audience and no
   * graph degree because nothing rated them — the fields are null, not zero,
   * so the UI can say "not in the archive" instead of claiming a measurement.
   */
  recent: RecentFilm[];
};

export type RecentFilm = {
  t: string;
  y: number;
  g: number[];
  lang: string;
  src: string;
  d: null;
  gd: null;
};

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmt1 = (n: number) => n.toFixed(1);
export const fmt2 = (n: number) => n.toFixed(2);
export const fmt3 = (n: number) => n.toFixed(3);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const genreLabel = (b: Bundle, i: number) => b.genres[i]?.n ?? 'Other';
export const shortYear = (y: number | null) => (y ? String(y) : 'n/a');

/**
 * Recent releases carry no MovieLens id, so a picker addresses them with a
 * negative id taken from their position in the bundle. Archive ids are all
 * positive, so the two id spaces cannot collide.
 */
export const recentId = (index: number) => -(index + 1);

/** The title behind an id the picker may hold: an archive movie or a recent film. */
export const titleById = (b: Bundle, id: number) =>
  id < 0 ? b.recent[-id - 1]?.t : b.movies.find((m) => m.id === id)?.t;

export const overlap = (a: number[], b: number[]) => {
  const s = new Set(a);
  let n = 0;
  for (const x of b) if (s.has(x)) n++;
  return n;
};

export function colorAt(palette: string[], i: number) {
  return palette[((i % palette.length) + palette.length) % palette.length];
}
