// Draws lashes on a canvas along each upper eyelid.
//
// Realism notes:
// - In a front-facing photo real lashes rise from the lid and curl UP (towards the brows),
//   sweeping outwards near the outer corner and staying short near the inner corner.
// - Each strand tapers and fades towards the tip, and no two lashes are identical.
// - Lashes are drawn on a separate layer, then softened slightly so they match the
//   photo's sharpness instead of looking like crisp vector lines.

import { DEBUG_INDICES } from "./eyeGeometry.js";

// Same number in, same number out, so lashes do not flicker between camera frames.
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

const LASH_RGB = "16, 11, 11";

// One lash: a curved strand from root to tip that gets thinner and lighter.
function drawStrand(ctx, root, control, tip, width, alpha) {
  const steps = 10;
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const a = (1 - s) * (1 - s);
    const b = 2 * (1 - s) * s;
    const c = s * s;
    const px = a * root.x + b * control.x + c * tip.x;
    const py = a * root.y + b * control.y + c * tip.y;
    const dx = 2 * (1 - s) * (control.x - root.x) + 2 * s * (tip.x - control.x);
    const dy = 2 * (1 - s) * (control.y - root.y) + 2 * s * (tip.y - control.y);
    const dl = Math.hypot(dx, dy) || 1;
    const half = (width / 2) * Math.pow(1 - s, 1.25) + 0.12;
    left.push({ x: px - (dy / dl) * half, y: py + (dx / dl) * half });
    right.push({ x: px + (dy / dl) * half, y: py - (dx / dl) * half });
  }
  const g = ctx.createLinearGradient(root.x, root.y, tip.x, tip.y);
  g.addColorStop(0, `rgba(${LASH_RGB}, ${alpha})`);
  g.addColorStop(0.65, `rgba(${LASH_RGB}, ${alpha * 0.85})`);
  g.addColorStop(1, `rgba(${LASH_RGB}, ${alpha * 0.35})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}

function drawEye(ctx, eye, eyeIndex, style, adj, pxScale) {
  const w = eye.width;
  const wPx = w * pxScale; // eye width in real screen pixels

  // Small eyes in the photo: fewer, finer strands so they don't merge into a blob.
  const maxByResolution = Math.max(10, Math.round(wPx * 0.55));
  const count = clamp(Math.round(style.count * adj.density), 10, maxByResolution);
  const lowRes = wPx < 90;
  const samples = eye.sampleAt(count, 0.05, 0.985);

  const closedFactor = 0.7 + 0.3 * eye.openness;
  const darkness = clamp(adj.darkness, 0.2, 1);
  const minWidth = 0.55 / pxScale;
  const up = eye.up;
  const o = eye.outerDir;
  const spacing = w / count;

  samples.forEach((sample, i) => {
    const seed = i * 7.31 + eyeIndex * 1000 + style.seed;
    const r1 = rand(seed);
    const r2 = rand(seed + 0.5);
    const r3 = rand(seed + 0.9);
    const t = sample.t;

    // Short at the inner corner, full along the middle and outer part.
    const innerTaper = 0.35 + 0.65 * smoothstep(0.02, 0.3, t);
    let length = w * style.baseLength * style.profile(t) * innerTaper * adj.length * closedFactor;
    length *= 1 + (r1 - 0.5) * style.jitter;
    const spike = style.spikes && i % style.spikes.every === 0;
    if (spike) length *= style.spikes.boost;
    // Keep tips below the brow: squeeze anything longer than ~85% of the lid-to-brow gap.
    const maxLength = eye.browGap * 0.95;
    if (length > maxLength * 0.8) length = maxLength * (0.8 + 0.2 * Math.tanh((length / maxLength - 0.8) / 0.2));

    // Start direction: between "straight off the lid" and "towards the brows".
    const n = sample.normal;
    const d0 = norm({ x: n.x * 0.7 + up.x * 0.3, y: n.y * 0.7 + up.y * 0.3 });
    // Sweep outwards towards the outer corner; inner lashes lean slightly to the nose.
    const sign = d0.x * o.y - d0.y * o.x > 0 ? 1 : -1;
    const sweep = (t - 0.45) * 0.5 + (style.lean || 0) * t;

    const fanHere = style.fan && i % style.fan.every === 0;
    // A wispy "spike" is a few strands pinched together: one longer, thicker point.
    const strands = spike ? 1 : fanHere ? (lowRes ? Math.min(2, style.fan.strands) : style.fan.strands) : 1;
    const widthFactor = spike ? style.spikes.width ?? 1.5 : fanHere ? 0.8 : 1;
    const width = Math.max(minWidth, w * style.thickness * adj.thickness * widthFactor);
    const alpha = darkness * (fanHere && !spike ? style.fanAlpha ?? 0.7 : 0.92) * (lowRes ? 0.85 : 1);

    // Roots spread a little along the lid, not on a perfect grid.
    const rootShift = (r3 - 0.5) * spacing * 0.6;
    const root = {
      x: sample.x + sample.tangent.x * rootShift + n.x * w * 0.006,
      y: sample.y + sample.tangent.y * rootShift + n.y * w * 0.006,
    };

    for (let s = 0; s < strands; s++) {
      const r4 = rand(seed + s * 3.7 + 1);
      const spread = strands === 1 ? 0 : (s / (strands - 1) - 0.5) * style.fan.spread;
      const angle = (sweep + spread + (r2 - 0.5) * 0.12 + (r4 - 0.5) * 0.05) * sign;
      const d = rotate(d0, angle);
      const L = length * (strands === 1 ? 1 : 0.86 + 0.14 * r4);
      const curl = style.curl * adj.curl * (0.85 + 0.3 * r4);

      // Rises along d, then bends up towards the brows (the curl).
      const bend = norm({ x: d.x + up.x * 0.45 * curl, y: d.y + up.y * 0.45 * curl });
      const control = { x: root.x + d.x * L * 0.5, y: root.y + d.y * L * 0.5 };
      const tip = { x: control.x + bend.x * L * 0.5, y: control.y + bend.y * L * 0.5 };
      drawStrand(ctx, root, control, tip, width, alpha);
    }
  });

  // A thin lash band along the lid hides the roots, like real lash glue.
  if (adj.lashLine) {
    const lid = eye.lid;
    const start = Math.floor(lid.length * 0.06);
    const end = Math.ceil(lid.length * 0.985);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lid[start].x, lid[start].y);
    for (let i = start + 1; i < end; i++) ctx.lineTo(lid[i].x, lid[i].y);
    ctx.strokeStyle = `rgba(${LASH_RGB}, ${0.4 * darkness})`;
    ctx.lineWidth = Math.max(minWidth * 1.5, w * 0.017 * adj.thickness);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${LASH_RGB}, ${0.7 * darkness})`;
    ctx.lineWidth = Math.max(minWidth, w * 0.007 * adj.thickness);
    ctx.stroke();
    ctx.restore();
  }
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

  const target = getLayer(ctx.canvas.width, ctx.canvas.height);
  const lctx = target.getContext("2d");
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, target.width, target.height);
  lctx.setTransform(m);
  eyes.forEach((eye, i) => drawEye(lctx, eye, i, style, adjustments, pxScale));

  // Soften to match the photo. Browsers without canvas filters just skip this.
  const eyePx = Math.max(...eyes.map((e) => e.width)) * pxScale;
  const blur = clamp(eyePx / 800, 0.2, 0.5);
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
    ctx.beginPath();
    ctx.arc(landmarks[i].x * w, landmarks[i].y * h, Math.max(2, w / 500), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
