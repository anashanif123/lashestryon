// Draws lashes on a canvas along the eyelids, in real millimetres.
//
// Realism notes:
// - Lengths come from the style's lash map (mm) and the face's own scale (from the iris).
// - In a front-facing photo lashes point partly towards the camera, so they look shorter
//   than they are (PROJECTION).
// - Lengths follow the lash map at the client's own mapping points (inner corner, iris
//   start, pupil, iris end, outer corner), found from the iris.
// - The inner corner is left largely alone; the set carries on past the outer corner of
//   the white of the eye, along the lid, and tapers there.
// - Each lash leaves the lid and curls up towards the brows along an arc (J to D curl),
//   sweeping outwards near the outer corner. No two strands are identical.
// - Strands taper and fade to the tip, and are softened to match the photo.

import { DEBUG_INDICES, LASH_START } from "./eyeGeometry.js";
import { LASH_COLORS, TIP_COLORS, curlTurns, lengthAt } from "./lashStyles.js";

const PROJECTION = 0.8; // used for the mapping guide's line lengths (a C curl seen from the front)
// A natural upper lash leaves the lid pointing forward (towards the camera) and a little
// up. The extension follows it, then curls up by its curl angle.
const BASE_ELEVATION = 0.42; // radians above "straight at the camera" (~24°)
const VISUAL_WIDTH = 2.2; // a 0.15 mm lash reads wider than 0.15 mm in a photo (blur, shadow)

// Same number in, same number out, so lashes don't flicker between camera frames.
const rand = (n) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
const norm = (v) => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};
const rotate = (v, a) => ({
  x: v.x * Math.cos(a) - v.y * Math.sin(a),
  y: v.x * Math.sin(a) + v.y * Math.cos(a),
});

// Turn `v` part of the way (k = 0…1) towards `target`, along the shorter way round.
function turnTowards(v, target, k) {
  const a = Math.atan2(v.y, v.x);
  let d = Math.atan2(target.y, target.x) - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const b = a + d * k;
  return { x: Math.cos(b), y: Math.sin(b) };
}

/**
 * Centre line of one curled lash, root to tip.
 * It leaves the lid a little more outwards than `dir`, then bends up towards `up`
 * along a smooth arc: the more curl, the more it bends. Near the root the lash points
 * partly at the camera, so that part looks shorter (foreshortening).
 */
function lashPath(root, dir, up, length, curl, steps = 12) {
  const start = turnTowards(dir, up, -0.25 * curl);
  const pts = [root];
  let p = root;
  // Visible speed along the lash: slower near the root (pointing at the camera).
  const speeds = [];
  let total = 0;
  for (let i = 0; i < steps; i++) {
    const s = (i + 0.5) / steps;
    const v = 0.62 + 0.38 * Math.min(1, s * 1.6);
    speeds.push(v);
    total += v;
  }
  for (let i = 0; i < steps; i++) {
    const s = (i + 0.5) / steps;
    // The bend builds along the lash (the root stays straight where it is bonded).
    const bend = Math.pow(Math.max(0, (s - 0.12) / 0.88), 1.15);
    const d = turnTowards(start, up, curl * bend);
    const step = (length * speeds[i]) / total;
    p = { x: p.x + d.x * step, y: p.y + d.y * step };
    pts.push(p);
  }
  return pts;
}

/**
 * A curled lash in 3D, seen from the front.
 * The lash starts pointing forward (at the camera) and slightly up, angled `yaw` towards
 * `side` (outwards at the outer corner, towards the nose at the inner corner). Along its
 * length it turns up by the curl's own profile (`turns`). Only the up and sideways parts
 * show in a front-facing photo, which is what gives each curl its real shape: J lashes
 * point at the camera and look short and straight, D lashes rise and look longer, and the
 * outer lashes sweep out sideways and then lift.
 */
