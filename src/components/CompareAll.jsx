import { useEffect, useRef } from "react";
import { LASH_STYLES } from "../lib/lashStyles.js";
import { getEyes } from "../lib/eyeGeometry.js";
import { drawLashes } from "../lib/lashRenderer.js";

// Shows every style side by side, cropped to the eyes, so clients can choose at a glance.
function Tile({ photo, eyes, crop, style, adj, active, recommended, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    const out = ref.current;
    const scale = Math.min(2, 520 / crop.w);
    out.width = Math.round(crop.w * scale);
    out.height = Math.round(crop.h * scale);
    const ctx = out.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, -crop.x * scale, -crop.y * scale);
    ctx.drawImage(photo, 0, 0);
    drawLashes(ctx, eyes, style, adj);
  }, [photo, eyes, crop, style, adj]);

  return (
    <button type="button" className={`compare-tile${active ? " is-active" : ""}`} onClick={() => onPick(style.id)}>
      <canvas ref={ref} />
      <span className="compare-label">
        {style.name}
        {recommended && <span className="badge">Suggested</span>}
      </span>
    </button>
  );
}

export default function CompareAll({ photo, landmarks, adj, activeId, recommended = [], onPick }) {
  const eyes = getEyes(landmarks, photo.width, photo.height);
  if (!eyes) return null;

  // Crop around both eyes with room above for the lashes.
  const pts = eyes.flatMap((e) => [...e.upper, ...e.lower]);
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const ew = maxX - minX;
  const crop = {
    x: Math.max(0, minX - ew * 0.12),
    y: Math.max(0, minY - ew * 0.3),
    w: Math.min(photo.width, maxX + ew * 0.12) - Math.max(0, minX - ew * 0.12),
    h: Math.min(photo.height, maxY + ew * 0.12) - Math.max(0, minY - ew * 0.3),
  };

  return (
    <div className="compare-grid">
      {LASH_STYLES.map((style) => (
        <Tile
          key={style.id}
          photo={photo}
          eyes={eyes}
          crop={crop}
          style={style}
          adj={adj}
          active={style.id === activeId}
          recommended={recommended.includes(style.id)}
          onPick={onPick}
        />
      ))}
    </div>
  );
}
