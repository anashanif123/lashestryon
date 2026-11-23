// Lash styles, described the way lash artists write them: a lash map.
//
// map        lengths in millimetres at the 5 mapping points a lash artist uses:
//            inner corner, iris start, pupil, iris end, outer corner.
//            The iris points are found on each client's own eye, so a "12 at the pupil"
//            sits right above that client's pupil.
// curl       J, B, C, CC or D (how strongly the lash lifts)
// thickness  extension diameter in millimetres (0.05 – 0.20)
// fan        strands per root: 1 = classic, 2–8 = "2D"–"8D" volume fans
// fanEvery   put a fan on every Nth root (2 = hybrid mix of classic + fans)
// spread     how wide a fan opens (radians). Tiny spread = closed "wet look" spikes
// count      roots along the lid at "Fullness 100%"
// lean       extra sweep towards the outer corner (radians)
// spikes     every Nth root becomes a longer, pinched spike (wispy / anime looks)
//
// Everything is drawn by code, strand by strand. No lash images are needed.

export const CURLS = {
  J: { label: "J", lift: 0.25, note: "Straight, very natural" },
  B: { label: "B", lift: 0.5, note: "Soft curl" },
  C: { label: "C", lift: 0.8, note: "Most popular, noticeable lift" },
  CC: { label: "CC", lift: 1.0, note: "Strong curl" },
  D: { label: "D", lift: 1.2, note: "Dramatic, doll-like" },
};

// Names of the 5 mapping points, inner corner → outer corner.
export const ZONES = [
  { id: "inner", label: "Inner corner", short: "Inner" },
  { id: "iris-start", label: "Iris start", short: "Iris start" },
  { id: "pupil", label: "Pupil", short: "Pupil" },
  { id: "iris-end", label: "Iris end", short: "Iris end" },
  { id: "outer", label: "Outer corner", short: "Outer" },
];

export const THICKNESSES = [0.05, 0.07, 0.1, 0.12, 0.15, 0.18, 0.2];
export const MIN_MM = 5;
export const MAX_MM = 16;

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "classic", label: "Classic" },
  { id: "hybrid", label: "Hybrid" },
  { id: "volume", label: "Volume" },
  { id: "special", label: "Special" },
];

export const LASH_STYLES = [
  {
    id: "natural",
    name: "Natural",
    category: "classic",
    blurb: "Builds gently to just past the iris, soft classic set",
    map: [7, 9, 10, 11, 10],
    curl: "C",
    thickness: 0.15,
    fan: 1,
    count: 64,
    lean: 0,
    jitter: 0.18,
  },
  {
    id: "cat-eye",
    name: "Cat Eye",
    category: "classic",
    blurb: "Builds to the outer corner for a lifted look",
    map: [8, 9, 10, 12, 13],
    curl: "C",
    thickness: 0.15,
    fan: 1,
    count: 66,
    lean: 0.2,
    jitter: 0.16,
  },
  {
    id: "doll-eye",
    name: "Doll Eye",
    category: "classic",
    blurb: "Longest at the pupil, shorter either side of the iris",
    map: [8, 10, 12, 10, 9],
    curl: "CC",
    thickness: 0.15,
    fan: 1,
    count: 66,
    lean: -0.08,
    jitter: 0.16,
  },
  {
    id: "open-eye",
    name: "Open Eye",
    category: "classic",
    blurb: "Lifts the middle of the eye, softer than doll",
    map: [7, 9, 11, 10, 8],
    curl: "C",
    thickness: 0.15,
    fan: 1,
    count: 66,
    lean: -0.04,
    jitter: 0.16,
  },
  {
    id: "squirrel",
    name: "Squirrel",
    category: "classic",
    blurb: "Short to the iris, peaks where the iris ends, then tapers",
    map: [7, 8, 10, 12, 10],
    curl: "C",
    thickness: 0.15,
    fan: 1,
    count: 66,
    lean: 0.1,
    jitter: 0.16,
  },
  {
    id: "fox-eye",
    name: "Fox Eye",
    category: "special",
    blurb: "Long, swept outer corners for a snatched look",
    map: [7, 8, 9, 12, 14],
    curl: "C",
    thickness: 0.12,
    fan: 1,
    count: 66,
    lean: 0.38,
    jitter: 0.14,
  },
  {
    id: "hybrid",
    name: "Hybrid",
    category: "hybrid",
    blurb: "Classic lashes mixed with light fans",
    map: [7, 9, 10, 11, 11],
    curl: "C",
    thickness: 0.1,
    fan: 3,
    fanEvery: 2,
    spread: 0.2,
    count: 60,
    lean: 0.06,
    jitter: 0.22,
  },
  {
    id: "wispy",
    name: "Wispy",
    category: "hybrid",
    blurb: "Textured fans with longer spikes",
    map: [7, 9, 10, 11, 11],
    curl: "C",
    thickness: 0.07,
    fan: 3,
    spread: 0.24,
    count: 52,
    lean: 0.1,
    jitter: 0.28,
    spikes: { every: 4, boost: 1.3, width: 1.3 },
  },
  {
    id: "volume",
    name: "Volume",
    category: "volume",
    blurb: "Full, soft fans for a dark lash line",
    map: [8, 10, 11, 12, 11],
    curl: "CC",
    thickness: 0.07,
    fan: 5,
    spread: 0.3,
    count: 58,
    lean: 0.06,
    jitter: 0.16,
  },
  {
    id: "mega-volume",
    name: "Mega Volume",
    category: "volume",
    blurb: "Dense, ultra-dark fans for maximum drama",
    map: [9, 11, 12, 13, 12],
    curl: "D",
    thickness: 0.05,
    fan: 8,
    spread: 0.34,
    count: 62,
    lean: 0.06,
    jitter: 0.14,
  },
  {
    id: "wet-look",
    name: "Wet Look",
    category: "special",
    blurb: "Closed fans that look like glossy spikes",
    map: [7, 9, 10, 11, 11],
    curl: "CC",
    thickness: 0.07,
    fan: 4,
    spread: 0.025,
    count: 44,
    lean: 0.08,
    jitter: 0.22,
  },
  {
    id: "anime",
    name: "Anime",
    category: "special",
    blurb: "Defined spikes with soft lashes between",
    map: [8, 10, 11, 12, 12],
    curl: "D",
    thickness: 0.05,
    fan: 2,
    spread: 0.12,
    count: 42,
    lean: 0.08,
    jitter: 0.12,
    spikes: { every: 5, boost: 1.35, width: 3.2 },
  },
  {
    id: "lash-lift",
    name: "Lash Lift",
    category: "special",
    blurb: "Your own lashes, lifted and tinted",
    map: [5, 7, 8, 8.5, 7.5],
    curl: "D",
    thickness: 0.1,
    fan: 1,
    count: 72,
    lean: 0,
    jitter: 0.25,
    darkness: 0.75,
  },
];

