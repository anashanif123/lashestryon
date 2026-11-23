// Turns MediaPipe face points into smooth eyelid curves for each eye,
// plus a real-world scale (pixels per millimetre) taken from the iris.
// Index numbers are fixed by MediaPipe's 478-point face mesh.

// Average human iris diameter. Varies only ~±0.5 mm between adults,
// which makes it a good ruler for converting lash lengths in mm to pixels.
export const IRIS_DIAMETER_MM = 11.7;
// Fallback when the iris isn't found: average eye opening width.
const EYE_WIDTH_MM = 28;

// Where the lash set starts, as a fraction of the upper lid from the inner corner.
// Lash artists leave the inner corner largely alone, so the set starts a little way in.
export const LASH_START = 0.15;
// The lash line carries on past the outer corner of the white of the eye (the lid
// continues there), by about this fraction of the eye width.
const OUTER_EXTENSION = 0.1;
// Lash map points when the iris can't be measured (e.g. drawn thumbnails):
// inner corner, iris start, pupil, iris end, outer corner.
export const DEFAULT_ANCHORS = [LASH_START, 0.33, 0.5, 0.69, 1];

// Lids listed from the INNER corner to the OUTER corner.
const EYES = {
  // The eye on the left side of the image (the person's right eye).
  imageLeft: {
    upper: [133, 173, 157, 158, 159, 160, 161, 246, 33],
    lower: [133, 155, 154, 153, 145, 144, 163, 7, 33],
    browLower: [55, 65, 52, 53, 46],
    browUpper: [70, 63, 105, 66, 107],
    iris: [469, 470, 471, 472], // right, top, left, bottom edge of the iris
    irisCenter: 468,
  },
  // The eye on the right side of the image (the person's left eye).
  imageRight: {
    upper: [362, 398, 384, 385, 386, 387, 388, 466, 263],
    lower: [362, 382, 381, 380, 374, 373, 390, 249, 263],
    browLower: [285, 295, 282, 283, 276],
    browUpper: [300, 293, 334, 296, 336],
    iris: [474, 475, 476, 477],
    irisCenter: 473,
  },
};

export const DEBUG_INDICES = [
  ...EYES.imageLeft.upper,
  ...EYES.imageLeft.lower,
  ...EYES.imageRight.upper,
  ...EYES.imageRight.lower,
  ...EYES.imageLeft.iris,
  ...EYES.imageRight.iris,
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

// Smooth curve through the points (uniform Catmull-Rom).
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

// Cumulative length along a polyline.
function cumulative(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + len(sub(points[i], points[i - 1])));
  return cum;
}

// Pick `count` points evenly spaced along the curve, from t0 to t1, where t is measured
// as a fraction of `unit` (the lid's own length). t > 1 runs on into the extension.
function resample(dense, cum, unit, count, t0, t1) {
  const total = cum[cum.length - 1] || 1;
  const out = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? (t0 + t1) / 2 : t0 + ((t1 - t0) * k) / (count - 1);
    const target = Math.min(t * unit, total);
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
  const lowerLid = catmullRom(lower);

  // "Up" for this eye (towards the brow). getEyes() replaces it with the face's own up.
  let up = { x: -outerDir.y, y: outerDir.x };
  if (dot(up, sub(upper[4], center)) < 0) up = mul(up, -1);

  // Carry the lash line on past the outer corner: the lid continues beyond the white of
  // the eye, and so do the lashes. Heads outwards, between the lid's own direction at the
  // corner and the line across the eye, rising very slightly.
  const endTangent = norm(sub(lid[lid.length - 1], lid[lid.length - 4]));
  const extDir = norm(add(add(mul(endTangent, 0.4), mul(outerDir, 0.6)), mul(up, 0.08)));
  const extLen = width * OUTER_EXTENSION;
  const lidExt = [...lid];
  for (let i = 1; i <= 8; i++) lidExt.push(add(outer, mul(extDir, (extLen * i) / 8)));
  const lidCum = cumulative(lidExt);
  const lidLength = lidCum[lid.length - 1];
  const extT = extLen / lidLength; // the extension, in lid-length units
  const lowerCum = cumulative(lowerLid);
  const lowerLength = lowerCum[lowerCum.length - 1];

  // Direction that points away from the eye (up for the upper lid, down for the lower lid).
  const awayFromEye = (p, tangent) => {
    let n = { x: -tangent.y, y: tangent.x };
    if (dot(n, sub(p, center)) < 0) n = mul(n, -1);
    return n;
  };

  const sampleAt = (count, t0 = LASH_START, t1 = 1 + extT) =>
    resample(lidExt, lidCum, lidLength, count, t0, t1).map((s) => ({ ...s, normal: awayFromEye(s, s.tangent) }));
  const sampleLowerAt = (count, t0 = 0.12, t1 = 0.96) =>
    resample(lowerLid, lowerCum, lowerLength, count, t0, t1).map((s) => ({ ...s, normal: awayFromEye(s, s.tangent) }));

  // t along the lid (fraction of its length) where the lid is above a point that is
  // `u` of the way across the eye (0 = inner corner, 1 = outer corner).
  const tAcross = (u) => {
    const target = u * width;
    let prev = 0;
    for (let i = 1; i < lid.length; i++) {
      const d = dot(sub(lid[i], inner), outerDir);
      if (d >= target) {
        const f = (target - prev) / (d - prev || 1);
        return (lidCum[i - 1] + (lidCum[i] - lidCum[i - 1]) * Math.min(Math.max(f, 0), 1)) / lidLength;
      }
      prev = d;
    }
    return 1;
  };

  return {
    inner,
    outer,
    width,
    center,
    outerDir,
    openness,
    lid,
    lidExt,
    lowerLid,
    extT,
    sampleAt,
    sampleLowerAt,
    tAcross,
    upper,
    lower,
    up,
    browGap: Infinity,
    pxPerMm: width / EYE_WIDTH_MM,
    scaleSource: "eye-width",
    // Lash map points along the lid: inner corner, iris start, pupil, iris end, outer corner.
    anchors: DEFAULT_ANCHORS,
    anchorSource: "default",
  };
}

