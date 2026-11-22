import { useEffect, useRef, useState } from "react";
import { CATEGORIES, DEFAULT_ADJUSTMENTS } from "../lib/lashStyles.js";
import { syntheticEye } from "../lib/eyeGeometry.js";
import { drawLashes } from "../lib/lashRenderer.js";

// Small drawn eye showing a style, made with the same code as the try-on.
export function StyleThumb({ style, adj = DEFAULT_ADJUSTMENTS, width = 120, height = 64 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const eyeW = width * 0.56;
    const eye = syntheticEye(width / 2, height * 0.7, eyeW);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(60, 40, 50, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    eye.upper.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    [...eye.lower].reverse().forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const irisR = eyeW * 0.13;
    ctx.fillStyle = "#6b4b3e";
    ctx.beginPath();
    ctx.arc(width / 2 + 2, height * 0.64, irisR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d1214";
    ctx.beginPath();
    ctx.arc(width / 2 + 2, height * 0.64, irisR * 0.45, 0, Math.PI * 2);
    ctx.fill();
    drawLashes(ctx, [eye], style, { ...adj, lower: false, density: Math.min(adj.density, 1) });
  }, [style, adj, width, height]);
  return <canvas ref={ref} className="thumb-canvas" style={{ width, height }} aria-hidden="true" />;
}

export default function StylePicker({ styles, value, onChange, recommended = [] }) {
  const [cat, setCat] = useState("all");
  const cats = CATEGORIES.filter((c) => c.id === "all" || styles.some((s) => s.category === c.id));
  const shown = cat === "all" ? styles : styles.filter((s) => s.category === cat);

  return (
    <div className="style-picker">
      {cats.length > 2 && (
        <div className="chip-row" role="tablist" aria-label="Style type">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              className={`chip${cat === c.id ? " is-active" : ""}`}
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="style-grid" role="radiogroup" aria-label="Lash style">
        {shown.map((style) => (
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
    </div>
  );
}
