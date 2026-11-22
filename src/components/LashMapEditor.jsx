import { CURLS, THICKNESSES, MIN_MM, MAX_MM } from "../lib/lashStyles.js";

const ZONES = ["Inner", "2", "Centre", "4", "Outer"];
const FANS = [
  { value: 1, label: "Classic" },
  { value: 2, label: "2D" },
  { value: 3, label: "3D" },
  { value: 4, label: "4D" },
  { value: 5, label: "5D" },
  { value: 6, label: "6D" },
  { value: 8, label: "8D" },
];

// The lash map, in the units lash artists use: mm per zone, curl, thickness, fan size.
export default function LashMapEditor({ style, onChange, onReset, changed }) {
  const setZone = (i, delta) => {
    const map = style.map.map((v, j) => (j === i ? Math.min(MAX_MM, Math.max(MIN_MM, +(v + delta).toFixed(1))) : v));
    onChange({ map });
  };

  return (
    <div className="mapper">
      <div className="map-bars" aria-label="Lash map">
        {style.map.map((mm, i) => (
          <div className="map-zone" key={ZONES[i]}>
            <button
              type="button"
              className="step"
              aria-label={`Longer, zone ${ZONES[i]}`}
              onClick={() => setZone(i, 0.5)}
              disabled={mm >= MAX_MM}
            >
              +
            </button>
            <div className="bar-track">
              <div className="bar" style={{ height: `${((mm - MIN_MM + 1) / (MAX_MM - MIN_MM + 1)) * 100}%` }} />
            </div>
            <span className="mm">{+mm.toFixed(1)}</span>
            <button
              type="button"
              className="step"
              aria-label={`Shorter, zone ${ZONES[i]}`}
              onClick={() => setZone(i, -0.5)}
              disabled={mm <= MIN_MM}
            >
              −
            </button>
            <span className="zone-label">{ZONES[i]}</span>
          </div>
        ))}
      </div>

      <div className="field">
        <span className="field-label">Curl</span>
        <div className="chip-row">
          {Object.entries(CURLS).map(([id, c]) => (
            <button
              key={id}
              type="button"
              title={c.note}
              className={`chip${style.curl === id ? " is-active" : ""}`}
              onClick={() => onChange({ curl: id })}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Thickness (mm)</span>
        <div className="chip-row">
          {THICKNESSES.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip${style.thickness === t ? " is-active" : ""}`}
              onClick={() => onChange({ thickness: t })}
            >
              {t.toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Type</span>
        <div className="chip-row">
          {FANS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`chip${(style.fan || 1) === f.value ? " is-active" : ""}`}
              onClick={() =>
                onChange({
                  fan: f.value,
                  // classic → hybrid/volume needs a fan spread; volume → classic drops spikes
                  spread: style.spread ?? 0.26,
                  fanEvery: f.value === 1 ? 1 : style.fanEvery || 1,
                })
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {changed && (
        <button type="button" className="link-btn" onClick={onReset}>
          Reset to {style.baseName}
        </button>
      )}
    </div>
  );
}