export const LASH_COLORS = [
  { id: "black", label: "Black", rgb: "16, 11, 11" },
  { id: "dark-brown", label: "Dark brown", rgb: "45, 28, 20" },
  { id: "brown", label: "Brown", rgb: "82, 52, 34" },
];

export const TIP_COLORS = [
  { id: "none", label: "None", rgb: null },
  { id: "blue", label: "Blue", rgb: "38, 86, 210" },
  { id: "purple", label: "Purple", rgb: "120, 52, 190" },
  { id: "pink", label: "Pink", rgb: "232, 82, 158" },
  { id: "red", label: "Red", rgb: "190, 30, 45" },
  { id: "green", label: "Green", rgb: "26, 150, 96" },
];

// How an accent colour is used: on the tips, mixed in with the base colour, or all over.
export const COLOR_MODES = [
  { id: "tips", label: "Tips" },
  { id: "mix", label: "Mixed" },
  { id: "full", label: "Full" },
];

export const DEFAULT_ADJUSTMENTS = {
  density: 1,
  darkness: 0.9,
  color: "black",
  tip: "none",
  colorMode: "tips",
  lower: false,
  lashLine: true,
};

/**
 * Length (mm) at a point along the lid.
 * t: 0 = inner corner of the eye, 1 = outer corner (past 1 = the lid beyond the corner).
 * anchors: where the 5 mapping points sit along the lid on this eye.
 */
export function lengthAt(map, t, anchors = [0.15, 0.33, 0.5, 0.69, 1]) {
  if (t <= anchors[0]) return map[0];
  if (t >= anchors[4]) return map[4];
  for (let i = 0; i < 4; i++) {
    if (t <= anchors[i + 1]) {
      const f = (t - anchors[i]) / (anchors[i + 1] - anchors[i] || 1);
      // Half straight, half eased: lengths step up evenly like a real map, with soft peaks.
      const s = 0.5 * f + 0.5 * f * f * (3 - 2 * f);
      return map[i] + (map[i + 1] - map[i]) * s;
    }
  }
  return map[4];
}

/** Label for the accent colour, e.g. "Blue tips", "Blue mix", "Blue lashes". */
export function accentText(adj) {
  const tip = TIP_COLORS.find((c) => c.id === adj.tip);
  if (!tip?.rgb) return null;
  if (adj.colorMode === "mix") return `${tip.label} mix`;
  if (adj.colorMode === "full") return `${tip.label} lashes`;
  return `${tip.label} tips`;
}

/** Short text a client can show their lash artist. */
export function specText(style) {
  const kind = style.fan > 1 ? (style.fanEvery > 1 ? `Hybrid ${style.fan}D` : `${style.fan}D volume`) : "Classic";
  return `${style.map.map((m) => +m.toFixed(1)).join("-")} mm · ${style.curl} curl · ${style.thickness.toFixed(2)} mm · ${kind}`;
}
