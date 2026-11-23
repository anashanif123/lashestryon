import { curlTurns } from "../lib/lashStyles.js";

/** Side view of one lash extension with the given curl, like a supplier's curl chart. */
export default function CurlIcon({ curl, width = 28, height = 22, strokeWidth = 2 }) {
  const turns = curlTurns(curl, 24);
  const len = width * 0.95;
  const ds = len / turns.length;
  let x = 1.5;
  let y = height - 2;
  let d = `M${x.toFixed(2)} ${y.toFixed(2)}`;
  turns.forEach((t, i) => {
    const phi = t - (t - (i ? turns[i - 1] : 0)) / 2;
    x += Math.cos(phi) * ds;
    y -= Math.sin(phi) * ds;
    d += ` L${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  return (
    <svg className="curl-icon" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}