/** Returns geometry for both eyes, or null if the points are missing. */
export function getEyes(landmarks, w, h) {
  if (!landmarks || landmarks.length < 468) return null;
  const defs = [EYES.imageLeft, EYES.imageRight];
  const eyes = defs.map((def) => {
    const eye = buildEyeFromPoints(toPx(landmarks, def.upper, w, h), toPx(landmarks, def.lower, w, h));
    // Space between the upper lid and the brow, so long lashes never reach into the brow.
    const brow = toPx(landmarks, def.browLower, w, h);
    eye.browGap = Math.min(...brow.map((b) => Math.min(...eye.upper.slice(2, 7).map((u) => len(sub(b, u))))));
    return eye;
  });

  // Real-world scale from the iris (both eyes averaged for stability).
  if (landmarks.length >= 478) {
    const diameters = defs.map((def) => {
      const [r, t, l, b] = toPx(landmarks, def.iris, w, h);
      return (len(sub(r, l)) + len(sub(t, b))) / 2;
    });
    const irisPx = (diameters[0] + diameters[1]) / 2;
    const fallback = (eyes[0].pxPerMm + eyes[1].pxPerMm) / 2;
    const fromIris = irisPx / IRIS_DIAMETER_MM;
    // Ignore a clearly wrong reading (e.g. eyes nearly closed).
    if (fromIris > fallback * 0.6 && fromIris < fallback * 1.6) {
      eyes.forEach((e) => {
        e.pxPerMm = fromIris;
        e.scaleSource = "iris";
      });
    }
  }

  // Lash mapping points from the iris, the way lash artists map: where the iris starts,
  // where the pupil is, and where the iris ends.
  if (landmarks.length >= 478) {
    defs.forEach((def, k) => {
      const eye = eyes[k];
      const [c] = toPx(landmarks, [def.irisCenter], w, h);
      const [r, , l] = toPx(landmarks, def.iris, w, h);
      // Across-the-eye position of the pupil. Kept near the middle in case the person
      // is looking sideways: mapping is done for eyes looking straight ahead.
      const uc = Math.min(Math.max(dot(sub(c, eye.inner), eye.outerDir) / eye.width, 0.4), 0.62);
      const measured = Math.abs(dot(sub(r, l), eye.outerDir)) / 2;
      const fromScale = (IRIS_DIAMETER_MM / 2) * eye.pxPerMm;
      const radius = (measured > fromScale * 0.7 && measured < fromScale * 1.3 ? measured : fromScale) / eye.width;
      const uIn = Math.max(uc - radius, LASH_START + 0.08);
      const uOut = Math.min(uc + radius, 0.86);
      eye.anchors = [LASH_START, eye.tAcross(uIn), eye.tAcross(uc), eye.tAcross(uOut), 1];
      eye.anchorSource = "iris";
      eye.irisRadiusPx = radius * eye.width;
    });
  }

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
