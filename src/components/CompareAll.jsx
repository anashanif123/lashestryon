import { useEffect, useMemo, useRef } from "react";
import { getEyes } from "../lib/eyeGeometry.js";
import { drawLashes } from "../lib/lashRenderer.js";

// Shows every style side by side, cropped to the eyes, so clients can choose at a glance.
function Tile({ photo, eyes, crop, style, adj, active, recommended, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    const out = ref.current;
    const scale = Math.min(2.5, 520 / crop.w);
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

export default function CompareAll({ styles, photo, landmarks, adj, activeId, recommended = [], onPick }) {
  const eyes = useMemo(() => getEyes(landmarks, photo.width, photo.height), [landmarks, photo]);
  const crop = useMemo(() => {
    if (!eyes) return null;
    // Crop around both eyes with room above for the lashes.
    const pts = eyes.flatMap((e) => [...e.upper, ...e.lower]);
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    const ew = maxX - minX;
    const x = Math.max(0, minX - ew * 0.12);
    const y = Math.max(0, minY - ew * 0.32);
    return {
      x,
      y,
      w: Math.min(photo.width, maxX + ew * 0.12) - x,
      h: Math.min(photo.height, maxY + ew * 0.14) - y,
    };
  }, [eyes, photo]);
  if (!eyes || !crop) return null;

  return (
    <div className="compare-grid">
      {styles.map((style) => (
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
