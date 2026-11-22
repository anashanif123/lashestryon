// Reads the eye shape from the face points and suggests lash styles.
// These are the same rules of thumb lash artists use; it's a suggestion, not a diagnosis.

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a) => Math.hypot(a.x, a.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;

const P = (lm, i, w, h) => ({ x: lm[i].x * w, y: lm[i].y * h });

// inner corner, outer corner, top of upper lid, bottom of lower lid
const EYE_POINTS = [
  { inner: 133, outer: 33, top: 159, bottom: 145 },
  { inner: 362, outer: 263, top: 386, bottom: 374 },
];

export function analyseEyes(landmarks, w, h) {
  if (!landmarks) return null;
  const eyes = EYE_POINTS.map((e) => {
    const inner = P(landmarks, e.inner, w, h);
    const outer = P(landmarks, e.outer, w, h);
    const top = P(landmarks, e.top, w, h);
    const bottom = P(landmarks, e.bottom, w, h);
    return { inner, outer, width: len(sub(outer, inner)), height: len(sub(top, bottom)) };
  });

  // Face directions from the line between the two eyes
  const mid = (e) => ({ x: (e.inner.x + e.outer.x) / 2, y: (e.inner.y + e.outer.y) / 2 });
  const across = sub(mid(eyes[1]), mid(eyes[0]));
  const acrossLen = len(across) || 1;
  const right = { x: across.x / acrossLen, y: across.y / acrossLen };
  const up = { x: right.y, y: -right.x }; // points towards the forehead in image space

  // Tilt: is the outer corner higher than the inner corner?
  const tilts = eyes.map((e) => {
    const v = sub(e.outer, e.inner);
    return (Math.asin(Math.max(-1, Math.min(1, dot(v, up) / (len(v) || 1)))) * 180) / Math.PI;
  });
  const tilt = (tilts[0] + tilts[1]) / 2;

  const width = (eyes[0].width + eyes[1].width) / 2;
  const openness = (eyes[0].height / eyes[0].width + eyes[1].height / eyes[1].width) / 2;
  const innerGap = len(sub(eyes[1].inner, eyes[0].inner)) / width;

  // Thresholds are tuned to MediaPipe's points: most faces measure about 5–8° tilt,
  // 0.30–0.36 openness and 1.1–1.25 inner gap.
  const tiltLabel = tilt > 9.5 ? "upturned" : tilt < 3 ? "downturned" : "straight";
  const shapeLabel = openness > 0.4 ? "round" : "almond";
  const spacingLabel = innerGap < 1.02 ? "close-set" : innerGap > 1.34 ? "wide-set" : "balanced";

  // Score each style using common lash-artist guidance.
  const score = { natural: 1, "cat-eye": 1, "doll-eye": 1, hybrid: 1, volume: 0.5, wispy: 0.8 };
  const add = (ids, v) => ids.forEach((id) => (score[id] += v));
  if (shapeLabel === "round") add(["cat-eye", "wispy"], 2); // elongate round eyes
  if (shapeLabel === "almond") add(["cat-eye", "natural", "hybrid"], 1.2); // almond suits most
  if (tiltLabel === "downturned") add(["doll-eye", "natural"], 2.2); // lift the centre, avoid pulling down
  if (tiltLabel === "downturned") add(["cat-eye"], -1.5);
  if (tiltLabel === "upturned") add(["doll-eye", "hybrid"], 1.5);
  if (spacingLabel === "close-set") add(["cat-eye"], 1.5); // weight to the outer corners
  if (spacingLabel === "wide-set") add(["doll-eye", "volume"], 1.5);

  const recommended = Object.entries(score)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => id);

  return {
    shape: shapeLabel,
    tilt: tiltLabel,
    spacing: spacingLabel,
    recommended,
    metrics: { tilt: +tilt.toFixed(1), openness: +openness.toFixed(2), innerGap: +innerGap.toFixed(2) },
  };
}
