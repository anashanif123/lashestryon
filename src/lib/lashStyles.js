// Lash styles are drawn by code, strand by strand, along the eyelid curve.
// No images needed. Each style is just numbers you can tweak.
//
// t runs along the eyelid: 0 = inner corner (near the nose), 1 = outer corner.
// profile(t)  = how long the lashes are at that point (1 = the style's full length)
// baseLength  = full length as a fraction of the eye's width
// thickness   = strand width as a fraction of the eye's width
// lean        = extra sweep towards the outer corner (radians)
// jitter      = how much lengths vary from lash to lash
// fan         = several fine strands from one root (volume lashes)

const bell = (t, center, width) => Math.exp(-(((t - center) / width) ** 2));
const smoothstep = (a, b, t) => {
  const x = Math.min(Math.max((t - a) / (b - a), 0), 1);
  return x * x * (3 - 2 * x);
};

export const LASH_STYLES = [
  {
    id: "natural",
    name: "Natural",
    blurb: "Soft classic set, one extension per lash",
    seed: 11,
    count: 60,
    baseLength: 0.34,
    profile: (t) => 0.6 + 0.4 * bell(t, 0.7, 0.4),
    thickness: 0.011,
    curl: 0.8,
    lean: 0,
    jitter: 0.22,
    fan: null,
  },
  {
    id: "cat-eye",
    name: "Cat Eye",
    blurb: "Longest at the outer corner for a lifted look",
    seed: 23,
    count: 64,
    baseLength: 0.38,
    profile: (t) => 0.4 + 0.8 * smoothstep(0.15, 0.95, t),
    thickness: 0.011,
    curl: 0.7,
    lean: 0.22,
    jitter: 0.2,
    fan: null,
  },
  {
    id: "doll-eye",
    name: "Doll Eye",
    blurb: "Longest in the centre to open up the eye",
    seed: 37,
    count: 64,
    baseLength: 0.38,
    profile: (t) => 0.55 + 0.5 * bell(t, 0.5, 0.3),
    thickness: 0.011,
    curl: 1.1,
    lean: -0.08,
    jitter: 0.2,
    fan: null,
  },
  {
    id: "hybrid",
    name: "Hybrid",
    blurb: "Classic lashes mixed with light fans",
    seed: 41,
    count: 58,
    baseLength: 0.36,
    profile: (t) => 0.55 + 0.45 * bell(t, 0.7, 0.4),
    thickness: 0.009,
    curl: 0.9,
    lean: 0.06,
    jitter: 0.24,
    fan: { strands: 3, spread: 0.2, every: 2 },
    fanAlpha: 0.7,
  },
  {
    id: "volume",
    name: "Volume",
    blurb: "Full, dark fans for a dramatic finish",
    seed: 53,
    count: 60,
    baseLength: 0.37,
    profile: (t) => 0.55 + 0.45 * bell(t, 0.68, 0.4),
    thickness: 0.0078,
    curl: 1,
    lean: 0.06,
    jitter: 0.18,
    fan: { strands: 5, spread: 0.3, every: 1 },
    fanAlpha: 0.85,
  },
  {
    id: "wispy",
    name: "Wispy",
    blurb: "Textured fans with longer spikes",
    seed: 67,
    count: 50,
    baseLength: 0.34,
    profile: (t) => 0.55 + 0.45 * bell(t, 0.7, 0.4),
    thickness: 0.007,
    curl: 1,
    lean: 0.1,
    jitter: 0.3,
    fan: { strands: 3, spread: 0.24, every: 1 },
    fanAlpha: 0.68,
    spikes: { every: 4, boost: 1.35, width: 1.3 },
  },
];

export const DEFAULT_ADJUSTMENTS = {
  length: 1,
  curl: 1,
  density: 1,
  darkness: 0.9,
  thickness: 1,
  lashLine: true,
};
