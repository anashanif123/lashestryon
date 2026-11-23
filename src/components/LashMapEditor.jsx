import { CURLS, FAN_TYPES, MIN_MM, MAX_MM, ZONES, safeThickness, thicknessesFor } from "../lib/lashStyles.js";
import CurlIcon from "./CurlIcon.jsx";

// The lash map, in the units lash artists use: mm per zone, curl, thickness, fan size.
export default function LashMapEditor({ style, onChange, onReset, changed }) {
  const fan = style.fan || 1;
  const setZone = (i, delta) => {
    const map = style.map.map((v, j) => (j === i ? Math.min(MAX_MM, Math.max(MIN_MM, +(v + delta).toFixed(1))) : v));
    onChange({ map });
  };

  return (
    <div className="mapper">
      <div className="map-bars" aria-label="Lash map">
        {style.map.map((mm, i) => (
          <div className={`map-zone map-zone-${ZONES[i].id}`} key={ZONES[i].id}>
            <button
              type="button"
              className="step"
              aria-label={`Longer at ${ZONES[i].label}`}
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
              aria-label={`Shorter at ${ZONES[i].label}`}
              onClick={() => setZone(i, -0.5)}
              disabled={mm <= MIN_MM}
            >
              −
            </button>
            <span className="zone-label">{ZONES[i].short}</span>
          </div>
        ))}
      </div>

      <div className="field">
        <span className="field-label">Curl</span>
        <div className="chip-row curl-row">
          {Object.entries(CURLS).map(([id, c]) => (
            <button
              key={id}
              type="button"
              title={c.note}
              aria-pressed={style.curl === id}
              className={`chip curl-chip${style.curl === id ? " is-active" : ""}`}
              onClick={() => onChange({ curl: id })}
            >
              <CurlIcon curl={id} width={22} height={16} strokeWidth={1.8} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        {CURLS[style.curl] && (
          <p className="curl-note">
            <strong>
              {CURLS[style.curl].label} curl · about {CURLS[style.curl].angle}°
            </strong>{" "}
            {CURLS[style.curl].note}
          </p>
        )}
      </div>

      <div className="field">
        <span className="field-label">Type</span>
        <div className="chip-row">
          {FAN_TYPES.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={fan === f.value}
              className={`chip${fan === f.value ? " is-active" : ""}`}
              onClick={() =>
                onChange({
                  fan: f.value,
                  // Keep the thickness safe for the new type (finer lashes for bigger fans).
                  thickness: safeThickness(style.thickness, f.value),
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

      <div className="field">
        <span className="field-label">Thickness (mm)</span>
        <div className="chip-row thickness-row">
          {thicknessesFor(fan).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={style.thickness === t}
              className={`chip${style.thickness === t ? " is-active" : ""}`}
              onClick={() => onChange({ thickness: t })}
            >
              {t.toFixed(2)}
            </button>
          ))}
        </div>
        <p className="curl-note">
          {fan === 1
            ? "Classic lashes use 0.10–0.20 mm."
            : `${fan}D fans use ${thicknessesFor(fan)
                .map((t) => t.toFixed(2))
                .join(", ")} mm. Finer lashes allow bigger fans: 0.05 up to 8D, 0.07 up to 5D, 0.10 up to 3D.`}
        </p>
      </div>

      {changed && (
        <button type="button" className="link-btn" onClick={onReset}>
          Reset to {style.baseName}
        </button>
      )}
    </div>
  );
}
