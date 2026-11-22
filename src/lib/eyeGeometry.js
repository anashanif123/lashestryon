// Turns MediaPipe face points into a smooth upper-eyelid curve for each eye.
// Index numbers are fixed by MediaPipe's 478-point face mesh.

// Listed from the INNER corner to the OUTER corner.
const EYES = {
  // The eye on the left side of the image (the person's right eye).
  imageLeft: {
    upper: [133, 173, 157, 158, 159, 160, 161, 246, 33],
    lower: [133, 155, 154, 153, 145, 144, 163, 7, 33],
    browLower: [55, 65, 52, 53, 46],
  },
  // The eye on the right side of the image (the person's left eye).
  imageRight: {
    upper: [362, 398, 384, 385, 386, 387, 388, 466, 263],
    lower: [362, 382, 381, 380, 374, 373, 390, 249, 263],
    browLower: [285, 295, 282, 283, 276],
  },
};

export const DEBUG_INDICES = [
  ...EYES.imageLeft.upper,
  ...EYES.imageLeft.lower,
  ...EYES.imageRight.upper,
  ...EYES.imageRight.lower,
];

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
const len = (a) => Math.hypot(a.x, a.y);
const norm = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const dot = (a, b) => a.x * b.x + a.y * b.y;

function toPx(landmarks, idx, w, h) {
  return idx.map((i) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
}

// Smooth curve through the points (centripetal-free, uniform Catmull-Rom).
function catmullRom(points, stepsPerSegment = 24) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, n - 1)];
    for (let s = 0; s < stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[n - 1]);
  return out;
}

// Pick `count` points evenly spaced along the curve, between fractions t0 and t1 of its length.
function resample(dense, count, t0, t1) {
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + len(sub(dense[i], dense[i - 1])));
  const total = cum[cum.length - 1] || 1;
  const out = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? (t0 + t1) / 2 : t0 + ((t1 - t0) * k) / (count - 1);
    const target = t * total;
    while (j < cum.length - 1 && cum[j] < target) j++;
    const a = dense[j - 1];
    const b = dense[j];
    const segLen = cum[j] - cum[j - 1] || 1;
    const f = Math.min(Math.max((target - cum[j - 1]) / segLen, 0), 1);
    const p = add(a, mul(sub(b, a), f));
    out.push({ ...p, t, tangent: norm(sub(b, a)) });
  }
  return out;
}

/** Builds eye geometry from pixel points (upper and lower lid, inner corner first). */
export function buildEyeFromPoints(upper, lower) {
  const inner = upper[0];
  const outer = upper[upper.length - 1];
  const width = len(sub(outer, inner));
  const all = [...upper, ...lower];
  const center = all.reduce((acc, p) => add(acc, mul(p, 1 / all.length)), { x: 0, y: 0 });
  const outerDir = norm(sub(outer, inner));

  // How open the eye is (0 = closed). Used to soften lashes on closed eyes.
  const lidGap = len(sub(upper[4], lower[4]));
  const openness = Math.min(Math.max(lidGap / (width * 0.32), 0), 1);

  const lid = catmullRom(upper);

  // Direction that points away from the eye (up, towards the brow).
  const awayFromEye = (p, tangent) => {
    let n = { x: -tangent.y, y: tangent.x };
    if (dot(n, sub(p, center)) < 0) n = mul(n, -1);
    return n;
  };

  const sampleAt = (count, t0 = 0.03, t1 = 0.99) =>
    resample(lid, count, t0, t1).map((s) => ({ ...s, normal: awayFromEye(s, s.tangent) }));

  // "Up" for this eye (towards the brow). getEyes() replaces it with the face's own up.
  let up = { x: -outerDir.y, y: outerDir.x };
  if (dot(up, sub(upper[4], center)) < 0) up = mul(up, -1);

  return { inner, outer, width, center, outerDir, openness, lid, sampleAt, upper, lower, up, browGap: Infinity };
}

/** Returns geometry for both eyes, or null if the points are missing. */
export function getEyes(landmarks, w, h) {
  if (!landmarks || landmarks.length < 468) return null;
  const eyes = [EYES.imageLeft, EYES.imageRight].map((def) => {
    const eye = buildEyeFromPoints(toPx(landmarks, def.upper, w, h), toPx(landmarks, def.lower, w, h));
    // Space between the upper lid and the brow, so long lashes never reach into the brow.
    const brow = toPx(landmarks, def.browLower, w, h);
    eye.browGap = Math.min(...brow.map((b) => Math.min(...eye.upper.slice(2, 7).map((u) => len(sub(b, u))))));
    return eye;
  });
  // Face "up": perpendicular to the line between the two eyes, pointing to the brows.
  const across = norm(sub(eyes[1].center, eyes[0].center));
  let up = { x: across.y, y: -across.x };
  if (dot(up, eyes[0].up) < 0) up = mul(up, -1);
  eyes.forEach((e) => (e.up = up));
  return eyes;
}

/**
 * A drawn, almond-shaped eye for the style thumbnails (no photo needed).
 * `mirror` = true makes the outer corner point left.
 */
export function syntheticEye(cx, cy, width, mirror = false) {
  const half = width / 2;
  const dir = mirror ? -1 : 1;
  const upper = [];
  const lower = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8; // 0 = inner corner, 1 = outer corner
    const x = cx + dir * (t * width - half);
    const lift = Math.sin(Math.PI * Math.pow(t, 0.85));
    upper.push({ x, y: cy - lift * width * 0.3 + t * width * 0.02 });
    lower.push({ x, y: cy + Math.sin(Math.PI * t) * width * 0.16 });
  }
  return buildEyeFromPoints(upper, lower);
}