function lashPath3D(root, up, side, yaw, elevation, length, turns) {
  const steps = turns.length;
  const ds = length / steps;
  const sy = Math.sin(yaw);
  const pts = [root];
  let p = root;
  for (let i = 0; i < steps; i++) {
    const phi = elevation + turns[i] - (turns[i] - (i ? turns[i - 1] : 0)) / 2;
    // Past straight up, a tip curls back over itself; seen from the front it only stops
    // moving sideways rather than hooking back.
    const lateral = sy * Math.cos(Math.min(phi, Math.PI / 2 + 0.05));
    const rise = Math.sin(phi);
    p = { x: p.x + (side.x * lateral + up.x * rise) * ds, y: p.y + (side.y * lateral + up.y * rise) * ds };
    pts.push(p);
  }
  return pts;
}

// One lash: a strand along `pts` that gets thinner and lighter towards the tip.
// paint: "base" (plain), "tip" (accent at the tip), "full" (accent along the lash).
function drawStrand(ctx, pts, width, alpha, colors, paint = "base") {
  const n = pts.length - 1;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dl = Math.hypot(dx, dy) || 1;
    const half = (width / 2) * Math.pow(1 - i / n, 1.2) + 0.12;
    left.push({ x: pts[i].x - (dy / dl) * half, y: pts[i].y + (dx / dl) * half });
    right.push({ x: pts[i].x + (dy / dl) * half, y: pts[i].y - (dx / dl) * half });
  }
  const root = pts[0];
  const tip = pts[n];
  const g = ctx.createLinearGradient(root.x, root.y, tip.x, tip.y);
  g.addColorStop(0, `rgba(${colors.base}, ${alpha})`);
  if (paint === "tip" && colors.tip) {
    // Coloured along the outer half, so the colour shows on the photo.
    g.addColorStop(0.42, `rgba(${colors.base}, ${alpha * 0.92})`);
    g.addColorStop(0.72, `rgba(${colors.tip}, ${alpha * 0.9})`);
    g.addColorStop(1, `rgba(${colors.tip}, ${alpha * 0.55})`);
  } else if (paint === "full" && colors.tip) {
    // A coloured extension on a dark natural lash: dark only right at the root.
    g.addColorStop(0.18, `rgba(${colors.tip}, ${alpha * 0.85})`);
    g.addColorStop(0.7, `rgba(${colors.tip}, ${alpha * 0.85})`);
    g.addColorStop(1, `rgba(${colors.tip}, ${alpha * 0.45})`);
  } else {
    g.addColorStop(0.65, `rgba(${colors.base}, ${alpha * 0.85})`);
    g.addColorStop(1, `rgba(${colors.base}, ${alpha * 0.35})`);
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}

// Which paint a strand gets for the chosen accent colour mode.
function paintFor(colors, seed) {
  if (!colors.tip) return "base";
  if (colors.mode === "full") return "full";
  if (colors.mode === "mix") return rand(seed * 1.37 + 5) < 0.5 ? "full" : "base";
  return "tip";
}

