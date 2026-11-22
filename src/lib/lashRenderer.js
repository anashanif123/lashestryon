// Draws lashes on a canvas along the eyelids, in real millimetres.
//
// Realism notes:
// - Lengths come from the style's lash map (mm) and the face's own scale (from the iris).
// - In a front-facing photo lashes point partly towards the camera, so they look shorter
//   than they are (PROJECTION).
// - Lashes rise from the lid and curl up towards the brows, sweep outwards near the outer
//   corner and stay short at the inner corner. No two strands are identical.
// - Strands taper and fade to the tip, and are softened to match the photo.

import { DEBUG_INDICES } from "./eyeGeometry.js";
import { CURLS, LASH_COLORS, TIP_COLORS, lengthAt } from "./lashStyles.js";

const PROJECTION = 0.75; // how long a lash looks from the front, compared to its real length
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

// One lash: a curved strand from root to tip that gets thinner and lighter.
function drawStrand(ctx, root, control, tip, width, alpha, colors) {
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
  g.addColorStop(0, `rgba(${colors.base}, ${alpha})`);
  if (colors.tip) {
    // Coloured lashes are coloured along the outer half, so the colour shows on the photo.
    g.addColorStop(0.42, `rgba(${colors.base}, ${alpha * 0.92})`);
    g.addColorStop(0.72, `rgba(${colors.tip}, ${alpha * 0.9})`);
    g.addColorStop(1, `rgba(${colors.tip}, ${alpha * 0.55})`);
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

function drawUpper(ctx, eye, eyeIndex, style, adj, pxScale, colors) {
  const mm = eye.pxPerMm;
  // Eye width in the PHOTO's own pixels. A small or low-quality face can't show fine
  // detail even when zoomed in, so we draw fewer, softer strands for it.
  const wImg = eye.width;

  const maxByResolution = Math.max(14, Math.round(wImg * 0.9));
  const count = clamp(Math.round(style.count * adj.density), 10, maxByResolution);
  const lowRes = wImg < 70;
  const samples = eye.sampleAt(count, 0.05, 0.985);

  const closedFactor = 0.7 + 0.3 * eye.openness;
  const darkness = clamp(adj.darkness * (style.darkness ?? 1), 0.2, 1);
  const minWidth = Math.max(0.55 / pxScale, lowRes ? 0.5 : 0);
  const up = eye.up;
  const o = eye.outerDir;
  const spacing = eye.width / count;
  const lift = CURLS[style.curl]?.lift ?? 0.8;
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

    // Length from the lash map, with the very inner corner tapering off.
    const innerTaper = 0.55 + 0.45 * smoothstep(0, 0.18, t);
    let length = lengthAt(style.map, t) * mm * PROJECTION * innerTaper * closedFactor;
    length *= 1 + (r1 - 0.5) * style.jitter;
    const spike = style.spikes && i % style.spikes.every === 0;
    if (spike) length *= style.spikes.boost;
    // Keep tips below the brow: squeeze anything near the lid-to-brow gap.
    if (length > maxLength * 0.8) length = maxLength * (0.8 + 0.2 * Math.tanh((length / maxLength - 0.8) / 0.2));

    // Start direction: between "straight off the lid" and "towards the brows".
    const n = sample.normal;
    const d0 = norm({ x: n.x * 0.7 + up.x * 0.3, y: n.y * 0.7 + up.y * 0.3 });
    // Sweep outwards towards the outer corner; inner lashes lean slightly to the nose.
    const sign = d0.x * o.y - d0.y * o.x > 0 ? 1 : -1;
    const sweep = (t - 0.45) * 0.5 + (style.lean || 0) * t;

    const fanHere = fanSize > 1 && i % fanEvery === 0 && !spike;
    let strands = fanHere ? fanSize : 1;
    if (lowRes) strands = Math.min(strands, 3);
    const widthFactor = spike ? style.spikes.width ?? 1.5 : fanHere ? 0.85 : 1;
    const width = Math.max(minWidth, style.thickness * VISUAL_WIDTH * mm * widthFactor);
    const alpha = darkness * (strands > 1 ? strandAlpha(strands) : 0.92);

    // Roots spread a little along the lid, not on a perfect grid.
    const rootShift = (r3 - 0.5) * spacing * 0.6;
    const root = {
      x: sample.x + sample.tangent.x * rootShift + n.x * mm * 0.15,
      y: sample.y + sample.tangent.y * rootShift + n.y * mm * 0.15,
    };

    for (let s = 0; s < strands; s++) {
      const r4 = rand(seed + s * 3.7 + 1);
      const open = strands === 1 ? 0 : (s / (strands - 1) - 0.5) * spread;
      const angle = (sweep + open + (r2 - 0.5) * 0.12 + (r4 - 0.5) * 0.05) * sign;
      const d = rotate(d0, angle);
      const L = length * (strands === 1 ? 1 : 0.86 + 0.14 * r4);
      const curl = lift * (0.85 + 0.3 * r4);

      // Rises along d, then bends up towards the brows (the curl).
      const bend = norm({ x: d.x + up.x * 0.45 * curl, y: d.y + up.y * 0.45 * curl });
      const control = { x: root.x + d.x * L * 0.5, y: root.y + d.y * L * 0.5 };
      const tip = { x: control.x + bend.x * L * 0.5, y: control.y + bend.y * L * 0.5 };
      drawStrand(ctx, root, control, tip, width, alpha, colors);
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
    const control = { x: root.x + d.x * length * 0.5, y: root.y + d.y * length * 0.5 };
    const tip = { x: root.x + d.x * length, y: root.y + d.y * length };
    drawStrand(ctx, root, control, tip, Math.max(minWidth, 0.07 * VISUAL_WIDTH * mm), 0.62 * darkness, colors);
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
