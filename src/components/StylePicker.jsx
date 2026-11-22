import { useEffect, useRef } from "react";
import { LASH_STYLES, DEFAULT_ADJUSTMENTS } from "../lib/lashStyles.js";
import { syntheticEye } from "../lib/eyeGeometry.js";
import { drawLashes } from "../lib/lashRenderer.js";

// Small drawn eye showing each style, made with the same code as the try-on.
function StyleThumb({ style }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const dpr = window.devicePixelRatio || 1;
    const w = 120;
    const h = 64;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const eye = syntheticEye(w / 2, h * 0.68, 70);
    // Eye shape
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(60, 40, 50, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    eye.upper.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    [...eye.lower].reverse().forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Iris
    ctx.fillStyle = "#6b4b3e";
    ctx.beginPath();
    ctx.arc(w / 2 + 2, h * 0.62, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d1214";
    ctx.beginPath();
    ctx.arc(w / 2 + 2, h * 0.62, 4, 0, Math.PI * 2);
    ctx.fill();
    drawLashes(ctx, [eye], style, DEFAULT_ADJUSTMENTS);
  }, [style]);
  return <canvas ref={ref} className="thumb-canvas" aria-hidden="true" />;
}

export default function StylePicker({ value, onChange, recommended = [] }) {
  return (
    <div className="style-grid" role="radiogroup" aria-label="Lash style">
      {LASH_STYLES.map((style) => (
        <button
          key={style.id}
          type="button"
          role="radio"
          aria-checked={value === style.id}
          className={`style-card${value === style.id ? " is-active" : ""}`}
          onClick={() => onChange(style.id)}
        >
          <StyleThumb style={style} />
          <span className="style-name">
            {style.name}
            {recommended.includes(style.id) && <span className="badge">Suggested</span>}
          </span>
          <span className="style-blurb">{style.blurb}</span>
        </button>
      ))}
    </div>
  );
}