function drawUpper(ctx, eye, eyeIndex, style, adj, pxScale, colors) {
  const mm = eye.pxPerMm;
  // Eye width in the PHOTO's own pixels. A small or low-quality face can't show fine
  // detail even when zoomed in, so we draw fewer, softer strands for it.
  const wImg = eye.width;
  const anchors = eye.anchors;
  const tEnd = 1 + eye.extT * 0.9;

  const maxByResolution = Math.max(14, Math.round(wImg * 0.9));
  const count = clamp(Math.round(style.count * adj.density), 10, maxByResolution);
  const lowRes = wImg < 70;
  const samples = eye.sampleAt(count, LASH_START, tEnd);

  const closedFactor = 0.7 + 0.3 * eye.openness;
  const darkness = clamp(adj.darkness * (style.darkness ?? 1), 0.2, 1);
  const minWidth = Math.max(0.55 / pxScale, lowRes ? 0.5 : 0);
  const up = eye.up;
  const o = eye.outerDir;
  const spacing = (eye.width * (tEnd - LASH_START)) / count;
  const turns = curlTurns(style.curl);
  const fanSize = Math.max(1, style.fan || 1);
  const fanEvery = style.fanEvery || 1;
  const spread = style.spread ?? 0.26;
  // Fewer strands per fan on tiny faces; each strand lighter when there are many.
  const strandAlpha = (n) => clamp(0.95 / Math.sqrt(n) + 0.25, 0.4, 0.92);
  const maxLength = eye.browGap * 0.95;

  samples.forEach((sample, i) => {
    const seed = i * 7.31 + eyeIndex * 1000 + style.id.length * 17;
    const r1 = rand(seed);
    const r2 = rand(seed + 0.5);
    const r3 = rand(seed + 0.9);
    const t = sample.t;

    // Inner corner: the set starts short and fine, and builds towards the iris.
    const innerRamp = smoothstep(anchors[0], anchors[1], t);
    const innerTaper = 0.78 + 0.22 * smoothstep(anchors[0], anchors[0] + 0.07, t);
    // Past the outer corner the last lashes taper off along the lid.
    const outerTaper = 1 - 0.22 * smoothstep(1, tEnd, t);
    let length = lengthAt(style.map, t, anchors) * mm * innerTaper * outerTaper * closedFactor;
    length *= 1 + (r1 - 0.5) * style.jitter;
    const spike = style.spikes && i % style.spikes.every === 0 && t > anchors[1] * 0.9;
    if (spike) length *= style.spikes.boost;

    // Start direction: between "straight off the lid" and "towards the brows".
    const n = sample.normal;
    const d0 = norm({ x: n.x * 0.7 + up.x * 0.3, y: n.y * 0.7 + up.y * 0.3 });
    // Fan out from the pupil: lashes lean to the nose before it and sweep outwards after it,
    // more so towards the outer corner and beyond it.
    const sign = d0.x * o.y - d0.y * o.x > 0 ? 1 : -1;
    const fromPupil = t - anchors[2];
    const sweep = fromPupil * 0.55 + 0.15 * smoothstep(0.85, tEnd, t) + (style.lean || 0) * smoothstep(anchors[1], 1, t);

    // Inner lashes are finer and fans smaller there.
    const fanHere = fanSize > 1 && i % fanEvery === 0 && !spike;
    let strands = fanHere ? Math.max(1, Math.round(fanSize * (0.5 + 0.5 * innerRamp))) : 1;
    if (lowRes) strands = Math.min(strands, 3);
    const widthFactor = (spike ? style.spikes.width ?? 1.5 : fanHere ? 0.85 : 1) * (0.7 + 0.3 * innerRamp);
    const width = Math.max(minWidth, style.thickness * VISUAL_WIDTH * mm * widthFactor);
    const alpha = darkness * (strands > 1 ? strandAlpha(strands) : 0.92) * (0.8 + 0.2 * innerRamp);

    // Roots spread a little along the lid, not on a perfect grid.
    const rootShift = (r3 - 0.5) * spacing * 0.6;
    const root = {
      x: sample.x + sample.tangent.x * rootShift + n.x * mm * 0.15,
      y: sample.y + sample.tangent.y * rootShift + n.y * mm * 0.15,
    };

    for (let s = 0; s < strands; s++) {
      const r4 = rand(seed + s * 3.7 + 1);
      const open = strands === 1 ? 0 : (s / (strands - 1) - 0.5) * spread;
      const angle = (sweep + open + (r2 - 0.5) * 0.2 + (r4 - 0.5) * 0.07) * sign;
      const d = rotate(d0, angle);
      let L = length * (strands === 1 ? 1 : 0.86 + 0.14 * r4);
      // Fan direction in the photo → how far the lash points sideways in 3D.
      const along = d.x * up.x + d.y * up.y;
      const lat = { x: d.x - up.x * along, y: d.y - up.y * along };
      const latLen = Math.hypot(lat.x, lat.y);
      const side = latLen > 1e-6 ? { x: lat.x / latLen, y: lat.y / latLen } : { x: up.y, y: -up.x };
      const yaw = clamp(Math.atan2(latLen, along) * 1.15, 0, 1.4);
      const elevation = BASE_ELEVATION + (r4 - 0.5) * 0.12;
      let pts = lashPath3D(root, up, side, yaw, elevation, L, turns);
      // Keep tips below the brow: squeeze anything that would reach into the lid-to-brow gap.
      const rise = Math.max(...pts.map((q) => (q.x - root.x) * up.x + (q.y - root.y) * up.y));
      if (rise > maxLength * 0.8) {
        const target = maxLength * (0.8 + 0.2 * Math.tanh((rise / maxLength - 0.8) / 0.2));
        L *= target / rise;
        pts = lashPath3D(root, up, side, yaw, elevation, L, turns);
      }
      drawStrand(ctx, pts, width, alpha, colors, paintFor(colors, seed + s * 11));
    }
  });

  // A thin lash band along the lid hides the roots, like real lash glue.
  if (adj.lashLine) {
    const line = eye.sampleAt(40, LASH_START - 0.01, 1 + eye.extT * 0.35);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x, line[i].y);
    ctx.strokeStyle = `rgba(${colors.base}, ${0.4 * darkness})`;
    ctx.lineWidth = Math.max(minWidth * 1.5, 0.45 * mm);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${colors.base}, ${0.7 * darkness})`;
    ctx.lineWidth = Math.max(minWidth, 0.2 * mm);
    ctx.stroke();
    ctx.restore();
  }
}

// Bottom lashes: short, fine and sparse, pointing down and slightly out.
function drawLower(ctx, eye, eyeIndex, adj, pxScale, colors) {
  const mm = eye.pxPerMm;
  const count = clamp(Math.round(26 * adj.density), 8, Math.max(8, Math.round(eye.width * 0.4)));
  const samples = eye.sampleLowerAt(count);
  const down = { x: -eye.up.x, y: -eye.up.y };
  const o = eye.outerDir;
  const darkness = clamp(adj.darkness, 0.2, 1);
  const minWidth = 0.5 / pxScale;

  samples.forEach((sample, i) => {
    const seed = i * 5.17 + eyeIndex * 500 + 99;
    const r1 = rand(seed);
    const r2 = rand(seed + 0.3);
    const t = sample.t;
    const length = (3.2 + 2.2 * smoothstep(0.1, 0.85, t)) * mm * 0.8 * (0.8 + 0.4 * r1);
    const n = sample.normal;
    const d0 = norm({ x: n.x * 0.75 + down.x * 0.25, y: n.y * 0.75 + down.y * 0.25 });
    const sign = d0.x * o.y - d0.y * o.x > 0 ? 1 : -1;
    const d = rotate(d0, ((t - 0.35) * 0.6 + (r2 - 0.5) * 0.15) * sign);
    const root = { x: sample.x + n.x * mm * 0.1, y: sample.y + n.y * mm * 0.1 };
    const pts = lashPath(root, d, down, length, 0.12, 6);
    drawStrand(ctx, pts, Math.max(minWidth, 0.07 * VISUAL_WIDTH * mm), 0.62 * darkness, colors, "base");
  });
}

let layer = null;
function getLayer(width, height) {
  if (!layer) layer = document.createElement("canvas");
  if (layer.width !== width || layer.height !== height) {
    layer.width = width;
    layer.height = height;
  }
  return layer;
}

/** Draws lashes for both eyes, respecting the current transform and clip of ctx. */
export function drawLashes(ctx, eyes, style, adjustments) {
  if (!eyes?.length) return;
  const m = ctx.getTransform();
  const pxScale = Math.hypot(m.a, m.b) || 1;
  const colors = {
    base: (LASH_COLORS.find((c) => c.id === adjustments.color) ?? LASH_COLORS[0]).rgb,
    tip: TIP_COLORS.find((c) => c.id === adjustments.tip)?.rgb ?? null,
    mode: adjustments.colorMode || "tips",
  };

  const target = getLayer(ctx.canvas.width, ctx.canvas.height);
  const lctx = target.getContext("2d");
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, target.width, target.height);
  lctx.setTransform(m);
  eyes.forEach((eye, i) => {
    if (adjustments.lower) drawLower(lctx, eye, i, adjustments, pxScale, colors);
    drawUpper(lctx, eye, i, style, adjustments, pxScale, colors);
  });

  // Soften to match the photo. When a photo is shown bigger than its real size it looks
  // soft, so the lashes get the same softness (about half a photo pixel).
  // Browsers without canvas filters just skip this.
  const eyePx = Math.max(...eyes.map((e) => e.width)) * pxScale;
  const blur = clamp(Math.max(eyePx / 800, pxScale * 0.32), 0.2, 2.5);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if ("filter" in ctx) ctx.filter = `blur(${blur.toFixed(2)}px)`;
  ctx.drawImage(target, 0, 0);
  ctx.restore();
}

/** Small dots on the eye points: helpful while you tune the code. */
export function drawDebugPoints(ctx, landmarks, w, h) {
  if (!landmarks) return;
  ctx.save();
  ctx.fillStyle = "#00e0ff";
  for (const i of DEBUG_INDICES) {
    if (!landmarks[i]) continue;
    ctx.beginPath();
    ctx.arc(landmarks[i].x * w, landmarks[i].y * h, Math.max(2, w / 500), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Lash-mapping guide, like a lash artist's mapping sketch: a line at each mapping point
 * (inner corner, iris start, pupil, iris end, outer corner) with its length in mm.
 * The three iris points are numbered 1–3 in the order artists use (iris start, pupil, iris end).
 */
export function drawMapGuide(ctx, eyes, style) {
  if (!eyes?.length) return;
  const m = ctx.getTransform();
  const pxScale = Math.hypot(m.a, m.b) || 1;
  const px = (v) => v / pxScale; // canvas pixels → drawing units
  const unit = Math.max(ctx.canvas.width, ctx.canvas.height) / 100;
  const font = px(Math.max(11, unit * 1.5));
  ctx.save();
  eyes.forEach((eye) => {
    const mm = eye.pxPerMm;
    const pts = eye.sampleAt(5, 0, 1).map((_, i) => eye.sampleAt(1, eye.anchors[i], eye.anchors[i])[0]);
    pts.forEach((p, i) => {
      const iris = i >= 1 && i <= 3;
      const len = lengthAt(style.map, eye.anchors[i], eye.anchors) * mm * PROJECTION;
      const a = { x: p.x - eye.up.x * mm * 1.2, y: p.y - eye.up.y * mm * 1.2 };
      const b = { x: p.x + eye.up.x * (len + mm * 1.5), y: p.y + eye.up.y * (len + mm * 1.5) };
      ctx.strokeStyle = iris ? (i === 2 ? "rgba(124, 92, 255, 0.95)" : "rgba(236, 72, 153, 0.95)") : "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = px(Math.max(1.5, unit * 0.18));
      ctx.setLineDash(iris ? [] : [px(4), px(3)]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      // Label: mm value in a small pill above the line.
      const text = `${+style.map[i].toFixed(1)}`;
      ctx.setLineDash([]);
      ctx.font = `700 ${font}px Manrope, Arial, sans-serif`;
      const tw = ctx.measureText(text).width;
      const r = font * 0.75;
      const cx = b.x + eye.up.x * r;
      const cy = b.y + eye.up.y * r;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - tw / 2 - r * 0.6, cy - r, tw + r * 1.2, r * 2, r);
      else ctx.rect(cx - tw / 2 - r * 0.6, cy - r, tw + r * 1.2, r * 2);
      ctx.fill();
      ctx.fillStyle = iris ? "#fff" : "#2a1a24";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, cx, cy + font * 0.04);
    });
  });
  ctx.restore();
}
